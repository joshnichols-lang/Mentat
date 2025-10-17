import { type User, type InsertUser, type UpsertUser, type Trade, type InsertTrade, type Position, type InsertPosition, type PortfolioSnapshot, type InsertPortfolioSnapshot, type AiUsageLog, type InsertAiUsageLog, type MonitoringLog, type InsertMonitoringLog, type UserApiCredential, type InsertUserApiCredential, type ApiKey, type InsertApiKey, users, trades, positions, portfolioSnapshots, aiUsageLog, monitoringLog, userApiCredentials, apiKeys } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, type SQL } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// Helper function for userId-scoped conditions
function withUserFilter<T extends { userId: any }>(
  table: T,
  userId: string,
  ...conditions: SQL[]
): SQL {
  const userCondition = eq(table.userId, userId);
  return conditions.length > 0 
    ? and(userCondition, ...conditions)! 
    : userCondition;
}

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserMonitoringFrequency(userId: string, minutes: number): Promise<User | undefined>;
  updateUserAgentMode(userId: string, mode: "passive" | "active"): Promise<User | undefined>;
  updateUserWalletAddress(userId: string, walletAddress: string): Promise<User | undefined>;
  updateUserVerificationStatus(userId: string, status: "pending" | "approved" | "rejected"): Promise<User | undefined>;
  getPendingVerificationUsers(): Promise<User[]>;
  
  // Trade methods (multi-tenant)
  getTrades(userId: string, limit?: number): Promise<Trade[]>;
  getTrade(userId: string, id: string): Promise<Trade | undefined>;
  createTrade(userId: string, trade: InsertTrade): Promise<Trade>;
  updateTrade(userId: string, id: string, updates: Partial<Trade>): Promise<Trade | undefined>;
  closeTrade(userId: string, id: string, exitPrice: string, pnl: string): Promise<Trade | undefined>;
  
  // Position methods (multi-tenant)
  getPositions(userId: string): Promise<Position[]>;
  getPosition(userId: string, id: string): Promise<Position | undefined>;
  getPositionBySymbol(userId: string, symbol: string): Promise<Position | undefined>;
  createPosition(userId: string, position: InsertPosition): Promise<Position>;
  updatePosition(userId: string, id: string, updates: Partial<Position>): Promise<Position | undefined>;
  deletePosition(userId: string, id: string): Promise<void>;
  
  // Portfolio snapshot methods (multi-tenant)
  getPortfolioSnapshots(userId: string, limit?: number): Promise<PortfolioSnapshot[]>;
  getPortfolioSnapshotsSince(userId: string, hours: number): Promise<PortfolioSnapshot[]>;
  getLatestPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | undefined>;
  createPortfolioSnapshot(userId: string, snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
  
  // AI Usage Log methods (multi-tenant)
  logAiUsage(userId: string, log: InsertAiUsageLog): Promise<AiUsageLog>;
  getAiUsageLogs(userId: string, limit?: number): Promise<AiUsageLog[]>;
  getTotalAiCost(userId: string): Promise<string>;
  getAiUsageStats(userId: string): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCost: string;
  }>;
  
  // Monitoring Log methods (multi-tenant)
  createMonitoringLog(userId: string, log: InsertMonitoringLog): Promise<MonitoringLog>;
  getMonitoringLogs(userId: string, limit?: number): Promise<MonitoringLog[]>;
  getLatestMonitoringLog(userId: string): Promise<MonitoringLog | undefined>;
  dismissMonitoringLog(userId: string, id: string): Promise<MonitoringLog | undefined>;
  getActiveMonitoringLogs(userId: string): Promise<MonitoringLog[]>;
  
  // User API Credentials methods
  getUserCredentials(userId: string): Promise<UserApiCredential | null>;
  createUserCredentials(credential: InsertUserApiCredential): Promise<UserApiCredential>;
  updateUserCredentials(userId: string, updates: Partial<UserApiCredential>): Promise<UserApiCredential | undefined>;
  deleteUserCredentials(userId: string): Promise<void>;
  
  // Multi-provider API Keys methods
  createApiKey(userId: string, apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKey(userId: string, id: string): Promise<ApiKey | undefined>;
  getApiKeysByProvider(userId: string, providerType: string, providerName: string): Promise<ApiKey[]>;
  getActiveApiKeyByProvider(userId: string, providerType: string, providerName: string): Promise<ApiKey | undefined>;
  updateApiKeyLastUsed(userId: string, id: string): Promise<void>;
  deleteApiKey(userId: string, id: string): Promise<void>;
}

const PostgresSessionStore = connectPg(session);

