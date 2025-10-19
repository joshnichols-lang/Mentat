import { storage } from "./storage";
import { developAutonomousStrategy } from "./monitoringService";
import { getUserHyperliquidClient } from "./hyperliquid/client";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";

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
 * Start autonomous trading monitoring for a specific user
 */
export async function startUserMonitoring(userId: string, intervalMinutes: number, runImmediately: boolean = true): Promise<void> {
  // Stop existing monitoring if running
  if (activeMonitoring.has(userId)) {
    console.log(`[User Monitoring] User ${userId} already has monitoring active, restarting...`);
    await stopUserMonitoring(userId);
  }

  if (intervalMinutes === 0) {
    console.log(`[User Monitoring] Monitoring disabled for user ${userId} (interval: 0)`);
    return;
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

  // Run the autonomous strategy immediately (unless skipped for frequency changes)
  if (runImmediately) {
    try {
      await developAutonomousStrategy(userId);
    } catch (error) {
      console.error(`[User Monitoring] Error in initial autonomous strategy for user ${userId}:`, error);
    }
  } else {
    console.log(`[User Monitoring] Skipping immediate run for user ${userId} - waiting for next scheduled interval`);
  }

  // Set up recurring interval
  const intervalId = setInterval(async () => {
    try {
      await developAutonomousStrategy(userId);
    } catch (error) {
      console.error(`[User Monitoring] Error in autonomous strategy for user ${userId}:`, error);
    }
  }, intervalMinutes * 60 * 1000);

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
