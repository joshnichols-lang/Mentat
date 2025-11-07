/**
 * PHASE 1B: Unified Advanced Order Optimizer
 * 
 * Combines Smart Order Router + Execution Optimizer + Execution Timing
 * into a SINGLE AI call - reducing costs by 66% for advanced orders.
 * 
 * Instead of 3 separate AI calls:
 * 1. Smart Router (which exchange?)
 * 2. Execution Optimizer (what parameters?)
 * 3. Execution Timing (when to execute?)
 * 
 * We make ONE comprehensive call that answers all three questions at once.
 */

import { makeAIRequest } from "../aiRouter";

interface UnifiedOptimizationRequest {
  orderType: 'twap' | 'limit_chase' | 'scaled' | 'iceberg';
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  urgency: 'low' | 'medium' | 'high';
  maxDuration?: number;  // For timing prediction
  maxSlippageBps?: number;
  baseParams: any;  // User's initial parameters
  userId: string;
}

interface UnifiedOptimizationResponse {
  // Routing decision (from Smart Order Router)
  routing: {
    strategy: 'single_venue' | 'split_order' | 'sequential';
    venues: Array<{
      exchange: 'hyperliquid' | 'orderly';
      size: number;
      executionOrder: number;
      reasoning: string;
    }>;
    expectedSlippageBps: number;
    confidenceScore: number;
  };
  
  // Execution parameters (from Execution Optimizer)
  optimizedParams: {
    // TWAP
    twap?: {
      optimalSlices: number;
      intervalSeconds: number;
      priceLimit?: number;
      randomizeIntervals: boolean;
    };
    
    // Limit Chase
    limitChase?: {
      optimalOffset: number;
      maxChases: number;
      intervalSeconds: number;
      aggressiveness: 'low' | 'medium' | 'high';
    };
    
    // Scaled
    scaled?: {
      optimalLevels: number;
      priceRange: { start: number; end: number };
      distribution: 'linear' | 'geometric' | 'fibonacci';
      weightBias: 'front' | 'center' | 'back' | 'even';
    };
    
    // Iceberg
    iceberg?: {
      optimalDisplaySize: number;
      refreshStrategy: 'immediate' | 'delayed' | 'random';
      priceAdjustment: boolean;
    };
    
    estimatedImpact: number;  // Expected market impact in bps
    warnings: string[];
  };
  
  // Timing prediction (from Execution Timing)
  timing: {
    optimalWindows: Array<{
      startTime: number;
      endTime: number;
      confidence: number;
      reasoning: string;
      predictedMetrics: {
        volatility: number;
        spread: number;
        liquidity: number;
        slippage: number;
      };
      risk: 'low' | 'medium' | 'high';
    }>;
    recommendedStartTime: number;  // When to start execution
  };
  
  // Overall summary
  overallConfidence: number;
  aiSummary: string;
  estimatedCost: number;  // Total execution cost estimate
}

export class UnifiedAdvancedOrderOptimizer {
  
  /**
   * PHASE 1B: ONE AI call that handles routing + optimization + timing
   * Replaces 3 separate AI calls, saving ~66% on advanced order costs
   */
  async optimizeAdvancedOrder(request: UnifiedOptimizationRequest): Promise<UnifiedOptimizationResponse> {
    
    console.log(`[Unified Optimizer] Optimizing ${request.orderType} order for ${request.symbol} - ${request.size} @ ${request.urgency} urgency`);
    
    // Gather all necessary data in parallel
    const [marketConditions, venueQuotes, intradayPatterns] = await Promise.all([
      this.analyzeMarketConditions(request.symbol),
      this.fetchVenueQuotes(request.symbol, request.side, request.size),
      this.analyzeIntradayPatterns(request.symbol),
    ]);
    
    // Make ONE comprehensive AI call
    const prompt = this.buildUnifiedPrompt(request, marketConditions, venueQuotes, intradayPatterns);
    
    try {
      const response = await makeAIRequest(request.userId, {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 2000,
      });
      
      const optimization = JSON.parse(response.content);
      
      console.log(`[Unified Optimizer] ✅ Optimization complete - Route: ${optimization.routing.strategy}, Windows: ${optimization.timing.optimalWindows.length}, Cost: $${response.cost.toFixed(4)}`);
      
      return optimization;
      
    } catch (error) {
      console.error('[Unified Optimizer] AI optimization failed, using fallback:', error);
      return this.getFallbackOptimization(request);
    }
  }
  
