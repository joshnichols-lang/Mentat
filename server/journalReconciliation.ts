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
    const exchangePositionSymbols = new Set(exchangePositions?.map(p => p.coin) || []);

    // Get "planned" journal entries (limit orders waiting to fill)
    const plannedEntries = await storage.getTradeJournalEntries(userId, { status: "planned" });
    
    for (const entry of plannedEntries) {
      // Check if position now exists for this entry (order filled)
      if (exchangePositionSymbols.has(entry.symbol)) {
        const position = exchangePositions?.find(p => p.coin === entry.symbol);
        if (position) {
          console.log(`[Journal Reconciliation] Activating ${entry.symbol} entry - order filled at ${position.entryPx}`);
          await storage.activateTradeJournalEntry(userId, entry.id, position.entryPx);
          result.activated++;
        }
      }
    }

    // Get "active" journal entries (open positions)
    const activeEntries = await storage.getTradeJournalEntries(userId, { status: "active" });
    
    for (const entry of activeEntries) {
      // Check if position no longer exists (closed)
      if (!exchangePositionSymbols.has(entry.symbol)) {
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
