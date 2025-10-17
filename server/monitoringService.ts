import { storage } from "./storage";
import { getUserHyperliquidClient } from "./hyperliquid/client";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { makeAIRequest } from "./aiRouter";

interface MarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

interface VolumeProfile {
  symbol: string;
  volumeRatio: number; // Current volume vs 30-day average
  volumeTrend: "increasing" | "decreasing" | "stable";
  significance: "high" | "medium" | "low";
}

interface TradingAction {
  action: "buy" | "sell" | "hold" | "close" | "stop_loss" | "take_profit" | "cancel_order";
  symbol: string;
  side: "long" | "short";
  size: string;
  leverage: number;
  reasoning: string;
  expectedEntry?: string;
  stopLoss?: string;
  takeProfit?: string;
  triggerPrice?: string;
  orderId?: number; // For cancel_order action
}

interface AutonomousStrategy {
  tradeThesis: string;
  marketRegime: "bullish" | "bearish" | "neutral" | "volatile";
  volumeAnalysis: string;
  actions: TradingAction[];
  riskAssessment: string;
  expectedSharpeImpact: string;
}

function analyzeVolumeProfile(marketData: MarketData[]): VolumeProfile[] {
  // Calculate total market volume for baseline comparison
  const totalVolume = marketData.reduce((sum, m) => sum + parseFloat(m.volume24h || "0"), 0);
  const avgMarketVolume = totalVolume / (marketData.length || 1);
  
  return marketData.map(m => {
    const volume = parseFloat(m.volume24h || "0");
    // Compare asset volume to market average (relative strength indicator)
    const volumeRatio = avgMarketVolume > 0 ? volume / avgMarketVolume : 1;
    
    let volumeTrend: "increasing" | "decreasing" | "stable" = "stable";
    let significance: "high" | "medium" | "low" = "low";
    
    // Assets with significantly above-average volume indicate strong interest/momentum
    if (volumeRatio > 2.0) {
      volumeTrend = "increasing";
      significance = "high";
    } else if (volumeRatio > 1.5) {
      volumeTrend = "increasing";
      significance = "medium";
    } else if (volumeRatio < 0.5) {
      volumeTrend = "decreasing";
      significance = "medium";
    } else if (volumeRatio < 0.3) {
      volumeTrend = "decreasing";
      significance = "high";
    }
    
    return {
      symbol: m.symbol,
      volumeRatio,
      volumeTrend,
      significance
    };
  });
}

function identifyMarketRegime(marketData: MarketData[]): { regime: string; confidence: number; reasoning: string } {
  const totalAssets = marketData.length;
  if (totalAssets === 0) {
    return { regime: "neutral", confidence: 0, reasoning: "No market data available" };
  }
  
  const gainers = marketData.filter(m => parseFloat(m.change24h || "0") > 0).length;
  const losers = marketData.filter(m => parseFloat(m.change24h || "0") < 0).length;
  
  const avgChange = marketData.reduce((sum, m) => sum + parseFloat(m.change24h || "0"), 0) / totalAssets;
  const volatility = Math.sqrt(
    marketData.reduce((sum, m) => sum + Math.pow(parseFloat(m.change24h || "0") - avgChange, 2), 0) / totalAssets
  );
  
  let regime = "neutral";
  let confidence = 50;
  let reasoning = "";
  
  if (volatility > 5) {
    regime = "volatile";
    confidence = 75;
    reasoning = `High volatility detected (${volatility.toFixed(2)}%), market is choppy and uncertain`;
  } else if (gainers > losers * 1.8 && avgChange > 2) {
    regime = "bullish";
    confidence = 80;
    reasoning = `Strong bullish momentum: ${gainers} gainers vs ${losers} losers, avg +${avgChange.toFixed(2)}%`;
  } else if (losers > gainers * 1.8 && avgChange < -2) {
    regime = "bearish";
    confidence = 80;
    reasoning = `Clear bearish trend: ${losers} losers vs ${gainers} gainers, avg ${avgChange.toFixed(2)}%`;
  } else if (gainers > losers * 1.3) {
    regime = "bullish";
    confidence = 60;
    reasoning = `Moderate bullish bias: ${gainers} gainers vs ${losers} losers`;
  } else if (losers > gainers * 1.3) {
    regime = "bearish";
    confidence = 60;
    reasoning = `Moderate bearish bias: ${losers} losers vs ${gainers} gainers`;
  } else {
    reasoning = `Balanced market: ${gainers} gainers, ${losers} losers, mixed signals`;
  }
  
  return { regime, confidence, reasoning };
}

