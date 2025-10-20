import { storage } from "./storage";
import { getUserHyperliquidClient, type HyperliquidClient } from "./hyperliquid/client";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { makeAIRequest } from "./aiRouter";
import { getRecentLearnings } from "./evaluationService";
import { reconcilePositions } from "./positionReconciliation";
import { reconcileJournalEntries } from "./journalReconciliation";

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
  symbol: string;  // REQUIRED for all actions - the trading pair (e.g., "HYPE-PERP")
  side?: "long" | "short";  // Not required for cancel_order
  size?: string;  // Not required for cancel_order
  leverage?: number;  // Not required for cancel_order
  reasoning: string;
  expectedEntry?: string;
  stopLoss?: string;
  takeProfit?: string;
  triggerPrice?: string;
  orderId?: number; // REQUIRED for cancel_order action - the order ID to cancel
}

interface AutonomousStrategy {
  tradeThesis: string;
  marketRegime: "bullish" | "bearish" | "neutral" | "volatile";
  volumeAnalysis: string;
  actions: TradingAction[];
  riskAssessment: string;
  expectedSharpeImpact: string;
}

// Store previous volume data for abnormal condition detection
const previousVolumeData = new Map<string, Map<string, number>>();

/**
 * Discover existing positions and track their protective orders if not already tracked
 * This ensures positions opened manually or during server downtime are tracked
 */
async function discoverAndTrackExistingPositions(userId: number): Promise<void> {
  try {
    const userIdStr = userId.toString();
    const hyperliquid = await getUserHyperliquidClient(userIdStr);
    
    // Get all positions, open orders, and market data
    const [positions, openOrders, marketData] = await Promise.all([
      hyperliquid.getPositions(),
      hyperliquid.getOpenOrders(),
      hyperliquid.getMarketData()
    ]);
    
    if (!positions || positions.length === 0) {
      console.log('[Position Discovery] No positions found for user', userId);
      return;
    }
    
    console.log(`[Position Discovery] Found ${positions.length} positions for user ${userId}`);
    
    for (const position of positions) {
      const symbol = position.coin;
      
      // Check if we already have protective order state tracked for this position
      const existingState = await storage.getProtectiveOrderState(userIdStr, symbol);
      
      if (existingState) {
        console.log(`[Position Discovery] ${symbol} already tracked, skipping`);
        continue;
      }
      
      // Find protective orders for this position
      const protectiveOrders = openOrders.filter((order: any) => 
        order.coin === symbol && order.reduceOnly === true
      );
      
      if (protectiveOrders.length === 0) {
        console.log(`[Position Discovery] ${symbol} has no protective orders, skipping discovery`);
        continue;
      }
      
      // Get current market price (more reliable than entry price for classification)
      const marketPrice = marketData.find(m => m.symbol === symbol)?.price;
      const currentPrice = marketPrice ? parseFloat(marketPrice) : parseFloat(position.entryPx);
      const isLong = parseFloat(position.szi) > 0;
      
      console.log(`[Position Discovery] ${symbol}: ${protectiveOrders.length} protective orders, ${isLong ? 'LONG' : 'SHORT'} position, current price: ${currentPrice}`);
      
      // Classify protective orders based on current market price
      // For LONGS: Stop Loss < current price, Take Profit > current price
      // For SHORTS: Stop Loss > current price, Take Profit < current price
      
      // First, separate orders by which side of current price they're on
      const orderPrices = protectiveOrders.map((order: any) => parseFloat(order.limitPx));
      const ordersAbovePrice = orderPrices.filter(p => p > currentPrice);
      const ordersBelowPrice = orderPrices.filter(p => p < currentPrice);
      
      let stopLossPrice: string | null = null;
      let takeProfitPrice: string | null = null;
      
      if (isLong) {
        // Long position: SL is below market (highest of orders below), TP is above market (lowest of orders above)
        if (ordersBelowPrice.length > 0) {
          stopLossPrice = Math.max(...ordersBelowPrice).toString(); // Highest below = trailed SL
        }
        if (ordersAbovePrice.length > 0) {
          takeProfitPrice = Math.min(...ordersAbovePrice).toString(); // Lowest above = nearest TP
        }
      } else {
        // Short position: SL is above market (lowest of orders above), TP is below market (highest of orders below)
        if (ordersAbovePrice.length > 0) {
          stopLossPrice = Math.min(...ordersAbovePrice).toString(); // Lowest above = trailed SL
        }
        if (ordersBelowPrice.length > 0) {
          takeProfitPrice = Math.max(...ordersBelowPrice).toString(); // Highest below = nearest TP
        }
      }
      
      console.log(`[Position Discovery] ${symbol} classification: Orders above=${ordersAbovePrice.length}, below=${ordersBelowPrice.length}, SL=${stopLossPrice}, TP=${takeProfitPrice}`);
      
      // Track protective orders - require at least a stop loss
      if (stopLossPrice) {
        // Use a placeholder TP if none exists (will show as missing in monitoring)
        const tpToStore = takeProfitPrice || (isLong ? (currentPrice * 1.05).toFixed(2) : (currentPrice * 0.95).toFixed(2));
        
        await storage.setInitialProtectiveOrders(
          userIdStr,
          symbol,
          stopLossPrice,
          tpToStore,
          takeProfitPrice 
            ? `Discovered existing position with ${protectiveOrders.length} protective order(s)`
            : `Discovered position with SL only (${protectiveOrders.length} orders) - placeholder TP set`
        );
        
        console.log(`[Position Discovery] ✅ Tracked ${symbol}: SL=${stopLossPrice}, TP=${takeProfitPrice || 'placeholder'}`);
      } else {
        console.warn(`[Position Discovery] ⚠️ ${symbol} has ${protectiveOrders.length} protective orders but could not identify stop loss - prices: ${protectiveOrders.map((o: any) => o.limitPx).join(', ')}`);
      }
    }
  } catch (error: any) {
    console.error('[Position Discovery] Error during position discovery:', error.message);
  }
}

function detectAbnormalConditions(marketData: MarketData[]): { symbol: string; condition: string; volumeRatio: number }[] {
  const abnormalConditions: { symbol: string; condition: string; volumeRatio: number }[] = [];
  
  // NO HARDCODED THRESHOLDS - Return volume change data for AI analysis
  for (const asset of marketData) {
    const symbol = asset.symbol;
    const currentVolume = parseFloat(asset.volume24h || '0');
    
    // Get global previous volume map
    if (!previousVolumeData.has('global')) {
      previousVolumeData.set('global', new Map());
    }
    const volumeMap = previousVolumeData.get('global')!;
    const previousVolume = volumeMap.get(symbol) || currentVolume;
    
    // Report volume changes - let AI decide what's significant
    if (previousVolume > 0 && currentVolume !== previousVolume) {
      const volumeRatio = currentVolume / previousVolume;
      abnormalConditions.push({
        symbol,
        condition: `Volume change: ${volumeRatio.toFixed(2)}x (was $${(previousVolume/1e6).toFixed(1)}M, now $${(currentVolume/1e6).toFixed(1)}M)`,
        volumeRatio
      });
    }
    
    // Update previous volume
    volumeMap.set(symbol, currentVolume);
  }
  
  // Sort by volume ratio (biggest changes first) and return top 10 for AI analysis
  return abnormalConditions
    .sort((a, b) => Math.abs(b.volumeRatio - 1) - Math.abs(a.volumeRatio - 1))
    .slice(0, 10);
}

