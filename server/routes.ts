import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processTradingPrompt } from "./tradingAgent";
import { initHyperliquidClient } from "./hyperliquid/client";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { restartMonitoring } from "./monitoringService";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storeUserCredentials, getUserPrivateKey, deleteUserCredentials, hasUserCredentials } from "./credentialService";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Replit Auth
  await setupAuth(app);

  // Auth status endpoint - returns current user info
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const claims = user.claims;
      
      // Get user from database
      const dbUser = await storage.getUser(claims.sub);
      
      res.json({
        success: true,
        user: {
          id: claims.sub,
          email: claims.email,
          firstName: claims.first_name,
          lastName: claims.last_name,
          profileImageUrl: claims.profile_image_url,
          subscriptionStatus: dbUser?.subscriptionStatus || "inactive",
          onboardingComplete: dbUser?.onboardingComplete === 1,
        }
      });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // AI Trading Prompt endpoint
  app.post("/api/trading/prompt", async (req, res) => {
    try {
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
        model: z.enum(["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro"]).optional().default("sonar"),
      });

      const { prompt, marketData, currentPositions = [], autoExecute = true, model = "sonar" } = schema.parse(req.body);

      const strategy = await processTradingPrompt(prompt, marketData, currentPositions, model);
      
      let executionSummary = null;
      
      // Automatically execute trades if enabled
      if (autoExecute && strategy.actions && strategy.actions.length > 0) {
        try {
          executionSummary = await executeTradeStrategy(strategy.actions);
          console.log(`Executed ${executionSummary.successfulExecutions}/${executionSummary.totalActions} trades successfully`);
          
          // Create portfolio snapshot after successful trade execution
          if (executionSummary.successfulExecutions > 0) {
            const hyperliquid = initHyperliquidClient();
            createPortfolioSnapshot(hyperliquid).catch(err => 
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
        execution: executionSummary 
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

  // Get all trades
  app.get("/api/trades", async (_req, res) => {
    try {
      const trades = await storage.getTrades();
      res.json({ success: true, trades });
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ success: false, error: "Failed to fetch trades" });
    }
  });

  // Get all positions
  app.get("/api/positions", async (_req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json({ success: true, positions });
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({ success: false, error: "Failed to fetch positions" });
    }
  });

  // Get portfolio snapshots
  app.get("/api/portfolio/snapshots", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const snapshots = await storage.getPortfolioSnapshots(limit);
      res.json({ success: true, snapshots });
    } catch (error) {
      console.error("Error fetching portfolio snapshots:", error);
      res.status(500).json({ success: false, error: "Failed to fetch snapshots" });
    }
  });

  // Create a new trade
  app.post("/api/trades", async (req, res) => {
    try {
      const trade = await storage.createTrade(req.body);
      res.json({ success: true, trade });
    } catch (error) {
      console.error("Error creating trade:", error);
      res.status(500).json({ success: false, error: "Failed to create trade" });
    }
  });

  // Close a trade
  app.post("/api/trades/:id/close", async (req, res) => {
    try {
      const { exitPrice, pnl } = req.body;
      const trade = await storage.closeTrade(req.params.id, exitPrice, pnl);
      res.json({ success: true, trade });
    } catch (error) {
      console.error("Error closing trade:", error);
      res.status(500).json({ success: false, error: "Failed to close trade" });
    }
  });

  // Create or update position
  app.post("/api/positions", async (req, res) => {
    try {
      const position = await storage.createPosition(req.body);
      res.json({ success: true, position });
    } catch (error) {
      console.error("Error creating position:", error);
      res.status(500).json({ success: false, error: "Failed to create position" });
    }
  });

  // Update position
  app.patch("/api/positions/:id", async (req, res) => {
    try {
      const position = await storage.updatePosition(req.params.id, req.body);
      res.json({ success: true, position });
    } catch (error) {
      console.error("Error updating position:", error);
      res.status(500).json({ success: false, error: "Failed to update position" });
    }
  });

  // Create portfolio snapshot
  app.post("/api/portfolio/snapshots", async (req, res) => {
    try {
      const snapshot = await storage.createPortfolioSnapshot(req.body);
      res.json({ success: true, snapshot });
    } catch (error) {
      console.error("Error creating snapshot:", error);
      res.status(500).json({ success: false, error: "Failed to create snapshot" });
    }
  });

  // Get AI usage logs
  app.get("/api/ai/usage", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getAiUsageLogs(limit);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error fetching AI usage logs:", error);
      res.status(500).json({ success: false, error: "Failed to fetch AI usage logs" });
    }
  });

  // Get total AI cost
  app.get("/api/ai/cost", async (_req, res) => {
    try {
      const totalCost = await storage.getTotalAiCost();
      res.json({ success: true, totalCost });
    } catch (error) {
      console.error("Error fetching AI cost:", error);
      res.status(500).json({ success: false, error: "Failed to fetch AI cost" });
    }
  });

  // Get AI usage statistics (cumulative totals)
  app.get("/api/ai/stats", async (_req, res) => {
    try {
      const stats = await storage.getAiUsageStats();
      res.json({ success: true, stats });
    } catch (error) {
      console.error("Error fetching AI stats:", error);
      res.status(500).json({ success: false, error: "Failed to fetch AI stats" });
    }
  });

  // Get monitoring logs
  app.get("/api/monitoring/logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getMonitoringLogs(limit);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error fetching monitoring logs:", error);
      res.status(500).json({ success: false, error: "Failed to fetch monitoring logs" });
    }
  });

  // Get active monitoring alerts
  app.get("/api/monitoring/active", async (_req, res) => {
    try {
      const logs = await storage.getActiveMonitoringLogs();
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error fetching active monitoring alerts:", error);
      res.status(500).json({ success: false, error: "Failed to fetch active alerts" });
    }
  });

  // Dismiss monitoring alert
  app.post("/api/monitoring/:id/dismiss", async (req, res) => {
    try {
      const log = await storage.dismissMonitoringLog(req.params.id);
      res.json({ success: true, log });
    } catch (error) {
      console.error("Error dismissing monitoring alert:", error);
      res.status(500).json({ success: false, error: "Failed to dismiss alert" });
    }
  });

  // Update monitoring frequency
  app.post("/api/monitoring/frequency", async (req, res) => {
    try {
      const schema = z.object({
        minutes: z.number().int().min(0).max(1440), // 0 to 24 hours
      });

      const { minutes } = schema.parse(req.body);
      
      // Restart monitoring with new interval
      restartMonitoring(minutes);
      
      res.json({ 
        success: true, 
        message: minutes === 0 
          ? "Monitoring disabled" 
          : `Monitoring frequency updated to ${minutes} minutes` 
      });
    } catch (error) {
      console.error("Error updating monitoring frequency:", error);
      res.status(500).json({ success: false, error: "Failed to update monitoring frequency" });
    }
  });

  // Initialize Hyperliquid client
  const hyperliquid = initHyperliquidClient();

  // Get Hyperliquid market data
  app.get("/api/hyperliquid/market-data", async (_req, res) => {
    try {
      const marketData = await hyperliquid.getMarketData();
      res.json({ success: true, marketData });
    } catch (error) {
      console.error("Error fetching Hyperliquid market data:", error);
      res.status(500).json({ success: false, error: "Failed to fetch market data" });
    }
  });

  // Get Hyperliquid user state
  app.get("/api/hyperliquid/user-state", async (req, res) => {
    try {
      const address = req.query.address as string | undefined;
      const userState = await hyperliquid.getUserState(address);
      res.json({ success: true, userState });
    } catch (error) {
      console.error("Error fetching Hyperliquid user state:", error);
      res.status(500).json({ success: false, error: "Failed to fetch user state" });
    }
  });

  // Get Hyperliquid positions
  app.get("/api/hyperliquid/positions", async (req, res) => {
    try {
      const address = req.query.address as string | undefined;
      const positions = await hyperliquid.getPositions(address);
      res.json({ success: true, positions });
    } catch (error) {
      console.error("Error fetching Hyperliquid positions:", error);
      res.status(500).json({ success: false, error: "Failed to fetch positions" });
    }
  });

  // Get Hyperliquid open orders
  app.get("/api/hyperliquid/open-orders", async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Error fetching Hyperliquid open orders:", error);
      res.status(500).json({ success: false, error: "Failed to fetch open orders" });
    }
  });

  // Place order on Hyperliquid
  app.post("/api/hyperliquid/order", async (req, res) => {
    try {
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
  app.post("/api/hyperliquid/cancel-order", async (req, res) => {
    try {
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
      res.status(500).json({ success: false, error: "Failed to cancel order" });
    }
  });

  // Close position on Hyperliquid
  app.post("/api/hyperliquid/close-position", async (req, res) => {
    try {
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
  app.post("/api/hyperliquid/close-all", async (req, res) => {
    try {
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
      res.status(500).json({ success: false, error: "Failed to close all positions" });
    }
  });

  // Update leverage on Hyperliquid
  app.post("/api/hyperliquid/leverage", async (req, res) => {
    try {
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
      const user = req.user as any;
      const userId = user.claims.sub;
      
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

  // Check if user has credentials configured
  app.get("/api/credentials/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.claims.sub;
      
      const hasCredentials = await hasUserCredentials(userId);
      
      res.json({ 
        success: true, 
        hasCredentials,
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
      const user = req.user as any;
      const userId = user.claims.sub;
      
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

  const httpServer = createServer(app);

  return httpServer;
}
