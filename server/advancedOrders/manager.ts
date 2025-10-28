/**
 * Advanced Order Manager - Singleton managing all advanced order engines
 */

import { AdvancedOrderExecutionEngine } from "./engine";
import { getHyperliquidClient, getUserHyperliquidClient } from "../hyperliquid/client";

class AdvancedOrderManager {
  private engines: Map<string, AdvancedOrderExecutionEngine> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log("[AdvancedOrderManager] Initializing...");
    this.isInitialized = true;
  }

  async getOrCreateEngine(userId: string): Promise<AdvancedOrderExecutionEngine> {
    // Check if engine exists for this user
    if (this.engines.has(userId)) {
      return this.engines.get(userId)!;
    }

    // Create new engine for user
    const hyperliquidClient = await getUserHyperliquidClient(userId);
    const engine = new AdvancedOrderExecutionEngine(hyperliquidClient);
    
    // Start the engine
    await engine.start();
    
    // Store it
    this.engines.set(userId, engine);
    
    console.log(`[AdvancedOrderManager] Created engine for user ${userId}`);
    return engine;
  }

  async getEngine(userId: string): Promise<AdvancedOrderExecutionEngine | null> {
    return this.engines.get(userId) || null;
  }

  async stopUserEngine(userId: string): Promise<void> {
    const engine = this.engines.get(userId);
    if (engine) {
      await engine.stop();
      this.engines.delete(userId);
      console.log(`[AdvancedOrderManager] Stopped engine for user ${userId}`);
    }
  }

  async shutdown(): Promise<void> {
    console.log("[AdvancedOrderManager] Shutting down all engines...");
    
    for (const [userId, engine] of this.engines.entries()) {
      await engine.stop();
    }
    
    this.engines.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const advancedOrderManager = new AdvancedOrderManager();
