import { storage } from "./storage";
import { encryptCredential, decryptCredential } from "./encryption";

/**
 * Service for managing encrypted user API credentials
 * Uses envelope encryption for maximum security
 */

/**
 * Store a user's Hyperliquid private key (encrypted with envelope encryption)
 */
export async function storeUserCredentials(
  userId: string,
  privateKey: string
): Promise<void> {
  try {
    // Encrypt the private key using envelope encryption
    const { encryptedPrivateKey, credentialIv, encryptedDek, dekIv } = encryptCredential(privateKey);
    
    // Check if credentials already exist for this user
    const existing = await storage.getUserCredentials(userId);
    
    if (existing) {
      // Update existing credentials
      await storage.updateUserCredentials(userId, {
        encryptedPrivateKey,
        credentialIv,
        encryptedDek,
        dekIv,
        lastUsed: new Date(),
      });
      console.log(`[Credentials] Updated credentials for user ${userId}`);
    } else {
      // Create new credentials
      await storage.createUserCredentials({
        userId,
        encryptedPrivateKey,
        credentialIv,
        encryptedDek,
        dekIv,
      });
      console.log(`[Credentials] Stored new credentials for user ${userId}`);
    }
  } catch (error) {
    console.error(`[Credentials] Error storing credentials for user ${userId}:`, error);
    throw new Error('Failed to store user credentials securely');
  }
}

/**
 * Retrieve and decrypt a user's Hyperliquid private key
 */
export async function getUserPrivateKey(userId: string): Promise<string | null> {
  try {
    const credentials = await storage.getUserCredentials(userId);
    
    if (!credentials) {
      console.log(`[Credentials] No credentials found for user ${userId}`);
      return null;
    }
    
    // Decrypt using envelope encryption
    const privateKey = decryptCredential(
      credentials.encryptedPrivateKey,
      credentials.credentialIv,
      credentials.encryptedDek,
      credentials.dekIv
    );
    
    // Update last used timestamp
    await storage.updateUserCredentials(userId, {
      lastUsed: new Date(),
    });
    
    return privateKey;
  } catch (error) {
    console.error(`[Credentials] Error retrieving credentials for user ${userId}:`, error);
    throw new Error('Failed to retrieve user credentials');
  }
}

/**
 * Delete a user's credentials
 */
export async function deleteUserCredentials(userId: string): Promise<void> {
  try {
    await storage.deleteUserCredentials(userId);
    console.log(`[Credentials] Deleted credentials for user ${userId}`);
  } catch (error) {
    console.error(`[Credentials] Error deleting credentials for user ${userId}:`, error);
    throw new Error('Failed to delete user credentials');
  }
}

/**
 * Check if a user has credentials stored
 */
export async function hasUserCredentials(userId: string): Promise<boolean> {
  const credentials = await storage.getUserCredentials(userId);
  return credentials !== null;
}
