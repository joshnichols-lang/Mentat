import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processTradingPrompt } from "./tradingAgent";
import { initHyperliquidClient, getHyperliquidClient, getUserHyperliquidClient } from "./hyperliquid/client";
import { PolymarketClient } from "./polymarket/client";
import { executeTradeStrategy } from "./tradeExecutor";
import { createPortfolioSnapshot } from "./portfolioSnapshotService";
import { restartMonitoring, getAiUsageStats } from "./monitoringService";
import { startUserMonitoring, stopUserMonitoring, restartUserMonitoring } from "./userMonitoringManager";
import { setupAuth } from "./auth";
import { storeUserCredentials, getUserPrivateKey, deleteUserCredentials, hasUserCredentials } from "./credentialService";
import { initializeMarketDataWebSocket } from "./marketDataWebSocket";
import { encryptCredential, decryptCredential } from "./encryption";
import { getUserOrderlyClient, hasOrderlyCredentials, storeOrderlyCredentials, deleteOrderlyCredentials } from "./orderly/helpers";
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
// Note: All users are now auto-approved on creation, so this just checks authentication
function requireVerifiedUser(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
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
  // Health check endpoint for deployment monitoring
  // Must respond quickly without database calls
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

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
        strategyId: z.string().nullable().optional(), // Optional strategy ID - null for "general" mode
      });

      const { prompt, marketData, currentPositions = [], autoExecute = true, model, preferredProvider, screenshots, strategyId = null } = schema.parse(req.body);

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

      // Check if user has Hyperliquid credentials before fetching account state
      const { getUserHyperliquidCredentials } = await import("./credentialService");
      const hasCredentials = !!(await getUserHyperliquidCredentials(userId));
      
      let userState = null;
      let openOrders = [];
      
      if (hasCredentials) {
        // Fetch user account state only if credentials exist
        const hyperliquid = await getUserHyperliquidClient(userId);
        userState = await hyperliquid.getUserState();
        openOrders = await hyperliquid.getOpenOrders();
        console.log("[Trading Prompt] User state:", JSON.stringify(userState, null, 2));
      } else {
        console.log("[Trading Prompt] No Hyperliquid credentials found - AI will work in conversation-only mode");
      }

      const strategy = await processTradingPrompt(userId, prompt, marketData, currentPositions, userState, openOrders, model, preferredProvider, screenshots, strategyId);
      
      let executionSummary = null;
      
      // Get user's agent mode to determine if trades should be executed
      const user = await storage.getUser(userId);
      const isActiveMode = user?.agentMode === "active";
      
      // Only execute trades if in active mode AND autoExecute is enabled AND user has credentials
      if (isActiveMode && autoExecute && strategy.actions && strategy.actions.length > 0 && hasCredentials) {
        try {
          executionSummary = await executeTradeStrategy(userId, strategy.actions, strategyId || null);
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

  // AI Portfolio Analysis endpoint - analyzes entire portfolio across all exchanges
  app.post("/api/ai/analyze-portfolio", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        model: z.string().optional(),
        preferredProvider: z.enum(["perplexity", "openai", "xai"]).optional(),
      });
      
      const { model, preferredProvider } = schema.parse(req.body);
      
      // Import portfolio aggregator
      const { getUnifiedPortfolio, formatPortfolioForAI } = await import("./portfolioAggregator");
      const { makeAIRequest } = await import("./aiRouter");
      
      // Fetch unified portfolio across all exchanges
      console.log("[Portfolio Analysis] Fetching unified portfolio for user:", userId);
      const portfolio = await getUnifiedPortfolio(userId);
      
      // Format portfolio for AI context
      const portfolioContext = formatPortfolioForAI(portfolio);
      
      // Build AI prompt for multi-instrument analysis
      const systemPrompt = `You are an expert multi-instrument portfolio analyst specializing in cryptocurrency trading across perpetual futures, options, and prediction markets. Analyze the user's portfolio and provide comprehensive insights.

CRITICAL ANALYSIS AREAS:
1. **Delta Exposure**: Calculate total portfolio delta across perpetuals and options. Identify concentration risks.
2. **Correlation Analysis**: Identify correlated positions (e.g., long ETH perp + long ETH call = doubled exposure).
3. **Hedging Opportunities**: Suggest specific hedges using:
   - Options to protect perp positions
   - Opposite perps on correlated assets
   - Prediction market bets that counter-balance exposure
4. **Greek Risk** (if options present): Analyze theta decay, vega exposure to volatility changes.
5. **Risk Warnings**: Flag over-concentration, unhedged directional bets, liquidation risks.
6. **Cross-Platform Arbitrage**: Identify opportunities where prediction market prices diverge from perp funding rates.

${portfolioContext}

Provide a clear, actionable analysis with specific recommendations. Format your response as:

**Portfolio Summary**
[Brief overview of total exposure and key metrics]

**Risk Assessment**
[Major risks identified - concentration, correlation, Greeks, liquidation]

**Hedging Recommendations**
[Specific trades to reduce risk - be precise with strikes, sizes, platforms]

**Opportunities**
[Arbitrage or optimization strategies across instruments]

**Action Items**
[Prioritized list of what the user should do next]`;

      const userMessage = "Analyze my complete portfolio across all instruments and provide risk assessment with hedging recommendations.";
      
      // Call AI with portfolio context
      const aiResponse = await makeAIRequest(userId, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model,
        temperature: 0.7,
        max_tokens: 2500,
      }, preferredProvider);
      
      // Save portfolio analysis to history
      const savedAnalysis = await storage.createPortfolioAnalysis(userId, {
        analysis: aiResponse.content,
        portfolioSnapshot: portfolio as any,
        userId,
      });
      
      res.json({
        success: true,
        analysis: aiResponse.content,
        analysisId: savedAnalysis.id,
        portfolio: {
          summary: portfolio.summary,
          positionCounts: {
            perpetuals: portfolio.perpetuals.length,
            options: portfolio.options.length,
            predictions: portfolio.predictions.length,
          },
          lastUpdated: portfolio.lastUpdated,
        },
        usage: {
          promptTokens: aiResponse.usage.promptTokens,
          completionTokens: aiResponse.usage.completionTokens,
          totalTokens: aiResponse.usage.totalTokens,
          cost: aiResponse.cost,
          provider: aiResponse.provider,
          model: aiResponse.model,
        },
      });
    } catch (error: any) {
      console.error("Error analyzing portfolio:", error);
      
      // Handle AI errors
      if (error?.status === 400 && error?.code === 'content_filter') {
        return res.status(400).json({
          success: false,
          error: "Content filtered by AI provider",
          code: "content_filter",
        });
      }
      
      if (error?.status === 429) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please wait a moment and try again.",
          code: "rate_limit",
        });
      }
      
      // Generic error
      res.status(500).json({
        success: false,
        error: error.message || "Failed to analyze portfolio",
      });
    }
  });

  // Get portfolio analysis history
  app.get("/api/ai/portfolio-analyses", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const analyses = await storage.getPortfolioAnalyses(userId, limit);
      
      res.json({
        success: true,
        analyses: analyses.map(a => ({
          id: a.id,
          createdAt: a.createdAt,
          preview: a.analysis.substring(0, 150) + (a.analysis.length > 150 ? '...' : ''),
        })),
      });
    } catch (error: any) {
      console.error("Error fetching portfolio analyses:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch portfolio analyses",
      });
    }
  });

  // Get a specific portfolio analysis
  app.get("/api/ai/portfolio-analyses/:id", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      const analysis = await storage.getPortfolioAnalysis(userId, id);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: "Analysis not found",
        });
      }
      
      res.json({
        success: true,
        analysis: analysis.analysis,
        portfolioSnapshot: analysis.portfolioSnapshot,
        createdAt: analysis.createdAt,
      });
    } catch (error: any) {
      console.error("Error fetching portfolio analysis:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch portfolio analysis",
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
      
      // Active mode: Start automatic monitoring
      // Passive mode: Stop automatic monitoring (AI only responds to manual prompts)
      const intervalMinutes = updatedUser.monitoringFrequencyMinutes || 0;
      
      if (mode === "active") {
        // Get user's monitoring frequency (default to 5 minutes if 0 or null)
        // Note: 0 means "disabled" so we use default 5 minutes when activating
        let activeIntervalMinutes = intervalMinutes || 5;
        if (activeIntervalMinutes === 0) {
          activeIntervalMinutes = 5;
          // Update user's frequency to 5 minutes (remove the "disabled" setting)
          await storage.updateUserMonitoringFrequency(userId, 5);
        }
        
        try {
          await startUserMonitoring(userId, activeIntervalMinutes);
          console.log(`[Agent Mode] Started ACTIVE monitoring for user ${userId} (${activeIntervalMinutes} min interval)`);
        } catch (monitoringError: any) {
          console.error(`[Agent Mode] Failed to start monitoring for user ${userId}:`, monitoringError);
          // Return error if monitoring can't start (e.g., missing credentials)
          return res.status(400).json({ 
            success: false, 
            error: monitoringError.message || "Failed to start autonomous trading. Please ensure your credentials are configured." 
          });
        }
      } else {
        // In passive mode, stop all automatic monitoring to save API costs
        // AI will only analyze when user sends manual prompts
        await stopUserMonitoring(userId);
        console.log(`[Agent Mode] Stopped automatic monitoring for user ${userId} - passive mode (manual prompts only)`);
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

  // Update AI cost control settings (max calls per hour)
  app.patch("/api/user/ai-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        maxAiCallsPerHour: z.number().int().min(0).max(1000).nullable(),
      });
      
      const { maxAiCallsPerHour } = schema.parse(req.body);
      
      const updatedUser = await storage.updateUserAiSettings(userId, maxAiCallsPerHour);
      
      if (!updatedUser) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      
      console.log(`[AI Settings] Updated max AI calls per hour for user ${userId}: ${maxAiCallsPerHour === null ? 'unlimited' : maxAiCallsPerHour}`);
      
      res.json({ 
        success: true, 
        maxAiCallsPerHour: updatedUser.maxAiCallsPerHour 
      });
    } catch (error: any) {
      console.error("Error updating AI settings:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: "Failed to update AI settings" 
      });
    }
  });

  // Get AI usage statistics
  app.get("/api/user/ai-usage", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Get user to check their limit
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      
      // Get current usage stats from monitoring service
      const usageStats = getAiUsageStats(userId, user.maxAiCallsPerHour);
      
      res.json({ 
        success: true, 
        usage: usageStats
      });
    } catch (error: any) {
      console.error("Error getting AI usage:", error);
      
      res.status(500).json({ 
        success: false, 
        error: "Failed to get AI usage statistics" 
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

  // Update user wallet address
  app.patch("/api/user/wallet-address", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        walletAddress: z.string()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address"),
      });
      
      const { walletAddress } = schema.parse(req.body);
      
      await storage.updateUserWalletAddress(userId, walletAddress);
      
      res.json({ 
        success: true, 
        message: "Wallet address updated successfully" 
      });
    } catch (error: any) {
      console.error("Error updating wallet address:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: "Failed to update wallet address" 
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
      
      // Support optional strategyId filtering for strategy-scoped conversations
      // If strategyId="null", filter for logs with no strategy (general conversations)
      // If strategyId is provided, filter for that specific strategy
      // If strategyId is not provided, return all logs (no filtering)
      let strategyIdFilter: string | null | undefined = undefined;
      if (req.query.strategyId !== undefined) {
        strategyIdFilter = req.query.strategyId === "null" ? null : req.query.strategyId as string;
      }
      
      const logs = await storage.getAiUsageLogs(userId, limit, strategyIdFilter);
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

  // Hyperliquid API Routes - Some require authentication, some are public
  
  // Get asset metadata for a specific symbol (max leverage, tick size, etc.) - public endpoint
  app.get("/api/hyperliquid/asset-metadata", async (req, res) => {
    try {
      const symbol = req.query.symbol as string;
      
      if (!symbol) {
        return res.status(400).json({ success: false, error: "Symbol parameter is required" });
      }
      
      // Asset metadata is public - use singleton client for info-only API access
      let hyperliquid = getHyperliquidClient();
      
      // If singleton not initialized, initialize it
      if (!hyperliquid) {
        hyperliquid = await initHyperliquidClient();
      }
      
      const metadata = await hyperliquid.getAssetMetadata(symbol);
      
      if (!metadata) {
        return res.status(404).json({ success: false, error: `Asset metadata not found for ${symbol}` });
      }
      
      res.json({ success: true, metadata });
    } catch (error: any) {
      console.error("Error fetching asset metadata:", error);
      res.status(500).json({ success: false, error: "Failed to fetch asset metadata" });
    }
  });
  
  // Get Hyperliquid market data (public endpoint - no auth required)
  app.get("/api/hyperliquid/market-data", async (req, res) => {
    try {
      // Market data is public - use singleton client for info-only API access
      let hyperliquid = getHyperliquidClient();
      
      // If singleton not initialized, initialize it
      if (!hyperliquid) {
        hyperliquid = await initHyperliquidClient();
      }
      
      const marketData = await hyperliquid.getMarketData();
      res.json({ success: true, marketData });
    } catch (error: any) {
      console.error("Error fetching Hyperliquid market data:", error);
      res.status(500).json({ success: false, error: "Failed to fetch market data" });
    }
  });

  // Get all Hyperliquid markets (public endpoint - no auth required)
  app.get("/api/hyperliquid/markets", async (req, res) => {
    try {
      let hyperliquid = getHyperliquidClient();
      if (!hyperliquid) {
        hyperliquid = await initHyperliquidClient();
      }
      
      const markets = await hyperliquid.getMarkets();
      res.json({ success: true, markets });
    } catch (error: any) {
      console.error("Error fetching Hyperliquid markets:", error);
      res.status(500).json({ success: false, error: "Failed to fetch markets" });
    }
  });

  // Get historical candle data (public endpoint - no auth required)
  app.get("/api/hyperliquid/candles", async (req, res) => {
    try {
      const { symbol, interval, limit } = req.query;
      
      if (!symbol || !interval) {
        return res.status(400).json({ 
          success: false, 
          error: "Symbol and interval parameters are required" 
        });
      }

      let hyperliquid = getHyperliquidClient();
      if (!hyperliquid) {
        hyperliquid = await initHyperliquidClient();
      }

      // Strip suffix from symbol (BTC-USD -> BTC, ETH-PERP -> ETH)
      const coin = (symbol as string).replace(/-USD$|-PERP$|-SPOT$/, '');
      
      // Calculate time range - fetch last N candles
      const numCandles = parseInt(limit as string) || 1000;
      const endTime = Date.now();
      
      // Calculate approximate start time based on interval
      const intervalMs: { [key: string]: number } = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1D': 24 * 60 * 60 * 1000,
      };
      
      const intervalDuration = intervalMs[interval as string] || intervalMs['1h'];
      const startTime = endTime - (numCandles * intervalDuration);

      const candles = await hyperliquid.getCandleSnapshot({
        coin,
        interval: interval as string,
        startTime,
        endTime,
      });

      res.json({ success: true, candles });
    } catch (error: any) {
      console.error("Error fetching Hyperliquid candles:", error);
      res.status(500).json({ success: false, error: "Failed to fetch candles" });
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

  // Modify order on Hyperliquid (cancel + replace)
  app.post("/api/hyperliquid/modify-order", requireVerifiedUser, async (req, res) => {
    try {
      
      const userId = getUserId(req);
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      
      const schema = z.object({
        coin: z.string(),
        oid: z.number(),
        side: z.string(),
        reduceOnly: z.boolean(),
        newLimitPx: z.string().optional(),
        newSz: z.string().optional(),
        orderType: z.string().optional(),
        triggerPx: z.string().optional(),
        tpsl: z.string().optional().nullable(),
      });

      const params = schema.parse(req.body);
      
      // Get current order details to preserve unchanged values
      const orders = await hyperliquid.getOpenOrders();
      const currentOrder = orders.find((o: any) => o.oid === params.oid);
      
      if (!currentOrder) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        });
      }

      // Cancel existing order
      const cancelResult = await hyperliquid.cancelOrder({
        coin: params.coin,
        oid: params.oid,
      });

      if (!cancelResult.success) {
        return res.status(400).json({
          success: false,
          error: `Failed to cancel order: ${cancelResult.error}`,
        });
      }

      // Place new order with modified parameters
      const isBuy = params.side.toLowerCase() === "buy";
      const newLimitPx = params.newLimitPx ? parseFloat(params.newLimitPx) : parseFloat(currentOrder.limitPx);
      const newSz = params.newSz ? parseFloat(params.newSz) : parseFloat(currentOrder.sz);

      // Determine if this is a trigger order (stop loss or take profit)
      const isTriggerOrder = params.tpsl || params.triggerPx;

      let newOrder: any;

      if (isTriggerOrder) {
        // Re-create trigger order
        const triggerPx = params.triggerPx || currentOrder.triggerPx;
        
        newOrder = {
          coin: params.coin,
          is_buy: isBuy,
          sz: newSz,
          limit_px: newLimitPx,
          order_type: {
            trigger: {
              triggerPx: triggerPx,
              isMarket: !params.newLimitPx,
              tpsl: params.tpsl || "tp",
            },
          },
          reduce_only: params.reduceOnly,
        };
      } else {
        // Re-create regular limit order
        newOrder = {
          coin: params.coin,
          is_buy: isBuy,
          sz: newSz,
          limit_px: newLimitPx,
          order_type: {
            limit: {
              tif: "Gtc" as const,
            },
          },
          reduce_only: params.reduceOnly,
        };
      }

      const placeResult = await hyperliquid.placeOrder(newOrder);

      if (placeResult.success) {
        res.json({
          success: true,
          message: "Order modified successfully",
          response: placeResult.response,
        });
      } else {
        // Order was cancelled but replacement failed
        res.status(400).json({
          success: false,
          error: `Order cancelled but replacement failed: ${placeResult.error}`,
          orderCancelled: true,
        });
      }
    } catch (error: any) {
      console.error("Error modifying Hyperliquid order:", error);
      if (error.message?.includes('No Hyperliquid credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Hyperliquid API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to modify order" });
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

  // Orderly Network DEX API Routes - All require authentication
  
  // Store Orderly API credentials
  app.post("/api/orderly/credentials", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        orderlyApiKey: z.string().min(1, "Orderly API key is required"),
        orderlyApiSecret: z.string().min(1, "Orderly API secret is required"),
        accountId: z.string().min(1, "Account ID (Ethereum address) is required"),
        testnet: z.boolean().optional().default(false),
        label: z.string().optional().default("Main Account"),
      });

      const { orderlyApiKey, orderlyApiSecret, accountId, testnet, label } = schema.parse(req.body);
      
      await storeOrderlyCredentials(userId, orderlyApiKey, orderlyApiSecret, accountId, testnet, label);
      
      res.json({ 
        success: true, 
        message: "Orderly credentials stored successfully" 
      });
    } catch (error: any) {
      console.error("Error storing Orderly credentials:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to store Orderly credentials" 
      });
    }
  });

  // Check if user has Orderly credentials
  app.get("/api/orderly/credentials/status", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const label = (req.query.label as string) || "Main Account";
      
      const hasCredentials = await hasOrderlyCredentials(userId, label);
      
      res.json({ 
        success: true, 
        hasCredentials 
      });
    } catch (error: any) {
      console.error("Error checking Orderly credentials:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to check credentials status" 
      });
    }
  });

  // Delete Orderly credentials
  app.delete("/api/orderly/credentials", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const label = (req.query.label as string) || "Main Account";
      
      await deleteOrderlyCredentials(userId, label);
      
      res.json({ 
        success: true, 
        message: "Orderly credentials deleted successfully" 
      });
    } catch (error: any) {
      console.error("Error deleting Orderly credentials:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to delete Orderly credentials" 
      });
    }
  });

  // Get Orderly account balances
  app.get("/api/orderly/balances", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const label = (req.query.label as string) || "Main Account";
      
      const orderly = await getUserOrderlyClient(userId, label);
      const balances = await orderly.getBalance();
      
      res.json({ success: true, balances });
    } catch (error: any) {
      console.error("Error fetching Orderly balances:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch balances" });
    }
  });

  // Get Orderly positions
  app.get("/api/orderly/positions", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const label = (req.query.label as string) || "Main Account";
      
      const orderly = await getUserOrderlyClient(userId, label);
      const positions = await orderly.getPositions();
      
      res.json({ success: true, positions });
    } catch (error: any) {
      console.error("Error fetching Orderly positions:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch positions" });
    }
  });

  // Get Orderly open orders
  app.get("/api/orderly/orders", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const label = (req.query.label as string) || "Main Account";
      const symbol = req.query.symbol as string | undefined;
      
      const orderly = await getUserOrderlyClient(userId, label);
      const orders = await orderly.getOpenOrders(symbol);
      
      res.json({ success: true, orders });
    } catch (error: any) {
      console.error("Error fetching Orderly orders:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch orders" });
    }
  });

  // Place order on Orderly
  app.post("/api/orderly/order", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        symbol: z.string(),
        side: z.enum(['BUY', 'SELL']),
        orderType: z.enum(['LIMIT', 'MARKET', 'IOC', 'FOK', 'POST_ONLY', 'ASK', 'BID']),
        orderPrice: z.number().optional(),
        orderQuantity: z.number(),
        reduceOnly: z.boolean().optional(),
        label: z.string().optional().default("Main Account"),
      });

      const params = schema.parse(req.body);
      const { label, ...orderParams } = params;
      
      const orderly = await getUserOrderlyClient(userId, label);
      const result = await orderly.placeOrder(orderParams);
      
      res.json({ success: true, order: result });
    } catch (error: any) {
      console.error("Error placing Orderly order:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: error.message || "Failed to place order" });
    }
  });

  // Cancel order on Orderly
  app.delete("/api/orderly/order", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        orderId: z.number(),
        symbol: z.string(),
        label: z.string().optional().default("Main Account"),
      });

      const { orderId, symbol, label } = schema.parse(req.query);
      
      const orderly = await getUserOrderlyClient(userId, label);
      await orderly.cancelOrder(orderId, symbol);
      
      res.json({ success: true, message: "Order cancelled successfully" });
    } catch (error: any) {
      console.error("Error cancelling Orderly order:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to cancel order" });
    }
  });

  // Get Orderly market data
  app.get("/api/orderly/market-data", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const symbol = req.query.symbol as string;
      const label = (req.query.label as string) || "Main Account";
      
      if (!symbol) {
        return res.status(400).json({ success: false, error: "Symbol is required" });
      }
      
      const orderly = await getUserOrderlyClient(userId, label);
      const marketData = await orderly.getMarketData(symbol);
      
      res.json({ success: true, marketData });
    } catch (error: any) {
      console.error("Error fetching Orderly market data:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch market data" });
    }
  });

  // Get Orderly orderbook
  app.get("/api/orderly/orderbook", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const symbol = req.query.symbol as string;
      const maxLevel = req.query.maxLevel ? parseInt(req.query.maxLevel as string) : 10;
      const label = (req.query.label as string) || "Main Account";
      
      if (!symbol) {
        return res.status(400).json({ success: false, error: "Symbol is required" });
      }
      
      const orderly = await getUserOrderlyClient(userId, label);
      const orderbook = await orderly.getOrderbook(symbol, maxLevel);
      
      res.json({ success: true, orderbook });
    } catch (error: any) {
      console.error("Error fetching Orderly orderbook:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch orderbook" });
    }
  });

  // Get available Orderly trading symbols
  app.get("/api/orderly/symbols", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const label = (req.query.label as string) || "Main Account";
      
      const orderly = await getUserOrderlyClient(userId, label);
      const symbols = await orderly.getSymbols();
      
      res.json({ success: true, symbols });
    } catch (error: any) {
      console.error("Error fetching Orderly symbols:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch symbols" });
    }
  });

  // Get Orderly funding rate
  app.get("/api/orderly/funding-rate", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const symbol = req.query.symbol as string;
      const label = (req.query.label as string) || "Main Account";
      
      if (!symbol) {
        return res.status(400).json({ success: false, error: "Symbol is required" });
      }
      
      const orderly = await getUserOrderlyClient(userId, label);
      const fundingRate = await orderly.getFundingRate(symbol);
      
      res.json({ success: true, fundingRate });
    } catch (error: any) {
      console.error("Error fetching Orderly funding rate:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch funding rate" });
    }
  });

  // Get Orderly kline/candlestick data
  app.get("/api/orderly/klines", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const symbol = req.query.symbol as string;
      const interval = (req.query.interval as string) || '15m';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const label = (req.query.label as string) || "Main Account";
      
      if (!symbol) {
        return res.status(400).json({ success: false, error: "Symbol is required" });
      }
      
      const orderly = await getUserOrderlyClient(userId, label);
      const klines = await orderly.getKlines(symbol, interval, limit);
      
      res.json({ success: true, klines });
    } catch (error: any) {
      console.error("Error fetching Orderly klines:", error);
      if (error.message?.includes('No Orderly API credentials')) {
        return res.status(401).json({ success: false, error: "Please configure your Orderly API credentials first" });
      }
      res.status(500).json({ success: false, error: "Failed to fetch klines" });
    }
  });

  // Multi-Exchange Aggregation Routes
  
  // Get aggregated positions from all exchanges
  app.get("/api/multi-exchange/positions", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const positions: any[] = [];
      
      // Fetch Hyperliquid positions
      try {
        const hyperliquid = await getUserHyperliquidClient(userId);
        const hlPositions = await hyperliquid.getPositions();
        
        if (hlPositions && hlPositions.length > 0) {
          positions.push(...hlPositions.map((p: any) => ({
            ...p,
            exchange: 'hyperliquid',
            marketType: 'perpetual'
          })));
        }
      } catch (error: any) {
        console.log('[Multi-Exchange] Hyperliquid positions not available:', error.message);
        // Don't fail if Hyperliquid credentials are not set up
        if (!error.message?.includes('No Hyperliquid credentials')) {
          throw error;
        }
      }
      
      // Fetch Orderly positions
      try {
        const orderly = await getUserOrderlyClient(userId, "Main Account");
        const orderlyPositions = await orderly.getPositions();
        
        if (orderlyPositions && orderlyPositions.length > 0) {
          positions.push(...orderlyPositions.map((p: any) => ({
            ...p,
            exchange: 'orderly',
            marketType: 'perpetual'
          })));
        }
      } catch (error: any) {
        console.log('[Multi-Exchange] Orderly positions not available:', error.message);
        // Don't fail if Orderly credentials are not set up
        if (!error.message?.includes('No Orderly API credentials')) {
          throw error;
        }
      }
      
      // Fetch Polymarket positions
      try {
        const { getPolymarketClient } = await import('./polymarket/client');
        const polymarket = await getPolymarketClient(userId);
        const polyPositions = await polymarket.getPositions();
        
        if (polyPositions && polyPositions.length > 0) {
          positions.push(...polyPositions.map((p: any) => ({
            ...p,
            exchange: 'polymarket',
            marketType: 'prediction',
            // Standardize field names for unified display
            symbol: p.marketQuestion || p.conditionId,
            size: p.size || p.shares,
            entryPrice: p.price || p.averagePrice,
            unrealizedPnl: p.unrealizedPnl || 0,
          })));
        }
      } catch (error: any) {
        console.log('[Multi-Exchange] Polymarket positions not available:', error.message);
        // Don't fail if Polymarket is not configured
      }
      
      res.json({ success: true, positions });
    } catch (error: any) {
      console.error("Error fetching multi-exchange positions:", error);
      res.status(500).json({ success: false, error: "Failed to fetch positions from exchanges" });
    }
  });

  // Get aggregated balances from all exchanges
  app.get("/api/multi-exchange/balances", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const balances: any = {
        hyperliquid: null,
        orderly: null,
        totalUsdValue: 0
      };
      
      // Fetch Hyperliquid balance
      try {
        const hyperliquid = await getUserHyperliquidClient(userId);
        const hlState = await hyperliquid.getUserState();
        
        balances.hyperliquid = {
          accountValue: hlState.marginSummary?.accountValue || '0',
          withdrawable: hlState.withdrawable || '0',
          marginUsed: hlState.marginSummary?.totalMarginUsed || '0',
        };
        
        balances.totalUsdValue += parseFloat(hlState.marginSummary?.accountValue || '0');
      } catch (error: any) {
        console.log('[Multi-Exchange] Hyperliquid balance not available:', error.message);
        if (!error.message?.includes('No Hyperliquid credentials')) {
          throw error;
        }
      }
      
      // Fetch Orderly balance
      try {
        const orderly = await getUserOrderlyClient(userId, "Main Account");
        const orderlyBalance = await orderly.getBalance();
        
        balances.orderly = orderlyBalance;
        
        // Add Orderly total to aggregated value
        if (orderlyBalance?.totalCollateral) {
          balances.totalUsdValue += parseFloat(orderlyBalance.totalCollateral);
        }
      } catch (error: any) {
        console.log('[Multi-Exchange] Orderly balance not available:', error.message);
        if (!error.message?.includes('No Orderly API credentials')) {
          throw error;
        }
      }
      
      res.json({ success: true, balances });
    } catch (error: any) {
      console.error("Error fetching multi-exchange balances:", error);
      res.status(500).json({ success: false, error: "Failed to fetch balances from exchanges" });
    }
  });

  // Get aggregated portfolio summary
  app.get("/api/multi-exchange/summary", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const summary: any = {
        exchanges: [],
        totalValue: 0,
        totalPositions: 0,
        totalOpenOrders: 0
      };
      
      // Fetch Hyperliquid data
      try {
        const hyperliquid = await getUserHyperliquidClient(userId);
        const [hlState, hlPositions, hlOrders] = await Promise.all([
          hyperliquid.getUserState(),
          hyperliquid.getPositions(),
          hyperliquid.getOpenOrders()
        ]);
        
        const accountValue = parseFloat(hlState.marginSummary?.accountValue || '0');
        summary.exchanges.push({
          name: 'hyperliquid',
          accountValue: accountValue,
          positions: hlPositions?.length || 0,
          openOrders: hlOrders?.length || 0,
          available: true
        });
        
        summary.totalValue += accountValue;
        summary.totalPositions += hlPositions?.length || 0;
        summary.totalOpenOrders += hlOrders?.length || 0;
      } catch (error: any) {
        console.log('[Multi-Exchange] Hyperliquid summary not available:', error.message);
        if (error.message?.includes('No Hyperliquid credentials')) {
          summary.exchanges.push({
            name: 'hyperliquid',
            available: false,
            error: 'Not configured'
          });
        }
      }
      
      // Fetch Orderly data
      try {
        const orderly = await getUserOrderlyClient(userId, "Main Account");
        const [orderlyBalance, orderlyPositions, orderlyOrders] = await Promise.all([
          orderly.getBalance(),
          orderly.getPositions(),
          orderly.getOpenOrders()
        ]);
        
        const accountValue = parseFloat(orderlyBalance?.totalCollateral || '0');
        summary.exchanges.push({
          name: 'orderly',
          accountValue: accountValue,
          positions: orderlyPositions?.length || 0,
          openOrders: orderlyOrders?.length || 0,
          available: true
        });
        
        summary.totalValue += accountValue;
        summary.totalPositions += orderlyPositions?.length || 0;
        summary.totalOpenOrders += orderlyOrders?.length || 0;
      } catch (error: any) {
        console.log('[Multi-Exchange] Orderly summary not available:', error.message);
        if (error.message?.includes('No Orderly API credentials')) {
          summary.exchanges.push({
            name: 'orderly',
            available: false,
            error: 'Not configured'
          });
        }
      }
      
      res.json({ success: true, summary });
    } catch (error: any) {
      console.error("Error fetching multi-exchange summary:", error);
      res.status(500).json({ success: false, error: "Failed to fetch portfolio summary" });
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

  // Embedded Wallet Routes
  
  // Create embedded wallets for user (called after external wallet auth)
  app.post("/api/wallets/embedded", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ethers } = await import('ethers');
      const { encryptCredential } = await import("./encryption");
      
      const schema = z.object({
        solanaAddress: z.string().min(1),
        evmAddress: z.string().min(1),
        polygonAddress: z.string().min(1),
        hyperliquidAddress: z.string().min(1),
        bnbAddress: z.string().min(1),
        hyperliquidPrivateKey: z.string().min(1),
      });
      
      const { solanaAddress, evmAddress, polygonAddress, hyperliquidAddress, bnbAddress, hyperliquidPrivateKey } = schema.parse(req.body);
      
      // Check if user already has embedded wallets
      const existingWallet = await storage.getEmbeddedWallet(userId);
      if (existingWallet) {
        return res.status(400).json({
          success: false,
          error: "Embedded wallets already exist for this user"
        });
      }
      
      // Create embedded wallet record (only public addresses, no private keys)
      const embeddedWallet = await storage.createEmbeddedWallet(userId, {
        solanaAddress,
        evmAddress,
        polygonAddress,
        hyperliquidAddress,
        bnbAddress,
      });
      
      // CRITICAL: Generate separate API wallet for Hyperliquid trading
      // This wallet has NO withdrawal permissions - only trading permissions
      const apiWallet = ethers.Wallet.createRandom();
      const apiWalletAddress = apiWallet.address;
      const apiWalletPrivateKey = apiWallet.privateKey;
      
      console.log(`[Wallet] Generated API wallet ${apiWalletAddress} for user ${userId}`);
      
      // Sign approveAgent message with main wallet to authorize API wallet
      const mainWallet = new ethers.Wallet(hyperliquidPrivateKey);
      const nonce = BigInt(Date.now());
      
      // Use correct chain ID based on testnet/mainnet
      const isTestnet = process.env.HYPERLIQUID_TESTNET === "true";
      const chainId = isTestnet ? 421614 : 42161; // Arbitrum Sepolia (testnet) or Arbitrum One (mainnet)
      const chainIdHex = isTestnet ? "0x66eee" : "0xa4b1";
      const hyperliquidChain = isTestnet ? "Testnet" : "Mainnet";
      
      const domain = {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: chainId,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };
      
      const types = {
        "HyperliquidTransaction:ApproveAgent": [
          { name: "hyperliquidChain", type: "string" },
          { name: "signatureChainId", type: "string" },
          { name: "agentAddress", type: "string" },
          { name: "agentName", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      };
      
      const message = {
        hyperliquidChain: hyperliquidChain,
        signatureChainId: chainIdHex,
        agentAddress: apiWalletAddress,
        agentName: "1fox_agent",
        nonce: nonce,
      };
      
      const signature = await mainWallet.signTypedData(domain, types, message);
      
      console.log(`[Wallet] Signed approveAgent for API wallet ${apiWalletAddress}`);
      
      // Store MAIN wallet private key (for withdrawals and balance queries)
      const mainWalletEncrypted = encryptCredential(hyperliquidPrivateKey);
      await storage.createApiKey(userId, {
        providerType: "exchange",
        providerName: "hyperliquid",
        label: "Hyperliquid Main Wallet",
        publicKey: hyperliquidAddress,
        encryptedApiKey: mainWalletEncrypted.encryptedPrivateKey,
        apiKeyIv: mainWalletEncrypted.credentialIv,
        encryptedDek: mainWalletEncrypted.encryptedDek,
        dekIv: mainWalletEncrypted.dekIv,
        isActive: 0, // Main wallet is for withdrawals only
        metadata: {
          mainWalletAddress: hyperliquidAddress,
          purpose: "withdrawal",
          autoGenerated: true,
        } as any,
      });
      
      // Store API wallet private key (for trading - authorized agent)
      // Calculate 180-day expiration (Hyperliquid's maximum)
      const approvalTimestamp = new Date();
      const expirationDate = new Date(approvalTimestamp);
      expirationDate.setDate(expirationDate.getDate() + 180);
      
      const apiWalletEncrypted = encryptCredential(apiWalletPrivateKey);
      await storage.createApiKey(userId, {
        providerType: "exchange",
        providerName: "hyperliquid",
        label: "Hyperliquid API Wallet",
        publicKey: apiWalletAddress,
        encryptedApiKey: apiWalletEncrypted.encryptedPrivateKey,
        apiKeyIv: apiWalletEncrypted.credentialIv,
        encryptedDek: apiWalletEncrypted.encryptedDek,
        dekIv: apiWalletEncrypted.dekIv,
        isActive: 1, // API wallet is active for trading
        metadata: {
          mainWalletAddress: hyperliquidAddress,
          apiWalletAddress: apiWalletAddress,
          purpose: "trading",
          approvalSignature: signature,
          approvalNonce: nonce.toString(),
          approvalTimestamp: approvalTimestamp.toISOString(),
          expirationDate: expirationDate.toISOString(),
          autoGenerated: true,
        } as any,
      });
      
      // Mark API wallet as approved in embedded wallet
      await storage.updateApiWalletApproval(userId, apiWalletAddress);
      
      console.log(`[Wallet] Created embedded wallets with main wallet (${hyperliquidAddress}) and API wallet (${apiWalletAddress}) for user ${userId}`);
      
      // CRITICAL: Set referral code on Hyperliquid using MAIN wallet
      // This registers the wallet under our platform's referral code for 4% fee discount
      const referralCode = process.env.HYPERLIQUID_REFERRAL_CODE;
      if (referralCode) {
        try {
          console.log(`[Wallet] Setting Hyperliquid referral code: ${referralCode}`);
          const { HyperliquidClient } = await import("./hyperliquid/client");
          const tempClient = new HyperliquidClient({
            privateKey: hyperliquidPrivateKey,
            testnet: isTestnet,
            walletAddress: hyperliquidAddress,
          });
          
          const referralResult = await tempClient.setReferralCode(referralCode);
          if (referralResult.success) {
            console.log(`[Wallet] ✓ Referral code set successfully for ${hyperliquidAddress}`);
          } else {
            // Don't fail wallet creation if referral code fails (might already be set)
            console.warn(`[Wallet] Referral code warning: ${referralResult.error}`);
          }
        } catch (error: any) {
          console.warn(`[Wallet] Failed to set referral code (non-critical):`, error.message);
        }
      } else {
        console.warn(`[Wallet] HYPERLIQUID_REFERRAL_CODE not configured - skipping referral setup`);
      }
      
      res.json({
        success: true,
        wallet: embeddedWallet,
        apiWalletAddress,
      });
    } catch (error: any) {
      console.error("Error creating embedded wallet:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create embedded wallet"
      });
    }
  });
  
  // Get embedded wallet for current user
  app.get("/api/wallets/embedded", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const wallet = await storage.getEmbeddedWallet(userId);
      
      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: "No embedded wallet found for this user"
        });
      }
      
      res.json({
        success: true,
        wallet,
      });
    } catch (error: any) {
      console.error("Error fetching embedded wallet:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch embedded wallet"
      });
    }
  });

  // Get Hyperliquid referral status for current user
  app.get("/api/hyperliquid/referral-status", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const wallet = await storage.getEmbeddedWallet(userId);
      
      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: "No embedded wallet found"
        });
      }

      const isTestnet = process.env.HYPERLIQUID_TESTNET === "true";
      const apiUrl = isTestnet 
        ? "https://api.hyperliquid-testnet.xyz" 
        : "https://api.hyperliquid.xyz";

      const response = await fetch(`${apiUrl}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "referral",
          user: wallet.hyperliquidAddress,
        }),
      });

      const referralData = await response.json();

      res.json({
        success: true,
        referralStatus: referralData,
        hasReferral: !!referralData.referredBy,
        referralCode: referralData.referredBy?.code || null,
      });
    } catch (error: any) {
      console.error("Error fetching referral status:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch referral status"
      });
    }
  });
  
  // Mark seed phrase as shown (called after user confirms they've saved it)
  app.post("/api/wallets/embedded/confirm-seed", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const wallet = await storage.markSeedPhraseShown(userId);
      
      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: "No embedded wallet found for this user"
        });
      }
      
      res.json({
        success: true,
        wallet,
      });
    } catch (error: any) {
      console.error("Error confirming seed phrase:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to confirm seed phrase"
      });
    }
  });

  // Generate API wallet for Hyperliquid trading (separate from main wallet for security)
  app.post("/api/wallets/generate-api-wallet", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ethers } = await import('ethers');
      
      // Check if user already has an API wallet
      const existingWallet = await storage.getEmbeddedWallet(userId);
      if (!existingWallet) {
        return res.status(400).json({
          success: false,
          error: "No embedded wallet found. Please complete wallet setup first."
        });
      }
      
      if (existingWallet.apiWalletApproved) {
        return res.status(400).json({
          success: false,
          error: "API wallet already approved for this user"
        });
      }
      
      // Generate new random API wallet (separate seed for security)
      const apiWallet = ethers.Wallet.createRandom();
      const apiWalletAddress = apiWallet.address;
      const apiWalletPrivateKey = apiWallet.privateKey;
      
      // Encrypt and store the API wallet private key
      const { encryptedPrivateKey, credentialIv, encryptedDek, dekIv } = encryptCredential(apiWalletPrivateKey);
      
      // Store in api_keys table (initially inactive until approved)
      await storage.createApiKey(userId, {
        providerType: "exchange",
        providerName: "hyperliquid",
        label: "API Trading Wallet",
        encryptedApiKey: encryptedPrivateKey,
        apiKeyIv: credentialIv,
        encryptedDek: encryptedDek,
        dekIv: dekIv,
        isActive: 0, // Will be activated after user signs approval
        metadata: {
          apiWalletAddress,
          mainWalletAddress: existingWallet.hyperliquidAddress,
          purpose: "trading_agent",
        } as any,
      });
      
      console.log(`[API Wallet] Generated API wallet for user ${userId}: ${apiWalletAddress}`);
      
      res.json({
        success: true,
        apiWalletAddress,
      });
    } catch (error: any) {
      console.error("Error generating API wallet:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate API wallet"
      });
    }
  });

  // Re-sync Hyperliquid credentials (for users who created wallets before auto-credential setup)
  app.post("/api/wallet/resync-hyperliquid-credentials", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ethers } = await import('ethers');
      
      const schema = z.object({
        hyperliquidPrivateKey: z.string().min(1),
      });
      
      const { hyperliquidPrivateKey } = schema.parse(req.body);
      
      // Get user's existing embedded wallet
      const existingWallet = await storage.getEmbeddedWallet(userId);
      if (!existingWallet) {
        return res.status(400).json({
          success: false,
          error: "No embedded wallet found. Please create an embedded wallet first."
        });
      }
      
      // Verify the Hyperliquid private key matches the user's existing wallet address
      const wallet = new ethers.Wallet(hyperliquidPrivateKey);
      const derivedAddress = wallet.address;
      
      if (derivedAddress.toLowerCase() !== existingWallet.hyperliquidAddress.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: "Seed phrase does not match your existing embedded wallet. Please verify you entered the correct seed phrase."
        });
      }
      
      // Check if credentials already exist
      const existingApiKeys = await storage.getApiKeys(userId);
      const existingCredential = existingApiKeys.find(key => 
        key.providerType === "exchange" && 
        key.providerName === "hyperliquid" &&
        (key.metadata as any)?.mainWalletAddress?.toLowerCase() === existingWallet.hyperliquidAddress.toLowerCase()
      );
      
      // Delete existing credential if it exists
      if (existingCredential) {
        await storage.deleteApiKey(userId, existingCredential.id);
        console.log(`[Re-sync] Deleted existing Hyperliquid credential for user ${userId}`);
      }
      
      // Encrypt and store the Hyperliquid private key
      const { encryptedPrivateKey, credentialIv, encryptedDek, dekIv } = encryptCredential(hyperliquidPrivateKey);
      
      // Calculate 180-day expiration (Hyperliquid's maximum)
      const approvalTimestamp = new Date();
      const expirationDate = new Date(approvalTimestamp);
      expirationDate.setDate(expirationDate.getDate() + 180);
      
      // Store in api_keys table (active by default)
      await storage.createApiKey(userId, {
        providerType: "exchange",
        providerName: "hyperliquid",
        label: "Hyperliquid Trading Wallet",
        encryptedApiKey: encryptedPrivateKey,
        apiKeyIv: credentialIv,
        encryptedDek: encryptedDek,
        dekIv: dekIv,
        isActive: 1, // Active immediately
        metadata: {
          mainWalletAddress: existingWallet.hyperliquidAddress,
          purpose: "trading",
          resyncedAt: new Date().toISOString(),
          approvalTimestamp: approvalTimestamp.toISOString(),
          expirationDate: expirationDate.toISOString(),
        } as any,
      });
      
      console.log(`[Re-sync] Successfully re-synced Hyperliquid credentials for user ${userId}`);
      
      res.json({
        success: true,
        message: "Hyperliquid credentials successfully re-synced"
      });
    } catch (error: any) {
      console.error("Error re-syncing Hyperliquid credentials:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to re-sync Hyperliquid credentials"
      });
    }
  });

  // Approve API wallet (user signs EIP-712 approveAgent message)
  app.post("/api/wallets/approve-api-wallet", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { verifyTypedData, recoverTypedDataAddress } = await import('viem');
      
      const schema = z.object({
        signature: z.string().min(1),
        apiWalletAddress: z.string().min(1),
        nonce: z.string().min(1),
      });
      
      const { signature, apiWalletAddress, nonce } = schema.parse(req.body);
      
      // Get user's embedded wallet
      const embeddedWallet = await storage.getEmbeddedWallet(userId);
      if (!embeddedWallet) {
        return res.status(400).json({
          success: false,
          error: "No embedded wallet found"
        });
      }
      
      // Reconstruct the EIP-712 typed data that was signed
      const domain = {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: 421614, // 0x66eee - Hyperliquid's chain ID
        verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      };
      
      const types = {
        "HyperliquidTransaction:ApproveAgent": [
          { name: "hyperliquidChain", type: "string" },
          { name: "signatureChainId", type: "string" },
          { name: "agentAddress", type: "string" },
          { name: "agentName", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      } as const;
      
      // Reconstruct message with the exact nonce that was signed
      const message = {
        hyperliquidChain: "Mainnet",
        signatureChainId: "0x66eee",
        agentAddress: apiWalletAddress,
        agentName: "1fox_agent",
        nonce: BigInt(nonce),
      };
      
      // Recover the signer address from the signature
      const recoveredAddress = await recoverTypedDataAddress({
        domain,
        types,
        primaryType: "HyperliquidTransaction:ApproveAgent",
        message,
        signature: signature as `0x${string}`,
      });
      
      // Verify that the signer matches the user's embedded Hyperliquid wallet
      if (recoveredAddress.toLowerCase() !== embeddedWallet.hyperliquidAddress.toLowerCase()) {
        console.warn(`[API Wallet] Signature verification failed for user ${userId}. Expected ${embeddedWallet.hyperliquidAddress}, got ${recoveredAddress}`);
        return res.status(403).json({
          success: false,
          error: "Signature verification failed. Please sign with your Hyperliquid wallet."
        });
      }
      
      // Find and activate the API key with this address
      const userApiKeys = await storage.getApiKeys(userId);
      const apiKey = userApiKeys.find(key => 
        key.providerType === "exchange" && 
        key.providerName === "hyperliquid" &&
        (key.metadata as any)?.apiWalletAddress === apiWalletAddress
      );
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "API wallet not found. Please generate one first."
        });
      }
      
      // Activate the API key by deleting and recreating with isActive: 1
      await storage.deleteApiKey(userId, apiKey.id);
      await storage.createApiKey(userId, {
        providerType: apiKey.providerType,
        providerName: apiKey.providerName,
        label: apiKey.label,
        encryptedApiKey: apiKey.encryptedApiKey,
        apiKeyIv: apiKey.apiKeyIv,
        encryptedDek: apiKey.encryptedDek,
        dekIv: apiKey.dekIv,
        publicKey: apiKey.publicKey,
        metadata: apiKey.metadata as any,
        isActive: 1,
      });
      
      // Update embedded wallet with API wallet approval
      await storage.updateApiWalletApproval(userId, apiWalletAddress);
      
      console.log(`[API Wallet] User ${userId} approved API wallet ${apiWalletAddress} with verified signature`);
      
      res.json({
        success: true,
        message: "API wallet approved successfully"
      });
    } catch (error: any) {
      console.error("Error approving API wallet:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to approve API wallet"
      });
    }
  });
  
  // Check Hyperliquid API wallet expiration status
  app.get("/api/wallets/hyperliquid-expiration", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Get user's API keys
      const apiKeys = await storage.getApiKeys(userId);
      const hyperliquidApiKey = apiKeys.find(key => 
        key.providerType === "exchange" && 
        key.providerName === "hyperliquid" &&
        key.isActive === 1 &&
        (key.metadata as any)?.purpose === "trading"
      );
      
      if (!hyperliquidApiKey) {
        return res.json({
          success: true,
          hasApiWallet: false,
          expirationDate: null,
          daysRemaining: null,
          isExpiring: false,
          isExpired: false,
        });
      }
      
      const metadata = hyperliquidApiKey.metadata as any;
      if (!metadata.expirationDate) {
        // Legacy API wallet without expiration tracking
        return res.json({
          success: true,
          hasApiWallet: true,
          expirationDate: null,
          daysRemaining: null,
          isExpiring: false,
          isExpired: false,
          message: "API wallet created before expiration tracking was implemented"
        });
      }
      
      const expirationDate = new Date(metadata.expirationDate);
      const now = new Date();
      const msRemaining = expirationDate.getTime() - now.getTime();
      const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      const hoursRemaining = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      const isExpired = msRemaining <= 0;
      const isExpiring = daysRemaining <= 30 && !isExpired;
      
      res.json({
        success: true,
        hasApiWallet: true,
        expirationDate: metadata.expirationDate,
        approvalTimestamp: metadata.approvalTimestamp,
        daysRemaining: isExpired ? 0 : daysRemaining,
        hoursRemaining: isExpired ? 0 : hoursRemaining,
        isExpiring,
        isExpired,
      });
    } catch (error: any) {
      console.error("Error checking Hyperliquid expiration:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to check Hyperliquid expiration"
      });
    }
  });
  
  // Renew Hyperliquid API wallet (one-click renewal)
  app.post("/api/wallets/renew-hyperliquid", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ethers } = await import('ethers');
      
      // Get user's embedded wallet
      const embeddedWallet = await storage.getEmbeddedWallet(userId);
      if (!embeddedWallet) {
        return res.status(400).json({
          success: false,
          error: "No embedded wallet found. Please create an embedded wallet first."
        });
      }
      
      // Get the main wallet private key to sign approveAgent
      const apiKeys = await storage.getApiKeys(userId);
      const mainWalletKey = apiKeys.find(key => 
        key.providerType === "exchange" && 
        key.providerName === "hyperliquid" &&
        (key.metadata as any)?.purpose === "withdrawal"
      );
      
      if (!mainWalletKey) {
        return res.status(400).json({
          success: false,
          error: "Main wallet credentials not found. Please use re-sync to restore your credentials."
        });
      }
      
      // Decrypt main wallet private key
      const mainWalletPrivateKey = decryptCredential(
        mainWalletKey.encryptedApiKey,
        mainWalletKey.apiKeyIv,
        mainWalletKey.encryptedDek,
        mainWalletKey.dekIv
      );
      
      // Generate new API wallet
      const apiWallet = ethers.Wallet.createRandom();
      const apiWalletAddress = apiWallet.address;
      const apiWalletPrivateKey = apiWallet.privateKey;
      
      console.log(`[Wallet Renewal] Generated new API wallet ${apiWalletAddress} for user ${userId}`);
      
      // Sign approveAgent message with main wallet
      const mainWallet = new ethers.Wallet(mainWalletPrivateKey);
      const nonce = BigInt(Date.now());
      
      const isTestnet = process.env.HYPERLIQUID_TESTNET === "true";
      const chainId = isTestnet ? 421614 : 42161;
      const chainIdHex = isTestnet ? "0x66eee" : "0xa4b1";
      const hyperliquidChain = isTestnet ? "Testnet" : "Mainnet";
      
      const domain = {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: chainId,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };
      
      const types = {
        "HyperliquidTransaction:ApproveAgent": [
          { name: "hyperliquidChain", type: "string" },
          { name: "signatureChainId", type: "string" },
          { name: "agentAddress", type: "string" },
          { name: "agentName", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      };
      
      const message = {
        hyperliquidChain: hyperliquidChain,
        signatureChainId: chainIdHex,
        agentAddress: apiWalletAddress,
        agentName: "1fox_agent",
        nonce: nonce,
      };
      
      const signature = await mainWallet.signTypedData(domain, types, message);
      
      console.log(`[Wallet Renewal] Signed approveAgent for new API wallet ${apiWalletAddress}`);
      
      // Delete old API wallet
      const oldApiWallet = apiKeys.find(key => 
        key.providerType === "exchange" && 
        key.providerName === "hyperliquid" &&
        key.isActive === 1 &&
        (key.metadata as any)?.purpose === "trading"
      );
      
      if (oldApiWallet) {
        await storage.deleteApiKey(userId, oldApiWallet.id);
        console.log(`[Wallet Renewal] Deleted old API wallet for user ${userId}`);
      }
      
      // Calculate 180-day expiration
      const approvalTimestamp = new Date();
      const expirationDate = new Date(approvalTimestamp);
      expirationDate.setDate(expirationDate.getDate() + 180);
      
      // Store new API wallet
      const apiWalletEncrypted = encryptCredential(apiWalletPrivateKey);
      await storage.createApiKey(userId, {
        providerType: "exchange",
        providerName: "hyperliquid",
        label: "Hyperliquid API Wallet",
        publicKey: apiWalletAddress,
        encryptedApiKey: apiWalletEncrypted.encryptedPrivateKey,
        apiKeyIv: apiWalletEncrypted.credentialIv,
        encryptedDek: apiWalletEncrypted.encryptedDek,
        dekIv: apiWalletEncrypted.dekIv,
        isActive: 1,
        metadata: {
          mainWalletAddress: embeddedWallet.hyperliquidAddress,
          apiWalletAddress: apiWalletAddress,
          purpose: "trading",
          approvalSignature: signature,
          approvalNonce: nonce.toString(),
          approvalTimestamp: approvalTimestamp.toISOString(),
          expirationDate: expirationDate.toISOString(),
          renewedAt: new Date().toISOString(),
          autoGenerated: true,
        } as any,
      });
      
      // Update embedded wallet with new API wallet approval
      await storage.updateApiWalletApproval(userId, apiWalletAddress);
      
      console.log(`[Wallet Renewal] Successfully renewed API wallet for user ${userId}, expires ${expirationDate.toISOString()}`);
      
      res.json({
        success: true,
        message: "API wallet renewed successfully",
        apiWalletAddress,
        expirationDate: expirationDate.toISOString(),
        daysValid: 180,
      });
    } catch (error: any) {
      console.error("Error renewing Hyperliquid API wallet:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to renew API wallet"
      });
    }
  });
  
  // Get all wallet balances (Solana, Arbitrum, Hyperliquid)
  app.get("/api/wallets/balances", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { balanceService } = await import('./balanceService');
      
      const balances = await balanceService.getAllBalances(userId, storage);
      
      res.json({
        success: true,
        balances,
      });
    } catch (error: any) {
      console.error("Error fetching wallet balances:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch wallet balances"
      });
    }
  });

  // Estimate gas fees for a withdrawal
  app.post("/api/withdrawals/estimate", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { withdrawalService } = await import('./withdrawalService');
      
      const schema = z.object({
        chain: z.enum(['ethereum', 'polygon', 'solana', 'bnb', 'hyperliquid']),
        token: z.string(),
        amount: z.string(),
        recipient: z.string(),
      });
      
      const data = schema.parse(req.body);
      
      // Get embedded wallet to get the from address
      const wallet = await storage.getEmbeddedWallet(userId);
      if (!wallet) {
        return res.status(404).json({ success: false, error: "Embedded wallet not found" });
      }
      
      const fromAddress = data.chain === 'solana' ? wallet.solanaAddress :
                         data.chain === 'polygon' ? wallet.polygonAddress :
                         data.chain === 'bnb' ? wallet.bnbAddress :
                         data.chain === 'hyperliquid' ? wallet.hyperliquidAddress :
                         wallet.evmAddress;
      
      // Validate recipient address
      const isValid = await withdrawalService.validateAddress(data.chain, data.recipient);
      if (!isValid) {
        return res.status(400).json({ success: false, error: "Invalid recipient address" });
      }
      
      const estimate = await withdrawalService.estimateGas({
        ...data,
        fromAddress,
      });
      
      res.json({
        success: true,
        estimate,
      });
    } catch (error: any) {
      console.error("Error estimating gas:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to estimate gas"
      });
    }
  });

  // Send a withdrawal transaction
  app.post("/api/withdrawals/send", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { withdrawalService } = await import('./withdrawalService');
      const { decryptCredential } = await import('./encryption');
      
      const schema = z.object({
        chain: z.enum(['ethereum', 'polygon', 'solana', 'bnb', 'hyperliquid']),
        token: z.string(),
        amount: z.string(),
        recipient: z.string(),
      });
      
      const data = schema.parse(req.body);
      
      // Get embedded wallet
      const wallet = await storage.getEmbeddedWallet(userId);
      if (!wallet) {
        return res.status(404).json({ success: false, error: "Embedded wallet not found" });
      }
      
      // Get encrypted credentials
      const credentials = await storage.getUserCredentials(userId);
      if (!credentials) {
        return res.status(404).json({ success: false, error: "Wallet credentials not found" });
      }
      
      // Decrypt private key
      const privateKey = decryptCredential(
        credentials.encryptedPrivateKey,
        credentials.credentialIv,
        credentials.encryptedDek,
        credentials.dekIv
      );
      
      const fromAddress = data.chain === 'solana' ? wallet.solanaAddress :
                         data.chain === 'polygon' ? wallet.polygonAddress :
                         data.chain === 'bnb' ? wallet.bnbAddress :
                         data.chain === 'hyperliquid' ? wallet.hyperliquidAddress :
                         wallet.evmAddress;
      
      // Send transaction
      const result = await withdrawalService.sendTransaction({
        ...data,
        fromAddress,
        privateKey,
      });
      
      // Store withdrawal in database
      const withdrawal = await storage.createWithdrawal(userId, {
        chain: data.chain,
        token: data.token,
        amount: data.amount,
        recipient: data.recipient,
        fromAddress,
        transactionHash: result.transactionHash,
        status: result.status,
        explorerUrl: result.explorerUrl,
      });
      
      res.json({
        success: true,
        withdrawal,
      });
    } catch (error: any) {
      console.error("Error sending withdrawal:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to send withdrawal"
      });
    }
  });

  // Get withdrawal history
  app.get("/api/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const withdrawals = await storage.getWithdrawals(userId, limit);
      
      res.json({
        success: true,
        withdrawals,
      });
    } catch (error: any) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch withdrawals"
      });
    }
  });

  // Get specific withdrawal
  app.get("/api/withdrawals/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      const withdrawal = await storage.getWithdrawal(userId, id);
      if (!withdrawal) {
        return res.status(404).json({ success: false, error: "Withdrawal not found" });
      }
      
      res.json({
        success: true,
        withdrawal,
      });
    } catch (error: any) {
      console.error("Error fetching withdrawal:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch withdrawal"
      });
    }
  });

  // Check transaction status and update withdrawal
  app.get("/api/withdrawals/:id/status", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { withdrawalService } = await import('./withdrawalService');
      
      const withdrawal = await storage.getWithdrawal(userId, id);
      if (!withdrawal) {
        return res.status(404).json({ success: false, error: "Withdrawal not found" });
      }
      
      if (!withdrawal.transactionHash) {
        return res.json({
          success: true,
          status: withdrawal.status,
        });
      }
      
      // Check transaction status on blockchain
      const txStatus = await withdrawalService.getTransactionStatus(
        withdrawal.chain,
        withdrawal.transactionHash
      );
      
      // Update withdrawal if status changed
      if (txStatus.status !== withdrawal.status) {
        await storage.updateWithdrawal(userId, id, {
          status: txStatus.status,
          blockNumber: txStatus.blockNumber,
          gasUsed: txStatus.gasUsed,
          confirmedAt: txStatus.status === 'confirmed' ? new Date() : undefined,
        });
      }
      
      res.json({
        success: true,
        status: txStatus.status,
        blockNumber: txStatus.blockNumber,
        gasUsed: txStatus.gasUsed,
      });
    } catch (error: any) {
      console.error("Error checking withdrawal status:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to check withdrawal status"
      });
    }
  });

  // Get comprehensive portfolio aggregation (ALL sources)
  app.get("/api/portfolio/comprehensive", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { balanceService } = await import('./balanceService');
      
      const portfolio: any = {
        wallets: {
          external: { address: null, balance: 0, usdValue: 0 },
          embedded: {
            solana: { sol: 0, usdc: 0, totalUsd: 0 },
            arbitrum: { eth: 0, usdc: 0, totalUsd: 0 },
            polygon: { matic: 0, usdc: 0, totalUsd: 0 },
          }
        },
        exchanges: {
          hyperliquid: { accountValue: 0, withdrawable: 0, marginUsed: 0 },
          orderly: { totalValue: 0, available: 0, marginUsed: 0 },
        },
        polymarket: {
          positionsValue: 0,
          openPositions: 0,
        },
        totals: {
          totalCapital: 0,
          totalAvailable: 0,
          totalMarginUsed: 0,
        }
      };
      
      // Get user for external wallet address
      const user = await storage.getUser(userId);
      if (user?.walletAddress) {
        portfolio.wallets.external.address = user.walletAddress;
        // TODO: Fetch external wallet balance via RPC (for now, 0)
        // Would need to determine which chain and fetch balance
      }
      
      // Get embedded wallet balances
      try {
        const embeddedBalances = await balanceService.getAllBalances(userId, storage);
        portfolio.wallets.embedded.solana = embeddedBalances.solana;
        portfolio.wallets.embedded.arbitrum = embeddedBalances.arbitrum;
        portfolio.wallets.embedded.polygon = embeddedBalances.polygon;
        portfolio.exchanges.hyperliquid = {
          accountValue: embeddedBalances.hyperliquid.accountValue,
          withdrawable: embeddedBalances.hyperliquid.withdrawable,
          marginUsed: embeddedBalances.hyperliquid.accountValue - embeddedBalances.hyperliquid.withdrawable,
        };
        
        portfolio.totals.totalCapital += embeddedBalances.totalUsd;
        portfolio.totals.totalAvailable += embeddedBalances.hyperliquid.withdrawable;
      } catch (error: any) {
        console.log('[Portfolio] Embedded wallet balances not available:', error.message);
      }
      
      // Get Orderly balance
      try {
        const orderly = await getUserOrderlyClient(userId, "Main Account");
        const orderlyBalance = await orderly.getBalance();
        
        const totalValue = parseFloat(orderlyBalance?.totalCollateral || '0');
        // Calculate available by summing availableBalance from all holdings
        let available = 0;
        if (orderlyBalance?.holding && Array.isArray(orderlyBalance.holding)) {
          available = orderlyBalance.holding.reduce((sum: number, h: any) => {
            return sum + parseFloat(h.availableBalance || '0');
          }, 0);
        }
        
        portfolio.exchanges.orderly = {
          totalValue,
          available,
          marginUsed: totalValue - available,
        };
        
        portfolio.totals.totalCapital += totalValue;
        portfolio.totals.totalAvailable += available;
        portfolio.totals.totalMarginUsed += (totalValue - available);
      } catch (error: any) {
        console.log('[Portfolio] Orderly balance not available:', error.message);
      }
      
      // Get Polymarket positions
      try {
        const { getPolymarketClient } = await import('./polymarket/client');
        const polymarket = await getPolymarketClient(userId);
        const positions = await polymarket.getPositions();
        
        let positionsValue = 0;
        let unrealizedPnl = 0;
        if (positions && Array.isArray(positions)) {
          // Calculate total value and P&L of all positions
          positions.forEach((pos: any) => {
            const size = parseFloat(pos.size || '0');
            const price = parseFloat(pos.price || '0');
            const currentValue = size * price;
            positionsValue += currentValue;
            
            // Calculate unrealized P&L if entry price available
            if (pos.entryPrice || pos.averagePrice) {
              const entryPrice = parseFloat(pos.entryPrice || pos.averagePrice || '0');
              const costBasis = size * entryPrice;
              unrealizedPnl += (currentValue - costBasis);
            }
          });
          
          portfolio.polymarket = {
            positionsValue,
            openPositions: positions.length,
            unrealizedPnl,
          };
          
          portfolio.totals.totalCapital += positionsValue;
        }
      } catch (error: any) {
        console.log('[Portfolio] Polymarket positions not available:', error.message);
      }
      
      // Get all positions for P&L calculation
      let totalUnrealizedPnl = portfolio.polymarket.unrealizedPnl || 0;
      try {
        // Fetch Hyperliquid positions for P&L
        const hyperliquid = await getUserHyperliquidClient(userId);
        const hlPositions = await hyperliquid.getPositions();
        if (hlPositions && hlPositions.length > 0) {
          hlPositions.forEach((pos: any) => {
            totalUnrealizedPnl += parseFloat(pos.unrealizedPnl || pos.pnl || '0');
          });
        }
      } catch (error: any) {
        console.log('[Portfolio] Hyperliquid positions P&L not available');
      }
      
      try {
        // Fetch Orderly positions for P&L
        const orderly = await getUserOrderlyClient(userId, "Main Account");
        const orderlyPositions = await orderly.getPositions();
        if (orderlyPositions && orderlyPositions.length > 0) {
          orderlyPositions.forEach((pos: any) => {
            totalUnrealizedPnl += parseFloat(pos.unrealizedPnl || pos.pnl || '0');
          });
        }
      } catch (error: any) {
        console.log('[Portfolio] Orderly positions P&L not available');
      }
      
      // Calculate total margin used and risk metrics
      portfolio.totals.totalMarginUsed = 
        portfolio.exchanges.hyperliquid.marginUsed + 
        portfolio.exchanges.orderly.marginUsed;
      
      portfolio.totals.totalUnrealizedPnl = totalUnrealizedPnl;
      
      // Calculate risk exposure by exchange
      portfolio.riskMetrics = {
        exposureByExchange: {
          hyperliquid: {
            percentage: portfolio.totals.totalCapital > 0 
              ? ((portfolio.exchanges.hyperliquid.accountValue / portfolio.totals.totalCapital) * 100).toFixed(2)
              : '0',
            value: portfolio.exchanges.hyperliquid.accountValue,
          },
          orderly: {
            percentage: portfolio.totals.totalCapital > 0 
              ? ((portfolio.exchanges.orderly.totalValue / portfolio.totals.totalCapital) * 100).toFixed(2)
              : '0',
            value: portfolio.exchanges.orderly.totalValue,
          },
          polymarket: {
            percentage: portfolio.totals.totalCapital > 0 
              ? ((portfolio.polymarket.positionsValue / portfolio.totals.totalCapital) * 100).toFixed(2)
              : '0',
            value: portfolio.polymarket.positionsValue,
          },
        },
        leverageRatio: portfolio.totals.totalAvailable > 0 
          ? (portfolio.totals.totalMarginUsed / portfolio.totals.totalAvailable).toFixed(2)
          : '0',
      };
      
      res.json({
        success: true,
        portfolio,
      });
    } catch (error: any) {
      console.error("Error fetching comprehensive portfolio:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch portfolio data"
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

  // Polymarket API Routes
  
  // Get Polymarket markets (public endpoint) - includes both regular and LIVE markets
  app.get("/api/polymarket/markets", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const active = req.query.active === "true";
      const includeLive = req.query.live !== "false"; // Include LIVE markets by default
      
      // Fetch markets from Polymarket Gamma API via client
      // This is public data, no user context needed
      const tempClient = new PolymarketClient({ 
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001" // Dummy key for public API
      });
      
      // Fetch regular event-based markets
      const regularMarkets = await tempClient.getMarkets({ limit, active });
      
      // Fetch LIVE trading markets (short-term rolling price predictions)
      let liveMarkets: any[] = [];
      if (includeLive) {
        liveMarkets = await tempClient.getLiveMarkets();
      }
      
      // Merge both types of markets
      const allMarkets = [...regularMarkets, ...liveMarkets];
      
      console.log(`[Polymarket API] Returning ${regularMarkets.length} regular + ${liveMarkets.length} LIVE = ${allMarkets.length} total markets`);
      
      res.json({ success: true, markets: allMarkets });
    } catch (error: any) {
      console.error("Error fetching Polymarket markets:", error);
      res.status(500).json({ success: false, error: "Failed to fetch Polymarket markets" });
    }
  });
  
  // Get specific Polymarket market by condition ID
  app.get("/api/polymarket/markets/:conditionId", async (req, res) => {
    try {
      const { conditionId } = req.params;
      
      const tempClient = new PolymarketClient({
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      });
      
      const market = await tempClient.getMarket(conditionId);
      
      res.json({ success: true, market });
    } catch (error: any) {
      console.error("Error fetching Polymarket market:", error);
      res.status(500).json({ success: false, error: "Failed to fetch market" });
    }
  });
  
  // Get user's Polymarket positions
  app.get("/api/polymarket/positions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const eventId = req.query.eventId as string | undefined;
      
      const positions = await storage.getPolymarketPositions(userId, { eventId });
      
      res.json({ success: true, positions });
    } catch (error: any) {
      console.error("Error fetching Polymarket positions:", error);
      res.status(500).json({ success: false, error: "Failed to fetch positions" });
    }
  });
  
  // Get order book for a Polymarket token (public data, no auth required)
  app.get("/api/polymarket/orderbook/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      
      if (!tokenId) {
        return res.status(400).json({ success: false, error: "Token ID is required" });
      }
      
      // Fetch order book from public API (no wallet required)
      const { PolymarketClient } = await import("./polymarket/client");
      const orderBook = await PolymarketClient.getPublicOrderBook(tokenId);
      
      res.json({ success: true, orderBook });
    } catch (error: any) {
      console.error("Error fetching order book:", error);
      res.status(500).json({ success: false, error: "Failed to fetch order book" });
    }
  });
  
  // Get user's Polymarket orders
  app.get("/api/polymarket/orders", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const eventId = req.query.eventId as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const orders = await storage.getPolymarketOrders(userId, { eventId, status, limit });
      
      res.json({ success: true, orders });
    } catch (error: any) {
      console.error("Error fetching Polymarket orders:", error);
      res.status(500).json({ success: false, error: "Failed to fetch orders" });
    }
  });
  
  // Place a Polymarket order
  app.post("/api/polymarket/orders", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate request body
      const schema = z.object({
        eventId: z.string(),
        outcome: z.enum(["Yes", "No"]),
        tokenId: z.string(),
        side: z.enum(["BUY", "SELL"]),
        orderType: z.enum(["market", "limit"]),
        price: z.number().min(0).max(1),
        size: z.number().positive(),
        tickSize: z.string(),
        negRisk: z.boolean(),
      });
      
      const orderData = schema.parse(req.body);
      
      // Get user's embedded wallet (Polygon wallet)
      const embeddedWallet = await storage.getEmbeddedWallet(userId);
      if (!embeddedWallet) {
        return res.status(400).json({ 
          success: false, 
          error: "No embedded wallet found. Please generate your wallet first." 
        });
      }
      
      // Get polygon private key from user's encrypted credentials
      const polygonPrivateKey = await getUserPrivateKey(userId);
      if (!polygonPrivateKey) {
        return res.status(400).json({
          success: false,
          error: "Polygon wallet credentials not found"
        });
      }
      
      // Initialize Polymarket client with user's Polygon wallet
      const polymarketClient = new PolymarketClient({
        privateKey: polygonPrivateKey,
        funderAddress: embeddedWallet.polygonAddress,
      });
      
      // Place the order
      let orderResult;
      if (orderData.orderType === "market") {
        orderResult = await polymarketClient.placeMarketOrder({
          tokenId: orderData.tokenId,
          side: orderData.side,
          size: orderData.size,
          tickSize: orderData.tickSize,
          negRisk: orderData.negRisk,
        });
      } else {
        orderResult = await polymarketClient.placeLimitOrder({
          tokenId: orderData.tokenId,
          price: orderData.price,
          side: orderData.side,
          size: orderData.size,
          tickSize: orderData.tickSize,
          negRisk: orderData.negRisk,
        });
      }
      
      // Store order in database
      const storedOrder = await storage.createPolymarketOrder(userId, {
        eventId: orderData.eventId,
        polymarketOrderId: orderResult.orderID || null,
        outcome: orderData.outcome,
        tokenId: orderData.tokenId,
        side: orderData.side,
        orderType: orderData.orderType,
        price: orderData.price.toString(),
        size: orderData.size.toString(),
        filledSize: "0",
        status: "pending",
      });
      
      res.json({ 
        success: true, 
        order: storedOrder,
        polymarketResponse: orderResult
      });
    } catch (error: any) {
      console.error("Error placing Polymarket order:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to place order" 
      });
    }
  });

  // Aevo Options API Routes
  
  // Get Aevo markets (options and perpetuals)
  app.get("/api/aevo/markets", async (req, res) => {
    try {
      const asset = req.query.asset as string | undefined;
      const instrumentType = req.query.instrument_type as 'OPTION' | 'PERPETUAL' | undefined;
      
      // Fetch live markets from Aevo public API
      const axios = (await import('axios')).default;
      const baseUrl = 'https://api.aevo.xyz';
      const params: any = {};
      if (asset) params.asset = asset;
      if (instrumentType) params.instrument_type = instrumentType;
      
      const response = await axios.get<any[]>(`${baseUrl}/markets`, { params });
      const markets = response.data;
      
      res.json({ success: true, markets });
    } catch (error: any) {
      console.error("Error fetching Aevo markets:", error);
      res.status(500).json({ success: false, error: "Failed to fetch markets" });
    }
  });
  
  // Get user's options strategies
  app.get("/api/aevo/strategies", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const status = req.query.status as string | undefined;
      
      const strategies = await storage.getOptionsStrategies(userId, { status });
      
      res.json({ success: true, strategies });
    } catch (error: any) {
      console.error("Error fetching options strategies:", error);
      res.status(500).json({ success: false, error: "Failed to fetch strategies" });
    }
  });
  
  // Get user's options positions
  app.get("/api/aevo/positions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const strategyId = req.query.strategyId as string | undefined;
      const status = req.query.status as string | undefined;
      
      const positions = await storage.getOptionsPositions(userId, { strategyId, status });
      
      res.json({ success: true, positions });
    } catch (error: any) {
      console.error("Error fetching options positions:", error);
      res.status(500).json({ success: false, error: "Failed to fetch positions" });
    }
  });
  
  // Get user's options orders
  app.get("/api/aevo/orders", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const strategyId = req.query.strategyId as string | undefined;
      const status = req.query.status as string | undefined;
      
      const orders = await storage.getOptionsOrders(userId, { strategyId, status });
      
      res.json({ success: true, orders });
    } catch (error: any) {
      console.error("Error fetching options orders:", error);
      res.status(500).json({ success: false, error: "Failed to fetch orders" });
    }
  });
  
  // Create a new options strategy (Straddle, Strap, Strip, etc.)
  app.post("/api/aevo/strategies", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate request body
      const schema = z.object({
        name: z.string(), // "Straddle", "Strap", "Strip"
        type: z.enum(["pre_built", "custom"]),
        asset: z.string(), // "ETH", "BTC"
        strike: z.number().positive().optional(),
        expiry: z.string(), // ISO timestamp
        legs: z.array(z.object({
          instrumentId: z.string(),
          instrumentName: z.string(),
          optionType: z.enum(["call", "put"]),
          side: z.enum(["long", "short"]),
          size: z.number().positive(),
        })),
      });
      
      const strategyData = schema.parse(req.body);
      
      // Calculate strategy parameters (breakevens, max profit/loss)
      // This would use AevoClient helper methods
      const totalCost = 0; // Calculate from legs
      const upperBreakeven = strategyData.strike || 0;
      const lowerBreakeven = strategyData.strike || 0;
      
      // Create strategy in database
      const strategy = await storage.createOptionsStrategy(userId, {
        name: strategyData.name,
        type: strategyData.type,
        asset: strategyData.asset,
        strike: strategyData.strike?.toString(),
        expiry: new Date(strategyData.expiry),
        totalCost: totalCost.toString(),
        maxProfit: null, // Unlimited for most strategies
        maxLoss: totalCost.toString(),
        upperBreakeven: upperBreakeven.toString(),
        lowerBreakeven: lowerBreakeven.toString(),
        underlyingPrice: "0", // Fetch current price
        status: "active",
        currentValue: "0",
        unrealizedPnl: "0",
      });
      
      res.json({ success: true, strategy });
    } catch (error: any) {
      console.error("Error creating options strategy:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to create strategy" 
      });
    }
  });
  
  // Place an options order
  app.post("/api/aevo/orders", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate request body
      const schema = z.object({
        instrumentId: z.string(),
        instrumentName: z.string(),
        strategyId: z.string().optional(),
        asset: z.string(),
        optionType: z.enum(["call", "put"]),
        strike: z.number().positive(),
        expiry: z.string(),
        side: z.enum(["buy", "sell"]),
        orderType: z.enum(["market", "limit"]),
        size: z.number().positive(),
        limitPrice: z.number().positive().optional(),
      });
      
      const orderData = schema.parse(req.body);
      
      // Get user's Aevo API credentials
      // For now, return mock response until live integration
      // In production, this would:
      // 1. Get user's Aevo API key from encrypted storage
      // 2. Initialize AevoClient
      // 3. Place order via AevoClient.placeOrder()
      
      // Store order in database
      const order = await storage.createOptionsOrder(userId, {
        strategyId: orderData.strategyId || null,
        instrumentId: orderData.instrumentId,
        instrumentName: orderData.instrumentName,
        asset: orderData.asset,
        optionType: orderData.optionType,
        strike: orderData.strike.toString(),
        expiry: new Date(orderData.expiry),
        side: orderData.side,
        orderType: orderData.orderType,
        size: orderData.size.toString(),
        filledSize: "0",
        limitPrice: orderData.limitPrice?.toString(),
        status: "pending",
      });
      
      res.json({ 
        success: true, 
        order,
        message: "Order placed successfully (mock response)" 
      });
    } catch (error: any) {
      console.error("Error placing options order:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to place order" 
      });
    }
  });
  
  // Cancel an options order
  app.delete("/api/aevo/orders/:orderId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orderId } = req.params;
      
      // Get order to verify ownership
      const order = await storage.getOptionsOrderById(orderId);
      if (!order || order.userId !== userId) {
        return res.status(404).json({ 
          success: false, 
          error: "Order not found" 
        });
      }
      
      // Cancel order via Aevo API (mock for now)
      // In production: aevoClient.cancelOrder(order.aevoOrderId)
      
      // Update order status in database
      await storage.updateOptionsOrder(orderId, { 
        status: "cancelled",
        cancelledAt: new Date(),
      });
      
      res.json({ 
        success: true, 
        message: "Order cancelled successfully" 
      });
    } catch (error: any) {
      console.error("Error cancelling options order:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to cancel order" 
      });
    }
  });

  // Execute multi-leg options strategy
  app.post("/api/aevo/execute-strategy", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate request body
      const schema = z.object({
        strategyName: z.string(),
        strategyType: z.string(),
        asset: z.string(),
        underlyingPrice: z.number().positive(),
        legs: z.array(z.object({
          instrumentId: z.string(),
          instrumentName: z.string(),
          optionType: z.enum(["call", "put"]),
          strike: z.number().positive(),
          expiry: z.string(),
          side: z.enum(["buy", "sell"]),
          size: z.number().positive(),
          estimatedPrice: z.number().positive(),
          greeks: z.object({
            delta: z.number().optional(),
            gamma: z.number().optional(),
            theta: z.number().optional(),
            vega: z.number().optional(),
            iv: z.number().optional(),
          }).optional(),
        })),
        totalCost: z.number().positive(),
        maxProfit: z.number().positive().nullable(),
        maxLoss: z.number().positive(),
        upperBreakeven: z.number().positive().nullable(),
        lowerBreakeven: z.number().positive().nullable(),
      });
      
      const strategyData = schema.parse(req.body);
      
      // TODO: Get user's Aevo API credentials from encrypted storage
      // For now, we'll create the strategy and mock the execution
      
      // 1. Create strategy record
      const strategy = await storage.createOptionsStrategy(userId, {
        name: strategyData.strategyName,
        type: strategyData.strategyType,
        asset: strategyData.asset,
        strike: strategyData.legs[0]?.strike.toString() || null,
        expiry: new Date(strategyData.legs[0]?.expiry || Date.now()),
        totalCost: strategyData.totalCost.toString(),
        maxProfit: strategyData.maxProfit?.toString() || null,
        maxLoss: strategyData.maxLoss.toString(),
        upperBreakeven: strategyData.upperBreakeven?.toString() || null,
        lowerBreakeven: strategyData.lowerBreakeven?.toString() || null,
        underlyingPrice: strategyData.underlyingPrice.toString(),
        status: "active",
        currentValue: "0",
        unrealizedPnl: "0",
      });
      
      // 2. Execute each leg sequentially with error recovery
      const results = [];
      const errors = [];
      
      for (let i = 0; i < strategyData.legs.length; i++) {
        const leg = strategyData.legs[i];
        
        try {
          // Create order record
          const order = await storage.createOptionsOrder(userId, {
            strategyId: strategy.id,
            instrumentId: leg.instrumentId,
            instrumentName: leg.instrumentName,
            asset: strategyData.asset,
            optionType: leg.optionType,
            strike: leg.strike.toString(),
            expiry: new Date(leg.expiry),
            side: leg.side,
            orderType: "market", // Start with market orders for simplicity
            size: leg.size.toString(),
            filledSize: "0",
            status: "pending",
          });
          
          // TODO: Place actual order via AevoClient
          // const aevoClient = await getAevoClient(userId);
          // const aevoOrder = await aevoClient.placeOrder({
          //   instrument: leg.instrumentId,
          //   is_buy: leg.side === "buy",
          //   amount: (leg.size * 1_000_000).toString(), // Convert to 6 decimals
          //   order_type: "market",
          // });
          
          // Mock successful execution for now
          await storage.updateOptionsOrder(order.id, {
            status: "filled",
            filledSize: leg.size.toString(),
            averageFillPrice: leg.estimatedPrice.toString(),
            filledAt: new Date(),
          });
          
          // Create position record
          const position = await storage.createOptionsPosition(userId, {
            strategyId: strategy.id,
            instrumentId: leg.instrumentId,
            instrumentName: leg.instrumentName,
            asset: strategyData.asset,
            optionType: leg.optionType,
            strike: leg.strike.toString(),
            expiry: new Date(leg.expiry),
            side: leg.side === "buy" ? "long" : "short",
            size: leg.size.toString(),
            entryPrice: leg.estimatedPrice.toString(),
            currentPrice: leg.estimatedPrice.toString(),
            delta: leg.greeks?.delta?.toString() || null,
            gamma: leg.greeks?.gamma?.toString() || null,
            theta: leg.greeks?.theta?.toString() || null,
            vega: leg.greeks?.vega?.toString() || null,
            impliedVolatility: leg.greeks?.iv?.toString() || null,
            unrealizedPnl: "0",
            unrealizedPnlPercent: "0",
            status: "open",
          });
          
          results.push({
            legIndex: i,
            orderId: order.id,
            positionId: position.id,
            status: "filled",
            fillPrice: leg.estimatedPrice,
          });
          
        } catch (legError: any) {
          console.error(`Error executing leg ${i}:`, legError);
          errors.push({
            legIndex: i,
            error: legError.message,
          });
          
          // If a leg fails, mark strategy as failed and stop execution
          await storage.updateOptionsStrategy(userId, strategy.id, {
            status: "closed",
          });
          
          throw new Error(`Leg ${i + 1} failed: ${legError.message}`);
        }
      }
      
      // 3. Update strategy with current values
      const currentValue = results.reduce((sum, r) => sum + r.fillPrice * strategyData.legs[r.legIndex].size, 0);
      await storage.updateOptionsStrategy(userId, strategy.id, {
        currentValue: currentValue.toString(),
        unrealizedPnl: (currentValue - strategyData.totalCost).toString(),
      });
      
      res.json({ 
        success: true, 
        strategy,
        results,
        message: `Successfully executed ${results.length} legs` 
      });
      
    } catch (error: any) {
      console.error("Error executing options strategy:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to execute strategy" 
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

  app.delete("/api/trade-journal", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Delete all trade journal entries for this user
      await storage.deleteAllTradeJournalEntries(userId);

      res.json({
        success: true,
        message: "All journal entries deleted successfully"
      });
    } catch (error: any) {
      console.error("Error deleting all journal entries:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete all journal entries"
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
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: "name is required"
        });
      }
      
      // Auto-analyze strategy if custom rules provided
      let strategyConfig: any = null;
      if (parameters?.customRules) {
        try {
          const { analyzeStrategy } = await import('./strategyAnalyzer');
          console.log('[Strategy Auto-Config] Analyzing custom rules for new strategy...');
          strategyConfig = await analyzeStrategy(parameters.customRules, description || '');
          console.log('[Strategy Auto-Config] Analysis complete:', {
            strategyType: strategyConfig.strategyType,
            monitoringFrequency: strategyConfig.monitoringFrequencyMinutes,
            triggerMode: strategyConfig.triggerMode
          });
        } catch (analyzeError) {
          console.error('[Strategy Auto-Config] Failed to analyze strategy:', analyzeError);
          // Continue without strategyConfig - it's optional
        }
      }
      
      const mode = await storage.createTradingMode(userId, {
        name,
        type: type || "custom", // Default to "custom" if not provided
        description: description || null,
        parameters: parameters || {},
        strategyConfig,
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
      
      // Auto-analyze strategy if custom rules were updated
      if (parameters?.customRules) {
        try {
          const { analyzeStrategy } = await import('./strategyAnalyzer');
          console.log('[Strategy Auto-Config] Re-analyzing custom rules for updated strategy...');
          const strategyConfig = await analyzeStrategy(parameters.customRules, description || '');
          updates.strategyConfig = strategyConfig;
          console.log('[Strategy Auto-Config] Re-analysis complete:', {
            strategyType: strategyConfig.strategyType,
            monitoringFrequency: strategyConfig.monitoringFrequencyMinutes,
            triggerMode: strategyConfig.triggerMode
          });
        } catch (analyzeError) {
          console.error('[Strategy Auto-Config] Failed to re-analyze strategy:', analyzeError);
          // Continue without updating strategyConfig
        }
      }
      
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

  app.post("/api/trading-modes/deactivate-all", requireVerifiedUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Deactivate all trading modes for this user (enable general conversation mode)
      await storage.deactivateAllTradingModes(userId);
      
      res.json({
        success: true,
        message: "All trading modes deactivated - general conversation mode enabled"
      });
    } catch (error: any) {
      console.error("Error deactivating all trading modes:", error);
      res.status(500).json({
        success: false,
        error: "Failed to deactivate trading modes"
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

  // Admin routes
  app.get("/api/admin/usage-stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminUsageStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      console.error("Error getting admin usage stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get usage statistics"
      });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove sensitive data
      const sanitizedUsers = users.map(user => ({
        ...user,
        password: undefined,
        authProviderId: undefined
      }));
      
      res.json({
        success: true,
        users: sanitizedUsers
      });
    } catch (error: any) {
      console.error("Error getting users:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get users"
      });
    }
  });

  app.patch("/api/admin/users/:userId/role", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          error: "Invalid role. Must be 'user' or 'admin'"
        });
      }
      
      const user = await storage.updateUser(userId, { role });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found"
        });
      }
      
      res.json({
        success: true,
        user: {
          ...user,
          password: undefined,
          authProviderId: undefined
        }
      });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update user role"
      });
    }
  });

  // Panel Layout Routes
  app.get("/api/panel-layouts/:tab", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { tab } = req.params;
      
      const layout = await storage.getPanelLayout(userId, tab);
      
      if (!layout) {
        return res.status(404).json({
          success: false,
          error: "Layout not found"
        });
      }
      
      res.json(layout);
    } catch (error: any) {
      console.error("Error getting panel layout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get panel layout"
      });
    }
  });

  app.post("/api/panel-layouts/:tab", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { tab } = req.params;
      const { layoutData } = req.body;
      
      if (!layoutData) {
        return res.status(400).json({
          success: false,
          error: "layoutData is required"
        });
      }
      
      const layout = await storage.savePanelLayout(userId, tab, layoutData);
      
      res.json({
        success: true,
        layout
      });
    } catch (error: any) {
      console.error("Error saving panel layout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save panel layout"
      });
    }
  });

  app.delete("/api/panel-layouts/:tab", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { tab } = req.params;
      
      await storage.deletePanelLayout(userId, tab);
      
      res.json({
        success: true
      });
    } catch (error: any) {
      console.error("Error deleting panel layout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete panel layout"
      });
    }
  });

  app.get("/api/admin/budget", requireAdmin, async (req, res) => {
    try {
      const budget = await storage.getBudgetAlert();
      
      res.json({
        success: true,
        budget
      });
    } catch (error: any) {
      console.error("Error getting budget alert:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get budget settings"
      });
    }
  });

  app.post("/api/admin/budget", requireAdmin, async (req, res) => {
    try {
      const { monthlyBudget, alertEmail, enableAlerts } = req.body;
      
      const budget = await storage.upsertBudgetAlert({
        monthlyBudget: monthlyBudget ? String(monthlyBudget) : null,
        alertEmail: alertEmail || null,
        enableAlerts: enableAlerts ? 1 : 0
      });
      
      res.json({
        success: true,
        budget
      });
    } catch (error: any) {
      console.error("Error updating budget alert:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update budget settings"
      });
    }
  });

  // Advanced Orders Routes and Manager
  const { setupAdvancedOrdersRoutes } = await import("./advancedOrders/routes");
  const { setupAIOrderRoutes } = await import("./advancedOrders/aiRoutes");
  const { advancedOrderManager } = await import("./advancedOrders/manager");
  
  setupAdvancedOrdersRoutes(app);
  setupAIOrderRoutes(app);
  
  // Initialize advanced orders manager
  await advancedOrderManager.initialize();
  console.log("[Server] Advanced Orders Manager initialized");
  console.log("[Server] AI-Enhanced Order Routing enabled");

  const httpServer = createServer(app);

  // NOTE: WebSocket services will be initialized AFTER Vite HMR is set up
  // to ensure proper upgrade request handling order
  return httpServer;
}
