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

export async function processTradingPrompt(
  prompt: string,
  marketData: MarketData[],
  currentPositions: any[]
): Promise<TradingStrategy> {
  const model: PerplexityModel = "sonar";
  
  try {
    const completion = await perplexity.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a market analysis assistant for an educational cryptocurrency trading simulation platform. Your role is to provide educational trading strategy suggestions for learning purposes.

When analyzing market data, consider:
1. Current price trends and momentum indicators
2. Risk management through appropriate position sizing
3. Entry and exit timing based on technical analysis
4. Portfolio diversification strategies

Guidelines for educational strategy suggestions:
- Focus on balanced risk-reward approaches
- Suggest appropriate position sizing (using numeric multipliers 1-10)
- Include risk management with stop loss levels
- Consider market conditions and volatility patterns
- Provide educational reasoning for each suggestion

Respond with valid JSON in this format:
{
  "interpretation": "Brief explanation of the analysis request",
  "actions": [
    {
      "action": "buy" | "sell" | "hold" | "close",
      "symbol": "BTC-PERP" | "ETH-PERP" | "SOL-PERP" etc,
      "side": "long" | "short",
      "size": "position size as decimal string",
      "leverage": 1-10,
      "reasoning": "Educational reasoning for this suggestion",
      "expectedEntry": "optional target entry price",
      "stopLoss": "optional stop loss level",
      "takeProfit": "optional profit target"
    }
  ],
  "riskManagement": "Overall risk management approach",
  "expectedOutcome": "Educational analysis of potential outcomes"
}

Note: All suggestions are for educational simulation purposes only.`
      },
      {
        role: "user",
        content: `User prompt: "${prompt}"

Current market data:
${JSON.stringify(marketData, null, 2)}

Current positions:
${currentPositions.length > 0 ? JSON.stringify(currentPositions, null, 2) : "No open positions"}

Generate a trading strategy that addresses the user's prompt while maximizing risk-adjusted returns.`
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
