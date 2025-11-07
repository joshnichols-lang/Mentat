/**
 * PHASE 4: Event-Driven AI Trigger System
 * Indicator Engine - Real-time indicator calculations using ring buffers
 * 
 * Monitors market data and calculates technical indicators without AI calls.
 * Provides APIs for TriggerSupervisor to check indicator values and detect triggers.
 */

import { RSI, SMA, EMA, MACD, ATR, BollingerBands } from 'technicalindicators';

/**
 * Ring buffer for efficient O(1) indicator updates
 */
class RingBuffer {
  private buffer: number[];
  private writeIndex: number = 0;
  private size: number = 0;

  constructor(private maxSize: number) {
    this.buffer = new Array(maxSize);
  }

  push(value: number): void {
    this.buffer[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.maxSize;
    if (this.size < this.maxSize) {
      this.size++;
    }
  }

  getValues(): number[] {
    if (this.size < this.maxSize) {
      // Buffer not full yet - return only filled portion in correct order
      return this.buffer.slice(0, this.size);
    }
    // Buffer full - reorder to get chronological sequence
    const result = new Array(this.maxSize);
    for (let i = 0; i < this.maxSize; i++) {
      result[i] = this.buffer[(this.writeIndex + i) % this.maxSize];
    }
    return result;
  }

  getLatest(): number | null {
    if (this.size === 0) return null;
    const latestIndex = (this.writeIndex - 1 + this.maxSize) % this.maxSize;
    return this.buffer[latestIndex];
  }

  isFull(): boolean {
    return this.size >= this.maxSize;
  }

  getSize(): number {
    return this.size;
  }
}

/**
 * Symbol-specific indicator state
 */
interface SymbolIndicators {
  symbol: string;
  
  // Price data ring buffers
  closes: RingBuffer;
  highs: RingBuffer;
  lows: RingBuffer;
  volumes: RingBuffer;
  
  // Cached indicator values (recalculated on each update)
  rsi?: {
    period: number;
    value: number;
    lastUpdate: number;
  };
  
  sma?: Map<number, { value: number; lastUpdate: number }>;
  ema?: Map<number, { value: number; lastUpdate: number }>;
  
  macd?: {
    fast: number;
    slow: number;
    signal: number;
    histogram: number;
    lastUpdate: number;
  };
  
  atr?: {
    period: number;
    value: number;
    lastUpdate: number;
  };
  
  bb?: {
    period: number;
    stdDev: number;
    upper: number;
    middle: number;
    lower: number;
    lastUpdate: number;
  };
  
  // Volume metrics
  volumeMA?: {
    period: number;
    value: number;
    lastUpdate: number;
  };
}

/**
 * Global indicator engine managing all symbols
 */
class IndicatorEngineClass {
  private symbols: Map<string, SymbolIndicators> = new Map();
  private readonly maxBufferSize = 500; // Keep 500 candles of history
  
  /**
   * Initialize or get symbol indicators
   */
  private getOrCreateSymbol(symbol: string): SymbolIndicators {
    if (!this.symbols.has(symbol)) {
      this.symbols.set(symbol, {
        symbol,
        closes: new RingBuffer(this.maxBufferSize),
        highs: new RingBuffer(this.maxBufferSize),
        lows: new RingBuffer(this.maxBufferSize),
        volumes: new RingBuffer(this.maxBufferSize),
        sma: new Map(),
        ema: new Map(),
      });
    }
    return this.symbols.get(symbol)!;
  }
  
  /**
   * Update symbol with new candle data
   */
  updateCandle(symbol: string, candle: {
    close: number;
    high: number;
    low: number;
    volume: number;
    timestamp: number;
  }): void {
    const indicators = this.getOrCreateSymbol(symbol);
    
    // Add to ring buffers
    indicators.closes.push(candle.close);
    indicators.highs.push(candle.high);
    indicators.lows.push(candle.low);
    indicators.volumes.push(candle.volume);
    
    // Recalculate all indicators for this symbol
    this.recalculateIndicators(indicators, candle.timestamp);
  }
  
