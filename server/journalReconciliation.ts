import { type IStorage } from "./storage";
import { type HyperliquidClient } from "./hyperliquid/client";

/**
 * Journal Reconciliation Service
 * 
 * Automatically updates journal entry statuses based on exchange state:
 * - "planned" → "active" when limit orders fill
 * - "active" → "closed" when positions close
 */

interface JournalReconciliationResult {
  activated: number;
  closed: number;
  errors: string[];
}

export async function reconcileJournalEntries(
  userId: string,
  storage: IStorage,
  hyperliquid: HyperliquidClient
): Promise<JournalReconciliationResult> {
  const result: JournalReconciliationResult = {
    activated: 0,
    closed: 0,
    errors: []
  };

  try {
    console.log(`[Journal Reconciliation] Starting reconciliation for user ${userId}...`);

    // Get current positions from exchange
    const exchangePositions = await hyperliquid.getPositions();
    const exchangePositionsBySymbol = new Map(
      exchangePositions?.map(p => [p.coin, p]) || []
    );

    // Get open orders to check if planned entries' orders are still active
    const openOrders = await hyperliquid.getOpenOrders();
    const openOrderIds = new Set(openOrders?.map(o => String(o.oid)) || []);

    // Get "planned" journal entries (limit orders waiting to fill)
    const plannedEntries = await storage.getTradeJournalEntries(userId, { status: "planned" });
    
    for (const entry of plannedEntries) {
      // Check if this entry has an orderId
      if (entry.orderId) {
        // PRECISE MATCHING: Check if the specific order is still open
        const orderStillOpen = openOrderIds.has(entry.orderId);
        
        if (!orderStillOpen && exchangePositionsBySymbol.has(entry.symbol)) {
          // Order filled! Activate this specific entry
          const position = exchangePositionsBySymbol.get(entry.symbol)!;
          console.log(`[Journal Reconciliation] Activating ${entry.symbol} entry (orderId: ${entry.orderId}) - order filled at ${position.entryPx}`);
          await storage.activateTradeJournalEntry(userId, entry.id, position.entryPx);
          result.activated++;
        } else if (!orderStillOpen && !exchangePositionsBySymbol.has(entry.symbol)) {
          // FAST FILL-AND-CLOSE: Order filled and position already closed
          // This happens when an order fills and closes between reconciliation cycles
          console.log(`[Journal Reconciliation] Fast fill-and-close detected for ${entry.symbol} (orderId: ${entry.orderId})`);
          
          try {
            // Activate first (required before closing)
            const estimatedFillPrice = entry.plannedEntryPrice || "0";
            await storage.activateTradeJournalEntry(userId, entry.id, estimatedFillPrice);
            
            // Then immediately close with best-effort data
            await storage.closeTradeJournalEntry(userId, entry.id, {
              closePrice: estimatedFillPrice, // Approximation
              closePnl: "0", // Unknown without fill history
              closePnlPercent: "0",
              closeReasoning: "Position filled and closed between monitoring cycles (auto-detected)",
              hitTarget: 0, // Unknown
              hadAdjustments: 0,
            });
            result.activated++;
            result.closed++;
          } catch (error) {
            const errorMsg = `Failed to handle fast fill-and-close for ${entry.id}: ${error}`;
            console.error(`[Journal Reconciliation] ❌ ${errorMsg}`);
            result.errors.push(errorMsg);
          }
        }
      } else {
        // FALLBACK: No orderId, match by symbol only (less precise)
        if (exchangePositionsBySymbol.has(entry.symbol)) {
          const position = exchangePositionsBySymbol.get(entry.symbol)!;
          console.log(`[Journal Reconciliation] ⚠️  Activating ${entry.symbol} entry WITHOUT orderId - using symbol-only match at ${position.entryPx}`);
          await storage.activateTradeJournalEntry(userId, entry.id, position.entryPx);
          result.activated++;
        }
      }
    }

    // Get "active" journal entries (open positions)
    const activeEntries = await storage.getTradeJournalEntries(userId, { status: "active" });
    
    for (const entry of activeEntries) {
      // Check if position no longer exists (closed)
      if (!exchangePositionsBySymbol.has(entry.symbol)) {
        console.log(`[Journal Reconciliation] Closing ${entry.symbol} entry - position no longer exists`);
        
        // Try to get close info from fill history if available
        try {
          // Use last known entry price as close price approximation
          const closePrice = entry.actualEntryPrice || entry.plannedEntryPrice || "0";
          await storage.closeTradeJournalEntry(userId, entry.id, {
            closePrice,
            closePnl: "0", // We don't have exact PnL without fill data
            closePnlPercent: "0",
            closeReasoning: "Position closed (auto-detected)",
            hitTarget: 0, // Unknown
            hadAdjustments: 0,
          });
          result.closed++;
        } catch (error) {
          const errorMsg = `Failed to close journal entry ${entry.id}: ${error}`;
          console.error(`[Journal Reconciliation] ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
    }

    console.log(`[Journal Reconciliation] Complete: activated=${result.activated}, closed=${result.closed}, errors=${result.errors.length}`);
    
    return result;
  } catch (error) {
    const errorMsg = `Journal reconciliation failed: ${error}`;
    console.error(`[Journal Reconciliation] ❌ ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }
}
