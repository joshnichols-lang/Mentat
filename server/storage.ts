import { type User, type InsertUser, type Trade, type InsertTrade, type Position, type InsertPosition, type PortfolioSnapshot, type InsertPortfolioSnapshot, type AiUsageLog, type InsertAiUsageLog, type MonitoringLog, type InsertMonitoringLog, users, trades, positions, portfolioSnapshots, aiUsageLog, monitoringLog } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Trade methods
  getTrades(limit?: number): Promise<Trade[]>;
  getTrade(id: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | undefined>;
  closeTrade(id: string, exitPrice: string, pnl: string): Promise<Trade | undefined>;
  
  // Position methods
  getPositions(): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  getPositionBySymbol(symbol: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, updates: Partial<Position>): Promise<Position | undefined>;
  deletePosition(id: string): Promise<void>;
  
  // Portfolio snapshot methods
  getPortfolioSnapshots(limit?: number): Promise<PortfolioSnapshot[]>;
  getLatestPortfolioSnapshot(): Promise<PortfolioSnapshot | undefined>;
  createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
  
  // AI Usage Log methods
  logAiUsage(log: InsertAiUsageLog): Promise<AiUsageLog>;
  getAiUsageLogs(limit?: number): Promise<AiUsageLog[]>;
  getTotalAiCost(): Promise<string>;
  
  // Monitoring Log methods
  createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog>;
  getMonitoringLogs(limit?: number): Promise<MonitoringLog[]>;
  getLatestMonitoringLog(): Promise<MonitoringLog | undefined>;
  dismissMonitoringLog(id: string): Promise<MonitoringLog | undefined>;
  getActiveMonitoringLogs(): Promise<MonitoringLog[]>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Trade methods
  async getTrades(limit: number = 100): Promise<Trade[]> {
    return await db.select().from(trades).orderBy(desc(trades.entryTimestamp)).limit(limit);
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const result = await db.select().from(trades).where(eq(trades.id, id)).limit(1);
    return result[0];
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const result = await db.insert(trades).values(trade).returning();
    return result[0];
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | undefined> {
    const result = await db.update(trades).set(updates).where(eq(trades.id, id)).returning();
    return result[0];
  }

  async closeTrade(id: string, exitPrice: string, pnl: string): Promise<Trade | undefined> {
    const result = await db.update(trades)
      .set({
        exitPrice,
        pnl,
        status: "closed",
        exitTimestamp: sql`now()`,
      })
      .where(eq(trades.id, id))
      .returning();
    return result[0];
  }

  // Position methods
  async getPositions(): Promise<Position[]> {
    return await db.select().from(positions).orderBy(desc(positions.lastUpdated));
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const result = await db.select().from(positions).where(eq(positions.id, id)).limit(1);
    return result[0];
  }

  async getPositionBySymbol(symbol: string): Promise<Position | undefined> {
    const result = await db.select().from(positions).where(eq(positions.symbol, symbol)).limit(1);
    return result[0];
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const result = await db.insert(positions).values(position).returning();
    return result[0];
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | undefined> {
    const result = await db.update(positions)
      .set({ ...updates, lastUpdated: sql`now()` })
      .where(eq(positions.id, id))
      .returning();
    return result[0];
  }

  async deletePosition(id: string): Promise<void> {
    await db.delete(positions).where(eq(positions.id, id));
  }

  // Portfolio snapshot methods
  async getPortfolioSnapshots(limit: number = 100): Promise<PortfolioSnapshot[]> {
    return await db.select().from(portfolioSnapshots).orderBy(desc(portfolioSnapshots.timestamp)).limit(limit);
  }

  async getLatestPortfolioSnapshot(): Promise<PortfolioSnapshot | undefined> {
    const result = await db.select().from(portfolioSnapshots).orderBy(desc(portfolioSnapshots.timestamp)).limit(1);
    return result[0];
  }

  async createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot> {
    const result = await db.insert(portfolioSnapshots).values(snapshot).returning();
    return result[0];
  }

  // AI Usage Log methods
  async logAiUsage(log: InsertAiUsageLog): Promise<AiUsageLog> {
    const result = await db.insert(aiUsageLog).values(log).returning();
    return result[0];
  }

  async getAiUsageLogs(limit: number = 100): Promise<AiUsageLog[]> {
    return await db.select().from(aiUsageLog).orderBy(desc(aiUsageLog.timestamp)).limit(limit);
  }

  async getTotalAiCost(): Promise<string> {
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(${aiUsageLog.estimatedCost}), 0)`
    }).from(aiUsageLog);
    return result[0]?.total || "0";
  }

  // Monitoring Log methods
  async createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog> {
    const result = await db.insert(monitoringLog).values(log).returning();
    return result[0];
  }

  async getMonitoringLogs(limit: number = 100): Promise<MonitoringLog[]> {
    return await db.select().from(monitoringLog).orderBy(desc(monitoringLog.timestamp)).limit(limit);
  }

  async getLatestMonitoringLog(): Promise<MonitoringLog | undefined> {
    const result = await db.select().from(monitoringLog).orderBy(desc(monitoringLog.timestamp)).limit(1);
    return result[0];
  }

  async dismissMonitoringLog(id: string): Promise<MonitoringLog | undefined> {
    const result = await db.update(monitoringLog)
      .set({ dismissed: 1 })
      .where(eq(monitoringLog.id, id))
      .returning();
    return result[0];
  }

  async getActiveMonitoringLogs(): Promise<MonitoringLog[]> {
    return await db.select()
      .from(monitoringLog)
      .where(eq(monitoringLog.dismissed, 0))
      .orderBy(desc(monitoringLog.timestamp));
  }
}

export const storage = new DbStorage();
