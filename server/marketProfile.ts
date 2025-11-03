/**
 * Market Profile / TPO (Time Price Opportunity) Analysis Library
 * 
 * Provides calculations for Market Profile metrics including Value Area,
 * Point of Control, and TPO distribution.
 */

import type { Candle } from './indicators';

export interface TPOEntry {
  price: number;
  count: number;
  periods: string[]; // Letters representing time periods (A, B, C, etc.)
}

export interface ValueArea {
  high: number;
  low: number;
  poc: number; // Point of Control (price with most volume/time)
  coverage: number; // Percentage of volume in value area (typically 70%)
}

export interface MarketProfile {
  date: string;
  tpoDistribution: TPOEntry[];
  valueArea: ValueArea;
  initial Balance: {
    high: number;
    low: number;
  };
  profile Type: 'normal' | 'p_shaped' | 'b_shaped' | 'double_distribution';
}

/**
 * Build TPO distribution from candles
 * Each time period gets a letter (A, B, C, etc.)
 */
export function buildTPODistribution(
  candles: Candle[],
  tickSize: number = 1
): TPOEntry[] {
  const tpoMap = new Map<number, Set<string>>();
  
  // Assign letter to each period
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  candles.forEach((candle, index) => {
    const period = letters[index % 26];
    
    // Get price range for this period
    const low = Math.floor(candle.low / tickSize) * tickSize;
    const high = Math.ceil(candle.high / tickSize) * tickSize;
    
    // Add TPO for each price level touched
    for (let price = low; price <= high; price += tickSize) {
      if (!tpoMap.has(price)) {
        tpoMap.set(price, new Set());
      }
      tpoMap.get(price)!.add(period);
    }
  });
  
  // Convert to array and sort by price
  const distribution: TPOEntry[] = [];
  for (const [price, periods] of tpoMap.entries()) {
    distribution.push({
      price,
      count: periods.size,
      periods: Array.from(periods).sort()
    });
  }
  
  return distribution.sort((a, b) => b.price - a.price);
}

/**
 * Calculate Value Area (typically 70% of TPO volume)
 */
export function calculateValueArea(
  tpoDistribution: TPOEntry[],
  coveragePercent: number = 70
): ValueArea {
  if (tpoDistribution.length === 0) {
    return {
      high: 0,
      low: 0,
      poc: 0,
      coverage: 0
    };
  }
  
  // Find Point of Control (price with most TPOs)
  const poc = tpoDistribution.reduce((max, current) => 
    current.count > max.count ? current : max
  );
  
  // Calculate total TPO count
  const totalTPO = tpoDistribution.reduce((sum, entry) => sum + entry.count, 0);
  const targetTPO = (totalTPO * coveragePercent) / 100;
  
  // Find POC index
  const pocIndex = tpoDistribution.findIndex(entry => entry.price === poc.price);
  
  // Expand from POC until we reach target coverage
  let currentTPO = poc.count;
  let highIndex = pocIndex;
  let lowIndex = pocIndex;
  
  while (currentTPO < targetTPO && (highIndex > 0 || lowIndex < tpoDistribution.length - 1)) {
    const addHigh = highIndex > 0 ? tpoDistribution[highIndex - 1].count : 0;
    const addLow = lowIndex < tpoDistribution.length - 1 ? tpoDistribution[lowIndex + 1].count : 0;
    
    if (addHigh >= addLow && highIndex > 0) {
      currentTPO += addHigh;
      highIndex--;
    } else if (lowIndex < tpoDistribution.length - 1) {
      currentTPO += addLow;
      lowIndex++;
    } else if (highIndex > 0) {
      currentTPO += addHigh;
      highIndex--;
    } else {
      break;
    }
  }
  
  return {
    high: tpoDistribution[highIndex].price,
    low: tpoDistribution[lowIndex].price,
    poc: poc.price,
    coverage: (currentTPO / totalTPO) * 100
  };
}

/**
 * Calculate Initial Balance (first hour/2 periods of trading)
 */
export function calculateInitialBalance(candles: Candle[], periods: number = 2): {
  high: number;
  low: number;
} {
  if (candles.length < periods) {
    return {
      high: candles[candles.length - 1]?.high || 0,
      low: candles[candles.length - 1]?.low || 0
    };
  }
  
  const ibCandles = candles.slice(0, periods);
  const high = Math.max(...ibCandles.map(c => c.high));
  const low = Math.min(...ibCandles.map(c => c.low));
  
  return { high, low };
}

/**
 * Identify profile type based on TPO distribution
 */
