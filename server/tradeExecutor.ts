import { getUserHyperliquidClient } from "./hyperliquid/client";
import { storage } from "./storage";
import { PRICE_VALIDATION, ORDER_VALIDATION } from "./constants";

// Utility function to round price to tick size
function roundToTickSize(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

// Utility function to round size to size decimals
function roundToSizeDecimals(size: number, szDecimals: number): number {
  const multiplier = Math.pow(10, szDecimals);
  return Math.round(size * multiplier) / multiplier;
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
  triggerPrice?: string;
  orderId?: number;
}

interface ExecutionResult {
  success: boolean;
  action: TradingAction;
  orderId?: string;
  executedPrice?: string;
  journalEntryId?: string;
  error?: string;
}

interface ExecutionSummary {
  totalActions: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedActions: number;
  results: ExecutionResult[];
}

// Helper function to create journal entry for a trade
async function createJournalEntry(
  userId: string,
  action: TradingAction,
  orderResult: { success: boolean; executedPrice?: string; response?: any },
  protectiveActions?: TradingAction[] // Optional protective orders to extract stop loss/take profit
): Promise<string | null> {
  try {
    // Only create journal entries for buy/sell actions (not protective orders)
    if (action.action !== "buy" && action.action !== "sell") {
      return null;
    }

    // Extract stop loss and take profit from protective actions if provided
    let stopLossPrice: string | null = action.stopLoss || null;
    let takeProfitPrice: string | null = action.takeProfit || null;
    
    if (protectiveActions && protectiveActions.length > 0) {
      const stopLossAction = protectiveActions.find(a => a.action === "stop_loss");
      const takeProfitAction = protectiveActions.find(a => a.action === "take_profit");
      
      if (stopLossAction?.triggerPrice) {
        stopLossPrice = stopLossAction.triggerPrice;
      }
      if (takeProfitAction?.triggerPrice) {
        takeProfitPrice = takeProfitAction.triggerPrice;
      }
    }

    // Build expectations object with detailed trade expectations
    const expectations: any = {
      entry: action.expectedEntry || "market",
      size: action.size,
    };

    if (stopLossPrice) {
      expectations.stopLoss = stopLossPrice;
    }
    if (takeProfitPrice) {
      expectations.takeProfit = takeProfitPrice;
    }
    if (action.expectedRoi) {
      expectations.expectedRoi = action.expectedRoi;
    }
    
    // Calculate risk:reward ratio if we have both stop loss and take profit
    if (stopLossPrice && takeProfitPrice && action.expectedEntry) {
      const entry = parseFloat(action.expectedEntry);
      const sl = parseFloat(stopLossPrice);
      const tp = parseFloat(takeProfitPrice);
      const isLong = action.side === "long";
      
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp - entry);
      
      if (risk > 0) {
        const rrRatio = (reward / risk).toFixed(2);
        expectations.riskRewardRatio = `1:${rrRatio}`;
      }
    }

    // Determine entry status based on order result
    let status: "planned" | "active" = "planned";
    let actualEntryPrice: string | undefined = undefined;

    // If order was filled immediately, mark as active
    if (orderResult.response?.status === "filled" && orderResult.executedPrice) {
      status = "active";
      actualEntryPrice = orderResult.executedPrice;
    }

    const entryData = {
      tradeId: null, // Will be updated later when position is tracked
      symbol: action.symbol,
      side: action.side,
      entryType: "limit" as const,
      status,
      entryReasoning: action.reasoning,
      expectations: JSON.stringify(expectations),
      exitCriteria: action.exitCriteria || null,
      expectedRoi: action.expectedRoi || null,
      plannedEntryPrice: action.expectedEntry || null,
      actualEntryPrice: actualEntryPrice || null,
      size: action.size,
      leverage: action.leverage || 1,
      stopLoss: stopLossPrice,
      takeProfit: takeProfitPrice,
      activatedAt: status === "active" ? new Date() : null,
    };

    const entry = await storage.createTradeJournalEntry(userId, entryData);
    console.log(`[Journal] Created ${status} journal entry ${entry.id} for ${action.symbol} ${action.side} (SL: ${stopLossPrice || "none"}, TP: ${takeProfitPrice || "none"})`);
    
    return entry.id;
  } catch (error: any) {
    console.error("[Journal] Failed to create journal entry:", error);
    // Don't fail the trade execution if journal creation fails
    return null;
  }
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

// Helper function to validate minimum order notional value
function validateMinimumNotional(size: number, price: number, symbol: string): void {
  const notionalValue = size * price;
  
  if (notionalValue < ORDER_VALIDATION.MIN_NOTIONAL_USD) {
    throw new Error(
      `Order rejected: Minimum notional value is $${ORDER_VALIDATION.MIN_NOTIONAL_USD} USD. ` +
      `Your order for ${symbol} has notional value of $${notionalValue.toFixed(2)} (${size} × $${price.toFixed(2)}). ` +
      `Please increase order size or choose a different asset.`
    );
  }
}

function validateLeverage(leverage: number): number {
  const lev = validateNumericInput(leverage, "leverage");
  
  if (lev < 1) {
    throw new Error(`Invalid leverage: must be at least 1x`);
  }
  
  // No upper limit - will be capped to exchange max per asset during execution
  return Math.floor(lev); // Ensure integer
}

interface PriceValidationResult {
  valid: boolean;
  reason?: string;
  deviation?: number;
  currentPrice?: number;
  submittedPrice?: number;
}

// Price validation DISABLED - AI has full autonomy to place orders at any price level
async function validatePriceReasonableness(
  action: TradingAction,
  hyperliquidClient: any,
  isProtectiveOrder: boolean
): Promise<PriceValidationResult> {
  // All orders are allowed - no price restrictions
  return { valid: true };
}

export async function executeTradeStrategy(
  userId: string,
  actions: TradingAction[]
): Promise<ExecutionSummary> {
  const hyperliquid = await getUserHyperliquidClient(userId);
  const results: ExecutionResult[] = [];
  
  // Fetch user's margin mode preference (default: isolated)
  const user = await storage.getUser(userId);
  const useIsolatedMargin = !user || user.marginMode !== "cross"; // Default to isolated if not set or if user explicitly chose isolated
  
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

  // VALIDATION: Ensure at most ONE stop_loss per symbol (take profits can be multiple)
  for (const [symbol, protectiveActions] of Array.from(protectiveOrderGroups.entries())) {
    const stopLossCount = protectiveActions.filter((a: TradingAction) => a.action === "stop_loss").length;
    const takeProfitCount = protectiveActions.filter((a: TradingAction) => a.action === "take_profit").length;
    
    // REMOVED BLOCKER: Don't reject multiple stop losses - let the selection logic handle it
    // The protective order processing logic will select the most conservative stop loss
    if (stopLossCount > 1) {
      console.log(`[Trade Executor] ${stopLossCount} stop loss orders for ${symbol} - selection logic will choose most conservative`);
    }
    
    // Allow multiple take profit orders for scaling out
    if (takeProfitCount > 0) {
      console.log(`[Trade Executor] ${takeProfitCount} take profit order(s) for ${symbol} - allowing multiple TPs for scaling out`);
    }
  }

  // PRICE REASONABLENESS VALIDATION: Reject orders too far from current market price
  // Validate non-protective actions first
  const priceValidatedActions: TradingAction[] = [];
  console.log(`[Price Validator] Validating ${nonProtectiveActions.length} entry orders against current market prices...`);
  
  for (const action of nonProtectiveActions) {
    const validation = await validatePriceReasonableness(action, hyperliquid, false);
    
    if (!validation.valid) {
      skipCount++;
      console.warn(`[Price Validator] ❌ REJECTED ${action.action} ${action.symbol} @ ${validation.submittedPrice}: ${validation.reason}`);
      results.push({
        success: false,
        action,
        error: `Price validation failed: ${validation.reason}`,
      });
    } else {
      if (validation.deviation !== undefined && action.expectedEntry) {
        const deviationPct = (validation.deviation * 100).toFixed(2);
        console.log(`[Price Validator] ✓ Accepted ${action.action} ${action.symbol} @ ${validation.submittedPrice} (${deviationPct}% from market ${validation.currentPrice?.toFixed(2)})`);
      }
      priceValidatedActions.push(action);
    }
  }
  
  console.log(`[Price Validator] Rejected ${nonProtectiveActions.length - priceValidatedActions.length} unrealistic entry orders`);

  // Validate protective orders
  const priceValidatedProtectiveGroups = new Map<string, TradingAction[]>();
  let totalProtectiveOrders = 0;
  for (const [symbol, protectiveActions] of Array.from(protectiveOrderGroups.entries())) {
    totalProtectiveOrders += protectiveActions.length;
  }
  
  if (totalProtectiveOrders > 0) {
    console.log(`[Price Validator] Validating ${totalProtectiveOrders} protective orders against current market prices...`);
  }
  
  for (const [symbol, protectiveActions] of Array.from(protectiveOrderGroups.entries())) {
    const validatedActions: TradingAction[] = [];
    
    for (const action of protectiveActions) {
      const validation = await validatePriceReasonableness(action, hyperliquid, true);
      
      if (!validation.valid) {
        skipCount++;
        console.warn(`[Price Validator] ❌ REJECTED protective ${action.action} ${action.symbol} @ ${validation.submittedPrice}: ${validation.reason}`);
        results.push({
          success: false,
          action,
          error: `Price validation failed: ${validation.reason}`,
        });
      } else {
        if (validation.deviation !== undefined && action.triggerPrice) {
          const deviationPct = (validation.deviation * 100).toFixed(2);
          console.log(`[Price Validator] ✓ Accepted protective ${action.action} ${action.symbol} @ ${validation.submittedPrice} (${deviationPct}% from market ${validation.currentPrice?.toFixed(2)})`);
        }
        validatedActions.push(action);
      }
    }
    
    if (validatedActions.length > 0) {
      priceValidatedProtectiveGroups.set(symbol, validatedActions);
    }
  }

  // CROSS-CYCLE DEDUPLICATION: Check against existing open orders on exchange
  // This prevents placing duplicate orders across monitoring cycles
  const existingOrders = await hyperliquid.getOpenOrders();
  console.log(`[Trade Executor] Checking ${priceValidatedActions.length} actions against ${existingOrders.length} existing orders`);
  
  // DEDUPLICATION: Remove duplicate buy/sell orders (same symbol, side, price, size)
  // Uses exchange tick size and size decimals to catch post-rounding duplicates
  const deduplicatedActions: TradingAction[] = [];
  const seenOrders = new Set<string>();
  
  for (const action of priceValidatedActions) {
    if (action.action === "buy" || action.action === "sell") {
      // Fetch asset metadata for proper tick size rounding
      const metadata = await hyperliquid.getAssetMetadata(action.symbol);
      
      if (!metadata) {
        // If metadata fetch fails, allow the order through (will fail later with clear error)
        console.warn(`[Trade Executor] Could not fetch metadata for ${action.symbol}, skipping deduplication check`);
        deduplicatedActions.push(action);
        continue;
      }
      
      // Normalize price and size using EXCHANGE rounding rules (same as execution)
      let normalizedPrice: string;
      if (action.expectedEntry) {
        const price = parseFloat(action.expectedEntry);
        const roundedPrice = roundToTickSize(price, metadata.tickSize);
        normalizedPrice = roundedPrice.toString();
      } else {
        normalizedPrice = 'market';
      }
      
      const size = parseFloat(action.size);
      const roundedSize = roundToSizeDecimals(size, metadata.szDecimals);
      const normalizedSize = roundedSize.toString();
      
      // Create unique key: symbol-side-roundedPrice-roundedSize
      const orderKey = `${action.symbol}-${action.side}-${normalizedPrice}-${normalizedSize}`;
      
      // Check against EXISTING orders on the exchange (cross-cycle deduplication)
      const isBuyOrder = action.side === "long";
      const matchingExistingOrder = existingOrders.find(order => {
        // Only check limit orders (not stop loss or take profit)
        if (order.reduceOnly || order.orderType?.trigger) return false;
        
        // Check if same symbol
        if (order.coin !== action.symbol) return false;
        
        // Check if same side (B = buy/long, A = sell/short)
        const orderIsBuy = order.side === "B";
        if (orderIsBuy !== isBuyOrder) return false;
        
        // Normalize existing order's price and size
        const existingPrice = parseFloat(order.limitPx);
        const existingRoundedPrice = roundToTickSize(existingPrice, metadata.tickSize);
        
        const existingSize = parseFloat(order.sz);
        const existingRoundedSize = roundToSizeDecimals(existingSize, metadata.szDecimals);
        
        // Check if price and size match
        const priceMatches = Math.abs(existingRoundedPrice - parseFloat(normalizedPrice)) < metadata.tickSize * 0.01;
        const sizeMatches = Math.abs(existingRoundedSize - parseFloat(normalizedSize)) < Math.pow(10, -metadata.szDecimals);
        
        return priceMatches && sizeMatches;
      });
      
      if (matchingExistingOrder) {
        console.warn(`[Trade Executor] EXISTING ORDER DETECTED: Skipping ${action.action} ${action.symbol} ${normalizedSize} @ ${normalizedPrice} - order ${matchingExistingOrder.oid} already exists on exchange`);
        skipCount++;
        results.push({
          success: true,
          action,
          error: `Duplicate order skipped - order ${matchingExistingOrder.oid} already exists on exchange`,
        });
        continue;
      }
      
      // Check within current batch (in-batch deduplication)
      if (seenOrders.has(orderKey)) {
        console.warn(`[Trade Executor] DUPLICATE DETECTED: Skipping duplicate ${action.action} order for ${action.symbol} ${action.side} ${normalizedSize} @ ${normalizedPrice}`);
        skipCount++;
        results.push({
          success: true,
          action,
          error: "Duplicate order skipped - identical order already exists in this batch",
        });
        continue;
      }
      
      seenOrders.add(orderKey);
    }
    
    deduplicatedActions.push(action);
  }

  console.log(`[Trade Executor] Deduplicated ${priceValidatedActions.length - deduplicatedActions.length} duplicate orders`);

  // Process deduplicated non-protective actions first
  for (const action of deduplicatedActions) {
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
        // Log the action details for debugging
        console.log(`[Trade Executor] Validating action: ${action.action} ${action.symbol}, size="${action.size}", leverage=${action.leverage}`);
        
        try {
          validateNumericInput(action.size, "size");
          validateLeverage(action.leverage);
        } catch (validationError: any) {
          console.error(`[Trade Executor] Validation failed for ${action.symbol}:`, validationError.message);
          console.error(`[Trade Executor] Full action:`, JSON.stringify(action, null, 2));
          throw validationError;
        }
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
      console.log(`[Trade Executor] ⚠️ DEBUG: Action before execution:`, JSON.stringify(action, null, 2));
      // Get protective actions for this symbol to include in journal entry
      const symbolProtectiveActions = priceValidatedProtectiveGroups.get(action.symbol) || [];
      const openResult = await executeOpenPosition(hyperliquid, action, userId, useIsolatedMargin, symbolProtectiveActions);
      results.push(openResult);
      
      if (openResult.success) {
        successCount++;
        
        // Log trade to database
        try {
          const trade = await storage.createTrade(userId, {
            symbol: action.symbol.replace("-PERP", ""),
            side: action.side,
            type: action.expectedEntry ? "limit" : "market",
            entryPrice: openResult.executedPrice || action.expectedEntry || "0",
            size: action.size,
            leverage: action.leverage,
            status: "open",
            pnl: "0",
          });
          
          // Link journal entry to the trade if journal entry was created
          if (openResult.journalEntryId && trade.id) {
            await storage.updateTradeJournalEntry(userId, openResult.journalEntryId, {
              tradeId: trade.id,
            });
            console.log(`[Journal] Linked journal entry ${openResult.journalEntryId} to trade ${trade.id}`);
          }
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
  for (const [symbol, protectiveActions] of Array.from(priceValidatedProtectiveGroups.entries())) {
    try {
      console.log(`[Trade Executor] Processing ${protectiveActions.length} protective orders for ${symbol}`);
      
      // Get current position to validate and calculate sizes
      const currentPositions = await hyperliquid.getPositions();
      const currentPosition = currentPositions.find((p: any) => p.coin === symbol);
      
      if (!currentPosition) {
        // No position exists, so no need for protective orders
        console.log(`[Trade Executor] No position found for ${symbol}, skipping protective orders`);
        skipCount += protectiveActions.length;
        for (const action of protectiveActions) {
          results.push({
            success: true,
            action,
            error: "No position exists - protective orders not needed",
          });
        }
        continue;
      }
      
      const positionSize = Math.abs(parseFloat(currentPosition.szi));
      const isLong = parseFloat(currentPosition.szi) > 0;
      const currentPrice = parseFloat((currentPosition as any).markPx || currentPosition.entryPx);
      
      // CRITICAL: Validate position size > 0 before attempting protective orders
      if (positionSize <= 0) {
        console.log(`[Trade Executor] Position size is zero or negative for ${symbol} (${positionSize}), skipping protective orders`);
        skipCount += protectiveActions.length;
        for (const action of protectiveActions) {
          results.push({
            success: true,
            action,
            error: "Position size is zero - protective orders not needed",
          });
        }
        continue;
      }
      
      // CRITICAL FIX 1: Select only ONE stop loss (most conservative - closest to current price)
      const stopLosses = protectiveActions.filter(a => a.action === "stop_loss");
      const takeProfits = protectiveActions.filter(a => a.action === "take_profit");
      
      let selectedStopLoss: TradingAction | null = null;
      if (stopLosses.length > 0) {
        // CRITICAL: Filter stops by direction BEFORE selecting most conservative
        // For LONG: stop must be BELOW current price
        // For SHORT: stop must be ABOVE current price
        const validStops = stopLosses.filter(sl => {
          const stopPrice = parseFloat(sl.triggerPrice!);
          return isLong ? stopPrice < currentPrice : stopPrice > currentPrice;
        });
        
        if (validStops.length === 0) {
          console.warn(`[Trade Executor] All ${stopLosses.length} stop losses are in wrong direction (current=${currentPrice}, isLong=${isLong}), skipping`);
          // Skip stop loss - don't place invalid orders
        } else if (validStops.length === 1) {
          selectedStopLoss = validStops[0];
          console.log(`[Trade Executor] Selected only valid stop loss at ${selectedStopLoss.triggerPrice}`);
        } else {
          console.log(`[Trade Executor] Multiple valid stops detected (${validStops.length} of ${stopLosses.length} total), selecting most conservative...`);
          
          // For LONG: most conservative = highest SL (closest to current price from below)
          // For SHORT: most conservative = lowest SL (closest to current price from above)
          selectedStopLoss = validStops.reduce((best, current) => {
            const bestPrice = parseFloat(best.triggerPrice!);
            const currentStopPrice = parseFloat(current.triggerPrice!);
            
            if (isLong) {
              // For long, higher stop loss (closer to current from below) is more conservative
              return currentStopPrice > bestPrice ? current : best;
            } else {
              // For short, lower stop loss (closer to current from above) is more conservative
              return currentStopPrice < bestPrice ? current : best;
            }
          });
          
          console.log(`[Trade Executor] Selected stop loss at ${selectedStopLoss.triggerPrice} (most conservative of ${validStops.length} valid options)`);
        }
      }
      
      // Fetch metadata EARLY for proper size rounding BEFORE comparison (prevents 0.0006 vs 0.00065 drift)
      const metadata = await hyperliquid.getAssetMetadata(symbol);
      if (!metadata) {
        console.error(`[Trade Executor] Failed to fetch metadata for ${symbol}, skipping protective orders`);
        skipCount += protectiveActions.length;
        for (const action of protectiveActions) {
          results.push({
            success: false,
            action,
            error: `Failed to fetch asset metadata for ${symbol}`,
          });
        }
        continue;
      }
      
      console.log(`[Trade Executor] Position: ${symbol} size=${positionSize.toFixed(metadata.szDecimals)}, asset szDecimals=${metadata.szDecimals}, tickSize=${metadata.tickSize}`);
      
      // CRITICAL FIX 2: Split take profit sizes proportionally to sum to position size
      // IMPORTANT: Round IMMEDIATELY using exchange precision to avoid comparison drift
      const scaledTakeProfits: Array<TradingAction & { calculatedSize: number }> = [];
      if (takeProfits.length > 0) {
        // Calculate proportional sizes that sum to position size
        const totalWeight = takeProfits.length; // Equal weight for now
        let remainingSize = positionSize;
        
        takeProfits.forEach((tp, index) => {
          let size: number;
          
          if (index === takeProfits.length - 1) {
            // Last TP gets remaining size (handles rounding residuals)
            size = roundToSizeDecimals(remainingSize, metadata.szDecimals);
          } else {
            // Split equally, round to exchange precision IMMEDIATELY
            const rawSize = positionSize / totalWeight;
            size = roundToSizeDecimals(rawSize, metadata.szDecimals);
            remainingSize -= size;
          }
          
          scaledTakeProfits.push({
            ...tp,
            calculatedSize: size,
          });
          
          console.log(`[Trade Executor] TP ${index+1}/${takeProfits.length} calculatedSize: ${size.toFixed(metadata.szDecimals)} (rounded immediately)`);
        });
        
        const totalSplit = scaledTakeProfits.reduce((sum, tp) => sum + tp.calculatedSize, 0);
        console.log(`[Trade Executor] Split ${takeProfits.length} take profits: total=${totalSplit.toFixed(metadata.szDecimals)}, position=${positionSize.toFixed(metadata.szDecimals)}`);
      }
      
      // Rebuild protective actions with only selected SL and scaled TPs
      const finalProtectiveActions = [];
      if (selectedStopLoss) {
        finalProtectiveActions.push(selectedStopLoss);
      }
      finalProtectiveActions.push(...scaledTakeProfits);
      
      // Cancel ALL existing protective orders for this symbol ONCE
      console.log(`[Trade Executor] Checking for existing protective orders for ${symbol}...`);
      const openOrders = await hyperliquid.getOpenOrders();
      console.log(`[Trade Executor] Total open orders found: ${openOrders?.length || 0}`);
      
      // Filter for reduceOnly orders on this symbol (protective orders)
      const existingProtectiveOrders = openOrders.filter((order: any) => {
        const isSameSymbol = order.coin === symbol;
        const isProtectiveOrder = order.reduceOnly === true;
        return isSameSymbol && isProtectiveOrder;
      });

      console.log(`[Trade Executor] Found ${existingProtectiveOrders.length} existing protective (reduceOnly) orders for ${symbol}`);
      
      // CRITICAL: If more than 2 protective orders exist, something is wrong - cancel ALL
      if (existingProtectiveOrders.length > 2) {
        console.warn(`[Trade Executor] WARNING: Found ${existingProtectiveOrders.length} protective orders for ${symbol} (expected max 2). Cleaning up duplicates...`);
      }
      
      // ANTI-CHURN: Check if new protective orders match existing ones
      // Only replace if prices have changed significantly (>1% move)
      let shouldReplaceOrders = false;
      
      // Get current position to validate protective order changes
      const positions = await hyperliquid.getPositions();
      const position = positions.find((p: any) => p.coin === symbol);
      
      if (!position) {
        // No position exists, so no need for protective orders
        shouldReplaceOrders = false;
        console.log(`[Trade Executor] No position found for ${symbol}, skipping protective orders`);
        skipCount += 2;
        for (const action of protectiveActions) {
          results.push({
            success: true,
            action,
            error: "No position exists - protective orders not needed",
          });
        }
        continue;
      }
      
      const entryPrice = parseFloat(position.entryPx);
      const positionIsLong = parseFloat(position.szi) > 0;
      const currentPnl = parseFloat(position.unrealizedPnl);
      
      // CRITICAL FIX 3: Improved order comparison to prevent unnecessary churn
      // Compare using the FINAL protective actions (after selection and scaling)
      if (existingProtectiveOrders.length === finalProtectiveActions.length && metadata) {
        // Deep comparison: check if prices AND sizes match (with tolerance for minor variations)
        let ordersMatch = true;
        let matchReason = "";
        
        // Define tolerance: 0.3% price difference OR 3 tick sizes, whichever is larger
        const priceTolerance = Math.max(currentPrice * 0.003, metadata.tickSize * 3);
        
        // Create list of existing orders with prices
        const existingOrders = existingProtectiveOrders.map((order: any) => ({
          price: roundToTickSize(parseFloat(order.limitPx), metadata.tickSize),
          size: roundToSizeDecimals(parseFloat(order.sz), metadata.szDecimals),
          type: parseFloat(order.limitPx) > entryPrice ? (positionIsLong ? 'tp' : 'sl') : (positionIsLong ? 'sl' : 'tp')
        }));
        
        // Check if all final protective actions exist in the exchange (with tolerance)
        for (const action of finalProtectiveActions) {
          const triggerPrice = parseFloat(action.triggerPrice!);
          const roundedPrice = roundToTickSize(triggerPrice, metadata.tickSize);
          
          // Get calculated size for this action
          const actionSize = (action as any).calculatedSize || positionSize;
          const roundedSize = roundToSizeDecimals(actionSize, metadata.szDecimals);
          
          // Find matching order within tolerance
          const matchingOrder = existingOrders.find(order => {
            const priceDiff = Math.abs(order.price - roundedPrice);
            const sizesMatch = order.size === roundedSize;
            const priceWithinTolerance = priceDiff <= priceTolerance;
            return sizesMatch && priceWithinTolerance;
          });
          
          if (!matchingOrder) {
            ordersMatch = false;
            matchReason = `${action.action} at ${roundedPrice} (size: ${roundedSize}) not found within ±${priceTolerance.toFixed(2)} tolerance`;
            break;
          }
        }
        
        if (ordersMatch) {
          console.log(`[Trade Executor] ✓ Protective orders for ${symbol} are up-to-date. Skipping replacement to prevent churn.`);
          skipCount += finalProtectiveActions.length;
          for (const action of finalProtectiveActions) {
            results.push({
              success: true,
              action,
              error: "Protective order already exists with same price and size - skipped to prevent churn",
            });
          }
          continue; // Skip to next symbol
        } else {
          console.log(`[Trade Executor] Protective orders need update: ${matchReason}`);
          
          // For stop loss changes, validate the adjustment
          const newStopLoss = selectedStopLoss;
          const existingSL = existingProtectiveOrders.find((order: any) => {
            const price = parseFloat(order.limitPx);
            return positionIsLong ? price < entryPrice : price > entryPrice;
          });
          
          if (newStopLoss && existingSL) {
            // SERVER-SIDE VALIDATION: Check if protective order adjustment is allowed
            const newSLPrice = parseFloat(newStopLoss.triggerPrice!);
            const existingSLPrice = parseFloat(existingSL.limitPx);
            
            console.log(`[Trade Executor] Validating protective order adjustment for ${symbol}...`);
            const validationResult = await storage.updateProtectiveOrders(
              userId,
              symbol,
              newSLPrice.toString(),
              null, // We'll update TP through the normal flow
              newStopLoss.reasoning || "AI-generated protective order adjustment",
              currentPnl.toString(),
              entryPrice.toString()
            );
            
            if (!validationResult.success) {
              // Validation failed - reject the adjustment
              console.error(`[Trade Executor] ❌ Protective order adjustment REJECTED: ${validationResult.error}`);
              skipCount += finalProtectiveActions.length;
              for (const action of finalProtectiveActions) {
                results.push({
                  success: false,
                  action,
                  error: `Server validation rejected: ${validationResult.error}`,
                });
              }
              continue; // Skip to next symbol
            } else {
              shouldReplaceOrders = true;
              console.log(`[Trade Executor] ✅ Validation passed - replacing protective orders`);
            }
          } else {
            shouldReplaceOrders = true;
          }
        }
      } else {
        // Order count mismatch or no metadata - replace to ensure correct state
        shouldReplaceOrders = true;
        console.log(`[Trade Executor] Protective order count mismatch (existing: ${existingProtectiveOrders.length}, new: ${finalProtectiveActions.length}), will replace`);
        
        // Set initial protective orders if they don't exist yet
        if (existingProtectiveOrders.length === 0 && selectedStopLoss) {
          const firstTP = scaledTakeProfits[0];
          
          if (firstTP) {
            await storage.setInitialProtectiveOrders(
              userId,
              symbol,
              selectedStopLoss.triggerPrice!,
              firstTP.triggerPrice!,
              selectedStopLoss.reasoning || "Initial protective orders set by AI"
            );
            console.log(`[Trade Executor] Set initial protective orders for ${symbol} (first time)`);
          }
        }
      }
      
      // Cancel all existing protective orders if we're replacing them
      if (shouldReplaceOrders) {
        let allCancellationsSucceeded = true;
        let cancellationError = "";
        
        for (const existingOrder of existingProtectiveOrders) {
          console.log(`[Trade Executor] Canceling existing protective order ${existingOrder.oid} for ${symbol}`);
          const cancelResult = await hyperliquid.cancelOrder({
            coin: symbol,
            oid: existingOrder.oid,
          });
          
          if (!cancelResult.success) {
            console.error(`[Trade Executor] Failed to cancel order ${existingOrder.oid}:`, cancelResult.error);
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
          for (const action of finalProtectiveActions) {
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

        // Now place ALL new protective orders for this symbol (both stop loss and scaled take profits)
        for (const action of finalProtectiveActions) {
          const actionSize = (action as any).calculatedSize; // Get the calculated size if it exists
          console.log(`[Trade Executor] Placing ${action.action} for ${symbol} at trigger price ${action.triggerPrice}${actionSize ? ` (size: ${actionSize.toFixed(4)})` : ''}`);
          const triggerResult = await executeTriggerOrder(hyperliquid, action, actionSize);
          results.push(triggerResult);
          if (triggerResult.success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      }
    } catch (error: any) {
      console.error(`Failed to process protective orders for ${symbol}:`, error);
      // Fall back to protectiveActions if finalProtectiveActions is not yet defined
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
  action: TradingAction,
  userId: string,
  useIsolatedMargin: boolean,
  protectiveActions?: TradingAction[] // Optional protective orders for this symbol
): Promise<ExecutionResult> {
  try {
    // Fetch asset metadata for tick size and size decimals
    const metadata = await hyperliquid.getAssetMetadata(action.symbol);
    if (!metadata) {
      console.error(`[Trade Executor] Failed to fetch metadata for ${action.symbol}`);
      return {
        success: false,
        action,
        error: `Failed to fetch asset metadata for ${action.symbol}`,
      };
    }
    
    const isBuy = action.side === "long";
    let size = validateNumericInput(action.size, "size");
    
    // Round size to proper decimals
    size = roundToSizeDecimals(size, metadata.szDecimals);
    console.log(`[Trade Executor] Rounded size from ${action.size} to ${size} (${metadata.szDecimals} decimals)`);

    // Set leverage for this asset BEFORE placing the order
    // Cap leverage to the maximum allowed for this asset
    const requestedLeverage = action.leverage;
    let actualLeverage = requestedLeverage;
    
    if (metadata.maxLeverage && requestedLeverage > metadata.maxLeverage) {
      actualLeverage = metadata.maxLeverage;
      console.warn(`[Trade Executor] ⚠️ Requested leverage ${requestedLeverage}x exceeds max ${metadata.maxLeverage}x for ${action.symbol}. Capping to ${actualLeverage}x.`);
    }
    
    console.log(`[Trade Executor] Setting leverage to ${actualLeverage}x for ${action.symbol} (${useIsolatedMargin ? 'isolated' : 'cross'} margin)...`);
    const leverageResult = await hyperliquid.updateLeverage({
      coin: action.symbol,
      is_cross: !useIsolatedMargin, // Use user's margin mode preference (default: isolated)
      leverage: actualLeverage
    });
    
    if (!leverageResult.success) {
      console.warn(`[Trade Executor] ⚠️ Failed to set leverage for ${action.symbol}: ${leverageResult.error}`);
      console.warn(`[Trade Executor] ⚠️ Continuing with trade execution using existing leverage setting...`);
      // DO NOT block trade execution - Hyperliquid API has known issues with leverage endpoint
      // The exchange will use the existing leverage setting for this asset
    } else {
      console.log(`[Trade Executor] ✓ Successfully set leverage to ${actualLeverage}x for ${action.symbol}`);
    }

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
    let limitPrice = validateNumericInput(action.expectedEntry, "expectedEntry");
    
    // Round price to tick size
    limitPrice = roundToTickSize(limitPrice, metadata.tickSize);
    console.log(`[Trade Executor] Rounded price from ${action.expectedEntry} to ${limitPrice} (tick size: ${metadata.tickSize})`);
    
    // Validate minimum notional value ($10 USD minimum)
    validateMinimumNotional(size, limitPrice, action.symbol);
    
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
    
    // Create journal entry for the trade, including protective order expectations
    const journalEntryId = await createJournalEntry(userId, action, {
      success: true,
      executedPrice,
      response: result.response
    }, protectiveActions);
    
    return {
      success: true,
      action,
      executedPrice,
      journalEntryId: journalEntryId || undefined,
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
  action: TradingAction,
  overrideSize?: number // Optional: Override position size for scaled take profits
): Promise<ExecutionResult> {
  try {
    // Fetch asset metadata for tick size
    const metadata = await hyperliquid.getAssetMetadata(action.symbol);
    if (!metadata) {
      console.error(`[Trade Executor] Failed to fetch metadata for ${action.symbol}`);
      return {
        success: false,
        action,
        error: `Failed to fetch asset metadata for ${action.symbol}`,
      };
    }
    
    // Validate trigger price
    let triggerPrice = validateNumericInput(action.triggerPrice, "triggerPrice");
    
    // Round trigger price to tick size
    triggerPrice = roundToTickSize(triggerPrice, metadata.tickSize);
    console.log(`[Trade Executor] Rounded trigger price from ${action.triggerPrice} to ${triggerPrice} (tick size: ${metadata.tickSize})`);
    
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

    // Use override size if provided (for scaled take profits), otherwise use full position size
    let orderSize = overrideSize !== undefined ? overrideSize : Math.abs(parseFloat(position.szi));
    
    // Round size to proper decimals
    orderSize = roundToSizeDecimals(orderSize, metadata.szDecimals);
    
    const isLong = parseFloat(position.szi) > 0;
    const liquidationPrice = position.liquidationPx ? parseFloat(position.liquidationPx) : null;
    const entryPrice = parseFloat(position.entryPx);
    
    // Get current market price from position data
    const currentPrice = parseFloat(position.markPx || position.entryPx);
    
    // CRITICAL SAFETY CHECK 1: Stop loss direction and liquidation proximity
    if (action.action === "stop_loss" && liquidationPrice) {
      // DIRECTION CHECK: Stop must be in correct direction relative to current price
      // AI has full autonomy - no hardcoded buffers, just verify direction
      if (isLong && triggerPrice >= currentPrice) {
        console.warn(`[Trade Executor] DIRECTION VIOLATION: Stop loss ${triggerPrice} is not below current price ${currentPrice} for long position`);
        return {
          success: false,
          action,
          error: `Stop loss must be below current price $${currentPrice.toFixed(2)} for long positions. Your stop: $${triggerPrice}`,
        };
      } else if (!isLong && triggerPrice <= currentPrice) {
        console.warn(`[Trade Executor] DIRECTION VIOLATION: Stop loss ${triggerPrice} is not above current price ${currentPrice} for short position`);
        return {
          success: false,
          action,
          error: `Stop loss must be above current price $${currentPrice.toFixed(2)} for short positions. Your stop: $${triggerPrice}`,
        };
      }
      
      // LOG: Liquidation proximity (informational only - no restrictions)
      const distanceToLiq = Math.abs(triggerPrice - liquidationPrice);
      const distancePercent = (distanceToLiq / liquidationPrice) * 100;
      console.log(`[Trade Executor] Stop loss to liquidation distance: ${distancePercent.toFixed(2)}% (trigger=${triggerPrice}, liquidation=${liquidationPrice})`);
      // No enforcement - AI has full autonomy to place stops based on market structure
    }
    
    // LOG: Stop loss distance from current price (informational only)
    if (action.action === "stop_loss") {
      const distanceFromCurrent = Math.abs(currentPrice - triggerPrice);
      const percentageDistance = (distanceFromCurrent / currentPrice) * 100;
      console.log(`[Trade Executor] Stop loss distance from current: ${percentageDistance.toFixed(2)}% (trigger=${triggerPrice}, current=${currentPrice})`);
    }
    
    // LOG: Risk:Reward ratio (informational only - no enforcement)
    if (action.action === "take_profit") {
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
        console.log(`[Trade Executor] Take profit R:R ratio: ${riskRewardRatio.toFixed(2)}:1 (entry=${entryPrice}, stop=${stopPrice}, tp=${triggerPrice})`);
        // No enforcement - AI decides R:R based on market structure and conviction
      }
    }
    
    // For stop loss: if long position, trigger sells when price goes down
    // For take profit: if long position, trigger sells when price goes up
    // The order itself is always the opposite side of the position (to close it)
    
    // CRITICAL FIX: Use MARKET execution for stop losses (instant fills), LIMIT for take profits (better prices)
    const useMarketExecution = action.action === "stop_loss";
    
    // Validate minimum notional value ($10 USD minimum)
    validateMinimumNotional(orderSize, triggerPrice, action.symbol);
    
    const triggerOrder = {
      coin: action.symbol,
      is_buy: !isLong,  // Opposite of position to close it
      sz: orderSize, // Use calculated size (supports scaled take profits)
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