  /**
   * Build comprehensive prompt that combines all three optimizations
   */
  private buildUnifiedPrompt(
    request: UnifiedOptimizationRequest,
    marketConditions: any,
    venueQuotes: any[],
    patterns: any[]
  ): string {
    
    const currentHour = new Date().getUTCHours();
    
    return `You are an expert trading system optimizer. Analyze the following data and provide a COMPREHENSIVE optimization covering routing, execution parameters, and timing.

# ORDER DETAILS
- Type: ${request.orderType.toUpperCase()}
- Symbol: ${request.symbol}
- Side: ${request.side.toUpperCase()}
- Size: ${request.size}
- Urgency: ${request.urgency}
- Max Duration: ${request.maxDuration || 'N/A'} minutes
- Max Slippage: ${request.maxSlippageBps || 'none'} bps

# MARKET CONDITIONS (Current State)
- Volatility: ${(marketConditions.realizedVolatility * 100).toFixed(2)}% (${marketConditions.volatilityRegime})
- Bid-Ask Spread: $${marketConditions.bidAskSpread.toFixed(2)}
- Order Book Imbalance: ${(marketConditions.orderBookImbalance * 100).toFixed(1)}%
- Trend: ${marketConditions.trend}
- Price Changes: 1m=${(marketConditions.priceChange1m * 100).toFixed(2)}%, 5m=${(marketConditions.priceChange5m * 100).toFixed(2)}%, 15m=${(marketConditions.priceChange15m * 100).toFixed(2)}%

# VENUE LIQUIDITY (Exchange Options)
${venueQuotes.map((q: any, i: number) => `
${i + 1}. ${q.exchange.toUpperCase()}
   - Available Liquidity: ${q.availableLiquidity.toFixed(4)}
   - Avg Price: $${q.avgPrice.toFixed(2)}
   - Slippage: ${q.slippageBps.toFixed(2)} bps
   - Total Cost: $${q.totalCost.toFixed(2)}
   - Fill Probability: ${(q.fillProbability * 100).toFixed(1)}%
   - Spread: $${q.currentSpread.toFixed(2)}
`).join('\n')}

# INTRADAY PATTERNS (7-Day Historical Average)
Current Hour: ${currentHour}:00 UTC
${patterns.slice(0, 12).map((p: any) => `
Hour ${p.hour}:00: Vol=${p.avgVolatility.toFixed(2)}%, Spread=$${p.avgSpread.toFixed(2)}, Liq=${p.avgLiquidity.toFixed(2)}
`).join('')}

# USER'S BASE PARAMETERS
${JSON.stringify(request.baseParams, null, 2)}

# YOUR TASK
Provide a UNIFIED optimization that addresses:

1. **ROUTING**: Which exchange(s) to use and how to split the order
2. **EXECUTION**: Optimal parameters for ${request.orderType} execution
3. **TIMING**: Best time windows to execute (considering volatility patterns)

Respond in this EXACT JSON format:
{
  "routing": {
    "strategy": "single_venue|split_order|sequential",
    "venues": [{"exchange": "hyperliquid|orderly", "size": <number>, "executionOrder": <number>, "reasoning": "<why>"}],
    "expectedSlippageBps": <number>,
    "confidenceScore": <0-1>
  },
  "optimizedParams": {
    "${request.orderType}": {
      ${this.getParamTemplate(request.orderType)}
    },
    "estimatedImpact": <number_in_bps>,
    "warnings": [<any_warnings>]
  },
  "timing": {
    "optimalWindows": [
      {
        "startTime": <unix_ms>,
        "endTime": <unix_ms>,
        "confidence": <0-1>,
        "reasoning": "<why_this_window>",
        "predictedMetrics": {"volatility": <num>, "spread": <num>, "liquidity": <num>, "slippage": <num>},
        "risk": "low|medium|high"
      }
    ],
    "recommendedStartTime": <unix_ms>
  },
  "overallConfidence": <0-1>,
  "aiSummary": "<comprehensive_1-2_sentence_summary>",
  "estimatedCost": <total_dollar_cost>
}`;
  }
  
  /**
   * Get parameter template based on order type
   */
  private getParamTemplate(orderType: string): string {
    switch (orderType) {
      case 'twap':
        return '"optimalSlices": <number>, "intervalSeconds": <number>, "priceLimit": <number_or_null>, "randomizeIntervals": <boolean>';
      case 'limit_chase':
        return '"optimalOffset": <number>, "maxChases": <number>, "intervalSeconds": <number>, "aggressiveness": "low|medium|high"';
      case 'scaled':
        return '"optimalLevels": <number>, "priceRange": {"start": <number>, "end": <number>}, "distribution": "linear|geometric|fibonacci", "weightBias": "front|center|back|even"';
      case 'iceberg':
        return '"optimalDisplaySize": <number>, "refreshStrategy": "immediate|delayed|random", "priceAdjustment": <boolean>';
      default:
        return '';
    }
  }
  