function analyzeVolumeProfile(marketData: MarketData[]): VolumeProfile[] {
  // Calculate total market volume for baseline comparison
  const totalVolume = marketData.reduce((sum, m) => sum + parseFloat(m.volume24h || "0"), 0);
  const avgMarketVolume = totalVolume / (marketData.length || 1);
  
  // First pass: calculate all ratios
  const profiles = marketData.map(m => {
    const volume = parseFloat(m.volume24h || "0");
    const volumeRatio = avgMarketVolume > 0 ? volume / avgMarketVolume : 1;
    return { symbol: m.symbol, volumeRatio };
  });
  
  // Calculate percentiles from the data itself (data-driven, not hardcoded)
  const sortedRatios = profiles.map(p => p.volumeRatio).sort((a, b) => a - b);
  const p75 = sortedRatios[Math.floor(sortedRatios.length * 0.75)] || 1.0;  // 75th percentile
  const p25 = sortedRatios[Math.floor(sortedRatios.length * 0.25)] || 1.0;  // 25th percentile
  
  // Map with dynamic significance based on percentiles (changes day-to-day with market)
  return profiles.map(({ symbol, volumeRatio }) => {
    const volumeTrend: "increasing" | "decreasing" | "stable" = 
      volumeRatio > 1.0 ? "increasing" : volumeRatio < 1.0 ? "decreasing" : "stable";
    
    // Dynamic significance: top 25% = high, bottom 25% = high (for decreasing), middle = medium/low
    let significance: "high" | "medium" | "low" = "medium";
    if (volumeRatio >= p75) {
      significance = "high";  // Top 25% of volume
    } else if (volumeRatio <= p25) {
      significance = volumeTrend === "decreasing" ? "high" : "low";  // Bottom 25%
    }
    
    return {
      symbol,
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
  const neutral = totalAssets - gainers - losers;
  
  const avgChange = marketData.reduce((sum, m) => sum + parseFloat(m.change24h || "0"), 0) / totalAssets;
  const volatility = Math.sqrt(
    marketData.reduce((sum, m) => sum + Math.pow(parseFloat(m.change24h || "0") - avgChange, 2), 0) / totalAssets
  );
  
  // NO HARDCODED THRESHOLDS - Provide raw data for AI to analyze
  const reasoning = `Market Statistics: ${gainers} gainers (${(gainers/totalAssets*100).toFixed(1)}%), ${losers} losers (${(losers/totalAssets*100).toFixed(1)}%), ${neutral} neutral. Average 24h change: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%. Volatility (std dev): ${volatility.toFixed(2)}%. YOU analyze these stats to determine regime - no pre-classification.`;
  
  // Return neutral with raw data - AI will determine actual regime based on current conditions
  return { 
    regime: "neutral",  // AI will classify
    confidence: 50,      // AI will assess confidence
    reasoning 
  };
}

export async function developAutonomousStrategy(userId: string): Promise<void> {
  let hyperliquidClient: HyperliquidClient | null = null;
  
  try {
    console.log(`[Autonomous Trading] Developing trade thesis for user ${userId}...`);
    
    // SAFETY CHECK: Verify user's agent mode before executing
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`[Autonomous Trading] User ${userId} not found`);
      return;
    }
    
    // Get Hyperliquid client early so we can use it in finally block for snapshot
    hyperliquidClient = await getUserHyperliquidClient(userId);
    if (!hyperliquidClient) {
      console.log(`[Autonomous Trading] Hyperliquid client not initialized for user ${userId}`);
      return;
    }
    
    if (user.agentMode === "passive") {
      console.log(`[Autonomous Trading] User ${userId} is in PASSIVE mode - skipping trade execution`);
      
      // Log to monitoring logs so users can see passive mode is active
      await storage.createMonitoringLog(userId, {
        analysis: JSON.stringify({
          mode: "passive",
          message: "Agent is in PASSIVE mode - monitoring market conditions but not executing trades"
        }),
        alertLevel: "info"
      });
      
      // Still create snapshot in passive mode - portfolio value changes over time
      return;
    }
    
    // STEP 1: RECONCILE POSITIONS
    // Sync database position records with actual exchange positions
    // This is CRITICAL for protective order validation to work
    await reconcilePositions(userId, storage, hyperliquidClient);
    
    // STEP 1.5: RECONCILE JOURNAL ENTRIES
    // Update journal entry statuses based on order fills and position closes
    await reconcileJournalEntries(userId, storage, hyperliquidClient);
    
    // STEP 2: POSITION DISCOVERY
    // Track existing positions and their protective orders
    // This ensures positions opened manually or during server downtime are tracked
    await discoverAndTrackExistingPositions(parseInt(userId));
    
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
    
    // Format current positions with protective order state
    const currentPositionsWithState = await Promise.all(hyperliquidPositions.map(async (pos) => {
      const positionValue = parseFloat(pos.positionValue);
      const unrealizedPnl = parseFloat(pos.unrealizedPnl);
      const pnlPercent = positionValue !== 0 ? (unrealizedPnl / positionValue) * 100 : 0;
      const marketPrice = marketData.find(m => m.symbol === pos.coin)?.price || pos.entryPx;
      
      // Fetch protective order state
      const protectiveState = await storage.getProtectiveOrderState(userId, pos.coin);
      
      return {
        symbol: pos.coin,
        side: parseFloat(pos.szi) > 0 ? 'long' : 'short',
        size: Math.abs(parseFloat(pos.szi)),
        entryPrice: parseFloat(pos.entryPx),
        currentPrice: parseFloat(marketPrice),
        leverage: pos.leverage.value,
        pnlPercent: pnlPercent,
        pnlDollars: unrealizedPnl,
        liquidationPrice: pos.liquidationPx ? parseFloat(pos.liquidationPx) : null,
        protectiveState,
      };
    }));
    const currentPositions = currentPositionsWithState;
    
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
    
    // Get user state for account balance info
    const userState = await hyperliquidClient.getUserState();
    const accountValue = parseFloat(userState?.marginSummary?.accountValue || '0');
    const totalMarginUsed = parseFloat(userState?.marginSummary?.totalMarginUsed || '0');
    // Use Hyperliquid's actual withdrawable field (cross margin balance + available isolated margin)
    const withdrawable = parseFloat(userState?.withdrawable || '0');
    
    console.log(`[Balance Debug] RAW user state from Hyperliquid:`, JSON.stringify({
      marginSummary: userState?.marginSummary,
      withdrawable: userState?.withdrawable,
      crossMarginSummary: userState?.crossMarginSummary
    }, null, 2));
    console.log(`[Balance Debug] Available balance: $${withdrawable.toFixed(2)} (from Hyperliquid withdrawable field)`);
    
    // Fetch recent learnings from past trade evaluations (filtered by current market regime)
    const recentLearnings = await getRecentLearnings(userId, marketRegime.regime, 8);
    
    // Fetch active trading mode/strategy
    let activeTradingMode: any = null;
    try {
      const tradingModes = await storage.getTradingModes(userId);
      activeTradingMode = tradingModes.find((m: any) => m.isActive === 1);
      if (activeTradingMode) {
        console.log(`[Autonomous Trading] Using active trading strategy: ${activeTradingMode.name}${activeTradingMode.type ? ` (${activeTradingMode.type})` : ''}`);
      } else {
        console.log(`[Autonomous Trading] No active trading strategy configured`);
      }
    } catch (modeError) {
      console.error("Failed to fetch trading modes:", modeError);
    }
    
    // SAFETY CHECK: Block trading if no active strategy configured
    if (!activeTradingMode) {
      console.log(`[Autonomous Trading] BLOCKING trade execution - no active trading strategy configured`);
      
      // Log to monitoring so users understand why AI isn't trading
      await storage.createMonitoringLog(userId, {
        analysis: JSON.stringify({
          mode: "blocked",
          message: "No active trading strategy configured. Please create a trading strategy and set it as active to enable autonomous trading."
        }),
        alertLevel: "info"
      });
      
      return;
    }
    
    const prompt = `You are Mr. Fox, an autonomous AI trader. Develop a complete trade thesis and execute trades based on current market conditions.

ACCOUNT INFORMATION (CRITICAL - READ THIS FIRST):
- Total Portfolio Value: $${accountValue.toFixed(2)}
- Available Balance: $${withdrawable.toFixed(2)}
- Total Margin Used: $${totalMarginUsed.toFixed(2)}

${activeTradingMode ? `🎯 ACTIVE TRADING STRATEGY: "${activeTradingMode.name}"
**YOU MUST FOLLOW THIS STRATEGY - IT IS THE USER'S EXPLICIT INSTRUCTIONS**

Strategy Configuration:
- Timeframe: ${activeTradingMode.parameters.timeframe || 'not specified'}
- Risk Per Trade: ${activeTradingMode.parameters.riskPercentage || 2}% of account
- Max Positions: ${activeTradingMode.parameters.maxPositions || 3} concurrent positions
- Preferred Leverage: ${activeTradingMode.parameters.preferredLeverage || 5}x
${activeTradingMode.parameters.preferredAssets ? `- Preferred Assets: ${activeTradingMode.parameters.preferredAssets}` : ''}
${activeTradingMode.description ? `- Description: ${activeTradingMode.description}` : ''}
${activeTradingMode.parameters.customRules ? `- Custom Rules:\n${activeTradingMode.parameters.customRules}` : ''}

⚠️ STRATEGY COMPLIANCE RULES (MANDATORY - NON-NEGOTIABLE):
1. ONLY trade assets from the preferred assets list (if specified)
2. NEVER exceed the max positions limit
3. **CRITICAL: USE EXACTLY ${activeTradingMode.parameters.preferredLeverage || 5}x LEVERAGE FOR EVERY TRADE** - This is the user's explicit requirement
4. RISK exactly ${activeTradingMode.parameters.riskPercentage || 2}% per trade
5. FOLLOW the timeframe and trading style specified above
6. RESPECT all custom rules specified above

` : '⚠️ NO ACTIVE TRADING STRATEGY - Using general conservative approach\n'}
⚠️ MANDATORY POSITION SIZING & LEVERAGE RULES:
1. **LEVERAGE REQUIREMENT** (CRITICAL - NON-NEGOTIABLE):
   - **YOU MUST USE ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5}x LEVERAGE FOR ALL TRADES**
   - This is the user's configured setting - DO NOT choose a different leverage
   - Higher leverage = tighter stop loss required = less room for price movement
   - Margin mode: ${user.marginMode || 'isolated'} (user can configure isolated or cross margin)
   
2. **POSITION SIZE CALCULATION**:
   - Available Balance: $${withdrawable.toFixed(2)}
   - YOU decide position size based on risk tolerance, market conditions, and strategy goals
   - Notional value = margin × leverage
   - Position size = notional / entry_price
   - Consider portfolio diversification and correlation when sizing multiple positions
   
3. **INTELLIGENT STOP LOSS PLACEMENT** (LEVERAGE-ADJUSTED + market structure):
   - **CRITICAL**: With ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5}x leverage, consider tight stops to protect capital
   - **SUGGESTED FORMULA**: Max stop loss % from entry = (Risk % of account) / Leverage
     * With ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5}x leverage and ${activeTradingMode ? activeTradingMode.parameters.riskPercentage || 2 : 2}% risk = ${((activeTradingMode ? activeTradingMode.parameters.riskPercentage || 2 : 2) / (activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5)).toFixed(3)}% suggested stop from entry
   - **PLACEMENT APPROACH**:
     1. Analyze market structure (support/resistance, trend lines, volume nodes)
     2. Consider volatility and typical price swings for the asset
     3. Balance between giving the trade room to breathe vs protecting capital
     4. Adjust based on conviction level and setup quality
   - **WARNING**: ${activeTradingMode && activeTradingMode.parameters.preferredLeverage && activeTradingMode.parameters.preferredLeverage > 20 ? 'VERY HIGH LEVERAGE - Consider extremely tight stops. Best to enter on exact support/resistance touches.' : 'Use market structure for stop placement.'}
   
4. **CURRENT AVAILABLE: $${withdrawable.toFixed(2)}**:
   - With ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5}x leverage: you can access significant notional exposure
   - Risk ${activeTradingMode ? activeTradingMode.parameters.riskPercentage || 2 : 2}% of account per trade as configured in strategy

⚠️ MARKET ANALYSIS (YOU MUST ANALYZE - NO PRE-CLASSIFICATION):
${marketRegime.reasoning}

**YOUR JOB**: Analyze the statistics above and determine:
1. Current market regime (bullish/bearish/neutral/volatile) based on YOUR analysis
2. Confidence level based on how clear the signals are
3. What these numbers mean for trading opportunities TODAY

VOLUME ANALYSIS (RAW DATA - YOU DECIDE WHAT'S SIGNIFICANT):
Volume vs Market Average (1.0 = average):
${highVolumeAssets.map(v => `- ${v.symbol}: ${v.volumeRatio.toFixed(2)}x market average volume ($${(parseFloat(marketData.find(m => m.symbol === v.symbol)?.volume24h || '0')/1e6).toFixed(1)}M)`).join('\n')}

**YOUR JOB**: Decide which volume levels are significant based on TODAY'S market conditions, not fixed thresholds

📊 CURRENT MARKET DATA (USE THESE PRICES FOR ALL ORDERS):
${marketData.slice(0, 30).map(m => {
  const price = parseFloat(m.price);
  const change = parseFloat(m.change24h);
  const volume = parseFloat(m.volume24h) / 1e6;
  return `- ${m.symbol}: $${price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: price > 1000 ? 0 : price > 10 ? 2 : 4})} (24h: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%, Vol: $${volume.toFixed(1)}M)`;
}).join('\n')}

⚠️ CRITICAL: ALWAYS use the prices listed above when placing limit orders. NEVER use prices from memory or historical data.

MARKET HIGHLIGHTS:
Top Gainers: ${topGainers.map(m => `${m.symbol} (+${m.change24h}%, Vol: $${(parseFloat(m.volume24h) / 1e6).toFixed(1)}M)`).join(', ')}
Top Losers: ${topLosers.map(m => `${m.symbol} (${m.change24h}%, Vol: $${(parseFloat(m.volume24h) / 1e6).toFixed(1)}M)`).join(', ')}

CURRENT POSITIONS:
${currentPositions.length > 0 ? currentPositions.map(pos => {
  const distanceToLiq = pos.liquidationPrice 
    ? (Math.abs(pos.currentPrice - pos.liquidationPrice) / pos.currentPrice * 100).toFixed(2)
    : 'N/A';
  const isProfitable = pos.pnlDollars > 0;
  
  let protectiveInfo = '';
  if (pos.protectiveState) {
    const state = pos.protectiveState;
    const slStatus = state.stopLossState === 'initial' ? '🔒 LOCKED AT INITIAL LEVEL' : 
                     state.stopLossState === 'trailing' ? '📈 TRAILING (protecting gains)' : 
                     state.stopLossState;
    
    protectiveInfo = `\n   🛡️ Protective Orders:
      - Initial SL: $${state.initialStopLoss || 'NOT SET'} | Current SL: $${state.currentStopLoss || 'NOT SET'} (${slStatus})
      - Current TP: $${state.currentTakeProfit || 'NOT SET'}
      - ${isProfitable ? '✅ CAN ADJUST SL (profitable - may move to protect gains)' : '⛔ CANNOT ADJUST SL (not profitable - must stay at initial level)'}`;
  } else {
    protectiveInfo = '\n   ⚠️ NO PROTECTIVE ORDER STATE TRACKED';
  }
  
  return `- ${pos.symbol}: ${pos.side.toUpperCase()} ${pos.size} @ $${pos.entryPrice} (${pos.leverage}x leverage)
   Current: $${pos.currentPrice}, P&L: ${pos.pnlPercent.toFixed(2)}% ($${pos.pnlDollars.toFixed(2)})${pos.liquidationPrice ? `, Liquidation: $${pos.liquidationPrice} (${distanceToLiq}% away)` : ''}${protectiveInfo}
   ⚠️ HIGH LEVERAGE WARNING: At ${pos.leverage}x, this position moves ${pos.leverage}x faster than the market. A ${(100/pos.leverage).toFixed(2)}% price move = ${((100/pos.leverage)*pos.leverage).toFixed(0)}% position change!`;
}).join('\n') : 'No open positions'}

EXISTING OPEN ORDERS:
${openOrders.length > 0 ? openOrders.map(order => {
  const orderType = order.orderType?.trigger ? (order.orderType.trigger.tpsl === 'tp' ? 'TAKE PROFIT' : 'STOP LOSS') : 'LIMIT';
  const triggerPrice = order.orderType?.trigger?.triggerPx || order.limitPx;
  return `- ${order.coin}: ${orderType} | ID: ${order.oid} | Side: ${order.side} | Size: ${order.sz} | Trigger: $${triggerPrice}`;
}).join('\n') : 'No open orders'}

${(() => {
  // Check for missing protective orders
  // NOTE: Hyperliquid's openOrders API doesn't return orderType.trigger metadata
  // We can only see reduceOnly flag and need to infer SL/TP from price position
  const missingProtection: string[] = [];
  for (const pos of currentPositions) {
    const posSymbol = pos.symbol;
    const currentPrice = parseFloat(pos.currentPrice);
    const isLong = pos.side === 'long';
    
    // Find all reduce-only orders for this position
    const protectiveOrders = openOrders.filter(order => 
      order.coin === posSymbol && order.reduceOnly === true
    );
    
    // Classify orders based on price position relative to current market price
    // For LONG: SL below price, TP above price
    // For SHORT: SL above price, TP below price
    let hasStopLoss = false;
    let hasTakeProfit = false;
    
    for (const order of protectiveOrders) {
      const orderPrice = parseFloat(order.limitPx);
      if (isLong) {
        if (orderPrice < currentPrice) hasStopLoss = true;  // Below = SL for longs
        if (orderPrice > currentPrice) hasTakeProfit = true; // Above = TP for longs
      } else {
        if (orderPrice > currentPrice) hasStopLoss = true;  // Above = SL for shorts
        if (orderPrice < currentPrice) hasTakeProfit = true; // Below = TP for shorts
      }
    }
    
    if (!hasStopLoss) {
      const liq = pos.liquidationPrice;
      const currentPrice = pos.currentPrice;
      const entryPrice = pos.entryPrice;
      const leverage = pos.leverage;
      
      // Provide context for intelligent stop placement
      const distanceToLiqPercent = liq ? (((currentPrice - liq) / currentPrice) * 100 * (pos.side === 'long' ? 1 : -1)).toFixed(2) : 'N/A';
      const accountRiskDollars = accountValue * 0.03; // 3% of account as example
      const positionNotional = pos.size * currentPrice;
      const exampleStopPercent = liq ? (((accountRiskDollars / positionNotional) * 100).toFixed(2)) : '2.0';
      
      let reasoning: string;
      if (pos.side === 'long') {
        reasoning = `ANALYZE MARKET STRUCTURE to find support level below $${currentPrice}. Position: ${leverage}x leverage, ${distanceToLiqPercent}% from liq ($${liq}). Example: if support at $${(currentPrice * 0.97).toFixed(2)}, that's a ${((currentPrice - currentPrice * 0.97) / currentPrice * 100).toFixed(2)}% stop = $${((currentPrice - currentPrice * 0.97) * pos.size).toFixed(2)} risk. Cite specific support level in reasoning!`;
      } else {
        reasoning = `ANALYZE MARKET STRUCTURE to find resistance level above $${currentPrice}. Position: ${leverage}x leverage, ${distanceToLiqPercent}% from liq ($${liq}). Example: if resistance at $${(currentPrice * 1.03).toFixed(2)}, that's a ${((currentPrice * 1.03 - currentPrice) / currentPrice * 100).toFixed(2)}% stop = $${((currentPrice * 1.03 - currentPrice) * pos.size).toFixed(2)} risk. Cite specific resistance level in reasoning!`;
      }
      
      missingProtection.push(`${posSymbol}: MISSING STOP LOSS - ${reasoning}`);
    }
    if (!hasTakeProfit) {
      const entryPrice = pos.entryPrice;
      
      // Calculate minimum take profit for 2:1 R:R based on existing stop loss
      // Find the stop loss order (reduce-only order on the correct side of current price)
      const stopLossOrders = protectiveOrders.filter(order => {
        const orderPrice = parseFloat(order.limitPx);
        return isLong ? (orderPrice < currentPrice) : (orderPrice > currentPrice);
      });
      
      if (stopLossOrders.length > 0) {
        // Use the closest stop loss to current price (most conservative)
        const stopPrice = isLong 
          ? Math.max(...stopLossOrders.map(o => parseFloat(o.limitPx)))
          : Math.min(...stopLossOrders.map(o => parseFloat(o.limitPx)));
        
        const riskDistance = Math.abs(entryPrice - stopPrice);
        const minRewardDistance = riskDistance * 2; // 2:1 R:R
        const minTakeProfit = pos.side === 'long' 
          ? (entryPrice + minRewardDistance).toFixed(2)
          : (entryPrice - minRewardDistance).toFixed(2);
        missingProtection.push(`${posSymbol}: MISSING TAKE PROFIT - PLACE IMMEDIATELY (minimum for 2:1 R:R: $${minTakeProfit}, current price: $${currentPrice})`);
      } else {
        missingProtection.push(`${posSymbol}: MISSING TAKE PROFIT - PLACE IMMEDIATELY (current price: $${currentPrice})`);
      }
    }
  }
  
  return missingProtection.length > 0 
    ? `\n⚠️ CRITICAL MISSING PROTECTIVE ORDERS:\n${missingProtection.join('\n')}\n`
    : '';
})()}

