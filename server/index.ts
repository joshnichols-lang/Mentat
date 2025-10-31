import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startMonitoring } from "./monitoringService";
import { startPeriodicSnapshots } from "./portfolioSnapshotService";
import { initHyperliquidClient } from "./hyperliquid/client";
import { TEST_USER_ID } from "./constants";
import { startUserMonitoring } from "./userMonitoringManager";
import { storage } from "./storage";
import { startScheduler } from "./scheduler";

const app = express();
app.use(express.json({ limit: '50mb' })); // Support large images in AI prompts
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize autonomous trading for all active users
    try {
      const users = await storage.getAllUsers();
      const activeUsers = users.filter(u => u.agentMode === "active");
      
      log(`[Startup] Found ${activeUsers.length} active users, initializing monitoring...`);
      
      for (const user of activeUsers) {
        try {
          // Default to 5 minutes if frequency is 0 or null
          const intervalMinutes = user.monitoringFrequencyMinutes && user.monitoringFrequencyMinutes > 0 
            ? user.monitoringFrequencyMinutes 
            : 5;
          
          // Check when the last monitoring run was to avoid spamming alerts on server restarts
          const lastLog = await storage.getLatestMonitoringLog(user.id);
          const now = new Date();
          const shouldRunImmediately = !lastLog || 
            (now.getTime() - new Date(lastLog.timestamp).getTime()) >= (intervalMinutes * 60 * 1000);
          
          await startUserMonitoring(user.id, intervalMinutes, shouldRunImmediately);
          
          if (shouldRunImmediately) {
            log(`[Startup] ✓ Started monitoring for user ${user.id} (${intervalMinutes} min interval) - running immediately`);
          } else {
            log(`[Startup] ✓ Started monitoring for user ${user.id} (${intervalMinutes} min interval) - waiting for next interval`);
          }
        } catch (error: any) {
          log(`[Startup] ✗ Failed to start monitoring for user ${user.id}: ${error.message}`);
          // Continue to next user even if one fails
        }
      }
      
      log(`[Startup] Autonomous trading initialization complete`);
    } catch (error) {
      log(`[Startup] Error initializing autonomous trading: ${error}`);
    }
    
    // Start daily aggregation scheduler for learning system
    try {
      startScheduler();
      log(`[Startup] Learning aggregation scheduler started`);
    } catch (error) {
      log(`[Startup] Error starting aggregation scheduler: ${error}`);
    }
  });
})();
