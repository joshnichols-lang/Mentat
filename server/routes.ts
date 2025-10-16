import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processTradingPrompt } from "./tradingAgent";
import { initHyperliquidClient } from "./hyperliquid/client";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { restartMonitoring } from "./monitoringService";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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

  const httpServer = createServer(app);

  return httpServer;
}
