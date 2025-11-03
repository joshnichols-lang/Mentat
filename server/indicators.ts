/**
 * Technical Indicator Calculation Library
 * 
 * Provides local calculation of common technical indicators
 * to avoid unnecessary AI calls when evaluating strategy triggers.
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  
  const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for first EMA value
  let ema = calculateSMA(data.slice(0, period), period);
  if (ema === null) return null;
  
  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(candles: Candle[], period: number = 14): number | null {
  if (candles.length < period + 1) return null;
  
  const closes = candles.map(c => c.close);
  const changes: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  // Separate gains and losses
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
  
  // Calculate average gain and loss using EMA
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // Smooth with remaining values
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(candles: Candle[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
  macd: number;
  signal: number;
  histogram: number;
} | null {
  if (candles.length < slowPeriod + signalPeriod) return null;
  
  const closes = candles.map(c => c.close);
  
  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  
  if (fastEMA === null || slowEMA === null) return null;
  
  const macdLine = fastEMA - slowEMA;
  
  // Calculate MACD history for signal line
  const macdHistory: number[] = [];
  for (let i = slowPeriod; i <= candles.length; i++) {
    const periodCloses = candles.slice(0, i).map(c => c.close);
    const fast = calculateEMA(periodCloses, fastPeriod);
    const slow = calculateEMA(periodCloses, slowPeriod);
    if (fast !== null && slow !== null) {
      macdHistory.push(fast - slow);
    }
  }
  
  // Calculate signal line (EMA of MACD)
  const signalLine = calculateEMA(macdHistory, signalPeriod);
  
  if (signalLine === null) return null;
  
  const histogram = macdLine - signalLine;
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(candles: Candle[], period: number = 20, stdDevMultiplier: number = 2): {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
} | null {
  if (candles.length < period) return null;
  
  const closes = candles.slice(-period).map(c => c.close);
  
  // Calculate middle band (SMA)
  const middle = calculateSMA(closes, period);
  if (middle === null) return null;
  
  // Calculate standard deviation
  const squaredDiffs = closes.map(close => Math.pow(close - middle, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);
  
  const upper = middle + (stdDev * stdDevMultiplier);
  const lower = middle - (stdDev * stdDevMultiplier);
  const bandwidth = ((upper - lower) / middle) * 100;
  
  return {
    upper,
    middle,
    lower,
    bandwidth
  };
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period: number = 14): number | null {
  if (candles.length < period + 1) return null;
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  return calculateEMA(trueRanges, period);
}

/**
 * Calculate Stochastic Oscillator
 */
export function calculateStochastic(candles: Candle[], kPeriod: number = 14, dPeriod: number = 3): {
  k: number;
  d: number;
} | null {
  if (candles.length < kPeriod) return null;
  
  const recentCandles = candles.slice(-kPeriod);
  const currentClose = candles[candles.length - 1].close;
  
  const highestHigh = Math.max(...recentCandles.map(c => c.high));
  const lowestLow = Math.min(...recentCandles.map(c => c.low));
  
  if (highestHigh === lowestLow) return null;
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  
  // Calculate %D (SMA of %K)
  const kValues: number[] = [];
  for (let i = candles.length - dPeriod; i < candles.length; i++) {
    if (i < kPeriod - 1) continue;
    
    const periodCandles = candles.slice(i - kPeriod + 1, i + 1);
    const close = candles[i].close;
    const high = Math.max(...periodCandles.map(c => c.high));
    const low = Math.min(...periodCandles.map(c => c.low));
    
    if (high !== low) {
      kValues.push(((close - low) / (high - low)) * 100);
    }
  }
  
  const d = kValues.length > 0 
    ? kValues.reduce((a, b) => a + b, 0) / kValues.length 
    : k;
  
  return { k, d };
}

/**
 * Detect indicator-based entry conditions
 */
export interface IndicatorSignal {
  indicator: string;
  condition: string;
  value: number;
  triggered: boolean;
  description: string;
}

