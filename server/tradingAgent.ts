import { perplexity, calculateCost, type PerplexityModel } from "./perplexity";
import { storage } from "./storage";

interface MarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

interface TradingAction {
  action: "buy" | "sell" | "hold" | "close" | "stop_loss" | "take_profit";
  symbol: string;
  side: "long" | "short";
  size: string;
  leverage: number;
  reasoning: string;
  expectedEntry?: string;
  stopLoss?: string;
  takeProfit?: string;
  triggerPrice?: string; // For stop_loss and take_profit actions
}

interface TradingStrategy {
  interpretation: string;
  actions: TradingAction[];
  riskManagement: string;
  expectedOutcome: string;
}

function analyzeMarketTrends(marketData: MarketData[]): string {
  // Calculate overall market sentiment based on 24h changes
  const totalAssets = marketData.length;
  const gainers = marketData.filter(m => parseFloat(m.change24h) > 0).length;
  const losers = marketData.filter(m => parseFloat(m.change24h) < 0).length;
  const neutral = totalAssets - gainers - losers;

  // Find top performers
  const sorted = [...marketData].sort((a, b) => parseFloat(b.change24h) - parseFloat(a.change24h));
  const topGainers = sorted.slice(0, 3);
  const topLosers = sorted.slice(-3).reverse();

  // Calculate average changes
  const avgChange = marketData.reduce((sum, m) => sum + parseFloat(m.change24h), 0) / totalAssets;
  
  // Determine market sentiment
  let sentiment = "Mixed";
  if (gainers > losers * 1.5) sentiment = "Bullish";
  else if (losers > gainers * 1.5) sentiment = "Bearish";

  // Calculate total volume
  const totalVolume = marketData.reduce((sum, m) => sum + parseFloat(m.volume24h), 0);
  const avgVolume = totalVolume / totalAssets;

  return `Market Sentiment: ${sentiment}
- ${gainers} gainers, ${losers} losers, ${neutral} neutral
- Average 24h change: ${avgChange.toFixed(2)}%
- Top gainers: ${topGainers.map(m => `${m.symbol} (${m.change24h}%)`).join(', ')}
- Top losers: ${topLosers.map(m => `${m.symbol} (${m.change24h}%)`).join(', ')}
- Total 24h volume: $${(totalVolume / 1e9).toFixed(2)}B
- Average volume per asset: $${(avgVolume / 1e6).toFixed(2)}M

Market conditions suggest ${sentiment.toLowerCase()} momentum with ${avgChange > 0 ? 'positive' : 'negative'} overall trend.`;
}

