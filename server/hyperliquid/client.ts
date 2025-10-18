import { Hyperliquid } from "hyperliquid";
import { ethers } from "ethers";

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
  liquidationPx: string | null;
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
  order_type: { limit: { tif: "Gtc" | "Ioc" | "Alo" } } | { market: {} } | { trigger: { triggerPx: string; isMarket: boolean; tpsl: "tp" | "sl" } };
  reduce_only?: boolean;
}

export interface TriggerOrderParams {
  coin: string;
  is_buy: boolean;
  sz: number;
  trigger_px: string;
  limit_px?: number; // Optional: if not provided, will use market order
  tpsl: "tp" | "sl";
}

export class HyperliquidClient {
  private sdk: Hyperliquid;
  private config: HyperliquidConfig;
  private isInitialized: boolean = false;

  constructor(config: HyperliquidConfig) {
    this.config = config;
    
    // Derive wallet address from private key if not provided
    if (!config.walletAddress) {
      const wallet = new ethers.Wallet(config.privateKey);
      this.config.walletAddress = wallet.address;
      console.log(`Hyperliquid wallet address derived: ${this.config.walletAddress}`);
    }
    
    this.sdk = new Hyperliquid({
      privateKey: config.privateKey,
      testnet: config.testnet || false,
      walletAddress: config.walletAddress,
      enableWs: false, // Disable WebSocket for now
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      try {
        // Initialize asset maps by fetching metadata
        // This forces the SDK to load available assets
        await this.sdk.info.perpetuals.getMeta();
        this.isInitialized = true;
        console.log("[Hyperliquid] Asset maps initialized via metadata fetch");
      } catch (error) {
        console.error("[Hyperliquid] Failed to initialize asset maps:", error);
        // Continue anyway - the SDK might initialize on first use
        this.isInitialized = true;
      }
    }
  }

  async getMarketData(): Promise<MarketData[]> {
    try {
      // Get all market mid prices
      const mids = await this.sdk.info.getAllMids();
      
      // Get meta and asset contexts for 24h stats via direct API call
      let metaAndCtxMap = new Map<string, any>();
      try {
        const apiUrl = this.config.testnet 
          ? "https://api.hyperliquid-testnet.xyz/info"
          : "https://api.hyperliquid.xyz/info";
          
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs" })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 1) {
            const meta = data[0];
            const ctxs = data[1];
            
            // Match metadata to contexts by index
            if (meta?.universe && Array.isArray(meta.universe) && Array.isArray(ctxs)) {
              meta.universe.forEach((assetMeta: any, index: number) => {
                if (assetMeta.name && ctxs[index]) {
                  // Map the coin name to its context data
                  metaAndCtxMap.set(assetMeta.name, ctxs[index]);
                }
              });
            }
          }
        }
      } catch (ctxError) {
        console.warn("[Hyperliquid] Failed to fetch asset contexts:", ctxError);
      }
      
      const marketData: MarketData[] = [];
      
      for (const [asset, price] of Object.entries(mids)) {
        // Strip -PERP or -SPOT suffix to match with metadata names
        const baseName = asset.replace(/-PERP$|-SPOT$/, '');
        
        // Get the context for this asset
        const ctx = metaAndCtxMap.get(baseName);
        
        // Calculate 24h change if we have previous price data
        let change24h = "0";
        if (ctx && ctx.prevDayPx) {
          const currentPrice = parseFloat(price as string);
          const prevPrice = parseFloat(ctx.prevDayPx);
          if (prevPrice > 0) {
            change24h = (((currentPrice - prevPrice) / prevPrice) * 100).toFixed(2);
          }
        }
        
        // Get 24h volume if available
        let volume24h = "0";
        if (ctx && ctx.dayNtlVlm) {
          volume24h = ctx.dayNtlVlm;
        }
        
        marketData.push({
          symbol: asset,
          price: price as string,
          change24h,
          volume24h,
        });
      }
      
      return marketData;
    } catch (error) {
      console.error("Failed to fetch Hyperliquid market data:", error);
      return [];
    }
  }

  async getAssetMetadata(symbol: string): Promise<{ szDecimals: number; tickSize: number; maxLeverage: number } | null> {
    try {
      await this.ensureInitialized();
      const perpMeta = await this.sdk.info.perpetuals.getMeta();
      
      const asset = perpMeta.universe.find((a: any) => a.name === symbol);
      if (!asset) {
        console.warn(`[Hyperliquid] Asset metadata not found for ${symbol}`);
        return null;
      }
      
      // szDecimals represents how many decimals the SIZE can have
      // tickSize is the minimum price increment (typically $0.1 or $1 for major assets)
      const szDecimals = asset.szDecimals || 0;
      const maxLeverage = asset.maxLeverage || 50; // Default to 50x if not specified
      
      // Infer tick size from the asset - major assets like BTC use $1, others use $0.1 or smaller
      // This is a heuristic - ideally we'd get this from metadata, but it's not always available
      let tickSize = 0.1; // Default
      if (symbol === 'BTC-PERP') tickSize = 1;
      else if (symbol === 'ETH-PERP') tickSize = 0.1;
      else if (symbol === 'SOL-PERP') tickSize = 0.01;
      
      return { szDecimals, tickSize, maxLeverage };
    } catch (error) {
      console.error(`[Hyperliquid] Failed to fetch metadata for ${symbol}:`, error);
      return null;
    }
  }

  async getMarkets(): Promise<any> {
    try {
      // Fetch perpetual markets
      const perpMeta = await this.sdk.info.perpetuals.getMeta();
      
      // Fetch spot markets
      const spotMeta = await this.sdk.info.spot.getSpotMeta();
      
      // Format perpetual markets
      const perpMarkets = perpMeta.universe.map((asset: any, index: number) => ({
        symbol: asset.name,
        displayName: asset.name,
        type: 'perp' as const,
        szDecimals: asset.szDecimals,
        maxLeverage: asset.maxLeverage,
        index,
      }));
      
      // Format spot markets
      const spotMarkets = spotMeta.universe
        .filter((pair: any) => pair.name) // Only include pairs with names
        .map((pair: any) => ({
          symbol: `${pair.name.replace('/', '-')}-SPOT`,
          displayName: pair.name,
          type: 'spot' as const,
          index: pair.index,
          tokens: pair.tokens,
        }));
      
      // Combine and sort by display name
      const allMarkets = [...perpMarkets, ...spotMarkets].sort((a, b) => 
        a.displayName.localeCompare(b.displayName)
      );
      
      return allMarkets;
    } catch (error) {
      console.error("Failed to fetch Hyperliquid markets:", error);
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
        liquidationPx: pos.position.liquidationPx || null,
        leverage: pos.position.leverage,
      }));
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      return [];
    }
  }

  async getOpenOrders(address?: string): Promise<any[]> {
    try {
      const userAddress = address || this.config.walletAddress;
      if (!userAddress) {
        console.error("[Hyperliquid] No wallet address provided for getOpenOrders");
        return [];
      }

      console.log(`[Hyperliquid] Fetching open orders for ${userAddress}`);

      // Use the direct API endpoint to get open orders
      const apiUrl = this.config.testnet 
        ? "https://api.hyperliquid-testnet.xyz/info"
        : "https://api.hyperliquid.xyz/info";
        
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "openOrders",
          user: userAddress
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Hyperliquid] Failed to fetch open orders: ${response.status} - ${errorText}`);
        return [];
      }
      
      const rawOrders = await response.json();
      console.log(`[Hyperliquid] Raw open orders response:`, JSON.stringify(rawOrders).substring(0, 200));
      
      if (!Array.isArray(rawOrders)) {
        console.error(`[Hyperliquid] Expected array, got:`, typeof rawOrders);
        return [];
      }
      
      // Hyperliquid API returns direct order objects (not wrapped)
      // NOTE: The openOrders endpoint does NOT include trigger metadata (tpsl, isTrigger, triggerPx)
      // Trigger orders (stop loss/take profit) appear as regular limit orders with reduceOnly: true
      // This means we CANNOT distinguish between stop loss and take profit from the API response
      const normalizedOrders = rawOrders.map((order: any) => ({
        ...order,
        // Add -PERP suffix if not present for consistency with position matching
        coin: order.coin.includes('-') ? order.coin : `${order.coin}-PERP`,
      }));
      
      console.log(`[Hyperliquid] Fetched and normalized ${normalizedOrders.length} open orders`);
      return normalizedOrders;
    } catch (error) {
      console.error("[Hyperliquid] Failed to fetch open orders:", error);
      return [];
    }
  }

  async placeOrder(params: OrderParams): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      // Ensure asset maps are initialized before trading
      await this.ensureInitialized();
      
      const response = await this.sdk.exchange.placeOrder(params as any);
      
      // Check if the order was accepted by the exchange
      // Hyperliquid returns a response with statuses array
      const status = response?.response?.data?.statuses?.[0];
      
      if (status && 'error' in status) {
        // Order was rejected by the exchange
        const errorMsg = status.error || "Order rejected by exchange";
        console.error("Order rejected by Hyperliquid:", errorMsg);
        return {
          success: false,
          error: errorMsg,
          response,
        };
      }
      
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

  async placeTriggerOrder(params: TriggerOrderParams): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      // Ensure asset maps are initialized before trading
      await this.ensureInitialized();
      
      // Build trigger order params
      const isMarket = !params.limit_px;
      const orderParams: OrderParams = {
        coin: params.coin,
        is_buy: params.is_buy,
        sz: params.sz,
        limit_px: params.limit_px || parseFloat(params.trigger_px), // Use trigger price as limit if not specified
        order_type: {
          trigger: {
            triggerPx: params.trigger_px,
            isMarket,
            tpsl: params.tpsl,
          },
        },
        reduce_only: true, // Trigger orders always reduce positions
      };
      
      const response = await this.sdk.exchange.placeOrder(orderParams as any);
      
      return {
        success: true,
        response,
      };
    } catch (error: any) {
      console.error("Failed to place trigger order:", error);
      return {
        success: false,
        error: error.message || "Failed to place trigger order",
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
      const orderbook = await (this.sdk.info.perpetuals as any).getL2Snapshot(coin);
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
        params.is_cross ? 1 : 0
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

// Singleton instance (for backward compatibility, e.g., monitoring service)
let hyperliquidClient: HyperliquidClient | null = null;

// Cache for user-specific Hyperliquid clients to avoid recreating instances
const userClientCache = new Map<string, HyperliquidClient>();

export function initHyperliquidClient(): HyperliquidClient {
  if (!hyperliquidClient) {
    if (!process.env.HYPERLIQUID_PRIVATE_KEY) {
      throw new Error("HYPERLIQUID_PRIVATE_KEY environment variable is not set");
    }

    const config: HyperliquidConfig = {
      privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
      testnet: process.env.HYPERLIQUID_TESTNET === "true",
      // Monitor specific wallet address
      walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS || "0x60e5f5ec558a1e7E5399765f58a0a245bab0142e",
    };

    hyperliquidClient = new HyperliquidClient(config);
  }

  return hyperliquidClient;
}

export function getHyperliquidClient(): HyperliquidClient | null {
  return hyperliquidClient;
}

/**
 * Get a Hyperliquid client instance for a specific user
 * Uses the user's stored and encrypted credentials
 * Caches instances to avoid excessive API calls from SDK initialization
 */
export async function getUserHyperliquidClient(userId: string): Promise<HyperliquidClient> {
  // Check cache first
  if (userClientCache.has(userId)) {
    return userClientCache.get(userId)!;
  }

  const { getUserHyperliquidCredentials } = await import("../credentialService");
  
  const credentials = await getUserHyperliquidCredentials(userId);
  
  if (!credentials) {
    throw new Error(`No Hyperliquid credentials found for user ${userId}`);
  }

  const config: HyperliquidConfig = {
    privateKey: credentials.privateKey,
    testnet: process.env.HYPERLIQUID_TESTNET === "true",
    walletAddress: credentials.mainWalletAddress, // Use main wallet address for queries
  };

  const client = new HyperliquidClient(config);
  
  // Cache the client for future use
  userClientCache.set(userId, client);
  console.log(`[Hyperliquid] Created and cached client for user ${userId}`);

  return client;
}

/**
 * Clear cached client for a specific user (useful when credentials change)
 */
export function clearUserClientCache(userId: string): void {
  userClientCache.delete(userId);
  console.log(`[Hyperliquid] Cleared cached client for user ${userId}`);
}

/**
 * Clear all cached clients
 */
export function clearAllClientCaches(): void {
  userClientCache.clear();
  console.log(`[Hyperliquid] Cleared all cached clients`);
}
