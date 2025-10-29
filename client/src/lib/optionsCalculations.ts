import { OptionsStrategy } from "@shared/schema";

/**
 * Calculate P&L for an options strategy at a given price point
 * @param strategy - The options strategy
 * @param price - The price point at which to calculate P&L
 * @param currentPrice - The current underlying price (for calculating offsets)
 * @returns The profit/loss at the given price
 */
export function calculateStrategyPnL(
  strategy: Partial<OptionsStrategy>,
  price: number,
  currentPrice: number
): number {
  const strike = parseFloat(strategy.strike || "0");
  const totalCost = parseFloat(strategy.totalCost || "0");
  const maxProfit = strategy.maxProfit ? parseFloat(strategy.maxProfit) : null;
  const maxLoss = strategy.maxLoss ? parseFloat(strategy.maxLoss) : null;
  
  // Calculate strike offsets (5% of current price for OTM positions)
  const strikeOffset = currentPrice * 0.05;

  let pnl = 0;

  switch (strategy.type) {
    // Simple Long Positions
    case "long-call":
      pnl = Math.max(0, price - strike) - totalCost;
      break;

    case "long-put":
      pnl = Math.max(0, strike - price) - totalCost;
      break;

    // Strap and Strip (Asymmetric Straddles)
    case "strap":
      // 2 calls + 1 put - more bullish bias
      pnl = Math.max(
        2 * Math.max(0, price - strike),  // 2 calls
        Math.max(0, strike - price)        // 1 put
      ) - totalCost;
      break;

    case "strip":
      // 1 call + 2 puts - more bearish bias
      pnl = Math.max(
        Math.max(0, price - strike),       // 1 call
        2 * Math.max(0, strike - price)    // 2 puts
      ) - totalCost;
      break;

    // Straddles and Strangles (Long Volatility)
    case "long-straddle":
    case "straddle":
      // Buy call + put at same strike
      pnl = Math.max(price - strike, strike - price) - totalCost;
      break;

    case "long-strangle":
      // Buy OTM call + OTM put
      const strangleUpperStrike = strike + strikeOffset;
      const stranglelowerStrike = strike - strikeOffset;
      pnl = Math.max(
        Math.max(0, price - strangleUpperStrike),
        Math.max(0, stranglelowerStrike - price)
      ) - totalCost;
      break;

    // Short Straddles and Strangles (Short Volatility)
    case "short-straddle":
      // Sell call + put at same strike - profit from low volatility
      const shortStraddleCredit = maxProfit || 0;
      pnl = shortStraddleCredit - Math.max(Math.abs(price - strike), 0);
      break;

    case "short-strangle":
      // Sell OTM call + OTM put - profit if price stays in range
      const shortStrangleCredit = maxProfit || 0;
      const shortStrangleUpper = strike + strikeOffset;
      const shortStrangleLower = strike - strikeOffset;
      const shortStrangleLoss = Math.max(
        Math.max(0, price - shortStrangleUpper),
        Math.max(0, shortStrangleLower - price)
      );
      pnl = shortStrangleCredit - shortStrangleLoss;
      break;

    // Bull Spreads
    case "bull-call-spread":
      // Buy lower call, sell higher call
      const bullCallUpper = strike + strikeOffset;
      const bullCallPayout = Math.max(0, Math.min(price - strike, bullCallUpper - strike));
      pnl = bullCallPayout - totalCost;
      break;

    case "bull-put-spread":
      // Sell higher put, buy lower put - credit spread
      const bullPutCredit = maxProfit || 0;
      const bullPutLower = strike - strikeOffset;
      const bullPutLoss = Math.max(0, Math.min(strike - price, strike - bullPutLower));
      pnl = bullPutCredit - bullPutLoss;
      break;

    // Bear Spreads
    case "bear-put-spread":
      // Buy higher put, sell lower put
      const bearPutLower = strike - strikeOffset;
      const bearPutPayout = Math.max(0, Math.min(strike - price, strike - bearPutLower));
      pnl = bearPutPayout - totalCost;
      break;

    case "bear-call-spread":
      // Sell lower call, buy higher call - credit spread
      const bearCallCredit = maxProfit || 0;
      const bearCallUpper = strike + strikeOffset;
      const bearCallLoss = Math.max(0, Math.min(price - strike, bearCallUpper - strike));
      pnl = bearCallCredit - bearCallLoss;
      break;

    // Butterflies and Condors (Range-Bound)
    // NOTE: maxProfit from OptionsStrategyBuilder already represents NET profit (after cost)
    case "butterfly":
      // Long butterfly: Buy 1 low call, sell 2 ATM calls, buy 1 high call
      // Strikes: strike-offset, strike, strike, strike+offset
      const butterflyWidth = strikeOffset;
      const butterflyLowerStrike = strike - butterflyWidth;
      const butterflyUpperStrike = strike + butterflyWidth;
      
      if (price <= butterflyLowerStrike) {
        // Below lower strike - all options expire worthless
        pnl = -totalCost;
      } else if (price <= strike) {
        // Between lower and middle - long call gains, short calls worthless
        pnl = (price - butterflyLowerStrike) - totalCost;
      } else if (price <= butterflyUpperStrike) {
        // Between middle and upper - long call gains, short calls lose
        pnl = (butterflyUpperStrike - price) - totalCost;
      } else {
        // Above upper strike - gains offset by losses
        pnl = -totalCost;
      }
      break;

    case "long-condor":
      // Long condor: 4 strikes with wider body than butterfly
      const condorInnerWidth = strikeOffset * 0.5;
      const condorOuterWidth = strikeOffset * 1.5;
      const condorLower1 = strike - condorOuterWidth;
      const condorLower2 = strike - condorInnerWidth;
      const condorUpper2 = strike + condorInnerWidth;
      const condorUpper1 = strike + condorOuterWidth;
      
      if (price <= condorLower1 || price >= condorUpper1) {
        // Outside all strikes
        pnl = -totalCost;
      } else if (price >= condorLower2 && price <= condorUpper2) {
        // Inside inner range - maximum profit (already net of cost)
        pnl = maxProfit || 0;
      } else if (price < condorLower2) {
        // Between lower strikes - interpolate from -cost to maxProfit
        const ratio = (price - condorLower1) / (condorLower2 - condorLower1);
        pnl = -totalCost + (ratio * ((maxProfit || 0) + totalCost));
      } else {
        // Between upper strikes - interpolate from maxProfit to -cost
        const ratio = (price - condorUpper2) / (condorUpper1 - condorUpper2);
        pnl = (maxProfit || 0) - (ratio * ((maxProfit || 0) + totalCost));
      }
      break;

    case "iron-condor":
      // Iron condor: OTM put spread + OTM call spread (credit spread)
      // 4 strikes: short puts/calls are innerWidth from strike, long puts/calls are outerWidth
      const ironCondorCredit = maxProfit || 0;
      const ironCondorInnerWidth = strikeOffset;
      const ironCondorSpreadWidth = strikeOffset * 0.5; // Width of each spread
      const ironCondorShortPut = strike - ironCondorInnerWidth;
      const ironCondorLongPut = ironCondorShortPut - ironCondorSpreadWidth;
      const ironCondorShortCall = strike + ironCondorInnerWidth;
      const ironCondorLongCall = ironCondorShortCall + ironCondorSpreadWidth;
      
      if (price >= ironCondorShortPut && price <= ironCondorShortCall) {
        // Price stays between short strikes - keep full credit
        pnl = ironCondorCredit;
      } else if (price < ironCondorShortPut) {
        // Price below short put - put spread loses
        if (price <= ironCondorLongPut) {
          // Below long put - max loss
          pnl = -(maxLoss || ironCondorSpreadWidth);
        } else {
          // Between long and short put - linear decline
          const putDistance = ironCondorShortPut - price;
          pnl = ironCondorCredit - putDistance;
        }
      } else {
        // Price above short call - call spread loses
        if (price >= ironCondorLongCall) {
          // Above long call - max loss
          pnl = -(maxLoss || ironCondorSpreadWidth);
        } else {
          // Between short and long call - linear decline
          const callDistance = price - ironCondorShortCall;
          pnl = ironCondorCredit - callDistance;
        }
      }
      break;

    case "iron-butterfly":
      // Iron butterfly: ATM straddle sell + OTM strangle buy (credit spread)
      // P&L declines linearly from credit at strike to -maxLoss at wings
      const ironButterflyCredit = maxProfit || 0;
      const ironButterflyWidth = strikeOffset;
      const distance = Math.abs(price - strike);
      
      if (distance <= ironButterflyWidth) {
        // Inside wings - linear decline from credit to -maxLoss
        // At strike (distance=0): pnl = credit
        // At wings (distance=width): pnl = -maxLoss
        pnl = ironButterflyCredit - distance;
      } else {
        // Beyond wings - capped at maximum loss
        pnl = -(maxLoss || ironButterflyWidth);
      }
      break;

    default:
      // Unknown strategy - no P&L
      pnl = 0;
      break;
  }

  return pnl;
}

/**
 * Calculate Net P&L and percentage return for a strategy at expected price
 */
export function calculateNetPnL(
  strategy: Partial<OptionsStrategy>,
  expectedPrice: number,
  currentPrice: number
): { pnl: number; percentage: number } {
  const pnl = calculateStrategyPnL(strategy, expectedPrice, currentPrice);
  const totalCost = parseFloat(strategy.totalCost || "0");
  const percentage = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  
  return { pnl, percentage };
}
