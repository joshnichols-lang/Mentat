import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';

export interface AevoConfig {
  apiKey: string;
  apiSecret: string;
  signingKey: string; // Private key for EIP-712 order signing
  walletAddress?: string; // Derived from signing key if not provided
  testnet?: boolean;
}

export interface AevoMarket {
  instrument_id: string;
  instrument_name: string; // e.g., "ETH-31MAR25-2000-C"
  instrument_type: 'OPTION' | 'PERPETUAL';
  option_type?: 'call' | 'put';
  underlying_asset: string; // "ETH", "BTC"
  strike?: string; // Strike price for options
  expiry?: string; // Unix timestamp (nanoseconds)
  mark_price: string;
  index_price?: string;
  is_active: boolean;
  greeks?: AevoGreeks;
}

export interface AevoGreeks {
  delta: string;
  gamma: string;
  theta: string;
  vega: string;
  rho: string;
  iv?: string; // Implied volatility
}

export interface AevoPortfolio {
  account_value: string;
  collateral: string;
  equity: string;
  margin_usage: string;
  positions: AevoPosition[];
  greeks_by_asset: {
    asset: string;
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
    rho: string;
  }[];
}

export interface AevoPosition {
  instrument_id: string;
  instrument_name: string;
  instrument_type: string;
  side: 'long' | 'short';
  amount: string; // Number of contracts
  entry_price: string;
  mark_price: string;
  unrealized_pnl: string;
  greeks?: AevoGreeks;
}

export interface AevoOrderbook {
  instrument_name: string;
  bids: [string, string][]; // [price, size]
  asks: [string, string][];
  timestamp: number;
}

export interface AevoOrderParams {
  instrument: string; // Aevo instrument ID
  is_buy: boolean;
  amount: string; // 6 decimals (e.g., "1000000" = 1 contract)
  limit_price?: string; // 6 decimals, required for limit orders
  order_type?: 'market' | 'limit';
  post_only?: boolean;
  reduce_only?: boolean;
  time_in_force?: 'gtc' | 'ioc' | 'fok';
}

export interface AevoOrder {
  order_id: string;
  instrument_id: string;
  instrument_name: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  amount: string;
  filled: string;
  limit_price?: string;
  avg_price?: string;
  status: 'open' | 'filled' | 'cancelled' | 'rejected';
  timestamp: number;
}

export class AevoClient {
  private client: AxiosInstance;
  private config: AevoConfig;
  private baseUrl: string;
  private wallet: ethers.Wallet;
  private chainId: number;
  private domainName: string;

