import { initHyperliquidClient } from "./hyperliquid/client";
import { storage } from "./storage";

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
      // Validate inputs
      validateNumericInput(action.size, "size");
      validateLeverage(action.leverage);
      
      // Skip "hold" actions - they don't require execution
      if (action.action === "hold") {
        skipCount++;
        results.push({
          success: true,
          action,
        });
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
    
    // Use market order if no expected entry price is specified
    if (!action.expectedEntry) {
      orderParams = {
        coin: action.symbol.replace("-PERP", ""),
        is_buy: isBuy,
        sz: size,
        limit_px: 0, // Required but ignored for market orders
        order_type: { market: {} },
        reduce_only: false,
      };
    } else {
      // Use limit order with specified entry price
      const limitPrice = validateNumericInput(action.expectedEntry, "expectedEntry");
      
      orderParams = {
        coin: action.symbol.replace("-PERP", ""),
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
    }

    const result = await hyperliquid.placeOrder(orderParams);

    if (!result.success) {
      return {
        success: false,
        action,
        error: result.error || "Order placement failed",
      };
    }

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

async function executeClosePosition(
  hyperliquid: any,
  action: TradingAction
): Promise<ExecutionResult> {
  try {
    // Get current position to determine size and direction
    const positions = await hyperliquid.getPositions();
    const coin = action.symbol.replace("-PERP", "");
    const position = positions.find((p: any) => p.coin === coin);

    if (!position) {
      return {
        success: false,
        action,
        error: `No open position found for ${coin}`,
      };
    }

    const positionSize = parseFloat(position.szi);
    
    // Validate position exists and has size
    if (Math.abs(positionSize) === 0) {
      return {
        success: false,
        action,
        error: `Position for ${coin} has zero size`,
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

    // Close by placing opposite order with reduce_only flag and market order type
    const orderParams = {
      coin,
      is_buy: !isLong, // Opposite direction to close
      sz: absSize,
      limit_px: 0, // Required but ignored for market orders
      order_type: { market: {} },
      reduce_only: true,
    };

    const result = await hyperliquid.placeOrder(orderParams);

    if (!result.success) {
      return {
        success: false,
        action,
        error: result.error || "Failed to close position",
      };
    }

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