export function identifyProfileType(
  tpoDistribution: TPOEntry[],
  valueArea: ValueArea
): 'normal' | 'p_shaped' | 'b_shaped' | 'double_distribution' {
  if (tpoDistribution.length < 3) return 'normal';
  
  // Get quartiles
  const sortedByPrice = [...tpoDistribution].sort((a, b) => b.price - a.price);
  const q1Index = Math.floor(sortedByPrice.length * 0.25);
  const q3Index = Math.floor(sortedByPrice.length * 0.75);
  
  const topQuartile = sortedByPrice.slice(0, q1Index);
  const bottomQuartile = sortedByPrice.slice(q3Index);
  
  const topVolume = topQuartile.reduce((sum, e) => sum + e.count, 0);
  const bottomVolume = bottomQuartile.reduce((sum, e) => sum + e.count, 0);
  
  // P-shaped: Volume concentrated at top
  if (topVolume > bottomVolume * 1.5) {
    return 'p_shaped';
  }
  
  // B-shaped: Volume concentrated at bottom
  if (bottomVolume > topVolume * 1.5) {
    return 'b_shaped';
  }
  
  // Double distribution: Two distinct volume peaks
  const peaks = findVolumePeaks(tpoDistribution);
  if (peaks.length >= 2) {
    const gap = Math.abs(peaks[0].price - peaks[1].price);
    const range = sortedByPrice[0].price - sortedByPrice[sortedByPrice.length - 1].price;
    
    if (gap > range * 0.3) {
      return 'double_distribution';
    }
  }
  
  return 'normal';
}

/**
 * Find volume peaks in TPO distribution
 */
function findVolumePeaks(tpoDistribution: TPOEntry[]): TPOEntry[] {
  if (tpoDistribution.length < 3) return tpoDistribution;
  
  const peaks: TPOEntry[] = [];
  
  for (let i = 1; i < tpoDistribution.length - 1; i++) {
    const current = tpoDistribution[i];
    const prev = tpoDistribution[i - 1];
    const next = tpoDistribution[i + 1];
    
    // Local maximum
    if (current.count > prev.count && current.count > next.count) {
      peaks.push(current);
    }
  }
  
  return peaks.sort((a, b) => b.count - a.count);
}

/**
 * Build complete Market Profile from candles
 */
export function buildMarketProfile(
  candles: Candle[],
  tickSize: number = 1,
  date?: string
): MarketProfile {
  const tpoDistribution = buildTPODistribution(candles, tickSize);
  const valueArea = calculateValueArea(tpoDistribution, 70);
  const initialBalance = calculateInitialBalance(candles, 2);
  const profileType = identifyProfileType(tpoDistribution, valueArea);
  
  return {
    date: date || new Date().toISOString().split('T')[0],
    tpoDistribution,
    valueArea,
    initialBalance,
    profileType
  };
}

/**
 * Evaluate Market Profile signals for strategy triggers
 */
export interface MarketProfileSignal {
  type: string;
  condition: string;
  value: number;
  triggered: boolean;
  description: string;
}

export function evaluateMarketProfileSignals(
  currentPrice: number,
  marketProfile: MarketProfile,
  config: {
    detectVABreakouts?: boolean;
    detectIBBreakouts?: boolean;
    detectPOCTests?: boolean;
    pocTolerance?: number; // Price distance to POC to trigger
  }
): MarketProfileSignal[] {
  const signals: MarketProfileSignal[] = [];
  
  // Value Area breakout detection
  if (config.detectVABreakouts) {
    if (currentPrice > marketProfile.valueArea.high) {
      signals.push({
        type: 'value_area',
        condition: 'breakout_above_vah',
        value: currentPrice,
        triggered: true,
        description: `Price (${currentPrice}) broke above Value Area High (${marketProfile.valueArea.high})`
      });
    } else if (currentPrice < marketProfile.valueArea.low) {
      signals.push({
        type: 'value_area',
        condition: 'breakout_below_val',
        value: currentPrice,
        triggered: true,
        description: `Price (${currentPrice}) broke below Value Area Low (${marketProfile.valueArea.low})`
      });
    }
  }
  
  // Initial Balance breakout detection
  if (config.detectIBBreakouts) {
    if (currentPrice > marketProfile.initialBalance.high) {
      signals.push({
        type: 'initial_balance',
        condition: 'breakout_above_ib',
        value: currentPrice,
        triggered: true,
        description: `Price (${currentPrice}) broke above Initial Balance High (${marketProfile.initialBalance.high})`
      });
    } else if (currentPrice < marketProfile.initialBalance.low) {
      signals.push({
        type: 'initial_balance',
        condition: 'breakout_below_ib',
        value: currentPrice,
        triggered: true,
        description: `Price (${currentPrice}) broke below Initial Balance Low (${marketProfile.initialBalance.low})`
      });
    }
  }
  
  // POC test detection
  if (config.detectPOCTests && config.pocTolerance) {
    const distanceToPOC = Math.abs(currentPrice - marketProfile.valueArea.poc);
    const pocPercent = (distanceToPOC / currentPrice) * 100;
    
    if (pocPercent <= config.pocTolerance) {
      signals.push({
        type: 'poc',
        condition: 'price_at_poc',
        value: distanceToPOC,
        triggered: true,
        description: `Price (${currentPrice}) testing POC (${marketProfile.valueArea.poc}) - ${pocPercent.toFixed(2)}% away`
      });
    }
  }
  
  return signals;
}
