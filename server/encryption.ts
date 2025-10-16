import crypto from 'crypto';

/**
 * Encryption utilities for securing user API credentials
 * Uses AES-256-GCM with envelope encryption for maximum security
 * 
 * Envelope Encryption Process:
 * 1. Generate a random Data Encryption Key (DEK) for each credential
 * 2. Encrypt the credential with the DEK
 * 3. Encrypt the DEK with the master key
 * 4. Store both encrypted credential and encrypted DEK
 * 
 * This ensures that if one DEK is compromised, only one credential is at risk.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key

/**
 * Get the master encryption key from environment
 */
function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_MASTER_KEY;
  
  if (!keyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable not set');
  }
  
  const key = Buffer.from(keyHex, 'hex');
  
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid master key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  
  return key;
}

/**
 * Internal: Encrypt data with a given key
 */
function encryptWithKey(plaintext: string, key: Buffer): { 
  encryptedData: string; 
  iv: string; 
} {
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  // Combine encrypted data and auth tag
  const encryptedWithTag = encrypted + authTag.toString('hex');
  
  return {
    encryptedData: encryptedWithTag,
    iv: iv.toString('hex'),
  };
}

/**
 * Internal: Decrypt data with a given key
 */
function decryptWithKey(encryptedData: string, ivHex: string, key: Buffer): string {
  // Convert IV from hex
  const iv = Buffer.from(ivHex, 'hex');
  
  // Validate input lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  
  if (encryptedData.length < AUTH_TAG_LENGTH * 2) {
    throw new Error('Encrypted data too short to contain auth tag');
  }
  
  // Extract auth tag (last 16 bytes / 32 hex chars)
  const authTagHex = encryptedData.slice(-AUTH_TAG_LENGTH * 2);
  const encryptedHex = encryptedData.slice(0, -AUTH_TAG_LENGTH * 2);
  
  const authTag = Buffer.from(authTagHex, 'hex');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt the data
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt a credential using envelope encryption
 * 1. Generate a random DEK
 * 2. Encrypt the credential with the DEK
 * 3. Encrypt the DEK with the master key
 */
export function encryptCredential(plaintext: string): { 
  encryptedPrivateKey: string; 
  credentialIv: string;
  encryptedDek: string;
  dekIv: string;
} {
  // Generate a unique DEK for this credential
  const dek = crypto.randomBytes(KEY_LENGTH);
  
  // Encrypt the credential with the DEK
  const { encryptedData: encryptedPrivateKey, iv: credentialIv } = encryptWithKey(plaintext, dek);
  
  // Encrypt the DEK with the master key (envelope encryption)
  const masterKey = getMasterKey();
  const { encryptedData: encryptedDek, iv: dekIv } = encryptWithKey(dek.toString('hex'), masterKey);
  
  return {
    encryptedPrivateKey,
    credentialIv,
    encryptedDek,
    dekIv,
  };
}

/**
 * Decrypt a credential using envelope encryption
 * 1. Decrypt the DEK using the master key
 * 2. Decrypt the credential using the DEK
 */
export function decryptCredential(
  encryptedPrivateKey: string, 
  credentialIv: string,
  encryptedDek: string,
  dekIv: string
): string {
  // Decrypt the DEK using the master key
  const masterKey = getMasterKey();
  const dekHex = decryptWithKey(encryptedDek, dekIv, masterKey);
  const dek = Buffer.from(dekHex, 'hex');
  
  // Validate DEK length
  if (dek.length !== KEY_LENGTH) {
    throw new Error(`Invalid DEK length: expected ${KEY_LENGTH} bytes, got ${dek.length}`);
  }
  
  // Decrypt the credential using the DEK
  const plaintext = decryptWithKey(encryptedPrivateKey, credentialIv, dek);
  
  return plaintext;
}

/**
 * Test envelope encryption/decryption roundtrip
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test-private-key-0x1234567890abcdef';
    const { encryptedPrivateKey, credentialIv, encryptedDek, dekIv } = encryptCredential(testData);
    const decrypted = decryptCredential(encryptedPrivateKey, credentialIv, encryptedDek, dekIv);
    
    if (decrypted !== testData) {
      console.error('[Encryption] Roundtrip test failed: decrypted data does not match');
      return false;
    }
    
    console.log('[Encryption] Envelope encryption roundtrip test passed');
    return true;
  } catch (error) {
    console.error('[Encryption] Test failed:', error);
    return false;
  }
}
