/**
 * Smart Order Router (SOR) - AI-Powered Multi-Exchange Routing
 * 
 * Analyzes real-time liquidity, fees, and execution quality across Hyperliquid and Orderly Network
 * to determine optimal order routing that minimizes slippage and maximizes fill rate.
 * 
 * Goes beyond Insilico Terminal by using AI to:
 * - Predict execution quality based on historical performance
 * - Dynamically split orders across venues
 * - Adapt routing strategy based on market conditions
 */

import { makeAIRequest } from "../aiRouter";

interface VenueQuote {
  exchange: 'hyperliquid' | 'orderly';
  symbol: string;
  side: 'buy' | 'sell';
  
  // Liquidity metrics
  availableLiquidity: number;  // Total available at best levels
  avgPrice: number;             // VWAP for this size
  slippageBps: number;          // Expected slippage in basis points
  
  // Cost analysis
  estimatedFee: number;         // Trading fee
  totalCost: number;            // avgPrice + fees + slippage
  
  // Quality metrics
  fillProbability: number;      // AI-predicted fill probability (0-1)
  historicalPerformance: number; // Past execution quality score
  currentSpread: number;        // Bid-ask spread
  
  // Venue-specific data
  orderBookDepth: number;       // Orders in top 10 levels
  recentVolume24h: number;      // 24h volume
  lastUpdateTime: number;       // Timestamp of quote
}

interface RoutingDecision {
  strategy: 'single_venue' | 'split_order' | 'sequential';
  venues: Array<{
    exchange: 'hyperliquid' | 'orderly';
    size: number;
    executionOrder: number; // For sequential routing
    reasoning: string;
  }>;
  expectedSlippageBps: number;
  expectedFillTime: number; // Estimated time to complete fill (ms)
  confidenceScore: number;  // AI confidence in this routing (0-1)
  aiReasoning: string;      // Natural language explanation
}

export class SmartOrderRouter {
  private performanceCache: Map<string, Array<{ timestamp: number; slippage: number; venue: string }>> = new Map();
  
  /**
   * Analyze and route an order across optimal venues
   */
  async routeOrder(params: {
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    urgency: 'low' | 'medium' | 'high'; // How quickly order needs to fill
    maxSlippageBps?: number;
    userId: string;
  }): Promise<RoutingDecision> {
    
    // Fetch quotes from all available venues
    const quotes = await this.fetchVenueQuotes(params.symbol, params.side, params.size);
    
    // Filter out stale or invalid quotes
    const validQuotes = quotes.filter(q => 
      q.availableLiquidity >= params.size * 0.1 && // At least 10% liquidity
      (Date.now() - q.lastUpdateTime) < 5000 // Quote less than 5s old
    );
    
    // Handle degraded state when no valid quotes are available
    if (validQuotes.length === 0) {
      console.warn('[SOR] No valid quotes available, returning degraded routing decision');
      return {
        strategy: 'single_venue',
        venues: [{
          exchange: quotes.length > 0 ? quotes[0].exchange : 'hyperliquid',
          size: params.size,
          executionOrder: 1,
          reasoning: 'No valid liquidity available - market data temporarily unavailable'
        }],
        expectedSlippageBps: 999999,
        expectedFillTime: 0,
        confidenceScore: 0,
        aiReasoning: 'Unable to route order due to insufficient market data. Please try again or use manual order entry.',
      };
    }
    
    // Use AI to determine optimal routing strategy
    const routing = await this.determineRoutingStrategy({
      quotes: validQuotes,
      orderSize: params.size,
      urgency: params.urgency,
      maxSlippageBps: params.maxSlippageBps,
      userId: params.userId,
    });
    
    // Record routing decision for learning
    await this.recordRoutingDecision(params.symbol, routing);
    
    return routing;
  }
  
  /**
   * Fetch real-time quotes from all exchanges
   */
  private async fetchVenueQuotes(
    symbol: string,
    side: 'buy' | 'sell',
    size: number
  ): Promise<VenueQuote[]> {
    
    const quotes: VenueQuote[] = [];
    
    try {
      // Fetch Hyperliquid quote
      const hlQuote = await this.getHyperliquidQuote(symbol, side, size);
      quotes.push(hlQuote);
    } catch (error) {
      console.error('[SOR] Failed to fetch Hyperliquid quote:', error);
    }
    
    try {
      // Fetch Orderly quote
      const orderlyQuote = await this.getOrderlyQuote(symbol, side, size);
      quotes.push(orderlyQuote);
    } catch (error) {
      console.error('[SOR] Failed to fetch Orderly quote:', error);
    }
    
    return quotes;
  }
  
