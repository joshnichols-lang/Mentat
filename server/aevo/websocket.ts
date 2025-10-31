import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";

interface AevoTickerData {
  instrument_name: string;
  instrument_type: 'OPTION' | 'PERPETUAL';
  mark_price: string;
  index_price?: string;
  greeks?: {
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
    rho: string;
    iv?: string;
  };
  timestamp: number;
}

interface AevoOrderbookData {
  instrument_name: string;
  bids: [string, string][]; // [price, size]
  asks: [string, string][];
  timestamp: number;
}

interface AevoFillData {
  order_id: string;
  instrument_id: string;
  instrument_name: string;
  side: 'buy' | 'sell';
  price: string;
  amount: string;
  timestamp: number;
}

interface AevoOrderUpdate {
  order_id: string;
  instrument_id: string;
  status: 'open' | 'filled' | 'cancelled' | 'rejected';
  filled_amount: string;
  timestamp: number;
}

interface ClientSubscription {
  type: "ticker" | "orderbook" | "fills" | "orders";
  instruments: Set<string>;
}

export class AevoWebSocketService {
  private wss: WebSocketServer | null = null;
  private aevoWs: WebSocket | null = null;
  private clients = new Map<WebSocket, Map<string, ClientSubscription>>();
  private activeSubscriptions = new Map<string, Set<WebSocket>>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private apiKey?: string;
  private testnet: boolean;

  constructor(private server: Server, testnet: boolean = false, apiKey?: string) {
    this.testnet = testnet;
    this.apiKey = apiKey;
    this.initializeWebSocketServer();
  }

  private initializeWebSocketServer() {
    // Create WebSocket server WITHOUT automatic server binding
    // We'll manually handle upgrade events to avoid conflicts with Vite HMR
    this.wss = new WebSocketServer({ 
      noServer: true,
      perMessageDeflate: false
    });

    console.log("[Aevo WS] WebSocket server created on path: /aevo-market-data");

    // Manually handle upgrade requests for /aevo-market-data path only
    this.server.on("upgrade", (req, socket, head) => {
      console.log("[Aevo WS] Upgrade request for:", req.url);
      if (req.url === "/aevo-market-data") {
        console.log("[Aevo WS] Handling upgrade for /aevo-market-data");
        this.wss!.handleUpgrade(req, socket, head, (ws) => {
          this.wss!.emit("connection", ws, req);
        });
      }
      // Otherwise, let other handlers (Vite HMR, Market Data WS) handle it
    });

    this.wss.on("connection", (ws: WebSocket, req) => {
      console.log("[Aevo WS] Client connected from:", req.url, req.headers.origin);
      this.clients.set(ws, new Map());

      ws.on("message", (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error("[Aevo WS] Failed to parse client message:", error);
        }
      });

      ws.on("close", () => {
        console.log("[Aevo WS] Client disconnected");
        this.handleClientDisconnect(ws);
      });

      ws.on("error", (error) => {
        console.error("[Aevo WS] Client error:", error);
      });
    });

    this.wss.on("error", (error) => {
      console.error("[Aevo WS] Server error:", error);
    });

