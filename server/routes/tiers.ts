import express from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  canMakeAICall,
  getUpgradeRecommendations,
  updateUserTier,
  calculateTotalBalance,
  calculateTotalVolume,
  TIER_CONFIG,
  type TierName
} from '../tiers';

const router = express.Router();

/**
 * GET /api/tiers/current
 * Get current user tier and quota status
 */
router.get('/current', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user!.id;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const quotaStatus = await canMakeAICall(userId);
    const tier = user.tier as TierName;
    const config = TIER_CONFIG[tier];
    
    const upgrade = getUpgradeRecommendations(
      tier,
      parseFloat(user.totalDepositUsd),
      parseFloat(user.totalVolumeUsd)
    );

    res.json({
      success: true,
      tier: {
        name: tier,
        displayName: config.name,
        description: config.description,
        aiCallsPerDay: config.aiCallsPerDay,
        strategyFrequency: config.strategyFrequency,
        minBalance: config.minBalance,
        minVolume: config.minVolume
      },
      quota: {
        used: quotaStatus.callsUsed,
        limit: quotaStatus.callsLimit,
        remaining: quotaStatus.callsLimit - quotaStatus.callsUsed,
        resetAt: quotaStatus.resetAt,
        canMakeCall: quotaStatus.allowed
      },
      balance: parseFloat(user.totalDepositUsd),
      volume: parseFloat(user.totalVolumeUsd),
      upgrade
    });
  } catch (error: any) {
    console.error('[Tiers] Error fetching current tier:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tiers/refresh
 * Recalculate tier based on current balance and volume
 */
router.post('/refresh', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user!.id;
    
    // Calculate current balance and volume across all exchanges
    const balance = await calculateTotalBalance(userId);
    const volume = await calculateTotalVolume(userId);
    
    // Update tier
    const newTier = await updateUserTier(userId, balance, volume);
    const config = TIER_CONFIG[newTier];

    res.json({
      success: true,
      tier: newTier,
      balance,
      volume,
      config: {
        name: config.name,
        description: config.description,
        aiCallsPerDay: config.aiCallsPerDay,
        strategyFrequency: config.strategyFrequency
      }
    });
  } catch (error: any) {
    console.error('[Tiers] Error refreshing tier:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tiers/all
 * Get all tier definitions
 */
router.get('/all', async (req, res) => {
  try {
    const tiers = Object.entries(TIER_CONFIG).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      minBalance: value.minBalance,
      minVolume: value.minVolume,
      aiCallsPerDay: value.aiCallsPerDay === Infinity ? 'Unlimited' : value.aiCallsPerDay,
      strategyFrequency: value.strategyFrequency
    }));

    res.json({
      success: true,
      tiers
    });
  } catch (error: any) {
    console.error('[Tiers] Error fetching all tiers:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
