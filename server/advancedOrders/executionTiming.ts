/**
 * Predictive Execution Timing - AI-Powered Timing Optimization
 * 
 * Analyzes historical patterns and market microstructure to predict optimal execution windows.
 * Goes beyond Insilico Terminal by using AI to:
 * - Detect recurring intraday patterns (e.g., lunch hour lulls, opening volatility)
 * - Identify liquidity sweet spots
 * - Predict short-term volatility spikes
 * - Optimize execution timing based on historical performance
 */

import { makeAIRequest } from "../aiRouter";

interface ExecutionWindow {
  startTime: number;        // Unix timestamp
  endTime: number;          // Unix timestamp
  confidence: number;       // 0-1
  reasoning: string;
  
  predictedMetrics: {
    volatility: number;     // Expected volatility (annualized)
    spread: number;         // Expected bid-ask spread
    liquidity: number;      // Expected available liquidity
    slippage: number;       // Expected slippage in bps
  };
  
  risk: 'low' | 'medium' | 'high';
}

interface IntradayPattern {
  hour: number;                    // Hour of day (0-23)
  avgVolatility: number;
  avgSpread: number;
  avgLiquidity: number;
  avgVolume: number;
  sampleSize: number;
}

export class ExecutionTimingPredictor {
  private patternCache: Map<string, IntradayPattern[]> = new Map();
  private performanceHistory: Map<string, Array<{
    timestamp: number;
    hour: number;
    volatility: number;
    spread: number;
    liquidity: number;
    slippage: number;
  }>> = new Map();
  
  /**
   * Predict optimal execution windows for an order
   */
  async predictOptimalWindows(params: {
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    maxDuration: number;    // Maximum time to execute (minutes)
    urgency: 'low' | 'medium' | 'high';
    userId: string;
  }): Promise<ExecutionWindow[]> {
    
    // Analyze intraday patterns
    const patterns = await this.analyzeIntradayPatterns(params.symbol);
    
    // Get current market conditions
    const currentConditions = await this.getCurrentConditions(params.symbol);
    
    // Use AI to predict optimal windows
    const windows = await this.predictWindows({
      ...params,
      patterns,
      currentConditions,
    });
    
    // Record predictions for learning
    await this.recordPredictions(params.symbol, windows);
    
    return windows;
  }
  
