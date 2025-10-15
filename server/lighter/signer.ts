import { ethers } from "ethers";

export class LighterSigner {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    try {
      // Ensure private key has 0x prefix if it doesn't
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      
      // Validate private key format (should be 64 hex characters + optional 0x prefix)
      const hexKey = formattedKey.replace('0x', '');
      if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
        throw new Error(`Invalid private key format. Expected 64 hex characters, got ${hexKey.length}. Please check your LIGHTER_API_KEY_PRIVATE_KEY.`);
      }
      
      this.wallet = new ethers.Wallet(formattedKey);
    } catch (error: any) {
      console.error("Failed to initialize LighterSigner:", error.message);
      throw new Error(`Invalid Lighter API key private key: ${error.message}`);
    }
  }

  async signMessage(message: string): Promise<string> {
    return await this.wallet.signMessage(message);
  }

  async createAuthToken(expiryMinutes: number = 10): Promise<string> {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);
    const message = `lighter-auth:${expiryTimestamp}`;
    const signature = await this.signMessage(message);
    return `${message}:${signature}`;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async signOrderParams(params: {
    marketIndex: number;
    accountIndex: number;
    apiKeyIndex: number;
    side: "buy" | "sell";
    amount: string;
    price: string;
    orderType: string;
    timeInForce: string;
    clientOrderIndex: number;
    nonce: number;
  }): Promise<string> {
    const message = this.encodeOrderParams(params);
    return await this.signMessage(message);
  }

  private encodeOrderParams(params: any): string {
    // Encode order parameters according to Lighter's protocol
    // This is a simplified version - actual implementation would need to match Lighter's exact encoding
    return JSON.stringify(params);
  }
}
