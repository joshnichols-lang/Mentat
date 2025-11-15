import { db } from './db';
import { users } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

// Tier definitions with balance, volume requirements, and AI quotas
export const TIER_CONFIG = {
  free: {
    name: 'Free',
    minBalance: 0,
    minVolume: 0,
    aiCallsPerDay: 25,
    strategyFrequency: 15, // min minutes between AI calls
    description: 'No deposit required, 25 AI calls/day, 15-min strategies max'
  },
  bronze: {
    name: 'Bronze',
    minBalance: 500,
    minVolume: 1000,
    aiCallsPerDay: 100,
    strategyFrequency: 5, // 5-min strategies allowed
    description: '$500 balance OR $1k volume, 100 AI calls/day, 5-min strategies'
  },
  silver: {
    name: 'Silver',
    minBalance: 2500,
    minVolume: 10000,
    aiCallsPerDay: 300,
    strategyFrequency: 1, // 1-min strategies allowed
    description: '$2.5k balance OR $10k volume, 300 AI calls/day, 1-min strategies'
  },
  gold: {
    name: 'Gold',
    minBalance: 10000,
    minVolume: 100000,
    aiCallsPerDay: 1000,
    strategyFrequency: 1, // unlimited frequency
    description: '$10k balance OR $100k volume, 1000 AI calls/day, unlimited frequency'
  },
  platinum: {
    name: 'Platinum',
    minBalance: 50000,
    minVolume: 500000,
    aiCallsPerDay: -1, // -1 means unlimited
    strategyFrequency: 1, // unlimited frequency
    description: '$50k balance OR $500k volume, unlimited AI calls, priority access'
  }
} as const;

export type TierName = keyof typeof TIER_CONFIG;

/**
 * Calculate user tier based on balance and volume
 */
export function calculateTier(balanceUsd: number, volumeUsd: number): TierName {
  // Check tiers from highest to lowest
  // User qualifies if they meet EITHER balance OR volume requirement (more flexible)
  if (balanceUsd >= TIER_CONFIG.platinum.minBalance || volumeUsd >= TIER_CONFIG.platinum.minVolume) {
    return 'platinum';
  }
  if (balanceUsd >= TIER_CONFIG.gold.minBalance || volumeUsd >= TIER_CONFIG.gold.minVolume) {
    return 'gold';
  }
  if (balanceUsd >= TIER_CONFIG.silver.minBalance || volumeUsd >= TIER_CONFIG.silver.minVolume) {
    return 'silver';
  }
  if (balanceUsd >= TIER_CONFIG.bronze.minBalance || volumeUsd >= TIER_CONFIG.bronze.minVolume) {
    return 'bronze';
  }
  return 'free';
}

/**
 * Update user tier based on current balance and volume
 */
export async function updateUserTier(userId: string, balanceUsd: number, volumeUsd: number) {
  // Get current user to check cached values
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });
  
  // If API calls failed (returning 0), fallback to cached values
  const finalBalance = (balanceUsd === 0 && currentUser?.totalDepositUsd) 
    ? parseFloat(currentUser.totalDepositUsd) 
    : balanceUsd;
  const finalVolume = (volumeUsd === 0 && currentUser?.totalVolumeUsd)
    ? parseFloat(currentUser.totalVolumeUsd)
    : volumeUsd;
  
  const newTier = calculateTier(finalBalance, finalVolume);
  
  // Only update cached totals if we got fresh data
  const updateData: any = {
    tier: newTier,
    updatedAt: new Date()
  };
  
  if (balanceUsd > 0 || !currentUser?.totalDepositUsd) {
    updateData.totalDepositUsd = finalBalance.toString();
  }
  if (volumeUsd > 0 || !currentUser?.totalVolumeUsd) {
    updateData.totalVolumeUsd = finalVolume.toString();
  }
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  return newTier;
}

/**
 * Check if user can make an AI call (within daily quota)
 */