${recentLearnings.length > 0 ? `📚 STRATEGY LEARNINGS FROM PAST TRADES (AI self-improvement):
${recentLearnings.map(l => `- [${l.category.toUpperCase()}] ${l.insight} (confidence: ${l.confidence.toFixed(0)}%)`).join('\n')}

⚠️ APPLY THESE LESSONS: These insights are extracted from evaluations of your closed trades.
- High confidence (>75%): Strongly apply this lesson in current trading decisions
- Medium confidence (50-75%): Consider this insight when conditions match
- Learnings decay over time (30-day half-life) to prevent overfitting to outdated patterns
- Recent + persistent lessons weighted higher than one-off observations
- Use these to refine entry timing, position sizing, stop placement, and exit strategy
` : ''}

${promptHistory.length > 0 ? `LEARNED TRADING PATTERNS (from user prompts):
${promptHistory.map(p => `- ${new Date(p.timestamp).toLocaleDateString()}: "${p.prompt}"`).join('\n')}

Analyze these past prompts to understand the user's:
- Preferred trading style (aggressive/conservative)
- Risk tolerance and position sizing preferences
- Market bias and asset preferences
- Entry/exit timing patterns` : 'No historical trading patterns available yet'}

🎯 PRIMARY MISSION - PROACTIVE MARKET SCANNING & LIMIT ORDER PLACEMENT:

**YOUR MAIN JOB IS TO CONSTANTLY SCAN THE ENTIRE HYPERLIQUID MARKET AND PLACE LIMIT ORDERS AT STRATEGIC LEVELS**

1. **SCAN THE ENTIRE MARKET UNIVERSE EVERY CYCLE**:
   - Review ALL trading pairs in "Current market data", "Top Gainers", "Top Losers", "High Volume Assets"
   - Don't limit yourself to BTC/ETH/SOL - look at altcoins, memecoins, emerging assets with momentum
   - Identify 2-3 best opportunities across the ENTIRE market based on:
     * Clear support/resistance levels
     * Volume profile nodes (high volume areas where price tends to react)
     * Fibonacci retracement levels with volume confirmation
     * Previous swing highs/lows with technical confluence
     * Moving average confluence zones
     * Strong momentum with volume confirmation

2. **LIMIT ORDER PLACEMENT LOGIC** (CRITICAL - READ CAREFULLY):
   
   ⚠️ **TWO APPROACHES - CHOOSE ONE:**
   
   **A) SINGLE ORDER AT TARGET PRICE:**
   - Use when you want to enter at ONE specific price level (e.g., exact support/resistance)
   - Example: Want 0.42 SOL at $185 support → Place ONE order with full size
   - ✅ CORRECT: One order with total size (buy SOL-PERP, size 0.42, expectedEntry 185)
   - ❌ WRONG: Multiple orders at same price (e.g., 0.2 @ $185 AND 0.22 @ $185) - this is DUPLICATE
   
   **B) SCALED ORDERS AROUND TARGET (for better average entry):**
   - Use when you want to improve your average entry across a price range
   - Spread orders ±1-3% around target to account for volatility
   - Example: Want ~0.42 SOL with average entry ~$185:
     * 0.14 SOL @ $183 (below target - catches early bounce)
     * 0.14 SOL @ $185 (at target - main fill)
     * 0.14 SOL @ $187 (above target - ensures partial fill)
   - Each order MUST be at a DIFFERENT price - never place two orders at same price
   
   **MORE EXAMPLES:**
   - ✅ CORRECT: SOL target $185, size 0.3 → ONE order at $185 for 0.3
   - ✅ CORRECT: SOL target $185, size 0.3 → THREE orders (0.1 @ $183, 0.1 @ $185, 0.1 @ $187)
   - ❌ WRONG: SOL target $185, size 0.3 → TWO orders both at $185 (duplicate!)
   - ❌ WRONG: SOL target $185 → 0.15 @ $185 in one cycle, then 0.15 @ $185 again next cycle
   
   **GOLDEN RULE**: 
   - ❌ NEVER place multiple orders at the EXACT SAME PRICE - this provides zero advantage
   - ✅ Either use ONE order at target, OR scale across DIFFERENT prices
   - ✅ Always check "EXISTING OPEN ORDERS" section - if order already exists at that price, DON'T place another
   
   **BE PATIENT**: Don't chase market - let price come to your strategic levels

2.1. **PRICE PLACEMENT GUIDELINES - CRITICAL REQUIREMENTS**:
   ⚠️ **MANDATORY PRICE ANCHORING RULES:**
   
   **BEFORE placing ANY limit order, you MUST:**
   1. **Quote the CURRENT MARKET PRICE** for that asset from the "CURRENT MARKET DATA" section above
   2. **Calculate the % distance** from current price to your intended entry price
   3. **Justify the distance** using recent price action, ATR, volatility, and market structure
   4. **Stay within 20% maximum** - Orders beyond 20% from current price will be REJECTED
   
   **REQUIRED IN YOUR REASONING:**
   - Current price: $XXX (from market data)
   - 24h high/low: $XXX/$XXX
   - 24h change: +/-X%
   - Your entry: $XXX (X% from current price)
   - Justification: "Based on [recent support level / ATR / swing low] at $XXX visible on [1h/4h/daily chart]"
   
   **EXAMPLES:**
   - ✅ GOOD: "SOL current price $190, 24h range $185-$195 (+2.5%). Placing buy @ $184.97 (2.6% below current) near yesterday's low and recent support visible on 4h chart."
   - ✅ GOOD: "BTC current price $107k, 24h volatility 3.2%. Placing buy @ $105.5k (1.4% below) at swing low from this morning's dip, within 1x ATR."
   - ❌ BAD: "Placing SOL buy @ $27" (when current price is $190 - this is 85% away!)
   - ❌ BAD: "Placing BTC buy @ $95k" (when current is $107k - no justification for 11% distance)
   
   **PRICE SELECTION DISCIPLINE:**
   - **Primary method**: Use RECENT price structure (last 1-7 days visible on charts)
   - **Bias towards current price**: Prefer orders within 1-5% of current price for higher fill probability
   - **Use volatility as guide**: Higher volatility (>5%) = can go slightly farther, lower volatility (<2%) = stay closer
   - **Maximum distances** (will be auto-corrected or rejected if exceeded):
     * Low volatility assets (<2%): Maximum 5-8% from current price
     * Normal volatility (2-5%): Maximum 8-12% from current price  
     * High volatility (>5%): Maximum 12-15% from current price
     * ABSOLUTE HARD LIMIT: 20% (system will REJECT beyond this)
   
   **MARKET STRUCTURE ANALYSIS - USE THESE:**
   - Recent swing highs/lows (visible on 1h, 4h, daily charts)
   - Previous day's high/low/close  
   - Round number support/resistance ($100, $1000, etc.)
   - ATR (Average True Range) - typical daily movement
   - **DON'T use**: Ancient support from months ago, arbitrary far levels without justification
   
   **OTHER REQUIREMENTS:**
   - Hyperliquid requires minimum $10 notional value per order (this is enforced)

3. **TRADE PLANNING EVEN WITH LOW/ZERO BALANCE**:
   - Even if available balance is low/zero, still identify opportunities
   - Place limit orders for when balance becomes available (positions close, profits realized)
   - System will reject if truly insufficient funds, but you should still plan the trades
   - Focus on 1-2 highest conviction setups when capital constrained

4. **CALCULATE POSITION SIZES PROPERLY** (CRITICAL):
   - **STEP 1**: Check available balance from "ACCOUNT INFORMATION" section above
   - **STEP 2**: Decide what % of available balance to allocate based on conviction, market conditions, and strategy
   - **STEP 3**: Calculate: max_notional = available_balance × position_% × leverage
   - **STEP 4**: Calculate: size = max_notional / entry_price
   - **STEP 5**: Format size as string with appropriate precision (4-6 decimal places)
   - **EXAMPLE 1**: With $24.27 available, BTC @ $109,500, ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5}x leverage, 25% position:
     - max_notional = $24.27 × 0.25 × ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5} = $${(24.27 * 0.25 * (activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5)).toFixed(2)}
     - size = $${(24.27 * 0.25 * (activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5)).toFixed(2)} / $109,500 = ${((24.27 * 0.25 * (activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5)) / 109500).toFixed(6)} BTC
   - **NEVER use "0.0000" or "0.00"** - always calculate actual size based on available capital