  /**
   * Analyze historical intraday patterns
   */
  private async analyzeIntradayPatterns(symbol: string): Promise<IntradayPattern[]> {
    
    // Check cache
    const cached = this.patternCache.get(symbol);
    if (cached && cached.length > 0) {
      return cached;
    }
    
    // Fetch historical candle data (last 7 days of 1-hour candles)
    const normalizedSymbol = symbol.replace('-USD', '').replace('-PERP', '');
    
    const response = await fetch(
      `https://api.hyperliquid.xyz/info`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: {
            coin: normalizedSymbol,
            interval: '1h',
            startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days
            endTime: Date.now()
          }
        })
      }
    );
    
    const responseData = await response.json();
    const candles = responseData?.candles ?? [];
    
    if (!candles || candles.length === 0) {
      return [];
    }
    
    // Group by hour of day
    const hourlyData: Map<number, {
      volatilities: number[];
      spreads: number[];
      liquidities: number[];
      volumes: number[];
    }> = new Map();
    
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.set(hour, {
        volatilities: [],
        spreads: [],
        liquidities: [],
        volumes: [],
      });
    }
    
    // Calculate metrics for each candle
    for (const candle of candles) {
      const timestamp = parseInt(candle.t);
      const hour = new Date(timestamp).getUTCHours();
      
      const high = parseFloat(candle.h);
      const low = parseFloat(candle.l);
      const close = parseFloat(candle.c);
      const volume = parseFloat(candle.v);
      
      // Calculate volatility (high-low range as % of close)
      const volatility = ((high - low) / close) * 100;
      
      // Estimate spread (using high-low range as proxy)
      const spread = high - low;
      
      // Use volume as proxy for liquidity
      const liquidity = volume;
      
      const data = hourlyData.get(hour)!;
      data.volatilities.push(volatility);
      data.spreads.push(spread);
      data.liquidities.push(liquidity);
      data.volumes.push(volume);
    }
    
    // Compute averages
    const patterns: IntradayPattern[] = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyData.get(hour)!;
      
      if (data.volatilities.length === 0) continue;
      
      patterns.push({
        hour,
        avgVolatility: data.volatilities.reduce((a, b) => a + b, 0) / data.volatilities.length,
        avgSpread: data.spreads.reduce((a, b) => a + b, 0) / data.spreads.length,
        avgLiquidity: data.liquidities.reduce((a, b) => a + b, 0) / data.liquidities.length,
        avgVolume: data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length,
        sampleSize: data.volatilities.length,
      });
    }
    
    // Cache patterns
    this.patternCache.set(symbol, patterns);
    
    return patterns;
  }
  
  /**
   * Get current market conditions
   */
  private async getCurrentConditions(symbol: string): Promise<{
    currentHour: number;
    volatility: number;
    spread: number;
    liquidity: number;
  }> {
    
    const normalizedSymbol = symbol.replace('-USD', '').replace('-PERP', '');
    
    // Fetch order book
    const bookResponse = await fetch(
      `https://api.hyperliquid.xyz/info`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'l2Book',
          coin: normalizedSymbol
        })
      }
    );
    
    const bookData = await bookResponse.json();
    const book = bookData?.data ?? bookData; // Handle both response formats
    
    // Guard against missing book data
    if (!book || !book.levels || !Array.isArray(book.levels[0]) || !Array.isArray(book.levels[1])) {
      console.warn(`[ExecutionTiming] Invalid book data for ${symbol}`);
      return {
        currentHour: new Date().getUTCHours(),
        volatility: 0,
        spread: 0,
        liquidity: 0,
      };
    }
    
    const bestBid = parseFloat(book.levels?.[0]?.[0]?.px || '0');
    const bestAsk = parseFloat(book.levels?.[1]?.[0]?.px || '0');
    const spread = bestAsk - bestBid;
    
    // Calculate liquidity
    const bidLiquidity = (book.levels?.[0] || []).slice(0, 10).reduce((sum: number, l: any) => sum + parseFloat(l.sz), 0);
    const askLiquidity = (book.levels?.[1] || []).slice(0, 10).reduce((sum: number, l: any) => sum + parseFloat(l.sz), 0);
    const liquidity = bidLiquidity + askLiquidity;
    
    // Get recent candles for volatility
    const candlesResponse = await fetch(
      `https://api.hyperliquid.xyz/info`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: {
            coin: normalizedSymbol,
            interval: '15m',
            startTime: Date.now() - 4 * 60 * 60 * 1000, // Last 4 hours
            endTime: Date.now()
          }
        })
      }
    );
    
    const candlesData = await candlesResponse.json();
    const candles = candlesData?.candles ?? [];
    
    // Calculate recent volatility
    let totalVolatility = 0;
    for (const candle of candles.slice(-8)) { // Last 2 hours
      const high = parseFloat(candle.h);
      const low = parseFloat(candle.l);
      const close = parseFloat(candle.c);
      totalVolatility += ((high - low) / close) * 100;
    }
    const volatility = candles.length > 0 ? totalVolatility / Math.min(8, candles.length) : 0;
    
    return {
      currentHour: new Date().getUTCHours(),
      volatility,
      spread,
      liquidity,
    };
  }
  
  /**
   * Use AI to predict optimal execution windows
   */
  private async predictWindows(params: {
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    maxDuration: number;
    urgency: 'low' | 'medium' | 'high';
    patterns: IntradayPattern[];
    currentConditions: any;
    userId: string;
  }): Promise<ExecutionWindow[]> {
    
    const prompt = `You are an expert in market microstructure and execution timing. Analyze the following intraday patterns and predict the optimal execution windows for this order.

Order Details:
- Symbol: ${params.symbol}
- Side: ${params.side.toUpperCase()}
- Size: ${params.size}
- Max Duration: ${params.maxDuration} minutes
- Urgency: ${params.urgency}

Current Conditions (Hour ${params.currentConditions.currentHour} UTC):
- Volatility: ${params.currentConditions.volatility.toFixed(2)}%
- Spread: $${params.currentConditions.spread.toFixed(2)}
- Liquidity: ${params.currentConditions.liquidity.toFixed(4)}

Historical Intraday Patterns (7-day average):
${params.patterns.map(p => `
Hour ${p.hour}:00 UTC:
  - Avg Volatility: ${p.avgVolatility.toFixed(2)}%
  - Avg Spread: $${p.avgSpread.toFixed(2)}
  - Avg Liquidity: ${p.avgLiquidity.toFixed(4)}
  - Avg Volume: ${p.avgVolume.toFixed(2)}
  - Samples: ${p.sampleSize}
`).join('\n')}

Based on this data:
1. Identify the best 2-3 execution windows in the next ${params.maxDuration} minutes
2. Consider lower volatility, tighter spreads, and higher liquidity
3. Factor in the urgency level
4. Provide confidence scores and reasoning

Respond in JSON format:
{
  "windows": [
    {
      "startTime": <unix_timestamp>,
      "endTime": <unix_timestamp>,
      "confidence": <0-1>,
      "reasoning": "<explanation>",
      "predictedMetrics": {
        "volatility": <number>,
        "spread": <number>,
        "liquidity": <number>,
        "slippage": <number_in_bps>
      },
      "risk": "low|medium|high"
    }
  ]
}`;

    try {
      const response = await makeAIRequest({
        messages: [{ role: 'user', content: prompt }],
        userId: params.userId,
        temperature: 0.4,
      });
      
      const result = JSON.parse(response.content);
      return result.windows || [];
      
    } catch (error) {
      console.error('[ExecutionTiming] AI prediction failed, using rule-based fallback:', error);
      
      // Fallback: Find hours with lowest volatility in next period
      const now = new Date();
      const currentHour = now.getUTCHours();
      
      const upcoming = params.patterns
        .filter(p => p.hour >= currentHour && p.hour < currentHour + Math.ceil(params.maxDuration / 60))
        .sort((a, b) => a.avgVolatility - b.avgVolatility)
        .slice(0, 2);
      
      return upcoming.map(pattern => ({
        startTime: Date.now() + (pattern.hour - currentHour) * 60 * 60 * 1000,
        endTime: Date.now() + (pattern.hour - currentHour + 1) * 60 * 60 * 1000,
        confidence: 0.6,
        reasoning: 'Rule-based: Selected low volatility hours',
        predictedMetrics: {
          volatility: pattern.avgVolatility,
          spread: pattern.avgSpread,
          liquidity: pattern.avgLiquidity,
          slippage: pattern.avgVolatility * 10, // Rough estimate
        },
        risk: pattern.avgVolatility < 1 ? 'low' : pattern.avgVolatility < 2 ? 'medium' : 'high',
      }));
    }
  }
  
  /**
   * Record predictions for learning
   */
  private async recordPredictions(symbol: string, windows: ExecutionWindow[]): Promise<void> {
    const history = this.performanceHistory.get(symbol) || [];
    
    for (const window of windows) {
      history.push({
        timestamp: Date.now(),
        hour: new Date(window.startTime).getUTCHours(),
        volatility: window.predictedMetrics.volatility,
        spread: window.predictedMetrics.spread,
        liquidity: window.predictedMetrics.liquidity,
        slippage: window.predictedMetrics.slippage,
      });
    }
    
    // Keep last 1000 predictions
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.performanceHistory.set(symbol, history);
  }
  
  /**
   * Evaluate prediction accuracy (for learning)
   */
  async evaluatePrediction(params: {
    symbol: string;
    predictedWindow: ExecutionWindow;
    actualMetrics: {
      volatility: number;
      spread: number;
      liquidity: number;
      slippage: number;
    };
  }): Promise<{
    accuracyScore: number; // 0-1
    errors: {
      volatility: number;
      spread: number;
      liquidity: number;
      slippage: number;
    };
  }> {
    
    const predicted = params.predictedWindow.predictedMetrics;
    const actual = params.actualMetrics;
    
    // Calculate percentage errors
    const errors = {
      volatility: Math.abs(predicted.volatility - actual.volatility) / predicted.volatility,
      spread: Math.abs(predicted.spread - actual.spread) / predicted.spread,
      liquidity: Math.abs(predicted.liquidity - actual.liquidity) / predicted.liquidity,
      slippage: Math.abs(predicted.slippage - actual.slippage) / predicted.slippage,
    };
    
    // Overall accuracy (1 - avg error)
    const avgError = (errors.volatility + errors.spread + errors.liquidity + errors.slippage) / 4;
    const accuracyScore = Math.max(0, 1 - avgError);
    
    return {
      accuracyScore,
      errors,
    };
  }
}

// Export singleton
export const executionTimingPredictor = new ExecutionTimingPredictor();
