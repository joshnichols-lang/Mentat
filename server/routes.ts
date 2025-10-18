import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processTradingPrompt } from "./tradingAgent";
import { initHyperliquidClient, getUserHyperliquidClient } from "./hyperliquid/client";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { restartMonitoring } from "./monitoringService";
import { startUserMonitoring, stopUserMonitoring, restartUserMonitoring } from "./userMonitoringManager";
import { setupAuth } from "./auth";
import { storeUserCredentials, getUserPrivateKey, deleteUserCredentials, hasUserCredentials } from "./credentialService";
import { initializeMarketDataWebSocket } from "./marketDataWebSocket";
import { CVDCalculator } from "./cvdCalculator";
import { VolumeProfileCalculator } from "./volumeProfileCalculator";
import { encryptCredential } from "./encryption";
import { z } from "zod";
import { hashPassword, comparePasswords } from "./auth";
import multer from "multer";
import Papa from "papaparse";

// Middleware to check if user is authenticated
function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Middleware to check if user is verified (approved)
function requireVerifiedUser(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user!;
  if (user.verificationStatus !== "approved") {
    return res.status(403).json({ 
      message: "Account pending verification", 
      verificationStatus: user.verificationStatus 
    });
  }
  
  return next();
}

// Middleware to check if user is admin
function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user!;
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  return next();
}

