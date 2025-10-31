import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface OrderlyWsConfig {
  testnet?: boolean;
}

interface OrderbookData {
  symbol: string;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][];
  timestamp: number;
}

interface TradeData {
  symbol: string;
  price: string;
  quantity: string;
  side: 'BUY' | 'SELL';
  timestamp: number;
}

export class OrderlyWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: OrderlyWsConfig;
  private wsUrl: string;
  private subscriptions: Set<string> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000; // 5 seconds

  constructor(config: OrderlyWsConfig = {}) {
    super();
    this.config = config;
    this.wsUrl = config.testnet
      ? 'wss://testnet-ws.orderly.org/ws/stream'
      : 'wss://ws.orderly.org/ws/stream';
  }

  /**
   * Connect to Orderly WebSocket
   */
  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[Orderly WS] Already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('[Orderly WS] Connection already in progress');
      return;
    }

    this.isConnecting = true;
    console.log(`[Orderly WS] Connecting to ${this.wsUrl}`);

    try {
      this.ws = new WebSocket(this.wsUrl, {
        perMessageDeflate: false
      });

      this.ws.on('open', () => {
        console.log('[Orderly WS] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected');

        // Re-subscribe to all previous subscriptions
        this.resubscribe();

        // Setup ping/pong to keep connection alive
        this.setupPingPong();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('[Orderly WS] Error parsing message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[Orderly WS] Connection closed: ${code} - ${reason}`);
        this.isConnecting = false;
        this.cleanup();
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[Orderly WS] WebSocket error:', error);
        this.emit('error', error);
      });

      this.ws.on('pong', () => {
        console.log('[Orderly WS] Received pong');
      });
    } catch (error) {
      console.error('[Orderly WS] Connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    console.log('[Orderly WS] Disconnecting...');
    
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.subscriptions.clear();
    this.isConnecting = false;
  }

  /**
   * Subscribe to orderbook updates for a symbol
   */
  public subscribeOrderbook(symbol: string): void {
    const topic = `${symbol}@orderbook`;
    
    if (this.subscriptions.has(topic)) {
      console.log(`[Orderly WS] Already subscribed to orderbook for ${symbol}`);
      return;
    }

    console.log(`[Orderly WS] Subscribing to orderbook for ${symbol}`);
    this.subscriptions.add(topic);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription({
        event: 'subscribe',
        topic,
      });
    }
  }

  /**
   * Unsubscribe from orderbook updates
   */
  public unsubscribeOrderbook(symbol: string): void {
    const topic = `${symbol}@orderbook`;
    
    if (!this.subscriptions.has(topic)) {
      return;
    }

    console.log(`[Orderly WS] Unsubscribing from orderbook for ${symbol}`);
    this.subscriptions.delete(topic);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription({
        event: 'unsubscribe',
        topic,
      });
    }
  }

  /**
   * Subscribe to trade updates for a symbol
   */
  public subscribeTrades(symbol: string): void {
    const topic = `${symbol}@trade`;
    
    if (this.subscriptions.has(topic)) {
      console.log(`[Orderly WS] Already subscribed to trades for ${symbol}`);
      return;
    }

    console.log(`[Orderly WS] Subscribing to trades for ${symbol}`);
    this.subscriptions.add(topic);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription({
        event: 'subscribe',
        topic,
      });
    }
  }

  /**
   * Unsubscribe from trade updates
   */
  public unsubscribeTrades(symbol: string): void {
    const topic = `${symbol}@trade`;
    
    if (!this.subscriptions.has(topic)) {
      return;
    }

    console.log(`[Orderly WS] Unsubscribing from trades for ${symbol}`);
    this.subscriptions.delete(topic);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription({
        event: 'unsubscribe',
        topic,
      });
    }
  }

  /**
   * Send subscription/unsubscription message
   */
  private sendSubscription(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Orderly WS] Cannot send subscription - not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[Orderly WS] Error sending subscription:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    // Orderly WebSocket message format:
    // { topic: "PERP_BTC_USDC@orderbook", data: {...} }
    
    if (!message.topic) {
      // Might be a system message (ping/pong, success confirmation, etc.)
      if (message.event === 'ping') {
        this.sendPong();
      } else if (message.event === 'subscribed' || message.event === 'unsubscribed') {
        console.log(`[Orderly WS] ${message.event}: ${message.topic}`);
      }
      return;
    }

    const [symbol, dataType] = message.topic.split('@');

    if (dataType === 'orderbook') {
      this.handleOrderbookUpdate(symbol, message.data);
    } else if (dataType === 'trade') {
      this.handleTradeUpdate(symbol, message.data);
    }
  }

  /**
   * Handle orderbook update
   */
  private handleOrderbookUpdate(symbol: string, data: any): void {
    try {
      const orderbook: OrderbookData = {
        symbol,
        bids: data.bids || [],
        asks: data.asks || [],
        timestamp: data.timestamp || Date.now(),
      };

      this.emit('orderbook', orderbook);
    } catch (error) {
      console.error('[Orderly WS] Error handling orderbook update:', error);
    }
  }

  /**
   * Handle trade update
   */
  private handleTradeUpdate(symbol: string, data: any): void {
    try {
      const trade: TradeData = {
        symbol,
        price: data.price,
        quantity: data.quantity,
        side: data.side,
        timestamp: data.timestamp || Date.now(),
      };

      this.emit('trade', trade);
    } catch (error) {
      console.error('[Orderly WS] Error handling trade update:', error);
    }
  }

  /**
   * Send pong response to ping
   */
  private sendPong(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ event: 'pong' }));
      } catch (error) {
        console.error('[Orderly WS] Error sending pong:', error);
      }
    }
  }

  /**
   * Setup ping/pong to keep connection alive
   */
  private setupPingPong(): void {
    // Clear existing interval if any
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  /**
   * Re-subscribe to all subscriptions after reconnection
   */
  private resubscribe(): void {
    console.log(`[Orderly WS] Re-subscribing to ${this.subscriptions.size} topics`);
    
    const topics = Array.from(this.subscriptions);
    for (const topic of topics) {
      this.sendSubscription({
        event: 'subscribe',
        topic,
      });
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Orderly WS] Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('max_reconnect_attempts');
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 60000); // Max 60s
    this.reconnectAttempts++;

    console.log(`[Orderly WS] Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      console.log(`[Orderly WS] Reconnection attempt ${this.reconnectAttempts}`);
      this.connect();
    }, delay);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get connection status
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current subscriptions
   */
  public getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }
}

// Singleton instance for the application
let orderlyWsInstance: OrderlyWebSocketService | null = null;

/**
 * Get or create Orderly WebSocket service instance
 */
export function getOrderlyWebSocket(config?: OrderlyWsConfig): OrderlyWebSocketService {
  if (!orderlyWsInstance) {
    orderlyWsInstance = new OrderlyWebSocketService(config);
  }
  return orderlyWsInstance;
}

/**
 * Initialize and connect Orderly WebSocket
 */
export async function initializeOrderlyWebSocket(config?: OrderlyWsConfig): Promise<OrderlyWebSocketService> {
  const ws = getOrderlyWebSocket(config);
  
  if (!ws.isConnected()) {
    await ws.connect();
  }
  
  return ws;
}