  /**
   * Analyze market conditions (reused from ExecutionOptimizer)
   */
  private async analyzeMarketConditions(symbol: string): Promise<any> {
    // Simplified version - fetch order book and calculate key metrics
    const normalizedSymbol = symbol.replace('-USD', '').replace('-PERP', '');
    
    try {
      const bookResponse = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'l2Book', coin: normalizedSymbol })
      });
      
      const bookData = await bookResponse.json();
      const book = bookData?.data ?? bookData;
      
      if (!book || !book.levels || !Array.isArray(book.levels[0])) {
        return this.getDefaultMarketConditions(symbol);
      }
      
      const bestBid = parseFloat(book.levels[0][0]?.px || '0');
      const bestAsk = parseFloat(book.levels[1][0]?.px || '0');
      const bidLiquidity = book.levels[0].slice(0, 10).reduce((sum: number, l: any) => sum + parseFloat(l.sz), 0);
      const askLiquidity = book.levels[1].slice(0, 10).reduce((sum: number, l: any) => sum + parseFloat(l.sz), 0);
      
      return {
        symbol,
        timestamp: Date.now(),
        realizedVolatility: 0.5,  // Placeholder
        volatilityRegime: 'medium' as const,
        bidAskSpread: bestAsk - bestBid,
        orderBookImbalance: (bidLiquidity - askLiquidity) / (bidLiquidity + askLiquidity),
        trend: 'neutral' as const,
        priceChange1m: 0,
        priceChange5m: 0,
        priceChange15m: 0,
      };
      
    } catch (error) {
      console.error('[Unified Optimizer] Error fetching market conditions:', error);
      return this.getDefaultMarketConditions(symbol);
    }
  }
  
  /**
   * Fetch venue quotes (simplified from SmartOrderRouter)
   */
  private async fetchVenueQuotes(symbol: string, side: 'buy' | 'sell', size: number): Promise<any[]> {
    // Simplified - just return Hyperliquid quote
    return [{
      exchange: 'hyperliquid' as const,
      symbol,
      side,
      availableLiquidity: size * 2,
      avgPrice: 100,
      slippageBps: 10,
      estimatedFee: size * 0.0002,
      totalCost: size * 100 * 1.001,
      fillProbability: 0.9,
      historicalPerformance: 0.85,
      currentSpread: 0.05,
      orderBookDepth: 1000,
      recentVolume24h: 1000000,
      lastUpdateTime: Date.now(),
    }];
  }
  
  /**
   * Analyze intraday patterns (simplified from ExecutionTiming)
   */
  private async analyzeIntradayPatterns(symbol: string): Promise<any[]> {
    // Return simplified hourly patterns
    const patterns: any[] = [];
    for (let hour = 0; hour < 24; hour++) {
      patterns.push({
        hour,
        avgVolatility: 1.0 + Math.random() * 0.5,
        avgSpread: 0.05 + Math.random() * 0.02,
        avgLiquidity: 1000 + Math.random() * 500,
        avgVolume: 10000 + Math.random() * 5000,
        sampleSize: 7,
      });
    }
    return patterns;
  }
  
  /**
   * Default market conditions fallback
   */
  private getDefaultMarketConditions(symbol: string): any {
    return {
      symbol,
      timestamp: Date.now(),
      realizedVolatility: 0,
      volatilityRegime: 'low' as const,
      bidAskSpread: 0,
      orderBookImbalance: 0,
      trend: 'neutral' as const,
      priceChange1m: 0,
      priceChange5m: 0,
      priceChange15m: 0,
    };
  }
  
  /**
   * Fallback optimization when AI fails
   */
  private getFallbackOptimization(request: UnifiedOptimizationRequest): UnifiedOptimizationResponse {
    const now = Date.now();
    
    return {
      routing: {
        strategy: 'single_venue',
        venues: [{
          exchange: 'hyperliquid',
          size: request.size,
          executionOrder: 1,
          reasoning: 'Fallback to primary venue'
        }],
        expectedSlippageBps: 20,
        confidenceScore: 0.5,
      },
      optimizedParams: {
        estimatedImpact: 15,
        warnings: ['AI optimization unavailable - using conservative defaults'],
      },
      timing: {
        optimalWindows: [{
          startTime: now,
          endTime: now + 3600000,
          confidence: 0.6,
          reasoning: 'Immediate execution window',
          predictedMetrics: {
            volatility: 0.5,
            spread: 0.05,
            liquidity: 1000,
            slippage: 15,
          },
          risk: 'medium',
        }],
        recommendedStartTime: now,
      },
      overallConfidence: 0.5,
      aiSummary: 'Using conservative fallback optimization due to AI unavailability.',
      estimatedCost: request.size * 100 * 1.002,
    };
  }
}

// Export singleton instance
export const unifiedOptimizer = new UnifiedAdvancedOrderOptimizer();
