import { storage } from "./storage";
import { getHyperliquidClient } from "./hyperliquid/client";
import { perplexity, calculateCost } from "./perplexity";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { TEST_USER_ID } from "./constants";

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

async function developAutonomousStrategy(): Promise<void> {
  try {
    console.log("[Autonomous Trading] Developing trade thesis...");
    
    const hyperliquidClient = getHyperliquidClient();
    if (!hyperliquidClient) {
      console.log("[Autonomous Trading] Hyperliquid client not initialized");
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
      const recentPrompts = await storage.getAiUsageLogs(TEST_USER_ID, 10);
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
4. Manage existing positions: adjust stops, take profits, or close positions based on risk/reward
5. **ASSESS EXISTING ORDERS**: Review all open orders and determine if they're still valid given current market conditions
6. **CANCEL INVALID ORDERS**: If existing stop/take profit orders are no longer appropriate, cancel them FIRST before placing new ones
7. **ONE ORDER PER TYPE**: Each position should have ONLY ONE stop loss and ONE take profit order maximum
8. Learn from user's historical prompts to align with their trading style and preferences
9. Focus on maximizing Sharpe ratio through optimal sizing and risk management

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
1. **Before placing new stop_loss or take_profit**: Check if one already exists for that position
2. **If an order exists but needs adjustment**: 
   - FIRST: Include a cancel_order action with the existing orderId
   - THEN: Include a new stop_loss or take_profit action with updated triggerPrice
3. **If an order exists and is still valid**: Do NOT create duplicate orders
4. **Each position limits**: Maximum ONE stop loss + ONE take profit order
5. ALL numeric values (size, expectedEntry, triggerPrice, orderId) must be actual numbers as strings, NEVER placeholders
6. For buy/sell actions, expectedEntry is REQUIRED (Hyperliquid uses limit orders only)
7. For stop_loss/take_profit, triggerPrice is REQUIRED
8. For cancel_order, orderId is REQUIRED
9. Close actions must have matching side to the existing position
10. Focus on high-probability setups aligned with market regime
11. If no good opportunities exist, actions can be empty array`;

    const response = await perplexity.chat.completions.create({
      model: "sonar",
      messages: [
        { 
          role: "system", 
          content: "You are Mr. Fox, an expert autonomous crypto trader focused on maximizing Sharpe ratio through professional risk management and multi-timeframe analysis. Always respond with valid JSON." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Clean the response - extract only the JSON part
    let cleanedContent = content.trim();
    
    // Remove code fences if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```[\s\S]*$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```[\s\S]*$/, '');
    }
    
    // If there's text after the JSON (like explanations), remove it
    // Find the last closing brace of the JSON object
    const lastBraceIndex = cleanedContent.lastIndexOf('}');
    if (lastBraceIndex !== -1 && lastBraceIndex < cleanedContent.length - 1) {
      cleanedContent = cleanedContent.substring(0, lastBraceIndex + 1);
    }

    let strategy: AutonomousStrategy;
    try {
      strategy = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("[Autonomous Trading] Failed to parse AI response as JSON:", cleanedContent);
      throw new Error("AI returned invalid JSON");
    }

    // Log AI usage
    const usageData = response.usage;
    if (usageData) {
      const cost = calculateCost("sonar", usageData.prompt_tokens, usageData.completion_tokens);
      await storage.logAiUsage(TEST_USER_ID, {
        provider: "perplexity",
        model: "sonar",
        promptTokens: usageData.prompt_tokens,
        completionTokens: usageData.completion_tokens,
        totalTokens: usageData.total_tokens,
        estimatedCost: cost.toFixed(6),
        userPrompt: "[AUTONOMOUS TRADING]",
        aiResponse: JSON.stringify(strategy),
        success: 1,
      });
    }

    console.log(`[Autonomous Trading] Trade thesis: ${strategy.tradeThesis}`);
    console.log(`[Autonomous Trading] Market regime: ${strategy.marketRegime}`);
    console.log(`[Autonomous Trading] Generated ${strategy.actions.length} actions`);

    // Execute trades if actions exist
    if (strategy.actions && strategy.actions.length > 0) {
      try {
        const executionSummary = await executeTradeStrategy(TEST_USER_ID, strategy.actions);
        
        console.log(`[Autonomous Trading] Executed ${executionSummary.successfulExecutions}/${executionSummary.totalActions} trades`);
        
        // Create portfolio snapshot after successful trades
        if (executionSummary.successfulExecutions > 0) {
          await createPortfolioSnapshot(TEST_USER_ID, hyperliquidClient);
        }
        
        // Log the autonomous trading session
        await storage.createMonitoringLog(TEST_USER_ID, {
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
        await storage.createMonitoringLog(TEST_USER_ID, {
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
      await storage.createMonitoringLog(TEST_USER_ID, {
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

let monitoringInterval: NodeJS.Timeout | null = null;
let currentIntervalMinutes: number = 5;

export function startMonitoring(intervalMinutes: number = 5): void {
  if (monitoringInterval) {
    console.log("[Autonomous Trading] Already running");
    return;
  }

  if (intervalMinutes === 0) {
    console.log("[Autonomous Trading] Monitoring is disabled");
    return;
  }

  currentIntervalMinutes = intervalMinutes;
  console.log(`[Autonomous Trading] Starting autonomous trading engine (every ${intervalMinutes} minutes)`);
  
  // Run immediately on start
  developAutonomousStrategy();
  
  // Set up recurring interval
  monitoringInterval = setInterval(() => {
    developAutonomousStrategy();
  }, intervalMinutes * 60 * 1000);
}

export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("[Autonomous Trading] Stopped autonomous trading engine");
  }
}

export function restartMonitoring(intervalMinutes: number): void {
  console.log(`[Autonomous Trading] Restarting with interval: ${intervalMinutes} minutes`);
  
  // Stop current monitoring
  stopMonitoring();
  
  // Start with new interval (or stay stopped if 0)
  if (intervalMinutes > 0) {
    startMonitoring(intervalMinutes);
  } else {
    console.log("[Autonomous Trading] Autonomous trading disabled");
  }
  
  currentIntervalMinutes = intervalMinutes;
}

export function getCurrentInterval(): number {
  return currentIntervalMinutes;
}