export class DbStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'sessions'
    });
  }

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

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        ...userData,
        id: userData.id!,
        username: userData.username || `user_${userData.id}`,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return result[0];
  }

  async updateUserMonitoringFrequency(userId: string, minutes: number): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        monitoringFrequencyMinutes: minutes,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserAgentMode(userId: string, mode: "passive" | "active"): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        agentMode: mode,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserWalletAddress(userId: string, walletAddress: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        walletAddress,
        verificationStatus: "pending", // Reset to pending when wallet address changes
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserVerificationStatus(userId: string, status: "pending" | "approved" | "rejected"): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        verificationStatus: status,
        verifiedAt: status === "approved" ? sql`now()` : null,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getPendingVerificationUsers(): Promise<User[]> {
    return await db.select()
      .from(users)
      .where(eq(users.verificationStatus, "pending"))
      .orderBy(desc(users.createdAt));
  }

  // Trade methods
  async getTrades(userId: string, limit: number = 100): Promise<Trade[]> {
    return await db.select().from(trades)
      .where(withUserFilter(trades, userId))
      .orderBy(desc(trades.entryTimestamp))
      .limit(limit);
  }

  async getTrade(userId: string, id: string): Promise<Trade | undefined> {
    const result = await db.select().from(trades)
      .where(withUserFilter(trades, userId, eq(trades.id, id)))
      .limit(1);
    return result[0];
  }

  async createTrade(userId: string, trade: InsertTrade): Promise<Trade> {
    const result = await db.insert(trades).values({ userId, ...trade }).returning();
    return result[0];
  }

  async updateTrade(userId: string, id: string, updates: Partial<Trade>): Promise<Trade | undefined> {
    const result = await db.update(trades)
      .set(updates)
      .where(withUserFilter(trades, userId, eq(trades.id, id)))
      .returning();
    return result[0];
  }

  async closeTrade(userId: string, id: string, exitPrice: string, pnl: string): Promise<Trade | undefined> {
    const result = await db.update(trades)
      .set({
        exitPrice,
        pnl,
        status: "closed",
        exitTimestamp: sql`now()`,
      })
      .where(withUserFilter(trades, userId, eq(trades.id, id)))
      .returning();
    return result[0];
  }

  // Position methods
  async getPositions(userId: string): Promise<Position[]> {
    return await db.select().from(positions)
      .where(withUserFilter(positions, userId))
      .orderBy(desc(positions.lastUpdated));
  }

  async getPosition(userId: string, id: string): Promise<Position | undefined> {
    const result = await db.select().from(positions)
      .where(withUserFilter(positions, userId, eq(positions.id, id)))
      .limit(1);
    return result[0];
  }

  async getPositionBySymbol(userId: string, symbol: string): Promise<Position | undefined> {
    const result = await db.select().from(positions)
      .where(withUserFilter(positions, userId, eq(positions.symbol, symbol)))
      .limit(1);
    return result[0];
  }

  async createPosition(userId: string, position: InsertPosition): Promise<Position> {
    const result = await db.insert(positions).values({ userId, ...position }).returning();
    return result[0];
  }

  async updatePosition(userId: string, id: string, updates: Partial<Position>): Promise<Position | undefined> {
    const result = await db.update(positions)
      .set({ ...updates, lastUpdated: sql`now()` })
      .where(withUserFilter(positions, userId, eq(positions.id, id)))
      .returning();
    return result[0];
  }

  async deletePosition(userId: string, id: string): Promise<void> {
    await db.delete(positions).where(withUserFilter(positions, userId, eq(positions.id, id)));
  }

  // Portfolio snapshot methods
  async getPortfolioSnapshots(userId: string, limit: number = 100): Promise<PortfolioSnapshot[]> {
    return await db.select().from(portfolioSnapshots)
      .where(withUserFilter(portfolioSnapshots, userId))
      .orderBy(desc(portfolioSnapshots.timestamp))
      .limit(limit);
  }

  async getPortfolioSnapshotsSince(userId: string, hours: number): Promise<PortfolioSnapshot[]> {
    // Use simple interval multiplication for safe interval construction
    const timeCondition = sql`${portfolioSnapshots.timestamp} >= now() - ${hours} * interval '1 hour'`;
    return await db.select()
      .from(portfolioSnapshots)
      .where(withUserFilter(portfolioSnapshots, userId, timeCondition))
      .orderBy(portfolioSnapshots.timestamp);
  }

  async getLatestPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | undefined> {
    const result = await db.select().from(portfolioSnapshots)
      .where(withUserFilter(portfolioSnapshots, userId))
      .orderBy(desc(portfolioSnapshots.timestamp))
      .limit(1);
    return result[0];
  }

  async createPortfolioSnapshot(userId: string, snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot> {
    const result = await db.insert(portfolioSnapshots).values({ userId, ...snapshot }).returning();
    return result[0];
  }

  // AI Usage Log methods
  async logAiUsage(userId: string, log: InsertAiUsageLog): Promise<AiUsageLog> {
    const result = await db.insert(aiUsageLog).values({ userId, ...log }).returning();
    return result[0];
  }

  async getAiUsageLogs(userId: string, limit: number = 100): Promise<AiUsageLog[]> {
    return await db.select().from(aiUsageLog)
      .where(withUserFilter(aiUsageLog, userId))
      .orderBy(desc(aiUsageLog.timestamp))
      .limit(limit);
  }

  async getTotalAiCost(userId: string): Promise<string> {
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(${aiUsageLog.estimatedCost}), 0)`
    }).from(aiUsageLog)
      .where(withUserFilter(aiUsageLog, userId));
    return result[0]?.total || "0";
  }

  async getAiUsageStats(userId: string): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCost: string;
  }> {
    const result = await db.select({
      totalRequests: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`COALESCE(SUM(${aiUsageLog.totalTokens}), 0)`,
      totalPromptTokens: sql<number>`COALESCE(SUM(${aiUsageLog.promptTokens}), 0)`,
      totalCompletionTokens: sql<number>`COALESCE(SUM(${aiUsageLog.completionTokens}), 0)`,
      totalCost: sql<string>`COALESCE(SUM(${aiUsageLog.estimatedCost}), 0)`,
    }).from(aiUsageLog)
      .where(withUserFilter(aiUsageLog, userId, eq(aiUsageLog.success, 1)));
    
    return result[0] || {
      totalRequests: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCost: "0"
    };
  }

  // Monitoring Log methods
  async createMonitoringLog(userId: string, log: InsertMonitoringLog): Promise<MonitoringLog> {
    const result = await db.insert(monitoringLog).values({ userId, ...log }).returning();
    return result[0];
  }

  async getMonitoringLogs(userId: string, limit: number = 100): Promise<MonitoringLog[]> {
    return await db.select().from(monitoringLog)
      .where(withUserFilter(monitoringLog, userId))
      .orderBy(desc(monitoringLog.timestamp))
      .limit(limit);
  }

  async getLatestMonitoringLog(userId: string): Promise<MonitoringLog | undefined> {
    const result = await db.select().from(monitoringLog)
      .where(withUserFilter(monitoringLog, userId))
      .orderBy(desc(monitoringLog.timestamp))
      .limit(1);
    return result[0];
  }

  async dismissMonitoringLog(userId: string, id: string): Promise<MonitoringLog | undefined> {
    const result = await db.update(monitoringLog)
      .set({ dismissed: 1 })
      .where(withUserFilter(monitoringLog, userId, eq(monitoringLog.id, id)))
      .returning();
    return result[0];
  }

  async getActiveMonitoringLogs(userId: string): Promise<MonitoringLog[]> {
    return await db.select()
      .from(monitoringLog)
      .where(withUserFilter(monitoringLog, userId, eq(monitoringLog.dismissed, 0)))
      .orderBy(desc(monitoringLog.timestamp));
  }

  // User API Credentials methods
  async getUserCredentials(userId: string): Promise<UserApiCredential | null> {
    const result = await db.select()
      .from(userApiCredentials)
      .where(eq(userApiCredentials.userId, userId))
      .limit(1);
    return result[0] || null;
  }

  async createUserCredentials(credential: InsertUserApiCredential): Promise<UserApiCredential> {
    const result = await db.insert(userApiCredentials).values(credential).returning();
    return result[0];
  }

  async updateUserCredentials(userId: string, updates: Partial<UserApiCredential>): Promise<UserApiCredential | undefined> {
    const result = await db.update(userApiCredentials)
      .set(updates)
      .where(eq(userApiCredentials.userId, userId))
      .returning();
    return result[0];
  }

  async deleteUserCredentials(userId: string): Promise<void> {
    await db.delete(userApiCredentials).where(eq(userApiCredentials.userId, userId));
  }

  // Multi-provider API Keys methods
  async createApiKey(userId: string, apiKey: InsertApiKey): Promise<ApiKey> {
    const result = await db.insert(apiKeys).values({
      ...apiKey,
      userId,
    }).returning();
    return result[0];
  }

  async getApiKeys(userId: string): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(withUserFilter(apiKeys, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(userId: string, id: string): Promise<ApiKey | undefined> {
    const result = await db.select()
      .from(apiKeys)
      .where(withUserFilter(apiKeys, userId, eq(apiKeys.id, id)))
      .limit(1);
    return result[0];
  }

  async getApiKeysByProvider(userId: string, providerType: string, providerName: string): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(
        withUserFilter(
          apiKeys, 
          userId, 
          eq(apiKeys.providerType, providerType),
          eq(apiKeys.providerName, providerName)
        )
      )
      .orderBy(desc(apiKeys.createdAt));
  }

  async getActiveApiKeyByProvider(userId: string, providerType: string, providerName: string): Promise<ApiKey | undefined> {
    const result = await db.select()
      .from(apiKeys)
      .where(
        withUserFilter(
          apiKeys,
          userId,
          eq(apiKeys.providerType, providerType),
          eq(apiKeys.providerName, providerName),
          eq(apiKeys.isActive, 1)
        )
      )
      .orderBy(desc(apiKeys.lastUsed))
      .limit(1);
    return result[0];
  }

  async updateApiKeyLastUsed(userId: string, id: string): Promise<void> {
    await db.update(apiKeys)
      .set({ lastUsed: sql`now()` })
      .where(withUserFilter(apiKeys, userId, eq(apiKeys.id, id)));
  }

  async deleteApiKey(userId: string, id: string): Promise<void> {
    await db.delete(apiKeys)
      .where(withUserFilter(apiKeys, userId, eq(apiKeys.id, id)));
  }
}

export const storage = new DbStorage();
