import { storage } from "./storage";
import { makeAIRequest, type AIMessage } from "./aiRouter";

interface MarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

interface TradingAction {
  action: "buy" | "sell" | "hold" | "close" | "stop_loss" | "take_profit" | "cancel_order";
  symbol: string;
  exchange?: "hyperliquid" | "orderly";  // Optional: defaults to hyperliquid
  side?: "long" | "short";
  size?: string;
  leverage?: number;
  reasoning: string;
  expectedEntry?: string;
  exitCriteria?: string;
  expectedRoi?: string;
  stopLossReasoning?: string;
  takeProfitReasoning?: string;
  exitStrategy?: string;
  triggerPrice?: string;
  orderId?: number;
}

interface TradingStrategy {
  interpretation: string;
  actions: TradingAction[];
  riskManagement: string;
  expectedOutcome: string;
}

function analyzeMarketTrends(marketData: MarketData[]): string {
  const totalAssets = marketData.length;
  const gainers = marketData.filter(m => parseFloat(m.change24h) > 0).length;
  const losers = marketData.filter(m => parseFloat(m.change24h) < 0).length;
  const neutral = totalAssets - gainers - losers;

  const sorted = [...marketData].sort((a, b) => parseFloat(b.change24h) - parseFloat(a.change24h));
  const topGainers = sorted.slice(0, 3);
  const topLosers = sorted.slice(-3).reverse();

  const avgChange = marketData.reduce((sum, m) => sum + parseFloat(m.change24h), 0) / totalAssets;
  
  let sentiment = "Mixed";
  if (gainers > losers * 1.5) sentiment = "Bullish";
  else if (losers > gainers * 1.5) sentiment = "Bearish";

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
  openOrders: any[],
  model?: string,
  preferredProvider?: string,
  screenshots?: string[],
  strategyId?: string | null
): Promise<TradingStrategy> {
  
  try {
    console.log(`[Trading Prompt] Processing prompt for user ${userId}${strategyId ? ` with strategy ${strategyId}` : ''}`);
    
    // Fetch strategy details if provided
    let strategyDetails: any = null;
    if (strategyId) {
      try {
        strategyDetails = await storage.getTradingMode(userId, strategyId);
        if (strategyDetails) {
          console.log(`[Trading Prompt] Strategy loaded: "${strategyDetails.name}"`);
        }
      } catch (error) {
        console.error(`[Trading Prompt] Error loading strategy:`, error);
      }
    }

    // Fetch conversation history (last 5 prompts for this strategy)
    let promptHistory: {timestamp: Date, prompt: string}[] = [];
    try {
      const recentPrompts = await storage.getAiUsageLogs(userId, 5, strategyId);
      promptHistory = recentPrompts
        .filter(log => log.success === 1 && log.userPrompt)
        .map(log => ({
          timestamp: log.timestamp,
          prompt: log.userPrompt!
        }));
    } catch (error) {
      console.error("Failed to fetch prompt history:", error);
    }

    // Analyze market trends
    let marketTrends = "Market data not available";
    try {
      if (marketData && marketData.length > 0) {
        marketTrends = analyzeMarketTrends(marketData);
      }
    } catch (error) {
      console.error("Failed to analyze market trends:", error);
    }

    // Build strategy context if available
    let strategyContext = "";
    if (strategyDetails) {
      const params = strategyDetails.parameters || {};
      const preferredAssets = Array.isArray(params.preferredAssets) 
        ? params.preferredAssets.join(', ')
        : params.preferredAssets || 'Any';
      
      strategyContext = `

🎯 ACTIVE TRADING STRATEGY: "${strategyDetails.name}"
${strategyDetails.description ? `Description: ${strategyDetails.description}` : ''}
Parameters:
- Risk per trade: ${params.riskPercentage || params.riskPercentPerTrade || 1}%
- Max positions: ${params.maxPositions || 5}
- Max leverage: ${params.preferredLeverage || params.maxLeverage || 10}x
- Timeframe: ${params.timeframe || 'Not specified'}
- Preferred assets: ${preferredAssets}
- Max entry orders per symbol: ${params.maxEntryOrdersPerSymbol || 3}
${params.restrictedAssets && params.restrictedAssets.trim() !== '' ? `- RESTRICTED ASSETS (HARD LIMIT): You can ONLY trade: ${params.restrictedAssets}` : ''}
${params.customRules ? `
Custom Rules (User's Trading Philosophy):
${params.customRules}

These custom rules guide your trading decisions. Follow them strictly when generating trades.` : ''}

When the user asks you to trade or when you're autonomously monitoring markets, generate trading actions that follow this strategy.`;
    }

    // Build conversation history context
    let conversationContext = "";
    if (promptHistory.length > 0) {
      conversationContext = `

RECENT CONVERSATION HISTORY:
${promptHistory.map((h, i) => `${i + 1}. "${h.prompt}"`).join('\n')}

Use this to understand recent discussions and any strategy modifications the user has requested.`;
    }

    // Fetch options positions - try live API first, fall back to database
    let optionsContext = "";
    try {
      let openOptions: any[] = [];
      
      // Try live Aevo API first
      try {
        const aevoApiKey = await storage.getActiveApiKeyByProvider(userId, "exchange", "aevo");
        if (aevoApiKey) {
          const { decryptCredential } = await import("./encryption");
          const apiKey = decryptCredential(
            aevoApiKey.encryptedApiKey,
            aevoApiKey.apiKeyIv,
            aevoApiKey.encryptedDek,
            aevoApiKey.dekIv
          );
          const apiSecret = aevoApiKey.metadata && typeof aevoApiKey.metadata === 'object' && 'apiSecret' in aevoApiKey.metadata
            ? String((aevoApiKey.metadata as any).apiSecret)
            : '';
          const signingKey = aevoApiKey.metadata && typeof aevoApiKey.metadata === 'object' && 'signingKey' in aevoApiKey.metadata
            ? String((aevoApiKey.metadata as any).signingKey)
            : '';
          
          if (apiSecret && signingKey) {
            const { AevoClient } = await import("./aevo/client");
            const aevoClient = new AevoClient({
              apiKey,
              apiSecret,
              signingKey,
              testnet: false,
            });
            
            const aevoPortfolio = await aevoClient.getPortfolio();
            
            // Convert Aevo positions to unified format for context
            openOptions = aevoPortfolio.positions
              .filter(p => p.instrument_type === "OPTION" && Math.abs(parseFloat(p.amount)) >= 0.001)
              .map(p => {
                // Parse instrument name (e.g., "ETH-31MAR25-2000-C" -> asset: ETH, expiry: Mar 31 2025, strike: 2000, type: call)
                const nameParts = p.instrument_name.split('-');
                const asset = nameParts[0] || "UNKNOWN";
                const expiryStr = nameParts.length >= 2 ? nameParts[1] : "";
                const strikeStr = nameParts.length >= 3 ? nameParts[nameParts.length - 2] : "0";
                const optionTypeChar = nameParts.length >= 4 ? nameParts[nameParts.length - 1] : "C";
                const strike = strikeStr;
                const optionType = optionTypeChar.toUpperCase() === "C" ? "call" : "put";
                
                // Parse expiry date from format "31MAR25" -> March 31, 2025
                let expiry = new Date();
                if (expiryStr && expiryStr.length >= 5) {
                  const day = parseInt(expiryStr.substring(0, 2));
                  const monthStr = expiryStr.substring(2, 5).toUpperCase();
                  const year = 2000 + parseInt(expiryStr.substring(5));
                  
                  const monthMap: { [key: string]: number } = {
                    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
                    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
                  };
                  const month = monthMap[monthStr] ?? 0;
                  expiry = new Date(year, month, day);
                }
                
                return {
                  instrumentName: p.instrument_name,
                  side: p.side,
                  size: p.amount,
                  optionType,
                  entryPrice: p.entry_price,
                  strike,
                  expiry,
                  delta: p.greeks?.delta || "0",
                };
              });
            
            console.log(`[Trading Agent] Found ${openOptions.length} live Aevo options`);
          }
        }
      } catch (liveError) {
        console.log("[Trading Agent] Failed to fetch live Aevo positions, trying database fallback");
      }
      
      // Fall back to database if live fetch failed or returned no results
      if (openOptions.length === 0) {
        const optionsPositions = await storage.getOptionsPositions(userId);
        openOptions = optionsPositions.filter(p => p.status === "open");
        console.log(`[Trading Agent] Found ${openOptions.length} database Aevo options`);
      }
      
      if (openOptions.length > 0) {
        optionsContext = `\n\nOPTIONS POSITIONS (Aevo - ${openOptions.length} open):\n${openOptions.map(opt => 
          `- ${opt.instrumentName}: ${opt.side} ${opt.size} ${opt.optionType}s @ $${opt.entryPrice} (strike: $${opt.strike}, expires: ${opt.expiry ? new Date(opt.expiry).toISOString().split('T')[0] : 'TBD'})`
        ).join('\n')}`;
        
        // Add delta exposure if available
        const totalOptionsDelta = openOptions.reduce((sum: number, opt: any) => {
          const delta = opt.delta ? parseFloat(opt.delta) : 0;
          const size = parseFloat(opt.size);
          const adjustedDelta = opt.side === "long" ? delta * size : -delta * size;
          return sum + adjustedDelta;
        }, 0);
        if (Math.abs(totalOptionsDelta) > 0.01) {
          optionsContext += `\nTotal Options Delta: ${totalOptionsDelta > 0 ? '+' : ''}${totalOptionsDelta.toFixed(2)}`;
        }
      }
    } catch (error) {
      console.error("Failed to fetch options positions:", error);
    }

    // Fetch prediction market positions
    let predictionContext = "";
    try {
      const { getPolymarketClient } = await import("./polymarket/client");
      const pmClient = await getPolymarketClient(userId, storage);
      const pmPositions = await pmClient.getPositions();
      if (pmPositions.length > 0) {
        predictionContext = `\n\nPREDICTION MARKETS (Polymarket - ${pmPositions.length} open):\n${pmPositions.slice(0, 5).map(pred => 
          `- "${pred.marketQuestion || 'Unknown'}": ${pred.side} ${parseFloat(pred.size || '0').toFixed(2)} shares @ $${parseFloat(pred.averagePrice || pred.entryPrice || '0').toFixed(2)}`
        ).join('\n')}${pmPositions.length > 5 ? `\n... and ${pmPositions.length - 5} more` : ''}`;
      }
    } catch (error) {
      console.error("Failed to fetch Polymarket positions:", error);
    }

    // Build the unified conversational system prompt
    const credentialsStatus = userState 
      ? `TRADING ACCOUNT STATUS (HYPERLIQUID):
- Portfolio Value: $${userState.marginSummary?.accountValue || '0'}
- Available Balance: $${userState.withdrawable || '0'}
- Margin Used: $${userState.marginSummary?.totalMarginUsed || '0'}
- Open Positions: ${currentPositions.length > 0 ? `${currentPositions.length} position(s) - ${currentPositions.map((p: any) => `${p.symbol} ${p.side} ${p.size} @ $${p.entryPrice}`).join(', ')}` : 'None'}
- Open Orders: ${openOrders.length > 0 ? `${openOrders.length} order(s)` : 'None'}${optionsContext}${predictionContext}`
      : `⚠️ TRADING SETUP REQUIRED:
The user has NOT completed API wallet setup yet. You can still answer questions about trading, markets, and strategies, but you CANNOT execute any trades.

When the user asks about trading or mentions wanting to execute trades:
1. Explain they need to complete the one-time API wallet approval (takes 30 seconds)
2. Tell them to look for the orange "Setup Now" button at the top of the screen
3. Reassure them their funds stay in THEIR wallet - the API wallet can only sign trades, not withdraw
4. After setup, they can chat with you AND execute trades automatically

For now, focus on: market analysis, strategy discussion, education, and answering questions.`;
    
    const systemPrompt = `You are Grok, an AI assistant helping with cryptocurrency trading across multiple instruments: perpetual futures (Hyperliquid, Orderly Network), options (Aevo), and prediction markets (Polymarket). You respond naturally and conversationally to all questions - trading, markets, math, science, current events, or casual conversation.${strategyContext}${conversationContext}

${credentialsStatus}

MARKET CONDITIONS:
${marketTrends}

MULTI-INSTRUMENT STRATEGY GUIDELINES:
When the user has positions across multiple instruments (perps, options, predictions), consider:
1. **Delta Correlation**: Long ETH perp + long ETH calls = doubled ETH exposure. Suggest hedges if over-exposed.
2. **Directional Hedging**: Use options to protect perp positions (e.g., buy puts to hedge long perp).
3. **Cross-Market Arbitrage**: Compare prediction market probabilities with perp funding rates.
4. **Greek Risk**: If user has options, warn about theta decay and suggest rolling or closing near expiry.
5. **Concentration Risk**: Flag if user is heavily exposed to one asset across multiple instruments.

You can suggest trades across any platform (Hyperliquid, Orderly, Aevo, Polymarket) when analyzing hedging or optimization opportunities.

WHEN TO INCLUDE TRADING ACTIONS IN YOUR RESPONSE:
- User explicitly asks to trade, buy, sell, or close positions
- User asks for market analysis and trading recommendations
- User modifies the active strategy parameters (e.g., "use 2 ATR stops instead of 1")
- You're running autonomously and find a setup that matches the active strategy

HOW TO RESPOND:
You MUST respond with ONLY valid JSON in this exact format (no other text before or after):

{
  "interpretation": "Your natural, conversational response explaining your analysis and reasoning",
  "actions": [
    // Include trading actions here ONLY when appropriate based on context above
    // If just answering a question, leave this array empty: []
  ],
  "riskManagement": "Risk management notes (or 'N/A' if no trades)",
  "expectedOutcome": "Expected outcome (or 'N/A' if no trades)"
}

TRADING ACTION FORMAT (when generating trades):
Each action must have:
{
  "action": "buy" | "sell" | "hold" | "close" | "stop_loss" | "take_profit" | "cancel_order",
  "symbol": "SYMBOL-PERP" (e.g., "BTC-PERP", "ETH-PERP", "DOGE-PERP"),
  "exchange": "hyperliquid" | "orderly" (optional, defaults to "hyperliquid"),
  "side": "long" | "short",
  "size": "0.5" (actual numeric string, never "calculated"),
  "leverage": 5,
  "expectedEntry": "45000.50" (limit price),
  "reasoning": "Why this trade",
  "exitCriteria": "Stop loss reasoning" [REQUIRED for buy/sell],
  "expectedRoi": "5.8" [REQUIRED for buy/sell],
  "stopLossReasoning": "Why SL at this level" [REQUIRED for buy/sell],
  "takeProfitReasoning": "Why TP at this level" [REQUIRED for buy/sell],
  "exitStrategy": "How to manage if TP unlikely" [REQUIRED for buy/sell],
  "triggerPrice": "43500" [REQUIRED for stop_loss/take_profit],
  "orderId": 12345 [REQUIRED for cancel_order]
}

MULTI-EXCHANGE TRADING:
- Hyperliquid (default): All trades execute on Hyperliquid unless specified otherwise
- Orderly Network: Set "exchange": "orderly" to execute trades on Orderly Network DEX
- Choose exchange based on liquidity, fees, and available symbols
- Protective orders (SL/TP) must use the same exchange as their parent position

🚨 CRITICAL SAFETY RULES (When Generating Trades) 🚨
These rules ONLY apply when you decide to include trading actions in your response:

1. PROTECTIVE BRACKETS: For EVERY buy/sell action, you MUST include TWO additional actions:
   - ONE "stop_loss" action with same symbol and triggerPrice
   - ONE "take_profit" action with same symbol and triggerPrice
   
   LONG Position Example (entry: $45000):
   "actions": [
     {"action": "buy", "symbol": "BTC-PERP", "side": "long", "size": "0.5", "expectedEntry": "45000", ...},
     {"action": "stop_loss", "symbol": "BTC-PERP", "side": "long", "triggerPrice": "43500", "reasoning": "Exit if price drops below support"},
     {"action": "take_profit", "symbol": "BTC-PERP", "side": "long", "triggerPrice": "49500", "reasoning": "Take profit at resistance"}
   ]
   
   SHORT Position Example (entry: $45000):
   "actions": [
     {"action": "sell", "symbol": "BTC-PERP", "side": "short", "size": "0.5", "expectedEntry": "45000", ...},
     {"action": "stop_loss", "symbol": "BTC-PERP", "side": "short", "triggerPrice": "46500", "reasoning": "Exit if price rises above resistance"},
     {"action": "take_profit", "symbol": "BTC-PERP", "side": "short", "triggerPrice": "41500", "reasoning": "Take profit at support"}
   ]
   
   🔴 CRITICAL FOR SHORT POSITIONS: 
   - Stop Loss must be ABOVE entry price (you lose when price goes UP)
   - Take Profit must be BELOW entry price (you profit when price goes DOWN)

2. 🚨 MANDATORY: EXISTING POSITIONS MUST ALWAYS HAVE PROTECTIVE ORDERS 🚨
   
   **IF YOU INCLUDE *ANY* TRADING ACTIONS IN YOUR RESPONSE:**
   - Check "Current positions" section above
   - For EACH position listed, you MUST include a "stop_loss" action
   - This is NON-NEGOTIABLE - the system will REJECT your entire strategy if ANY position lacks a stop_loss
   
   Example: If you see one position (HYPE-PERP short) and want to add a new trade:
   "actions": [
     // FIRST: Protect existing position (REQUIRED!)
     {"action": "stop_loss", "symbol": "HYPE-PERP", "side": "short", "triggerPrice": "36.00", "reasoning": "Protect existing short position"},
     {"action": "take_profit", "symbol": "HYPE-PERP", "side": "short", "triggerPrice": "35.40", "reasoning": "Take profit target"},
     
     // THEN: Add new trade with its own protective brackets
     {"action": "sell", "symbol": "ETH-PERP", "side": "short", "size": "1.0", "expectedEntry": "2500", ...},
     {"action": "stop_loss", "symbol": "ETH-PERP", "side": "short", "triggerPrice": "2550", "reasoning": "New position stop"},
     {"action": "take_profit", "symbol": "ETH-PERP", "side": "short", "triggerPrice": "2450", "reasoning": "New position target"}
   ]
   
   ⚠️ If just answering a question with NO trading actions, use empty array: "actions": []

3. SIZE FIELD: Must ALWAYS be an actual number like "0.5" or "10", NEVER "calculated" or placeholder text.

4. MINIMUM NOTIONAL VALUE: Every order (buy/sell) must have a notional value of at least $10 USD.
   - Notional Value = size × expectedEntry price
   - Example: If BTC-PERP is at $45,000, minimum size = 10 / 45000 = 0.0003 BTC
   - Example: If DOGE-PERP is at $0.08, minimum size = 10 / 0.08 = 125 DOGE
   - For low-priced assets (< $1), calculate: size = 10 / price (then round UP to ensure >= $10)
   - Always verify: size × price >= $10 before submitting

5. CANCEL_ORDER: Requires symbol and orderId fields. Only cancel entry orders, never protective orders (reduceOnly: true).

6. For CLOSE actions, the "side" field must match the existing position's side (long position = side: "long").

When answering general questions (math, science, portfolio info, market conditions), simply provide your answer in the "interpretation" field and leave "actions" as an empty array: [].

Remember: Respond conversationally in the "interpretation" field. Include trading actions ONLY when the context calls for it.`;

    // Build user message with all market data and context
    const userContent = screenshots && screenshots.length > 0 
      ? [
          {
            type: "text" as const,
            text: `User prompt: "${prompt}"

Current market data:
${JSON.stringify(marketData, null, 2)}

Current positions:
${currentPositions.length > 0 ? JSON.stringify(currentPositions, null, 2) : "No open positions"}

Open entry orders:
${openOrders.length > 0 ? JSON.stringify(openOrders.filter((o: any) => !o.reduceOnly && !o.orderType?.trigger), null, 2) : "No open entry orders"}

The user has attached ${screenshots.length} screenshot(s) showing price charts. Analyze these images along with the prompt and market data.`
          },
          ...screenshots.map(screenshot => ({
            type: "image_url" as const,
            image_url: { url: screenshot }
          }))
        ]
      : `User prompt: "${prompt}"

Current market data:
${JSON.stringify(marketData, null, 2)}

Current positions:
${currentPositions.length > 0 ? JSON.stringify(currentPositions, null, 2) : "No open positions"}

Open entry orders:
${openOrders.length > 0 ? JSON.stringify(openOrders.filter((o: any) => !o.reduceOnly && !o.orderType?.trigger), null, 2) : "No open entry orders"}`;

    // Make AI request
    const messages: AIMessage[] = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userContent }
    ];

    const response = await makeAIRequest(userId, { messages, model }, preferredProvider);

    // Parse JSON response
    let cleanContent = response.content?.trim() || '{}';
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const strategy: TradingStrategy = JSON.parse(cleanContent);

    // Log AI usage
    try {
      await storage.logAiUsage(userId, {
        provider: response.provider,
        model: response.model,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        estimatedCost: response.cost.toFixed(6),
        userPrompt: prompt,
        aiResponse: JSON.stringify(strategy),
        success: 1,
        strategyId: strategyId || null
      });
    } catch (error) {
      console.error("Failed to log AI usage:", error);
    }

    console.log(`[Trading Prompt] AI response: ${strategy.actions.length} actions generated`);
    return strategy;

  } catch (error) {
    console.error("[Trading Prompt] Error processing prompt:", error);
    
    // Log failed usage
    try {
      await storage.logAiUsage(userId, {
        provider: preferredProvider || 'unknown',
        model: model || 'unknown',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: '0',
        userPrompt: prompt,
        aiResponse: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: 0,
        strategyId: strategyId || null
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    // Return error response
    return {
      interpretation: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      actions: [],
      riskManagement: "Error occurred",
      expectedOutcome: "Error occurred"
    };
  }
}
