import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error("Usage: tsx scripts/create-admin.ts <username> <password>");
    console.error("Example: tsx scripts/create-admin.ts admin SecurePass123!");
    process.exit(1);
  }

  const [username, password] = args;

  // Validate inputs
  if (username.length < 3 || username.length > 50) {
    console.error("Error: Username must be 3-50 characters");
    process.exit(1);
  }

  if (password.length < 6 || password.length > 100) {
    console.error("Error: Password must be 6-100 characters");
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      console.error(`Error: User '${username}' already exists`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create admin user
    const [newAdmin] = await db.insert(users).values({
      username,
      password: hashedPassword,
      email: null,
      role: "admin",
      verificationStatus: "approved", // Auto-approve admin
      verifiedAt: new Date(),
      onboardingStep: "complete",
    }).returning();

    console.log("✅ Admin user created successfully!");
    console.log(`Username: ${newAdmin.username}`);
    console.log(`Role: ${newAdmin.role}`);
    console.log(`Verification Status: ${newAdmin.verificationStatus}`);
    console.log(`\nYou can now login at the login page with these credentials.`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
}

createAdmin();
