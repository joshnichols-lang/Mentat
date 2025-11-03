import { ClobClient, ApiKeyCreds, OrderType, Side } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";

export interface PolymarketConfig {
  privateKey: string;
  funderAddress?: string; // Optional: only needed for proxy wallets
  signatureType?: number; // 0 = Browser Wallet, 1 = Magic/Email, 2 = Hardware Wallet
}

export interface PolymarketMarket {
  conditionId: string;
  questionId: string;
  tokens: {
    tokenId: string;
    outcome: string;
    price: string;
    winner: boolean;
  }[];
  question: string;
  description: string;
  category: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  startDate: string;
  endDate: string;
  volume: string;
  liquidity: string;
}

export interface PolymarketOrderParams {
  tokenId: string;
  price: number;
  side: "BUY" | "SELL";
  size: number;
  tickSize: string;
  negRisk: boolean;
}

export interface PolymarketPosition {
  asset_id: string;
  market_id: string;
  size: string;
  side: string;
  average_price: string;
  current_price: string;
  unrealized_pnl: string;
}

export interface PolymarketOrder {
  id: string;
  market: string;
  asset_id: string;
  type: string;
  side: string;
  price: string;
  size: string;
  size_matched: string;
  created_at: string;
  status: string;
}

export class PolymarketClient {
  private clobClient: ClobClient | null = null;
  private config: PolymarketConfig;
  private signer: Wallet;
  private host: string = "https://clob.polymarket.com";
  private chainId: number = 137; // Polygon mainnet
  private isInitialized: boolean = false;

  constructor(config: PolymarketConfig) {
    this.config = config;
    this.signer = new Wallet(config.privateKey);
    
    console.log(`[Polymarket] Initializing client with wallet: ${this.signer.address}`);
  }