  /**
   * Recalculate all indicators for a symbol
   */
  private recalculateIndicators(indicators: SymbolIndicators, timestamp: number): void {
    const closes = indicators.closes.getValues();
    const highs = indicators.highs.getValues();
    const lows = indicators.lows.getValues();
    const volumes = indicators.volumes.getValues();
    
    // Need minimum data points for indicators
    if (closes.length < 14) return;
    
    // RSI (14 period default)
    try {
      const rsiValues = RSI.calculate({ values: closes, period: 14 });
      if (rsiValues.length > 0) {
        indicators.rsi = {
          period: 14,
          value: rsiValues[rsiValues.length - 1],
          lastUpdate: timestamp
        };
      }
    } catch (e) {
      console.error('[IndicatorEngine] RSI calculation error:', e);
    }
    
    // SMA for common periods: 20, 50, 200
    [20, 50, 200].forEach(period => {
      if (closes.length >= period) {
        try {
          const smaValues = SMA.calculate({ values: closes, period });
          if (smaValues.length > 0) {
            indicators.sma!.set(period, {
              value: smaValues[smaValues.length - 1],
              lastUpdate: timestamp
            });
          }
        } catch (e) {
          console.error(`[IndicatorEngine] SMA(${period}) calculation error:`, e);
        }
      }
    });
    
    // EMA for common periods: 9, 12, 20, 26, 50
    [9, 12, 20, 26, 50].forEach(period => {
      if (closes.length >= period) {
        try {
          const emaValues = EMA.calculate({ values: closes, period });
          if (emaValues.length > 0) {
            indicators.ema!.set(period, {
              value: emaValues[emaValues.length - 1],
              lastUpdate: timestamp
            });
          }
        } catch (e) {
          console.error(`[IndicatorEngine] EMA(${period}) calculation error:`, e);
        }
      }
    });
    
    // MACD (12, 26, 9)
    if (closes.length >= 26) {
      try {
        const macdValues = MACD.calculate({
          values: closes,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          SimpleMAOscillator: false,
          SimpleMASignal: false
        });
        if (macdValues.length > 0) {
          const latest = macdValues[macdValues.length - 1];
          indicators.macd = {
            fast: latest.MACD || 0,
            slow: latest.signal || 0,
            signal: latest.signal || 0,
            histogram: latest.histogram || 0,
            lastUpdate: timestamp
          };
        }
      } catch (e) {
        console.error('[IndicatorEngine] MACD calculation error:', e);
      }
    }
    
    // ATR (14 period)
    if (highs.length >= 14 && lows.length >= 14 && closes.length >= 14) {
      try {
        const atrValues = ATR.calculate({
          high: highs,
          low: lows,
          close: closes,
          period: 14
        });
        if (atrValues.length > 0) {
          indicators.atr = {
            period: 14,
            value: atrValues[atrValues.length - 1],
            lastUpdate: timestamp
          };
        }
      } catch (e) {
        console.error('[IndicatorEngine] ATR calculation error:', e);
      }
    }
    
    // Bollinger Bands (20, 2)
    if (closes.length >= 20) {
      try {
        const bbValues = BollingerBands.calculate({
          values: closes,
          period: 20,
          stdDev: 2
        });
        if (bbValues.length > 0) {
          const latest = bbValues[bbValues.length - 1];
          indicators.bb = {
            period: 20,
            stdDev: 2,
            upper: latest.upper,
            middle: latest.middle,
            lower: latest.lower,
            lastUpdate: timestamp
          };
        }
      } catch (e) {
        console.error('[IndicatorEngine] BB calculation error:', e);
      }
    }
    
    // Volume MA (20 period)
    if (volumes.length >= 20) {
      try {
        const volMAValues = SMA.calculate({ values: volumes, period: 20 });
        if (volMAValues.length > 0) {
          indicators.volumeMA = {
            period: 20,
            value: volMAValues[volMAValues.length - 1],
            lastUpdate: timestamp
          };
        }
      } catch (e) {
        console.error('[IndicatorEngine] Volume MA calculation error:', e);
      }
    }
  }
  
  /**
   * Get RSI value for a symbol
   */
  getRSI(symbol: string, period: number = 14): number | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators || !indicators.rsi || indicators.rsi.period !== period) {
      return null;
    }
    return indicators.rsi.value;
  }
  
  /**
   * Get SMA value for a symbol
   */
  getSMA(symbol: string, period: number): number | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators || !indicators.sma) {
      return null;
    }
    return indicators.sma.get(period)?.value || null;
  }
  
  /**
   * Get EMA value for a symbol
   */
  getEMA(symbol: string, period: number): number | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators || !indicators.ema) {
      return null;
    }
    return indicators.ema.get(period)?.value || null;
  }
  
  /**
   * Get MACD values for a symbol
   */
  getMACD(symbol: string): { macd: number; signal: number; histogram: number } | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators || !indicators.macd) {
      return null;
    }
    return {
      macd: indicators.macd.fast,
      signal: indicators.macd.signal,
      histogram: indicators.macd.histogram
    };
  }
  
  /**
   * Get ATR value for a symbol
   */
  getATR(symbol: string): number | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators || !indicators.atr) {
      return null;
    }
    return indicators.atr.value;
  }
  
  /**
   * Get Bollinger Bands for a symbol
   */
  getBollingerBands(symbol: string): { upper: number; middle: number; lower: number } | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators || !indicators.bb) {
      return null;
    }
    return {
      upper: indicators.bb.upper,
      middle: indicators.bb.middle,
      lower: indicators.bb.lower
    };
  }
  
  /**
   * Get current price for a symbol
   */
  getCurrentPrice(symbol: string): number | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators) {
      return null;
    }
    return indicators.closes.getLatest();
  }
  
  /**
   * Get volume MA for a symbol
   */
  getVolumeMA(symbol: string): number | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators || !indicators.volumeMA) {
      return null;
    }
    return indicators.volumeMA.value;
  }
  
  /**
   * Get current volume for a symbol
   */
  getCurrentVolume(symbol: string): number | null {
    const indicators = this.symbols.get(symbol);
    if (!indicators) {
      return null;
    }
    return indicators.volumes.getLatest();
  }
  
  /**
   * Check if symbol has sufficient data for indicators
   */
  hasData(symbol: string, minCandles: number = 14): boolean {
    const indicators = this.symbols.get(symbol);
    if (!indicators) {
      return false;
    }
    return indicators.closes.getSize() >= minCandles;
  }
  
  /**
   * Get all symbols being monitored
   */
  getMonitoredSymbols(): string[] {
    return Array.from(this.symbols.keys());
  }
  
  /**
   * Clear data for a symbol (cleanup)
   */
  clearSymbol(symbol: string): void {
    this.symbols.delete(symbol);
  }
}

// Singleton instance
export const IndicatorEngine = new IndicatorEngineClass();
