/**
 * Advanced Order Execution Engine
 * 
 * Manages execution of institutional-grade order types:
 * - TWAP (Time-Weighted Average Price)
 * - Limit Chase
 * - Scaled/Ladder Orders
 * - Iceberg Orders
 * - OCO (One-Cancels-Other)
 * - Trailing Take-Profit
 * - Grid Trading
 * - Conditional Orders
 */

import { db } from "../db";
import { advancedOrders, advancedOrderExecutions, InsertAdvancedOrderExecution } from "../../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { HyperliquidClient } from "../hyperliquid/client";

export interface AdvancedOrderEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  executeOrder(orderId: string): Promise<void>;
  pauseOrder(orderId: string): Promise<void>;
  resumeOrder(orderId: string): Promise<void>;
  cancelOrder(orderId: string): Promise<void>;
}

// TWAP Parameters
export interface TWAPParameters {
  durationMinutes: number; // Total execution time
  slices: number; // Number of sub-orders
  intervalSeconds?: number; // Override calculated interval
  priceLimit?: string; // Maximum price for buys, minimum for sells
  randomizeIntervals?: boolean; // Add ±20% variance to intervals (anti-gaming)
  adaptToVolume?: boolean; // Adjust slice sizes based on market volume
}

// Limit Chase Parameters
export interface LimitChaseParameters {
  offset: number; // Ticks from best bid/ask (positive = more aggressive)
  maxChases: number; // Maximum number of price adjustments
  chaseIntervalSeconds: number; // How often to check and adjust
  priceLimit?: string; // Don't chase beyond this price
  giveBehavior?: "cancel" | "market" | "wait"; // What to do if market moves away
}

// Scaled Order Parameters
export interface ScaledOrderParameters {
  levels: number; // Number of orders to place
  priceStart: string; // First order price
  priceEnd: string; // Last order price
  distribution: "linear" | "geometric" | "custom"; // How to distribute size
  sizeDistribution?: number[]; // Custom size per level (must sum to 1.0)
}

// Iceberg Parameters
export interface IcebergParameters {
  displaySize: string; // Visible order size
  totalSize: string; // Total hidden size
  priceLimit: string; // Limit price
  refreshBehavior: "immediate" | "delayed"; // How quickly to refresh after fill
  refreshDelaySeconds?: number; // Delay before placing next slice
}

// OCO Parameters
export interface OCOParameters {
  orders: [
    { type: "limit" | "stop"; price: string; size: string },
    { type: "limit" | "stop"; price: string; size: string }
  ];
}

// Trailing Take-Profit Parameters
export interface TrailingTPParameters {
  positionId: string; // Position to protect
  trailDistance: string; // Distance from high water mark (percentage)
  minProfit: string; // Minimum profit before trailing activates
  updateIntervalSeconds: number; // How often to check and adjust
}

export class AdvancedOrderExecutionEngine implements AdvancedOrderEngine {
  private activeOrders: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;
  private hyperliquidClient: HyperliquidClient;

