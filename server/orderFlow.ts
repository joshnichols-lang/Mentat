/**
 * Order Flow Analysis Library
 * 
 * Provides calculations for order flow metrics including bid/ask imbalance,
 * delta, and cumulative volume delta (CVD).
 */

export interface OrderBookLevel {
  price: number;
  bidSize: number;
  askSize: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface Trade {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

/**
 * Calculate bid/ask imbalance at specific price level
 */
export function calculateImbalanceAtLevel(level: OrderBookLevel): {
  ratio: number;
  imbalance: 'bid' | 'ask' | 'balanced';
  strength: number;
} {
  const totalVolume = level.bidSize + level.askSize;
  if (totalVolume === 0) {
    return { ratio: 1, imbalance: 'balanced', strength: 0 };
  }
  
  const ratio = level.askSize > 0 ? level.bidSize / level.askSize : Infinity;
  const strength = Math.abs(level.bidSize - level.askSize);
  
  let imbalance: 'bid' | 'ask' | 'balanced' = 'balanced';
  if (ratio > 1.5) {
    imbalance = 'bid';
  } else if (ratio < 0.67) {
    imbalance = 'ask';
  }
  
  return { ratio, imbalance, strength };
}

/**
 * Find significant imbalances in the order book
 */
export function findSignificantImbalances(
  orderBook: OrderBookSnapshot,
  minRatio: number = 3.0,
  minVolume: number = 1000
): Array<{
  price: number;
  bidSize: number;
  askSize: number;
  ratio: number;
  imbalance: 'bid' | 'ask';
  description: string;
}> {
  const imbalances: Array<{
    price: number;
    bidSize: number;
    askSize: number;
    ratio: number;
    imbalance: 'bid' | 'ask';
    description: string;
  }> = [];
  
  // Combine all price levels
  const allLevels = new Map<number, { bidSize: number; askSize: number }>();
  
  orderBook.bids.forEach(level => {
    allLevels.set(level.price, {
      bidSize: level.bidSize,
      askSize: allLevels.get(level.price)?.askSize || 0
    });
  });
  
  orderBook.asks.forEach(level => {
    const existing = allLevels.get(level.price);
    allLevels.set(level.price, {
      bidSize: existing?.bidSize || 0,
      askSize: level.askSize
    });
  });
  
  // Find imbalances
  for (const [price, { bidSize, askSize }] of allLevels.entries()) {
    const totalVolume = bidSize + askSize;
    if (totalVolume < minVolume) continue;
    
    // Bid imbalance
    if (askSize > 0 && bidSize / askSize >= minRatio) {
      imbalances.push({
        price,
        bidSize,
        askSize,
        ratio: bidSize / askSize,
        imbalance: 'bid',
        description: `Bid imbalance ${(bidSize / askSize).toFixed(1)}x at $${price} (${bidSize.toLocaleString()} vs ${askSize.toLocaleString()})`
      });
    }
    // Ask imbalance
    else if (bidSize > 0 && askSize / bidSize >= minRatio) {
      imbalances.push({
        price,
        bidSize,
        askSize,
        ratio: askSize / bidSize,
        imbalance: 'ask',
        description: `Ask imbalance ${(askSize / bidSize).toFixed(1)}x at $${price} (${askSize.toLocaleString()} vs ${bidSize.toLocaleString()})`
      });
    }
  }
  
  // Sort by ratio strength
  return imbalances.sort((a, b) => b.ratio - a.ratio);
}

/**
 * Calculate delta (buy volume - sell volume) from trades
 */
export function calculateDelta(trades: Trade[]): {
  delta: number;
  buyVolume: number;
  sellVolume: number;
  deltaPercent: number;
} {
  let buyVolume = 0;
  let sellVolume = 0;
  
  for (const trade of trades) {
    if (trade.side === 'buy') {
      buyVolume += trade.size;
    } else {
      sellVolume += trade.size;
    }
  }
  
  const delta = buyVolume - sellVolume;
  const totalVolume = buyVolume + sellVolume;
  const deltaPercent = totalVolume > 0 ? (delta / totalVolume) * 100 : 0;
  
  return {
    delta,
    buyVolume,
    sellVolume,
    deltaPercent
  };
}

/**
 * Calculate Cumulative Volume Delta (CVD) from trades
 */
export function calculateCVD(trades: Trade[]): {
  cvd: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
}[] {
  const cvdData: {
    cvd: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number;
  }[] = [];
  
  let cumulativeDelta = 0;
  let previousCVD = 0;
  
  for (const trade of trades) {
    const volume = trade.side === 'buy' ? trade.size : -trade.size;
    cumulativeDelta += volume;
    
    const change = cumulativeDelta - previousCVD;
    const trend: 'bullish' | 'bearish' | 'neutral' = 
      change > 0 ? 'bullish' : change < 0 ? 'bearish' : 'neutral';
    
    cvdData.push({
      cvd: cumulativeDelta,
      trend,
      strength: Math.abs(change)
    });
    
    previousCVD = cumulativeDelta;
  }
  
  return cvdData;
}

/**
 * Analyze order book depth and absorption
 */
export function analyzeOrderBookDepth(orderBook: OrderBookSnapshot, levels: number = 10): {
  bidDepth: number;
  askDepth: number;
  depthRatio: number;
  imbalance: 'bid' | 'ask' | 'balanced';
  description: string;
} {
  const topBids = orderBook.bids.slice(0, levels);
  const topAsks = orderBook.asks.slice(0, levels);
  
  const bidDepth = topBids.reduce((sum, level) => sum + level.bidSize, 0);
  const askDepth = topAsks.reduce((sum, level) => sum + level.askSize, 0);
  
  const depthRatio = askDepth > 0 ? bidDepth / askDepth : Infinity;
  
  let imbalance: 'bid' | 'ask' | 'balanced' = 'balanced';
  if (depthRatio > 1.3) {
    imbalance = 'bid';
  } else if (depthRatio < 0.77) {
    imbalance = 'ask';
  }
  
  const description = `Order book ${imbalance} heavy - Bid depth: ${bidDepth.toFixed(2)}, Ask depth: ${askDepth.toFixed(2)}, Ratio: ${depthRatio.toFixed(2)}`;
  
  return {
    bidDepth,
    askDepth,
    depthRatio,
    imbalance,
    description
  };
}

/**
 * Detect absorption zones (large liquidity walls)
 */
export function detectAbsorptionZones(
  orderBook: OrderBookSnapshot,
  minSize: number = 10000
): Array<{
  price: number;
  size: number;
  side: 'bid' | 'ask';
  description: string;
}> {
  const zones: Array<{
    price: number;
    size: number;
    side: 'bid' | 'ask';
    description: string;
  }> = [];
  
  // Find large bid walls
  for (const level of orderBook.bids) {
    if (level.bidSize >= minSize) {
      zones.push({
        price: level.price,
        size: level.bidSize,
        side: 'bid',
        description: `Large bid wall at $${level.price}: ${level.bidSize.toLocaleString()} (potential support)`
      });
    }
  }
  
  // Find large ask walls
  for (const level of orderBook.asks) {
    if (level.askSize >= minSize) {
      zones.push({
        price: level.price,
        size: level.askSize,
        side: 'ask',
        description: `Large ask wall at $${level.price}: ${level.askSize.toLocaleString()} (potential resistance)`
      });
    }
  }
  
  return zones.sort((a, b) => b.size - a.size);
}

/**
 * Evaluate order flow signals for strategy triggers
 */
export interface OrderFlowSignal {
  type: string;
  condition: string;
  value: number;
  triggered: boolean;
  description: string;
}

export function evaluateOrderFlowSignals(
  orderBook: OrderBookSnapshot,
  trades: Trade[],
  config: {
    imbalanceRatio?: number;
    minImbalanceVolume?: number;
    deltaThreshold?: number;
    depthImbalanceRatio?: number;
  }
): OrderFlowSignal[] {
  const signals: OrderFlowSignal[] = [];
  
  // Imbalance detection
  if (config.imbalanceRatio && config.minImbalanceVolume) {
    const imbalances = findSignificantImbalances(
      orderBook,
      config.imbalanceRatio,
      config.minImbalanceVolume
    );
    
    if (imbalances.length > 0) {
      const strongest = imbalances[0];
      signals.push({
        type: 'imbalance',
        condition: `${strongest.imbalance}_imbalance`,
        value: strongest.ratio,
        triggered: true,
        description: strongest.description
      });
    }
  }
  
  // Delta analysis
  if (config.deltaThreshold && trades.length > 0) {
    const delta = calculateDelta(trades);
    
    if (Math.abs(delta.deltaPercent) >= config.deltaThreshold) {
      signals.push({
        type: 'delta',
        condition: delta.delta > 0 ? 'positive_delta' : 'negative_delta',
        value: delta.deltaPercent,
        triggered: true,
        description: `Strong ${delta.delta > 0 ? 'buying' : 'selling'} pressure - Delta: ${delta.deltaPercent.toFixed(1)}%`
      });
    }
  }
  
  // Depth imbalance
  if (config.depthImbalanceRatio) {
    const depth = analyzeOrderBookDepth(orderBook, 10);
    
    if (depth.depthRatio >= config.depthImbalanceRatio || depth.depthRatio <= (1 / config.depthImbalanceRatio)) {
      signals.push({
        type: 'depth',
        condition: `${depth.imbalance}_depth`,
        value: depth.depthRatio,
        triggered: true,
        description: depth.description
      });
    }
  }
  
  return signals;
}
