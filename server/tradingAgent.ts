import { storage } from "./storage";
import { TEST_USER_ID } from "./constants";
import { makeAIRequest, type AIMessage } from "./aiRouter";
import type { PerplexityModel } from "./perplexity";

interface MarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
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
  exitCriteria?: string; // Detailed reasoning for stop loss placement based on market structure
  expectedRoi?: string; // Expected ROI percentage for this trade
  triggerPrice?: string; // For stop_loss and take_profit actions
  orderId?: number; // For cancel_order action
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
  userId: string,
  prompt: string,
  marketData: MarketData[],
  currentPositions: any[],
  userState: any,
  model?: string,
  preferredProvider?: string,
  screenshots?: string[],
  strategyId?: string | null
): Promise<TradingStrategy> {
  
  try {
    // First, classify if this is a trading question or general question
    // If screenshots are attached, strongly bias towards trading
    let classification = { isTrading: true, reason: "default to trading" };
    
    // Simple keyword-based pre-check for obvious non-trading questions
    const generalKeywords = ['what is', 'who was', 'who is', 'when did', 'tell me about', 'calculate', 'news today', 'president', 'history of'];
    const tradingKeywords = ['buy', 'sell', 'close', 'position', 'portfolio', 'trade', 'market', 'price', 'chart', 'stop loss', 'take profit', 'long', 'short', 'leverage'];
    // Educational questions about specific technical indicators - treat as general questions
    const indicatorEducationKeywords = ['market cipher', 'cipher a', 'cipher b', 'what is rsi', 'what is macd', 'what is ema', 'what is sma', 'what is bollinger', 'what is stochastic', 'what is fibonacci', 'what is ichimoku', 'what is adx', 'what is atr', 'explain rsi', 'explain macd', 'explain ema', 'how does rsi', 'how does macd', 'how does bollinger'];
    
    const lowerPrompt = prompt.toLowerCase();
    const hasGeneralKeywords = generalKeywords.some(kw => lowerPrompt.includes(kw));
    const hasTradingKeywords = tradingKeywords.some(kw => lowerPrompt.includes(kw));
    const hasIndicatorEducationKeywords = indicatorEducationKeywords.some(kw => lowerPrompt.includes(kw));
    
    // Priority 1: If asking about specific technical indicators, treat as general (educational)
    if (hasIndicatorEducationKeywords) {
      classification = { isTrading: false, reason: "educational question about trading indicators" };
    }
    // Priority 2: If user attached screenshots, it's almost certainly trading
    else if (screenshots && screenshots.length > 0) {
      classification = { isTrading: true, reason: "screenshots attached - likely charts" };
    }
    // Priority 3: If has trading keywords, it's trading (even if also has general keywords)
    else if (hasTradingKeywords) {
      classification = { isTrading: true, reason: "trading keywords detected" };
    }
    // Priority 4: If ONLY has general keywords (no trading keywords), classify via AI
    else if (hasGeneralKeywords) {
      try {
        const classificationMessages: AIMessage[] = [
          {
            role: "system" as const,
            content: `Determine if this is about trading/markets OR a general question. Respond with JSON: {"isTrading": true/false, "reason": "brief"}`
          },
          {
            role: "user" as const,
            content: prompt
          }
        ];

        const classificationResponse = await makeAIRequest(userId, {
          messages: classificationMessages,
          model,
        }, preferredProvider);

        let cleanContent = classificationResponse.content?.trim() || '{}';
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        classification = JSON.parse(cleanContent);
      } catch (e) {
        console.log("Failed to classify - defaulting to general question");
        classification = { isTrading: false, reason: "classification failed - treated as general" };
      }
    }
    // Priority 5: No keywords at all - use AI to classify
    else {
      try {
        const classificationMessages: AIMessage[] = [
          {
            role: "system" as const,
            content: `Determine if this is about trading/markets OR a general question. Respond with JSON: {"isTrading": true/false, "reason": "brief"}`
          },
          {
            role: "user" as const,
            content: prompt
          }
        ];

        const classificationResponse = await makeAIRequest(userId, {
          messages: classificationMessages,
          model,
        }, preferredProvider);

        let cleanContent = classificationResponse.content?.trim() || '{}';
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        classification = JSON.parse(cleanContent);
      } catch (e) {
        console.log("Failed to classify no-keyword prompt - defaulting to general question");
        classification = { isTrading: false, reason: "classification failed - ambiguous prompt treated as general" };
      }
    }

    console.log(`[Trading Prompt] Classification: ${classification.isTrading ? 'TRADING' : 'GENERAL'} - ${classification.reason}`);

    // If it's a general question, respond naturally without trading JSON format
    if (!classification.isTrading) {
      const generalMessages: AIMessage[] = [
        {
          role: "system" as const,
          content: `You are Mr. Fox, a helpful and knowledgeable AI assistant. You can answer questions on any topic - math, science, history, current events, general knowledge, and more. Be friendly, accurate, and conversational.

You also happen to be an expert crypto trader, but the user is asking you a general question right now, so respond naturally without any trading jargon unless relevant.`
        },
        {
          role: "user" as const,
          content: prompt
        }
      ];

      const generalResponse = await makeAIRequest(userId, {
        messages: generalMessages,
        model,
      }, preferredProvider);

      // Log usage
      try {
        await storage.logAiUsage(userId, {
          provider: generalResponse.provider,
          model: generalResponse.model,
          promptTokens: generalResponse.usage.promptTokens,
          completionTokens: generalResponse.usage.completionTokens,
          totalTokens: generalResponse.usage.totalTokens,
          estimatedCost: generalResponse.cost.toFixed(6),
          userPrompt: prompt,
          aiResponse: generalResponse.content || '',
          success: 1,
          strategyId: strategyId || null
        });
      } catch (logError) {
        console.error("Failed to log AI usage:", logError);
      }

      // Return as a "strategy" with the general response in interpretation
      return {
        interpretation: generalResponse.content || "I don't have an answer to that.",
        actions: [],
        riskManagement: "Not applicable - general question",
        expectedOutcome: "Not applicable - general question"
      };
    }

    // Fetch recent user prompt history (last 5 successful prompts) - filtered by strategyId
    let promptHistory: {timestamp: Date, prompt: string}[] = [];
    try {
      const recentPrompts = await storage.getAiUsageLogs(userId, 5, strategyId);
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

    const messages: AIMessage[] = [
      {
        role: "system" as const,
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
- **SCAN ALL AVAILABLE MARKETS**: You have access to the ENTIRE Hyperliquid universe - don't limit yourself to just BTC, ETH, or SOL
- Analyze the complete "Current market data" provided - look for opportunities across ALL trading pairs
- Consider altcoins, memecoins, and emerging assets with strong momentum and volume
- Focus on top gainers/losers and high-volume assets from the Market analysis section
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
      "symbol": "<ANY_SYMBOL_FROM_MARKET_DATA>" (e.g. "BTC-PERP", "ETH-PERP", "DOGE-PERP", "WIF-PERP", "PEPE-PERP" - use ANY symbol available in the market data),
      "side": "long" | "short",
      "size": "numeric value as string (e.g. '0.5', '1.25', '10') - MUST be actual number, NOT 'calculated'",
      "leverage": 1-10,
      "reasoning": "Technical analysis across timeframes, entry trigger, risk management rationale",
      "expectedEntry": "numeric price as string (e.g. '45000.5')" [for buy/sell actions],
      "stopLoss": "numeric price as string (e.g. '43500')" [REQUIRED for buy/sell - the stop loss price],
      "takeProfit": "numeric price as string (e.g. '47500')" [REQUIRED for buy/sell - the take profit price],
      "exitCriteria": "Detailed reasoning for stop loss placement based on market structure (e.g., 'Stop placed below 4H support at $43,500 which aligns with 0.618 Fibonacci retracement. If breached, indicates trend reversal.')" [REQUIRED for buy/sell actions],
      "expectedRoi": "Expected ROI percentage as string (e.g. '5.8' for 5.8%)" [REQUIRED for buy/sell - calculated from entry to take profit],
      "triggerPrice": "numeric price as string (e.g. '44000')" [REQUIRED for stop_loss/take_profit actions - the price that triggers the order]
    }
  ],
  "riskManagement": "Detailed risk management strategy including position sizing methodology, stop loss placement, and exposure limits",
  "expectedOutcome": "Expected Sharpe ratio impact, potential drawdown, and compounding strategy"
}

IMPORTANT - SYMBOL SELECTION:
- You can trade ANY symbol from the "Current market data" section provided to you
- Don't limit yourself to BTC, ETH, or SOL - explore the full universe of available assets
- Look at top gainers, high volume assets, and emerging opportunities
- Use the exact symbol format as shown in the market data (e.g. "DOGE-PERP", "WIF-PERP", "BONK-PERP")

CRITICAL RULES:
1. The 'size' field must ALWAYS contain an actual numeric value (like "0.5" or "10"), NEVER the word "calculated" or any placeholder text.
2. For "buy" and "sell" actions, you MUST provide the "expectedEntry" field with the exact limit price. Hyperliquid does not support market orders - all orders must specify a limit price.
3. To place stop loss orders, use action: "stop_loss" with triggerPrice set to the stop loss price
4. To place take profit orders, use action: "take_profit" with triggerPrice set to the take profit price
5. DO NOT use "hold" actions with stopLoss/takeProfit fields - those fields are ignored. Instead, generate separate stop_loss and take_profit ORDER actions.
6. When user asks to set stop losses or take profits, generate actual stop_loss/take_profit actions for each position.
7. For "close" actions, the expectedEntry field is optional (system will use IOC limit orders to close at market price).
8. IMPORTANT: For "close" actions, the "side" field MUST match the existing position's side from Current positions data:
   - If position has positive size (long position), use side: "long"
   - If position has negative size (short position), use side: "short"
   - DO NOT use the direction of the closing trade - use the position's current side!

Output real-time executed trades with professional precision and risk-adjusted optimization.`
      },
      {
        role: "user" as const,
        content: screenshots && screenshots.length > 0 
          ? [
              {
                type: "text" as const,
                text: `User prompt: "${prompt}"

Account Information:
- Total Portfolio Value: $${userState?.marginSummary?.accountValue || '0'}
- Available Balance: $${userState?.marginSummary?.withdrawable || '0'}
- Total Margin Used: $${userState?.marginSummary?.totalMarginUsed || '0'}

Current market data:
${JSON.stringify(marketData, null, 2)}

Market analysis:
${marketTrends}

Current positions:
${currentPositions.length > 0 ? JSON.stringify(currentPositions, null, 2) : "No open positions"}

${promptHistory.length > 0 ? `Recent user prompt history (for context on trading style and preferences):
${promptHistory.map(p => `- ${new Date(p.timestamp).toLocaleString()}: "${p.prompt}"`).join('\n')}

Consider the user's historical prompts to understand their trading style, risk tolerance, and strategic preferences. Build upon previous strategies and refine suggestions based on learned patterns.` : ''}

The user has attached ${screenshots.length} screenshot(s) showing price charts or market structure. Analyze these images along with the prompt and market data to generate your trading strategy.

Generate a trading strategy that addresses the user's current prompt while considering their historical preferences and maximizing risk-adjusted returns based on current market conditions. Remember to respond with ONLY the JSON object, no other text.`
              },
              ...screenshots.map(screenshot => ({
                type: "image_url" as const,
                image_url: {
                  url: screenshot
                }
              }))
            ]
          : `User prompt: "${prompt}"

Account Information:
- Total Portfolio Value: $${userState?.marginSummary?.accountValue || '0'}
- Available Balance: $${userState?.marginSummary?.withdrawable || '0'}
- Total Margin Used: $${userState?.marginSummary?.totalMarginUsed || '0'}

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
    ];

    const aiResponse = await makeAIRequest(userId, {
      messages,
      model,
    }, preferredProvider);

    const content = aiResponse.content;
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

    // Try to parse as JSON, but if it fails, treat as a general conversational response
    let strategy: TradingStrategy;
    try {
      strategy = JSON.parse(cleanedContent) as TradingStrategy;
    } catch (parseError) {
      console.log("Failed to parse trading JSON - treating as general conversational response");
      // If JSON parsing fails, this was likely a general question misclassified as trading
      // Return the conversational response wrapped in a strategy format
      strategy = {
        interpretation: content,
        actions: [],
        riskManagement: "Not applicable - conversational response",
        expectedOutcome: "Not applicable - conversational response"
      };
    }

    // Log usage and cost
    try {
      await storage.logAiUsage(userId, {
        provider: aiResponse.provider,
        model: aiResponse.model,
        promptTokens: aiResponse.usage.promptTokens,
        completionTokens: aiResponse.usage.completionTokens,
        totalTokens: aiResponse.usage.totalTokens,
        estimatedCost: aiResponse.cost.toFixed(6),
        userPrompt: prompt,
        aiResponse: JSON.stringify(strategy),
        success: 1,
        mode: "manual", // or "autonomous" - will be set by the caller
        strategyId: strategyId || null
      });
    } catch (error) {
      console.error("Failed to log AI usage:", error);
    }

    return strategy;
  } catch (error: any) {
    // Log failed attempt with provider info from error context
    // Extract provider and model from error if available (thrown by AI router)
    const errorProvider = error.provider || preferredProvider || "unknown";
    const errorModel = error.model || model || "unknown";
    
    try {
      await storage.logAiUsage(userId, {
        provider: errorProvider,
        model: errorModel,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: "0",
        userPrompt: prompt,
        success: 0,
        mode: "manual",
        strategyId: strategyId || null
      });
    } catch (logError) {
      console.error("Failed to log AI usage error:", logError);
    }
    
    // Re-throw the original error
    throw error;
  }
}