export async function developAutonomousStrategy(userId: string): Promise<void> {
  try {
    console.log(`[Autonomous Trading] Developing trade thesis for user ${userId}...`);
    
    const hyperliquidClient = await getUserHyperliquidClient(userId);
    if (!hyperliquidClient) {
      console.log(`[Autonomous Trading] Hyperliquid client not initialized for user ${userId}`);
      return;
    }
    
    // Fetch market data, current positions, and open orders
    const marketData = await hyperliquidClient.getMarketData();
    const hyperliquidPositions = await hyperliquidClient.getPositions();
    const openOrders = await hyperliquidClient.getOpenOrders();
    
    if (!marketData || marketData.length === 0) {
      console.log("[Autonomous Trading] No market data available");
      return;
    }
    
    // Analyze volume profiles
    const volumeProfiles = analyzeVolumeProfile(marketData);
    const highVolumeAssets = volumeProfiles
      .filter(v => v.significance === "high")
      .sort((a, b) => b.volumeRatio - a.volumeRatio)
      .slice(0, 5);
    
    // Identify market regime
    const marketRegime = identifyMarketRegime(marketData);
    
    // Format current positions
    const currentPositions = hyperliquidPositions.map(pos => {
      const positionValue = parseFloat(pos.positionValue);
      const unrealizedPnl = parseFloat(pos.unrealizedPnl);
      const pnlPercent = positionValue !== 0 ? (unrealizedPnl / positionValue) * 100 : 0;
      const marketPrice = marketData.find(m => m.symbol === pos.coin)?.price || pos.entryPx;
      
      return {
        symbol: pos.coin,
        side: parseFloat(pos.szi) > 0 ? 'long' : 'short',
        size: Math.abs(parseFloat(pos.szi)),
        entryPrice: parseFloat(pos.entryPx),
        currentPrice: parseFloat(marketPrice),
        leverage: pos.leverage.value,
        pnlPercent: pnlPercent,
        liquidationPrice: pos.liquidationPx ? parseFloat(pos.liquidationPx) : null,
      };
    });
    
    // Fetch user prompt history to learn trading style
    let promptHistory: {timestamp: Date, prompt: string}[] = [];
    try {
      const recentPrompts = await storage.getAiUsageLogs(userId, 10);
      promptHistory = recentPrompts
        .filter(log => log.success === 1 && log.userPrompt && !log.userPrompt.includes("[AUTOMATED"))
        .slice(0, 5)
        .map(log => ({
          timestamp: log.timestamp,
          prompt: log.userPrompt!
        }));
    } catch (historyError) {
      console.error("Failed to fetch prompt history:", historyError);
    }
    
    // Get top performers for context
    const sorted = [...marketData].sort((a, b) => parseFloat(b.change24h) - parseFloat(a.change24h));
    const topGainers = sorted.slice(0, 3);
    const topLosers = sorted.slice(-3).reverse();
    
    const prompt = `You are Mr. Fox, an autonomous AI trader. Develop a complete trade thesis and execute trades based on current market conditions.

MARKET REGIME ANALYSIS:
${marketRegime.reasoning}
Regime: ${marketRegime.regime} (confidence: ${marketRegime.confidence}%)

VOLUME PROFILE ANALYSIS:
High Volume Assets (potential breakout opportunities):
${highVolumeAssets.map(v => `- ${v.symbol}: ${v.volumeTrend} volume (${v.volumeRatio.toFixed(2)}x ratio)`).join('\n')}

MARKET DATA:
Top Gainers: ${topGainers.map(m => `${m.symbol} (+${m.change24h}%, Vol: $${(parseFloat(m.volume24h) / 1e6).toFixed(1)}M)`).join(', ')}
Top Losers: ${topLosers.map(m => `${m.symbol} (${m.change24h}%, Vol: $${(parseFloat(m.volume24h) / 1e6).toFixed(1)}M)`).join(', ')}

CURRENT POSITIONS:
${currentPositions.length > 0 ? currentPositions.map(pos => 
  `- ${pos.symbol}: ${pos.side.toUpperCase()} ${pos.size} @ $${pos.entryPrice} (${pos.leverage}x)
   Current: $${pos.currentPrice}, P&L: ${pos.pnlPercent.toFixed(2)}%${pos.liquidationPrice ? `, Liq: $${pos.liquidationPrice}` : ''}`
).join('\n') : 'No open positions'}

EXISTING OPEN ORDERS:
${openOrders.length > 0 ? openOrders.map(order => {
  const orderType = order.orderType?.trigger ? (order.orderType.trigger.tpsl === 'tp' ? 'TAKE PROFIT' : 'STOP LOSS') : 'LIMIT';
  const triggerPrice = order.orderType?.trigger?.triggerPx || order.limitPx;
  return `- ${order.coin}: ${orderType} | ID: ${order.oid} | Side: ${order.side} | Size: ${order.sz} | Trigger: $${triggerPrice}`;
}).join('\n') : 'No open orders'}

${promptHistory.length > 0 ? `LEARNED TRADING PATTERNS (from user prompts):
${promptHistory.map(p => `- ${new Date(p.timestamp).toLocaleDateString()}: "${p.prompt}"`).join('\n')}

Analyze these past prompts to understand the user's:
- Preferred trading style (aggressive/conservative)
- Risk tolerance and position sizing preferences
- Market bias and asset preferences
- Entry/exit timing patterns` : 'No historical trading patterns available yet'}

AUTONOMOUS TRADING DIRECTIVE:
1. Develop a clear trade thesis based on market regime, volume analysis, and technical indicators
2. Identify optimal entry opportunities aligned with the current regime
3. For each trade, specify exact entry prices, position sizes, leverage, stop losses, and take profits
4. **MANDATORY RISK MANAGEMENT (CRITICAL)**:
   - EVERY position MUST have BOTH a stop loss AND a take profit order at ALL times
   - NO EXCEPTIONS - even if you think the position is "safe", protective orders are REQUIRED
   - When opening a new position, IMMEDIATELY place both stop loss and take profit in the same action set
   - If a position lacks either protective order, place it IMMEDIATELY in the next cycle
   - Position levels based on: user's risk tolerance (from prompt history) + current market analysis + liquidation safety
5. Manage existing positions: adjust stops, take profits, or close positions based on risk/reward
6. **ASSESS EXISTING ORDERS WITH QUANTITATIVE CRITERIA**: For each existing stop loss and take profit order, evaluate against these thresholds:
   - KEEP the order if it meets ALL of these criteria:
     * Price has NOT moved more than 5% since order placement (check current price vs trigger price)
     * Risk/reward ratio is still >= 2:1 (measure distance to TP vs SL from current price)
     * Market regime has NOT changed (bullish→bearish or vice versa)
     * Order is still within 3 ATR (Average True Range) of current price
   - REPLACE the order ONLY if it FAILS one or more criteria above:
     * Price moved >5% making the level technically invalid
     * R:R dropped below 2:1 making it unfavorable
     * Regime change requires different exit strategy
     * Order is >3 ATR away (too far to be relevant)
   - **Default action: KEEP** - If uncertain or close to thresholds, maintain existing orders
7. **CANCEL ONLY WHEN NECESSARY**: If an order must be adjusted, cancel it FIRST with cancel_order action, THEN place the new order
8. **ONE ORDER PER TYPE**: Each position should have ONLY ONE stop loss and ONE take profit order maximum
9. Learn from user's historical prompts to align with their trading style and preferences
10. Focus on maximizing Sharpe ratio through optimal sizing and risk management

Respond in JSON format:
{
  "tradeThesis": "Detailed thesis explaining the current market opportunity and strategy",
  "marketRegime": "bullish" | "bearish" | "neutral" | "volatile",
  "volumeAnalysis": "Analysis of volume profiles and what they signal",
  "actions": [
    {
      "action": "cancel_order" | "buy" | "sell" | "close" | "stop_loss" | "take_profit",
      "symbol": "BTC-PERP" | "ETH-PERP" | etc,
      "side": "long" | "short",
      "size": "numeric value as string (e.g. '0.5', '1.0')",
      "leverage": 1-10,
      "reasoning": "Multi-timeframe analysis, entry trigger, volume confirmation, OR why canceling order",
      "expectedEntry": "numeric price as string" [for buy/sell],
      "triggerPrice": "numeric price as string" [for stop_loss/take_profit],
      "orderId": number [REQUIRED for cancel_order action]
    }
  ],
  "riskAssessment": "Portfolio risk analysis and position sizing rationale",
  "expectedSharpeImpact": "Expected impact on Sharpe ratio and compounding strategy"
}

CRITICAL ORDER MANAGEMENT RULES:
1. **VERIFY FULL RISK MANAGEMENT COVERAGE**: 
   - Before doing anything else, check if EVERY position has BOTH stop loss AND take profit orders
   - If ANY position is missing either order, place it IMMEDIATELY - this is the highest priority action
   - Example: If position has only stop loss, place take profit FIRST before considering any other actions
2. **Before placing new stop_loss or take_profit**: Check if one already exists for that position
3. **Evaluate existing orders with QUANTITATIVE METRICS**: For each existing order, calculate and check:
   - Price movement %: (current_price - trigger_price) / trigger_price * 100
   - Current risk/reward ratio: distance_to_TP / distance_to_SL
   - Regime consistency: has bullish/bearish designation changed?
   - ATR distance: is order within 3x Average True Range?
   - If ALL metrics pass thresholds (see directive #6), KEEP the order (don't include any action for it)
4. **If an order exists but needs adjustment**: 
   - FIRST: Include a cancel_order action with the existing orderId
   - In reasoning, CITE SPECIFIC METRICS: "Price moved 8.2% (>5% threshold), R:R dropped to 1.3:1 (<2:1 threshold), requiring replacement"
   - THEN: Include a new stop_loss or take_profit action with updated triggerPrice and full reasoning
5. **If an order exists and passes all thresholds**: Do NOT include any actions for it - let it remain as-is
6. **Each position limits**: Exactly ONE stop loss + ONE take profit order (BOTH REQUIRED, not optional)
7. **LIQUIDATION PRICE SAFETY (CRITICAL)**: 
   - For LONG positions: Stop loss MUST be placed ABOVE liquidation price with at least 2% buffer (e.g., if liq=$3700, minimum stop=$3774)
   - For SHORT positions: Stop loss MUST be placed BELOW liquidation price with at least 2% buffer (e.g., if liq=$4300, maximum stop=$4214)
   - NEVER set stops at or past liquidation levels - this causes instant liquidation without controlled exit
   - Stop losses use MARKET execution for guaranteed fills when triggered
   - Take profits use LIMIT execution for better prices
8. ALL numeric values (size, expectedEntry, triggerPrice, orderId) must be actual numbers as strings, NEVER placeholders
9. For buy/sell actions, expectedEntry is REQUIRED (Hyperliquid uses limit orders only)
10. For stop_loss/take_profit, triggerPrice is REQUIRED
11. For cancel_order, orderId is REQUIRED and reasoning MUST cite which threshold(s) failed with actual calculated values
12. Close actions must have matching side to the existing position
13. Focus on high-probability setups aligned with market regime
14. **NEW POSITIONS**: When opening a position via buy/sell action, ALWAYS include BOTH stop_loss AND take_profit actions in the SAME response
15. If no good opportunities exist AND all existing positions have valid protective orders, actions can be empty array
16. **DISCIPLINED DECISION-MAKING**: Never cancel orders based on "feels" - only based on concrete threshold violations with cited metrics`;

    const aiResponse = await makeAIRequest(userId, {
      messages: [
        { 
          role: "system", 
          content: "You are Mr. Fox, an expert autonomous crypto trader focused on maximizing Sharpe ratio through professional risk management and multi-timeframe analysis. Always respond with valid JSON." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const content = aiResponse.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Clean the response - extract only the JSON part
    let cleanedContent = content.trim();
    
    // Handle markdown-wrapped JSON (text before code block)
    // Look for ```json or ``` followed by JSON content
    // CRITICAL: Capture ALL content between code fences, not just to first closing brace
    const jsonBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      cleanedContent = jsonBlockMatch[1].trim();
    } else {
      // Fallback: remove code fences if they start the content
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```[\s\S]*$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```[\s\S]*$/, '');
      }
      
      // Safety net: Find first "{" and last "}" to extract JSON
      const firstBrace = cleanedContent.indexOf('{');
      const lastBrace = cleanedContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedContent = cleanedContent.substring(firstBrace, lastBrace + 1);
      }
    }

    let strategy: AutonomousStrategy;
    try {
      strategy = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("[Autonomous Trading] Failed to parse AI response as JSON:", cleanedContent);
      throw new Error("AI returned invalid JSON");
    }

    // Log AI usage
    await storage.logAiUsage(userId, {
      provider: aiResponse.provider,
      model: aiResponse.model,
      promptTokens: aiResponse.usage.promptTokens,
      completionTokens: aiResponse.usage.completionTokens,
      totalTokens: aiResponse.usage.totalTokens,
      estimatedCost: aiResponse.cost.toFixed(6),
      userPrompt: "[AUTONOMOUS TRADING]",
      aiResponse: JSON.stringify(strategy),
      success: 1,
    });

    console.log(`[Autonomous Trading] Trade thesis: ${strategy.tradeThesis}`);
    console.log(`[Autonomous Trading] Market regime: ${strategy.marketRegime}`);
    console.log(`[Autonomous Trading] Generated ${strategy.actions.length} actions`);

    // Execute trades if actions exist
    if (strategy.actions && strategy.actions.length > 0) {
      try {
        const executionSummary = await executeTradeStrategy(userId, strategy.actions);
        
        console.log(`[Autonomous Trading] Executed ${executionSummary.successfulExecutions}/${executionSummary.totalActions} trades`);
        
        // Create portfolio snapshot after successful trades
        if (executionSummary.successfulExecutions > 0) {
          await createPortfolioSnapshot(userId, hyperliquidClient);
        }
        
        // Log the autonomous trading session
        await storage.createMonitoringLog(userId, {
          analysis: JSON.stringify({
            tradeThesis: strategy.tradeThesis,
            marketRegime: strategy.marketRegime,
            volumeAnalysis: strategy.volumeAnalysis,
            riskAssessment: strategy.riskAssessment,
            expectedSharpeImpact: strategy.expectedSharpeImpact,
            execution: {
              totalActions: executionSummary.totalActions,
              successful: executionSummary.successfulExecutions,
              failed: executionSummary.failedExecutions,
              results: executionSummary.results
            }
          }),
          alertLevel: executionSummary.successfulExecutions > 0 ? "info" : "warning",
          suggestions: strategy.actions.map(a => 
            `${a.action.toUpperCase()} ${a.symbol} ${a.side} ${a.size} @ ${a.expectedEntry || a.triggerPrice || 'market'}`
          ).join(" | "),
        });
        
      } catch (execError: any) {
        console.error("[Autonomous Trading] Failed to execute trades:", execError);
        
        // Log the failed execution
        await storage.createMonitoringLog(userId, {
          analysis: JSON.stringify({
            tradeThesis: strategy.tradeThesis,
            marketRegime: strategy.marketRegime,
            error: execError.message || "Trade execution failed"
          }),
          alertLevel: "critical",
          suggestions: "Trade execution failed - check logs for details",
        });
      }
    } else {
      console.log("[Autonomous Trading] No trading opportunities identified");
      
      // Log the analysis even if no trades
      await storage.createMonitoringLog(userId, {
        analysis: JSON.stringify({
          tradeThesis: strategy.tradeThesis,
          marketRegime: strategy.marketRegime,
          volumeAnalysis: strategy.volumeAnalysis,
          noTradesReason: "No high-probability setups aligned with market regime"
        }),
        alertLevel: "info",
        suggestions: "No immediate trading opportunities - monitoring continues",
      });
    }
    
  } catch (error) {
    console.error("[Autonomous Trading] Error during autonomous trading:", error);
  }
}

