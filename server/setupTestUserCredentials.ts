import { storeUserCredentials } from "./credentialService";
import { TEST_USER_ID } from "./constants";

async function setupTestUserCredentials() {
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("HYPERLIQUID_PRIVATE_KEY environment variable not set!");
    process.exit(1);
  }
  
  console.log(`Setting up credentials for TEST_USER_ID: ${TEST_USER_ID}`);
  
  try {
    await storeUserCredentials(TEST_USER_ID, privateKey);
    console.log("✅ Successfully stored credentials for TEST_USER_ID");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to store credentials:", error);
    process.exit(1);
  }
}

setupTestUserCredentials();
