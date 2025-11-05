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
      console.log(`[Hyperliquid] Wallet address derived: ${this.config.walletAddress}`);
    }
    
    console.log(`[Hyperliquid] Initializing SDK with config:`, {
      testnet: config.testnet || false,
      walletAddress: this.config.walletAddress,
      enableWs: false,
    });
    
    this.sdk = new Hyperliquid({
      privateKey: config.privateKey,
      testnet: config.testnet || false,
      walletAddress: this.config.walletAddress,
      enableWs: false, // Disable WebSocket for now
    });
    
    // Log SDK initialization status
    console.log(`[Hyperliquid] SDK initialized, checking structure...`);
    console.log(`[Hyperliquid] SDK type:`, typeof this.sdk);
    console.log(`[Hyperliquid] SDK has exchange:`, !!this.sdk.exchange);
    console.log(`[Hyperliquid] SDK exchange type:`, typeof this.sdk.exchange);
    if (this.sdk.exchange) {
      console.log(`[Hyperliquid] Exchange has placeOrder:`, typeof this.sdk.exchange.placeOrder === 'function');
    }
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      try {
        // Defensive check - ensure SDK and info are available
        if (!this.sdk || !this.sdk.info) {
          console.error("[Hyperliquid] SDK not properly initialized in ensureInitialized");
          this.isInitialized = true; // Mark as initialized to prevent retries
          return;
        }
        
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
  
  private verifyExchangeAPI(methodName?: string): { valid: boolean; error?: string } {
    if (!this.sdk) {
      console.error("[Hyperliquid] SDK not initialized");
      return {
        valid: false,
        error: "Hyperliquid SDK not initialized",
      };
    }
    
    if (!this.sdk.exchange) {
      console.error("[Hyperliquid] Exchange API not available on SDK");
      console.error("[Hyperliquid] SDK keys:", Object.keys(this.sdk));
      return {
        valid: false,
        error: "Hyperliquid Exchange API not available",
      };
    }
    
    // If a specific method is requested, verify it exists
    if (methodName) {
      const method = (this.sdk.exchange as any)[methodName];
      if (typeof method !== 'function') {
        console.error(`[Hyperliquid] ${methodName} is not a function`);
        console.error("[Hyperliquid] exchange type:", typeof this.sdk.exchange);
        console.error("[Hyperliquid] exchange keys:", Object.keys(this.sdk.exchange));
        return {
          valid: false,
          error: `${methodName} method not available on Exchange API`,
        };
      }
    } else {
      // Default behavior - check for placeOrder (most common method)
      if (typeof this.sdk.exchange.placeOrder !== 'function') {
        console.error("[Hyperliquid] placeOrder is not a function");
        console.error("[Hyperliquid] exchange type:", typeof this.sdk.exchange);
        console.error("[Hyperliquid] exchange keys:", Object.keys(this.sdk.exchange));
        return {
          valid: false,
          error: "placeOrder method not available on Exchange API",
        };
      }
    }
    
    return { valid: true };
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
      
      // Normalize symbol format: "BTC-USD" or "BTC" -> "BTC-PERP"
      let normalizedSymbol = symbol;
      if (!symbol.endsWith('-PERP')) {
        const baseSymbol = symbol.replace(/-USD$|-SPOT$|-PERP$/, '');
        normalizedSymbol = `${baseSymbol}-PERP`;
      }
      
      const asset = perpMeta.universe.find((a: any) => a.name === normalizedSymbol);
      if (!asset) {
        console.warn(`[Hyperliquid] Asset metadata not found for ${symbol} (normalized to ${normalizedSymbol})`);
        return null;
      }
      
      // szDecimals represents how many decimals the SIZE can have
      // tickSize is the minimum price increment (typically $0.1 or $1 for major assets)
      const szDecimals = asset.szDecimals || 0;
      const maxLeverage = asset.maxLeverage || 50; // Default to 50x if not specified
      
      // Infer tick size from the asset - major assets like BTC use $1, others use $0.1 or smaller
      // This is a heuristic - ideally we'd get this from metadata, but it's not always available
      let tickSize = 0.1; // Default
      if (normalizedSymbol === 'BTC-PERP') tickSize = 1;
      else if (normalizedSymbol === 'ETH-PERP') tickSize = 0.1;
      else if (normalizedSymbol === 'SOL-PERP') tickSize = 0.01;
      
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

  async getCandleSnapshot(params: {
    coin: string;
    interval: string;
    startTime: number;
    endTime: number;
  }): Promise<any[]> {
    try {
      const apiUrl = this.config.testnet 
        ? "https://api.hyperliquid-testnet.xyz/info"
        : "https://api.hyperliquid.xyz/info";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "candleSnapshot",
          req: {
            coin: params.coin,
            interval: params.interval,
            startTime: params.startTime,
            endTime: params.endTime,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch candle snapshot: ${response.statusText}`);
      }

      const candles = await response.json();
      return candles || [];
    } catch (error) {
      console.error(`[Hyperliquid] Failed to fetch candle snapshot for ${params.coin}:`, error);
      return [];
    }
  }

  async getUserState(address?: string): Promise<any> {
    const userAddress = address || this.config.walletAddress;
    if (!userAddress) {
      throw new Error("No wallet address provided");
    }
    
    console.log(`[Hyperliquid] Fetching user state for address: ${userAddress}`);
    
    try {
      const state = await this.sdk.info.perpetuals.getClearinghouseState(userAddress);
      console.log(`[Hyperliquid] Successfully fetched user state for ${userAddress}`);
      return state;
    } catch (error) {
      console.error(`[Hyperliquid] Failed to fetch user state for ${userAddress}:`, error);
      throw error; // Throw instead of returning null so we can see the error
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
        returnOnEquity: pos.position.returnOnEquity || "0", // ROE as decimal (e.g., 0.0195 for 1.95%)
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
      // CRITICAL: Initialize SDK BEFORE verification (exchange may not be ready until first async call)
      await this.ensureInitialized();
      
      // Now verify SDK structure
      const verification = this.verifyExchangeAPI();
      if (!verification.valid) {
        return {
          success: false,
          error: verification.error,
        };
      }
      
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

  async placeBracketOrder(params: {
    entry: OrderParams;
    takeProfit?: { triggerPx: string; limitPx?: string };
    stopLoss?: { triggerPx: string; limitPx?: string };
  }): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      // CRITICAL: Initialize SDK BEFORE verification (exchange may not be ready until first async call)
      await this.ensureInitialized();
      
      // Now verify SDK structure
      const verification = this.verifyExchangeAPI();
      if (!verification.valid) {
        console.error("[Hyperliquid] Bracket order failed verification:", verification.error);
        return {
          success: false,
          error: verification.error,
        };
      }
      
      const orders: any[] = [params.entry];
      
      // Add take profit order if provided
      if (params.takeProfit) {
        const tpOrder: OrderParams = {
          coin: params.entry.coin,
          is_buy: !params.entry.is_buy, // Opposite side to close position
          sz: params.entry.sz, // Same size as entry
          limit_px: params.takeProfit.limitPx ? parseFloat(params.takeProfit.limitPx) : parseFloat(params.takeProfit.triggerPx),
          order_type: {
            trigger: {
              triggerPx: params.takeProfit.triggerPx,
              isMarket: !params.takeProfit.limitPx,
              tpsl: "tp",
            },
          },
          reduce_only: true,
        };
        orders.push(tpOrder);
      }
      
      // Add stop loss order if provided
      if (params.stopLoss) {
        const slOrder: OrderParams = {
          coin: params.entry.coin,
          is_buy: !params.entry.is_buy, // Opposite side to close position
          sz: params.entry.sz, // Same size as entry
          limit_px: params.stopLoss.limitPx ? parseFloat(params.stopLoss.limitPx) : parseFloat(params.stopLoss.triggerPx),
          order_type: {
            trigger: {
              triggerPx: params.stopLoss.triggerPx,
              isMarket: !params.stopLoss.limitPx,
              tpsl: "sl",
            },
          },
          reduce_only: true,
        };
        orders.push(slOrder);
      }
      
      // Place all orders as a bracket group
      const response = await this.sdk.exchange.placeOrder({
        orders,
        grouping: "normalTpsl",
      } as any);
      
      console.log(`[Hyperliquid] Placed bracket order with ${orders.length} orders (entry + ${params.takeProfit ? 'TP' : ''} ${params.stopLoss ? 'SL' : ''})`);
      
      // Check if any order was rejected
      const statuses = response?.response?.data?.statuses;
      if (Array.isArray(statuses)) {
        const errors = statuses.filter((s: any) => typeof s === 'object' && s !== null && 'error' in s);
        if (errors.length > 0) {
          const errorMsg = errors.map((e: any) => e.error).join(', ');
          console.error("One or more bracket orders rejected:", errorMsg);
          return {
            success: false,
            error: errorMsg,
            response,
          };
        }
      }
      
      return {
        success: true,
        response,
      };
    } catch (error: any) {
      console.error("Failed to place bracket order:", error);
      return {
        success: false,
        error: error.message || "Failed to place bracket order",
      };
    }
  }

  async placeTriggerOrder(params: TriggerOrderParams): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      // CRITICAL: Initialize SDK BEFORE verification (exchange may not be ready until first async call)
      await this.ensureInitialized();
      
      // Now verify SDK structure
      const verification = this.verifyExchangeAPI();
      if (!verification.valid) {
        console.error("[Hyperliquid] Trigger order failed verification:", verification.error);
        return {
          success: false,
          error: verification.error,
        };
      }
      
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
      // CRITICAL: Verify SDK structure BEFORE any operations
      const verification = this.verifyExchangeAPI("cancelOrder");
      if (!verification.valid) {
        console.error("[Hyperliquid] Cancel order failed verification:", verification.error);
        return {
          success: false,
          error: verification.error,
        };
      }
      
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
      // CRITICAL: Verify SDK structure BEFORE any operations
      const verification = this.verifyExchangeAPI("updateLeverage");
      if (!verification.valid) {
        console.error("[Hyperliquid] Update leverage failed verification:", verification.error);
        return {
          success: false,
          error: verification.error,
        };
      }
      
      // SDK signature: updateLeverage(symbol, leverageMode, leverage)
      // leverageMode: "cross" for cross margin, anything else for isolated
      await this.sdk.exchange.updateLeverage(
        params.coin,                      // symbol: full symbol WITH suffix (e.g., "BTC-PERP")
        params.is_cross ? "cross" : "isolated",  // leverageMode: "cross" or "isolated"
        params.leverage                   // leverage: numeric value
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

export async function initHyperliquidClient(): Promise<HyperliquidClient> {
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
    
    // CRITICAL: Force SDK initialization to ensure exchange API is ready
    await hyperliquidClient.ensureInitialized();
    console.log(`[Hyperliquid] Singleton SDK initialization completed`);
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
  
  // CRITICAL: Force SDK initialization before caching to ensure exchange API is ready
  // This prevents "placeOrder method not available" errors in production
  await client.ensureInitialized();
  console.log(`[Hyperliquid] SDK initialization completed for user ${userId}`);
  
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