// DEPRECATED: These global monitoring functions have been replaced with per-user monitoring
// See userMonitoringManager.ts for the new per-user implementation
// These are kept for backwards compatibility but should not be used

let monitoringInterval: NodeJS.Timeout | null = null;
let currentIntervalMinutes: number = 5;

/**
 * @deprecated Use userMonitoringManager.startUserMonitoring(userId, intervalMinutes) instead
 */
export function startMonitoring(intervalMinutes: number = 5): void {
  console.warn("[DEPRECATED] Global startMonitoring is deprecated. Use userMonitoringManager instead.");
  if (intervalMinutes === 0) {
    console.log("[Autonomous Trading] Monitoring is disabled");
    return;
  }
  currentIntervalMinutes = intervalMinutes;
}

/**
 * @deprecated Use userMonitoringManager.stopUserMonitoring(userId) instead
 */
export function stopMonitoring(): void {
  console.warn("[DEPRECATED] Global stopMonitoring is deprecated. Use userMonitoringManager instead.");
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

/**
 * @deprecated Use userMonitoringManager.restartUserMonitoring(userId, intervalMinutes) instead
 */
export function restartMonitoring(intervalMinutes: number): void {
  console.warn("[DEPRECATED] Global restartMonitoring is deprecated. Use userMonitoringManager instead.");
  stopMonitoring();
  currentIntervalMinutes = intervalMinutes;
}

export function getCurrentInterval(): number {
  return currentIntervalMinutes;
}