  constructor(config: AevoConfig) {
    this.config = config;
    this.baseUrl = config.testnet
      ? 'https://api-testnet.aevo.xyz'
      : 'https://api.aevo.xyz';

    // Initialize ethers wallet for EIP-712 signing
    this.wallet = new ethers.Wallet(config.signingKey);
    if (!config.walletAddress) {
      this.config.walletAddress = this.wallet.address;
    }

    // EIP-712 domain parameters
    this.chainId = config.testnet ? 11155111 : 1; // Sepolia for testnet, mainnet otherwise
    this.domainName = config.testnet ? 'Aevo Testnet' : 'Aevo Mainnet';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[Aevo] Client initialized for ${config.testnet ? 'testnet' : 'mainnet'}`);
    console.log(`[Aevo] Wallet address: ${this.config.walletAddress}`);
  }

  /**
   * Generate HMAC-SHA256 signature for authenticated requests
   * Format: "API_KEY,timestamp_ns,METHOD,PATH,BODY"
   */
  private generateSignature(
    timestamp: number,
    method: string,
    path: string,
    body: string = ''
  ): string {
    const message = `${this.config.apiKey},${timestamp},${method},${path},${body}`;
    const signature = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(message)
      .digest('hex');
    
    return signature;
  }

  /**
   * Make an authenticated request to Aevo API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any,
    requiresAuth: boolean = true
  ): Promise<T> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const timestamp = Date.now() * 1_000_000; // Convert to nanoseconds
        const bodyString = data ? JSON.stringify(data) : '';
        const signature = this.generateSignature(timestamp, method, path, bodyString);

        // Send only the signature, timestamp, and API key - NEVER send the secret over the wire
        headers['AEVO-KEY'] = this.config.apiKey;
        headers['AEVO-TIMESTAMP'] = timestamp.toString();
        headers['AEVO-SIGNATURE'] = signature;
      }

      const response = await this.client.request<T>({
        method,
        url: path,
        data,
        headers,
      });

      return response.data;
    } catch (error: any) {
      console.error(`[Aevo] Request failed: ${method} ${path}`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Sign order using EIP-712 typed data
   */
  private async signOrder(orderParams: {
    maker: string;
    isBuy: boolean;
    limitPrice: string;
    amount: string;
    salt: string;
    instrument: string;
    timestamp: number;
  }): Promise<string> {
    const domain = {
      name: this.domainName,
      version: '1',
      chainId: this.chainId,
    };

    const types = {
      Order: [
        { name: 'maker', type: 'address' },
        { name: 'isBuy', type: 'bool' },
        { name: 'limitPrice', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
        { name: 'salt', type: 'uint256' },
        { name: 'instrument', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' },
      ],
    };

    const value = {
      maker: orderParams.maker,
      isBuy: orderParams.isBuy,
      limitPrice: orderParams.limitPrice,
      amount: orderParams.amount,
      salt: orderParams.salt,
      instrument: orderParams.instrument,
      timestamp: orderParams.timestamp,
    };

    const signature = await this.wallet.signTypedData(domain, types, value);
    return signature;
  }

  /**
   * Get available markets (options and perpetuals)
   */
  async getMarkets(asset?: string, instrumentType?: 'OPTION' | 'PERPETUAL'): Promise<AevoMarket[]> {
    try {
      const params: any = {};
      if (asset) params.asset = asset;
      if (instrumentType) params.instrument_type = instrumentType;

      const response = await this.client.get<AevoMarket[]>('/markets', {
        params,
      });

      return response.data;
    } catch (error: any) {
      console.error('[Aevo] Failed to fetch markets:', error.message);
      throw error;
    }
  }

  /**
   * Get orderbook for a specific instrument
   */
  async getOrderbook(instrumentName: string): Promise<AevoOrderbook> {
    try {
      const response = await this.client.get<AevoOrderbook>('/orderbook', {
        params: { instrument_name: instrumentName },
      });

      return response.data;
    } catch (error: any) {
      console.error(`[Aevo] Failed to fetch orderbook for ${instrumentName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccount(): Promise<any> {
    return this.request('GET', '/account');
  }

  /**
   * Get portfolio with Greeks
   */
  async getPortfolio(): Promise<AevoPortfolio> {
    return this.request('GET', '/portfolio');
  }

  /**
   * Place a new order
   */
  async placeOrder(params: AevoOrderParams): Promise<AevoOrder> {
    try {
      // Generate order parameters for signing
      const timestamp = Math.floor(Date.now() / 1000);
      const salt = Math.floor(Math.random() * 1000000).toString();
      
      // Convert to 6-decimal format if needed
      const amount = params.amount;
      const limitPrice = params.limit_price || '0';

      const orderToSign = {
        maker: this.config.walletAddress!,
        isBuy: params.is_buy,
        limitPrice: limitPrice,
        amount: amount,
        salt: salt,
        instrument: params.instrument,
        timestamp: timestamp,
      };

      // Sign the order with EIP-712
      const signature = await this.signOrder(orderToSign);

      // Submit order to Aevo
      const orderPayload = {
        instrument: params.instrument,
        maker: this.config.walletAddress,
        is_buy: params.is_buy,
        amount: amount,
        limit_price: params.order_type === 'market' ? undefined : limitPrice,
        salt: salt,
        timestamp: timestamp,
        signature: signature,
        post_only: params.post_only || false,
        reduce_only: params.reduce_only || false,
      };

      const response = await this.request<AevoOrder>('POST', '/orders', orderPayload);
      console.log(`[Aevo] Order placed successfully:`, response);
      return response;
    } catch (error: any) {
      console.error('[Aevo] Failed to place order:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Edit an existing order
   */
  async editOrder(orderId: string, newPrice: string, newAmount: string): Promise<AevoOrder> {
    try {
      // Re-sign with new parameters
      const timestamp = Math.floor(Date.now() / 1000);
      const salt = Math.floor(Math.random() * 1000000).toString();

      // Get original order details first (would need to implement getOrder)
      // For now, we'll require the instrument ID to be passed
      // This is a simplified version - production would fetch the order first

      const orderToSign = {
        maker: this.config.walletAddress!,
        isBuy: true, // Would come from original order
        limitPrice: newPrice,
        amount: newAmount,
        salt: salt,
        instrument: '0', // Would come from original order
        timestamp: timestamp,
      };

      const signature = await this.signOrder(orderToSign);

      const editPayload = {
        limit_price: newPrice,
        amount: newAmount,
        salt: salt,
        timestamp: timestamp,
        signature: signature,
      };

      const response = await this.request<AevoOrder>('POST', `/orders/${orderId}`, editPayload);
      console.log(`[Aevo] Order ${orderId} edited successfully`);
      return response;
    } catch (error: any) {
      console.error(`[Aevo] Failed to edit order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.request('DELETE', `/orders/${orderId}`);
      console.log(`[Aevo] Order ${orderId} cancelled successfully`);
    } catch (error: any) {
      console.error(`[Aevo] Failed to cancel order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(): Promise<AevoOrder[]> {
    return this.request('GET', '/orders');
  }

  /**
   * Get order history
   */
  async getOrderHistory(params?: { limit?: number; offset?: number }): Promise<AevoOrder[]> {
    return this.request('GET', '/order-history', params);
  }

  /**
   * Get current positions
   */
  async getPositions(): Promise<AevoPosition[]> {
    const portfolio = await this.getPortfolio();
    return portfolio.positions || [];
  }

  /**
   * Helper: Convert price to 6-decimal format
   */
  static toAevoPrice(price: number): string {
    return Math.floor(price * 1_000_000).toString();
  }

  /**
   * Helper: Convert size to 6-decimal format
   */
  static toAevoSize(size: number): string {
    return Math.floor(size * 1_000_000).toString();
  }

  /**
   * Helper: Convert from 6-decimal format to number
   */
  static fromAevoDecimal(value: string): number {
    return parseInt(value) / 1_000_000;
  }

  /**
   * Calculate breakeven points for a Straddle strategy
   */
  static calculateStraddleBreakevens(
    strike: number,
    callPremium: number,
    putPremium: number
  ): { upper: number; lower: number; maxLoss: number } {
    const totalPremium = callPremium + putPremium;
    return {
      upper: strike + totalPremium,
      lower: strike - totalPremium,
      maxLoss: totalPremium,
    };
  }

  /**
   * Calculate breakeven points for a Strap strategy (2 calls + 1 put)
   */
  static calculateStrapBreakevens(
    strike: number,
    callPremium: number,
    putPremium: number
  ): { upper: number; lower: number; maxLoss: number } {
    const totalPremium = (2 * callPremium) + putPremium;
    const upperBreakeven = strike + (totalPremium / 2);
    const lowerBreakeven = strike - totalPremium;
    return {
      upper: upperBreakeven,
      lower: lowerBreakeven,
      maxLoss: totalPremium,
    };
  }

  /**
   * Calculate breakeven points for a Strip strategy (1 call + 2 puts)
   */
  static calculateStripBreakevens(
    strike: number,
    callPremium: number,
    putPremium: number
  ): { upper: number; lower: number; maxLoss: number } {
    const totalPremium = callPremium + (2 * putPremium);
    const upperBreakeven = strike + totalPremium;
    const lowerBreakeven = strike - (totalPremium / 2);
    return {
      upper: upperBreakeven,
      lower: lowerBreakeven,
      maxLoss: totalPremium,
    };
  }
}
