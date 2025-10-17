import { getUserHyperliquidClient } from "./hyperliquid/client";
import { storage } from "./storage";

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
  orderId?: number;
}

interface ExecutionResult {
  success: boolean;
  action: TradingAction;
  orderId?: string;
  executedPrice?: string;
  error?: string;
}

interface ExecutionSummary {
  totalActions: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedActions: number;
  results: ExecutionResult[];
}

// Helper function to validate and parse numeric inputs with explicit error messages
function validateNumericInput(value: any, fieldName: string): number {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required`);
  }
  
  // If string, parse to number
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || num <= 0) {
    throw new Error(`Invalid ${fieldName}: must be a positive number`);
  }
  
  return num;
}

function validateLeverage(leverage: number): number {
  const lev = validateNumericInput(leverage, "leverage");
  
  if (lev < 1 || lev > 50) {
    throw new Error(`Invalid leverage: must be between 1 and 50`);
  }
  
  return Math.floor(lev); // Ensure integer
}

export async function executeTradeStrategy(
  userId: string,
  actions: TradingAction[]
): Promise<ExecutionSummary> {
  const hyperliquid = await getUserHyperliquidClient(userId);
  const results: ExecutionResult[] = [];
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  // CRITICAL FIX: Group protective orders by symbol to prevent stop loss/take profit from canceling each other
  // We need to process protective orders for each symbol together
  const protectiveOrderGroups = new Map<string, TradingAction[]>();
  const nonProtectiveActions: TradingAction[] = [];

  // First pass: separate protective orders from other actions
  for (const action of actions) {
    // Normalize symbol
    if (!action.symbol.endsWith("-PERP") && !action.symbol.endsWith("-SPOT")) {
      action.symbol = `${action.symbol}-PERP`;
    }

    if (action.action === "stop_loss" || action.action === "take_profit") {
      if (!protectiveOrderGroups.has(action.symbol)) {
        protectiveOrderGroups.set(action.symbol, []);
      }
      protectiveOrderGroups.get(action.symbol)!.push(action);
    } else {
      nonProtectiveActions.push(action);
    }
  }

  // VALIDATION: Ensure at most ONE stop_loss and ONE take_profit per symbol
  for (const [symbol, protectiveActions] of Array.from(protectiveOrderGroups.entries())) {
    const stopLossCount = protectiveActions.filter((a: TradingAction) => a.action === "stop_loss").length;
    const takeProfitCount = protectiveActions.filter((a: TradingAction) => a.action === "take_profit").length;
    
    if (stopLossCount > 1) {
      throw new Error(`VALIDATION ERROR: Multiple stop_loss actions (${stopLossCount}) for ${symbol}. Only ONE stop_loss per symbol is allowed.`);
    }
    
    if (takeProfitCount > 1) {
      throw new Error(`VALIDATION ERROR: Multiple take_profit actions (${takeProfitCount}) for ${symbol}. Only ONE take_profit per symbol is allowed.`);
    }
  }

  // Process non-protective actions first
  for (const action of nonProtectiveActions) {
    try {
      console.log(`[Trade Executor] Processing action: ${action.action} ${action.symbol} ${action.side}`);
      console.log(`[Trade Executor] Final symbol: ${action.symbol}`);
      
      // Skip "hold" actions
      if (action.action === "hold") {
        skipCount++;
        results.push({
          success: true,
          action,
        });
        continue;
      }
      
      // Validate inputs for actions that will be executed
      if (action.action !== "cancel_order") {
        validateNumericInput(action.size, "size");
        validateLeverage(action.leverage);
      }

      // Handle "cancel_order" actions
      if (action.action === "cancel_order") {
        if (!action.orderId) {
          throw new Error("orderId is required for cancel_order action");
        }
        
        const cancelResult = await hyperliquid.cancelOrder({
          coin: action.symbol,
          oid: action.orderId,
        });
        
        results.push({
          success: cancelResult.success,
          action,
          error: cancelResult.error,
        });
        
        if (cancelResult.success) {
          successCount++;
          console.log(`[Trade Executor] Cancelled order ${action.orderId} for ${action.symbol}`);
        } else {
          failCount++;
          console.error(`[Trade Executor] Failed to cancel order ${action.orderId}:`, cancelResult.error);
        }
        continue;
      }

      // Handle "close" actions
      if (action.action === "close") {
        const closeResult = await executeClosePosition(hyperliquid, action);
        results.push(closeResult);
        if (closeResult.success) {
          successCount++;
        } else {
          failCount++;
        }
        continue;
      }

      // Handle "buy" and "sell" actions (opening new positions)
      const openResult = await executeOpenPosition(hyperliquid, action);
      results.push(openResult);
      
      if (openResult.success) {
        successCount++;
        
        // Log trade to database
        try {
          await storage.createTrade(userId, {
            symbol: action.symbol.replace("-PERP", ""),
            side: action.side,
            type: action.expectedEntry ? "limit" : "market",
            entryPrice: openResult.executedPrice || action.expectedEntry || "0",
            size: action.size,
            leverage: action.leverage,
            status: "open",
            pnl: "0",
          });
        } catch (dbError) {
          console.error("Failed to log trade to database:", dbError);
        }
      } else {
        failCount++;
      }
    } catch (error: any) {
      console.error(`Failed to execute action for ${action.symbol}:`, error);
      failCount++;
      results.push({
        success: false,
        action,
        error: error.message || "Unknown error",
      });
    }
  }

  // Now process protective orders grouped by symbol
  // This ensures both stop loss and take profit can coexist for the same position
  for (const [symbol, protectiveActions] of Array.from(protectiveOrderGroups.entries())) {
    try {
      console.log(`[Trade Executor] Processing ${protectiveActions.length} protective orders for ${symbol}`);
      
      // Cancel ALL existing protective orders for this symbol ONCE
      console.log(`[Trade Executor] Checking for existing protective orders for ${symbol}...`);
      const openOrders = await hyperliquid.getOpenOrders();
      console.log(`[Trade Executor] Total open orders found: ${openOrders?.length || 0}`);
      
      // Filter for reduceOnly orders on this symbol
      const existingOrders = openOrders.filter((order: any) => {
        const isSameSymbol = order.coin === symbol;
        const isProtectiveOrder = order.reduceOnly === true;
        return isSameSymbol && isProtectiveOrder;
      });

      console.log(`[Trade Executor] Found ${existingOrders.length} existing protective (reduceOnly) orders for ${symbol}`);

      // Cancel all existing protective orders ONCE
      let allCancellationsSucceeded = true;
      let cancellationError = "";
      
      for (const existingOrder of existingOrders) {
        console.log(`[Trade Executor] Auto-canceling existing protective order ${existingOrder.oid} for ${symbol}`);
        const cancelResult = await hyperliquid.cancelOrder({
          coin: symbol,
          oid: existingOrder.oid,
        });
        
        if (!cancelResult.success) {
          console.error(`[Trade Executor] Failed to auto-cancel order ${existingOrder.oid}:`, cancelResult.error);
          allCancellationsSucceeded = false;
          cancellationError = cancelResult.error || "Unknown cancellation error";
          break;
        } else {
          console.log(`[Trade Executor] Successfully cancelled order ${existingOrder.oid}`);
        }
      }

      // If cancellation failed, skip ALL protective orders for this symbol
      if (!allCancellationsSucceeded) {
        console.error(`[Trade Executor] Skipping all protective orders for ${symbol} - cancellation failed: ${cancellationError}`);
        for (const action of protectiveActions) {
          results.push({
            success: false,
            action,
            error: `Cannot place ${action.action}: failed to cancel existing protective order - ${cancellationError}`,
          });
          failCount++;
          skipCount++;
        }
        continue;
      }

      // Now place ALL new protective orders for this symbol (both stop loss and take profit)
      for (const action of protectiveActions) {
        console.log(`[Trade Executor] Placing ${action.action} for ${symbol} at trigger price ${action.triggerPrice}`);
        const triggerResult = await executeTriggerOrder(hyperliquid, action);
        results.push(triggerResult);
        if (triggerResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    } catch (error: any) {
      console.error(`Failed to process protective orders for ${symbol}:`, error);
      for (const action of protectiveActions) {
        failCount++;
        results.push({
          success: false,
          action,
          error: error.message || "Unknown error",
        });
      }
    }
  }

  return {
    totalActions: actions.length,
    successfulExecutions: successCount,
    failedExecutions: failCount,
    skippedActions: skipCount,
    results,
  };
}

async function executeOpenPosition(
  hyperliquid: any,
  action: TradingAction
): Promise<ExecutionResult> {
  try {
    const isBuy = action.side === "long";
    const size = validateNumericInput(action.size, "size");

    let orderParams: any;
    
    // Hyperliquid doesn't support pure market orders
    // All orders must use limit orders with IOC or GTC
    if (!action.expectedEntry) {
      // If no expected entry, we need current market price
      // For now, require expectedEntry to be provided by AI
      return {
        success: false,
        action,
        error: "expectedEntry price is required - Hyperliquid does not support pure market orders",
      };
    }
    
    // Use limit order with specified entry price
    const limitPrice = validateNumericInput(action.expectedEntry, "expectedEntry");
    
    orderParams = {
      coin: action.symbol,  // Use full symbol with -PERP suffix
      is_buy: isBuy,
      sz: size,
      limit_px: limitPrice,
      order_type: {
        limit: {
          tif: "Gtc", // Good-til-cancel for limit orders
        },
      },
      reduce_only: false,
    };

    const result = await hyperliquid.placeOrder(orderParams);

    if (!result.success) {
      console.error(`[Trade Executor] Order failed for ${action.symbol}:`, result.error);
      console.error(`[Trade Executor] Order params:`, JSON.stringify(orderParams, null, 2));
      return {
        success: false,
        action,
        error: result.error || "Order placement failed",
      };
    }

    // Extract executed price from result
    let executedPrice = limitPrice.toString();
    if (result.response?.status === "filled" && result.response?.filled?.avgPx) {
      executedPrice = result.response.filled.avgPx;
    }

    console.log(`[Trade Executor] Order succeeded for ${action.symbol}:`, result.response);
    
    return {
      success: true,
      action,
      executedPrice,
    };
  } catch (error: any) {
    return {
      success: false,
      action,
      error: error.message || "Unknown error during order execution",
    };
  }
}

async function executeClosePosition(
  hyperliquid: any,
  action: TradingAction
): Promise<ExecutionResult> {
  try {
    // Get current positions to find the position to close
    const positions = await hyperliquid.getPositions();
    
    // Find the position matching this symbol
    const position = positions.find((p: any) => p.coin === action.symbol);
    
    if (!position) {
      return {
        success: false,
        action,
        error: `No open position found for ${action.symbol}`,
      };
    }

    const positionSize = Math.abs(parseFloat(position.szi));
    const isLong = parseFloat(position.szi) > 0;
    
    // Close position by placing an opposing order
    // If long, we sell; if short, we buy
    const closeOrder = {
      coin: action.symbol,
      is_buy: !isLong,  // Opposite of current position
      sz: positionSize,
      limit_px: isLong ? 0.01 : 999999999,  // Market-like execution with extreme prices
      order_type: {
        limit: {
          tif: "Ioc", // Immediate-or-cancel for market-like execution
        },
      },
      reduce_only: true,
    };

    const result = await hyperliquid.placeOrder(closeOrder);

    if (!result.success) {
      return {
        success: false,
        action,
        error: result.error || "Failed to close position",
      };
    }

    console.log(`[Trade Executor] Closed position for ${action.symbol}`);
    
    return {
      success: true,
      action,
    };
  } catch (error: any) {
    return {
      success: false,
      action,
      error: error.message || "Unknown error during position close",
    };
  }
}

async function executeTriggerOrder(
  hyperliquid: any,
  action: TradingAction
): Promise<ExecutionResult> {
  try {
    // Validate trigger price
    const triggerPrice = validateNumericInput(action.triggerPrice, "triggerPrice");
    
    // Get current positions to determine position size
    const positions = await hyperliquid.getPositions();
    console.log(`[Trade Executor] Looking for position with symbol: ${action.symbol}`);
    console.log(`[Trade Executor] Available positions:`, positions.map((p: any) => ({ coin: p.coin, size: parseFloat(p.szi) })));
    
    const position = positions.find((p: any) => p.coin === action.symbol);
    
    if (!position) {
      return {
        success: false,
        action,
        error: `No position found for ${action.symbol}. Available positions: ${positions.map((p: any) => p.coin).join(', ')}`,
      };
    }

    const positionSize = Math.abs(parseFloat(position.szi));
    const isLong = parseFloat(position.szi) > 0;
    const liquidationPrice = position.liquidationPx ? parseFloat(position.liquidationPx) : null;
    const entryPrice = parseFloat(position.entryPx);
    
    // Get current market price from position data
    const currentPrice = parseFloat(position.markPx || position.entryPx);
    
    // CRITICAL SAFETY CHECK 1: Stop loss direction and liquidation proximity
    if (action.action === "stop_loss" && liquidationPrice) {
      // DIRECTION CHECK: Stop must be in correct direction relative to current price
      if (isLong && triggerPrice >= currentPrice * 0.998) {
        console.warn(`[Trade Executor] DIRECTION VIOLATION: Stop loss ${triggerPrice} is not below current price ${currentPrice} for long position`);
        return {
          success: false,
          action,
          error: `Stop loss must be below current price $${currentPrice.toFixed(2)} for long positions. Your stop: $${triggerPrice}`,
        };
      } else if (!isLong && triggerPrice <= currentPrice * 1.002) {
        console.warn(`[Trade Executor] DIRECTION VIOLATION: Stop loss ${triggerPrice} is not above current price ${currentPrice} for short position`);
        return {
          success: false,
          action,
          error: `Stop loss must be above current price $${currentPrice.toFixed(2)} for short positions. Your stop: $${triggerPrice}`,
        };
      }
      
      // LIQUIDATION PROXIMITY WARNING (not rejection - just warn if very close)
      const distanceToLiq = Math.abs(triggerPrice - liquidationPrice);
      const distancePercent = (distanceToLiq / liquidationPrice) * 100;
      
      if (distancePercent < 1.0) {
        console.warn(`[Trade Executor] ⚠️ WARNING: Stop loss ${triggerPrice} is very close to liquidation ${liquidationPrice} (${distancePercent.toFixed(2)}% buffer). Risk of liquidation before stop triggers!`);
        // Allow it but warn - AI may have valid market structure reasons
      } else {
        console.log(`[Trade Executor] Stop loss safety check PASSED: trigger=${triggerPrice}, liquidation=${liquidationPrice}, buffer=${distancePercent.toFixed(2)}%`);
      }
    }
    
    // LOG: Stop loss distance from current price (informational only)
    if (action.action === "stop_loss") {
      const distanceFromCurrent = Math.abs(currentPrice - triggerPrice);
      const percentageDistance = (distanceFromCurrent / currentPrice) * 100;
      console.log(`[Trade Executor] Stop loss distance from current: ${percentageDistance.toFixed(2)}% (trigger=${triggerPrice}, current=${currentPrice})`);
    }
    
    // CRITICAL SAFETY CHECK 3: Enforce 2:1 Risk:Reward ratio for take profits
    if (action.action === "take_profit") {
      // Get existing stop loss to calculate R:R
      const openOrders = await hyperliquid.getOpenOrders();
      const existingStopLoss = openOrders.find((order: any) => 
        order.coin === action.symbol && 
        order.orderType?.trigger?.tpsl === 'sl' && 
        order.reduceOnly
      );
      
      if (existingStopLoss) {
        const stopPrice = parseFloat(existingStopLoss.orderType?.trigger?.triggerPx || '0');
        const riskDistance = Math.abs(entryPrice - stopPrice);
        const rewardDistance = Math.abs(triggerPrice - entryPrice);
        const riskRewardRatio = rewardDistance / riskDistance;
        
        if (riskRewardRatio < 2.0) {
          console.warn(`[Trade Executor] R:R VIOLATION: Take profit R:R ratio ${riskRewardRatio.toFixed(2)}:1 is below minimum 2:1. Risk: $${riskDistance.toFixed(2)}, Reward: $${rewardDistance.toFixed(2)}`);
          const minTakeProfit = isLong 
            ? entryPrice + (riskDistance * 2)
            : entryPrice - (riskDistance * 2);
          return {
            success: false,
            action,
            error: `R:R VIOLATION: Take profit creates ${riskRewardRatio.toFixed(2)}:1 ratio (need min 2:1). Entry: ${entryPrice}, Stop: ${stopPrice}, Reward needed: $${(riskDistance * 2).toFixed(2)}. Minimum take profit: ${minTakeProfit.toFixed(2)}`,
          };
        }
        console.log(`[Trade Executor] R:R check PASSED: ${riskRewardRatio.toFixed(2)}:1 (entry=${entryPrice}, stop=${stopPrice}, tp=${triggerPrice})`);
      }
    }
    
    // For stop loss: if long position, trigger sells when price goes down
    // For take profit: if long position, trigger sells when price goes up
    // The order itself is always the opposite side of the position (to close it)
    
    // CRITICAL FIX: Use MARKET execution for stop losses (instant fills), LIMIT for take profits (better prices)
    const useMarketExecution = action.action === "stop_loss";
    
    const triggerOrder = {
      coin: action.symbol,
      is_buy: !isLong,  // Opposite of position to close it
      sz: positionSize,
      limit_px: triggerPrice,  // The trigger price
      order_type: {
        trigger: {
          triggerPx: triggerPrice.toString(),  // camelCase for SDK
          isMarket: useMarketExecution,  // TRUE for stop loss (market order), FALSE for take profit (limit order)
          tpsl: action.action === "stop_loss" ? "sl" : "tp",
        },
      },
      reduce_only: true,  // This ensures it only closes the position
    };

    console.log(`[Trade Executor] Trigger order params:`, JSON.stringify(triggerOrder, null, 2));
    const result = await hyperliquid.placeOrder(triggerOrder);

    if (!result.success) {
      return {
        success: false,
        action,
        error: result.error || "Failed to place trigger order",
      };
    }

    console.log(`[Trade Executor] Trigger order succeeded for ${action.symbol}:`, result.response);
    
    return {
      success: true,
      action,
    };
  } catch (error: any) {
    return {
      success: false,
      action,
      error: error.message || "Unknown error during trigger order execution",
    };
  }
}
