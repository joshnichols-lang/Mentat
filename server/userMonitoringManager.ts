import { storage } from "./storage";
import { developAutonomousStrategy } from "./monitoringService";
import { getUserHyperliquidClient } from "./hyperliquid/client";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { analyzeStrategyForMonitoring } from "./strategyParser";
import { TriggerRegistry } from "./triggerSupervisor";
import type { TriggerSpec } from "./strategyAnalyzer";

/**
 * Per-user monitoring state
 */
interface UserMonitoring {
  userId: string;
  intervalMinutes: number;
  intervalId: NodeJS.Timeout;
  isActive: boolean;
}

/**
 * Global map of active user monitoring loops
 * Key: userId, Value: monitoring state
 */
const activeMonitoring = new Map<string, UserMonitoring>();

/**
 * Track last restart time per user to prevent rapid-fire restarts
 * Key: userId, Value: timestamp of last restart
 */
const lastRestartTime = new Map<string, number>();

// Minimum time between monitoring restarts (milliseconds)
const RESTART_COOLDOWN_MS = 5000; // 5 seconds

/**
 * Start autonomous trading monitoring for a specific user
 * Automatically analyzes strategy to optimize monitoring intervals
 */
export async function startUserMonitoring(userId: string, intervalMinutes: number, runImmediately: boolean = true): Promise<void> {
  // SAFETY: Stop existing monitoring if running to prevent multiple loops
  if (activeMonitoring.has(userId)) {
    console.log(`[User Monitoring] ⚠️ User ${userId} already has monitoring active, stopping old loop before starting new one...`);
    await stopUserMonitoring(userId);
    // Add a small delay to ensure old loop is fully stopped
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (intervalMinutes === 0) {
    console.log(`[User Monitoring] Monitoring disabled for user ${userId} (interval: 0)`);
    return;
  }
  
  // PHASE 4: No more minimum frequency enforcement - event-driven triggers control costs
  
  // SAFETY: Double-check no monitoring is active before starting
  if (activeMonitoring.has(userId)) {
    console.error(`[User Monitoring] 🚨 CRITICAL: Monitoring still active for ${userId} after stop attempt! Aborting to prevent duplicate loops.`);
    return;
  }

  // Analyze active strategy to recommend optimal monitoring settings
  try {
    const tradingModes = await storage.getTradingModes(userId);
    const activeMode = tradingModes.find(mode => mode.isActive);
    
    if (activeMode && activeMode.description) {
      const analysis = analyzeStrategyForMonitoring(activeMode.description);
      console.log(`[User Monitoring] Strategy Analysis for user ${userId}:`, {
        timeframe: analysis.detectedTimeframe,
        style: analysis.detectedStyle,
        recommendedMonitoringMinutes: analysis.recommendedMonitoringMinutes,
        reasoning: analysis.reasoning
      });
      
      // If user's configured frequency is very different from recommendation, log a note
      if (intervalMinutes > analysis.recommendedMonitoringMinutes * 3) {
        console.log(`[User Monitoring] ⚠️ User's configured frequency (${intervalMinutes} min) is much slower than recommended (${analysis.recommendedMonitoringMinutes} min) for their ${analysis.detectedStyle} strategy`);
      } else if (intervalMinutes < analysis.recommendedMonitoringMinutes / 2) {
        console.log(`[User Monitoring] ⚠️ User's configured frequency (${intervalMinutes} min) is faster than recommended (${analysis.recommendedMonitoringMinutes} min) - may increase AI costs`);
      }
    }
  } catch (error) {
    console.error(`[User Monitoring] Error analyzing strategy:`, error);
    // Continue with monitoring even if analysis fails
  }

  console.log(`[User Monitoring] Starting monitoring for user ${userId} (every ${intervalMinutes} minutes)`);

  // Create initial portfolio snapshot - REQUIRED before monitoring can start
  try {
    const hyperliquidClient = await getUserHyperliquidClient(userId);
    if (!hyperliquidClient) {
      throw new Error(`No Hyperliquid client available for user ${userId}. User must configure Hyperliquid credentials.`);
    }
    
    await createPortfolioSnapshot(userId, hyperliquidClient);
    console.log(`[User Monitoring] Created initial snapshot for user ${userId}`);
  } catch (error) {
    console.error(`[User Monitoring] Cannot start monitoring for user ${userId}:`, error);
    throw error; // Fail fast - don't start monitoring without credentials
  }

  // PHASE 4: Check if strategy has event-driven triggers
  let useEventDrivenMode = false;
  try {
    const tradingModes = await storage.getTradingModes(userId);
    const activeMode = tradingModes.find(mode => mode.isActive);
    
    const triggers = (activeMode?.strategyConfig as any)?.triggers as TriggerSpec[] | undefined;
    
    if (activeMode && triggers && triggers.length > 0) {
      
      // Determine symbol (default to BTC if not specified)
      // TODO: Extract symbol from strategy parameters
      const symbol = "BTC";
      
      console.log(`[User Monitoring] 🚀 PHASE 4: Event-driven mode activated with ${triggers.length} triggers`);
      
      // Create TriggerSupervisor
      const supervisor = TriggerRegistry.create(
        userId,
        activeMode.id.toString(),
        symbol,
        triggers,
        async (trigger: TriggerSpec, currentValue: number) => {
          console.log(`[User Monitoring] Trigger fired for ${userId}: ${trigger.description} (value: ${currentValue})`);
          // Call AI to assess the opportunity
          try {
            await developAutonomousStrategy(userId);
          } catch (error) {
            console.error(`[User Monitoring] Error in trigger-based AI call:`, error);
          }
        }
      );
      
      // Start supervisor
      supervisor.start();
      useEventDrivenMode = true;
      
      console.log(`[User Monitoring] ✓ TriggerSupervisor started for ${userId} - AI will be called only when triggers fire`);
    }
  } catch (error) {
    console.error(`[User Monitoring] Error setting up event-driven mode:`, error);
    // Fall back to time-based monitoring
  }

  // Run the autonomous strategy immediately (unless skipped for frequency changes)
  if (runImmediately && !useEventDrivenMode) {
    try {
      await developAutonomousStrategy(userId);
    } catch (error) {
      console.error(`[User Monitoring] Error in initial autonomous strategy for user ${userId}:`, error);
    }
  } else if (useEventDrivenMode) {
    console.log(`[User Monitoring] Event-driven mode active - skipping immediate run, waiting for triggers`);
  } else {
    console.log(`[User Monitoring] Skipping immediate run for user ${userId} - waiting for next scheduled interval`);
  }

  // Set up recurring interval (or safety heartbeat for event-driven mode)
  let intervalId: NodeJS.Timeout;
  
  if (useEventDrivenMode) {
    // PHASE 4: Safety heartbeat - check in every 30 minutes even in event-driven mode
    const safetyHeartbeatMinutes = 30;
    console.log(`[User Monitoring] Setting up safety heartbeat (every ${safetyHeartbeatMinutes} min)`);
    
    intervalId = setInterval(async () => {
      console.log(`[User Monitoring] 💓 Safety heartbeat for ${userId} - re-syncing state`);
      try {
        await developAutonomousStrategy(userId);
      } catch (error) {
        console.error(`[User Monitoring] Error in safety heartbeat for user ${userId}:`, error);
      }
    }, safetyHeartbeatMinutes * 60 * 1000);
  } else {
    // Traditional time-based monitoring
    intervalId = setInterval(async () => {
      try {
        await developAutonomousStrategy(userId);
      } catch (error) {
        console.error(`[User Monitoring] Error in autonomous strategy for user ${userId}:`, error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  // Store monitoring state
  activeMonitoring.set(userId, {
    userId,
    intervalMinutes,
    intervalId,
    isActive: true,
  });

  console.log(`[User Monitoring] Successfully started monitoring for user ${userId}`);
}

/**
 * Stop autonomous trading monitoring for a specific user
 */
export async function stopUserMonitoring(userId: string): Promise<void> {
  const monitoring = activeMonitoring.get(userId);
  
  if (!monitoring) {
    console.log(`[User Monitoring] No active monitoring found for user ${userId}`);
    return;
  }

  console.log(`[User Monitoring] Stopping monitoring for user ${userId}`);
  
  clearInterval(monitoring.intervalId);
  activeMonitoring.delete(userId);
  
  console.log(`[User Monitoring] Successfully stopped monitoring for user ${userId}`);
}

/**
 * Restart monitoring for a user with a new interval
 */
export async function restartUserMonitoring(userId: string, intervalMinutes: number, runImmediately: boolean = false): Promise<void> {
  console.log(`[User Monitoring] Restarting monitoring for user ${userId} with interval: ${intervalMinutes} minutes`);
  
  // SAFETY: Rate limit restarts to prevent rapid-fire calls from frontend
  const lastRestart = lastRestartTime.get(userId);
  const now = Date.now();
  
  if (lastRestart && (now - lastRestart) < RESTART_COOLDOWN_MS) {
    const remainingCooldown = Math.ceil((RESTART_COOLDOWN_MS - (now - lastRestart)) / 1000);
    console.warn(`[User Monitoring] ⚠️ Ignoring restart request for ${userId} - cooldown active (${remainingCooldown}s remaining)`);
    return;
  }
  
  lastRestartTime.set(userId, now);
  
  await stopUserMonitoring(userId);
  
  if (intervalMinutes > 0) {
    // When restarting due to frequency change, don't run immediately - wait for next interval
    await startUserMonitoring(userId, intervalMinutes, runImmediately);
  } else {
    console.log(`[User Monitoring] Monitoring disabled for user ${userId}`);
  }
}

/**
 * Get monitoring status for a user
 */
export function getUserMonitoringStatus(userId: string): { isActive: boolean; intervalMinutes: number } | null {
  const monitoring = activeMonitoring.get(userId);
  
  if (!monitoring) {
    return null;
  }
  
  return {
    isActive: monitoring.isActive,
    intervalMinutes: monitoring.intervalMinutes,
  };
}

/**
 * Get all active monitoring sessions
 */
export function getAllActiveMonitoring(): Array<{ userId: string; intervalMinutes: number }> {
  return Array.from(activeMonitoring.values()).map(m => ({
    userId: m.userId,
    intervalMinutes: m.intervalMinutes,
  }));
}

/**
 * Initialize monitoring for all users in active mode on server startup
 */
export async function initializeAllUserMonitoring(): Promise<void> {
  console.log("[User Monitoring] Initializing monitoring for all active users...");
  
  try {
    // Get all users who are in active mode and verified
    const users = await storage.getAllUsers();
    const activeUsers = users.filter(user => 
      user.agentMode === "active" && 
      user.verificationStatus === "approved"
    );
    
    console.log(`[User Monitoring] Found ${activeUsers.length} active users to monitor`);
    
    // Start monitoring for each user (startUserMonitoring creates initial snapshot)
    for (const user of activeUsers) {
      try {
        // Start monitoring with user's configured frequency (default to 5 minutes)
        // Note: startUserMonitoring will create the initial snapshot
        const intervalMinutes = user.monitoringFrequencyMinutes || 5;
        await startUserMonitoring(user.id, intervalMinutes);
      } catch (error) {
        console.error(`[User Monitoring] Failed to initialize monitoring for user ${user.id}:`, error);
      }
    }
    
    console.log(`[User Monitoring] Initialization complete. ${activeMonitoring.size} users actively monitored.`);
  } catch (error) {
    console.error("[User Monitoring] Error during initialization:", error);
  }
}

/**
 * Cleanup all monitoring on server shutdown
 */
export async function shutdownAllUserMonitoring(): Promise<void> {
  console.log("[User Monitoring] Shutting down all user monitoring...");
  
  const userIds = Array.from(activeMonitoring.keys());
  
  for (const userId of userIds) {
    await stopUserMonitoring(userId);
  }
  
  console.log("[User Monitoring] All user monitoring stopped.");
}
