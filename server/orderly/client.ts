import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

export interface OrderlyConfig {
  apiKey: string;
  apiSecret: string;
  accountId: string; // User's Ethereum address registered with Orderly
  testnet?: boolean;
}

export interface OrderlyMarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
  markPrice?: string;
  indexPrice?: string;
  fundingRate?: string;
}

export interface OrderlyPosition {
  symbol: string;
  positionQty: string; // Positive for long, negative for short
  costPosition: string; // Average entry price * size
  averageOpenPrice: string;
  unrealizedPnl: string;
  unsettledPnl: string;
  markPrice: string;
  leverage: string;
  liquidationPrice: string | null;
  marginRatio: string;
}

export interface OrderlyOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET' | 'IOC' | 'FOK' | 'POST_ONLY' | 'ASK' | 'BID';
  orderPrice?: number; // Required for LIMIT orders
  orderQuantity: number;
  reduceOnly?: boolean;
  visibleQuantity?: number; // For iceberg orders
}

export interface OrderlyOrder {
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  orderPrice: string;
  orderQuantity: string;
  executedQuantity: string;
  averageExecutedPrice: string | null;
  status: 'NEW' | 'PARTIAL_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'INCOMPLETE' | 'COMPLETED';
  type: 'LIMIT' | 'MARKET';
  reduceOnly: boolean;
  createdTime: number;
  updatedTime: number;
}

export interface OrderlyBalance {
  holding: {
    token: string;
    holding: string; // Total balance
    frozen: string; // Amount in orders
    interest: string;
    pendingShortQty: string;
    pendingLongQty: string;
    availableBalance: string; // Available to trade
  }[];
  totalCollateral: string;
  freeCollateral: string;
  totalAccountValue: string;
  totalMarginUsed: string;
  availableBalance: string;
}

export class OrderlyClient {
  private client: AxiosInstance;
  private config: OrderlyConfig;
  private baseUrl: string;