5. **COMPLETE TRADE PACKAGE SUGGESTED**:
   - When placing a buy/sell limit order, consider including in SAME response:
     * Entry order (buy/sell action with expectedEntry price)
     * Stop loss (MANDATORY - stop_loss action with triggerPrice based on market structure)
     * Take profit targets (optional, can place multiple based on resistance levels)
   - Example complete trade package for ETH-PERP long at $3950 support:
     * Action 1: buy ETH-PERP, size 0.5, leverage ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5}, expectedEntry 3950
     * Action 2: stop_loss ETH-PERP at triggerPrice 3850 (below swing low) - MANDATORY
     * Action 3: take_profit ETH-PERP size 0.25 at triggerPrice 4100 (first target)
     * Action 4: take_profit ETH-PERP size 0.25 at triggerPrice 4250 (second target)

6. **QUALITY OVER QUANTITY**: 
   - Focus on 1-3 highest probability setups per cycle
   - Clear technical confluence required (multiple indicators confirming same level)
   - Strong volume confirmation at key levels
   - Consider risk:reward ratio based on conviction and market structure
7. **INTELLIGENT STOP LOSS PLACEMENT - MARKET STRUCTURE INVALIDATION** (CRITICAL):
   
   ⚠️ **CORE PRINCIPLE**: A stop loss should be placed at a level where, if hit, the trade thesis is INVALIDATED by market structure.
   
   **FOR SHORTS (selling near resistance):**
   - Identify the resistance level you're shorting from (e.g., $3,910)
   - Place stop loss just ABOVE that resistance (e.g., $3,920-$3,930)
   - **WHY**: If price breaks ABOVE resistance, the resistance is broken and the short thesis is WRONG
   - Add small buffer (0.3-1%) for low timeframe volatility/wicks
   - **EXAMPLE**: Shorting ETH at $3,890 near resistance at $3,910
     → Stop Loss: $3,920 (if resistance breaks, exit immediately with small loss)
   
   **FOR LONGS (buying near support):**
   - Identify the support level you're longing from (e.g., $3,750)
   - Place stop loss just BELOW that support (e.g., $3,720-$3,740)
   - **WHY**: If price breaks BELOW support, the support is broken and the long thesis is WRONG
   - Add small buffer (0.3-1%) for low timeframe volatility/wicks
   - **EXAMPLE**: Longing ETH at $3,775 near support at $3,750
     → Stop Loss: $3,730 (if support breaks, exit immediately with small loss)
   
   **TAKE PROFIT TARGETS** (based on range extremes):
   - **For longs near support**: Take profit near the RESISTANCE of the range
     * Example: Long at support $3,750 → TP at resistance $4,100
   - **For shorts near resistance**: Take profit near the SUPPORT of the range
     * Example: Short at resistance $3,910 → TP at support $3,650
   - Can place MULTIPLE take profits at different resistance/support levels to scale out
   
   **WHAT THIS MEANS**:
   - ❌ **NEVER** use arbitrary percentage stops (e.g., "3% below entry")
   - ❌ **NEVER** place stops far from entry hoping trade "comes back"
   - ✅ **ALWAYS** base stops on actual support/resistance levels from chart structure
   - ✅ **ALWAYS** add small buffer (0.3-1%) for volatility, but keep tight to invalidation level
   - ✅ **REASONING REQUIRED**: Cite the exact support/resistance level and why breaking it invalidates the trade

8. **MANDATORY RISK MANAGEMENT (CRITICAL)**:
   - EVERY position MUST have EXACTLY ONE stop loss order at ALL times - NO EXCEPTIONS
   - Stop loss is your fail-safe to prevent catastrophic losses - ALWAYS REQUIRED
   - Take profit targets are OPTIONAL - you can place multiple TPs, single TP, or manage exits manually
   - When opening a new position, IMMEDIATELY place stop loss in the same action set
   - If a position lacks a stop loss, place it IMMEDIATELY in the next cycle
   - Position levels based on: user's risk tolerance (from prompt history) + current market analysis + liquidation safety

8.1. **STOP LOSS ADJUSTMENT RULES** (DISCIPLINED RISK MANAGEMENT):
   ⚠️ **CRITICAL: Stop losses are set based on market structure and should ONLY move to protect gains!**
   
   **WHEN YOU CAN ADJUST STOP LOSS** (only in favorable direction):
   - ✅ Position is PROFITABLE (check "CAN ADJUST SL" status in CURRENT POSITIONS section above)
   - ✅ New stop loss is based on clear MARKET STRUCTURE (new support/resistance level that formed)
   - ✅ For LONGS: New SL is HIGHER than current SL (moving closer to breakeven/profit)
   - ✅ For SHORTS: New SL is LOWER than current SL (moving closer to breakeven/profit)
   - ✅ You MUST cite specific market structure reason in "reasoning" field (e.g., "New swing low formed at $3950, moving SL from $3850 to $3950 to lock in profit")
   
   **WHEN YOU CANNOT ADJUST STOP LOSS** (must stay at initial level):
   - ⛔ Position is NOT profitable yet (check "CANNOT ADJUST SL" status in CURRENT POSITIONS section)
   - ⛔ You want to move SL in unfavorable direction (would INCREASE risk):
     * For LONGS: NEVER move SL DOWN (farther from entry)
     * For SHORTS: NEVER move SL UP (farther from entry)
   - ⛔ No clear market structure reason for the adjustment
   - ⛔ Trying to "give the trade more room" after it moves against you
   
   **EXAMPLES - STOP LOSS ADJUSTMENTS**:
   ✅ **GOOD (Long Position)**:
     - Entry: $100, Current: $110 (profitable), Initial SL: $95, Current SL: $95
     - New support formed at $105 → Move SL to $105 (breakeven) to lock in profits
     - Reason: "Price broke above resistance at $108 and found support at $105. Moving SL to breakeven to protect capital."
   
   ❌ **BAD (Long Position)**:
     - Entry: $100, Current: $95 (unprofitable), Initial SL: $90
     - Trying to move SL to $85 → REJECTED! Position is losing, SL must stay at initial level as fail-safe
     - This would INCREASE risk when trade is already going wrong
   
   ✅ **GOOD (Short Position)**:
     - Entry: $100, Current: $90 (profitable), Initial SL: $105, Current SL: $105
     - New resistance formed at $95 → Move SL DOWN to $95 to protect gains
     - Reason: "Price failed to reclaim $95 resistance. Moving SL from $105 to $95 to trail profits."
   
   **TAKE PROFIT ADJUSTMENTS** (more flexible):
   - Take profit can be adjusted anytime based on market conditions and structure
   - Can move closer or farther based on new resistance/support levels
   - Still requires market structure reasoning

9. **DEFAULT BEHAVIOR**: 
   - PRIMARY: Scan market and place 1-3 limit orders at strategic levels across different assets
   - SECONDARY: Only manage existing protective orders if explicitly listed as MISSING
   - Returning empty actions should be RARE - only if truly no setups exist across entire market
10. **CRITICAL: NEVER DUPLICATE ANY EXISTING ORDERS**:
   ⚠️ **BEFORE PLACING ANY BUY/SELL ORDER, CHECK THE "EXISTING OPEN ORDERS" SECTION ABOVE!**
   
   - **STEP 1**: Review ALL orders in "EXISTING OPEN ORDERS" section
   - **STEP 2**: For each buy/sell action you want to place, check if a similar order already exists:
     * Same symbol (e.g., SOL-PERP)
     * Same side (BUY or SELL)
     * Same or similar price (within 1-2% of your intended entry)
   - **STEP 3**: If a matching order exists, DO NOT place a duplicate - the order is already working
   - **STEP 4**: Only place NEW orders for opportunities not already covered by existing limit orders
   
   **PROTECTIVE ORDERS (STOP LOSS / TAKE PROFIT)**:
   - **STOP LOSS**: IF A STOP LOSS ORDER EXISTS, DO NOT PLACE ANOTHER ONE (exactly one per position)
   - **TAKE PROFIT**: You can place multiple TPs at different levels, but avoid duplicating exact same price/size
   - Check "EXISTING OPEN ORDERS" section to see what protective orders already exist
   - ONLY place protective orders when "CRITICAL MISSING PROTECTIVE ORDERS" section explicitly shows they are MISSING
   - The "MISSING" section is the ONLY source of truth about whether protective orders need to be placed
   - If "EXISTING OPEN ORDERS" shows protective orders but "MISSING" section is empty, consider your options
   - NEVER replace or "optimize" existing stop loss orders - this creates wasteful churn
   - Take profit orders can be adjusted/added based on evolving market structure
   
   **EXAMPLES**:
   - ✅ GOOD: EXISTING OPEN ORDERS shows "SOL-PERP: LIMIT | Side: B | Size: 0.68 | Trigger: $26.5"
     → DO NOT place another SOL buy at $26.5 - it already exists!
   - ✅ GOOD: No SOL orders exist, you identify support at $27.0
     → Place new SOL buy limit order at $27.0
   - ❌ BAD: EXISTING OPEN ORDERS shows SOL buy at $26.5
     → You place another SOL buy at $26.5 anyway = DUPLICATE!