export function evaluateIndicatorSignals(
  candles: Candle[],
  indicators: {
    rsi?: { period: number; oversold: number; overbought: number };
    macd?: { fast: number; slow: number; signal: number };
    bollingerBands?: { period: number; stdDev: number };
    stochastic?: { kPeriod: number; dPeriod: number; oversold: number; overbought: number };
  }
): IndicatorSignal[] {
  const signals: IndicatorSignal[] = [];
  
  // RSI signals
  if (indicators.rsi) {
    const rsi = calculateRSI(candles, indicators.rsi.period);
    if (rsi !== null) {
      if (rsi < indicators.rsi.oversold) {
        signals.push({
          indicator: 'RSI',
          condition: 'oversold',
          value: rsi,
          triggered: true,
          description: `RSI (${rsi.toFixed(2)}) below ${indicators.rsi.oversold} - oversold condition`
        });
      } else if (rsi > indicators.rsi.overbought) {
        signals.push({
          indicator: 'RSI',
          condition: 'overbought',
          value: rsi,
          triggered: true,
          description: `RSI (${rsi.toFixed(2)}) above ${indicators.rsi.overbought} - overbought condition`
        });
      }
    }
  }
  
  // MACD signals
  if (indicators.macd) {
    const macd = calculateMACD(candles, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal);
    if (macd !== null) {
      // Bullish crossover
      if (macd.macd > macd.signal && macd.histogram > 0) {
        signals.push({
          indicator: 'MACD',
          condition: 'bullish_crossover',
          value: macd.histogram,
          triggered: true,
          description: `MACD bullish crossover - histogram: ${macd.histogram.toFixed(4)}`
        });
      }
      // Bearish crossover
      else if (macd.macd < macd.signal && macd.histogram < 0) {
        signals.push({
          indicator: 'MACD',
          condition: 'bearish_crossover',
          value: macd.histogram,
          triggered: true,
          description: `MACD bearish crossover - histogram: ${macd.histogram.toFixed(4)}`
        });
      }
    }
  }
  
  // Bollinger Bands signals
  if (indicators.bollingerBands) {
    const bb = calculateBollingerBands(candles, indicators.bollingerBands.period, indicators.bollingerBands.stdDev);
    const currentPrice = candles[candles.length - 1].close;
    if (bb !== null) {
      if (currentPrice < bb.lower) {
        signals.push({
          indicator: 'BollingerBands',
          condition: 'below_lower_band',
          value: currentPrice,
          triggered: true,
          description: `Price (${currentPrice}) below lower BB (${bb.lower.toFixed(2)}) - potential bounce`
        });
      } else if (currentPrice > bb.upper) {
        signals.push({
          indicator: 'BollingerBands',
          condition: 'above_upper_band',
          value: currentPrice,
          triggered: true,
          description: `Price (${currentPrice}) above upper BB (${bb.upper.toFixed(2)}) - potential reversal`
        });
      }
    }
  }
  
  // Stochastic signals
  if (indicators.stochastic) {
    const stoch = calculateStochastic(candles, indicators.stochastic.kPeriod, indicators.stochastic.dPeriod);
    if (stoch !== null) {
      if (stoch.k < indicators.stochastic.oversold) {
        signals.push({
          indicator: 'Stochastic',
          condition: 'oversold',
          value: stoch.k,
          triggered: true,
          description: `Stochastic %K (${stoch.k.toFixed(2)}) below ${indicators.stochastic.oversold} - oversold`
        });
      } else if (stoch.k > indicators.stochastic.overbought) {
        signals.push({
          indicator: 'Stochastic',
          condition: 'overbought',
          value: stoch.k,
          triggered: true,
          description: `Stochastic %K (${stoch.k.toFixed(2)}) above ${indicators.stochastic.overbought} - overbought`
        });
      }
    }
  }
  
  return signals;
}
