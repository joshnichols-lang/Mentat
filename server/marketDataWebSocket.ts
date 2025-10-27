import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";

interface HLTradeData {
  coin: string;
  side: string; // "B" (buy) or "S" (sell)
  px: string;
  sz: string;
  time: number;
  tid: number;
}

interface HLL2BookLevel {
  px: string;
  sz: string;
  n: number;
}

interface HLL2BookData {
  coin: string;
  levels: [HLL2BookLevel[], HLL2BookLevel[]]; // [bids, asks]
  time: number;
}

interface HLCandleData {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}

interface ClientSubscription {
  type: "trades" | "l2Book" | "candle";
  coins: Set<string>;
}

export class MarketDataWebSocketService {
  private wss: WebSocketServer | null = null;
  private hlWs: WebSocket | null = null;
  private clients = new Map<WebSocket, Map<string, ClientSubscription>>();
  private activeSubscriptions = new Map<string, Set<WebSocket>>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private server: Server) {
    this.initializeWebSocketServer();
  }

  private initializeWebSocketServer() {
    // Create WebSocket server for client connections
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: "/market-data"
    });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[Market Data WS] Client connected");
      this.clients.set(ws, new Map());

      ws.on("message", (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error("[Market Data WS] Failed to parse client message:", error);
        }
      });

      ws.on("close", () => {
        console.log("[Market Data WS] Client disconnected");
        this.handleClientDisconnect(ws);
      });

      ws.on("error", (error) => {
        console.error("[Market Data WS] Client error:", error);
      });
    });

    // Connect to Hyperliquid WebSocket
    this.connectToHyperliquid();
  }

  private connectToHyperliquid() {
    if (this.hlWs) {
      this.hlWs.close();
    }

    const wsUrl = "wss://api.hyperliquid.xyz/ws";
    console.log("[Market Data WS] Connecting to Hyperliquid...");

    this.hlWs = new WebSocket(wsUrl);

    this.hlWs.on("open", () => {
      console.log("[Market Data WS] Connected to Hyperliquid");
      this.startHeartbeat();
      // Re-subscribe to all active subscriptions after reconnect
      this.resubscribeAll();
    });

    this.hlWs.on("message", (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("[Market Data WS] Received from Hyperliquid:", JSON.stringify(message).substring(0, 300));
        this.handleHyperliquidMessage(message);
      } catch (error) {
        console.error("[Market Data WS] Failed to parse Hyperliquid message:", error);
      }
    });

    this.hlWs.on("close", () => {
      console.log("[Market Data WS] Disconnected from Hyperliquid");
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.hlWs.on("error", (error) => {
      console.error("[Market Data WS] Hyperliquid connection error:", error);
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.hlWs && this.hlWs.readyState === WebSocket.OPEN) {
        this.hlWs.send(JSON.stringify({ method: "ping" }));
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log("[Market Data WS] Attempting to reconnect to Hyperliquid...");
      this.connectToHyperliquid();
    }, 5000); // Reconnect after 5 seconds
  }

  private handleClientMessage(ws: WebSocket, message: any) {
    const { action, type, coin, coins, interval } = message;

    if (action === "subscribe") {
      if (type === "trades" && coin) {
        this.subscribeClientToTrades(ws, coin);
      } else if (type === "l2Book" && coin) {
        this.subscribeClientToL2Book(ws, coin);
      } else if (type === "candle" && coin && interval) {
        this.subscribeClientToCandle(ws, coin, interval);
      } else if (type === "cvd" && coins && Array.isArray(coins)) {
        // CVD subscription for multiple coins (spot + perp)
        coins.forEach(c => this.subscribeClientToTrades(ws, c));
      }
    } else if (action === "unsubscribe") {
      if (type && coin) {
        this.unsubscribeClient(ws, type, coin, interval);
      }
    }
  }

  private subscribeClientToTrades(ws: WebSocket, coin: string) {
    const key = `trades:${coin}`;
    const clientSubs = this.clients.get(ws);
    
    if (!clientSubs) return;

    let sub = clientSubs.get(key);
    if (!sub) {
      sub = { type: "trades", coins: new Set() };
      clientSubs.set(key, sub);
    }
    sub.coins.add(coin);

    // Track active subscription
    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToHyperliquid("trades", coin);
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Market Data WS] Client subscribed to trades:${coin}`);
  }

  private subscribeClientToL2Book(ws: WebSocket, coin: string) {
    const key = `l2Book:${coin}`;
    const clientSubs = this.clients.get(ws);
    
    if (!clientSubs) return;

    let sub = clientSubs.get(key);
    if (!sub) {
      sub = { type: "l2Book", coins: new Set() };
      clientSubs.set(key, sub);
    }
    sub.coins.add(coin);

    // Track active subscription
    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToHyperliquid("l2Book", coin);
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Market Data WS] Client subscribed to l2Book:${coin}`);
  }

  private subscribeClientToCandle(ws: WebSocket, coin: string, interval: string) {
    const key = `candle:${coin}:${interval}`;
    const clientSubs = this.clients.get(ws);
    
    if (!clientSubs) return;

    let sub = clientSubs.get(key);
    if (!sub) {
      sub = { type: "candle", coins: new Set() };
      clientSubs.set(key, sub);
    }
    sub.coins.add(coin);

    // Track active subscription
    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToHyperliquid("candle", coin, interval);
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Market Data WS] Client subscribed to candle:${coin}:${interval}`);
  }

  private normalizeHyperliquidCoin(coin: string): string {
    // Hyperliquid expects base coin symbols without suffixes
    // Strip -USD, -PERP, -SPOT suffixes
    return coin.replace(/-USD$|-PERP$|-SPOT$/, '');
  }

  private subscribeToHyperliquid(type: string, coin: string, interval?: string) {
    if (!this.hlWs || this.hlWs.readyState !== WebSocket.OPEN) {
      console.warn(`[Market Data WS] Cannot subscribe to ${type}:${coin} - not connected`);
      return;
    }

    // Normalize coin symbol for Hyperliquid (strip -USD, -PERP, -SPOT suffixes)
    const hlCoin = this.normalizeHyperliquidCoin(coin);

    const subscription: any = {
      method: "subscribe",
      subscription: {
        type,
        coin: hlCoin
      }
    };

    if (interval) {
      subscription.subscription.interval = interval;
    }

    this.hlWs.send(JSON.stringify(subscription));
    console.log(`[Market Data WS] Subscribed to Hyperliquid ${type}:${hlCoin}${interval ? `:${interval}` : ""} (from client coin: ${coin})`);
  }

  private unsubscribeClient(ws: WebSocket, type: string, coin: string, interval?: string) {
    const key = type === "candle" && interval ? `${type}:${coin}:${interval}` : `${type}:${coin}`;
    const clientSubs = this.clients.get(ws);
    
    if (!clientSubs) return;

    clientSubs.delete(key);

    const activeSub = this.activeSubscriptions.get(key);
    if (activeSub) {
      activeSub.delete(ws);
      if (activeSub.size === 0) {
        this.activeSubscriptions.delete(key);
        this.unsubscribeFromHyperliquid(type, coin, interval);
      }
    }

    console.log(`[Market Data WS] Client unsubscribed from ${key}`);
  }

  private unsubscribeFromHyperliquid(type: string, coin: string, interval?: string) {
    if (!this.hlWs || this.hlWs.readyState !== WebSocket.OPEN) return;

    // Normalize coin symbol for Hyperliquid (strip -USD, -PERP, -SPOT suffixes)
    const hlCoin = this.normalizeHyperliquidCoin(coin);

    const subscription: any = {
      method: "unsubscribe",
      subscription: {
        type,
        coin: hlCoin
      }
    };

    if (interval) {
      subscription.subscription.interval = interval;
    }

    this.hlWs.send(JSON.stringify(subscription));
    console.log(`[Market Data WS] Unsubscribed from Hyperliquid ${type}:${hlCoin}${interval ? `:${interval}` : ""} (from client coin: ${coin})`);
  }

  private handleClientDisconnect(ws: WebSocket) {
    const clientSubs = this.clients.get(ws);
    if (clientSubs) {
      // Remove client from all active subscriptions
      clientSubs.forEach((sub, key) => {
        const activeSub = this.activeSubscriptions.get(key);
        if (activeSub) {
          activeSub.delete(ws);
          if (activeSub.size === 0) {
            this.activeSubscriptions.delete(key);
            const parts = key.split(":");
            const type = parts[0];
            const coin = parts[1];
            const interval = parts[2]; // Will be undefined for non-candle subscriptions
            this.unsubscribeFromHyperliquid(type, coin, interval);
          }
        }
      });
    }
    this.clients.delete(ws);
  }

  private handleHyperliquidMessage(message: any) {
    const { channel, data } = message;

    if (!channel || !data) {
      console.log("[Market Data WS] Received message without channel or data:", JSON.stringify(message).substring(0, 200));
      return;
    }

    // Broadcast to subscribed clients
    if (channel === "trades") {
      this.broadcastTrades(data);
    } else if (channel === "l2Book") {
      console.log(`[Market Data WS] Broadcasting l2Book for ${data.coin}`);
      this.broadcastL2Book(data);
    } else if (channel === "candle") {
      this.broadcastCandle(data);
    }
  }

  private broadcastTrades(trade: HLTradeData) {
    // Hyperliquid sends coin without suffix (e.g., "BTC")
    // Try to match with possible client subscriptions (BTC-USD, BTC-PERP, BTC, etc.)
    const possibleKeys = [
      `trades:${trade.coin}`,
      `trades:${trade.coin}-USD`,
      `trades:${trade.coin}-PERP`,
      `trades:${trade.coin}-SPOT`,
    ];

    let sentToClients = false;
    for (const key of possibleKeys) {
      const clients = this.activeSubscriptions.get(key);
      if (clients) {
        const message = JSON.stringify({
          type: "trade",
          data: trade
        });

        clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            sentToClients = true;
          }
        });
      }
    }

    if (!sentToClients) {
      console.log(`[Market Data WS] No clients for trade ${trade.coin}, tried keys:`, possibleKeys);
    }
  }

  private broadcastL2Book(book: HLL2BookData) {
    // Hyperliquid sends coin without suffix (e.g., "BTC")
    // Try to match with possible client subscriptions (BTC-USD, BTC-PERP, BTC, etc.)
    const possibleKeys = [
      `l2Book:${book.coin}`,
      `l2Book:${book.coin}-USD`,
      `l2Book:${book.coin}-PERP`,
      `l2Book:${book.coin}-SPOT`,
    ];

    let sentToClients = false;
    for (const key of possibleKeys) {
      const clients = this.activeSubscriptions.get(key);
      if (clients) {
        const message = JSON.stringify({
          type: "orderBook",
          data: book
        });

        clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            sentToClients = true;
          }
        });
      }
    }

    if (!sentToClients) {
      console.log(`[Market Data WS] No clients for l2Book ${book.coin}, tried keys:`, possibleKeys);
    }
  }

  private broadcastCandle(candle: HLCandleData) {
    // Hyperliquid sends coin without suffix (e.g., "BTC")
    // Try to match with possible client subscriptions (BTC-USD, BTC-PERP, BTC, etc.)
    const possibleKeys = [
      `candle:${candle.s}:${candle.i}`,
      `candle:${candle.s}-USD:${candle.i}`,
      `candle:${candle.s}-PERP:${candle.i}`,
      `candle:${candle.s}-SPOT:${candle.i}`,
    ];

    let sentToClients = false;
    for (const key of possibleKeys) {
      const clients = this.activeSubscriptions.get(key);
      if (clients) {
        const message = JSON.stringify({
          type: "candle",
          data: candle
        });

        clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            sentToClients = true;
          }
        });
      }
    }

    if (!sentToClients) {
      console.log(`[Market Data WS] No clients for candle ${candle.s}:${candle.i}, tried keys:`, possibleKeys);
      console.log(`[Market Data WS] Active subscription keys:`, Array.from(this.activeSubscriptions.keys()));
    }
  }

  private resubscribeAll() {
    // Re-subscribe to all active subscriptions after reconnect
    this.activeSubscriptions.forEach((clients, key) => {
      const parts = key.split(":");
      const type = parts[0];
      const coin = parts[1];
      const interval = parts[2];

      this.subscribeToHyperliquid(type, coin, interval);
    });
  }

  public close() {
    if (this.hlWs) {
      this.hlWs.close();
      this.hlWs = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    console.log("[Market Data WS] Service stopped");
  }
}

let marketDataService: MarketDataWebSocketService | null = null;

export function initializeMarketDataWebSocket(server: Server) {
  if (!marketDataService) {
    marketDataService = new MarketDataWebSocketService(server);
    console.log("[Market Data WS] Service initialized");
  }
  return marketDataService;
}

export function getMarketDataWebSocket(): MarketDataWebSocketService | null {
  return marketDataService;
}