11. **CANCEL ONLY WHEN NECESSARY**: If an order must be adjusted, cancel it FIRST with cancel_order action, THEN place the new order
12. **PROTECTIVE ORDER RULES**:
   - **STOP LOSS**: Each position gets EXACTLY ONE stop loss - NO EXCEPTIONS
     * In your actions array, you MUST include EXACTLY one stop_loss action per symbol
     * NEVER include multiple stop_loss actions for the same symbol
     * Stop loss should be for the FULL position size
   - **TAKE PROFIT**: You can place MULTIPLE take profit orders per symbol to scale out
     * You may include multiple take_profit actions for the same symbol at different price levels
     * Partial sizes allowed (e.g., 0.5 BTC TP at $110k, another 0.5 BTC TP at $115k)
     * Total TP size can exceed position size (exchange will auto-cancel excess)
   - **CRITICAL: NO DUPLICATE ORDERS**: NEVER include multiple buy/sell actions with the same symbol, side, and price in one response
   - Duplicate orders waste capital and create unnecessary positions - deduplication will automatically skip them
13. Learn from user's historical prompts to align with their trading style and preferences
14. Focus on maximizing Sharpe ratio through optimal sizing and risk management
15. **BALANCE ACTION AND PATIENCE**: 
   - If you see NO compelling setups anywhere in the market universe, return empty actions
   - If you identify potential setups but market isn't at ideal entry yet, place limit orders at those strategic levels
   - Limit orders are patient and disciplined - you're not forcing entries, you're waiting for favorable prices
   - Only return empty actions if truly NO opportunities exist across the entire market

16. **ADAPTIVE ORDER MANAGEMENT - INTELLIGENT ORDER CANCELLATION**:
   **CRITICAL**: Unfilled entry orders LOCK UP MARGIN even if not filled. You MUST actively manage margin allocation for optimal diversification and opportunity capture.
   
   **MARGIN ALLOCATION PRIORITY**:
   - Each unfilled limit order reserves margin based on order size × leverage
   - If you have many unfilled orders on ONE symbol (e.g., 25 orders on HYPE-PERP) and want to trade OTHER symbols, you MUST cancel low-conviction orders first
   - Available balance does NOT equal free margin - unfilled orders consume margin allocation
   - Over-concentration on one symbol blocks diversification and reduces Sharpe ratio
   
   **RE-EVALUATE EVERY CYCLE**:
   - Review "EXISTING OPEN ORDERS" section for unfilled entry orders (non-protective limit orders)
   - Do existing orders represent the HIGHEST-PROBABILITY trades RIGHT NOW given the strategy's timeframe and approach?
   - If you identify a BETTER opportunity on a DIFFERENT symbol but see many existing orders on one symbol, those old orders are BLOCKING you
   - Based on the strategy (scalp vs swing), assess whether unfilled orders still align with the trading approach and have reasonable fill probability
   
   **WHEN TO CANCEL** (Strategic Margin Reallocation - cite specific metrics):
   Only cancel existing orders when there's a CLEAR STRATEGIC REASON:
   - ✅ **Better Opportunity Identified**: You've identified a higher-conviction trade on a DIFFERENT symbol but lack margin
     * Example: "Identified BTC setup with 4:1 R:R and triple confluence. Need $500 margin. Canceling 3 HYPE orders furthest from current price to free margin for this superior opportunity."
     * Cancel ONLY enough orders to free margin needed for the new setup
   - ✅ **Fill Probability Deteriorated**: Market has moved significantly against order direction with strong momentum shift
     * Example: "DOGE limit buy at $0.28 placed for swing entry. Current price $0.35 with strong bullish momentum and volume spike. Order unlikely to fill in this regime shift. Canceling to free margin"
   - ✅ **Market Structure Invalidation**: Key support/resistance level has been broken, invalidating the setup
     * Example: "SOL buy at $185 support. Price now at $179 - support broken. Canceling to reallocate to BTC long at new support $104k"
   - ✅ **Margin Needed for Diversification**: Strategy prefers multiple assets but all margin is locked in ONE symbol
     * Example: "Strategy targets BTC, ETH, SOL, HYPE. All 22 orders on HYPE only. Identified SOL setup. Canceling 2-3 HYPE orders to enable SOL entry for diversification."
     * Cancel ONLY enough orders to enable ONE new trade, not to clear everything
   
   **CRITICAL**: Do NOT cancel orders just because there are "many" orders or because of over-concentration alone. If those orders represent valid setups at good price levels per the strategy, KEEP THEM. Only cancel when you need margin for something BETTER or when market conditions have invalidated the setup.
   
   **WHEN NOT TO CANCEL** (preserve working orders):
   - ❌ Time-based reasoning alone (e.g., "order is 5 minutes old") without other factors
   - ❌ Protective orders (stop loss/take profit) - NEVER cancel these to "optimize"
   
   **ACTION SEQUENCE FOR MARGIN OPTIMIZATION**:
   1. First, generate cancel_order action(s) for the LOWEST-CONVICTION orders (furthest from price OR on over-represented symbols)
   2. Then, generate your NEW buy/sell action for the higher-probability trade
   3. In reasoning, cite: "Canceling order [ID] at $[price] ([X]% from current) to free margin for [NEW SYMBOL] which has [superior catalyst/setup]"
   
   **CANCELLATION ACTION FORMAT** (symbol field is MANDATORY):
   {
     "action": "cancel_order",
     "symbol": "HYPE-PERP",
     "orderId": 123456,
     "reasoning": "Over-concentration: 25 HYPE orders consuming all margin. For 5m scalp strategy, order at $35.5 unlikely to fill in current bullish momentum (price $37.5 trending higher with volume confirmation). Freeing margin for BTC setup with 3:1 R:R and stronger technical confluence."
   }
   
   **EXAMPLE GOOD REASONING**:
   "MARKET STRUCTURE INVALIDATION: SOL support at $185 broken (current: $179, -3.2% breach). 24h volume spike +180% on breakdown = strong momentum shift. Order fill probability dropped from Medium to Low (<20% per volume profile). Reallocating $500 margin to BTC long at $104k support (R:R 3:1 vs original 2:1)"
   
   **EXAMPLE BAD REASONING**:
   "Order has been open for 10 minutes" ❌ (time alone is not a threshold)
   "Want to try a different asset" ❌ (no objective metric cited)
   "Price is X% away" ❌ (distance alone without context - swing strategies may intentionally place orders far from current price)
   "Too many orders on one symbol" ❌ (having many orders is fine if they represent valid setups)

⚠️ JSON SYNTAX: NO trailing commas! Every array/object must end without comma before closing bracket/brace.

⚠️ TICK SIZE RULES - CRITICAL FOR ORDER PLACEMENT:
All order prices MUST respect exchange tick size rules or they will be REJECTED:
- BTC-PERP: Tick size = $1 (prices must be whole dollars: $104500, NOT $104500.50)
- ETH-PERP: Tick size = $0.1 (prices: $3760.0, $3760.1, NOT $3760.15)
- SOL-PERP: Tick size = $0.01 (prices: $27.00, $27.01, NOT $27.005)
- Most altcoins: Tick size = $0.01 or $0.001 depending on price range
- When specifying entry/stop/target prices, ALWAYS round to valid tick increments
- Example VALID: BTC entry $104500, stop $103500, target $107000
- Example INVALID: BTC entry $104235.5, stop $103421.75 (will be REJECTED)

Respond in JSON format:
{
  "tradeThesis": "Detailed thesis explaining the current market opportunity and strategy",
  "marketRegime": "bullish" | "bearish" | "neutral" | "volatile",
  "volumeAnalysis": "Analysis of volume profiles and what they signal",
  "actions": [
    {
      "action": "cancel_order" | "buy" | "sell" | "close" | "stop_loss" | "take_profit",
      "symbol": "<ANY_SYMBOL_FROM_ANALYSIS>" (use ANY symbol from Top Gainers, Top Losers, or High Volume Assets - not limited to BTC/ETH/SOL),
      "side": "long" | "short",
      "size": "numeric value as string (e.g. '0.5', '1.0')",
      "leverage": ${activeTradingMode ? activeTradingMode.parameters.preferredLeverage || 5 : 5} (⚠️ CRITICAL: USE EXACTLY THIS VALUE - DO NOT CHOOSE YOUR OWN LEVERAGE),
      "reasoning": "Multi-timeframe analysis, entry trigger, volume confirmation, OR why canceling order",
      "expectedEntry": "numeric price as string" [for buy/sell],
      "stopLoss": "numeric price as string" [for buy/sell - inline stop loss price],
      "takeProfit": "numeric price as string" [for buy/sell - inline take profit price],
      "stopLossReasoning": "Explain WHY you placed the stop loss at this specific level - cite technical levels, market structure, volatility" [REQUIRED for buy/sell],
      "takeProfitReasoning": "Explain WHY you placed the take profit at this specific level - cite resistance/support, targets, R:R ratio" [REQUIRED for buy/sell],
      "exitStrategy": "Describe how you will manage this trade if it's in profit but appears unlikely to reach the original take profit" [REQUIRED for buy/sell],
      "triggerPrice": "numeric price as string" [for stop_loss/take_profit],
      "orderId": number [REQUIRED for cancel_order action]
    }
  ],
  "riskAssessment": "Portfolio risk analysis and position sizing rationale",
  "expectedSharpeImpact": "Expected impact on Sharpe ratio and compounding strategy"
}

