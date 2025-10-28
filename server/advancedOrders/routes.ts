/**
 * Advanced Orders API Routes
 */

import { Router } from "express";
import { db } from "../db";
import { advancedOrders, advancedOrderExecutions, insertAdvancedOrderSchema } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { advancedOrderManager } from "./manager";

// Middleware to check if user is authenticated
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

export function setupAdvancedOrdersRoutes(router: Router) {
  
  // Get all advanced orders for a user
  router.get("/api/advanced-orders", requireAuth, async (req, res) => {
    try {

      const orders = await db
        .select()
        .from(advancedOrders)
        .where(eq(advancedOrders.userId, req.user.id))
        .orderBy(desc(advancedOrders.createdAt));

      res.json(orders);
    } catch (error) {
      console.error("[AdvancedOrders] Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch advanced orders" });
    }
  });

  // Get specific advanced order with executions
  router.get("/api/advanced-orders/:id", requireAuth, async (req, res) => {
    try {

      const order = await db.query.advancedOrders.findFirst({
        where: and(
          eq(advancedOrders.id, req.params.id),
          eq(advancedOrders.userId, req.user.id)
        ),
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const executions = await db
        .select()
        .from(advancedOrderExecutions)
        .where(eq(advancedOrderExecutions.advancedOrderId, req.params.id))
        .orderBy(advancedOrderExecutions.sequenceNumber);

      res.json({ order, executions });
    } catch (error) {
      console.error("[AdvancedOrders] Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order details" });
    }
  });

  // Create new advanced order
  router.post("/api/advanced-orders", requireAuth, async (req, res) => {
    try {

      // Validate request body
      const orderData = insertAdvancedOrderSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      // Validate order type specific parameters
      const validationError = validateOrderParameters(orderData.orderType, orderData.parameters);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      // Insert order
      const [order] = await db
        .insert(advancedOrders)
        .values(orderData)
        .returning();

      res.json(order);
    } catch (error) {
      console.error("[AdvancedOrders] Error creating order:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create order" 
      });
    }
  });

  // Start/execute an advanced order
  router.post("/api/advanced-orders/:id/execute", requireAuth, async (req, res) => {
    try {
      const order = await db.query.advancedOrders.findFirst({
        where: and(
          eq(advancedOrders.id, req.params.id),
          eq(advancedOrders.userId, req.user.id)
        ),
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.status === "active") {
        return res.status(400).json({ error: "Order is already active" });
      }

      // Get or create engine for user
      const engine = await advancedOrderManager.getOrCreateEngine(req.user.id);
      
      // Execute the order
      await engine.executeOrder(req.params.id);

      res.json({ success: true, message: "Order execution started" });
    } catch (error) {
      console.error("[AdvancedOrders] Error executing order:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to execute order" 
      });
    }
  });

  // Pause an advanced order
  router.post("/api/advanced-orders/:id/pause", requireAuth, async (req, res) => {
    try {
      const order = await db.query.advancedOrders.findFirst({
        where: and(
          eq(advancedOrders.id, req.params.id),
          eq(advancedOrders.userId, req.user.id)
        ),
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Get engine for user (must exist if order is active)
      const engine = await advancedOrderManager.getEngine(req.user.id);
      if (!engine) {
        return res.status(500).json({ error: "Order engine not found" });
      }
      
      await engine.pauseOrder(req.params.id);

      res.json({ success: true, message: "Order paused" });
    } catch (error) {
      console.error("[AdvancedOrders] Error pausing order:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to pause order" 
      });
    }
  });

  // Resume an advanced order
  router.post("/api/advanced-orders/:id/resume", requireAuth, async (req, res) => {
    try {
      const order = await db.query.advancedOrders.findFirst({
        where: and(
          eq(advancedOrders.id, req.params.id),
          eq(advancedOrders.userId, req.user.id)
        ),
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Get or create engine for user
      const engine = await advancedOrderManager.getOrCreateEngine(req.user.id);
      
      await engine.resumeOrder(req.params.id);

      res.json({ success: true, message: "Order resumed" });
    } catch (error) {
      console.error("[AdvancedOrders] Error resuming order:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to resume order" 
      });
    }
  });

  // Cancel an advanced order
  router.post("/api/advanced-orders/:id/cancel", requireAuth, async (req, res) => {
    try {
      const order = await db.query.advancedOrders.findFirst({
        where: and(
          eq(advancedOrders.id, req.params.id),
          eq(advancedOrders.userId, req.user.id)
        ),
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Get engine for user (must exist if order is active)
      const engine = await advancedOrderManager.getEngine(req.user.id);
      if (!engine) {
        return res.status(500).json({ error: "Order engine not found" });
      }
      
      await engine.cancelOrder(req.params.id);

      res.json({ success: true, message: "Order cancelled" });
    } catch (error) {
      console.error("[AdvancedOrders] Error cancelling order:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to cancel order" 
      });
    }
  });
}

// Validate order type specific parameters
function validateOrderParameters(orderType: string, parameters: any): string | null {
  try {
    switch (orderType) {
      case "twap":
        const twapSchema = z.object({
          durationMinutes: z.number().positive(),
          slices: z.number().int().min(2),
          intervalSeconds: z.number().positive().optional(),
          priceLimit: z.string().optional(),
          randomizeIntervals: z.boolean().optional(),
          adaptToVolume: z.boolean().optional(),
        });
        twapSchema.parse(parameters);
        break;

      case "limit_chase":
        const chaseSchema = z.object({
          offset: z.number(),
          maxChases: z.number().int().positive(),
          chaseIntervalSeconds: z.number().positive(),
          priceLimit: z.string().optional(),
          giveBehavior: z.enum(["cancel", "market", "wait"]).optional(),
        });
        chaseSchema.parse(parameters);
        break;

      case "scaled":
        const scaledSchema = z.object({
          levels: z.number().int().min(2),
          priceStart: z.string(),
          priceEnd: z.string(),
          distribution: z.enum(["linear", "geometric", "custom"]),
          sizeDistribution: z.array(z.number()).optional(),
        });
        scaledSchema.parse(parameters);
        break;

      case "iceberg":
        const icebergSchema = z.object({
          displaySize: z.string(),
          totalSize: z.string(),
          priceLimit: z.string(),
          refreshBehavior: z.enum(["immediate", "delayed"]),
          refreshDelaySeconds: z.number().positive().optional(),
        });
        icebergSchema.parse(parameters);
        break;

      case "oco":
        const ocoSchema = z.object({
          orders: z.tuple([
            z.object({
              type: z.enum(["limit", "stop"]),
              price: z.string(),
              size: z.string(),
            }),
            z.object({
              type: z.enum(["limit", "stop"]),
              price: z.string(),
              size: z.string(),
            }),
          ]),
        });
        ocoSchema.parse(parameters);
        break;

      case "trailing_tp":
        const trailingSchema = z.object({
          positionId: z.string(),
          trailDistance: z.string(),
          minProfit: z.string(),
          updateIntervalSeconds: z.number().positive(),
        });
        trailingSchema.parse(parameters);
        break;

      default:
        return `Unknown order type: ${orderType}`;
    }

    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return `Invalid parameters: ${error.errors.map(e => e.message).join(", ")}`;
    }
    return "Invalid order parameters";
  }
}
