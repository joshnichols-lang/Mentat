import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from "zod";
import { stopUserMonitoring } from "./userMonitoringManager";

// Strong password validation schema
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must be less than 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Validation schemas for auth requests
const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100), // Login accepts any password to check against stored hash
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: passwordSchema,
});

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Ensure a default admin account exists
export async function ensureDefaultAdmin() {
  try {
    const existingAdmin = await storage.getUserByUsername("admin");
    if (!existingAdmin) {
      const defaultPassword = "Admin123!"; // Default password - user should change this
      const hashedPassword = await hashPassword(defaultPassword);
      
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        email: null,
        role: "admin",
        verificationStatus: "approved",
      });
      
      console.log("[Auth] ✓ Created default admin account (username: admin, password: Admin123!)");
      console.log("[Auth] ⚠️  IMPORTANT: Change the default admin password immediately!");
    }
  } catch (error) {
    console.error("[Auth] Failed to create default admin account:", error);
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore, // Use PostgreSQL session store
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // CSRF protection
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Validate input
        const validatedData = loginSchema.parse({ username, password });
        
        const user = await storage.getUserByUsername(validatedData.username);
        if (!user || !user.password) {
          return done(null, false);
        }
        const isValid = await comparePasswords(validatedData.password, user.password);
        if (!isValid) {
          return done(null, false);
        }
        return done(null, user);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return done(null, false); // Invalid format treated as failed login
        }
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate request body
      const validatedData = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Check if this is the first user - if so, make them admin
      const allUsers = await storage.getAllUsers();
      const isFirstUser = allUsers.length === 0;

      const user = await storage.createUser({
        username: validatedData.username,
        password: await hashPassword(validatedData.password),
        email: null,
        role: isFirstUser ? "admin" : "user", // First user is admin
        verificationStatus: isFirstUser ? "approved" : "pending", // First user is auto-approved
      });

      console.log(`[Auth] Created ${isFirstUser ? 'FIRST USER (admin)' : 'new user'}: ${user.username}`);

      req.login(user, (err) => {
        if (err) return next(err);
        // Sanitize response - don't send password hash
        const { password, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      next(error);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Sanitize response - don't send password hash
    const { password, ...safeUser } = req.user!;
    res.status(200).json(safeUser);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // GET logout route for browser navigation - redirects to login page
  app.get("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.redirect("/auth");
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Sanitize response - don't send password hash
    const { password, ...safeUser } = req.user!;
    res.json(safeUser);
  });

  app.post("/api/user/wallet-address", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const schema = z.object({
        walletAddress: z.string()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address"),
      });
      
      const { walletAddress } = schema.parse(req.body);
      const userId = req.user!.id;
      
      // Update user's wallet address (verification status remains pending by default)
      await storage.updateUserWalletAddress(userId, walletAddress);
      
      res.json({ success: true, walletAddress });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid wallet address", details: error.errors });
      }
      next(error);
    }
  });

  // Admin routes for user verification
  app.get("/api/admin/pending-users", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Check if user is admin
      const currentUser = req.user!;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const pendingUsers = await storage.getPendingVerificationUsers();
      res.json(pendingUsers);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/verify-user/:userId", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Check if user is admin
      const currentUser = req.user!;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const schema = z.object({
        status: z.enum(["approved", "rejected"]),
      });
      
      const { status } = schema.parse(req.body);
      const { userId } = req.params;
      
      const updatedUser = await storage.updateUserVerificationStatus(userId, status);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      next(error);
    }
  });

  // Get all users (admin only)
  app.get("/api/admin/users", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const currentUser = req.user!;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const allUsers = await storage.getAllUsers();
      
      // Fetch AI usage stats for each user
      const usersWithStats = await Promise.all(
        allUsers.map(async ({ password, ...user }) => {
          try {
            const aiStats = await storage.getAiUsageStats(user.id);
            return {
              ...user,
              aiUsage: {
                totalRequests: aiStats.totalRequests,
                totalCost: aiStats.totalCost,
                totalTokens: aiStats.totalTokens,
              }
            };
          } catch (error) {
            console.error(`Failed to fetch AI stats for user ${user.id}:`, error);
            return {
              ...user,
              aiUsage: {
                totalRequests: 0,
                totalCost: "0",
                totalTokens: 0,
              }
            };
          }
        })
      );
      
      res.json(usersWithStats);
    } catch (error) {
      next(error);
    }
  });

  // Delete user (admin only)
  app.delete("/api/admin/users/:userId", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const currentUser = req.user!;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { userId } = req.params;

      // Prevent admin from deleting themselves
      if (userId === currentUser.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      // Stop any active monitoring for this user BEFORE deleting
      console.log(`[User Deletion] Stopping monitoring for user ${userId} before deletion...`);
      await stopUserMonitoring(userId);
      
      await storage.deleteUser(userId);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Create user manually (admin only) - for beta testers, etc.
  app.post("/api/admin/users/create", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const currentUser = req.user!;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const createUserSchema = z.object({
        username: z.string().min(3).max(50),
        password: passwordSchema,
        email: z.string().email("Invalid email address").optional(),
        autoApprove: z.boolean().optional(),
      });

      const { username, password, email, autoApprove } = createUserSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Create the user with hashed password
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email: email || null,
      });

      // If autoApprove is true, automatically verify the user
      let finalUser = user;
      if (autoApprove) {
        const approvedUser = await storage.updateUserVerificationStatus(user.id, "approved");
        if (approvedUser) {
          finalUser = approvedUser;
        }
      }

      // Return sanitized user (no password hash)
      const { password: _, ...safeUser } = finalUser;
      res.status(201).json({ 
        success: true, 
        user: safeUser,
        message: `User '${username}' created successfully${autoApprove ? ' and auto-approved' : ''}` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      next(error);
    }
  });
}