  /**
   * Initialize the CLOB client with API credentials
   */
  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      try {
        console.log("[Polymarket] Creating or deriving API credentials...");
        
        // Create temporary client to derive API credentials
        const tempClient = new ClobClient(this.host, this.chainId, this.signer);
        const creds: ApiKeyCreds = await tempClient.createOrDeriveApiKey();
        
        console.log("[Polymarket] API credentials obtained");
        
        // Initialize main client with credentials
        const signatureType = this.config.signatureType ?? 1; // Default to Magic/Email
        
        this.clobClient = new ClobClient(
          this.host,
          this.chainId,
          this.signer,
          creds,
          signatureType,
          this.config.funderAddress
        );
        
        this.isInitialized = true;
        console.log("[Polymarket] Client initialized successfully");
      } catch (error) {
        console.error("[Polymarket] Failed to initialize client:", error);
        throw new Error(`Polymarket client initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Get market data from Gamma Events API
   * Uses /events endpoint which correctly returns only active markets
   * Note: The /markets endpoint's active=true parameter is broken and returns old 2020 markets
   */
  public async getMarkets(params?: {
    limit?: number;
    offset?: number;
    active?: boolean;
    closed?: boolean;
    archived?: boolean;
  }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());
      
      // Handle closed parameter: respect explicit closed value, otherwise default to closed=false for active markets
      // Use closed=false instead of active=true (active parameter doesn't work on /markets endpoint)
      if (params?.closed !== undefined) {
        // Explicit closed parameter takes priority
        queryParams.append("closed", params.closed.toString());
      } else if (params?.active === false) {
        // active=false means get closed markets
        queryParams.append("closed", "true");
      } else {
        // Default to active markets (closed=false)
        queryParams.append("closed", "false");
      }
      
      if (params?.archived !== undefined) queryParams.append("archived", params.archived.toString());
      
      // Use /events endpoint instead of /markets
      const url = `https://gamma-api.polymarket.com/events?${queryParams.toString()}`;
      console.log(`[Polymarket] Fetching events from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Events API returned ${response.status}: ${response.statusText}`);
      }
      
      const events = await response.json();
      
      // Events contain nested markets - flatten them into a single array
      const markets: any[] = [];
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          // Add event context to each market for better display
          for (const market of event.markets) {
            // Parse outcomePrices from stringified JSON array to actual array
            let outcomePrices = market.outcomePrices;
            if (typeof outcomePrices === 'string') {
              try {
                outcomePrices = JSON.parse(outcomePrices);
              } catch (e) {
                console.warn(`[Polymarket] Failed to parse outcomePrices for market ${market.conditionId}:`, e);
                outcomePrices = ["0", "0"]; // Default to 0% if parsing fails
              }
            }
            
            // Parse clobTokenIds if it's stringified
            let clobTokenIds = market.clobTokenIds;
            if (typeof clobTokenIds === 'string') {
              try {
                clobTokenIds = JSON.parse(clobTokenIds);
              } catch (e) {
                console.warn(`[Polymarket] Failed to parse clobTokenIds for market ${market.conditionId}:`, e);
              }
            }
            
            markets.push({
              ...market,
              outcomePrices,
              clobTokenIds,
              eventSlug: event.slug,
              eventTitle: event.title,
              eventDescription: event.description,
              eventIcon: event.icon,
              eventTags: event.tags || [], // Preserve event-level tags
            });
          }
        }
      }
      
      console.log(`[Polymarket] Transformed ${events.length} events into ${markets.length} markets`);
      return markets;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch markets:", error);
      throw error;
    }
  }

  /**
   * Get LIVE trading markets (short-term rolling price predictions)
   * These are separate from regular event markets and use a different API endpoint
   */
  public async getLiveMarkets(params?: {
    symbols?: string[]; // e.g., ['BTC', 'ETH', 'SOL']
  }): Promise<any[]> {
    try {
      // Fetch from the live-markets endpoint
      const url = 'https://gamma-api.polymarket.com/live-markets';
      console.log(`[Polymarket] Fetching LIVE markets from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Live markets API returned ${response.status}: ${response.statusText}`);
      }
      
      const liveData = await response.json();
      
      // Transform live markets to match our standard market structure
      const markets: any[] = [];
      
      // Live markets are organized differently - they have a "series" structure
      if (Array.isArray(liveData)) {
        for (const series of liveData) {
          // Each series represents a trading window (e.g., BTC 15m, BTC 1h, ETH 15m)
          if (series.markets && Array.isArray(series.markets)) {
            for (const market of series.markets) {
              // Add synthetic tags for filtering
              const underlying = series.underlying || series.symbol || 'Unknown';
              const interval = series.intervalMinutes || series.interval || '?';
              
              markets.push({
                ...market,
                // Normalize structure to match regular markets
                question: market.question || `${underlying} Up or Down - ${interval} minute${interval !== 1 ? 's' : ''}`,
                eventSlug: series.slug || `live-${underlying.toLowerCase()}-${interval}m`,
                eventTitle: `LIVE: ${underlying} ${interval}m`,
                eventDescription: market.description || `Short-term price prediction for ${underlying}`,
                eventIcon: '📊',
                // Add synthetic tags for easy filtering
                eventTags: [
                  { label: 'Live' },
                  { label: underlying.toUpperCase() },
                  { label: `${interval}m` },
                  { label: 'Crypto' }
                ],
                // Mark as live market
                marketType: 'live_trading',
                resolutionStyle: 'rolling',
                underlying: underlying,
                intervalMinutes: interval,
                windowCloseTime: market.windowCloseTime || market.endDate,
              });
            }
          }
        }
      }
      
      console.log(`[Polymarket] Transformed live data into ${markets.length} LIVE markets`);
      return markets;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch LIVE markets:", error);
      // Don't throw - return empty array to allow regular markets to still work
      return [];
    }
  }

  /**
   * Get detailed market information by condition ID
   */
  public async getMarket(conditionId: string): Promise<any> {
    try {
      const url = `https://gamma-api.polymarket.com/markets/${conditionId}`;
      console.log(`[Polymarket] Fetching market: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Market API returned ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch market ${conditionId}:`, error);
      throw error;
    }
  }

  /**
   * Get order book for a specific token (requires authentication)
   */
  public async getOrderBook(tokenId: string): Promise<any> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      console.log(`[Polymarket] Fetching order book for token: ${tokenId}`);
      const orderBook = await this.clobClient.getOrderBook(tokenId);
      return orderBook;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch order book for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get order book for a specific token (public, no authentication required)
   * This is a static method that fetches orderbook data from the public API
   */
  public static async getPublicOrderBook(tokenId: string): Promise<any> {
    try {
      const url = `https://clob.polymarket.com/book?token_id=${tokenId}`;
      console.log(`[Polymarket] Fetching public order book from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OrderBook API returned ${response.status}: ${response.statusText}`);
      }
      
      const orderBook = await response.json();
      return orderBook;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch public order book for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get current price for a token
   */
  public async getPrice(tokenId: string, side: "BUY" | "SELL"): Promise<number> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      const clobSide = side === "BUY" ? Side.BUY : Side.SELL;
      const price = await this.clobClient.getPrice(tokenId, clobSide);
      return price;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch price for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get midpoint price for a token
   */
  public async getMidpoint(tokenId: string): Promise<number> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      const midpoint = await this.clobClient.getMidpoint(tokenId);
      return midpoint;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch midpoint for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Place a limit order (GTC - Good Till Cancelled)
   */
  public async placeLimitOrder(params: PolymarketOrderParams): Promise<any> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      console.log(`[Polymarket] Placing limit order:`, params);
      
      const clobSide = params.side === "BUY" ? Side.BUY : Side.SELL;
      
      const order = await this.clobClient.createAndPostOrder(
        {
          tokenID: params.tokenId,
          price: params.price,
          side: clobSide,
          size: params.size,
        },
        {
          tickSize: params.tickSize as any, // Type assertion for tickSize string
          negRisk: params.negRisk,
        },
        OrderType.GTC
      );
      
      console.log(`[Polymarket] Order placed successfully:`, order);
      return order;
    } catch (error) {
      console.error(`[Polymarket] Failed to place limit order:`, error);
      throw error;
    }
  }

  /**
   * Place a market order using extreme prices
   * Market orders use extreme prices with GTC to ensure immediate execution
   */
  public async placeMarketOrder(params: Omit<PolymarketOrderParams, "price">): Promise<any> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      // For market orders, use extreme prices to ensure fill
      // BUY: high price (0.99), SELL: low price (0.01)
      const marketPrice = params.side === "BUY" ? 0.99 : 0.01;
      
      console.log(`[Polymarket] Placing market order (${params.side}) at price ${marketPrice}`);
      
      const clobSide = params.side === "BUY" ? Side.BUY : Side.SELL;
      
      const order = await this.clobClient.createAndPostOrder(
        {
          tokenID: params.tokenId,
          price: marketPrice,
          side: clobSide,
          size: params.size,
        },
        {
          tickSize: params.tickSize as any, // Type assertion for tickSize string
          negRisk: params.negRisk,
        },
        OrderType.GTC // Use GTC with extreme price for market-like behavior
      );
      
      console.log(`[Polymarket] Market order placed successfully:`, order);
      return order;
    } catch (error) {
      console.error(`[Polymarket] Failed to place market order:`, error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  public async getOrder(orderId: string): Promise<any> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      const order = await this.clobClient.getOrder(orderId);
      return order;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get all orders
   * Note: Use getOrder() for fetching individual orders by ID
   */
  public async getOrders(): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      // Fetch trades/fills as a proxy for order history
      // The CLOB client may not have a direct getOrders method
      console.log("[Polymarket] Fetching order history via trades");
      const trades = await this.clobClient.getTrades();
      return trades;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch orders:`, error);
      throw error;
    }
  }

  /**
   * Get open positions for the current user
   * Calculates positions by aggregating filled trades
   */
  public async getPositions(): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      console.log("[Polymarket] Fetching positions via trade history");
      
      // Fetch all trades to calculate positions
      const trades = await this.clobClient.getTrades({} as any, false);
      
      // Sort trades by timestamp to process chronologically
      const sortedTrades = [...trades].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
        const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
        return timeA - timeB;
      });
      
      // Process trades chronologically to maintain accurate cost basis
      const positionMap = new Map<string, {
        asset_id: string;
        market_id: string;
        netSize: number;
        costBasis: number;
        marketQuestion?: string;
      }>();
      
      for (const trade of sortedTrades) {
        const assetId = trade.asset_id || trade.tokenId;
        const size = parseFloat(trade.size || trade.amount || '0');
        const price = parseFloat(trade.price || '0');
        const side = trade.side;
        
        if (!assetId) continue;
        
        const existing = positionMap.get(assetId) || {
          asset_id: assetId,
          market_id: trade.market || assetId,
          netSize: 0,
          costBasis: 0,
          marketQuestion: trade.market || undefined,
        };
        
        const prevSize = existing.netSize;
        const tradeValue = size * price;
        
        if (side === 'BUY') {
          // Adding to position (long or reducing short)
          if (prevSize >= 0) {
            // Adding to long or starting long from flat
            existing.costBasis += tradeValue;
          } else {
            // Reducing short position
            if (prevSize + size <= 0) {
              // Still short after this buy, reduce cost basis proportionally
              const reduction = (size / Math.abs(prevSize)) * existing.costBasis;
              existing.costBasis -= reduction;
            } else {
              // Crossing from short to long, reset cost basis
              const longSize = prevSize + size;
              existing.costBasis = longSize * price;
            }
          }
          existing.netSize += size;
        } else if (side === 'SELL') {
          // Reducing position (short or reducing long)
          if (prevSize <= 0) {
            // Adding to short or starting short from flat
            existing.costBasis += tradeValue;
          } else {
            // Reducing long position
            if (prevSize - size >= 0) {
              // Still long after this sell, reduce cost basis proportionally
              const reduction = (size / prevSize) * existing.costBasis;
              existing.costBasis -= reduction;
            } else {
              // Crossing from long to short, reset cost basis
              const shortSize = Math.abs(prevSize - size);
              existing.costBasis = shortSize * price;
            }
          }
          existing.netSize -= size;
        }
        
        positionMap.set(assetId, existing);
      }
      
      // Filter out closed positions and format
      const positions: any[] = [];
      for (const [assetId, pos] of positionMap.entries()) {
        if (Math.abs(pos.netSize) > 0.001) { // Only include non-zero positions
          const averageEntryPrice = Math.abs(pos.netSize) > 0 
            ? (pos.costBasis / Math.abs(pos.netSize)) 
            : 0;
          
          positions.push({
            asset_id: assetId,
            market_id: pos.market_id,
            marketQuestion: pos.marketQuestion || assetId,
            size: Math.abs(pos.netSize).toString(),
            side: pos.netSize > 0 ? 'BUY' : 'SELL',
            averagePrice: averageEntryPrice.toFixed(4),
            price: averageEntryPrice.toFixed(4), // Current price (use entry for now)
            entryPrice: averageEntryPrice.toFixed(4),
            unrealizedPnl: '0', // Would need current market price to calculate accurately
          });
        }
      }
      
      console.log(`[Polymarket] Found ${positions.length} open positions`);
      return positions;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch positions:`, error);
      return [];
    }
  }

  /**
   * Cancel a single order
   */
  public async cancelOrder(orderId: string): Promise<any> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      console.log(`[Polymarket] Canceling order: ${orderId}`);
      const result = await this.clobClient.cancelOrder({ orderID: orderId });
      console.log(`[Polymarket] Order canceled successfully`);
      return result;
    } catch (error) {
      console.error(`[Polymarket] Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel multiple orders
   */
  public async cancelOrders(orderIds: string[]): Promise<any> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      console.log(`[Polymarket] Canceling ${orderIds.length} orders`);
      const result = await this.clobClient.cancelOrders(orderIds);
      console.log(`[Polymarket] Orders canceled successfully`);
      return result;
    } catch (error) {
      console.error(`[Polymarket] Failed to cancel orders:`, error);
      throw error;
    }
  }

  /**
   * Cancel all orders
   */
  public async cancelAll(): Promise<any> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      console.log(`[Polymarket] Canceling all orders`);
      const result = await this.clobClient.cancelAll();
      console.log(`[Polymarket] All orders canceled successfully`);
      return result;
    } catch (error) {
      console.error(`[Polymarket] Failed to cancel all orders:`, error);
      throw error;
    }
  }

  /**
   * Get trade history
   */
  public async getTrades(): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      const trades = await this.clobClient.getTrades();
      return trades;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch trades:`, error);
      throw error;
    }
  }

  /**
   * Get last traded price for a token
   */
  public async getLastTradePrice(tokenId: string): Promise<number> {
    await this.ensureInitialized();
    
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }
      
      const price = await this.clobClient.getLastTradePrice(tokenId);
      return price;
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch last trade price for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get wallet address
   */
  public getWalletAddress(): string {
    return this.signer.address;
  }

  /**
   * Test connection to Polymarket API
   */
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureInitialized();
      
      // Try fetching markets as a connection test
      const markets = await this.getMarkets({ limit: 1 });
      
      return {
        success: true,
        message: `Connected to Polymarket successfully. Wallet: ${this.getWalletAddress()}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Polymarket: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Get Polymarket client instance for a user
 * Uses the user's Polygon wallet private key from embedded wallets
 */
export async function getPolymarketClient(userId: string, storage?: any): Promise<PolymarketClient> {
  if (!storage) {
    const { storage: defaultStorage } = await import('../storage');
    storage = defaultStorage;
  }
  
  const embeddedWallet = await storage.getEmbeddedWallet(userId);
  
  if (!embeddedWallet || !embeddedWallet.polygonPrivateKey) {
    throw new Error('No Polygon wallet found for user. Please create embedded wallets first.');
  }
  
  // Decrypt the Polygon private key
  const { decryptCredential } = await import('../encryption');
  const privateKey = decryptCredential(
    embeddedWallet.polygonPrivateKey,
    embeddedWallet.polygonPrivateKeyIv,
    embeddedWallet.encryptedDek,
    embeddedWallet.dekIv
  );
  
  const client = new PolymarketClient({
    privateKey,
    signatureType: 1, // Magic/Email signature type
  });
  
  await client.ensureInitialized();
  
  return client;
}
