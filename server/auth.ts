import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from "zod";

// Validation schemas for auth requests
const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  email: z.string().email("Invalid email address").or(z.literal("")),
});

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
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

      const user = await storage.createUser({
        username: validatedData.username,
        password: await hashPassword(validatedData.password),
        email: validatedData.email || null, // Normalize empty string to null for unique constraint
      });

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
}
