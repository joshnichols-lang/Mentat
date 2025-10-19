import { type IStorage } from "./storage";
import { type HyperliquidClient } from "./hyperliquid/client";
import { type InsertPosition } from "@shared/schema";

/**
 * Position Reconciliation Service
 * 
 * Syncs database position records with actual exchange positions.
 * Critical for protective order validation to work correctly.
 */

interface ReconciliationResult {
  found: number;
  created: number;
  updated: number;
  errors: string[];
}

export async function reconcilePositions(
  userId: string,
  storage: IStorage,
  hyperliquid: HyperliquidClient
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    found: 0,
    created: 0,
    updated: 0,
    errors: []
  };

  try {
    console.log(`[Position Reconciliation] Starting reconciliation for user ${userId}...`);

    // Fetch actual positions from exchange
    const exchangePositions = await hyperliquid.getPositions();
    
    if (!exchangePositions || exchangePositions.length === 0) {
      console.log(`[Position Reconciliation] No positions on exchange`);
      return result;
    }

    console.log(`[Position Reconciliation] Found ${exchangePositions.length} positions on exchange`);
    
    // Fetch current database positions
    const dbPositions = await storage.getPositions(userId);
    const dbPositionsBySymbol = new Map(
      dbPositions.map(p => [p.symbol, p])
    );

    // Get active API key for this user
    const apiKeys = await storage.getApiKeys(userId);
    const hyperliquidKey = apiKeys.find(k => k.providerType === "exchange" && k.providerName === "hyperliquid" && k.isActive);
    const apiKeyId = hyperliquidKey?.id;

    // Process each exchange position
    for (const exchangePos of exchangePositions) {
      const symbol = exchangePos.coin;
      const dbPosition = dbPositionsBySymbol.get(symbol);
      
      // Determine side from szi: positive = long, negative = short
      const size = exchangePos.szi;
      const sizeNum = parseFloat(size);
      const side = sizeNum > 0 ? "long" : "short";
      const absSize = Math.abs(sizeNum).toString();
      
      // Calculate current price (entry price is a good proxy if we don't have markPx)
      const currentPrice = exchangePos.entryPx;
      
      // Calculate PnL percentage from unrealizedPnl and positionValue
      let pnlPercent = "0";
      if (exchangePos.positionValue && exchangePos.unrealizedPnl) {
        const posValueNum = parseFloat(exchangePos.positionValue);
        const pnlNum = parseFloat(exchangePos.unrealizedPnl);
        if (posValueNum !== 0) {
          pnlPercent = ((pnlNum / Math.abs(posValueNum)) * 100).toFixed(6);
        }
      }

      if (!dbPosition) {
        // Position exists on exchange but not in database - CREATE it
        console.log(`[Position Reconciliation] Creating missing position: ${symbol}`);
        
        try {
          const positionData: InsertPosition = {
            apiKeyId: apiKeyId || null,
            symbol: symbol,
            side: side,
            size: absSize,
            entryPrice: exchangePos.entryPx,
            currentPrice: currentPrice,
            leverage: exchangePos.leverage?.value || 1,
            pnl: exchangePos.unrealizedPnl || "0",
            pnlPercent: pnlPercent,
            // Leave protective orders as null - they'll be set when AI generates them
            initialStopLoss: null,
            currentStopLoss: null,
            currentTakeProfit: null,
            stopLossState: "initial",
            lastAdjustmentAt: null,
          };

          await storage.createPosition(userId, positionData);
          result.created++;
          console.log(`[Position Reconciliation] ✅ Created position ${symbol}: side=${side}, size=${absSize}, entry=${exchangePos.entryPx}`);
        } catch (error) {
          const errorMsg = `Failed to create position ${symbol}: ${error}`;
          console.error(`[Position Reconciliation] ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      } else {
        // Position exists in both places - UPDATE price/PnL
        result.found++;
        
        try {
          await storage.updatePosition(userId, dbPosition.id, {
            currentPrice: currentPrice,
            pnl: exchangePos.unrealizedPnl || "0",
            pnlPercent: pnlPercent,
            size: absSize,
          });
          result.updated++;
          console.log(`[Position Reconciliation] Updated position ${symbol}: pnl=${exchangePos.unrealizedPnl}`);
        } catch (error) {
          const errorMsg = `Failed to update position ${symbol}: ${error}`;
          console.error(`[Position Reconciliation] ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
    }

    // Check for positions in DB that no longer exist on exchange (already handled by position closing logic)
    
    console.log(`[Position Reconciliation] Complete: found=${result.found}, created=${result.created}, updated=${result.updated}, errors=${result.errors.length}`);
    
    return result;
  } catch (error) {
    const errorMsg = `Reconciliation failed: ${error}`;
    console.error(`[Position Reconciliation] ❌ ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }
}
