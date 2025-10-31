import WebSocket from "ws";

interface Trade {
  coin: string;
  side: "A" | "B"; // A = Ask (sell), B = Bid (buy)
  px: string; // price
  sz: string; // size
  time: number; // timestamp in ms
}

interface CVDData {
  coin: string; // Base coin (e.g., "BTC")
  timestamp: number;
  cumulativeDelta: number;
  buyVolume: number;
  sellVolume: number;
  lastPrice: number;
}

interface CVDSnapshot {
  coin: string;
  data: CVDData[];
  currentDelta: number;
}

export class CVDCalculator {
  private cvdData = new Map<string, CVDData[]>(); // coin -> historical CVD data
  private currentDelta = new Map<string, number>(); // coin -> current cumulative delta
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribedCoins = new Set<string>();

  constructor(private marketDataWsUrl: string) {
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.marketDataWsUrl, {
      perMessageDeflate: false
    });

    this.ws.on("open", () => {
      console.log("[CVD Calculator] Connected to market data WebSocket");
      // Resubscribe to all coins
      this.subscribedCoins.forEach(coin => this.subscribeToCoin(coin));
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error("[CVD Calculator] Error parsing message:", error);
      }
    });

    this.ws.on("close", () => {
      console.log("[CVD Calculator] Disconnected, reconnecting in 5s...");
      this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on("error", (error) => {
      console.error("[CVD Calculator] WebSocket error:", error);
    });
  }

  private handleMessage(message: any) {
    const { channel, data } = message;

    if (channel?.startsWith("trades")) {
      const trades = data as Trade[];
      trades.forEach(trade => this.processTrade(trade));
    }
  }

  private processTrade(trade: Trade) {
    // Normalize coin to base (remove -SPOT suffix for aggregation)
    const baseCoin = trade.coin.replace("-SPOT", "");
    const size = parseFloat(trade.sz);
    const price = parseFloat(trade.px);

    // A = Ask (seller hit bid = sell pressure)
    // B = Bid (buyer hit ask = buy pressure)
    const isBuy = trade.side === "B";
    const delta = isBuy ? size : -size;

    // Update cumulative delta for the base coin (aggregates spot + perp)
    const currentDelta = this.currentDelta.get(baseCoin) || 0;
    const newDelta = currentDelta + delta;
    this.currentDelta.set(baseCoin, newDelta);

    // Create CVD data point with base coin
    const cvdPoint: CVDData = {
      coin: baseCoin,
      timestamp: trade.time,
      cumulativeDelta: newDelta,
      buyVolume: isBuy ? size : 0,
      sellVolume: isBuy ? 0 : size,
      lastPrice: price
    };

    // Store historical data (limit to last 1000 points per coin)
    const history = this.cvdData.get(baseCoin) || [];
    history.push(cvdPoint);
    
    // Sort by timestamp to maintain chronological order when merging spot/perp
    history.sort((a, b) => a.timestamp - b.timestamp);
    
    if (history.length > 1000) {
      history.shift();
    }
    this.cvdData.set(baseCoin, history);
  }

  subscribeToCoin(coin: string) {
    // Normalize input to base coin FIRST (remove -SPOT, -PERP suffixes)
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`[CVD Calculator] WebSocket not ready, queuing subscription for ${baseCoin}`);
      this.subscribedCoins.add(baseCoin);
      return;
    }

    this.subscribedCoins.add(baseCoin);

    // Subscribe to both spot and perp trades for aggregation
    const perpCoin = baseCoin;
    const spotCoin = `${baseCoin}-SPOT`;

    this.ws.send(JSON.stringify({
      action: "subscribe",
      type: "trades",
      coin: perpCoin
    }));

    this.ws.send(JSON.stringify({
      action: "subscribe",
      type: "trades",
      coin: spotCoin
    }));

    console.log(`[CVD Calculator] Subscribed to ${perpCoin} and ${spotCoin} trades (aggregating into ${coin} CVD)`);
  }

  unsubscribeFromCoin(coin: string) {
    // Normalize input to base coin FIRST
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    
    // Remove from subscribed set BEFORE checking WebSocket readiness
    // This prevents reconnect from resubscribing
    this.subscribedCoins.delete(baseCoin);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`[CVD Calculator] WebSocket not ready, queued unsubscription from ${baseCoin}`);
      return;
    }

    const perpCoin = baseCoin;
    const spotCoin = `${baseCoin}-SPOT`;

    this.ws.send(JSON.stringify({
      action: "unsubscribe",
      type: "trades",
      coin: perpCoin
    }));

    this.ws.send(JSON.stringify({
      action: "unsubscribe",
      type: "trades",
      coin: spotCoin
    }));

    console.log(`[CVD Calculator] Unsubscribed from ${perpCoin} and ${spotCoin} trades`);
  }

  getCVDSnapshot(coin: string): CVDSnapshot {
    // Normalize input to base coin for lookup
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    return {
      coin: baseCoin,
      data: this.cvdData.get(baseCoin) || [],
      currentDelta: this.currentDelta.get(baseCoin) || 0
    };
  }

  resetCVD(coin: string) {
    // Normalize input to base coin
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    this.currentDelta.set(baseCoin, 0);
    this.cvdData.set(baseCoin, []);
    console.log(`[CVD Calculator] Reset CVD for ${baseCoin}`);
  }

  cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}
