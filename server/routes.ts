import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processTradingPrompt } from "./tradingAgent";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // AI Trading Prompt endpoint
  app.post("/api/trading/prompt", async (req, res) => {
    try {
      const schema = z.object({
        prompt: z.string().min(1),
        marketData: z.array(z.object({
          symbol: z.string(),
          price: z.string(),
          change24h: z.string(),
          volume24h: z.string(),
        })),
        currentPositions: z.array(z.any()).optional(),
      });

      const { prompt, marketData, currentPositions = [] } = schema.parse(req.body);

      const strategy = await processTradingPrompt(prompt, marketData, currentPositions);
      
      res.json({ success: true, strategy });
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

  const httpServer = createServer(app);

  return httpServer;
}
