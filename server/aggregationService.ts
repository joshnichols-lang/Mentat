import { db } from "./db";
import { trades, tradeEvaluations, strategyLearnings, marketRegimeSnapshots, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { User } from "@shared/schema";

const HALF_LIFE_DAYS = 30; // Learnings decay with 30-day half-life
const MIN_CONFIDENCE_THRESHOLD = 20; // Archive learnings below 20% confidence

/**
 * Update decay weights for all active learnings
 * Called daily to adjust weights based on time elapsed
 */
export async function updateLearningDecayWeights(userId: string): Promise<void> {
  console.log(`[Aggregation] Updating decay weights for user ${userId}...`);
  
  const activeLearnings = await db
    .select()
    .from(strategyLearnings)
    .where(and(
      eq(strategyLearnings.userId, userId),
      eq(strategyLearnings.isActive, 1)
    ));

  const now = new Date();
  let updated = 0;
  let archived = 0;

  for (const learning of activeLearnings) {
    // Guard against missing/invalid timestamps - treat as just created
    const updatedAt = learning.updatedAt ? new Date(learning.updatedAt) : now;
    let daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Guard against negative time (clock skew) - reset timestamp and treat as just updated
    if (daysSinceUpdate < 0) {
      console.warn(`[Aggregation] Future timestamp detected for learning ${learning.id}, resetting to now`);
      await db
        .update(strategyLearnings)
        .set({ updatedAt: now, decayWeight: "1.0" })
        .where(eq(strategyLearnings.id, learning.id));
      continue;
    }
    
    const decay = Math.exp(-daysSinceUpdate / HALF_LIFE_DAYS);
    
    // Parse and validate decay weight with strict bounds [0.001, 1.0]
    const EPS = 0.001; // Minimum weight before archival
    const MAX_WEIGHT = 1.0;
    let currentWeight = 1.0;
    
    if (learning.decayWeight) {
      const parsed = parseFloat(learning.decayWeight);
      if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
        // Clamp to safe range to prevent corrupted data from breaking system
        currentWeight = Math.min(Math.max(parsed, EPS), MAX_WEIGHT);
        
        // Log warning if clamping occurred
        if (parsed !== currentWeight) {
          console.warn(`[Aggregation] Clamped weight for learning ${learning.id} from ${parsed} to ${currentWeight}`);
        }
      } else {
        console.warn(`[Aggregation] Invalid weight for learning ${learning.id}: ${learning.decayWeight}, resetting to 1.0`);
      }
    }
    
    const newWeight = currentWeight * decay;
    const confidence = parseFloat(learning.confidenceScore || "50");
    const effectiveConfidence = confidence * newWeight;

    // Archive if confidence falls below threshold
    if (effectiveConfidence < MIN_CONFIDENCE_THRESHOLD) {
      await db
        .update(strategyLearnings)
        .set({ isActive: 0, updatedAt: now })
        .where(eq(strategyLearnings.id, learning.id));
      archived++;
    } else {
      await db
        .update(strategyLearnings)
        .set({ 
          decayWeight: newWeight.toString(),
          updatedAt: now  // Critical: Update timestamp to prevent double-decay
        })
        .where(eq(strategyLearnings.id, learning.id));
      updated++;
    }
  }

  console.log(`[Aggregation] Updated ${updated} learnings, archived ${archived} low-confidence learnings`);
}

/**
 * Compute performance metrics by market regime
 */
export async function computeRegimePerformance(userId: string): Promise<void> {
  console.log(`[Aggregation] Computing regime performance for user ${userId}...`);

  // Get all closed trades with evaluations
  const closedTrades = await db
    .select()
    .from(trades)
    .where(and(
      eq(trades.userId, userId),
      eq(trades.status, "closed")
    ));

  if (closedTrades.length === 0) {
    console.log(`[Aggregation] No closed trades found for user ${userId}`);
    return;
  }

  // Get evaluations for regime classification
  const evaluations = await db
    .select()
    .from(tradeEvaluations)
    .where(eq(tradeEvaluations.userId, userId));

  // Group trades by regime
  const regimeGroups: Record<string, typeof closedTrades> = {
    bullish: [],
    bearish: [],
    volatile: [],
    neutral: [],
  };

  for (const trade of closedTrades) {
    const evaluation = evaluations.find(e => e.tradeId === trade.id);
    const regime = evaluation?.marketRegime || "neutral";
    if (regimeGroups[regime]) {
      regimeGroups[regime].push(trade);
    }
  }

  // Compute metrics for each regime
  for (const [regime, trades] of Object.entries(regimeGroups)) {
    if (trades.length === 0) continue;

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl && parseFloat(t.pnl) > 0);
    const losingTrades = trades.filter(t => t.pnl && parseFloat(t.pnl) < 0);
    
    const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);
    const avgPnl = totalPnl / totalTrades;
    const winRate = (winningTrades.length / totalTrades) * 100;

    // Calculate Sharpe ratio for regime
    const pnls = trades.map(t => parseFloat(t.pnl || "0"));
    const mean = avgPnl;
    const variance = pnls.reduce((sum, pnl) => sum + Math.pow(pnl - mean, 2), 0) / totalTrades;
    const stdDev = Math.sqrt(variance);
    const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0; // Annualized

    // Store regime snapshot
    await db.insert(marketRegimeSnapshots).values({
      userId,
      regime,
      tradesInRegime: totalTrades,
      avgPnlInRegime: avgPnl.toString(),
      winRateInRegime: winRate.toString(),
      sharpeInRegime: sharpe.toString(),
    });

    console.log(`[Aggregation] ${regime.toUpperCase()}: ${totalTrades} trades, ${winRate.toFixed(1)}% win rate, $${avgPnl.toFixed(2)} avg PnL, Sharpe ${sharpe.toFixed(2)}`);
  }
}