// Helper to get authenticated user ID
function getUserId(req: any): string {
  return req.user!.id;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize username/password authentication
  setupAuth(app);

  // Note: /api/user, /api/login, /api/register, /api/logout are handled in setupAuth()

  // AI Trading Prompt endpoint
  app.post("/api/trading/prompt", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const schema = z.object({
        prompt: z.string().min(1),
        marketData: z.array(z.object({
          symbol: z.string(),
          price: z.union([z.string(), z.number()]).transform(val => String(val)),
          change24h: z.union([z.string(), z.number()]).transform(val => String(val)),
          volume24h: z.union([z.string(), z.number()]).transform(val => String(val)),
        })),
        currentPositions: z.array(z.any()).optional(),
        autoExecute: z.boolean().optional().default(true),
        model: z.string().optional(), // Optional model - AI router will use provider default if not specified
        preferredProvider: z.enum(["perplexity", "openai", "xai"]).optional(), // Optional preferred AI provider
        screenshots: z.array(z.string()).optional(), // Optional base64 encoded screenshots
      });

      const { prompt, marketData, currentPositions = [], autoExecute = true, model, preferredProvider, screenshots } = schema.parse(req.body);

      // Validate screenshots if provided
      if (screenshots && screenshots.length > 0) {
        // Limit to 5 screenshots max
        if (screenshots.length > 5) {
          return res.status(400).json({
            success: false,
            error: "Maximum 5 screenshots allowed per prompt"
          });
        }

        // Validate each screenshot
        for (const screenshot of screenshots) {
          // Must be a data URI
          if (!screenshot.startsWith('data:image/')) {
            return res.status(400).json({
              success: false,
              error: "Screenshots must be base64 encoded image data URIs"
            });
          }

          // Check size (5MB limit per image)
          const sizeInBytes = screenshot.length * 0.75; // Base64 is ~33% larger
          if (sizeInBytes > 5 * 1024 * 1024) {
            return res.status(400).json({
              success: false,
              error: "Each screenshot must be under 5MB"
            });
          }
        }
      }

      // Fetch user account state to include portfolio value
      const hyperliquid = await getUserHyperliquidClient(userId);
      const userState = await hyperliquid.getUserState();
      console.log("[Trading Prompt] User state:", JSON.stringify(userState, null, 2));

      const strategy = await processTradingPrompt(userId, prompt, marketData, currentPositions, userState, model, preferredProvider, screenshots);
      
      let executionSummary = null;
      
      // Get user's agent mode to determine if trades should be executed
      const user = await storage.getUser(userId);
      const isActiveMode = user?.agentMode === "active";
      
      // Only execute trades if in active mode AND autoExecute is enabled
      if (isActiveMode && autoExecute && strategy.actions && strategy.actions.length > 0) {
        try {
          executionSummary = await executeTradeStrategy(userId, strategy.actions);
          console.log(`Executed ${executionSummary.successfulExecutions}/${executionSummary.totalActions} trades successfully`);
          
          // Create portfolio snapshot after successful trade execution
          if (executionSummary.successfulExecutions > 0) {
            const hyperliquid = await getUserHyperliquidClient(userId);
            createPortfolioSnapshot(userId, hyperliquid).catch(err => 
              console.error("Failed to create portfolio snapshot after trade:", err)
            );
          }
        } catch (execError: any) {
          console.error("Failed to execute trades:", execError);
          // Continue even if execution fails - return strategy with error
          executionSummary = {
            totalActions: strategy.actions.length,
            successfulExecutions: 0,
            failedExecutions: strategy.actions.length,
            skippedActions: 0,
            results: [],
            error: execError.message || "Trade execution failed"
          };
        }
      }
      
      res.json({ 
        success: true, 
        strategy,
        execution: executionSummary,
        agentMode: user?.agentMode || "passive",
        executionSkipped: !isActiveMode && autoExecute && strategy.actions && strategy.actions.length > 0
      });
    } catch (error: any) {
      console.error("Error processing trading prompt:", error);
      
      // Handle OpenAI content filter errors (check both possible property paths)
      if (error?.status === 400 && (error?.error?.code === 'content_filter' || error?.code === 'content_filter')) {
        return res.status(400).json({
          success: false,
          error: "Your prompt was filtered by our content policy. Please rephrase your request using educational or analytical language.",
          code: "content_filter"
        });
      }
      
      // Handle rate limiting
      if (error?.status === 429) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please wait a moment and try again.",
          code: "rate_limit"
        });
      }
      
      // Handle service unavailable
      if (error?.status === 503) {
        return res.status(503).json({
          success: false,
          error: "AI service is temporarily unavailable. Please try again in a moment.",
          code: "service_unavailable"
        });
      }
      
      // Handle other OpenAI API errors
      if (error?.status && error?.status >= 400 && error?.status < 500) {
        return res.status(400).json({
          success: false,
          error: "Unable to process your request. Please try rephrasing your prompt.",
          code: "ai_error"
        });
      }
      
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }
      
      // Generic error
      res.status(500).json({ 
        success: false, 
        error: "An unexpected error occurred while processing your request. Please try again." 
      });
    }
  });

  // Update user agent mode (passive/active)
  app.patch("/api/user/agent-mode", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        mode: z.enum(["passive", "active"]),
      });
      
      const { mode } = schema.parse(req.body);
      
      const updatedUser = await storage.updateUserAgentMode(userId, mode);
      
      if (!updatedUser) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      
      // Start or stop autonomous trading monitoring based on mode
      if (mode === "active") {
        // Get user's monitoring frequency (default to 5 minutes if 0 or null)
        // Note: 0 means "disabled" so we use default 5 minutes when activating
        let intervalMinutes = updatedUser.monitoringFrequencyMinutes || 5;
        if (intervalMinutes === 0) {
          intervalMinutes = 5;
          // Update user's frequency to 5 minutes (remove the "disabled" setting)
          await storage.updateUserMonitoringFrequency(userId, 5);
        }
        
        try {
          await startUserMonitoring(userId, intervalMinutes);
          console.log(`[Agent Mode] Started monitoring for user ${userId} (${intervalMinutes} min interval)`);
        } catch (monitoringError: any) {
          console.error(`[Agent Mode] Failed to start monitoring for user ${userId}:`, monitoringError);
          // Return error if monitoring can't start (e.g., missing credentials)
          return res.status(400).json({ 
            success: false, 
            error: monitoringError.message || "Failed to start autonomous trading. Please ensure your credentials are configured." 
          });
        }
      } else {
        // Stop monitoring when switching to passive mode
        await stopUserMonitoring(userId);
        console.log(`[Agent Mode] Stopped monitoring for user ${userId}`);
      }
      
      res.json({ 
        success: true, 
        agentMode: updatedUser.agentMode 
      });
    } catch (error: any) {
      console.error("Error updating agent mode:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: "Failed to update agent mode" 
      });
    }
  });

  // Change user password
  app.patch("/api/user/password", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        currentPassword: z.string().min(6).max(100),
        newPassword: z.string().min(6).max(100),
      });
      
      const { currentPassword, newPassword } = schema.parse(req.body);
      
      // Get user to verify current password
      const user = await storage.getUser(userId);
      
      if (!user || !user.password) {
        return res.status(400).json({ success: false, error: "User not found or invalid account type" });
      }
      
      // Verify current password
      const isValidPassword = await comparePasswords(currentPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ success: false, error: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);
      
      // Update password in database
      await storage.updateUserPassword(userId, hashedNewPassword);
      
      res.json({ 
        success: true, 
        message: "Password updated successfully" 
      });
    } catch (error: any) {
      console.error("Error changing password:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: "Failed to change password" 
      });
    }
  });

  // Get all trades
  app.get("/api/trades", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const trades = await storage.getTrades(userId);
      res.json({ success: true, trades });
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ success: false, error: "Failed to fetch trades" });
    }
  });

  // Get all positions
  app.get("/api/positions", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const positions = await storage.getPositions(userId);
      res.json({ success: true, positions });
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({ success: false, error: "Failed to fetch positions" });
    }
  });

  // Get portfolio snapshots
  app.get("/api/portfolio/snapshots", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const snapshots = await storage.getPortfolioSnapshots(userId, limit);
      res.json({ success: true, snapshots });
    } catch (error) {
      console.error("Error fetching portfolio snapshots:", error);
      res.status(500).json({ success: false, error: "Failed to fetch snapshots" });
    }
  });

  // Create a new trade
  app.post("/api/trades", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const trade = await storage.createTrade(userId, req.body);
      res.json({ success: true, trade });
    } catch (error) {
      console.error("Error creating trade:", error);
      res.status(500).json({ success: false, error: "Failed to create trade" });
    }
  });

  // Close a trade
  app.post("/api/trades/:id/close", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const { exitPrice, pnl } = req.body;
      const trade = await storage.closeTrade(userId, req.params.id, exitPrice, pnl);
      res.json({ success: true, trade });
    } catch (error) {
      console.error("Error closing trade:", error);
      res.status(500).json({ success: false, error: "Failed to close trade" });
    }
  });

  // Create or update position
  app.post("/api/positions", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const position = await storage.createPosition(userId, req.body);
      res.json({ success: true, position });
    } catch (error) {
      console.error("Error creating position:", error);
      res.status(500).json({ success: false, error: "Failed to create position" });
    }
  });

  // Update position
  app.patch("/api/positions/:id", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const position = await storage.updatePosition(userId, req.params.id, req.body);
      res.json({ success: true, position });
    } catch (error) {
      console.error("Error updating position:", error);
      res.status(500).json({ success: false, error: "Failed to update position" });
    }
  });

  // Create portfolio snapshot
  app.post("/api/portfolio/snapshots", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const snapshot = await storage.createPortfolioSnapshot(userId, req.body);
      res.json({ success: true, snapshot });
    } catch (error) {
      console.error("Error creating snapshot:", error);
      res.status(500).json({ success: false, error: "Failed to create snapshot" });
    }
  });

  // Get AI usage logs
  app.get("/api/ai/usage", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getAiUsageLogs(userId, limit);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error fetching AI usage logs:", error);
      res.status(500).json({ success: false, error: "Failed to fetch AI usage logs" });
    }
  });

  // Get total AI cost
  app.get("/api/ai/cost", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const totalCost = await storage.getTotalAiCost(userId);
      res.json({ success: true, totalCost });
    } catch (error) {
      console.error("Error fetching AI cost:", error);
      res.status(500).json({ success: false, error: "Failed to fetch AI cost" });
    }
  });

  // Get AI usage statistics (cumulative totals)
  app.get("/api/ai/stats", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const stats = await storage.getAiUsageStats(userId);
      
      // Check if user has personal AI keys
      const aiKeys = await storage.getApiKeysByProvider(userId, "ai", "");
      const hasPersonalAiKeys = aiKeys.length > 0;
      
      res.json({ success: true, stats, hasPersonalAiKeys });
    } catch (error) {
      console.error("Error fetching AI stats:", error);
      res.status(500).json({ success: false, error: "Failed to fetch AI stats" });
    }
  });

  // Get monitoring logs
  app.get("/api/monitoring/logs", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getMonitoringLogs(userId, limit);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error fetching monitoring logs:", error);
      res.status(500).json({ success: false, error: "Failed to fetch monitoring logs" });
    }
  });

  // Get active monitoring alerts
  app.get("/api/monitoring/active", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const logs = await storage.getActiveMonitoringLogs(userId);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error fetching active monitoring alerts:", error);
      res.status(500).json({ success: false, error: "Failed to fetch active alerts" });
    }
  });

  // Dismiss monitoring alert
  app.post("/api/monitoring/:id/dismiss", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const log = await storage.dismissMonitoringLog(userId, req.params.id);
      res.json({ success: true, log });
    } catch (error) {
      console.error("Error dismissing monitoring alert:", error);
      res.status(500).json({ success: false, error: "Failed to dismiss alert" });
    }
  });

  // Update monitoring frequency (per-user setting)
  app.post("/api/monitoring/frequency", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const schema = z.object({
        minutes: z.number().int().min(0).max(1440), // 0 to 24 hours
      });

      const { minutes } = schema.parse(req.body);
      
      // Store per-user monitoring frequency in database
      await storage.updateUserMonitoringFrequency(userId, minutes);
      
      // Get user to check if they're in active mode
      const user = await storage.getUser(userId);
      
      if (user && user.agentMode === "active") {
        // Restart monitoring with new interval (or stop if minutes = 0)
        await restartUserMonitoring(userId, minutes);
        console.log(`[Monitoring Frequency] Updated interval for user ${userId} to ${minutes} minutes`);
      }
      
      res.json({ 
        success: true, 
        message: minutes === 0 
          ? "Monitoring preference set to disabled" 
          : `Monitoring frequency updated to ${minutes} minutes` 
      });
    } catch (error) {
      console.error("Error updating monitoring frequency:", error);
      res.status(500).json({ success: false, error: "Failed to update monitoring frequency" });
    }
  });

  // Hyperliquid API Routes - All require authentication
  
  // Get all available Hyperliquid markets (perpetuals + spot)
  app.get("/api/hyperliquid/markets", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const hyperliquid = await getUserHyperliquidClient(userId);
      
      const markets = await hyperliquid.getMarkets();
      
      res.json({ success: true, markets });
    } catch (error: any) {
      console.error("Failed to fetch Hyperliquid markets:", error);
      
      // Fallback to popular pairs if API is rate-limited or unavailable
      const fallbackMarkets = [
        { symbol: "BTC", displayName: "BTC-USD", type: "perp" as const, index: 0, maxLeverage: 50 },
        { symbol: "ETH", displayName: "ETH-USD", type: "perp" as const, index: 1, maxLeverage: 50 },
        { symbol: "SOL", displayName: "SOL-USD", type: "perp" as const, index: 2, maxLeverage: 20 },
        { symbol: "ARB", displayName: "ARB-USD", type: "perp" as const, index: 3, maxLeverage: 20 },
        { symbol: "OP", displayName: "OP-USD", type: "perp" as const, index: 4, maxLeverage: 20 },
        { symbol: "AVAX", displayName: "AVAX-USD", type: "perp" as const, index: 5, maxLeverage: 20 },
        { symbol: "DOGE", displayName: "DOGE-USD", type: "perp" as const, index: 6, maxLeverage: 20 },
        { symbol: "XRP", displayName: "XRP-USD", type: "perp" as const, index: 7, maxLeverage: 20 },
        { symbol: "MATIC", displayName: "MATIC-USD", type: "perp" as const, index: 8, maxLeverage: 20 },
      ];
      
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      
      console.log("[Markets API] Returning fallback markets due to API error");
      res.json({ success: true, markets: fallbackMarkets });
    }
  });
  
  // Get Hyperliquid market data
  app.get("/api/hyperliquid/market-data", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      const marketData = await hyperliquid.getMarketData();
      res.json({ success: true, marketData });
    } catch (error: any) {
      console.error("Error fetching Hyperliquid market data:", error);
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch market data" });
    }
  });

  // Get Hyperliquid user state
  app.get("/api/hyperliquid/user-state", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      const address = req.query.address as string | undefined;
      const userState = await hyperliquid.getUserState(address);
      res.json({ success: true, userState });
    } catch (error: any) {
      console.error("Error fetching Hyperliquid user state:", error);
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch user state" });
    }
  });

  // Get Hyperliquid positions
  app.get("/api/hyperliquid/positions", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      const address = req.query.address as string | undefined;
      const positions = await hyperliquid.getPositions(address);
      res.json({ success: true, positions });
    } catch (error: any) {
      console.error("Error fetching Hyperliquid positions:", error);
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch positions" });
    }
  });

  // Get Hyperliquid open orders
  app.get("/api/hyperliquid/open-orders", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      const address = req.query.address as string | undefined;
      const orders = await hyperliquid.getOpenOrders(address);
      
      // Hyperliquid API doesn't return tpsl field, so we need to infer it
      // Get positions to determine order direction
      const positions = await hyperliquid.getPositions(address);
      const marketData = await hyperliquid.getMarketData();
      
      const enrichedOrders = orders.map((order: any) => {
        // Find matching position
        const position = positions.find((p: any) => {
          const orderCoin = order.coin.replace('-PERP', '');
          const posCoin = p.coin.replace('-PERP', '');
          return orderCoin === posCoin;
        });
        
        // Find current market price
        const market = marketData.find((m: any) => m.symbol === order.coin);
        const currentPrice = market ? parseFloat(market.price) : null;
        const triggerPx = order.triggerPx ? parseFloat(order.triggerPx) : null;
        
        // Infer tpsl type based on trigger price and position direction
        let tpsl = null;
        if (order.reduceOnly && triggerPx && position && currentPrice) {
          const posSize = parseFloat(position.szi);
          const isLong = posSize > 0;
          
          if (isLong) {
            // For long: stop loss is below current price, take profit is above
            tpsl = triggerPx < currentPrice ? "sl" : "tp";
          } else {
            // For short: stop loss is above current price, take profit is below
            tpsl = triggerPx > currentPrice ? "sl" : "tp";
          }
        }
        
        return {
          ...order,
          tpsl,
          // Also preserve triggerPx if it exists
          triggerPx: order.triggerPx || order.limitPx,
        };
      });
      
      res.json({ success: true, orders: enrichedOrders });
    } catch (error: any) {
      console.error("Error fetching Hyperliquid open orders:", error);
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch open orders" });
    }
  });

  // Place order on Hyperliquid
  app.post("/api/hyperliquid/order", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      
      const baseSchema = z.object({
        coin: z.string(),
        is_buy: z.boolean(),
        sz: z.number().positive(),
        order_type: z.enum(["limit", "market"]),
        reduce_only: z.boolean().optional(),
      });

      const baseParams = baseSchema.parse(req.body);
      
      // Validate limit_px based on order_type
      if (baseParams.order_type === "limit") {
        const limitPx = req.body.limit_px;
        if (typeof limitPx !== "number" || limitPx <= 0) {
          return res.status(400).json({
            success: false,
            error: "Limit orders must include a positive limit_px (price)",
          });
        }
      }
      
      // Convert to Hyperliquid format
      const orderParams = {
        coin: baseParams.coin,
        is_buy: baseParams.is_buy,
        sz: baseParams.sz,
        limit_px: baseParams.order_type === "limit" ? req.body.limit_px : 0,
        order_type: baseParams.order_type === "market" 
          ? { market: {} }
          : { limit: { tif: "Gtc" as const } },
        reduce_only: baseParams.reduce_only,
      };

      const result = await hyperliquid.placeOrder(orderParams);

      if (result.success) {
        res.json({ success: true, response: result.response });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error placing Hyperliquid order:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }

      res.status(500).json({ success: false, error: "Failed to place order" });
    }
  });

  // Cancel order on Hyperliquid
  app.post("/api/hyperliquid/cancel-order", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      
      const schema = z.object({
        coin: z.string(),
        oid: z.number(),
      });

      const params = schema.parse(req.body);
      const result = await hyperliquid.cancelOrder(params);

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error cancelling Hyperliquid order:", error);
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to cancel order" });
    }
  });

  // Close position on Hyperliquid
  app.post("/api/hyperliquid/close-position", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      
      const schema = z.object({
        coin: z.string(),
      });

      const { coin } = schema.parse(req.body);
      
      // Get current positions to find the position to close
      const positions = await hyperliquid.getPositions();
      const position = positions.find((p: any) => p.coin === coin);
      
      if (!position) {
        return res.status(404).json({
          success: false,
          error: `No open position found for ${coin}`,
        });
      }

      const positionSize = Math.abs(parseFloat(position.szi));
      const isLong = parseFloat(position.szi) > 0;
      
      // Close position by placing an opposing order
      const closeOrder = {
        coin,
        is_buy: !isLong,
        sz: positionSize,
        limit_px: isLong ? 0.01 : 999999999,
        order_type: {
          limit: {
            tif: "Ioc" as const,
          },
        },
        reduce_only: true,
      };

      const result = await hyperliquid.placeOrder(closeOrder);

      if (result.success) {
        res.json({ success: true, response: result.response });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error closing position:", error);
      res.status(500).json({ success: false, error: "Failed to close position" });
    }
  });

  // Close all positions and cancel all orders
  app.post("/api/hyperliquid/close-all", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      
      const results = {
        closedPositions: [] as string[],
        cancelledOrders: [] as number[],
        errors: [] as string[],
      };

      // Get all current positions
      const positions = await hyperliquid.getPositions();
      
      // Get all open orders
      const orders = await hyperliquid.getOpenOrders();

      // Close all positions
      for (const position of positions) {
        try {
          const positionSize = Math.abs(parseFloat(position.szi));
          const isLong = parseFloat(position.szi) > 0;
          
          const closeOrder = {
            coin: position.coin,
            is_buy: !isLong,
            sz: positionSize,
            limit_px: isLong ? 0.01 : 999999999,
            order_type: {
              limit: {
                tif: "Ioc" as const,
              },
            },
            reduce_only: true,
          };

          const result = await hyperliquid.placeOrder(closeOrder);
          
          if (result.success) {
            results.closedPositions.push(position.coin);
          } else {
            results.errors.push(`Failed to close ${position.coin}: ${result.error}`);
          }
        } catch (error: any) {
          results.errors.push(`Error closing ${position.coin}: ${error.message}`);
        }
      }

      // Cancel all open orders
      for (const order of orders) {
        try {
          const result = await hyperliquid.cancelOrder({
            coin: order.coin,
            oid: order.oid,
          });
          
          if (result.success) {
            results.cancelledOrders.push(order.oid);
          } else {
            results.errors.push(`Failed to cancel order ${order.oid}: ${result.error}`);
          }
        } catch (error: any) {
          results.errors.push(`Error canceling order ${order.oid}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        results,
      });
    } catch (error: any) {
      console.error("Error closing all positions:", error);
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to close all positions" });
    }
  });

  // Update leverage on Hyperliquid
  app.post("/api/hyperliquid/leverage", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      
      const schema = z.object({
        coin: z.string(),
        is_cross: z.boolean(),
        leverage: z.number(),
      });

      const params = schema.parse(req.body);
      const result = await hyperliquid.updateLeverage(params);

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error updating Hyperliquid leverage:", error);
      res.status(500).json({ success: false, error: "Failed to update leverage" });
    }
  });

  // Credential Management Routes
  
  // Add/update Hyperliquid API credentials for current user
  app.post("/api/credentials", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const schema = z.object({
        privateKey: z.string().min(1, "Private key is required"),
      });

      const { privateKey } = schema.parse(req.body);
      
      await storeUserCredentials(userId, privateKey);
      
      res.json({ 
        success: true, 
        message: "Credentials stored successfully" 
      });
    } catch (error: any) {
      console.error("Error storing credentials:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to store credentials" 
      });
    }
  });

  // Create multi-provider API key
  app.post("/api/api-keys", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        providerType: z.enum(["ai", "exchange"]),
        providerName: z.string(),
        label: z.string().min(1).max(50),
        apiKey: z.string().min(1),
        apiSecret: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }).refine(
        (data) => {
          // Binance and Bybit exchanges require API secret
          if (
            data.providerType === "exchange" && 
            (data.providerName === "binance" || data.providerName === "bybit") && 
            !data.apiSecret
          ) {
            return false;
          }
          return true;
        },
        {
          message: "API secret is required for Binance and Bybit exchanges",
          path: ["apiSecret"],
        }
      );

      const validated = schema.parse(req.body);

      // Encrypt the API key
      const {
        encryptedPrivateKey: encryptedApiKey,
        credentialIv: apiKeyIv,
        encryptedDek,
        dekIv
      } = encryptCredential(validated.apiKey);

      // For exchanges that need API secret, store it in metadata
      const metadata: any = validated.metadata || {};
      if (validated.apiSecret) {
        const secretEncrypted = encryptCredential(validated.apiSecret);
        metadata.encryptedSecret = secretEncrypted.encryptedPrivateKey;
        metadata.secretIv = secretEncrypted.credentialIv;
        metadata.secretDek = secretEncrypted.encryptedDek;
        metadata.secretDekIv = secretEncrypted.dekIv;
      }

      // Create the API key record
      const apiKey = await storage.createApiKey(userId, {
        providerType: validated.providerType,
        providerName: validated.providerName,
        label: validated.label,
        encryptedApiKey,
        apiKeyIv,
        encryptedDek,
        dekIv,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      res.json({ 
        success: true, 
        apiKey: {
          id: apiKey.id,
          providerType: apiKey.providerType,
          providerName: apiKey.providerName,
          label: apiKey.label,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
        }
      });
    } catch (error: any) {
      console.error("Error creating API key:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid input", 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to create API key" 
      });
    }
  });

  // Get user's API keys
  app.get("/api/api-keys", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const apiKeys = await storage.getApiKeys(userId);
      
      // Return without sensitive data
      const sanitized = apiKeys.map(key => ({
        id: key.id,
        providerType: key.providerType,
        providerName: key.providerName,
        label: key.label,
        isActive: key.isActive,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
      }));
      
      res.json({ success: true, apiKeys: sanitized });
    } catch (error: any) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch API keys" 
      });
    }
  });

  // Delete an API key
  app.delete("/api/api-keys/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      // Verify the API key belongs to the user
      const apiKey = await storage.getApiKey(userId, id);
      
      if (!apiKey) {
        return res.status(404).json({ 
          success: false, 
          error: "API key not found" 
        });
      }
      
      await storage.deleteApiKey(userId, id);
      
      res.json({ 
        success: true, 
        message: "API key deleted successfully" 
      });
    } catch (error: any) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to delete API key" 
      });
    }
  });

  // Check if user has credentials configured
  app.get("/api/credentials/status", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      // Check both old credentials and new api_keys
      const hasOldCredentials = await hasUserCredentials(userId);
      const apiKeys = await storage.getApiKeys(userId);
      const hasApiKeys = apiKeys.length > 0;
      
      res.json({ 
        success: true, 
        hasCredentials: hasOldCredentials || hasApiKeys,
      });
    } catch (error: any) {
      console.error("Error checking credential status:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to check credential status" 
      });
    }
  });

  // Delete user credentials
  app.delete("/api/credentials", isAuthenticated, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      await deleteUserCredentials(userId);
      
      res.json({ 
        success: true, 
        message: "Credentials deleted successfully" 
      });
    } catch (error: any) {
      console.error("Error deleting credentials:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to delete credentials" 
      });
    }
  });

  // CVD (Cumulative Volume Delta) endpoints
  let cvdCalculator: CVDCalculator;
  let volumeProfileCalculator: VolumeProfileCalculator;

  app.post("/api/indicators/cvd/subscribe", requireVerifiedUser, async (req, res) => {
    try {
      const schema = z.object({
        coin: z.string().min(1), // e.g., "BTC"
      });

      const { coin } = schema.parse(req.body);

      cvdCalculator.subscribeToCoin(coin);

      res.json({
        success: true,
        message: `Subscribed to CVD for ${coin}`
      });
    } catch (error: any) {
      console.error("Error subscribing to CVD:", error);
      res.status(500).json({
        success: false,
        error: "Failed to subscribe to CVD"
      });
    }
  });

  app.post("/api/indicators/cvd/unsubscribe", requireVerifiedUser, async (req, res) => {
    try {
      const schema = z.object({
        coin: z.string().min(1),
      });

      const { coin } = schema.parse(req.body);

      cvdCalculator.unsubscribeFromCoin(coin);

      res.json({
        success: true,
        message: `Unsubscribed from CVD for ${coin}`
      });
    } catch (error: any) {
      console.error("Error unsubscribing from CVD:", error);
      res.status(500).json({
        success: false,
        error: "Failed to unsubscribe from CVD"
      });
    }
  });

  app.get("/api/indicators/cvd/:coin", requireVerifiedUser, async (req, res) => {
    try {
      const { coin } = req.params;

      const snapshot = cvdCalculator.getCVDSnapshot(coin);

      res.json({
        success: true,
        cvd: snapshot
      });
    } catch (error: any) {
      console.error("Error getting CVD snapshot:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get CVD snapshot"
      });
    }
  });

  app.post("/api/indicators/cvd/:coin/reset", requireVerifiedUser, async (req, res) => {
    try {
      const { coin } = req.params;

      cvdCalculator.resetCVD(coin);

      res.json({
        success: true,
        message: `CVD reset for ${coin}`
      });
    } catch (error: any) {
      console.error("Error resetting CVD:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reset CVD"
      });
    }
  });

  // Volume Profile endpoints
  app.post("/api/indicators/volume-profile/subscribe", requireVerifiedUser, async (req, res) => {
    try {
      const schema = z.object({
        coin: z.string().min(1),
      });

      const { coin } = schema.parse(req.body);

      volumeProfileCalculator.subscribeToCoin(coin);

      res.json({
        success: true,
        message: `Subscribed to Volume Profile for ${coin}`
      });
    } catch (error: any) {
      console.error("Error subscribing to Volume Profile:", error);
      res.status(500).json({
        success: false,
        error: "Failed to subscribe to Volume Profile"
      });
    }
  });

  app.post("/api/indicators/volume-profile/unsubscribe", requireVerifiedUser, async (req, res) => {
    try {
      const schema = z.object({
        coin: z.string().min(1),
      });

      const { coin } = schema.parse(req.body);

      volumeProfileCalculator.unsubscribeFromCoin(coin);

      res.json({
        success: true,
        message: `Unsubscribed from Volume Profile for ${coin}`
      });
    } catch (error: any) {
      console.error("Error unsubscribing from Volume Profile:", error);
      res.status(500).json({
        success: false,
        error: "Failed to unsubscribe from Volume Profile"
      });
    }
  });

  app.get("/api/indicators/volume-profile/:coin", requireVerifiedUser, async (req, res) => {
    try {
      const { coin } = req.params;

      const profile = volumeProfileCalculator.getVolumeProfile(coin);

      res.json({
        success: true,
        profile
      });
    } catch (error: any) {
      console.error("Error getting Volume Profile:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get Volume Profile"
      });
    }
  });

  app.post("/api/indicators/volume-profile/:coin/reset", requireVerifiedUser, async (req, res) => {
    try {
      const { coin } = req.params;

      volumeProfileCalculator.resetProfile(coin);

      res.json({
        success: true,
        message: `Volume Profile reset for ${coin}`
      });
    } catch (error: any) {
      console.error("Error resetting Volume Profile:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reset Volume Profile"
      });
    }
  });

  // Contact Admin routes
  app.post("/api/contact", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { message, screenshotUrl } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({
          success: false,
          error: "Message is required"
        });
      }

      // Server-side validation for screenshot
      if (screenshotUrl) {
        // Validate base64 format and type
        if (typeof screenshotUrl !== "string" || !screenshotUrl.startsWith("data:image/")) {
          return res.status(400).json({
            success: false,
            error: "Invalid screenshot format"
          });
        }

        // Check size (base64 encoded, so roughly 1.33x original size)
        // Max 5MB original ≈ 6.67MB base64
        const sizeInBytes = screenshotUrl.length * 0.75; // Approximate decode size
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB
        if (sizeInBytes > maxSizeBytes) {
          return res.status(400).json({
            success: false,
            error: "Screenshot too large (max 5MB)"
          });
        }
      }

      const contactMessage = await storage.createContactMessage(userId, {
        message,
        screenshotUrl: screenshotUrl || null
      });

      res.json({
        success: true,
        message: contactMessage
      });
    } catch (error: any) {
      console.error("Error creating contact message:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send message"
      });
    }
  });

  app.get("/api/contact", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;

      // If user is admin, get all messages; otherwise get only their own
      const messages = user.role === "admin" 
        ? await storage.getContactMessages(100)
        : await storage.getUserContactMessages(user.id);

      res.json({
        success: true,
        messages
      });
    } catch (error: any) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch messages"
      });
    }
  });

  app.post("/api/contact/:id/resolve", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      if (user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Only admins can resolve messages"
        });
      }

      const { id } = req.params;
      const message = await storage.resolveContactMessage(id, user.id);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: "Message not found"
        });
      }

      res.json({
        success: true,
        message
      });
    } catch (error: any) {
      console.error("Error resolving contact message:", error);
      res.status(500).json({
        success: false,
        error: "Failed to resolve message"
      });
    }
  });

  // Trade History Import routes
  // Configure multer for CSV uploads (memory storage, max 10MB)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
        cb(null, true);
      } else {
        cb(new Error("Only CSV files are allowed"));
      }
    }
  });

  app.post("/api/trade-history/upload", requireVerifiedUser, upload.single("file"), async (req, res) => {
    try {
      const userId = getUserId(req);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded"
        });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const parsedData = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase()
      });

      if (parsedData.errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Failed to parse CSV",
          details: parsedData.errors[0]?.message
        });
      }

      const rows = parsedData.data as Record<string, string>[];
      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "CSV file is empty"
        });
      }

      // Validate required columns
      const requiredColumns = ["symbol", "side", "entrydate", "entryprice", "exitdate", "exitprice", "size", "pnl"];
      const headers = Object.keys(rows[0]);
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required columns: ${missingColumns.join(", ")}`,
          hint: `Required columns are: ${requiredColumns.join(", ")}`
        });
      }

      // Create import record
      const importRecord = await storage.createTradeHistoryImport(userId, {
        sourceType: "csv",
        fileName: req.file.originalname,
        totalRows: rows.length,
        successfulRows: 0,
        failedRows: 0,
        status: "processing",
        errors: {
          headers,
          fileSize: req.file.size,
          uploadedAt: new Date().toISOString()
        }
      });

      // Process each row and insert trades
      let successCount = 0;
      const errorsList: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const entryTimestamp = new Date(row.entrydate);
          const exitTimestamp = new Date(row.exitdate);

          if (isNaN(entryTimestamp.getTime()) || isNaN(exitTimestamp.getTime())) {
            errorsList.push({ row: i + 1, error: "Invalid date format" });
            continue;
          }

          await storage.createTradeHistoryTrade(userId, {
            importId: importRecord.id,
            symbol: row.symbol.trim(),
            side: row.side.toLowerCase() === "buy" ? "long" : "short",
            entryTimestamp,
            entryPrice: row.entryprice,
            exitTimestamp,
            exitPrice: row.exitprice,
            size: row.size,
            pnl: row.pnl,
            leverage: row.leverage ? parseInt(row.leverage) : 1,
            notes: row.notes || null
          });

          successCount++;
        } catch (error: any) {
          errorsList.push({ row: i + 1, error: error.message });
        }
      }

      // Update import record with results
      await storage.updateTradeHistoryImport(userId, importRecord.id, {
        successfulRows: successCount,
        failedRows: errorsList.length,
        status: successCount > 0 ? "completed" : "failed",
        errors: errorsList.length > 0 ? errorsList : null,
        completedAt: new Date()
      });

      // Trigger AI analysis in background if trades were successfully imported
      if (successCount > 0) {
        const { analyzeTradeHistory } = await import("./tradeHistoryAnalysisService");
        analyzeTradeHistory(userId, importRecord.id).catch(err => {
          console.error(`Failed to analyze import ${importRecord.id}:`, err);
        });
      }

      res.json({
        success: true,
        importId: importRecord.id,
        totalRows: rows.length,
        successfulRows: successCount,
        errors: errorsList.length > 0 ? errorsList.slice(0, 10) : undefined
      });
    } catch (error: any) {
      console.error("Error uploading trade history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to upload trade history",
        details: error.message
      });
    }
  });

  app.get("/api/trade-history/imports", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const imports = await storage.getTradeHistoryImports(userId);

      res.json({
        success: true,
        imports
      });
    } catch (error: any) {
      console.error("Error fetching trade history imports:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch imports"
      });
    }
  });

  app.get("/api/trade-history/imports/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const importRecord = await storage.getTradeHistoryImport(userId, id);
      if (!importRecord) {
        return res.status(404).json({
          success: false,
          error: "Import not found"
        });
      }

      const trades = await storage.getTradeHistoryTrades(userId, id);

      res.json({
        success: true,
        import: importRecord,
        trades
      });
    } catch (error: any) {
      console.error("Error fetching import details:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch import details"
      });
    }
  });

  app.delete("/api/trade-history/imports/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const importRecord = await storage.getTradeHistoryImport(userId, id);
      if (!importRecord) {
        return res.status(404).json({
          success: false,
          error: "Import not found"
        });
      }

      await storage.deleteTradeHistoryTradesByImportId(userId, id);
      await storage.deleteTradeHistoryImport(userId, id);

      res.json({
        success: true,
        message: "Import deleted successfully"
      });
    } catch (error: any) {
      console.error("Error deleting import:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete import"
      });
    }
  });

  app.get("/api/trade-history/style-profiles", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const profiles = await storage.getTradeStyleProfiles(userId);

      res.json({
        success: true,
        profiles
      });
    } catch (error: any) {
      console.error("Error fetching style profiles:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch style profiles"
      });
    }
  });

  // Trade Journal routes
  app.get("/api/trade-journal", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { status, symbol, limit } = req.query;

      const filters: { status?: string; symbol?: string; limit?: number } = {};
      if (status && typeof status === "string") filters.status = status;
      if (symbol && typeof symbol === "string") filters.symbol = symbol;
      if (limit && typeof limit === "string") filters.limit = parseInt(limit);

      const entries = await storage.getTradeJournalEntries(userId, filters);

      res.json({
        success: true,
        entries
      });
    } catch (error: any) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch journal entries"
      });
    }
  });

  app.get("/api/trade-journal/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const entry = await storage.getTradeJournalEntry(userId, id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: "Journal entry not found"
        });
      }

      res.json({
        success: true,
        entry
      });
    } catch (error: any) {
      console.error("Error fetching journal entry:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch journal entry"
      });
    }
  });

  app.post("/api/trade-journal", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entryData = req.body;

      const entry = await storage.createTradeJournalEntry(userId, entryData);

      res.json({
        success: true,
        entry
      });
    } catch (error: any) {
      console.error("Error creating journal entry:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create journal entry",
        details: error.message
      });
    }
  });

  app.patch("/api/trade-journal/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const updates = req.body;

      const entry = await storage.updateTradeJournalEntry(userId, id, updates);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: "Journal entry not found"
        });
      }

      res.json({
        success: true,
        entry
      });
    } catch (error: any) {
      console.error("Error updating journal entry:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update journal entry"
      });
    }
  });

  app.post("/api/trade-journal/:id/activate", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { actualEntryPrice } = req.body;

      if (!actualEntryPrice) {
        return res.status(400).json({
          success: false,
          error: "Actual entry price is required"
        });
      }

      const entry = await storage.activateTradeJournalEntry(userId, id, actualEntryPrice);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: "Journal entry not found"
        });
      }

      res.json({
        success: true,
        entry
      });
    } catch (error: any) {
      console.error("Error activating journal entry:", error);
      res.status(500).json({
        success: false,
        error: "Failed to activate journal entry"
      });
    }
  });

  app.post("/api/trade-journal/:id/close", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const closeData = req.body;

      const requiredFields = ["closePrice", "closePnl", "closePnlPercent", "closeReasoning", "hitTarget", "hadAdjustments"];
      const missingFields = requiredFields.filter(field => !(field in closeData));
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`
        });
      }

      const entry = await storage.closeTradeJournalEntry(userId, id, closeData);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: "Journal entry not found"
        });
      }

      res.json({
        success: true,
        entry
      });
    } catch (error: any) {
      console.error("Error closing journal entry:", error);
      res.status(500).json({
        success: false,
        error: "Failed to close journal entry"
      });
    }
  });

  app.delete("/api/trade-journal/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const entry = await storage.getTradeJournalEntry(userId, id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: "Journal entry not found"
        });
      }

      await storage.deleteTradeJournalEntry(userId, id);

      res.json({
        success: true,
        message: "Journal entry deleted successfully"
      });
    } catch (error: any) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete journal entry"
      });
    }
  });

  // Testing endpoints for evaluation and aggregation (admin only)
  app.post("/api/admin/trigger-aggregation", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { runDailyAggregation } = await import("./aggregationService");
      
      await runDailyAggregation(userId);
      
      res.json({
        success: true,
        message: "Aggregation completed successfully"
      });
    } catch (error: any) {
      console.error("Error triggering aggregation:", error);
      res.status(500).json({
        success: false,
        error: "Failed to run aggregation"
      });
    }
  });

  app.post("/api/admin/test-evaluation/:tradeId", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { tradeId } = req.params;
      const { evaluateCompletedTrade } = await import("./evaluationService");
      
      await evaluateCompletedTrade(userId, tradeId);
      
      res.json({
        success: true,
        message: "Trade evaluation completed successfully"
      });
    } catch (error: any) {
      console.error("Error evaluating trade:", error);
      res.status(500).json({
        success: false,
        error: "Failed to evaluate trade"
      });
    }
  });

  app.get("/api/learnings", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { getRecentLearnings } = await import("./evaluationService");
      
      const learnings = await getRecentLearnings(userId, undefined, 20);
      
      res.json({
        success: true,
        learnings
      });
    } catch (error: any) {
      console.error("Error fetching learnings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch learnings"
      });
    }
  });

  // Trading Modes API Routes
  app.get("/api/trading-modes", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const modes = await storage.getTradingModes(userId);
      
      res.json({
        success: true,
        modes
      });
    } catch (error: any) {
      console.error("Error fetching trading modes:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch trading modes"
      });
    }
  });

  app.get("/api/trading-modes/active", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const activeMode = await storage.getActiveTradingMode(userId);
      
      res.json({
        success: true,
        mode: activeMode || null
      });
    } catch (error: any) {
      console.error("Error fetching active trading mode:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch active trading mode"
      });
    }
  });

  app.post("/api/trading-modes", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { name, type, description, parameters } = req.body;
      
      if (!name || !type) {
        return res.status(400).json({
          success: false,
          error: "name and type are required"
        });
      }
      
      const mode = await storage.createTradingMode(userId, {
        name,
        type,
        description: description || null,
        parameters: parameters || {},
        isActive: 0
      });
      
      res.json({
        success: true,
        mode
      });
    } catch (error: any) {
      console.error("Error creating trading mode:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create trading mode"
      });
    }
  });

  app.put("/api/trading-modes/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { name, type, description, parameters } = req.body;
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (description !== undefined) updates.description = description;
      if (parameters !== undefined) updates.parameters = parameters;
      
      const mode = await storage.updateTradingMode(userId, id, updates);
      
      if (!mode) {
        return res.status(404).json({
          success: false,
          error: "Trading mode not found"
        });
      }
      
      res.json({
        success: true,
        mode
      });
    } catch (error: any) {
      console.error("Error updating trading mode:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update trading mode"
      });
    }
  });

  app.post("/api/trading-modes/:id/activate", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      const mode = await storage.setActiveTradingMode(userId, id);
      
      if (!mode) {
        return res.status(404).json({
          success: false,
          error: "Trading mode not found"
        });
      }
      
      res.json({
        success: true,
        mode
      });
    } catch (error: any) {
      console.error("Error activating trading mode:", error);
      res.status(500).json({
        success: false,
        error: "Failed to activate trading mode"
      });
    }
  });

  app.delete("/api/trading-modes/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      await storage.deleteTradingMode(userId, id);
      
      res.json({
        success: true
      });
    } catch (error: any) {
      console.error("Error deleting trading mode:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete trading mode"
      });
    }
  });

  const httpServer = createServer(app);

  // Initialize market data WebSocket service
  initializeMarketDataWebSocket(httpServer);

  // Initialize CVD calculator
  // In Replit, connect to localhost since everything runs on the same server
  const marketDataWsUrl = "ws://localhost:5000/market-data";
  cvdCalculator = new CVDCalculator(marketDataWsUrl);
  console.log(`[CVD Calculator] Initialized with market data URL: ${marketDataWsUrl}`);

  // Initialize Volume Profile calculator
  // Use 1.0 tick size for better price level granularity
  volumeProfileCalculator = new VolumeProfileCalculator(marketDataWsUrl, 1.0);
  console.log(`[Volume Profile] Initialized with market data URL: ${marketDataWsUrl}, tick size: 1.0`);

  return httpServer;
}