    // Connect to Aevo WebSocket
    this.connectToAevo();
  }

  private connectToAevo() {
    if (this.aevoWs) {
      this.aevoWs.close();
    }

    const wsUrl = this.testnet
      ? "wss://ws-testnet.aevo.xyz"
      : "wss://ws.aevo.xyz";
      
    console.log("[Aevo WS] Connecting to Aevo...");

    this.aevoWs = new WebSocket(wsUrl, {
      perMessageDeflate: false
    });

    this.aevoWs.on("open", () => {
      console.log("[Aevo WS] Connected to Aevo");
      
      // Authenticate if API key is provided (required for private channels)
      if (this.apiKey) {
        this.authenticate();
      }
      
      this.startHeartbeat();
      // Re-subscribe to all active subscriptions after reconnect
      this.resubscribeAll();
    });

    this.aevoWs.on("message", (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleAevoMessage(message);
      } catch (error) {
        console.error("[Aevo WS] Failed to parse Aevo message:", error);
      }
    });

    this.aevoWs.on("close", () => {
      console.log("[Aevo WS] Disconnected from Aevo");
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.aevoWs.on("error", (error) => {
      console.error("[Aevo WS] Aevo connection error:", error);
    });
  }

  private authenticate() {
    if (!this.aevoWs || this.aevoWs.readyState !== WebSocket.OPEN || !this.apiKey) {
      return;
    }

    // Aevo WebSocket authentication (if needed for private channels)
    // This would require HMAC signature similar to REST API
    // For now, we'll focus on public channels (ticker, orderbook)
    console.log("[Aevo WS] Authentication not implemented yet (public channels only)");
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.aevoWs && this.aevoWs.readyState === WebSocket.OPEN) {
        // Aevo uses ping/pong frames for keepalive
        this.aevoWs.ping();
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
      console.log("[Aevo WS] Attempting to reconnect to Aevo...");
      this.connectToAevo();
    }, 5000); // Reconnect after 5 seconds
  }

  private handleClientMessage(ws: WebSocket, message: any) {
    const { action, type, instrument, instruments } = message;

    if (action === "subscribe") {
      if (type === "ticker" && instrument) {
        this.subscribeClientToTicker(ws, instrument);
      } else if (type === "orderbook" && instrument) {
        this.subscribeClientToOrderbook(ws, instrument);
      } else if (type === "fills") {
        // Private channel - requires authentication
        this.subscribeClientToFills(ws);
      } else if (type === "orders") {
        // Private channel - requires authentication
        this.subscribeClientToOrders(ws);
      } else if (type === "index" && instrument) {
        // Index price subscription
        this.subscribeClientToIndex(ws, instrument);
      }
    } else if (action === "unsubscribe") {
      if (type && instrument) {
        this.unsubscribeClient(ws, type, instrument);
      }
    }
  }

  private subscribeClientToTicker(ws: WebSocket, instrumentName: string) {
    const key = `ticker:${instrumentName}`;
    
    // Add client to subscription
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;
    
    const sub = clientSubs.get("ticker") || { type: "ticker", instruments: new Set() };
    sub.instruments.add(instrumentName);
    clientSubs.set("ticker", sub);

    // Track active subscription
    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToAevoTicker(instrumentName);
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Aevo WS] Client subscribed to ticker: ${instrumentName}`);
  }

  private subscribeClientToOrderbook(ws: WebSocket, instrumentName: string) {
    const key = `orderbook:${instrumentName}`;
    
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;
    
    const sub = clientSubs.get("orderbook") || { type: "orderbook", instruments: new Set() };
    sub.instruments.add(instrumentName);
    clientSubs.set("orderbook", sub);

    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToAevoOrderbook(instrumentName);
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Aevo WS] Client subscribed to orderbook: ${instrumentName}`);
  }

  private subscribeClientToFills(ws: WebSocket) {
    const key = "fills";
    
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;
    
    clientSubs.set("fills", { type: "fills", instruments: new Set() });

    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToAevoFills();
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Aevo WS] Client subscribed to fills`);
  }

  private subscribeClientToOrders(ws: WebSocket) {
    const key = "orders";
    
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;
    
    clientSubs.set("orders", { type: "orders", instruments: new Set() });

    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToAevoOrders();
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Aevo WS] Client subscribed to orders`);
  }

  private subscribeClientToIndex(ws: WebSocket, asset: string) {
    const key = `index:${asset}`;
    
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;
    
    const sub = clientSubs.get("index") || { type: "ticker", instruments: new Set() };
    sub.instruments.add(asset);
    clientSubs.set("index", sub);

    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
      this.subscribeToAevoIndex(asset);
    }
    this.activeSubscriptions.get(key)!.add(ws);

    console.log(`[Aevo WS] Client subscribed to index: ${asset}`);
  }

  private unsubscribeClient(ws: WebSocket, type: string, instrument: string) {
    const key = `${type}:${instrument}`;
    const subscribers = this.activeSubscriptions.get(key);
    
    if (subscribers) {
      subscribers.delete(ws);
      
      if (subscribers.size === 0) {
        this.activeSubscriptions.delete(key);
        this.unsubscribeFromAevo(type, instrument);
      }
    }

    const clientSubs = this.clients.get(ws);
    if (clientSubs) {
      const sub = clientSubs.get(type);
      if (sub) {
        sub.instruments.delete(instrument);
        if (sub.instruments.size === 0) {
          clientSubs.delete(type);
        }
      }
    }

    console.log(`[Aevo WS] Client unsubscribed from ${type}: ${instrument}`);
  }

  private handleClientDisconnect(ws: WebSocket) {
    const clientSubs = this.clients.get(ws);
    
    if (clientSubs) {
      for (const [type, sub] of Array.from(clientSubs.entries())) {
        for (const instrument of Array.from(sub.instruments)) {
          this.unsubscribeClient(ws, type, instrument);
        }
      }
    }
    
    this.clients.delete(ws);
  }

  private subscribeToAevoTicker(instrumentName: string) {
    if (!this.aevoWs || this.aevoWs.readyState !== WebSocket.OPEN) {
      console.error("[Aevo WS] Cannot subscribe - not connected");
      return;
    }

    const subscribeMsg = {
      op: "subscribe",
      data: [`ticker:${instrumentName}`]
    };

    this.aevoWs.send(JSON.stringify(subscribeMsg));
    console.log(`[Aevo WS] Subscribed to Aevo ticker: ${instrumentName}`);
  }

  private subscribeToAevoOrderbook(instrumentName: string) {
    if (!this.aevoWs || this.aevoWs.readyState !== WebSocket.OPEN) {
      console.error("[Aevo WS] Cannot subscribe - not connected");
      return;
    }

    const subscribeMsg = {
      op: "subscribe",
      data: [`orderbook:${instrumentName}`]
    };

    this.aevoWs.send(JSON.stringify(subscribeMsg));
    console.log(`[Aevo WS] Subscribed to Aevo orderbook: ${instrumentName}`);
  }

  private subscribeToAevoFills() {
    if (!this.aevoWs || this.aevoWs.readyState !== WebSocket.OPEN) {
      console.error("[Aevo WS] Cannot subscribe - not connected");
      return;
    }

    const subscribeMsg = {
      op: "subscribe",
      data: ["fills"]
    };

    this.aevoWs.send(JSON.stringify(subscribeMsg));
    console.log(`[Aevo WS] Subscribed to Aevo fills`);
  }

  private subscribeToAevoOrders() {
    if (!this.aevoWs || this.aevoWs.readyState !== WebSocket.OPEN) {
      console.error("[Aevo WS] Cannot subscribe - not connected");
      return;
    }

    const subscribeMsg = {
      op: "subscribe",
      data: ["orders"]
    };

    this.aevoWs.send(JSON.stringify(subscribeMsg));
    console.log(`[Aevo WS] Subscribed to Aevo orders`);
  }

  private subscribeToAevoIndex(asset: string) {
    if (!this.aevoWs || this.aevoWs.readyState !== WebSocket.OPEN) {
      console.error("[Aevo WS] Cannot subscribe - not connected");
      return;
    }

    const subscribeMsg = {
      op: "subscribe",
      data: [`index:${asset}`]
    };

    this.aevoWs.send(JSON.stringify(subscribeMsg));
    console.log(`[Aevo WS] Subscribed to Aevo index: ${asset}`);
  }

  private unsubscribeFromAevo(type: string, instrument: string) {
    if (!this.aevoWs || this.aevoWs.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMsg = {
      op: "unsubscribe",
      data: [`${type}:${instrument}`]
    };

    this.aevoWs.send(JSON.stringify(unsubscribeMsg));
    console.log(`[Aevo WS] Unsubscribed from Aevo ${type}: ${instrument}`);
  }

  private handleAevoMessage(message: any) {
    // Aevo WebSocket message format varies by channel
    const { channel, data } = message;

    if (!channel || !data) {
      return;
    }

    // Parse channel name (e.g., "ticker:ETH-31MAR25-2000-C")
    const [channelType, ...instrumentParts] = channel.split(':');
    const instrumentName = instrumentParts.join(':');

    switch (channelType) {
      case 'ticker':
        this.broadcastToSubscribers(`ticker:${instrumentName}`, {
          type: 'ticker',
          data: data,
        });
        break;
      
      case 'orderbook':
        this.broadcastToSubscribers(`orderbook:${instrumentName}`, {
          type: 'orderbook',
          data: data,
        });
        break;
      
      case 'fills':
        this.broadcastToSubscribers('fills', {
          type: 'fills',
          data: data,
        });
        break;
      
      case 'orders':
        this.broadcastToSubscribers('orders', {
          type: 'orders',
          data: data,
        });
        break;

      case 'index':
        this.broadcastToSubscribers(`index:${instrumentName}`, {
          type: 'index',
          data: data,
        });
        break;

      default:
        console.log(`[Aevo WS] Unknown channel type: ${channelType}`);
    }
  }

  private broadcastToSubscribers(key: string, message: any) {
    const subscribers = this.activeSubscriptions.get(key);
    
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const messageStr = JSON.stringify(message);
    
    for (const client of Array.from(subscribers)) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  private resubscribeAll() {
    // Re-subscribe to all active subscriptions after reconnect
    for (const key of Array.from(this.activeSubscriptions.keys())) {
      const [type, instrument] = key.split(':');
      
      switch (type) {
        case 'ticker':
          this.subscribeToAevoTicker(instrument);
          break;
        case 'orderbook':
          this.subscribeToAevoOrderbook(instrument);
          break;
        case 'fills':
          this.subscribeToAevoFills();
          break;
        case 'orders':
          this.subscribeToAevoOrders();
          break;
        case 'index':
          this.subscribeToAevoIndex(instrument);
          break;
      }
    }
  }

  public cleanup() {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.aevoWs) {
      this.aevoWs.close();
    }

    if (this.wss) {
      this.wss.close();
    }

    console.log("[Aevo WS] Service cleaned up");
  }
}
