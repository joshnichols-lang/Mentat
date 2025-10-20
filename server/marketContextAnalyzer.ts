import { getUserHyperliquidClient } from "./hyperliquid/client";

/**
 * Market Context Analyzer
 * 
 * Analyzes market conditions to determine if limit orders have realistic fill probability.
 * Prevents AI from placing orders far from current price structure and volatility.
 */

interface MarketContext {
  currentPrice: number;
  volatilityPercent: number; // Recent volatility as percentage
  atr: number; // Average True Range
  spread: number; // Bid-ask spread
  priceRange24h: { high: number; low: number }; // 24h high/low
}

interface FillProbabilityResult {
  isRealistic: boolean;
  fillProbability: number; // 0-1 score
  reason: string;
  suggestedPrice?: number; // Auto-corrected price if unrealistic
  context: MarketContext;
}

/**
 * Calculate Average True Range (ATR) from recent candles
 */
function calculateATR(candles: any[], period: number = 14): number {
  if (candles.length < period) {
    // Not enough data, fallback to simple range
    const prices = candles.map(c => parseFloat(c.c)); // closing prices
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    return (high - low) / period;
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = parseFloat(candles[i].h);
    const low = parseFloat(candles[i].l);
    const prevClose = parseFloat(candles[i - 1].c);

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Simple Moving Average of True Range
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
}

/**
 * Calculate realized volatility from recent price movements
 */
function calculateVolatility(candles: any[]): number {
  if (candles.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = parseFloat(candles[i - 1].c);
    const close = parseFloat(candles[i].c);
    const logReturn = Math.log(close / prevClose);
    returns.push(logReturn);
  }

  // Standard deviation of returns
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize and convert to percentage (assuming 1h candles, 24 periods per day)
  return stdDev * Math.sqrt(24 * 365) * 100;
}

/**
 * Get market context for a symbol
 * 
 * For now, uses simplified estimation based on current market data
 * TODO: Add candle data fetching from Hyperliquid SDK for more accurate ATR/volatility
 */
async function getMarketContext(
  userId: string,
  symbol: string,
  timeframe: string = "1h"
): Promise<MarketContext | null> {
  try {
    const hyperliquid = await getUserHyperliquidClient(userId);

    // Get current market data
    const allMarketData = await hyperliquid.getMarketData();
    
    if (!allMarketData || allMarketData.length === 0) {
      console.error(`[Market Context] No market data available`);
      return null;
    }
    
    // Find data for specific symbol
    const data = allMarketData.find(d => d.symbol === symbol);
    
    if (!data) {
      console.error(`[Market Context] No market data available for ${symbol}`);
      return null;
    }
    
    // CRITICAL: Sanitize all numeric inputs to prevent NaN propagation
    const rawPrice = parseFloat(data.price);
    const currentPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;
    
    if (!currentPrice) {
      console.error(`[Market Context] Invalid current price for ${symbol}: ${data.price}`);
      return null;
    }
    
    // Use 24h stats for volatility estimation
    // CRITICAL: Handle NaN from exchange (parseFloat("NaN") === NaN, not 0!)
    const rawDayChange = parseFloat(data.change24h || "0");
    const dayChange = Number.isFinite(rawDayChange) ? rawDayChange : 0;
    
    const rawVolume = parseFloat(data.volume24h || "0");
    const volume24h = Number.isFinite(rawVolume) ? rawVolume : 0;
    
    // Estimate volatility from 24h change (simplified)
    // Real volatility would be calculated from candle data
    // SAFETY: If dayChange is invalid, assume 5% default volatility
    const volatilityPercent = dayChange !== 0 ? Math.abs(dayChange) * 2 : 5;
    
    // Estimate ATR as percentage of current price
    // For crypto: typically 2-5% for major assets, higher for altcoins
    const atr = (currentPrice * Math.max(volatilityPercent, 2)) / 100;
    
    // Calculate 24h range from current price and day change
    const dayChangeAmount = currentPrice * (dayChange / 100);
    const high24h = dayChange > 0 ? currentPrice : currentPrice - dayChangeAmount;
    const low24h = dayChange > 0 ? currentPrice - dayChangeAmount : currentPrice;

    // Estimate spread from current price (typically 0.01-0.1% for liquid pairs)
    const spread = currentPrice * 0.0005; // 0.05% estimate
    
    // SAFETY: Validate all outputs
    const safeVolatility = Number.isFinite(volatilityPercent) && volatilityPercent > 0 
      ? Math.max(volatilityPercent, 1) 
      : 5; // Default 5% if invalid
    
    const safeATR = Number.isFinite(atr) && atr > 0 ? atr : currentPrice * 0.02; // Default 2% ATR

    return {
      currentPrice,
      volatilityPercent: safeVolatility,
      atr: safeATR,
      spread,
      priceRange24h: {
        high: Math.max(high24h, currentPrice),
        low: Math.min(low24h, currentPrice),
      },
    };
  } catch (error) {
    console.error(`[Market Context] Error fetching market data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Analyze fill probability for a limit order
 * 
 * @param userId - User ID
 * @param symbol - Trading symbol (e.g., "BTC-PERP")
 * @param limitPrice - Proposed limit price
 * @param side - "buy" or "sell"
 * @param timeframe - Strategy timeframe (e.g., "1h", "30m", "5m")
 * @returns Fill probability analysis
 */
export async function analyzeFillProbability(
  userId: string,
  symbol: string,
  limitPrice: number,
  side: "buy" | "sell",
  timeframe: string = "1h"
): Promise<FillProbabilityResult> {
  // SAFETY: Validate inputs to prevent NaN propagation
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
    return {
      isRealistic: false,
      fillProbability: 0,
      reason: `Invalid limit price: ${limitPrice}`,
      context: {
        currentPrice: 0,
        volatilityPercent: 0,
        atr: 0,
        spread: 0,
        priceRange24h: { high: 0, low: 0 },
      },
    };
  }
  
  const context = await getMarketContext(userId, symbol, timeframe);

  if (!context) {
    // FAIL-CLOSED: Cannot analyze without context, reject the order
    return {
      isRealistic: false,
      fillProbability: 0,
      reason: "Unable to fetch market data for fill probability analysis - order rejected for safety",
      context: {
        currentPrice: limitPrice,
        volatilityPercent: 0,
        atr: 0,
        spread: 0,
        priceRange24h: { high: limitPrice, low: limitPrice },
      },
    };
  }

  const { currentPrice, volatilityPercent, atr, priceRange24h } = context;

  // Calculate distance from current price
  const distanceFromCurrent = Math.abs(limitPrice - currentPrice);
  const distancePercent = (distanceFromCurrent / currentPrice) * 100;

  // CRITICAL FIX: Convert ATR to percentage to avoid unit mismatch
  // ATR is in price units, we need percentage for comparison
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
  const atrMultiple = atr > 0 ? distanceFromCurrent / atr : 0;

  // Determine if order is in correct direction for desired outcome
  const isCorrectDirection = side === "buy" ? limitPrice < currentPrice : limitPrice > currentPrice;

  // Check if price is within 24h range (higher probability)
  const within24hRange = limitPrice >= priceRange24h.low && limitPrice <= priceRange24h.high;

  // Calculate fill probability score (0-1)
  let fillProbability = 0;
  let isRealistic = true;
  let reason = "";
  let suggestedPrice: number | undefined;

  if (!isCorrectDirection) {
    // Limit buy above current or limit sell below current = will fill immediately (market order)
    fillProbability = 1.0;
    reason = "Order will fill immediately (limit price crosses current market price)";
  } else {
    // Order is in correct direction (buy below, sell above)

    // Base probability on distance from current price
    // Using STRICT volatility-adjusted thresholds (ALL IN PERCENTAGE)
    // CRITICAL: Reduced thresholds to prevent unrealistic limit orders
    const maxRealisticDistance = Math.min(
      Math.max(
        volatilityPercent * 1.5, // 1.5x daily volatility (reduced from 2x)
        atrPercent * 2, // 2x ATR as percentage (reduced from 3x)
        1.0 // Minimum 1.0% for very low volatility assets (increased from 0.5%)
      ),
      40.0 // HARD CAP: Allow up to 40% distance for user-requested limit orders (increased from 15%)
    );
    
    // CRITICAL: Validate maxRealisticDistance to prevent NaN comparisons
    if (!Number.isFinite(maxRealisticDistance) || maxRealisticDistance <= 0) {
      console.error(`[Market Context] Invalid maxRealisticDistance for ${symbol}: ${maxRealisticDistance}`);
      return {
        isRealistic: false,
        fillProbability: 0,
        reason: `Unable to calculate realistic distance - volatility data may be corrupted`,
        context,
      };
    }

    if (distancePercent > maxRealisticDistance) {
      // Order is too far from current price given volatility
      fillProbability = 0;
      isRealistic = false;
      reason = `Order is ${distancePercent.toFixed(2)}% from current price (${currentPrice.toFixed(2)}), exceeds realistic range based on ${volatilityPercent.toFixed(1)}% volatility. Max realistic distance: ${maxRealisticDistance.toFixed(2)}%`;
      
      // Suggest a more realistic price with safety guards
      const correctionFactor = maxRealisticDistance / 100;
      if (side === "buy") {
        suggestedPrice = currentPrice * (1 - correctionFactor);
      } else {
        suggestedPrice = currentPrice * (1 + correctionFactor);
      }
      
      // SAFETY: Ensure suggested price is positive and within 24h range
      if (suggestedPrice && suggestedPrice > 0) {
        // Clamp to 24h range for additional safety
        suggestedPrice = Math.max(priceRange24h.low, Math.min(priceRange24h.high, suggestedPrice));
      } else {
        // If calculation failed, fallback to 24h range boundary
        suggestedPrice = side === "buy" ? priceRange24h.low : priceRange24h.high;
      }
    } else if (within24hRange) {
      // Within 24h range = higher probability
      fillProbability = 0.8 - (distancePercent / maxRealisticDistance) * 0.5; // 0.8 to 0.3
      reason = `Order is within 24h range and ${distancePercent.toFixed(2)}% from current price. Realistic given ${volatilityPercent.toFixed(1)}% volatility.`;
    } else {
      // Outside 24h range but within volatility threshold
      fillProbability = 0.5 - (distancePercent / maxRealisticDistance) * 0.3; // 0.5 to 0.2
      reason = `Order is outside 24h range but within volatility threshold. ${distancePercent.toFixed(2)}% from current price.`;
    }

    // Apply ATR-based adjustment
    if (atrMultiple > 5) {
      fillProbability *= 0.5; // Reduce probability for orders >5 ATR away
      reason += ` Order is ${atrMultiple.toFixed(1)}x ATR away (low probability).`;
    }
  }

  return {
    isRealistic,
    fillProbability: Math.max(0, Math.min(1, fillProbability)),
    reason,
    suggestedPrice,
    context,
  };
}

/**
 * Validate and potentially auto-correct limit orders based on market context
 * 
 * @param userId - User ID
 * @param symbol - Trading symbol
 * @param limitPrice - Proposed limit price
 * @param side - "buy" or "sell"
 * @param timeframe - Strategy timeframe
 * @param autoCorrect - Whether to auto-correct unrealistic prices
 * @returns Validation result with potentially corrected price
 */
export async function validateLimitOrder(
  userId: string,
  symbol: string,
  limitPrice: number,
  side: "buy" | "sell",
  timeframe: string = "1h",
  autoCorrect: boolean = true
): Promise<{ isValid: boolean; price: number; reason: string }> {
  const analysis = await analyzeFillProbability(userId, symbol, limitPrice, side, timeframe);

  if (analysis.isRealistic) {
    return {
      isValid: true,
      price: limitPrice,
      reason: analysis.reason,
    };
  }

  if (autoCorrect && analysis.suggestedPrice) {
    console.warn(`[Market Context] Auto-correcting ${side} ${symbol} from ${limitPrice} to ${analysis.suggestedPrice.toFixed(2)}: ${analysis.reason}`);
    return {
      isValid: true,
      price: analysis.suggestedPrice,
      reason: `Auto-corrected from ${limitPrice.toFixed(2)}: ${analysis.reason}`,
    };
  }

  return {
    isValid: false,
    price: limitPrice,
    reason: analysis.reason,
  };
}
