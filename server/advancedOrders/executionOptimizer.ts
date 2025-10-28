/**
 * AI Execution Optimizer - Real-Time Parameter Tuning
 * 
 * Uses AI to dynamically optimize execution parameters based on:
 * - Current market volatility and regime
 * - Order flow imbalance
 * - Liquidity depth and resilience
 * - Historical execution performance
 * 
 * Goes beyond Insilico Terminal by continuously adapting parameters during execution
 */

import { makeAIRequest } from "../aiRouter";

interface MarketConditions {
  symbol: string;
  timestamp: number;
  
  // Volatility metrics
  realizedVolatility: number;      // Recent price volatility
  impliedVolatility?: number;      // From options if available
  volatilityRegime: 'low' | 'medium' | 'high' | 'extreme';
  
  // Liquidity metrics
  bidAskSpread: number;
  orderBookImbalance: number;      // -1 to 1 (negative = more sellers)
  topOfBookLiquidity: number;
  aggregateLiquidity: number;
  
  // Flow metrics
  buyPressure: number;              // Recent buy volume
  sellPressure: number;             // Recent sell volume
  netFlow: number;                  // buyPressure - sellPressure
  
  // Momentum
  priceChange1m: number;
  priceChange5m: number;
  priceChange15m: number;
  trend: 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';
}

interface OptimizedParameters {
  orderType: string;
  
  // TWAP optimizations
  twap?: {
    optimalSlices: number;
    optimalInterval: number;         // Seconds between slices
    randomizationFactor: number;     // 0-1, how much to randomize
    priceLimit: number | null;
    reasoning: string;
  };
  
  // Limit Chase optimizations
  limitChase?: {
    optimalOffset: number;           // Ticks from best price
    aggressiveness: 'passive' | 'moderate' | 'aggressive';
    maxChases: number;
    chaseInterval: number;           // Seconds between checks
    reasoning: string;
  };
  
  // Scaled order optimizations
  scaled?: {
    optimalLevels: number;
    priceRange: { start: number; end: number };
    distribution: 'linear' | 'geometric' | 'fibonacci';
    weightBias: 'front' | 'center' | 'back' | 'even';
    reasoning: string;
  };
  
  // Iceberg optimizations
  iceberg?: {
    optimalDisplaySize: number;
    refreshStrategy: 'immediate' | 'delayed' | 'random';
    priceAdjustment: boolean;        // Adjust limit price on refresh
    reasoning: string;
  };
  
  // Overall execution guidance
  recommendedUrgency: 'low' | 'medium' | 'high';
  estimatedImpact: number;            // Expected market impact in bps
  confidenceScore: number;            // AI confidence 0-1
  warnings: string[];
  aiSummary: string;
}

export class ExecutionOptimizer {
  private marketDataCache: Map<string, MarketConditions> = new Map();
  private optimizationHistory: Map<string, Array<{ params: any; performance: number; timestamp: number }>> = new Map();
  
  /**
   * Optimize execution parameters based on current market conditions
   */
  async optimizeExecution(params: {
    orderType: 'twap' | 'limit_chase' | 'scaled' | 'iceberg';
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    baseParams: any;  // User's initial parameters
    userId: string;
  }): Promise<OptimizedParameters> {
    
    // Fetch current market conditions
    const conditions = await this.analyzeMarketConditions(params.symbol);
    
    // Use AI to optimize parameters
    const optimized = await this.getAIOptimization({
      ...params,
      conditions,
    });
    
    // Record optimization for learning
    await this.recordOptimization(params.symbol, params.orderType, optimized);
    
    return optimized;
  }
  