/**
 * Compute performance metrics by asset
 */
export async function computeAssetPerformance(userId: string): Promise<{ symbol: string; trades: number; winRate: number; avgPnl: number }[]> {
  console.log(`[Aggregation] Computing asset performance for user ${userId}...`);

  const closedTrades = await db
    .select()
    .from(trades)
    .where(and(
      eq(trades.userId, userId),
      eq(trades.status, "closed")
    ));

  if (closedTrades.length === 0) {
    return [];
  }

  // Group by symbol
  const assetGroups: Record<string, typeof closedTrades> = {};
  for (const trade of closedTrades) {
    if (!assetGroups[trade.symbol]) {
      assetGroups[trade.symbol] = [];
    }
    assetGroups[trade.symbol].push(trade);
  }

  const assetMetrics = [];
  for (const [symbol, trades] of Object.entries(assetGroups)) {
    const winningTrades = trades.filter(t => t.pnl && parseFloat(t.pnl) > 0);
    const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);
    const avgPnl = totalPnl / trades.length;
    const winRate = (winningTrades.length / trades.length) * 100;

    assetMetrics.push({
      symbol,
      trades: trades.length,
      winRate,
      avgPnl,
    });

    console.log(`[Aggregation] ${symbol}: ${trades.length} trades, ${winRate.toFixed(1)}% win rate, $${avgPnl.toFixed(2)} avg PnL`);
  }

  return assetMetrics.sort((a, b) => b.avgPnl - a.avgPnl);
}

/**
 * Consolidate duplicate learnings
 * Merges similar insights into single high-confidence learnings
 */
export async function consolidateLearnings(userId: string): Promise<void> {
  console.log(`[Aggregation] Consolidating learnings for user ${userId}...`);

  const activeLearnings = await db
    .select()
    .from(strategyLearnings)
    .where(and(
      eq(strategyLearnings.userId, userId),
      eq(strategyLearnings.isActive, 1)
    ))
    .orderBy(desc(strategyLearnings.sampleSize));

  // Group by category and subcategory
  const groups: Record<string, typeof activeLearnings> = {};
  for (const learning of activeLearnings) {
    const key = `${learning.category}_${learning.subcategory || 'general'}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(learning);
  }

  let consolidated = 0;
  for (const [key, learnings] of Object.entries(groups)) {
    if (learnings.length <= 1) continue;

    // Keep the one with highest sample size, archive duplicates
    const primary = learnings[0];
    const duplicates = learnings.slice(1);

    for (const dup of duplicates) {
      // Archive duplicate
      await db
        .update(strategyLearnings)
        .set({ isActive: 0 })
        .where(eq(strategyLearnings.id, dup.id));
      consolidated++;
    }
  }

  console.log(`[Aggregation] Consolidated ${consolidated} duplicate learnings`);
}

/**
 * Main aggregation job - runs daily
 */
export async function runDailyAggregation(userId: string): Promise<void> {
  console.log(`[Aggregation] Starting daily aggregation for user ${userId}...`);

  try {
    await updateLearningDecayWeights(userId);
    await computeRegimePerformance(userId);
    await computeAssetPerformance(userId);
    await consolidateLearnings(userId);

    console.log(`[Aggregation] Daily aggregation completed for user ${userId}`);
  } catch (error) {
    console.error(`[Aggregation] Error during daily aggregation:`, error);
  }
}

/**
 * Run aggregation for all active users
 */
export async function runGlobalAggregation(): Promise<void> {
  console.log(`[Aggregation] Starting global aggregation...`);

  // Get all verified users
  const allUsers = await db.select().from(users).where(eq(users.verificationStatus, "approved"));

  for (const user of allUsers) {
    await runDailyAggregation(user.id);
  }

  console.log(`[Aggregation] Global aggregation completed for ${allUsers.length} users`);
}