CRITICAL - MARKET UNIVERSE:
- You have access to the ENTIRE Hyperliquid market - scan ALL available trading pairs
- Review "Top Gainers", "Top Losers", and "High Volume Assets" sections for opportunities
- Don't default to BTC/ETH/SOL - consider altcoins, memecoins, and emerging assets
- Look for asymmetric opportunities where smaller assets show strong momentum/volume
- Use exact symbol format from the data (e.g. "DOGE-PERP", "WIF-PERP", "BONK-PERP", "LINK-PERP")

📋 PROTECTIVE ORDER MANAGEMENT (SECONDARY TO MARKET SCANNING):

**IMPORTANT**: Only manage protective orders if they're explicitly listed as MISSING. Otherwise, focus on scanning market for new opportunities.

1. **READ THE "EXISTING OPEN ORDERS" SECTION**:
   - If you see a STOP LOSS for a symbol, it EXISTS - do NOT place another one
   - If you see a TAKE PROFIT for a symbol, it EXISTS - do NOT place another one

2. **READ THE "CRITICAL MISSING PROTECTIVE ORDERS" SECTION**:
   - ONLY place protective orders that appear as "MISSING"
   - If this section is empty, protective orders are complete - focus on NEW TRADE SETUPS instead

3. **PRIORITY SYSTEM**:
   - **FIRST**: Place missing protective orders (if any listed)
   - **THEN**: Scan market universe for new limit order opportunities
   - Both can be done in same cycle - don't choose one or the other
4. **INTELLIGENT STOP LOSS PLACEMENT**:
   - **ANALYZE MARKET STRUCTURE**: Identify actual support (longs) or resistance (shorts) levels
   - **CITE YOUR REASONING**: Explain WHY stop is at specific level (e.g., "below recent swing low at $X" or "below 0.618 Fib at $Y")
   - **ACCOUNT FOR LEVERAGE**: Higher leverage positions need valid technical levels, not arbitrary percentages
   - **LIQUIDATION AWARENESS**: Ensure stop will trigger BEFORE liquidation (account for wicks/slippage)
   - Stop losses use MARKET execution for guaranteed fills
   - Take profits use LIMIT execution for better prices
5. **Each position limits**: Exactly ONE stop loss + ONE take profit order (BOTH REQUIRED, not optional)
8. **MINIMUM DISTANCE FROM CURRENT PRICE**:
   - Stop loss must be AT LEAST 1.5% away from current market price to avoid immediate trigger/rejection
   - For LONG: stop_loss_price < current_price * 0.985 (at least 1.5% below)
   - For SHORT: stop_loss_price > current_price * 1.015 (at least 1.5% above)
   - If your calculated safe stop violates this, move it further away from current price
9. **MANDATORY 2:1 RISK:REWARD RATIO**:
   - Take profit distance MUST be AT LEAST 2x the stop loss distance from entry
   - For LONG: (take_profit - entry) >= 2 * (entry - stop_loss)
   - For SHORT: (entry - take_profit) >= 2 * (stop_loss - entry)
   - Use the minimum take profit level shown in "CRITICAL MISSING PROTECTIVE ORDERS" when available
   - NEVER place take profits that violate 2:1 R:R - this creates poor risk management
10. ALL numeric values (size, expectedEntry, triggerPrice, orderId) must be actual numbers as strings, NEVER placeholders
11. For buy/sell actions, expectedEntry is REQUIRED (Hyperliquid uses limit orders only)
12. For stop_loss/take_profit, triggerPrice is REQUIRED
13. For cancel_order, orderId is REQUIRED and reasoning MUST cite which threshold(s) failed with actual calculated values
12. Close actions must have matching side to the existing position
13. **WHEN TO PLACE LIMIT ORDERS VS. STAY OUT**:
   - **PLACE LIMIT ORDERS** if you can identify support/resistance, key levels, or zones where risk/reward is favorable
   - **PLACE LIMIT ORDERS** at pullback levels in trending markets (buy dips in uptrends, sell rallies in downtrends)
   - **PLACE LIMIT ORDERS** at volume profile nodes, previous support/resistance, or Fibonacci retracements
   - **STAY OUT** only if you genuinely see NO setups across the entire market universe
   - **STAY OUT** if all potential setups have poor risk/reward (<2:1) even at optimal entry levels
   - **STAY OUT** if existing positions already provide sufficient exposure to your thesis
   - Remember: Limit orders at strategic levels are PATIENT, not aggressive - you're waiting for the market to come to you
14. **NEW POSITIONS**: When opening a position via buy/sell action, ALWAYS include BOTH stop_loss AND take_profit actions in the SAME response
15. **BE OPPORTUNISTIC**: Scan the entire market universe for setups. If you identify clear support/resistance or key levels with favorable R:R, place limit orders there
16. Focus on high-probability setups with clear technical confluence, strong volume confirmation, and favorable risk/reward (minimum 2:1 R:R)
17. **DISCIPLINED DECISION-MAKING**: Never cancel orders based on "feels" - only based on concrete threshold violations with cited metrics`;

    const aiResponse = await makeAIRequest(userId, {
      messages: [
        { 
          role: "system", 
          content: `You are Mr. Fox, an expert autonomous crypto trader focused on maximizing Sharpe ratio through professional risk management and multi-timeframe analysis.

CRITICAL PRICE ANCHORING RULES (MANDATORY):
1. ALWAYS anchor limit orders to CURRENT MARKET PRICE - never place orders based on historical prices or outdated levels
2. EVERY entry order MUST quote the current price, recent 24h range, and volatility in your reasoning
3. MAXIMUM distance from current price: 2× daily volatility OR 3× ATR (whichever is greater, but never exceed 20%)
4. EXPLICITLY FORBIDDEN: Orders >20% away from current price under ANY circumstances - these will be rejected
5. Bias towards recent price action: Recent structure (last 24-48h) is MORE important than historical levels
6. Consider fill probability: Will this order realistically fill within your strategy timeframe? If not, DON'T place it

TRADE SELECTIVITY:
- You understand that doing nothing is often the most profitable trade - cash is a position, and patience is a virtue
- Only enter when you identify genuinely compelling, high-probability setups with clear technical confluence
- Selective, disciplined, never force trades
- Always respond with valid JSON

