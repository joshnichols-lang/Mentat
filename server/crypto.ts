import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encryption algorithm
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes authentication tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Get or generate the master encryption key from environment
 * In production, this should be stored in Replit secrets
 */
function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  
  if (!key) {
    throw new Error("ENCRYPTION_MASTER_KEY not found in environment. Please set this secret.");
  }
  
  // Convert hex string to buffer (key should be 64 hex chars = 32 bytes)
  if (key.length !== KEY_LENGTH * 2) {
    throw new Error(`ENCRYPTION_MASTER_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`);
  }
  
  return Buffer.from(key, "hex");
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * Returns { encrypted: string, iv: string, authTag: string }
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const masterKey = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt data encrypted with AES-256-GCM
 */
export function decrypt(encrypted: string, iv: string, authTag: string): string {
  const masterKey = getMasterKey();
  const ivBuffer = Buffer.from(iv, "hex");
  const authTagBuffer = Buffer.from(authTag, "hex");
  
  const decipher = createDecipheriv(ALGORITHM, masterKey, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Generate a secure random master key (for setup)
 * Run this once to generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
