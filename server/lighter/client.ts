import axios, { AxiosInstance } from "axios";
import { LighterSigner } from "./signer";
import type {
  LighterConfig,
  Market,
  OrderBook,
  AccountInfo,
  CreateOrderParams,
  MarketData,
  Position,
  Order
} from "./types";

export class LighterClient {
  private api: AxiosInstance;
  private signer: LighterSigner;
  private config: LighterConfig;
  private authToken: string | null = null;
  private authTokenExpiry: number = 0;

  constructor(config: LighterConfig) {
    this.config = config;
    this.signer = new LighterSigner(config.apiKeyPrivateKey);
    
    this.api = axios.create({
      baseURL: config.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use(async (config) => {
      await this.ensureAuthToken();
      if (this.authToken) {
        config.headers.Authorization = this.authToken;
      }
      return config;
    });
  }

  private async ensureAuthToken(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    
    // Refresh token if expired or about to expire (within 1 minute)
    if (!this.authToken || this.authTokenExpiry - now < 60) {
      this.authToken = await this.signer.createAuthToken(10);
      this.authTokenExpiry = now + (10 * 60);
    }
  }

  async getMarkets(): Promise<Market[]> {
    try {
      const response = await this.api.get("/api/v1/markets");
      return response.data.markets || [];
    } catch (error) {
      console.error("Failed to fetch markets:", error);
      return [];
    }
  }

  async getOrderBook(marketIndex: number): Promise<OrderBook> {
    try {
      const response = await this.api.get(`/api/v1/orderbook`, {
        params: { market_index: marketIndex }
      });
      return {
        bids: response.data.bids || [],
        asks: response.data.asks || []
      };
    } catch (error) {
      console.error("Failed to fetch orderbook:", error);
      return { bids: [], asks: [] };
    }
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    try {
      const response = await this.api.get("/api/v1/account", {
        params: { account_index: this.config.accountIndex }
      });
      return response.data;
    } catch (error) {
      console.error("Failed to fetch account info:", error);
      return null;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const accountInfo = await this.getAccountInfo();
      return accountInfo?.positions || [];
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      return [];
    }
  }

  async getOrders(): Promise<Order[]> {
    try {
      const response = await this.api.get("/api/v1/orders", {
        params: { account_index: this.config.accountIndex }
      });
      return response.data.orders || [];
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      return [];
    }
  }

  async getNextNonce(): Promise<number> {
    try {
      const response = await this.api.get("/api/v1/next_nonce", {
        params: {
          account_index: this.config.accountIndex,
          api_key_index: this.config.apiKeyIndex
        }
      });
      return response.data.nonce || 0;
    } catch (error) {
      console.error("Failed to fetch next nonce:", error);
      return 0;
    }
  }

  async createOrder(params: CreateOrderParams): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      const nonce = await this.getNextNonce();
      const clientOrderIndex = params.clientOrderIndex || Date.now();

      // Sign the order
      const signature = await this.signer.signOrderParams({
        marketIndex: params.marketIndex,
        accountIndex: this.config.accountIndex,
        apiKeyIndex: this.config.apiKeyIndex,
        side: params.side,
        amount: params.amount,
        price: params.price || "0",
        orderType: params.orderType === "market" ? "ORDER_TYPE_MARKET" : "ORDER_TYPE_LIMIT",
        timeInForce: "ORDER_TIME_IN_FORCE_IMMEDIATE_OR_CANCEL",
        clientOrderIndex,
        nonce
      });

      // Send transaction
      const response = await this.api.post("/api/v1/send_tx", {
        account_index: this.config.accountIndex,
        api_key_index: this.config.apiKeyIndex,
        market_index: params.marketIndex,
        side: params.side,
        order_type: params.orderType,
        amount: params.amount,
        price: params.price,
        client_order_index: clientOrderIndex,
        nonce,
        signature
      });

      return {
        success: true,
        orderId: response.data.order_id
      };
    } catch (error: any) {
      console.error("Failed to create order:", error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Failed to create order"
      };
    }
  }

  async cancelOrder(clientOrderIndex: number): Promise<{ success: boolean; error?: string }> {
    try {
      const nonce = await this.getNextNonce();

      const response = await this.api.post("/api/v1/cancel_order", {
        account_index: this.config.accountIndex,
        api_key_index: this.config.apiKeyIndex,
        order_index: clientOrderIndex,
        nonce
      });

      return { success: true };
    } catch (error: any) {
      console.error("Failed to cancel order:", error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Failed to cancel order"
      };
    }
  }

  async getMarketData(): Promise<MarketData[]> {
    try {
      const markets = await this.getMarkets();
      const marketData: MarketData[] = [];

      for (const market of markets) {
        const orderbook = await this.getOrderBook(market.marketIndex);
        
        // Get best bid and ask
        const bestBid = orderbook.bids[0]?.price || "0";
        const bestAsk = orderbook.asks[0]?.price || "0";
        const midPrice = ((parseFloat(bestBid) + parseFloat(bestAsk)) / 2).toString();

        marketData.push({
          symbol: market.symbol,
          price: midPrice,
          change24h: "0", // Would need historical data
          volume24h: "0", // Would need to aggregate trades
        });
      }

      return marketData;
    } catch (error) {
      console.error("Failed to fetch market data:", error);
      return [];
    }
  }
}

// Singleton instance
let lighterClient: LighterClient | null = null;

export function initLighterClient(): LighterClient {
  if (!lighterClient) {
    // Validate environment variables
    if (!process.env.LIGHTER_API_KEY_PRIVATE_KEY) {
      throw new Error("LIGHTER_API_KEY_PRIVATE_KEY environment variable is not set");
    }

    if (!process.env.LIGHTER_ACCOUNT_INDEX) {
      throw new Error("LIGHTER_ACCOUNT_INDEX environment variable is not set");
    }

    if (!process.env.LIGHTER_API_KEY_INDEX) {
      throw new Error("LIGHTER_API_KEY_INDEX environment variable is not set");
    }

    const config: LighterConfig = {
      baseUrl: process.env.LIGHTER_BASE_URL || "https://testnet.zklighter.elliot.ai",
      apiKeyPrivateKey: process.env.LIGHTER_API_KEY_PRIVATE_KEY,
      accountIndex: parseInt(process.env.LIGHTER_ACCOUNT_INDEX),
      apiKeyIndex: parseInt(process.env.LIGHTER_API_KEY_INDEX),
    };

    lighterClient = new LighterClient(config);
  }

  return lighterClient;
}

export function getLighterClient(): LighterClient | null {
  return lighterClient;
}
