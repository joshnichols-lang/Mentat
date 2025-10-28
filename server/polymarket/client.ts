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
   * Get order book for a specific token
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
