import { initHyperliquidClient } from "./hyperliquid/client";
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
  triggerPrice?: string; // For stop_loss and take_profit actions
  orderId?: number; // For cancel_order action
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

function validateNumericInput(value: string | number, fieldName: string): number {
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
  actions: TradingAction[]
): Promise<ExecutionSummary> {
  const hyperliquid = initHyperliquidClient();
  const results: ExecutionResult[] = [];
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const action of actions) {
    try {
      // Normalize symbol to ensure it has -PERP suffix
      console.log(`[Trade Executor] Processing action: ${action.action} ${action.symbol} ${action.side}`);
      if (!action.symbol.endsWith("-PERP") && !action.symbol.endsWith("-SPOT")) {
        console.log(`[Trade Executor] Normalizing symbol from "${action.symbol}" to "${action.symbol}-PERP"`);
        action.symbol = `${action.symbol}-PERP`;
      }
      console.log(`[Trade Executor] Final symbol: ${action.symbol}`);
      
      // Skip "hold" actions - they don't require execution or validation
      if (action.action === "hold") {
        skipCount++;
        results.push({
          success: true,
          action,
        });
        continue;
      }
      
      // Validate inputs for actions that will be executed
      // Note: stop_loss, take_profit, and cancel_order have special validation rules
      if (action.action !== "stop_loss" && action.action !== "take_profit" && action.action !== "cancel_order") {
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

      // Handle "stop_loss" and "take_profit" actions
      if (action.action === "stop_loss" || action.action === "take_profit") {
        const triggerResult = await executeTriggerOrder(hyperliquid, action);
        results.push(triggerResult);
        if (triggerResult.success) {
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
          await storage.createTrade({
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
    
    console.log(`[Trade Executor] Order succeeded for ${action.symbol}:`, result.response?.response?.data?.statuses?.[0])

    return {
      success: true,
      action,
      orderId: result.response?.response?.data?.statuses?.[0]?.resting?.oid?.toString(),
      executedPrice: action.expectedEntry || "market",
    };
  } catch (error: any) {
    return {
      success: false,
      action,
      error: error.message || "Failed to execute order",
    };
  }
}

async function executeTriggerOrder(
  hyperliquid: any,
  action: TradingAction
): Promise<ExecutionResult> {
  try {
    if (!action.triggerPrice) {
      return {
        success: false,
        action,
        error: "Trigger price is required for stop loss/take profit orders",
      };
    }

    // Get current position to determine size and direction
    const positions = await hyperliquid.getPositions();
    
    console.log(`[Trade Executor] Looking for position with symbol: ${action.symbol}`);
    console.log(`[Trade Executor] Available positions:`, positions.map((p: any) => ({ coin: p.coin, size: p.szi })));
    
    // Match directly by symbol (positions already include -PERP suffix)
    const position = positions.find((p: any) => p.coin === action.symbol);

    if (!position) {
      console.error(`[Trade Executor] No position found for ${action.symbol}. Available positions:`, positions.map((p: any) => p.coin));
      return {
        success: false,
        action,
        error: `No open position found for ${action.symbol}`,
      };
    }

    const positionSize = parseFloat(position.szi);
    
    if (Math.abs(positionSize) === 0) {
      return {
        success: false,
        action,
        error: `Position for ${action.symbol} has zero size`,
      };
    }

    const isLong = positionSize > 0;
    const absSize = Math.abs(positionSize);

    // Validate that the requested side matches the position direction
    if ((action.side === "long" && !isLong) || (action.side === "short" && isLong)) {
      return {
        success: false,
        action,
        error: `Cannot place ${action.action} for ${action.side} position: current position is ${isLong ? 'long' : 'short'}`,
      };
    }

    // Place trigger order (opposite side to close position)
    const triggerParams = {
      coin: action.symbol,
      is_buy: !isLong, // Opposite direction to close
      sz: absSize,
      trigger_px: action.triggerPrice,
      limit_px: action.triggerPrice, // Use trigger price as limit price for better fill certainty
      tpsl: action.action === "take_profit" ? "tp" as const : "sl" as const,
    };

    const result = await hyperliquid.placeTriggerOrder(triggerParams);

    if (!result.success) {
      console.error(`[Trade Executor] Trigger order failed for ${action.symbol}:`, result.error);
      console.error(`[Trade Executor] Trigger order params:`, JSON.stringify(triggerParams, null, 2));
      return {
        success: false,
        action,
        error: result.error || "Failed to place trigger order",
      };
    }

    console.log(`[Trade Executor] Trigger order succeeded for ${action.symbol}:`, result.response?.response?.data?.statuses?.[0])

    return {
      success: true,
      action,
      orderId: result.response?.response?.data?.statuses?.[0]?.resting?.oid?.toString(),
    };
  } catch (error: any) {
    return {
      success: false,
      action,
      error: error.message || "Failed to place trigger order",
    };
  }
}

async function executeClosePosition(
  hyperliquid: any,
  action: TradingAction
): Promise<ExecutionResult> {
  try {
    // Get current position to determine size and direction
    const positions = await hyperliquid.getPositions();
    
    console.log(`[Trade Executor] Looking for position with symbol: ${action.symbol}`);
    console.log(`[Trade Executor] Available positions:`, positions.map((p: any) => ({ coin: p.coin, size: p.szi })));
    
    // Match directly by symbol (positions already include -PERP suffix)
    const position = positions.find((p: any) => p.coin === action.symbol);

    if (!position) {
      console.error(`[Trade Executor] No position found for ${action.symbol}. Available positions:`, positions.map((p: any) => p.coin));
      return {
        success: false,
        action,
        error: `No open position found for ${action.symbol}`,
      };
    }

    const positionSize = parseFloat(position.szi);
    
    // Validate position exists and has size
    if (Math.abs(positionSize) === 0) {
      return {
        success: false,
        action,
        error: `Position for ${action.symbol} has zero size`,
      };
    }

    const isLong = positionSize > 0;
    const absSize = Math.abs(positionSize);

    // Validate that the requested side matches the position direction
    if ((action.side === "long" && !isLong) || (action.side === "short" && isLong)) {
      return {
        success: false,
        action,
        error: `Cannot close ${action.side} position: current position is ${isLong ? 'long' : 'short'}`,
      };
    }

    // Close by placing opposite order with reduce_only flag
    // Hyperliquid doesn't support pure market orders - use IOC limit order with extreme price
    // IMPORTANT: Use CURRENT market price, not entry price, to ensure fills even when position has moved significantly
    
    // Get current market price for the symbol
    const allMids = await hyperliquid.sdk.info.getAllMids();
    const currentPrice = parseFloat(allMids[action.symbol] || position.entryPx);
    
    if (!allMids[action.symbol]) {
      console.warn(`[Trade Executor] No current price found for ${action.symbol}, using entry price as fallback`);
    }
    
    // Calculate IOC limit price from CURRENT market price with cushion in favorable direction
    // For closing short (buy): use high price (10% above current) to guarantee fill
    // For closing long (sell): use low price (10% below current) to guarantee fill
    const rawMarketPrice = !isLong 
      ? currentPrice * 1.1  // Buying back short: 10% above current market
      : currentPrice * 0.9; // Selling long: 10% below current market
    
    // Round to whole number (0 decimals) to match Hyperliquid tick size
    // BTC and most major pairs use tick size of 1.0 (whole dollars)
    const marketPrice = Math.round(rawMarketPrice);
    
    const orderParams = {
      coin: action.symbol,  // Use full symbol with -PERP suffix
      is_buy: !isLong, // Opposite direction to close
      sz: absSize,
      limit_px: marketPrice, // Extreme price to guarantee immediate fill
      order_type: { limit: { tif: "Ioc" } }, // Immediate-or-cancel for market-like execution
      reduce_only: true,
    };

    const result = await hyperliquid.placeOrder(orderParams);

    if (!result.success) {
      console.error(`[Trade Executor] Close order failed for ${action.symbol}:`, result.error);
      console.error(`[Trade Executor] Close order params:`, JSON.stringify(orderParams, null, 2));
      return {
        success: false,
        action,
        error: result.error || "Failed to close position",
      };
    }

    console.log(`[Trade Executor] Close order succeeded for ${action.symbol}:`, result.response?.response?.data?.statuses?.[0])
    
    return {
      success: true,
      action,
      orderId: result.response?.response?.data?.statuses?.[0]?.resting?.oid?.toString(),
    };
  } catch (error: any) {
    return {
      success: false,
      action,
      error: error.message || "Failed to close position",
    };
  }
}
