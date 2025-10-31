import WebSocket from "ws";

interface Trade {
  coin: string;
  side: "A" | "B";
  px: string;
  sz: string;
  time: number;
}

interface Candle {
  t: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  n: number; // number of trades
}

interface PriceLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

interface VolumeProfile {
  coin: string;
  priceLevels: Map<number, PriceLevel>;
  minPrice: number;
  maxPrice: number;
  totalVolume: number;
  pointOfControl: number; // Price level with highest volume
}

interface VolumeProfileSnapshot {
  coin: string;
  levels: PriceLevel[];
  minPrice: number;
  maxPrice: number;
  totalVolume: number;
  pointOfControl: number;
}

export class VolumeProfileCalculator {
  private profiles = new Map<string, VolumeProfile>();
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribedCoins = new Set<string>();
  private priceTickSize = 0.1; // Price bucket size for aggregation

  constructor(private marketDataWsUrl: string, private tickSize: number = 0.1) {
    this.priceTickSize = tickSize;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.marketDataWsUrl, {
      perMessageDeflate: false
    });

    this.ws.on("open", () => {
      console.log("[Volume Profile] Connected to market data WebSocket");
      this.subscribedCoins.forEach(coin => this.subscribeToCoin(coin));
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error("[Volume Profile] Error parsing message:", error);
      }
    });

    this.ws.on("close", () => {
      console.log("[Volume Profile] Disconnected, reconnecting in 5s...");
      this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on("error", (error) => {
      console.error("[Volume Profile] WebSocket error:", error);
    });
  }

  private handleMessage(message: any) {
    const { channel, data } = message;

    if (channel?.startsWith("trades")) {
      const trades = data as Trade[];
      trades.forEach(trade => this.processTrade(trade));
    } else if (channel?.startsWith("candle")) {
      // Extract coin from channel (format: "candle@BTC@1m")
      const parts = channel.split("@");
      if (parts.length >= 2) {
        const coin = parts[1];
        const candles = Array.isArray(data) ? data : [data];
        candles.forEach(candle => this.processCandle(coin, candle));
      }
    }
  }

  private processTrade(trade: Trade) {
    // Normalize coin to base (remove -SPOT and -PERP suffixes)
    const baseCoin = trade.coin.replace("-SPOT", "").replace("-PERP", "");
    const size = parseFloat(trade.sz);
    const price = parseFloat(trade.px);

    // Round price to tick size for bucketing
    const bucketPrice = Math.round(price / this.priceTickSize) * this.priceTickSize;

    // Get or create profile
    let profile = this.profiles.get(baseCoin);
    if (!profile) {
      profile = {
        coin: baseCoin,
        priceLevels: new Map(),
        minPrice: bucketPrice,
        maxPrice: bucketPrice,
        totalVolume: 0,
        pointOfControl: bucketPrice
      };
      this.profiles.set(baseCoin, profile);
    }

    // Update price level
    let level = profile.priceLevels.get(bucketPrice);
    if (!level) {
      level = {
        price: bucketPrice,
        volume: 0,
        buyVolume: 0,
        sellVolume: 0
      };
      profile.priceLevels.set(bucketPrice, level);
    }

    const isBuy = trade.side === "B";
    level.volume += size;
    if (isBuy) {
      level.buyVolume += size;
    } else {
      level.sellVolume += size;
    }

    // Update profile stats
    profile.totalVolume += size;
    profile.minPrice = Math.min(profile.minPrice, bucketPrice);
    profile.maxPrice = Math.max(profile.maxPrice, bucketPrice);

    // Update point of control (price with highest volume)
    let maxVolume = 0;
    profile.priceLevels.forEach((lvl, price) => {
      if (lvl.volume > maxVolume) {
        maxVolume = lvl.volume;
        profile.pointOfControl = price;
      }
    });
  }

  private processCandle(coin: string, candle: Candle) {
    // Normalize coin to base (remove -SPOT and -PERP suffixes)
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    const volume = candle.v;
    
    // Distribute candle volume across OHLC prices
    // Use weighted distribution based on typical volume at each level
    const prices = [candle.o, candle.h, candle.l, candle.c];
    const volumePerPrice = volume / 4; // Simple distribution

    prices.forEach(price => {
      const bucketPrice = Math.round(price / this.priceTickSize) * this.priceTickSize;

      // Get or create profile
      let profile = this.profiles.get(baseCoin);
      if (!profile) {
        profile = {
          coin: baseCoin,
          priceLevels: new Map(),
          minPrice: bucketPrice,
          maxPrice: bucketPrice,
          totalVolume: 0,
          pointOfControl: bucketPrice
        };
        this.profiles.set(baseCoin, profile);
      }

      // Update price level
      let level = profile.priceLevels.get(bucketPrice);
      if (!level) {
        level = {
          price: bucketPrice,
          volume: 0,
          buyVolume: 0,
          sellVolume: 0
        };
        profile.priceLevels.set(bucketPrice, level);
      }

      // Add candle volume (no buy/sell distinction for candles)
      level.volume += volumePerPrice;

      // Update profile stats
      profile.totalVolume += volumePerPrice;
      profile.minPrice = Math.min(profile.minPrice, bucketPrice);
      profile.maxPrice = Math.max(profile.maxPrice, bucketPrice);
    });

    // Update point of control for the profile
    const profile = this.profiles.get(baseCoin);
    if (profile) {
      let maxVolume = 0;
      profile.priceLevels.forEach((lvl, price) => {
        if (lvl.volume > maxVolume) {
          maxVolume = lvl.volume;
          profile.pointOfControl = price;
        }
      });
    }
  }

  subscribeToCoin(coin: string) {
    // Normalize input to base coin FIRST (remove -SPOT, -PERP suffixes)
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`[Volume Profile] WebSocket not ready, queuing subscription for ${baseCoin}`);
      this.subscribedCoins.add(baseCoin);
      return;
    }

    this.subscribedCoins.add(baseCoin);

    // Subscribe to both spot and perp trades AND candles for the base coin
    const perpCoin = baseCoin;
    const spotCoin = `${baseCoin}-SPOT`;

    // Subscribe to trades
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

    // Subscribe to 1-hour candles for historical volume profile data
    this.ws.send(JSON.stringify({
      action: "subscribe",
      type: "candle",
      coin: perpCoin,
      interval: "1h"
    }));

    this.ws.send(JSON.stringify({
      action: "subscribe",
      type: "candle",
      coin: spotCoin,
      interval: "1h"
    }));

    console.log(`[Volume Profile] Subscribed to ${perpCoin} and ${spotCoin} trades + 1h candles (tick size: ${this.priceTickSize})`);
  }

  unsubscribeFromCoin(coin: string) {
    // Normalize input to base coin FIRST
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    
    // Remove from subscribed set BEFORE checking WebSocket readiness
    // This prevents reconnect from resubscribing
    this.subscribedCoins.delete(baseCoin);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`[Volume Profile] WebSocket not ready, queued unsubscription from ${baseCoin}`);
      return;
    }

    const perpCoin = baseCoin;
    const spotCoin = `${baseCoin}-SPOT`;

    // Unsubscribe from trades
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

    // Unsubscribe from candles
    this.ws.send(JSON.stringify({
      action: "unsubscribe",
      type: "candle",
      coin: perpCoin,
      interval: "1h"
    }));

    this.ws.send(JSON.stringify({
      action: "unsubscribe",
      type: "candle",
      coin: spotCoin,
      interval: "1h"
    }));

    console.log(`[Volume Profile] Unsubscribed from ${perpCoin} and ${spotCoin} trades + candles`);
  }

  getVolumeProfile(coin: string): VolumeProfileSnapshot {
    // Normalize input coin to base for lookup (remove -SPOT, -PERP suffixes)
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    const profile = this.profiles.get(baseCoin);
    
    // Return empty profile if none exists yet
    if (!profile) {
      return {
        coin: baseCoin,
        levels: [],
        minPrice: 0,
        maxPrice: 0,
        totalVolume: 0,
        pointOfControl: 0
      };
    }

    // Convert Map to sorted array
    const levels = Array.from(profile.priceLevels.values())
      .sort((a, b) => b.price - a.price); // Sort descending by price

    return {
      coin: profile.coin,
      levels,
      minPrice: profile.minPrice,
      maxPrice: profile.maxPrice,
      totalVolume: profile.totalVolume,
      pointOfControl: profile.pointOfControl
    };
  }

  resetProfile(coin: string) {
    // Normalize input to base coin
    const baseCoin = coin.replace("-SPOT", "").replace("-PERP", "");
    this.profiles.delete(baseCoin);
    console.log(`[Volume Profile] Reset profile for ${baseCoin}`);
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
