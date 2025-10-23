import { storage } from "../storage";
import { encryptCredential, decryptCredential } from "../encryption";
import { createOrderlyClient, OrderlyClient } from "./client";

/**
 * Get Orderly client for a user by fetching and decrypting their API credentials
 */
export async function getUserOrderlyClient(userId: string, label: string = "Main Account"): Promise<OrderlyClient> {
  console.log(`[Orderly] Fetching client for user ${userId}, label: ${label}`);
  
  // Fetch the API keys from storage
  const apiKeys = await storage.getApiKeysByProvider(userId, "exchange", "orderly");
  
  // Find the key with matching label
  const apiKey = apiKeys.find(k => k.label === label);
  
  if (!apiKey) {
    throw new Error(`No Orderly API credentials found for user ${userId} with label "${label}"`);
  }
  
  // Decrypt the API credentials
  const apiSecret = decryptCredential(
    apiKey.encryptedApiKey,
    apiKey.apiKeyIv,
    apiKey.encryptedDek,
    apiKey.dekIv
  );
  
  // Get account ID from metadata (user's Ethereum address)
  const metadata = apiKey.metadata as any;
  if (!metadata || !metadata.accountId) {
    throw new Error('Orderly account ID not found in API key metadata');
  }
  
  const accountId = metadata.accountId;
  const testnet = metadata.testnet === true;
  
  // Decrypt the public key (Orderly API Key)
  const orderlyApiKey = apiKey.publicKey;
  if (!orderlyApiKey) {
    throw new Error('Orderly API key (public key) not found');
  }
  
  // Create and return the client
  return createOrderlyClient({
    apiKey: orderlyApiKey,
    apiSecret,
    accountId,
    testnet,
  });
}

/**
 * Check if user has Orderly credentials
 */
export async function hasOrderlyCredentials(userId: string, label: string = "Main Account"): Promise<boolean> {
  try {
    const apiKeys = await storage.getApiKeysByProvider(userId, "exchange", "orderly");
    return apiKeys.some(k => k.label === label);
  } catch (error) {
    return false;
  }
}

/**
 * Store Orderly API credentials for a user
 */
export async function storeOrderlyCredentials(
  userId: string,
  orderlyApiKey: string,
  orderlyApiSecret: string,
  accountId: string,
  testnet: boolean = false,
  label: string = "Main Account"
): Promise<void> {
  console.log(`[Orderly] Storing credentials for user ${userId}, label: ${label}`);
  
  // Encrypt the API secret using envelope encryption
  const { encryptedPrivateKey, credentialIv, encryptedDek, dekIv } = encryptCredential(orderlyApiSecret);
  
  await storage.createApiKey(userId, {
    providerType: "exchange",
    providerName: "orderly",
    label,
    encryptedApiKey: encryptedPrivateKey, // Encrypted API secret
    apiKeyIv: credentialIv,
    encryptedDek,
    dekIv,
    publicKey: orderlyApiKey, // Store the Orderly API key as public key (not encrypted)
    metadata: {
      accountId, // User's Ethereum address
      testnet,
    },
  });
  
  console.log(`[Orderly] Credentials stored successfully for user ${userId}`);
}

/**
 * Delete Orderly credentials for a user
 */
export async function deleteOrderlyCredentials(userId: string, label: string = "Main Account"): Promise<void> {
  console.log(`[Orderly] Deleting credentials for user ${userId}, label: ${label}`);
  
  // Find the API key by label
  const apiKeys = await storage.getApiKeysByProvider(userId, "exchange", "orderly");
  const apiKey = apiKeys.find(k => k.label === label);
  
  if (!apiKey) {
    throw new Error(`No Orderly API credentials found for user ${userId} with label "${label}"`);
  }
  
  await storage.deleteApiKey(userId, apiKey.id);
  console.log(`[Orderly] Credentials deleted successfully for user ${userId}`);
}