export async function processTradingPrompt(
  prompt: string,
  marketData: MarketData[],
  currentPositions: any[],
  model: PerplexityModel = "sonar"
): Promise<TradingStrategy> {
  
  try {
    // Fetch recent user prompt history (last 5 successful prompts)
    let promptHistory: {timestamp: Date, prompt: string}[] = [];
    try {
      const recentPrompts = await storage.getAiUsageLogs(5);
      promptHistory = recentPrompts
        .filter(log => log.success === 1 && log.userPrompt)
        .map(log => ({
          timestamp: log.timestamp,
          prompt: log.userPrompt!  // Already filtered for non-null
        }));
    } catch (historyError) {
      console.error("Failed to fetch prompt history:", historyError);
      // Continue without history
    }

    // Analyze market trends from current data
    let marketTrends = "Market data not available";
    try {
      if (marketData && marketData.length > 0) {
        marketTrends = analyzeMarketTrends(marketData);
      }
    } catch (trendError) {
      console.error("Failed to analyze market trends:", trendError);
      // Continue with fallback message
    }

    const completion = await perplexity.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are Mr. Fox, a professional AI trader managing Hyperliquid perpetual contracts. Your goal is to maximize the Sharpe ratio by executing trades with optimal sizing, entries, exits, and compounding, while enforcing strict risk management.

Core Trading Principles:
- Analyze multiple timeframes (1m to Daily) using the most appropriate and best technical indicators, price action and order flow strategies, to identify overall market regime: Bullish, Neutral, or Bearish
- Generate high-probability trade setups with clear entry triggers, aligned across timeframes
- Calculate position size based on a fixed risk percentage per trade adjusted for volatility, ensuring max drawdown and exposure limits are never breached
- Execute entries with defined stop loss and take profit rules based on key levels and perceived best metrics; use trailing stops to protect gains
- Compound gains by reinvesting a controlled portion of profits, prioritizing growth of risk-adjusted returns over raw gain maximization
- Continuously monitor Sharpe ratio, drawdown, and risk metrics; halt new trades if risk limits or performance thresholds are violated
- Respect portfolio size, funding costs, liquidity, and margin requirements for perpetuals at all times

Analysis Guidelines:
- Consider current price trends and momentum indicators from 24h data
- Implement professional risk management through precise position sizing
- Time entries and exits based on multi-timeframe technical analysis
- Account for user's historical trading preferences and patterns
- Evaluate overall market sentiment and volatility conditions
- Factor in funding rates, liquidity depth, and margin efficiency

IMPORTANT: You must respond ONLY with valid JSON. No other text before or after the JSON object.

JSON format:
{
  "interpretation": "Professional analysis of market conditions, regime identification, and alignment with user's trading history",
  "actions": [
    {
      "action": "buy" | "sell" | "hold" | "close" | "stop_loss" | "take_profit",
      "symbol": "BTC-PERP" | "ETH-PERP" | "SOL-PERP" etc,
      "side": "long" | "short",
      "size": "numeric value as string (e.g. '0.5', '1.25', '10') - MUST be actual number, NOT 'calculated'",
      "leverage": 1-10,
      "reasoning": "Technical analysis across timeframes, entry trigger, risk management rationale",
      "expectedEntry": "numeric price as string (e.g. '45000.5')" [for buy/sell actions],
      "triggerPrice": "numeric price as string (e.g. '44000')" [REQUIRED for stop_loss/take_profit actions - the price that triggers the order]
    }
  ],
  "riskManagement": "Detailed risk management strategy including position sizing methodology, stop loss placement, and exposure limits",
  "expectedOutcome": "Expected Sharpe ratio impact, potential drawdown, and compounding strategy"
}

CRITICAL RULES:
1. The 'size' field must ALWAYS contain an actual numeric value (like "0.5" or "10"), NEVER the word "calculated" or any placeholder text.
2. To place stop loss orders, use action: "stop_loss" with triggerPrice set to the stop loss price
3. To place take profit orders, use action: "take_profit" with triggerPrice set to the take profit price
4. DO NOT use "hold" actions with stopLoss/takeProfit fields - those fields are ignored. Instead, generate separate stop_loss and take_profit ORDER actions.
5. When user asks to set stop losses or take profits, generate actual stop_loss/take_profit actions for each position.

Output real-time executed trades with professional precision and risk-adjusted optimization.`
      },
      {
        role: "user",
        content: `User prompt: "${prompt}"

Current market data:
${JSON.stringify(marketData, null, 2)}

Market analysis:
${marketTrends}

Current positions:
${currentPositions.length > 0 ? JSON.stringify(currentPositions, null, 2) : "No open positions"}

${promptHistory.length > 0 ? `Recent user prompt history (for context on trading style and preferences):
${promptHistory.map(p => `- ${new Date(p.timestamp).toLocaleString()}: "${p.prompt}"`).join('\n')}

Consider the user's historical prompts to understand their trading style, risk tolerance, and strategic preferences. Build upon previous strategies and refine suggestions based on learned patterns.` : ''}

Generate a trading strategy that addresses the user's current prompt while considering their historical preferences and maximizing risk-adjusted returns based on current market conditions. Remember to respond with ONLY the JSON object, no other text.`
      }
    ]
  });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Clean the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Parse the strategy before logging
    const strategy = JSON.parse(cleanedContent) as TradingStrategy;

    // Log usage and cost
    const usage = completion.usage;
    if (usage) {
      const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);
      
      try {
        await storage.logAiUsage({
          provider: "perplexity",
          model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          estimatedCost: cost.toFixed(6),
          userPrompt: prompt,
          aiResponse: JSON.stringify(strategy),
          success: 1
        });
      } catch (error) {
        console.error("Failed to log AI usage:", error);
      }
    }

    return strategy;
  } catch (error) {
    // Log failed attempt
    try {
      await storage.logAiUsage({
        provider: "perplexity",
        model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: "0",
        userPrompt: prompt,
        success: 0
      });
    } catch (logError) {
      console.error("Failed to log AI usage error:", logError);
    }
    
    // Re-throw the original error
    throw error;
  }
}