  constructor(hyperliquidClient: HyperliquidClient) {
    this.hyperliquidClient = hyperliquidClient;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log("[AdvancedOrders] Engine started");

    // Resume any active orders that were interrupted
    const activeOrders = await db
      .select()
      .from(advancedOrders)
      .where(eq(advancedOrders.status, "active"));

    for (const order of activeOrders) {
      await this.scheduleOrder(order);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Clear all scheduled executions
    this.activeOrders.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.activeOrders.clear();
    
    console.log("[AdvancedOrders] Engine stopped");
  }

  async executeOrder(orderId: string): Promise<void> {
    const order = await db.query.advancedOrders.findFirst({
      where: eq(advancedOrders.id, orderId),
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Mark as active and schedule execution
    await db
      .update(advancedOrders)
      .set({ 
        status: "active",
        startedAt: new Date(),
      })
      .where(eq(advancedOrders.id, orderId));

    await this.scheduleOrder(order);
  }

  async pauseOrder(orderId: string): Promise<void> {
    // Clear scheduled execution
    const timeout = this.activeOrders.get(orderId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeOrders.delete(orderId);
    }

    // Update status
    await db
      .update(advancedOrders)
      .set({ status: "paused" })
      .where(eq(advancedOrders.id, orderId));

    console.log(`[AdvancedOrders] Order ${orderId} paused`);
  }

  async resumeOrder(orderId: string): Promise<void> {
    const order = await db.query.advancedOrders.findFirst({
      where: eq(advancedOrders.id, orderId),
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    await db
      .update(advancedOrders)
      .set({ status: "active" })
      .where(eq(advancedOrders.id, orderId));

    await this.scheduleOrder(order);
    console.log(`[AdvancedOrders] Order ${orderId} resumed`);
  }

  async cancelOrder(orderId: string): Promise<void> {
    // Clear scheduled execution
    const timeout = this.activeOrders.get(orderId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeOrders.delete(orderId);
    }

    // Cancel any pending child orders on exchange
    const order = await db.query.advancedOrders.findFirst({
      where: eq(advancedOrders.id, orderId),
    });

    if (order?.childOrderIds && order.childOrderIds.length > 0) {
      // TODO: Cancel orders on Hyperliquid
      console.log(`[AdvancedOrders] Cancelling ${order.childOrderIds.length} child orders`);
    }

    // Update status
    await db
      .update(advancedOrders)
      .set({ 
        status: "cancelled",
        cancelledAt: new Date(),
      })
      .where(eq(advancedOrders.id, orderId));

    console.log(`[AdvancedOrders] Order ${orderId} cancelled`);
  }

  private async scheduleOrder(order: any): Promise<void> {
    switch (order.orderType) {
      case "twap":
        await this.scheduleTWAP(order);
        break;
      case "limit_chase":
        await this.scheduleLimitChase(order);
        break;
      case "scaled":
        await this.executeScaled(order);
        break;
      case "iceberg":
        await this.scheduleIceberg(order);
        break;
      case "oco":
        await this.executeOCO(order);
        break;
      case "trailing_tp":
        await this.scheduleTrailingTP(order);
        break;
      default:
        console.error(`[AdvancedOrders] Unknown order type: ${order.orderType}`);
    }
  }

  private async scheduleTWAP(order: any): Promise<void> {
    const params = order.parameters as TWAPParameters;
    const remainingSize = parseFloat(order.totalSize) - parseFloat(order.executedSize);
    
    if (remainingSize <= 0) {
      await this.completeOrder(order.id);
      return;
    }

    // Calculate interval between slices
    const executedSlices = order.executionLog?.length || 0;
    const remainingSlices = params.slices - executedSlices;
    
    if (remainingSlices <= 0) {
      await this.completeOrder(order.id);
      return;
    }

    const intervalMs = params.intervalSeconds
      ? params.intervalSeconds * 1000
      : (params.durationMinutes * 60 * 1000) / params.slices;

    // Add randomization if enabled (±20%)
    const actualInterval = params.randomizeIntervals
      ? intervalMs * (0.8 + Math.random() * 0.4)
      : intervalMs;

    // Calculate slice size
    const sliceSize = remainingSize / remainingSlices;

    // Schedule next slice execution
    const timeout = setTimeout(async () => {
      await this.executeTWAPSlice(order.id, sliceSize, executedSlices + 1);
      
      // Schedule next slice
      await this.scheduleTWAP(order);
    }, actualInterval);

    this.activeOrders.set(order.id, timeout);
  }

  private async executeTWAPSlice(orderId: string, size: number, sequenceNumber: number): Promise<void> {
    try {
      const order = await db.query.advancedOrders.findFirst({
        where: eq(advancedOrders.id, orderId),
      });

      if (!order || order.status !== "active") {
        return;
      }

      const params = order.parameters as TWAPParameters;

      // Get current market price
      // TODO: Fetch from market data service
      const marketPrice = "50000"; // Placeholder

      // Place child order on Hyperliquid
      // TODO: Integrate with Hyperliquid client
      const childOrderId = `twap_${orderId}_${sequenceNumber}`;

      // Record execution
      const execution: InsertAdvancedOrderExecution = {
        advancedOrderId: orderId,
        sequenceNumber,
        hyperliquidOrderId: childOrderId,
        orderType: params.priceLimit ? "limit" : "market",
        size: size.toString(),
        limitPrice: params.priceLimit,
        status: "submitted",
        filledSize: "0",
        marketPrice,
        executionReason: `TWAP slice ${sequenceNumber}/${params.slices}`,
      };

      await db.insert(advancedOrderExecutions).values(execution);

      // Update parent order
      const newExecutedSize = parseFloat(order.executedSize) + size;
      const progress = (newExecutedSize / parseFloat(order.totalSize)) * 100;

      await db
        .update(advancedOrders)
        .set({
          executedSize: newExecutedSize.toString(),
          progress: progress.toString(),
          childOrderIds: [...(order.childOrderIds || []), childOrderId],
          lastExecutionAt: new Date(),
          executionLog: [
            ...(order.executionLog || []),
            {
              timestamp: new Date().toISOString(),
              action: "slice_executed",
              size: size.toString(),
              sequenceNumber,
            },
          ],
        })
        .where(eq(advancedOrders.id, orderId));

      console.log(`[TWAP] Executed slice ${sequenceNumber} for order ${orderId}: ${size} @ ${marketPrice}`);
    } catch (error) {
      console.error(`[TWAP] Error executing slice for order ${orderId}:`, error);
      
      await db
        .update(advancedOrders)
        .set({
          errorCount: (order: any) => order.errorCount + 1,
          lastError: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(advancedOrders.id, orderId));
    }
  }

  private async scheduleLimitChase(order: any): Promise<void> {
    // TODO: Implement Limit Chase scheduling
    console.log("[LimitChase] Scheduling order:", order.id);
  }

  private async executeScaled(order: any): Promise<void> {
    // Execute all scaled orders immediately (they're just limit orders at different prices)
    const params = order.parameters as ScaledOrderParameters;
    
    // TODO: Calculate price levels and place orders
    console.log("[Scaled] Executing order:", order.id);
  }

  private async scheduleIceberg(order: any): Promise<void> {
    // TODO: Implement Iceberg scheduling
    console.log("[Iceberg] Scheduling order:", order.id);
  }

  private async executeOCO(order: any): Promise<void> {
    // Place both orders, set up monitoring to cancel one when other fills
    const params = order.parameters as OCOParameters;
    
    // TODO: Place OCO orders
    console.log("[OCO] Executing order:", order.id);
  }

  private async scheduleTrailingTP(order: any): Promise<void> {
    // TODO: Implement Trailing TP scheduling
    console.log("[TrailingTP] Scheduling order:", order.id);
  }

  private async completeOrder(orderId: string): Promise<void> {
    // Clear scheduled execution
    const timeout = this.activeOrders.get(orderId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeOrders.delete(orderId);
    }

    // Calculate final metrics
    const order = await db.query.advancedOrders.findFirst({
      where: eq(advancedOrders.id, orderId),
    });

    if (!order) return;

    const executions = await db
      .select()
      .from(advancedOrderExecutions)
      .where(eq(advancedOrderExecutions.advancedOrderId, orderId));

    // Calculate average execution price
    let totalValue = 0;
    let totalSize = 0;
    
    for (const exec of executions) {
      if (exec.averagePrice && exec.filledSize) {
        totalValue += parseFloat(exec.averagePrice) * parseFloat(exec.filledSize);
        totalSize += parseFloat(exec.filledSize);
      }
    }

    const averageExecutionPrice = totalSize > 0 ? (totalValue / totalSize).toString() : null;

    await db
      .update(advancedOrders)
      .set({
        status: "completed",
        progress: "100",
        completedAt: new Date(),
        averageExecutionPrice,
      })
      .where(eq(advancedOrders.id, orderId));

    console.log(`[AdvancedOrders] Order ${orderId} completed`);
  }
}
