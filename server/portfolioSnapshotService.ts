import { storage } from "./storage";
import type { HyperliquidClient } from "./hyperliquid/client";
import { TEST_USER_ID } from "./constants";

interface SnapshotMetrics {
  totalValue: string;
  totalPnl: string;
  sharpeRatio: string;
  calmarRatio: string;
  sortinoRatio: string;
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
 * Calculate Sortino ratio from recent portfolio snapshots
 * Sortino Ratio = (Average Return - Risk-Free Rate) / Downside Deviation
 * Only penalizes downside volatility (negative returns)
 */
function calculateSortinoRatio(snapshots: any[]): number {
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

  // Calculate downside deviation (only negative returns)
  const negativeReturns = returns.filter(r => r < 0);
  
  if (negativeReturns.length === 0) {
    // No downside volatility - return a high ratio (capped at 10)
    return meanReturn > 0 ? 10 : 0;
  }

  const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  // Avoid division by zero
  if (downsideDeviation === 0) return 0;

  const sortinoRatio = meanReturn / downsideDeviation;

  return sortinoRatio;
}

/**
 * Calculate Calmar ratio from recent portfolio snapshots
 * Calmar Ratio = Annualized Return (CAGR) / Maximum Drawdown
 * Higher is better - measures return per unit of worst-case loss
 */
function calculateCalmarRatio(snapshots: any[]): number {
  if (snapshots.length < 2) return 0;

  const values = snapshots.map(s => parseFloat(s.totalValue));
  
  // Calculate annualized return using CAGR
  const initialValue = values[0];
  const finalValue = values[values.length - 1];
  
  if (initialValue === 0 || initialValue === finalValue) return 0;
  
  // Get elapsed time from actual timestamps
  const startTime = new Date(snapshots[0].timestamp).getTime();
  const endTime = new Date(snapshots[snapshots.length - 1].timestamp).getTime();
  const elapsedDays = (endTime - startTime) / (1000 * 60 * 60 * 24);
  
  // Need at least 1 hour of data to calculate meaningful annualized returns
  if (elapsedDays < 1/24) {
    return 0;
  }
  
  // Calculate CAGR: (finalValue/initialValue)^(365.25/elapsedDays) - 1
  const yearFraction = 365.25 / elapsedDays;
  const valueRatio = finalValue / initialValue;
  const annualizedReturn = Math.pow(valueRatio, yearFraction) - 1;

  // Calculate maximum drawdown
  let maxDrawdown = 0;
  let peak = values[0];

  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Avoid division by zero
  if (maxDrawdown === 0) {
    // No drawdown - return a high ratio if positive returns (capped at 10)
    return annualizedReturn > 0 ? 10 : 0;
  }

  const calmarRatio = annualizedReturn / maxDrawdown;

  // Cap extreme values to prevent display issues
  return Math.max(-100, Math.min(100, calmarRatio));
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

    // Calculate risk ratios from recent snapshots INCLUDING current value
    // Use time-based query (6 hours) to ensure we have enough data for Calmar ratio (requires 1+ hour)
    const recentSnapshots = await storage.getPortfolioSnapshotsSince(6); // Last 6 hours
    
    // Add current snapshot to the end (it's the newest) for accurate ratio calculation
    const snapshotsWithCurrent = [...recentSnapshots, {
      totalValue,
      totalPnl: totalPnl.toFixed(8),
      timestamp: new Date(),
    }];
    
    const sharpeRatio = calculateSharpeRatio(snapshotsWithCurrent);
    const sortinoRatio = calculateSortinoRatio(snapshotsWithCurrent);
    const calmarRatio = calculateCalmarRatio(snapshotsWithCurrent);

    // Create snapshot
    const snapshot = {
      userId: TEST_USER_ID,
      totalValue,
      totalPnl: totalPnl.toFixed(8),
      sharpeRatio: sharpeRatio.toFixed(6),
      sortinoRatio: sortinoRatio.toFixed(6),
      calmarRatio: calmarRatio.toFixed(6),
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