  /**
   * Get execution quote from Hyperliquid
   */
  private async getHyperliquidQuote(
    symbol: string,
    side: 'buy' | 'sell',
    size: number
  ): Promise<VenueQuote> {
    
    // Fetch order book
    const bookResponse = await fetch(
      `https://api.hyperliquid.xyz/info`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'l2Book',
          coin: symbol.replace('-USD', '').replace('-PERP', '')
        })
      }
    );
    
    const bookData = await bookResponse.json();
    const book = bookData?.data ?? bookData; // Handle both response formats
    
    // Guard against missing book data
    if (!book || !book.levels || !Array.isArray(book.levels[0]) || !Array.isArray(book.levels[1])) {
      console.warn(`[SOR] Invalid book data for ${symbol} on Hyperliquid`);
      return {
        exchange: 'hyperliquid',
        symbol,
        side,
        availableLiquidity: 0,
        avgPrice: 0,
        slippageBps: 999999,
        estimatedFee: 0,
        totalCost: 0,
        fillProbability: 0,
        historicalPerformance: await this.getHistoricalPerformance(symbol, 'hyperliquid'),
        currentSpread: 0,
        orderBookDepth: 0,
        recentVolume24h: 0,
        lastUpdateTime: Date.now(),
      };
    }
    
    // Calculate VWAP and slippage
    const levels = (side === 'buy' ? book.levels?.[1] : book.levels?.[0]) || [];
    let remainingSize = size;
    let totalCost = 0;
    let liquidityFound = 0;
    
    for (const level of levels) {
      const levelPrice = parseFloat(level.px);
      const levelSize = parseFloat(level.sz);
      const sizeToTake = Math.min(remainingSize, levelSize);
      
      totalCost += levelPrice * sizeToTake;
      liquidityFound += levelSize;
      remainingSize -= sizeToTake;
      
      if (remainingSize <= 0) break;
    }
    
    const filledSize = size - remainingSize;
    const avgPrice = filledSize > 0 ? totalCost / filledSize : 0;
    const oppositeLevels = (side === 'buy' ? book.levels?.[0] : book.levels?.[1]) || [];
    const midPrice = (parseFloat(levels?.[0]?.px || '0') + parseFloat(oppositeLevels?.[0]?.px || '0')) / 2;
    const slippageBps = midPrice > 0 && avgPrice > 0 ? Math.abs((avgPrice - midPrice) / midPrice) * 10000 : 0;
    
    // Get historical performance
    const historicalPerformance = await this.getHistoricalPerformance(symbol, 'hyperliquid');
    
    return {
      exchange: 'hyperliquid',
      symbol,
      side,
      availableLiquidity: liquidityFound,
      avgPrice,
      slippageBps,
      estimatedFee: avgPrice * size * 0.0002, // 2 bps maker fee
      totalCost: avgPrice * size * 1.0002,
      fillProbability: remainingSize === 0 ? 0.95 : 0.7,
      historicalPerformance,
      currentSpread: Math.abs(parseFloat(book.levels?.[1]?.[0]?.px || '0') - parseFloat(book.levels?.[0]?.[0]?.px || '0')),
      orderBookDepth: levels.reduce((sum: number, l: any) => sum + parseFloat(l?.sz || '0'), 0),
      recentVolume24h: 0, // Would fetch from metadata
      lastUpdateTime: Date.now(),
    };
  }
  
  /**
   * Get execution quote from Orderly Network
   */
  private async getOrderlyQuote(
    symbol: string,
    side: 'buy' | 'sell',
    size: number
  ): Promise<VenueQuote> {
    
    // Normalize symbol for Orderly (PERP_BTC_USDC format)
    const orderlySymbol = `PERP_${symbol.replace('-USD', '').replace('-PERP', '')}_USDC`;
    
    // Fetch order book
    const bookResponse = await fetch(
      `https://api-evm.orderly.org/v1/orderbook/${orderlySymbol}`
    );
    
    const book = await bookResponse.json();
    
    if (!book.success) {
      throw new Error('Failed to fetch Orderly orderbook');
    }
    
    // Calculate VWAP and slippage
    const levels = side === 'buy' ? book.data.asks : book.data.bids;
    let remainingSize = size;
    let totalCost = 0;
    let liquidityFound = 0;
    
    for (const level of levels) {
      const levelPrice = parseFloat(level.price);
      const levelSize = parseFloat(level.quantity);
      const sizeToTake = Math.min(remainingSize, levelSize);
      
      totalCost += levelPrice * sizeToTake;
      liquidityFound += levelSize;
      remainingSize -= sizeToTake;
      
      if (remainingSize <= 0) break;
    }
    
    const avgPrice = totalCost / (size - remainingSize);
    const midPrice = (parseFloat(book.data.asks[0]?.price || '0') + parseFloat(book.data.bids[0]?.price || '0')) / 2;
    const slippageBps = Math.abs((avgPrice - midPrice) / midPrice) * 10000;
    
    // Get historical performance
    const historicalPerformance = await this.getHistoricalPerformance(symbol, 'orderly');
    
    return {
      exchange: 'orderly',
      symbol: orderlySymbol,
      side,
      availableLiquidity: liquidityFound,
      avgPrice,
      slippageBps,
      estimatedFee: avgPrice * size * 0.0003, // 3 bps taker fee
      totalCost: avgPrice * size * 1.0003,
      fillProbability: remainingSize === 0 ? 0.9 : 0.65,
      historicalPerformance,
      currentSpread: Math.abs(parseFloat(book.data.asks[0]?.price || '0') - parseFloat(book.data.bids[0]?.price || '0')),
      orderBookDepth: levels.reduce((sum: number, l: any) => sum + parseFloat(l.quantity), 0),
      recentVolume24h: 0, // Would fetch from API
      lastUpdateTime: Date.now(),
    };
  }
  
  /**
   * Use AI to determine optimal routing strategy
   */
  private async determineRoutingStrategy(params: {
    quotes: VenueQuote[];
    orderSize: number;
    urgency: 'low' | 'medium' | 'high';
    maxSlippageBps?: number;
    userId: string;
  }): Promise<RoutingDecision> {
    
    const prompt = `You are a smart order routing AI for a cryptocurrency trading platform. Analyze the following execution quotes and determine the optimal routing strategy.

Order Details:
- Size: ${params.orderSize}
- Urgency: ${params.urgency}
- Max Slippage: ${params.maxSlippageBps || 'none'} bps

Available Venues:
${params.quotes.map((q, i) => `
${i + 1}. ${q.exchange.toUpperCase()}
   - Available Liquidity: ${q.availableLiquidity}
   - Avg Price: $${q.avgPrice.toFixed(2)}
   - Slippage: ${q.slippageBps.toFixed(2)} bps
   - Fee: $${q.estimatedFee.toFixed(2)}
   - Total Cost: $${q.totalCost.toFixed(2)}
   - Fill Probability: ${(q.fillProbability * 100).toFixed(1)}%
   - Historical Performance: ${(q.historicalPerformance * 100).toFixed(1)}%
   - Spread: $${q.currentSpread.toFixed(2)}
   - Book Depth: ${q.orderBookDepth.toFixed(4)}
`).join('\n')}

Based on this data, recommend:
1. Strategy type (single_venue, split_order, or sequential)
2. How to allocate the order size across venues
3. Expected total slippage
4. Estimated fill time in milliseconds
5. Your confidence score (0-1)

Respond in JSON format:
{
  "strategy": "single_venue|split_order|sequential",
  "venues": [
    {
      "exchange": "hyperliquid|orderly",
      "size": <number>,
      "executionOrder": <number>,
      "reasoning": "<why this allocation>"
    }
  ],
  "expectedSlippageBps": <number>,
  "expectedFillTime": <milliseconds>,
  "confidenceScore": <0-1>,
  "aiReasoning": "<detailed explanation of routing decision>"
}`;

    try {
      const response = await makeAIRequest({
        messages: [{ role: 'user', content: prompt }],
        userId: params.userId,
        temperature: 0.3, // Lower temperature for more consistent routing
      });
      
      const decision = JSON.parse(response.content);
      return decision;
      
    } catch (error) {
      console.error('[SOR] AI routing failed, falling back to simple logic:', error);
      
      // Fallback: Route to venue with best total cost
      const bestQuote = params.quotes.reduce((best, current) => 
        current.totalCost < best.totalCost ? current : best
      );
      
      return {
        strategy: 'single_venue',
        venues: [{
          exchange: bestQuote.exchange,
          size: params.orderSize,
          executionOrder: 1,
          reasoning: 'Lowest total cost (fallback routing)',
        }],
        expectedSlippageBps: bestQuote.slippageBps,
        expectedFillTime: params.urgency === 'high' ? 1000 : 5000,
        confidenceScore: 0.7,
        aiReasoning: 'Fallback to simple cost-based routing due to AI unavailability',
      };
    }
  }
  
  /**
   * Get historical execution performance for a venue
   */
  private async getHistoricalPerformance(
    symbol: string,
    exchange: string
  ): Promise<number> {
    
    const key = `${symbol}-${exchange}`;
    const history = this.performanceCache.get(key) || [];
    
    if (history.length === 0) {
      return 0.8; // Default performance score
    }
    
    // Calculate average performance over last 100 executions
    const recent = history.slice(-100);
    const avgSlippage = recent.reduce((sum, h) => sum + h.slippage, 0) / recent.length;
    
    // Convert slippage to performance score (lower slippage = higher score)
    return Math.max(0, 1 - (avgSlippage / 100));
  }
  
  /**
   * Record routing decision for learning
   */
  private async recordRoutingDecision(
    symbol: string,
    decision: RoutingDecision
  ): Promise<void> {
    
    for (const venue of decision.venues) {
      const key = `${symbol}-${venue.exchange}`;
      const history = this.performanceCache.get(key) || [];
      
      history.push({
        timestamp: Date.now(),
        slippage: decision.expectedSlippageBps,
        venue: venue.exchange,
      });
      
      // Keep only last 500 executions
      if (history.length > 500) {
        history.shift();
      }
      
      this.performanceCache.set(key, history);
    }
  }
}

// Export singleton instance
export const smartOrderRouter = new SmartOrderRouter();
