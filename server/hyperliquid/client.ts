import { Hyperliquid } from "hyperliquid";

export interface HyperliquidConfig {
  privateKey: string;
  testnet?: boolean;
  walletAddress?: string;
}

export interface MarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

export interface Position {
  coin: string;
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  leverage: {
    type: string;
    value: number;
  };
}

export interface OrderParams {
  coin: string;
  is_buy: boolean;
  sz: number;
  limit_px: number;
  order_type: { limit: { tif: "Gtc" | "Ioc" | "Alo" } } | { market: {} };
  reduce_only?: boolean;
}

export class HyperliquidClient {
  private sdk: Hyperliquid;
  private config: HyperliquidConfig;

  constructor(config: HyperliquidConfig) {
    this.config = config;
    
    this.sdk = new Hyperliquid({
      privateKey: config.privateKey,
      testnet: config.testnet || false,
      walletAddress: config.walletAddress,
      enableWs: false, // Disable WebSocket for now
    });
  }

  async getMarketData(): Promise<MarketData[]> {
    try {
      // Get all market mid prices
      const mids = await this.sdk.info.getAllMids();
      
      const marketData: MarketData[] = [];
      
      for (const [asset, price] of Object.entries(mids)) {
        marketData.push({
          symbol: asset,
          price: price as string,
          change24h: "0", // Would need historical data
          volume24h: "0", // Would need to aggregate trades
        });
      }
      
      return marketData;
    } catch (error) {
      console.error("Failed to fetch Hyperliquid market data:", error);
      return [];
    }
  }

  async getUserState(address?: string): Promise<any> {
    try {
      const userAddress = address || this.config.walletAddress;
      if (!userAddress) {
        throw new Error("No wallet address provided");
      }
      
      const state = await this.sdk.info.perpetuals.getClearinghouseState(userAddress);
      return state;
    } catch (error) {
      console.error("Failed to fetch user state:", error);
      return null;
    }
  }

  async getPositions(address?: string): Promise<Position[]> {
    try {
      const state = await this.getUserState(address);
      if (!state || !state.assetPositions) {
        return [];
      }
      
      return state.assetPositions.map((pos: any) => ({
        coin: pos.position.coin,
        szi: pos.position.szi,
        entryPx: pos.position.entryPx,
        positionValue: pos.position.positionValue,
        unrealizedPnl: pos.position.unrealizedPnl,
        leverage: pos.position.leverage,
      }));
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      return [];
    }
  }

  async placeOrder(params: OrderParams): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const response = await this.sdk.exchange.placeOrder(params);
      
      return {
        success: true,
        response,
      };
    } catch (error: any) {
      console.error("Failed to place order:", error);
      return {
        success: false,
        error: error.message || "Failed to place order",
      };
    }
  }

  async cancelOrder(params: { coin: string; oid: number }): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sdk.exchange.cancelOrder({
        coin: params.coin,
        o: params.oid,
      });
      return { success: true };
    } catch (error: any) {
      console.error("Failed to cancel order:", error);
      return {
        success: false,
        error: error.message || "Failed to cancel order",
      };
    }
  }

  async cancelAllOrders(coin?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Note: This is a simplified implementation
      // The SDK may have a direct cancelAllOrders method we can use instead
      return { 
        success: false,
        error: "Cancel all orders not yet implemented" 
      };
    } catch (error: any) {
      console.error("Failed to cancel all orders:", error);
      return {
        success: false,
        error: error.message || "Failed to cancel all orders",
      };
    }
  }

  async getOrderbook(coin: string): Promise<any> {
    try {
      // Use the correct method name from SDK
      const orderbook = await this.sdk.info.perpetuals.getL2Snapshot(coin);
      return orderbook;
    } catch (error) {
      console.error("Failed to fetch orderbook:", error);
      return null;
    }
  }

  async updateLeverage(params: { coin: string; is_cross: boolean; leverage: number }): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sdk.exchange.updateLeverage(
        params.leverage.toString(),
        params.coin,
        params.is_cross
      );
      return { success: true };
    } catch (error: any) {
      console.error("Failed to update leverage:", error);
      return {
        success: false,
        error: error.message || "Failed to update leverage",
      };
    }
  }
}

// Singleton instance
let hyperliquidClient: HyperliquidClient | null = null;

export function initHyperliquidClient(): HyperliquidClient {
  if (!hyperliquidClient) {
    if (!process.env.HYPERLIQUID_PRIVATE_KEY) {
      throw new Error("HYPERLIQUID_PRIVATE_KEY environment variable is not set");
    }

    const config: HyperliquidConfig = {
      privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
      testnet: process.env.HYPERLIQUID_TESTNET === "true",
      walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
    };

    hyperliquidClient = new HyperliquidClient(config);
  }

  return hyperliquidClient;
}

export function getHyperliquidClient(): HyperliquidClient | null {
  return hyperliquidClient;
}
