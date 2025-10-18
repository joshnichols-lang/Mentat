import { storage } from "./storage";
import { getUserHyperliquidClient } from "./hyperliquid/client";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { makeAIRequest } from "./aiRouter";
import { getRecentLearnings } from "./evaluationService";

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

// Store previous volume data for abnormal condition detection
const previousVolumeData = new Map<string, Map<string, number>>();

/**
 * Discover existing positions and track their protective orders if not already tracked
 * This ensures positions opened manually or during server downtime are tracked
 */
async function discoverAndTrackExistingPositions(userId: number): Promise<void> {
  try {
    const hyperliquid = await getUserHyperliquidClient(userId);
    
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
      const existingState = await storage.getProtectiveOrderState(userId, symbol);
      
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
          userId,
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
  const VOLUME_SPIKE_THRESHOLD = 3.0; // 3x normal volume is abnormal
  
  for (const asset of marketData) {
    const symbol = asset.symbol;
    const currentVolume = parseFloat(asset.volume24h || '0');
    
    // Get global previous volume map
    if (!previousVolumeData.has('global')) {
      previousVolumeData.set('global', new Map());
    }
    const volumeMap = previousVolumeData.get('global')!;
    const previousVolume = volumeMap.get(symbol) || currentVolume;
    
    // Detect volume spikes (current volume is 3x+ previous volume)
    if (previousVolume > 0 && currentVolume > previousVolume * VOLUME_SPIKE_THRESHOLD) {
      const volumeRatio = currentVolume / previousVolume;
      abnormalConditions.push({
        symbol,
        condition: `Volume spike detected: ${volumeRatio.toFixed(2)}x normal volume`,
        volumeRatio
      });
    }
    
    // Update previous volume
    volumeMap.set(symbol, currentVolume);
  }
  
  return abnormalConditions;
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
    
    // POSITION DISCOVERY: Track existing positions and their protective orders
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
    const withdrawable = parseFloat(userState?.marginSummary?.withdrawable || '0');
    const totalMarginUsed = parseFloat(userState?.marginSummary?.totalMarginUsed || '0');
    
    // Fetch recent learnings from past trade evaluations (filtered by current market regime)
    const recentLearnings = await getRecentLearnings(userId, marketRegime.regime, 8);
    
    // Fetch active trading mode/strategy
    let activeTradingMode: any = null;
    try {
      const tradingModes = await storage.getTradingModes(userId);
      activeTradingMode = tradingModes.find((m: any) => m.isActive === 1);
      if (activeTradingMode) {
        console.log(`[Autonomous Trading] Using active trading strategy: ${activeTradingMode.name} (${activeTradingMode.type})`);
      } else {
        console.log(`[Autonomous Trading] No active trading strategy configured`);
      }
    } catch (modeError) {
      console.error("Failed to fetch trading modes:", modeError);
    }
    
    const prompt = `You are Mr. Fox, an autonomous AI trader. Develop a complete trade thesis and execute trades based on current market conditions.

ACCOUNT INFORMATION (CRITICAL - READ THIS FIRST):
- Total Portfolio Value: $${accountValue.toFixed(2)}
- Available Balance: $${withdrawable.toFixed(2)}
- Total Margin Used: $${totalMarginUsed.toFixed(2)}

${activeTradingMode ? `🎯 ACTIVE TRADING STRATEGY: "${activeTradingMode.name}" (${activeTradingMode.type})
**YOU MUST FOLLOW THIS STRATEGY - IT IS THE USER'S EXPLICIT INSTRUCTIONS**

Strategy Configuration:
- Type: ${activeTradingMode.type} (${
  activeTradingMode.type === 'scalp' ? 'quick entries/exits, tight stops, frequent trades' :
  activeTradingMode.type === 'swing' ? 'hold for days/weeks, wider stops, fewer trades' :
  activeTradingMode.type === 'trend' ? 'follow strong trends, trail stops, patient entries' :
  activeTradingMode.type === 'mean_reversion' ? 'buy dips, sell rallies, counter-trend' :
  'custom strategy'
})
- Timeframe: ${activeTradingMode.parameters.timeframe || 'not specified'}
- Risk Per Trade: ${activeTradingMode.parameters.riskPercentage || 2}% of account
- Max Positions: ${activeTradingMode.parameters.maxPositions || 3} concurrent positions
- Preferred Leverage: ${activeTradingMode.parameters.preferredLeverage || 5}x
${activeTradingMode.parameters.preferredAssets ? `- Preferred Assets: ${activeTradingMode.parameters.preferredAssets}` : ''}
${activeTradingMode.description ? `- Description: ${activeTradingMode.description}` : ''}
${activeTradingMode.parameters.customRules ? `- Custom Rules:\n${activeTradingMode.parameters.customRules}` : ''}

⚠️ STRATEGY COMPLIANCE RULES:
1. ONLY trade assets from the preferred assets list (if specified)
2. NEVER exceed the max positions limit
3. USE the specified leverage (${activeTradingMode.parameters.preferredLeverage || 5}x)
4. RISK exactly ${activeTradingMode.parameters.riskPercentage || 2}% per trade
5. FOLLOW the timeframe and trading style for ${activeTradingMode.type}
6. RESPECT all custom rules specified above

` : '⚠️ NO ACTIVE TRADING STRATEGY - Using general conservative approach\n'}
⚠️ MANDATORY POSITION SIZING & LEVERAGE RULES:
1. **LEVERAGE SELECTION** (CRITICAL - impacts ALL calculations):
   - **Recommended: 3x-5x leverage** for balanced risk/reward
   - **Conservative: 2x-3x** for choppy/uncertain markets
   - **Aggressive: 5x-10x** for high-conviction setups with tight stops
   - **NEVER USE >10x** - extremely dangerous, liquidation risk too high
   - Higher leverage = tighter stop loss required = less room for price movement
   
2. **POSITION SIZE CALCULATION** (accounting for leverage):
   - Available Balance: $${withdrawable.toFixed(2)}
   - Max position margin: 30% of available = $${(withdrawable * 0.30).toFixed(2)}
   - Notional value = margin × leverage
   - Position size = notional / entry_price
   
3. **EXAMPLE with $100 available, BTC @ $30,000**:
   - At 3x leverage: margin=$30, notional=$90, size=0.003 BTC
   - At 5x leverage: margin=$30, notional=$150, size=0.005 BTC
   - At 10x leverage: margin=$30, notional=$300, size=0.01 BTC
   
4. **INTELLIGENT STOP LOSS PLACEMENT** (LEVERAGE-ADJUSTED + market structure):
   - **CRITICAL**: Higher leverage = MUCH TIGHTER stop loss required
   - **FORMULA**: Max stop loss % from entry = (Risk % of account) / Leverage
     * Example: 3% account risk ÷ 20x leverage = 0.15% max stop from entry price
     * Example: 3% account risk ÷ 5x leverage = 0.6% max stop from entry price
     * Example: 3% account risk ÷ 3x leverage = 1.0% max stop from entry price
   - **PLACEMENT PROCESS**:
     1. First, calculate maximum stop distance using leverage formula above
     2. Then, find nearest support/resistance level within that range
     3. If no strong level exists within range, DON'T TAKE THE TRADE
   - **CONCRETE EXAMPLES**:
     * ETH @ $3800, 20x leverage: Max 0.15% stop = $3794.30 stop loss (very tight!)
     * ETH @ $3800, 10x leverage: Max 0.30% stop = $3788.60 stop loss (tight)
     * ETH @ $3800, 5x leverage: Max 0.60% stop = $3777.20 stop loss (moderate)
     * ETH @ $3800, 3x leverage: Max 1.0% stop = $3762.00 stop loss (comfortable)
   - **NEVER use wide stops with high leverage** - this leads to liquidation
   - **Position-specific risk**: Calculate based on THIS position's notional value, not total portfolio
   
5. **CURRENT AVAILABLE: $${withdrawable.toFixed(2)}**:
   - With 3x leverage: max notional = $${((withdrawable * 0.30) * 3).toFixed(2)}
   - With 5x leverage: max notional = $${((withdrawable * 0.30) * 5).toFixed(2)}

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
  const missingProtection: string[] = [];
  for (const pos of currentPositions) {
    const posSymbol = pos.symbol;
    const hasStopLoss = openOrders.some(order => 
      order.coin === posSymbol && 
      order.orderType?.trigger?.tpsl === 'sl' && 
      order.reduceOnly
    );
    const hasTakeProfit = openOrders.some(order => 
      order.coin === posSymbol && 
      order.orderType?.trigger?.tpsl === 'tp' && 
      order.reduceOnly
    );
    
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
      const currentPrice = pos.currentPrice;
      const entryPrice = pos.entryPrice;
      // Calculate minimum take profit for 2:1 R:R
      const existingStopLoss = openOrders.find(order => 
        order.coin === posSymbol && 
        order.orderType?.trigger?.tpsl === 'sl' && 
        order.reduceOnly
      );
      if (existingStopLoss) {
        const stopPrice = parseFloat(existingStopLoss.orderType?.trigger?.triggerPx || '0');
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

2. **PLACE SCALED LIMIT ORDERS AT STRATEGIC LEVELS** (CRITICAL - DON'T STACK AT SAME PRICE):
   - **SCALE ORDERS AROUND TARGET PRICE** - If you want to accumulate 1.0 ETH at ~$3750, DON'T place three 0.33 ETH orders at $3750
   - **CORRECT APPROACH**: Spread orders ±1-3% around target to account for volatility:
     * 0.3 ETH at $3740 (below target - catches early bounce)
     * 0.4 ETH at $3750 (at target - main fill)
     * 0.3 ETH at $3760 (above target - ensures partial fill)
   - **For LONG setups**: Place scaled BUY limit orders at/below support levels
     * Example: BTC support at $105k, want 0.1 BTC → 0.03 @ $104k, 0.04 @ $105k, 0.03 @ $106k
   - **For SHORT setups**: Place scaled SELL limit orders at/above resistance levels
     * Example: ETH resistance at $4.2k, want 0.5 ETH → 0.15 @ $4.18k, 0.2 @ $4.2k, 0.15 @ $4.22k
   - **NEVER place multiple orders at the EXACT SAME PRICE** - this provides no advantage
   - **BE PATIENT**: Don't chase market - let price come to your strategic scaled levels
   - **ALWAYS INCLUDE**: Full position sizing, leverage selection, stop loss, and take profit in SAME action set

2.1. **PRICE REASONABLENESS VALIDATION** (CRITICAL):
   - All limit orders are validated against current market prices BEFORE placement
   - **ENTRY ORDERS (buy/sell limit orders)**: Must be within ±30% of current market price
     * ✅ GOOD: SOL @ $187, placing limit BUY at $180 (4% below) ← WILL BE ACCEPTED
     * ✅ GOOD: SOL @ $187, placing limit BUY at $140 (25% below) ← WILL BE ACCEPTED
     * ❌ BAD: SOL @ $187, placing limit BUY at $25 (87% below) ← WILL BE REJECTED
     * ❌ BAD: ETH @ $3900, placing limit SELL at $6500 (67% above) ← WILL BE REJECTED
   - **PROTECTIVE ORDERS (stop loss/take profit)**: Must be within ±55% of current market price
     * Wider range to accommodate high-leverage scenarios and extreme volatility
   - **WHY THIS MATTERS**: Orders too far from market waste exchange capacity and will never fill
   - **WHAT TO DO**: Always check current market prices and place realistic limit orders within acceptable ranges
   - **REJECTION HANDLING**: If your order is rejected for price reasonableness, place it closer to current market price

3. **TRADE PLANNING EVEN WITH LOW/ZERO BALANCE**:
   - Even if available balance is low/zero, still identify opportunities
   - Place limit orders for when balance becomes available (positions close, profits realized)
   - System will reject if truly insufficient funds, but you should still plan the trades
   - Focus on 1-2 highest conviction setups when capital constrained

4. **CALCULATE POSITION SIZES PROPERLY** (CRITICAL):
   - **STEP 1**: Check available balance from "ACCOUNT INFORMATION" section above
   - **STEP 2**: Decide what % of available balance to risk (recommended: 20-30% per position)
   - **STEP 3**: Calculate: max_notional = available_balance × position_% × leverage
   - **STEP 4**: Calculate: size = max_notional / entry_price
   - **STEP 5**: Format size as string with appropriate precision (4-6 decimal places)
   - **EXAMPLE 1**: With $24.27 available, BTC @ $109,500, 3x leverage, 25% position:
     - max_notional = $24.27 × 0.25 × 3 = $18.20
     - size = $18.20 / $109,500 = 0.000166 BTC (formatted as "0.000166")
   - **EXAMPLE 2**: With $24.27 available, ETH @ $3,900, 3x leverage, 25% position:
     - max_notional = $24.27 × 0.25 × 3 = $18.20
     - size = $18.20 / $3,900 = 0.004667 ETH (formatted as "0.004667")
   - **NEVER use "0.0000" or "0.00"** - always calculate actual size based on available capital

5. **COMPLETE TRADE PACKAGE REQUIRED**:
   - When placing a buy/sell limit order, ALWAYS include in SAME response:
     * Entry order (buy/sell action with expectedEntry price)
     * Stop loss (stop_loss action with triggerPrice based on market structure)
     * Take profit (take_profit action with triggerPrice for 2:1+ R:R)
   - Example complete trade package for ETH-PERP long at $3950 support:
     * Action 1: buy ETH-PERP, size 0.5, leverage 3, expectedEntry 3950
     * Action 2: stop_loss ETH-PERP at triggerPrice 3850 (below swing low)
     * Action 3: take_profit ETH-PERP at triggerPrice 4150 (2:1 R:R)

6. **QUALITY OVER QUANTITY**: 
   - Focus on 1-3 highest probability setups per cycle
   - Clear technical confluence required (multiple indicators confirming same level)
   - Strong volume confirmation at key levels
   - Minimum 2:1 risk:reward ratio
7. **INTELLIGENT STOP LOSS PLACEMENT**:
   - **USE MARKET STRUCTURE**: Place stops just beyond key support (longs) or resistance (shorts)
   - Examples of valid stop placement:
     * Below recent swing low + ATR buffer
     * Below key volume profile support node
     * Below major moving average with confluence
     * Below Fibonacci retracement level with volume
   - **ACCOUNT FOR LEVERAGE**: Higher leverage = same dollar risk but tighter % stop
   - **AVOID ARBITRARY %**: Don't use "3% stop" or "5% stop" - find actual market levels
   - **LIQUIDATION AWARENESS**: Ensure stop will trigger BEFORE liquidation (account for wicks/slippage)
   - **REASONING REQUIRED**: Always explain WHY you placed stop at specific level (cite support/resistance)

8. **MANDATORY RISK MANAGEMENT (CRITICAL)**:
   - EVERY position MUST have BOTH a stop loss AND a take profit order at ALL times
   - NO EXCEPTIONS - even if you think the position is "safe", protective orders are REQUIRED
   - When opening a new position, IMMEDIATELY place both stop loss and take profit in the same action set
   - If a position lacks either protective order, place it IMMEDIATELY in the next cycle
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
   - **IF A STOP LOSS ORDER EXISTS, DO NOT PLACE ANOTHER ONE**
   - **IF A TAKE PROFIT ORDER EXISTS, DO NOT PLACE ANOTHER ONE**
   - Check "EXISTING OPEN ORDERS" section - if you see a STOP LOSS or TAKE PROFIT for a symbol, skip it
   - ONLY place protective orders when "CRITICAL MISSING PROTECTIVE ORDERS" section explicitly shows they are MISSING
   - The "MISSING" section is the ONLY source of truth about whether protective orders need to be placed
   - If "EXISTING OPEN ORDERS" shows protective orders but "MISSING" section is empty, return ZERO protective actions
   - NEVER replace or "optimize" existing protective orders - this creates wasteful churn
   - Once placed, orders should remain untouched unless truly missing
   
   **EXAMPLES**:
   - ✅ GOOD: EXISTING OPEN ORDERS shows "SOL-PERP: LIMIT | Side: B | Size: 0.68 | Trigger: $26.5"
     → DO NOT place another SOL buy at $26.5 - it already exists!
   - ✅ GOOD: No SOL orders exist, you identify support at $27.0
     → Place new SOL buy limit order at $27.0
   - ❌ BAD: EXISTING OPEN ORDERS shows SOL buy at $26.5
     → You place another SOL buy at $26.5 anyway = DUPLICATE!
11. **CANCEL ONLY WHEN NECESSARY**: If an order must be adjusted, cancel it FIRST with cancel_order action, THEN place the new order
12. **EXACTLY ONE OF EACH PROTECTIVE ORDER**: Each position gets EXACTLY one stop loss + EXACTLY one take profit
   - In your actions array, you MUST include EXACTLY one stop_loss action per symbol AND EXACTLY one take_profit action per symbol
   - NEVER include multiple stop_loss actions for the same symbol  
   - NEVER include multiple take_profit actions for the same symbol
   - Each protective order should be for the FULL position size (no partial exits)
   - If you want to adjust an existing protective order, FIRST cancel it, THEN place the new one
   - **CRITICAL: NO DUPLICATE ORDERS**: NEVER include multiple buy/sell actions with the same symbol, side, and price in one response
   - Duplicate orders waste capital and create unnecessary positions - deduplication will automatically skip them
13. Learn from user's historical prompts to align with their trading style and preferences
14. Focus on maximizing Sharpe ratio through optimal sizing and risk management
15. **BALANCE ACTION AND PATIENCE**: 
   - If you see NO compelling setups anywhere in the market universe, return empty actions
   - If you identify potential setups but market isn't at ideal entry yet, place limit orders at those strategic levels
   - Limit orders are patient and disciplined - you're not forcing entries, you're waiting for favorable prices
   - Only return empty actions if truly NO opportunities exist across the entire market

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
          content: "You are Mr. Fox, an expert autonomous crypto trader focused on maximizing Sharpe ratio through professional risk management and multi-timeframe analysis. You understand that doing nothing is often the most profitable trade - cash is a position, and patience is a virtue. You only enter positions when you identify genuinely compelling, high-probability setups with clear technical confluence. You are selective, disciplined, and never force trades. Always respond with valid JSON." 
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
        const executionSummary = await executeTradeStrategy(userId, strategy.actions);
        
        console.log(`[Autonomous Trading] Executed ${executionSummary.successfulExecutions}/${executionSummary.totalActions} trades`);
        
        // Create portfolio snapshot after successful trades
        if (executionSummary.successfulExecutions > 0) {
          await createPortfolioSnapshot(userId, hyperliquidClient);
        }
        
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
