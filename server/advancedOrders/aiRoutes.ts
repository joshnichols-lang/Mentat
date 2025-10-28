/**
 * AI-Enhanced Order Routing API
 * 
 * Exposes Smart Order Router and Execution Optimizer capabilities
 */

import { Router } from "express";
import { smartOrderRouter } from "./smartOrderRouter";
import { executionOptimizer } from "./executionOptimizer";

// Middleware to check if user is authenticated
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

export function setupAIOrderRoutes(router: Router) {
  
  /**
   * Get optimal routing for an order
   */
  router.post("/api/advanced-orders/optimize-routing", requireAuth, async (req, res) => {
    try {
      const { symbol, side, size, urgency, maxSlippageBps } = req.body;
      
      if (!symbol || !side || !size) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const routing = await smartOrderRouter.routeOrder({
        symbol,
        side,
        size: parseFloat(size),
        urgency: urgency || 'medium',
        maxSlippageBps: maxSlippageBps ? parseFloat(maxSlippageBps) : undefined,
        userId: req.user.id,
      });
      
      res.json({
        success: true,
        routing,
      });
      
    } catch (error) {
      console.error('[AI Routes] Routing optimization failed:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to optimize routing' 
      });
    }
  });
  
  /**
   * Get AI-optimized execution parameters
   */
  router.post("/api/advanced-orders/optimize-params", requireAuth, async (req, res) => {
    try {
      const { orderType, symbol, side, size, baseParams } = req.body;
      
      if (!orderType || !symbol || !side || !size) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const optimized = await executionOptimizer.optimizeExecution({
        orderType,
        symbol,
        side,
        size: parseFloat(size),
        baseParams: baseParams || {},
        userId: req.user.id,
      });
      
      res.json({
        success: true,
        optimized,
      });
      
    } catch (error) {
      console.error('[AI Routes] Parameter optimization failed:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to optimize parameters' 
      });
    }
  });
  
  /**
   * Get real-time execution adjustments
   */
  router.post("/api/advanced-orders/:id/runtime-optimization", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { symbol, currentProgress, executedSlippage } = req.body;
      
      if (!symbol || currentProgress === undefined || executedSlippage === undefined) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const adjustments = await executionOptimizer.getRuntimeAdjustments({
        orderId,
        symbol,
        currentProgress: parseFloat(currentProgress),
        executedSlippage: parseFloat(executedSlippage),
        userId: req.user.id,
      });
      
      res.json({
        success: true,
        adjustments,
      });
      
    } catch (error) {
      console.error('[AI Routes] Runtime optimization failed:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get runtime adjustments' 
      });
    }
  });
}