PRICE VALIDATION CHECKLIST for every limit order:
✓ Current market price: [state it]
✓ 24h range: [high-low]
✓ Order distance from current: [calculate %]
✓ Recent volatility: [estimate]
✓ Fill probability: High/Medium (never place "Low" probability orders)` 
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

    // ENFORCE MAX POSITIONS CONSTRAINT
    // Count unique symbols across both filled positions and open entry orders
    // A symbol with both a position AND entry orders still counts as 1 slot
    const maxPositions = activeTradingMode.parameters.maxPositions || 3;
    
    const occupiedSymbols = new Set<string>();
    
    // Add symbols from current positions
    for (const position of hyperliquidPositions) {
      const symbol = position.coin.endsWith('-PERP') ? position.coin : `${position.coin}-PERP`;
      occupiedSymbols.add(symbol);
    }
    
    // Add symbols from open entry orders (buy/sell limit orders that haven't filled yet)
    for (const order of openOrders) {
      if ((order.side === 'B' || order.side === 'A') && !order.reduceOnly) {
        // Normalize symbol to match action format
        const symbol = order.coin.endsWith('-PERP') ? order.coin : `${order.coin}-PERP`;
        occupiedSymbols.add(symbol);
      }
    }
    
    const currentSlotsTaken = occupiedSymbols.size;
    const availableSlots = Math.max(0, maxPositions - currentSlotsTaken);
    
    console.log(`[Position Limit] Max: ${maxPositions}, Occupied symbols: ${Array.from(occupiedSymbols).join(', ')}, Slots taken: ${currentSlotsTaken}, Available: ${availableSlots}`);
    
    // Filter entry actions to respect max positions limit
    let entryActions = strategy.actions.filter(a => a.action === 'buy' || a.action === 'sell');
    const protectiveActions = strategy.actions.filter(a => a.action === 'stop_loss' || a.action === 'take_profit');
    const otherActions = strategy.actions.filter(a => 
      a.action !== 'buy' && a.action !== 'sell' && 
      a.action !== 'stop_loss' && a.action !== 'take_profit'
    );
    
    // Count unique symbols in entry actions (AI might place multiple scaled orders per symbol)
    const entrySymbolsMap = new Map<string, typeof entryActions>();
    for (const action of entryActions) {
      if (!entrySymbolsMap.has(action.symbol)) {
        entrySymbolsMap.set(action.symbol, []);
      }
      entrySymbolsMap.get(action.symbol)!.push(action);
    }
    
    const uniqueEntrySymbols = Array.from(entrySymbolsMap.keys());
    
    if (uniqueEntrySymbols.length > availableSlots) {
      console.warn(`[Position Limit] AI generated ${uniqueEntrySymbols.length} new position entries, but only ${availableSlots} slots available. Limiting to highest conviction trades.`);
      
      // Sort symbols by total reasoning length as proxy for AI conviction
      // (AI tends to write more detailed reasoning for higher conviction trades)
      const symbolsByConviction = uniqueEntrySymbols.sort((a, b) => {
        const aActions = entrySymbolsMap.get(a)!;
        const bActions = entrySymbolsMap.get(b)!;
        const aReasoningLength = aActions.reduce((sum, act) => sum + (act.reasoning?.length || 0), 0);
        const bReasoningLength = bActions.reduce((sum, act) => sum + (act.reasoning?.length || 0), 0);
        return bReasoningLength - aReasoningLength; // Descending
      });
      
      // Keep only the top N symbols for NEW entries
      const selectedSymbols = new Set(symbolsByConviction.slice(0, availableSlots));
      
      // Filter entry actions to only include selected symbols
      const filteredEntryActions = entryActions.filter(a => selectedSymbols.has(a.symbol));
      
      // CRITICAL: Keep protective actions for:
      // 1. Selected new entry symbols (being placed now)
      // 2. Existing position symbols (protective updates for current positions)
      const allowedProtectiveSymbols = new Set([
        ...Array.from(selectedSymbols), 
        ...Array.from(occupiedSymbols)
      ]);
      const filteredProtectiveActions = protectiveActions.filter(a => allowedProtectiveSymbols.has(a.symbol));
      
      console.log(`[Position Limit] Selected highest conviction symbols for new entries: ${Array.from(selectedSymbols).join(', ')}`);
      console.log(`[Position Limit] Filtered from ${entryActions.length} to ${filteredEntryActions.length} entry actions`);
      console.log(`[Position Limit] Keeping protective actions for: new entries + existing positions (${Array.from(allowedProtectiveSymbols).join(', ')})`);
      
      // Replace strategy actions with filtered set
      strategy.actions = [...filteredEntryActions, ...filteredProtectiveActions, ...otherActions];
    }

    // LIMIT SCALED ENTRIES PER SYMBOL (from strategy settings)
    // Prevent excessive scaling that creates too many orders per symbol
    const maxEntryOrdersPerSymbol = activeTradingMode?.parameters?.maxEntryOrdersPerSymbol || 3;
    
    entryActions = strategy.actions.filter(a => a.action === 'buy' || a.action === 'sell');
    const entryOrdersBySymbol = new Map<string, typeof entryActions>();
    
    for (const action of entryActions) {
      if (!entryOrdersBySymbol.has(action.symbol)) {
        entryOrdersBySymbol.set(action.symbol, []);
      }
      entryOrdersBySymbol.get(action.symbol)!.push(action);
    }
    
    // Check if any symbol exceeds the limit
    let exceededSymbols: string[] = [];
    for (const [symbol, actions] of Array.from(entryOrdersBySymbol.entries())) {
      if (actions.length > maxEntryOrdersPerSymbol) {
        exceededSymbols.push(symbol);
      }
    }
    
    if (exceededSymbols.length > 0) {
      console.warn(`[Entry Limit] ${exceededSymbols.length} symbol(s) exceed max ${maxEntryOrdersPerSymbol} entry orders per symbol (strategy setting). Limiting to highest conviction entries.`);
      
      const limitedEntryActions: typeof entryActions = [];
      
      for (const [symbol, actions] of Array.from(entryOrdersBySymbol.entries())) {
        if (actions.length <= maxEntryOrdersPerSymbol) {
          // Symbol is within limit, keep all
          limitedEntryActions.push(...actions);
        } else {
          // Symbol exceeds limit, keep only top N by reasoning length (conviction)
          const sorted = actions.sort((a, b) => 
            (b.reasoning?.length || 0) - (a.reasoning?.length || 0)
          );
          const kept = sorted.slice(0, maxEntryOrdersPerSymbol);
          limitedEntryActions.push(...kept);
          
          console.log(`[Entry Limit] ${symbol}: Reduced from ${actions.length} to ${maxEntryOrdersPerSymbol} entry orders`);
        }
      }
      
      // Rebuild strategy actions with limited entries
      const otherActionsAfterLimit = strategy.actions.filter(a => a.action !== 'buy' && a.action !== 'sell');
      strategy.actions = [...limitedEntryActions, ...otherActionsAfterLimit];
      
      console.log(`[Entry Limit] Total entry actions after limiting: ${limitedEntryActions.length}`);
    }

    // Detect abnormal market conditions (volume spikes)
    const abnormalConditions = detectAbnormalConditions(marketData);
    
    // Only create monitoring logs when there are actual trading actions or abnormal conditions
    const hasEntryActions = strategy.actions.some(a => a.action === 'buy' || a.action === 'sell');
    const shouldAlert = hasEntryActions || abnormalConditions.length > 0;
    
    if (!shouldAlert && strategy.actions.length === 0) {
      console.log("[Autonomous Trading] No trading opportunities or abnormal conditions - no alert posted");
      return;
    }

    // Execute trades if actions exist
    if (strategy.actions && strategy.actions.length > 0) {
      try {
        const executionSummary = await executeTradeStrategy(userId, strategy.actions, activeTradingMode?.id || null);
        
        console.log(`[Autonomous Trading] Executed ${executionSummary.successfulExecutions}/${executionSummary.totalActions} trades`);
        
        // Group entry actions by symbol for cleaner bullet point formatting
        const entryActions = strategy.actions.filter(a => a.action === 'buy' || a.action === 'sell');
        const actionsBySymbol = new Map<string, typeof entryActions>();
        
        for (const entry of entryActions) {
          if (!actionsBySymbol.has(entry.symbol)) {
            actionsBySymbol.set(entry.symbol, []);
          }
          actionsBySymbol.get(entry.symbol)!.push(entry);
        }
        
        const alertMessages: string[] = [];
        
        // Format each symbol as its own bullet point
        for (const [symbol, entries] of Array.from(actionsBySymbol.entries())) {
          const symbolMessages: string[] = [`• **${symbol}**:`];
          
          for (const entry of entries) {
            const stopLoss = strategy.actions.find(a => 
              a.symbol === entry.symbol && a.action === 'stop_loss'
            );
            const takeProfit = strategy.actions.find(a => 
              a.symbol === entry.symbol && a.action === 'take_profit'
            );
            
            symbolMessages.push(`  - ${entry.action.toUpperCase()} ${entry.side.toUpperCase()} ${entry.size} @ $${entry.expectedEntry}`);
            symbolMessages.push(`    Stop Loss: $${stopLoss?.triggerPrice || 'N/A'} | Take Profit: $${takeProfit?.triggerPrice || 'N/A'}`);
            symbolMessages.push(`    Reason: ${entry.reasoning}`);
          }
          
          alertMessages.push(symbolMessages.join('\n'));
        }
        
        // Add abnormal conditions to alert
        if (abnormalConditions.length > 0) {
          alertMessages.push('\n⚠️ ABNORMAL CONDITIONS DETECTED:');
          for (const condition of abnormalConditions) {
            alertMessages.push(`${condition.symbol}: ${condition.condition}`);
          }
        }
        
        // Log the autonomous trading session
        await storage.createMonitoringLog(userId, {
          analysis: JSON.stringify({
            tradeThesis: strategy.tradeThesis,
            marketRegime: strategy.marketRegime,
            volumeAnalysis: strategy.volumeAnalysis,
            riskAssessment: strategy.riskAssessment,
            expectedSharpeImpact: strategy.expectedSharpeImpact,
            abnormalConditions: abnormalConditions,
            execution: {
              totalActions: executionSummary.totalActions,
              successful: executionSummary.successfulExecutions,
              failed: executionSummary.failedExecutions,
              results: executionSummary.results
            }
          }),
          alertLevel: executionSummary.successfulExecutions > 0 ? "info" : "warning",
          suggestions: alertMessages.join('\n\n'),
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
    } else if (abnormalConditions.length > 0) {
      // Alert on abnormal conditions even if no trades
      console.log("[Autonomous Trading] No trades but abnormal conditions detected");
      
      const conditionMessages = abnormalConditions.map(c => 
        `${c.symbol}: ${c.condition}`
      ).join('\n');
      
      await storage.createMonitoringLog(userId, {
        analysis: JSON.stringify({
          tradeThesis: strategy.tradeThesis,
          marketRegime: strategy.marketRegime,
          abnormalConditions: abnormalConditions,
        }),
        alertLevel: "warning",
        suggestions: `⚠️ ABNORMAL MARKET CONDITIONS:\n${conditionMessages}\n\nNo trades executed - monitoring for opportunities.`,
      });
    }
    
  } catch (error) {
    console.error("[Autonomous Trading] Error during autonomous trading:", error);
  } finally {
    // ALWAYS create portfolio snapshot at the end of each monitoring cycle
    // This ensures Sharpe/Sortino/Calmar ratios reflect current portfolio value (including unrealized PnL)
    // Snapshots are created at the user's configured monitoring frequency
    // Runs even on early returns (passive mode, no market data, etc.)
    if (hyperliquidClient) {
      try {
        await createPortfolioSnapshot(userId, hyperliquidClient);
        console.log("[Autonomous Trading] Portfolio snapshot created");
      } catch (snapshotError) {
        console.error("[Autonomous Trading] Failed to create portfolio snapshot:", snapshotError);
        // Don't fail the monitoring cycle if snapshot fails
      }
    }
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