export async function canMakeAICall(userId: string): Promise<{
  allowed: boolean;
  tier: TierName;
  callsUsed: number;
  callsLimit: number;
  resetAt: Date;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const tier = user.tier as TierName;
  const config = TIER_CONFIG[tier];
  const now = new Date();
  const resetAt = new Date(user.aiCallsResetAt);
  
  // Reset counter if it's a new day
  let callsToday = user.aiCallsToday;
  if (now > resetAt) {
    const nextReset = new Date(now);
    nextReset.setUTCHours(24, 0, 0, 0); // Reset at midnight UTC
    
    await db.update(users)
      .set({
        aiCallsToday: 0,
        aiCallsResetAt: nextReset
      })
      .where(eq(users.id, userId));
    
    callsToday = 0;
  }
  
  const allowed = config.aiCallsPerDay === -1 || callsToday < config.aiCallsPerDay;
  
  // Calculate next reset time in UTC
  const nextResetTime = new Date(now);
  nextResetTime.setUTCHours(24, 0, 0, 0);
  
  return {
    allowed,
    tier,
    callsUsed: callsToday,
    callsLimit: config.aiCallsPerDay === Infinity ? -1 : config.aiCallsPerDay, // Use -1 for unlimited
    resetAt: resetAt > now ? resetAt : nextResetTime
  };
}

/**
 * Increment AI call counter for user
 */
export async function incrementAICall(userId: string): Promise<void> {
  await db.update(users)
    .set({
      aiCallsToday: sql`${users.aiCallsToday} + 1`
    })
    .where(eq(users.id, userId));
}

/**
 * Get tier upgrade recommendations
 */
export function getUpgradeRecommendations(currentTier: TierName, balanceUsd: number, volumeUsd: number) {
  const tierOrder: TierName[] = ['free', 'bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  if (currentIndex === tierOrder.length - 1) {
    return null; // Already at max tier
  }
  
  const nextTier = tierOrder[currentIndex + 1];
  const nextConfig = TIER_CONFIG[nextTier];
  
  const balanceNeeded = Math.max(0, nextConfig.minBalance - balanceUsd);
  const volumeNeeded = Math.max(0, nextConfig.minVolume - volumeUsd);
  
  return {
    nextTier,
    balanceNeeded,
    volumeNeeded,
    benefits: {
      aiCalls: nextConfig.aiCallsPerDay,
      strategyFrequency: nextConfig.strategyFrequency,
      description: nextConfig.description
    }
  };
}

/**
 * Calculate total balance across all exchanges
 */
export async function calculateTotalBalance(userId: string): Promise<number> {
  try {
    const { getUserHyperliquidClient } = await import('./hyperliquid/client');
    const { storage } = await import('./storage');
    
    let totalBalance = 0;
    
    // Get Hyperliquid balance
    try {
      const hlClient = await getUserHyperliquidClient(userId);
      const userState = await hlClient.getUserState();
      if (userState && userState.marginSummary) {
        // Total account value = accountValue from margin summary
        totalBalance += parseFloat(userState.marginSummary.accountValue || '0');
      }
    } catch (err) {
      console.log(`[Tiers] No Hyperliquid balance for user ${userId}`);
    }
    
    // TODO: Add Blofin, Polymarket, etc. when ready
    
    return totalBalance;
  } catch (error) {
    console.error('[Tiers] Error calculating balance:', error);
    return 0;
  }
}

/**
 * Calculate total trading volume
 */
export async function calculateTotalVolume(userId: string): Promise<number> {
  try {
    const { db } = await import('./db');
    const { trades } = await import('../shared/schema');
    const { eq, and, sql } = await import('drizzle-orm');
    
    // Sum volume from all completed trades
    const result = await db.select({
      totalVolume: sql<string>`COALESCE(SUM(CAST(${trades.size} AS NUMERIC) * CAST(${trades.entryPrice} AS NUMERIC)), 0)`
    })
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.status, 'closed')
      )
    );
    
    return parseFloat(result[0]?.totalVolume || '0');
  } catch (error) {
    console.error('[Tiers] Error calculating volume:', error);
    return 0;
  }
}
