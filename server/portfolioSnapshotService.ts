import { storage } from "./storage";
import type { HyperliquidClient } from "./hyperliquid/client";
import { TEST_USER_ID } from "./constants";

interface SnapshotMetrics {
  totalValue: string;
  totalPnl: string;
  sharpeRatio: string;
  numTrades: number;
  numWins: number;
}

/**
 * Calculate Sharpe ratio from recent portfolio snapshots
 * Sharpe Ratio = (Average Return - Risk-Free Rate) / Standard Deviation of Returns
 * Simplified: We'll use average return / std dev (assuming risk-free rate ~0)
 */
function calculateSharpeRatio(snapshots: any[]): number {
  if (snapshots.length < 2) return 0;

  // Calculate returns between consecutive snapshots
  const returns: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prevValue = parseFloat(snapshots[i - 1].totalValue);
    const currValue = parseFloat(snapshots[i].totalValue);
    if (prevValue > 0) {
      const returnPct = (currValue - prevValue) / prevValue;
      returns.push(returnPct);
    }
  }

  if (returns.length === 0) return 0;

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Avoid division by zero
  if (stdDev === 0) return 0;

  // Sharpe ratio (annualized assumption: multiply by sqrt of periods per year)
  // For simplicity, we'll use the raw ratio
  const sharpeRatio = meanReturn / stdDev;

  return sharpeRatio;
}

/**
 * Create a portfolio snapshot by fetching current state and calculating metrics
 */
export async function createPortfolioSnapshot(hyperliquid: HyperliquidClient): Promise<void> {
  try {
    console.log("[Portfolio Snapshot] Creating new snapshot...");

    // Get user state from Hyperliquid
    const userState = await hyperliquid.getUserState();
    if (!userState) {
      console.log("[Portfolio Snapshot] No user state available, skipping snapshot");
      return;
    }

    // Get current positions
    const positions = await hyperliquid.getPositions();

    // Calculate total value (account value from user state)
    const totalValue = userState.marginSummary?.accountValue || "0";

    // Calculate total PnL from positions
    let totalPnl = 0;
    for (const position of positions) {
      const pnl = parseFloat(position.unrealizedPnl || "0");
      totalPnl += pnl;
    }

    // Get trade statistics from database
    const trades = await storage.getTrades();
    const closedTrades = trades.filter(t => t.status === 'closed');
    const numTrades = closedTrades.length;
    const numWins = closedTrades.filter(t => {
      const pnl = parseFloat(t.pnl || "0");
      return pnl > 0;
    }).length;

    // Calculate Sharpe ratio from recent snapshots INCLUDING current value
    const recentSnapshots = await storage.getPortfolioSnapshots(30); // Last 30 snapshots (newest-first)
    
    // Reverse to get oldest-first ordering for correct return calculation
    const oldestFirst = [...recentSnapshots].reverse();
    
    // Add current snapshot to the end (it's the newest) for accurate Sharpe calculation
    const snapshotsWithCurrent = [...oldestFirst, {
      totalValue,
      totalPnl: totalPnl.toFixed(8),
      timestamp: new Date(),
    }];
    
    const sharpeRatio = calculateSharpeRatio(snapshotsWithCurrent);

    // Create snapshot
    const snapshot = {
      userId: TEST_USER_ID,
      totalValue,
      totalPnl: totalPnl.toFixed(8),
      sharpeRatio: sharpeRatio.toFixed(6),
      numTrades,
      numWins,
    };

    await storage.createPortfolioSnapshot(snapshot);
    console.log("[Portfolio Snapshot] Created snapshot:", snapshot);

  } catch (error) {
    console.error("[Portfolio Snapshot] Error creating snapshot:", error);
  }
}

/**
 * Start periodic snapshot creation (every 5 minutes)
 */
export function startPeriodicSnapshots(hyperliquid: HyperliquidClient): void {
  // Create initial snapshot
  createPortfolioSnapshot(hyperliquid);

  // Create snapshot every 5 minutes
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  setInterval(() => {
    createPortfolioSnapshot(hyperliquid);
  }, INTERVAL_MS);

  console.log("[Portfolio Snapshot] Started periodic snapshot creation (every 5 minutes)");
}
