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

async function updateAdminPassword() {
  const username = "admin";
  const newPassword = "admin123";

  try {
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!existingUser) {
      console.error(`Error: User '${username}' does not exist`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await hashPassword(newPassword);

    // Update admin password
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.username, username));

    console.log("✅ Admin password updated successfully!");
    console.log(`Username: ${username}`);
    console.log(`New password: ${newPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error updating admin password:", error);
    process.exit(1);
  }
}

updateAdminPassword();
