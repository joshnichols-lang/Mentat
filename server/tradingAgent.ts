import { perplexity, calculateCost, type PerplexityModel } from "./perplexity";
import { storage } from "./storage";

interface MarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

interface TradingAction {
  action: "buy" | "sell" | "hold" | "close";
  symbol: string;
  side: "long" | "short";
  size: string;
  leverage: number;
  reasoning: string;
  expectedEntry?: string;
  stopLoss?: string;
  takeProfit?: string;
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
    const recentPrompts = await storage.getAiUsageLogs(5);
    const promptHistory = recentPrompts
      .filter(log => log.success === 1 && log.userPrompt)
      .map(log => ({
        timestamp: log.timestamp,
        prompt: log.userPrompt
      }));

    // Analyze market trends from current data
    const marketTrends = analyzeMarketTrends(marketData);

    const completion = await perplexity.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a market analysis assistant for an educational cryptocurrency trading simulation platform. Your role is to provide educational trading strategy suggestions for learning purposes.

When analyzing market data, consider:
1. Current price trends and momentum indicators from 24h data
2. Risk management through appropriate position sizing
3. Entry and exit timing based on technical analysis
4. Portfolio diversification strategies
5. User's historical trading preferences and patterns
6. Overall market sentiment and volatility

Guidelines for educational strategy suggestions:
- Focus on balanced risk-reward approaches
- Suggest appropriate position sizing (using numeric multipliers 1-10)
- Include risk management with stop loss levels
- Consider market conditions and volatility patterns
- Build upon user's previous prompts to refine strategy
- Provide educational reasoning for each suggestion

Respond with valid JSON in this format:
{
  "interpretation": "Brief explanation of the analysis request and how it relates to user's trading history",
  "actions": [
    {
      "action": "buy" | "sell" | "hold" | "close",
      "symbol": "BTC-PERP" | "ETH-PERP" | "SOL-PERP" etc,
      "side": "long" | "short",
      "size": "position size as decimal string",
      "leverage": 1-10,
      "reasoning": "Educational reasoning for this suggestion based on market conditions and user preferences",
      "expectedEntry": "optional target entry price",
      "stopLoss": "optional stop loss level",
      "takeProfit": "optional profit target"
    }
  ],
  "riskManagement": "Overall risk management approach considering user's trading style",
  "expectedOutcome": "Educational analysis of potential outcomes"
}

Note: All suggestions are for educational simulation purposes only.`
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

Generate a trading strategy that addresses the user's current prompt while considering their historical preferences and maximizing risk-adjusted returns based on current market conditions.`
      }
    ],
    response_format: { type: "json_object" }
  });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

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
          success: 1
        });
      } catch (error) {
        console.error("Failed to log AI usage:", error);
      }
    }

    return JSON.parse(content) as TradingStrategy;
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
