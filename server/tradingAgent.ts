import { openai } from "./openai";

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
  // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
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
    response_format: { type: "json_object" },
    max_completion_tokens: 8192
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as TradingStrategy;
}