  /**
   * Analyze current market conditions
   */
  private async analyzeMarketConditions(symbol: string): Promise<MarketConditions> {
    
    // Check cache first
    const cached = this.marketDataCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp) < 10000) {
      return cached;
    }
    
    // Fetch fresh market data
    const normalizedSymbol = symbol.replace('-USD', '').replace('-PERP', '');
    
    // Get order book
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
      console.warn(`[ExecutionOptimizer] Invalid book data for ${symbol}`);
      // Return degraded conditions with safe defaults
      return {
        symbol,
        timestamp: Date.now(),
        realizedVolatility: 0,
        volatilityRegime: 'low' as const,
        bidAskSpread: 0,
        orderBookImbalance: 0,
        topOfBookLiquidity: 0,
        aggregateLiquidity: 0,
        buyPressure: 0,
        sellPressure: 0,
        netFlow: 0,
        priceChange1m: 0,
        priceChange5m: 0,
        priceChange15m: 0,
        trend: 'neutral' as const,
      };
    }
    
    // Calculate metrics
    const bestBid = parseFloat(book.levels?.[0]?.[0]?.px || '0');
    const bestAsk = parseFloat(book.levels?.[1]?.[0]?.px || '0');
    const midPrice = (bestBid + bestAsk) / 2;
    
    const bidAskSpread = bestAsk - bestBid;
    
    // Calculate order book imbalance
    const bidLiquidity = (book.levels?.[0] || []).slice(0, 10).reduce((sum: number, l: any) => sum + parseFloat(l.sz), 0);
    const askLiquidity = (book.levels?.[1] || []).slice(0, 10).reduce((sum: number, l: any) => sum + parseFloat(l.sz), 0);
    const orderBookImbalance = (bidLiquidity - askLiquidity) / (bidLiquidity + askLiquidity);
    
    // Get recent candles for volatility calculation
    const candlesResponse = await fetch(
      `https://api.hyperliquid.xyz/info`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: {
            coin: normalizedSymbol,
            interval: '1m',
            startTime: Date.now() - 60 * 60 * 1000, // Last hour
            endTime: Date.now()
          }
        })
      }
    );
    
    const candlesData = await candlesResponse.json();
    const candles = candlesData?.candles ?? [];
    
    // Calculate realized volatility (std dev of returns)
    const returns = candles.slice(1).map((c: any, i: number) => {
      const prevClose = parseFloat(candles[i].c);
      const currentClose = parseFloat(c.c);
      return Math.log(currentClose / prevClose);
    });
    
    const avgReturn = returns.length > 0 ? returns.reduce((sum: number, r: number) => sum + r, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const realizedVolatility = Math.sqrt(variance) * Math.sqrt(525600); // Annualized
    
    // Determine volatility regime
    let volatilityRegime: MarketConditions['volatilityRegime'];
    if (realizedVolatility < 0.3) volatilityRegime = 'low';
    else if (realizedVolatility < 0.6) volatilityRegime = 'medium';
    else if (realizedVolatility < 1.0) volatilityRegime = 'high';
    else volatilityRegime = 'extreme';
    
    // Calculate price changes
    const price1mAgo = parseFloat(candles[candles.length - 2]?.c || midPrice.toString());
    const price5mAgo = parseFloat(candles[Math.max(0, candles.length - 6)]?.c || midPrice.toString());
    const price15mAgo = parseFloat(candles[Math.max(0, candles.length - 16)]?.c || midPrice.toString());
    
    const priceChange1m = (midPrice - price1mAgo) / price1mAgo;
    const priceChange5m = (midPrice - price5mAgo) / price5mAgo;
    const priceChange15m = (midPrice - price15mAgo) / price15mAgo;
    
    // Determine trend
    let trend: MarketConditions['trend'];
    if (priceChange15m > 0.01) trend = 'strong_up';
    else if (priceChange15m > 0.003) trend = 'up';
    else if (priceChange15m < -0.01) trend = 'strong_down';
    else if (priceChange15m < -0.003) trend = 'down';
    else trend = 'neutral';
    
    // Calculate volume pressure (simplified - would use trade feed in production)
    const recentVolume = candles.slice(-5).reduce((sum: number, c: any) => sum + parseFloat(c.v), 0);
    const buyPressure = recentVolume * (orderBookImbalance > 0 ? 1 : 0.5);
    const sellPressure = recentVolume * (orderBookImbalance < 0 ? 1 : 0.5);
    
    const conditions: MarketConditions = {
      symbol,
      timestamp: Date.now(),
      realizedVolatility,
      volatilityRegime,
      bidAskSpread,
      orderBookImbalance,
      topOfBookLiquidity: parseFloat(book.levels?.[0]?.[0]?.sz || '0') + parseFloat(book.levels?.[1]?.[0]?.sz || '0'),
      aggregateLiquidity: bidLiquidity + askLiquidity,
      buyPressure,
      sellPressure,
      netFlow: buyPressure - sellPressure,
      priceChange1m,
      priceChange5m,
      priceChange15m,
      trend,
    };
    
    // Cache conditions
    this.marketDataCache.set(symbol, conditions);
    
    return conditions;
  }
  
  /**
   * Use AI to optimize execution parameters
   */
  private async getAIOptimization(params: {
    orderType: string;
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    baseParams: any;
    conditions: MarketConditions;
    userId: string;
  }): Promise<OptimizedParameters> {
    
    const prompt = `You are an expert execution optimizer for a cryptocurrency trading platform. Analyze the current market conditions and optimize execution parameters.

Order Details:
- Type: ${params.orderType.toUpperCase()}
- Symbol: ${params.symbol}
- Side: ${params.side.toUpperCase()}
- Size: ${params.size}

Current Market Conditions:
- Volatility: ${(params.conditions.realizedVolatility * 100).toFixed(2)}% (${params.conditions.volatilityRegime})
- Bid-Ask Spread: $${params.conditions.bidAskSpread.toFixed(2)}
- Order Book Imbalance: ${(params.conditions.orderBookImbalance * 100).toFixed(1)}% (${params.conditions.orderBookImbalance > 0 ? 'bid-heavy' : 'ask-heavy'})
- Top of Book Liquidity: ${params.conditions.topOfBookLiquidity.toFixed(4)}
- Aggregate Liquidity: ${params.conditions.aggregateLiquidity.toFixed(4)}
- Net Flow: ${params.conditions.netFlow > 0 ? 'buying' : 'selling'} pressure
- Trend: ${params.conditions.trend}
- Price Change (1m/5m/15m): ${(params.conditions.priceChange1m * 100).toFixed(2)}% / ${(params.conditions.priceChange5m * 100).toFixed(2)}% / ${(params.conditions.priceChange15m * 100).toFixed(2)}%

User's Base Parameters:
${JSON.stringify(params.baseParams, null, 2)}

Based on these conditions, provide optimized execution parameters. Consider:
1. ${params.orderType === 'twap' ? 'Optimal number of slices and intervals to minimize market impact' : ''}
2. ${params.orderType === 'limit_chase' ? 'Optimal offset and aggressiveness based on volatility and spread' : ''}
3. ${params.orderType === 'scaled' ? 'Optimal price levels and distribution to capture favorable fills' : ''}
4. ${params.orderType === 'iceberg' ? 'Optimal display size to balance stealth and fill rate' : ''}
5. Any warnings about adverse conditions
6. Expected market impact

Respond in JSON format with optimized parameters for ${params.orderType} orders.`;

    try {
      const response = await makeAIRequest({
        messages: [{ role: 'user', content: prompt }],
        userId: params.userId,
        temperature: 0.4,
      });
      
      const optimization = JSON.parse(response.content);
      return optimization;
      
    } catch (error) {
      console.error('[ExecutionOptimizer] AI optimization failed, using defaults:', error);
      
      // Fallback to rule-based optimization
      return this.getRuleBasedOptimization(params);
    }
  }
  
  /**
   * Fallback rule-based optimization
   */
  private getRuleBasedOptimization(params: {
    orderType: string;
    size: number;
    conditions: MarketConditions;
  }): OptimizedParameters {
    
    const base: OptimizedParameters = {
      orderType: params.orderType,
      recommendedUrgency: 'medium',
      estimatedImpact: 5,
      confidenceScore: 0.6,
      warnings: [],
      aiSummary: 'Using rule-based fallback optimization',
    };
    
    // Add warnings for adverse conditions
    if (params.conditions.volatilityRegime === 'extreme') {
      base.warnings.push('Extreme volatility - consider reducing order size or waiting');
    }
    if (params.conditions.aggregateLiquidity < params.size) {
      base.warnings.push('Insufficient liquidity - expect high slippage');
    }
    
    // Type-specific optimizations
    if (params.orderType === 'twap') {
      base.twap = {
        optimalSlices: Math.max(5, Math.min(20, Math.ceil(params.size / params.conditions.topOfBookLiquidity))),
        optimalInterval: params.conditions.volatilityRegime === 'high' ? 30 : 60,
        randomizationFactor: 0.2,
        priceLimit: null,
        reasoning: 'Adjusted slices based on liquidity, interval based on volatility',
      };
    }
    
    return base;
  }
  
  /**
   * Record optimization for learning
   */
  private async recordOptimization(
    symbol: string,
    orderType: string,
    optimization: OptimizedParameters
  ): Promise<void> {
    
    const key = `${symbol}-${orderType}`;
    const history = this.optimizationHistory.get(key) || [];
    
    history.push({
      params: optimization,
      performance: optimization.confidenceScore,
      timestamp: Date.now(),
    });
    
    // Keep last 100 optimizations
    if (history.length > 100) {
      history.shift();
    }
    
    this.optimizationHistory.set(key, history);
  }
  
  /**
   * Get real-time optimization suggestions during execution
   */
  async getRuntimeAdjustments(params: {
    orderId: string;
    symbol: string;
    currentProgress: number;  // 0-1
    executedSlippage: number; // Actual slippage so far
    userId: string;
  }): Promise<{
    shouldAdjust: boolean;
    suggestions: string[];
    newParameters?: Partial<OptimizedParameters>;
  }> {
    
    const conditions = await this.analyzeMarketConditions(params.symbol);
    
    const suggestions: string[] = [];
    let shouldAdjust = false;
    
    // Check if conditions have changed significantly
    if (conditions.volatilityRegime === 'extreme') {
      suggestions.push('Volatility spike detected - consider pausing execution');
      shouldAdjust = true;
    }
    
    if (Math.abs(conditions.orderBookImbalance) > 0.7) {
      suggestions.push(`Strong ${conditions.orderBookImbalance > 0 ? 'buying' : 'selling'} pressure - adjust timing`);
      shouldAdjust = true;
    }
    
    if (params.executedSlippage > 10) {
      suggestions.push('High slippage detected - reduce aggressiveness');
      shouldAdjust = true;
    }
    
    return {
      shouldAdjust,
      suggestions,
      newParameters: shouldAdjust ? await this.optimizeExecution({
        orderType: 'twap', // Would get from order
        symbol: params.symbol,
        side: 'buy', // Would get from order
        size: 1, // Would get remaining size
        baseParams: {},
        userId: params.userId,
      }) : undefined,
    };
  }
}

// Export singleton
export const executionOptimizer = new ExecutionOptimizer();