  constructor(config: OrderlyConfig) {
    this.config = config;
    this.baseUrl = config.testnet
      ? 'https://testnet-api.orderly.org'
      : 'https://api.orderly.org';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[Orderly] Client initialized for ${config.testnet ? 'testnet' : 'mainnet'}`);
  }

  /**
   * Generate signature for authenticated requests
   * Orderly uses HMAC-SHA256 signing
   */
  private generateSignature(timestamp: number, method: string, path: string, body: string = ''): string {
    // Orderly signature format: timestamp + method + requestPath + body
    const message = `${timestamp}${method}${path}${body}`;
    const signature = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(message)
      .digest('base64');
    
    return signature;
  }

  /**
   * Make an authenticated request to Orderly API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any
  ): Promise<T> {
    const timestamp = Date.now();
    const bodyString = data ? JSON.stringify(data) : '';
    const signature = this.generateSignature(timestamp, method, path, bodyString);

    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data,
        headers: {
          'orderly-timestamp': timestamp.toString(),
          'orderly-account-id': this.config.accountId,
          'orderly-key': this.config.apiKey,
          'orderly-signature': signature,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error(`[Orderly] API request failed:`, {
        method,
        path,
        error: error.response?.data || error.message,
      });
      throw new Error(error.response?.data?.message || error.message || 'Orderly API request failed');
    }
  }

  /**
   * Get account balance and holdings
   */
  async getBalance(): Promise<OrderlyBalance> {
    console.log('[Orderly] Fetching account balance');
    const response = await this.request<{ success: boolean; data: OrderlyBalance }>(
      'GET',
      '/v1/client/holding'
    );
    return response.data;
  }

  /**
   * Get current open positions
   */
  async getPositions(): Promise<OrderlyPosition[]> {
    console.log('[Orderly] Fetching open positions');
    const response = await this.request<{ success: boolean; data: { rows: OrderlyPosition[] } }>(
      'GET',
      '/v1/positions'
    );
    return response.data.rows || [];
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<OrderlyOrder[]> {
    console.log(`[Orderly] Fetching open orders${symbol ? ` for ${symbol}` : ''}`);
    const path = symbol ? `/v1/orders?symbol=${symbol}` : '/v1/orders';
    const response = await this.request<{ success: boolean; data: { rows: OrderlyOrder[] } }>(
      'GET',
      path
    );
    return response.data.rows || [];
  }

  /**
   * Place a new order
   */
  async placeOrder(params: OrderlyOrderParams): Promise<{ orderId: number; clientOrderId?: string }> {
    console.log('[Orderly] Placing order:', params);
    
    const orderData: any = {
      symbol: params.symbol,
      order_type: params.orderType,
      order_quantity: params.orderQuantity,
      side: params.side,
    };

    // Add order price for limit orders
    if (params.orderType === 'LIMIT' || params.orderType === 'POST_ONLY' || params.orderType === 'IOC' || params.orderType === 'FOK') {
      if (!params.orderPrice) {
        throw new Error('Order price is required for LIMIT orders');
      }
      orderData.order_price = params.orderPrice;
    }

    if (params.reduceOnly) {
      orderData.reduce_only = params.reduceOnly;
    }

    if (params.visibleQuantity) {
      orderData.visible_quantity = params.visibleQuantity;
    }

    const response = await this.request<{ success: boolean; data: { orderId: number; clientOrderId?: string } }>(
      'POST',
      '/v1/order',
      orderData
    );

    console.log('[Orderly] Order placed successfully:', response.data);
    return response.data;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: number, symbol: string): Promise<void> {
    console.log(`[Orderly] Cancelling order ${orderId} for ${symbol}`);
    await this.request('DELETE', `/v1/order?order_id=${orderId}&symbol=${symbol}`);
    console.log(`[Orderly] Order ${orderId} cancelled successfully`);
  }

  /**
   * Cancel all orders for a symbol or all symbols
   */
  async cancelAllOrders(symbol?: string): Promise<void> {
    console.log(`[Orderly] Cancelling all orders${symbol ? ` for ${symbol}` : ''}`);
    const path = symbol ? `/v1/orders?symbol=${symbol}` : '/v1/orders';
    await this.request('DELETE', path);
    console.log('[Orderly] All orders cancelled successfully');
  }

  /**
   * Get market data for a symbol
   */
  async getMarketData(symbol: string): Promise<OrderlyMarketData> {
    console.log(`[Orderly] Fetching market data for ${symbol}`);
    // Public endpoint - no authentication needed
    try {
      const response = await this.client.get(`/v1/public/market_trades?symbol=${symbol}&limit=1`);
      const trades = response.data.data.rows;
      
      // Get 24h stats
      const statsResponse = await this.client.get(`/v1/public/info/${symbol}`);
      const stats = statsResponse.data.data;
      
      return {
        symbol,
        price: trades[0]?.price || '0',
        change24h: stats?.change_24h || '0',
        volume24h: stats?.volume_24h || '0',
        markPrice: stats?.mark_price,
        indexPrice: stats?.index_price,
        fundingRate: stats?.funding_rate,
      };
    } catch (error: any) {
      console.error(`[Orderly] Failed to fetch market data for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get available trading symbols
   */
  async getSymbols(): Promise<string[]> {
    console.log('[Orderly] Fetching available symbols');
    try {
      const response = await this.client.get('/v1/public/symbols');
      const symbols = response.data.data.rows || [];
      return symbols.map((s: any) => s.symbol);
    } catch (error: any) {
      console.error('[Orderly] Failed to fetch symbols:', error.message);
      throw error;
    }
  }

  /**
   * Get orderbook for a symbol
   */
  async getOrderbook(symbol: string, maxLevel: number = 10): Promise<{
    bids: [string, string][]; // [price, quantity]
    asks: [string, string][];
    timestamp: number;
  }> {
    console.log(`[Orderly] Fetching orderbook for ${symbol}`);
    try {
      const response = await this.client.get(`/v1/orderbook/${symbol}?max_level=${maxLevel}`);
      const data = response.data.data;
      return {
        bids: data.bids || [],
        asks: data.asks || [],
        timestamp: data.timestamp || Date.now(),
      };
    } catch (error: any) {
      console.error(`[Orderly] Failed to fetch orderbook for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get funding rate for a perpetual symbol
   */
  async getFundingRate(symbol: string): Promise<{
    fundingRate: string;
    nextFundingTime: number;
  }> {
    console.log(`[Orderly] Fetching funding rate for ${symbol}`);
    try {
      const response = await this.client.get(`/v1/public/funding_rate/${symbol}`);
      const data = response.data.data;
      return {
        fundingRate: data.est_funding_rate || '0',
        nextFundingTime: data.next_funding_time || 0,
      };
    } catch (error: any) {
      console.error(`[Orderly] Failed to fetch funding rate for ${symbol}:`, error.message);
      throw error;
    }
  }
}

/**
 * Helper function to create and cache Orderly clients per user
 */
const clientCache = new Map<string, OrderlyClient>();

export function createOrderlyClient(config: OrderlyConfig): OrderlyClient {
  const cacheKey = `${config.accountId}-${config.testnet ? 'testnet' : 'mainnet'}`;
  
  if (clientCache.has(cacheKey)) {
    console.log(`[Orderly] Returning cached client for ${cacheKey}`);
    return clientCache.get(cacheKey)!;
  }

  const client = new OrderlyClient(config);
  clientCache.set(cacheKey, client);
  console.log(`[Orderly] Created and cached client for ${cacheKey}`);
  return client;
}

export function clearOrderlyClientCache(accountId?: string): void {
  if (accountId) {
    // Clear specific user's clients
    const mainnetKey = `${accountId}-mainnet`;
    const testnetKey = `${accountId}-testnet`;
    clientCache.delete(mainnetKey);
    clientCache.delete(testnetKey);
    console.log(`[Orderly] Cleared client cache for ${accountId}`);
  } else {
    // Clear all clients
    clientCache.clear();
    console.log('[Orderly] Cleared all client cache');
  }
}
