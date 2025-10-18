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
  orderResult: { success: boolean; executedPrice?: string; response?: any }
): Promise<string | null> {
  try {
    // Only create journal entries for buy/sell actions (not protective orders)
    if (action.action !== "buy" && action.action !== "sell") {
      return null;
    }

    // Build expectations object with detailed trade expectations
    const expectations: any = {
      entry: action.expectedEntry || "market",
      size: action.size,
    };

    if (action.stopLoss) {
      expectations.stopLoss = action.stopLoss;
    }
    if (action.takeProfit) {
      expectations.takeProfit = action.takeProfit;
    }
    if (action.expectedRoi) {
      expectations.expectedRoi = action.expectedRoi;
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
      stopLoss: action.stopLoss || null,
      takeProfit: action.takeProfit || null,
      activatedAt: status === "active" ? new Date() : null,
    };

    const entry = await storage.createTradeJournalEntry(userId, entryData);
    console.log(`[Journal] Created ${status} journal entry ${entry.id} for ${action.symbol} ${action.side}`);
    
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
  
  if (lev < 1 || lev > 50) {
    throw new Error(`Invalid leverage: must be between 1 and 50`);
  }
  
  return Math.floor(lev); // Ensure integer
}

interface PriceValidationResult {
  valid: boolean;
  reason?: string;
  deviation?: number;
  currentPrice?: number;
  submittedPrice?: number;
}

// Validate price reasonableness: rejects orders too far from current market price
async function validatePriceReasonableness(
  action: TradingAction,
  hyperliquidClient: any,
  isProtectiveOrder: boolean
): Promise<PriceValidationResult> {
  // Skip validation for hold/cancel/close actions
  if (action.action === "hold" || action.action === "cancel_order" || action.action === "close") {
    return { valid: true };
  }
  
  try {
    // Fetch current market data for the symbol
    const marketData = await hyperliquidClient.getMarketData([action.symbol]);
    
    if (!marketData || marketData.length === 0) {
      console.warn(`[Price Validator] Could not fetch market data for ${action.symbol}, allowing order through`);
      return { valid: true };
    }
    
    // Get current mid price (average of bid/ask)
    const assetData = marketData[0];
    const currentPrice = parseFloat(assetData.markPx); // Use mark price as reference
    
    if (!currentPrice || currentPrice <= 0) {
      console.warn(`[Price Validator] Invalid current price for ${action.symbol}, allowing order through`);
      return { valid: true };
    }
    
    // Get submitted price based on action type
    let submittedPrice: number;
    if (action.action === "buy" || action.action === "sell") {
      // Entry orders use expectedEntry
      if (!action.expectedEntry) {
        // Market order - skip validation
        return { valid: true };
      }
      submittedPrice = parseFloat(action.expectedEntry);
    } else if (action.action === "stop_loss" || action.action === "take_profit") {
      // Protective orders use triggerPrice
      if (!action.triggerPrice) {
        console.warn(`[Price Validator] Missing triggerPrice for ${action.action} on ${action.symbol}, rejecting`);
        return {
          valid: false,
          reason: `${action.action} order missing required triggerPrice`
        };
      }
      submittedPrice = parseFloat(action.triggerPrice);
    } else {
      // Unknown action type - allow through
      return { valid: true };
    }
    
    // Validate submitted price is a valid number
    if (isNaN(submittedPrice) || submittedPrice <= 0) {
      console.warn(`[Price Validator] Invalid price ${submittedPrice} for ${action.action} on ${action.symbol}, rejecting`);
      return {
        valid: false,
        reason: `Invalid price: ${submittedPrice}`
      };
    }
    
    // Calculate deviation from current price
    const deviation = Math.abs((submittedPrice - currentPrice) / currentPrice);
    
    // Determine threshold based on order type
    const threshold = isProtectiveOrder 
      ? PRICE_VALIDATION.PROTECTIVE_ORDER_MAX_DEVIATION 
      : PRICE_VALIDATION.ENTRY_ORDER_MAX_DEVIATION;
    
    // Check if deviation exceeds threshold
    if (deviation > threshold) {
      const deviationPct = (deviation * 100).toFixed(2);
      const thresholdPct = (threshold * 100).toFixed(0);
      const orderType = isProtectiveOrder ? "Protective" : "Entry";
      
      return {
        valid: false,
        reason: `${orderType} order price ${submittedPrice} is ${deviationPct}% from current market price ${currentPrice.toFixed(2)} (threshold: ±${thresholdPct}%)`,
        deviation,
        currentPrice,
        submittedPrice
      };
    }
    
    return {
      valid: true,
      deviation,
      currentPrice,
      submittedPrice
    };
    
  } catch (error: any) {
    console.warn(`[Price Validator] Error validating price for ${action.symbol}:`, error.message);
    return { valid: true }; // Allow order through if validation fails
  }
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
      const openResult = await executeOpenPosition(hyperliquid, action, userId);
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
      
      // Fetch metadata for price comparison
      const metadata = await hyperliquid.getAssetMetadata(symbol);
      if (!metadata) {
        console.warn(`[Trade Executor] Could not fetch metadata for ${symbol}, placing orders without comparison`);
      }
      
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
      
      const currentPrice = parseFloat(position.entryPx);
      const isLong = parseFloat(position.szi) > 0;
      const currentPnl = parseFloat(position.unrealizedPnl);
      
      if (existingProtectiveOrders.length === 2 && protectiveActions.length === 2 && metadata) {
        // We have exactly 2 existing and 2 new - check if they match
        const newStopLoss = protectiveActions.find(a => a.action === "stop_loss");
        const newTakeProfit = protectiveActions.find(a => a.action === "take_profit");
        
        // CRITICAL FIX: Hyperliquid API doesn't return tpsl field, so we must identify SL/TP by price
        // For LONG positions: Stop Loss < current price, Take Profit > current price
        // For SHORT positions: Stop Loss > current price, Take Profit < current price
        const [existingOrder1, existingOrder2] = existingProtectiveOrders;
        const price1 = parseFloat(existingOrder1.limitPx);
        const price2 = parseFloat(existingOrder2.limitPx);
        
        let existingSL, existingTP;
        if (isLong) {
          existingSL = price1 < currentPrice ? existingOrder1 : existingOrder2;
          existingTP = price1 > currentPrice ? existingOrder1 : existingOrder2;
        } else {
          existingSL = price1 > currentPrice ? existingOrder1 : existingOrder2;
          existingTP = price1 < currentPrice ? existingOrder1 : existingOrder2;
        }
        
        if (newStopLoss && newTakeProfit && existingSL && existingTP) {
          // Compare prices (allow 1% tolerance to prevent minor adjustments)
          const newSLPrice = parseFloat(newStopLoss.triggerPrice!);
          const existingSLPrice = parseFloat(existingSL.limitPx);
          const slPriceChange = Math.abs((newSLPrice - existingSLPrice) / existingSLPrice);
          
          const newTPPrice = parseFloat(newTakeProfit.triggerPrice!);
          const existingTPPrice = parseFloat(existingTP.limitPx);
          const tpPriceChange = Math.abs((newTPPrice - existingTPPrice) / existingTPPrice);
          
          // Only replace if either changed by more than 1%
          if (slPriceChange < 0.01 && tpPriceChange < 0.01) {
            console.log(`[Trade Executor] ✓ Protective orders for ${symbol} are up-to-date (SL: ${existingSLPrice}, TP: ${existingTPPrice}). Skipping replacement.`);
            skipCount += 2;
            for (const action of protectiveActions) {
              results.push({
                success: true,
                action,
                error: "Protective order already exists with same price - skipped to prevent churn",
              });
            }
            continue; // Skip to next symbol
          } else {
            // SERVER-SIDE VALIDATION: Check if protective order adjustment is allowed
            console.log(`[Trade Executor] Validating protective order adjustment for ${symbol}...`);
            const validationResult = await storage.updateProtectiveOrders(
              userId,
              symbol,
              slPriceChange >= 0.01 ? newSLPrice.toString() : null,
              tpPriceChange >= 0.01 ? newTPPrice.toString() : null,
              newStopLoss.reasoning || "AI-generated protective order adjustment",
              currentPnl.toString(),
              currentPrice.toString()
            );
            
            if (!validationResult.success) {
              // Validation failed - reject the adjustment
              console.error(`[Trade Executor] ❌ Protective order adjustment REJECTED: ${validationResult.error}`);
              skipCount += 2;
              for (const action of protectiveActions) {
                results.push({
                  success: false,
                  action,
                  error: `Server validation rejected: ${validationResult.error}`,
                });
              }
              continue; // Skip to next symbol
            } else {
              shouldReplaceOrders = true;
              console.log(`[Trade Executor] ✅ Validation passed - SL changed ${(slPriceChange * 100).toFixed(2)}%, TP changed ${(tpPriceChange * 100).toFixed(2)}%`);
            }
          }
        } else {
          // Missing SL or TP, need to set initial protective orders
          shouldReplaceOrders = true;
          console.log(`[Trade Executor] Could not identify existing SL/TP by price comparison, will set initial protective orders`);
          
          const newStopLoss = protectiveActions.find(a => a.action === "stop_loss");
          const newTakeProfit = protectiveActions.find(a => a.action === "take_profit");
          
          if (newStopLoss && newTakeProfit) {
            await storage.setInitialProtectiveOrders(
              userId,
              symbol,
              newStopLoss.triggerPrice!,
              newTakeProfit.triggerPrice!,
              newStopLoss.reasoning || "Initial protective orders set by AI"
            );
            console.log(`[Trade Executor] Set initial protective orders for ${symbol}`);
          }
        }
      } else {
        // Not exactly 2 existing and 2 new, or no metadata - replace to ensure correct state
        shouldReplaceOrders = true;
        console.log(`[Trade Executor] Protective order count mismatch (existing: ${existingProtectiveOrders.length}, new: ${protectiveActions.length}), will replace`);
        
        // Set initial protective orders if they don't exist yet
        if (existingProtectiveOrders.length === 0) {
          const newStopLoss = protectiveActions.find(a => a.action === "stop_loss");
          const newTakeProfit = protectiveActions.find(a => a.action === "take_profit");
          
          if (newStopLoss && newTakeProfit) {
            await storage.setInitialProtectiveOrders(
              userId,
              symbol,
              newStopLoss.triggerPrice!,
              newTakeProfit.triggerPrice!,
              newStopLoss.reasoning || "Initial protective orders set by AI"
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
  action: TradingAction,
  userId: string
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
    
    console.log(`[Trade Executor] Setting leverage to ${actualLeverage}x for ${action.symbol}...`);
    const leverageResult = await hyperliquid.updateLeverage({
      coin: action.symbol,
      is_cross: true, // Use cross margin (isolated margin not supported by default)
      leverage: actualLeverage
    });
    
    if (!leverageResult.success) {
      console.error(`[Trade Executor] Failed to set leverage for ${action.symbol}:`, leverageResult.error);
      return {
        success: false,
        action,
        error: `Failed to set leverage to ${actualLeverage}x: ${leverageResult.error}`,
      };
    }
    console.log(`[Trade Executor] Successfully set leverage to ${actualLeverage}x for ${action.symbol}`);

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
    
    // Create journal entry for the trade
    const journalEntryId = await createJournalEntry(userId, action, {
      success: true,
      executedPrice,
      response: result.response
    });
    
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
  action: TradingAction
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
    
    // Validate minimum notional value ($10 USD minimum)
    validateMinimumNotional(positionSize, triggerPrice, action.symbol);
    
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
