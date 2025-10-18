import { runGlobalAggregation } from "./aggregationService";

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the daily aggregation scheduler
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Scheduler already running");
    return;
  }

  console.log("[Scheduler] Starting daily aggregation scheduler...");

  // Run immediately on startup
  runGlobalAggregation().catch((error) => {
    console.error("[Scheduler] Error during startup aggregation:", error);
  });

  // Then run every 24 hours
  schedulerInterval = setInterval(() => {
    console.log("[Scheduler] Running scheduled daily aggregation...");
    runGlobalAggregation().catch((error) => {
      console.error("[Scheduler] Error during scheduled aggregation:", error);
    });
  }, ONE_DAY_MS);

  console.log("[Scheduler] Scheduler started - will run every 24 hours");
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}
