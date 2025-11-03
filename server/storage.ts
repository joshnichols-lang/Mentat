import { type User, type InsertUser, type UpsertUser, type UserWallet, type InsertUserWallet, type EmbeddedWallet, type InsertEmbeddedWallet, type Trade, type InsertTrade, type Position, type InsertPosition, type PortfolioSnapshot, type InsertPortfolioSnapshot, type AiUsageLog, type InsertAiUsageLog, type MonitoringLog, type InsertMonitoringLog, type UserApiCredential, type InsertUserApiCredential, type ApiKey, type InsertApiKey, type ContactMessage, type InsertContactMessage, type ProtectiveOrderEvent, type InsertProtectiveOrderEvent, type UserTradeHistoryImport, type InsertUserTradeHistoryImport, type UserTradeHistoryTrade, type InsertUserTradeHistoryTrade, type TradeStyleProfile, type InsertTradeStyleProfile, type TradeJournalEntry, type TradeJournalEntryWithStrategy, type InsertTradeJournalEntry, type TradingMode, type InsertTradingMode, type BudgetAlert, type InsertBudgetAlert, type PolymarketEvent, type InsertPolymarketEvent, type PolymarketPosition, type InsertPolymarketPosition, type PolymarketOrder, type InsertPolymarketOrder, type OptionsStrategy, type InsertOptionsStrategy, type OptionsPosition, type InsertOptionsPosition, type OptionsOrder, type InsertOptionsOrder, type PanelLayout, type InsertPanelLayout, type PortfolioAnalysis, type InsertPortfolioAnalysis, users, userWallets, embeddedWallets, trades, positions, portfolioSnapshots, aiUsageLog, monitoringLog, userApiCredentials, apiKeys, contactMessages, protectiveOrderEvents, userTradeHistoryImports, userTradeHistoryTrades, tradeStyleProfiles, tradeJournalEntries, tradingModes, budgetAlerts, polymarketEvents, polymarketPositions, polymarketOrders, optionsStrategies, optionsPositions, optionsOrders, panelLayouts, portfolioAnalyses } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, isNull, type SQL } from "drizzle-orm";
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
  getUserByWalletAddress(normalizedAddress: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserMonitoringFrequency(userId: string, minutes: number): Promise<User | undefined>;
  updateUserAgentMode(userId: string, mode: "passive" | "active"): Promise<User | undefined>;
  updateUserAiSettings(userId: string, maxAiCallsPerHour: number | null): Promise<User | undefined>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined>;
  updateUserWalletAddress(userId: string, walletAddress: string): Promise<User | undefined>;
  updateUserVerificationStatus(userId: string, status: "pending" | "approved" | "rejected"): Promise<User | undefined>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  getPendingVerificationUsers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  deleteUser(userId: string): Promise<void>;
  
  // User Wallet methods
  createUserWallet(wallet: Omit<InsertUserWallet, 'userId'> & { userId: string }): Promise<UserWallet>;
  getUserWallets(userId: string): Promise<UserWallet[]>;
  getPrimaryAuthWallet(userId: string): Promise<UserWallet | undefined>;
  
  // Embedded Wallet methods
  createEmbeddedWallet(userId: string, wallet: InsertEmbeddedWallet): Promise<EmbeddedWallet>;
  getEmbeddedWallet(userId: string): Promise<EmbeddedWallet | undefined>;
  markSeedPhraseShown(userId: string): Promise<EmbeddedWallet | undefined>;
  updateApiWalletApproval(userId: string, apiWalletAddress: string): Promise<EmbeddedWallet | undefined>;
  
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
  
  // Protective order tracking methods
  setInitialProtectiveOrders(userId: string, symbol: string, stopLoss: string, takeProfit: string, reason: string): Promise<void>;
  updateProtectiveOrders(userId: string, symbol: string, newStopLoss: string | null, newTakeProfit: string | null, reason: string, currentPnl: string, currentPrice: string): Promise<{ success: boolean; error?: string }>;
  getProtectiveOrderState(userId: string, symbol: string): Promise<{ initialStopLoss: string | null; currentStopLoss: string | null; currentTakeProfit: string | null; stopLossState: string } | null>;
  logProtectiveOrderEvent(userId: string, event: InsertProtectiveOrderEvent): Promise<ProtectiveOrderEvent>;
  getProtectiveOrderEvents(userId: string, symbol?: string, limit?: number): Promise<ProtectiveOrderEvent[]>;
  
  // Portfolio snapshot methods (multi-tenant)
  getPortfolioSnapshots(userId: string, limit?: number): Promise<PortfolioSnapshot[]>;
  getPortfolioSnapshotsSince(userId: string, hours: number): Promise<PortfolioSnapshot[]>;
  getLatestPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | undefined>;
  createPortfolioSnapshot(userId: string, snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
  
  // AI Usage Log methods (multi-tenant)
  logAiUsage(userId: string, log: InsertAiUsageLog): Promise<AiUsageLog>;
  getAiUsageLogs(userId: string, limit?: number, strategyId?: string | null): Promise<AiUsageLog[]>;
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
  
  // Contact Messages methods
  createContactMessage(userId: string, message: InsertContactMessage): Promise<ContactMessage>;
  getContactMessages(limit?: number): Promise<ContactMessage[]>;
  getUserContactMessages(userId: string): Promise<ContactMessage[]>;
  resolveContactMessage(messageId: string, resolvedBy: string): Promise<ContactMessage | undefined>;
  
  // Trade History Import methods
  createTradeHistoryImport(userId: string, data: InsertUserTradeHistoryImport): Promise<UserTradeHistoryImport>;
  getTradeHistoryImports(userId: string, limit?: number): Promise<UserTradeHistoryImport[]>;
  getTradeHistoryImport(userId: string, id: string): Promise<UserTradeHistoryImport | undefined>;
  updateTradeHistoryImport(userId: string, id: string, updates: Partial<UserTradeHistoryImport>): Promise<UserTradeHistoryImport | undefined>;
  deleteTradeHistoryImport(userId: string, id: string): Promise<void>;
  
  // Trade History Trades methods
  createTradeHistoryTrade(userId: string, data: InsertUserTradeHistoryTrade): Promise<UserTradeHistoryTrade>;
  getTradeHistoryTrades(userId: string, importId: string): Promise<UserTradeHistoryTrade[]>;
  deleteTradeHistoryTradesByImportId(userId: string, importId: string): Promise<void>;
  
  // Trade Style Profile methods
  createTradeStyleProfile(userId: string, data: InsertTradeStyleProfile): Promise<TradeStyleProfile>;
  getTradeStyleProfiles(userId: string, limit?: number): Promise<TradeStyleProfile[]>;
  getActiveTradeStyleProfile(userId: string): Promise<TradeStyleProfile | undefined>;
  updateTradeStyleProfile(userId: string, id: string, updates: Partial<TradeStyleProfile>): Promise<TradeStyleProfile | undefined>;
  deleteTradeStyleProfile(userId: string, id: string): Promise<void>;
  
  // Trade Journal Entry methods
  createTradeJournalEntry(userId: string, data: InsertTradeJournalEntry): Promise<TradeJournalEntry>;
  getTradeJournalEntries(userId: string, filters?: { status?: string; symbol?: string; limit?: number }): Promise<TradeJournalEntry[]>;
  getTradeJournalEntry(userId: string, id: string): Promise<TradeJournalEntry | undefined>;
  getTradeJournalEntryByTradeId(userId: string, tradeId: string): Promise<TradeJournalEntry | undefined>;
  updateTradeJournalEntry(userId: string, id: string, updates: Partial<TradeJournalEntry>): Promise<TradeJournalEntry | undefined>;
  deleteTradeJournalEntry(userId: string, id: string): Promise<void>;
  deleteAllTradeJournalEntries(userId: string): Promise<void>;
  deletePlannedJournalEntryByOrderId(userId: string, symbol: string, orderId: string): Promise<number>;
  activateTradeJournalEntry(userId: string, id: string, actualEntryPrice: string): Promise<TradeJournalEntry | undefined>;
  closeTradeJournalEntry(userId: string, id: string, closeData: {
    closePrice: string;
    closePnl: string;
    closePnlPercent: string;
    closeReasoning: string;
    hitTarget: number;
    hadAdjustments: number;
    adjustmentDetails?: any;
    whatWentWrong?: string;
    lessonsLearned?: string;
  }): Promise<TradeJournalEntry | undefined>;
  
  // Trading Mode methods
  createTradingMode(userId: string, data: InsertTradingMode): Promise<TradingMode>;
  getTradingModes(userId: string): Promise<TradingMode[]>;
  getTradingMode(userId: string, id: string): Promise<TradingMode | undefined>;
  getActiveTradingMode(userId: string): Promise<TradingMode | undefined>;
  updateTradingMode(userId: string, id: string, updates: Partial<InsertTradingMode>): Promise<TradingMode | undefined>;
  setActiveTradingMode(userId: string, modeId: string): Promise<TradingMode | undefined>;
  deleteTradingMode(userId: string, id: string): Promise<void>;
  
  // Polymarket Event methods (shared table - no user context)
  createPolymarketEvent(data: InsertPolymarketEvent): Promise<PolymarketEvent>;
  getPolymarketEvents(filters?: { active?: boolean; limit?: number }): Promise<PolymarketEvent[]>;
  getPolymarketEvent(conditionId: string): Promise<PolymarketEvent | undefined>;
  updatePolymarketEvent(conditionId: string, updates: Partial<PolymarketEvent>): Promise<PolymarketEvent | undefined>;
  
  // Polymarket Position methods (multi-tenant)
  createPolymarketPosition(userId: string, data: InsertPolymarketPosition): Promise<PolymarketPosition>;
  getPolymarketPositions(userId: string, filters?: { eventId?: string }): Promise<PolymarketPosition[]>;
  getPolymarketPosition(userId: string, id: string): Promise<PolymarketPosition | undefined>;
  updatePolymarketPosition(userId: string, id: string, updates: Partial<PolymarketPosition>): Promise<PolymarketPosition | undefined>;
  deletePolymarketPosition(userId: string, id: string): Promise<void>;
  
  // Polymarket Order methods (multi-tenant)
  createPolymarketOrder(userId: string, data: InsertPolymarketOrder): Promise<PolymarketOrder>;
  getPolymarketOrders(userId: string, filters?: { eventId?: string; status?: string; limit?: number }): Promise<PolymarketOrder[]>;
  getPolymarketOrder(userId: string, id: string): Promise<PolymarketOrder | undefined>;
  updatePolymarketOrder(userId: string, id: string, updates: Partial<PolymarketOrder>): Promise<PolymarketOrder | undefined>;
  
  // Options Strategy methods (multi-tenant)
  createOptionsStrategy(userId: string, data: InsertOptionsStrategy): Promise<OptionsStrategy>;
  getOptionsStrategies(userId: string, filters?: { status?: string }): Promise<OptionsStrategy[]>;
  getOptionsStrategy(userId: string, id: string): Promise<OptionsStrategy | undefined>;
  updateOptionsStrategy(userId: string, id: string, updates: Partial<OptionsStrategy>): Promise<OptionsStrategy | undefined>;
  
  // Options Position methods (multi-tenant)
  createOptionsPosition(userId: string, data: InsertOptionsPosition): Promise<OptionsPosition>;
  getOptionsPositions(userId: string, filters?: { strategyId?: string; status?: string }): Promise<OptionsPosition[]>;
  getOptionsPosition(userId: string, id: string): Promise<OptionsPosition | undefined>;
  updateOptionsPosition(userId: string, id: string, updates: Partial<OptionsPosition>): Promise<OptionsPosition | undefined>;
  
  // Options Order methods (multi-tenant)
  createOptionsOrder(userId: string, data: InsertOptionsOrder): Promise<OptionsOrder>;
  getOptionsOrders(userId: string, filters?: { strategyId?: string; status?: string }): Promise<OptionsOrder[]>;
  getOptionsOrderById(orderId: string): Promise<OptionsOrder | undefined>;
  updateOptionsOrder(orderId: string, updates: Partial<OptionsOrder>): Promise<OptionsOrder | undefined>;
  
  // Panel Layout methods (multi-tenant)
  getPanelLayout(userId: string, tab: string): Promise<PanelLayout | undefined>;
  savePanelLayout(userId: string, tab: string, layoutData: any): Promise<PanelLayout>;
  deletePanelLayout(userId: string, tab: string): Promise<void>;
  
  // Portfolio Analysis methods (multi-tenant)
  createPortfolioAnalysis(userId: string, data: InsertPortfolioAnalysis): Promise<PortfolioAnalysis>;
  getPortfolioAnalyses(userId: string, limit?: number): Promise<PortfolioAnalysis[]>;
  getPortfolioAnalysis(userId: string, id: string): Promise<PortfolioAnalysis | undefined>;
  
  // Admin methods
  getAllUsers(): Promise<User[]>;
  getAdminUsageStats(): Promise<any>;
  getBudgetAlert(): Promise<BudgetAlert | undefined>;
  upsertBudgetAlert(data: Partial<InsertBudgetAlert>): Promise<BudgetAlert>;
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

  async updateUserAiSettings(userId: string, maxAiCallsPerHour: number | null): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        maxAiCallsPerHour,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        password: hashedPassword,
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

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        ...updates,
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

  async getAllUsers(): Promise<User[]> {
    return await db.select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // User Wallet methods
  async getUserByWalletAddress(normalizedAddress: string): Promise<User | undefined> {
    // Find wallet with this normalized address where it's the primary auth wallet
    const walletResult = await db.select()
      .from(userWallets)
      .where(and(
        eq(userWallets.normalizedAddress, normalizedAddress),
        eq(userWallets.isAuthPrimary, 1)
      ))
      .limit(1);
    
    if (!walletResult || walletResult.length === 0) {
      return undefined;
    }
    
    const wallet = walletResult[0];
    return await this.getUser(wallet.userId);
  }

  async createUserWallet(wallet: Omit<InsertUserWallet, 'userId'> & { userId: string }): Promise<UserWallet> {
    const result = await db.insert(userWallets).values(wallet).returning();
    return result[0];
  }

  async getUserWallets(userId: string): Promise<UserWallet[]> {
    return await db.select()
      .from(userWallets)
      .where(eq(userWallets.userId, userId))
      .orderBy(desc(userWallets.createdAt));
  }

  async getPrimaryAuthWallet(userId: string): Promise<UserWallet | undefined> {
    const result = await db.select()
      .from(userWallets)
      .where(and(
        eq(userWallets.userId, userId),
        eq(userWallets.isAuthPrimary, 1)
      ))
      .limit(1);
    return result[0];
  }

  // Embedded Wallet methods
  async createEmbeddedWallet(userId: string, wallet: InsertEmbeddedWallet): Promise<EmbeddedWallet> {
    const result = await db.insert(embeddedWallets).values({
      userId,
      ...wallet,
    }).returning();
    return result[0];
  }

  async getEmbeddedWallet(userId: string): Promise<EmbeddedWallet | undefined> {
    const result = await db.select()
      .from(embeddedWallets)
      .where(eq(embeddedWallets.userId, userId))
      .limit(1);
    return result[0];
  }

  async markSeedPhraseShown(userId: string): Promise<EmbeddedWallet | undefined> {
    const result = await db
      .update(embeddedWallets)
      .set({
        seedPhraseShown: 1,
        seedPhraseShownAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(embeddedWallets.userId, userId))
      .returning();
    return result[0];
  }

  async updateApiWalletApproval(userId: string, apiWalletAddress: string): Promise<EmbeddedWallet | undefined> {
    const result = await db
      .update(embeddedWallets)
      .set({
        apiWalletAddress,
        apiWalletApproved: 1,
        apiWalletApprovedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(embeddedWallets.userId, userId))
      .returning();
    return result[0];
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
    
    // Trigger evaluation asynchronously after trade closes
    if (result[0]) {
      import("./evaluationService").then(({ evaluateCompletedTrade }) => {
        evaluateCompletedTrade(userId, id).catch((err) => {
          console.error(`[Evaluation] Failed to evaluate trade ${id}:`, err);
        });
      });
    }
    
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

  // Protective order tracking methods
  async setInitialProtectiveOrders(userId: string, symbol: string, stopLoss: string, takeProfit: string, reason: string): Promise<void> {
    const position = await this.getPositionBySymbol(userId, symbol);
    if (!position) {
      console.log(`[Storage] Position ${symbol} not found for user ${userId}, cannot set protective orders`);
      return;
    }

    // Set initial protective orders on the position
    await this.updatePosition(userId, position.id, {
      initialStopLoss: stopLoss,
      currentStopLoss: stopLoss,
      currentTakeProfit: takeProfit,
      stopLossState: "initial",
      lastAdjustmentAt: sql`now()` as any,
    });

    // Log the event
    await this.logProtectiveOrderEvent(userId, {
      positionId: position.id,
      symbol,
      eventType: "set_initial",
      newStopLoss: stopLoss,
      newTakeProfit: takeProfit,
      reason,
      currentPnl: position.pnl,
      currentPrice: position.currentPrice,
    });
  }

  async updateProtectiveOrders(
    userId: string,
    symbol: string,
    newStopLoss: string | null,
    newTakeProfit: string | null,
    reason: string,
    currentPnl: string,
    currentPrice: string
  ): Promise<{ success: boolean; error?: string }> {
    const position = await this.getPositionBySymbol(userId, symbol);
    if (!position) {
      return { success: false, error: "Position not found" };
    }

    const updates: Partial<Position> = { lastAdjustmentAt: sql`now()` as any };
    const event: InsertProtectiveOrderEvent = {
      positionId: position.id,
      symbol,
      eventType: "adjust_sl",
      previousStopLoss: position.currentStopLoss || undefined,
      previousTakeProfit: position.currentTakeProfit || undefined,
      reason,
      currentPnl,
      currentPrice,
    };

    // Validate stop loss movement (only in favorable direction)
    if (newStopLoss !== null && position.initialStopLoss) {
      const isBuyLong = position.side === "long";
      const newSL = parseFloat(newStopLoss);
      const currentSL = parseFloat(position.currentStopLoss || position.initialStopLoss);
      
      // For longs: SL can only move UP (higher). For shorts: SL can only move DOWN (lower)
      const movingCorrectDirection = isBuyLong ? newSL > currentSL : newSL < currentSL;
      
      if (!movingCorrectDirection && newSL !== currentSL) {
        const rejectionReason = `Cannot move stop loss ${isBuyLong ? "lower" : "higher"} - would increase risk`;
        await this.logProtectiveOrderEvent(userId, {
          ...event,
          eventType: "rejected",
          newStopLoss,
          rejected: 1,
          rejectionReason,
        });
        return { success: false, error: rejectionReason };
      }

      updates.currentStopLoss = newStopLoss;
      updates.stopLossState = parseFloat(currentPnl) > 0 ? "trailing" : "initial";
      event.newStopLoss = newStopLoss;
    }

    if (newTakeProfit !== null) {
      updates.currentTakeProfit = newTakeProfit;
      event.newTakeProfit = newTakeProfit;
      event.eventType = newStopLoss !== null ? "adjust_sl" : "adjust_tp";
    }

    // Update position with new protective order prices
    await this.updatePosition(userId, position.id, updates);
    
    // Log successful adjustment
    await this.logProtectiveOrderEvent(userId, event);

    return { success: true };
  }

  async getProtectiveOrderState(userId: string, symbol: string): Promise<{ initialStopLoss: string | null; currentStopLoss: string | null; currentTakeProfit: string | null; stopLossState: string } | null> {
    const position = await this.getPositionBySymbol(userId, symbol);
    if (!position) {
      return null;
    }

    return {
      initialStopLoss: position.initialStopLoss || null,
      currentStopLoss: position.currentStopLoss || null,
      currentTakeProfit: position.currentTakeProfit || null,
      stopLossState: position.stopLossState,
    };
  }

  async logProtectiveOrderEvent(userId: string, event: InsertProtectiveOrderEvent): Promise<ProtectiveOrderEvent> {
    const result = await db.insert(protectiveOrderEvents).values({ userId, ...event }).returning();
    return result[0];
  }

  async getProtectiveOrderEvents(userId: string, symbol?: string, limit: number = 100): Promise<ProtectiveOrderEvent[]> {
    const conditions = symbol 
      ? withUserFilter(protectiveOrderEvents, userId, eq(protectiveOrderEvents.symbol, symbol))
      : withUserFilter(protectiveOrderEvents, userId);
    
    return await db.select()
      .from(protectiveOrderEvents)
      .where(conditions)
      .orderBy(desc(protectiveOrderEvents.timestamp))
      .limit(limit);
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

  async getAiUsageLogs(userId: string, limit: number = 100, strategyId?: string | null): Promise<AiUsageLog[]> {
    // Build filter conditions
    const conditions = [withUserFilter(aiUsageLog, userId)];
    
    // If strategyId is provided (including null for "general" mode), filter by it
    if (strategyId !== undefined) {
      if (strategyId === null) {
        conditions.push(isNull(aiUsageLog.strategyId));
      } else {
        conditions.push(eq(aiUsageLog.strategyId, strategyId));
      }
    }
    // If strategyId is undefined, return all logs (no strategyId filter)
    
    return await db.select().from(aiUsageLog)
      .where(and(...conditions))
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

  // Contact Messages methods
  async createContactMessage(userId: string, message: InsertContactMessage): Promise<ContactMessage> {
    const result = await db.insert(contactMessages)
      .values({ ...message, userId })
      .returning();
    return result[0];
  }

  async getContactMessages(limit: number = 100): Promise<ContactMessage[]> {
    return await db.select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(limit);
  }

  async getUserContactMessages(userId: string): Promise<ContactMessage[]> {
    return await db.select()
      .from(contactMessages)
      .where(eq(contactMessages.userId, userId))
      .orderBy(desc(contactMessages.createdAt));
  }

  async resolveContactMessage(messageId: string, resolvedBy: string): Promise<ContactMessage | undefined> {
    const result = await db.update(contactMessages)
      .set({ 
        status: "resolved", 
        resolvedBy, 
        resolvedAt: sql`now()` 
      })
      .where(eq(contactMessages.id, messageId))
      .returning();
    return result[0];
  }

  // Trade History Import methods
  async createTradeHistoryImport(userId: string, data: InsertUserTradeHistoryImport): Promise<UserTradeHistoryImport> {
    const result = await db.insert(userTradeHistoryImports)
      .values({ ...data, userId })
      .returning();
    return result[0];
  }

  async getTradeHistoryImports(userId: string, limit: number = 50): Promise<UserTradeHistoryImport[]> {
    return await db.select()
      .from(userTradeHistoryImports)
      .where(eq(userTradeHistoryImports.userId, userId))
      .orderBy(desc(userTradeHistoryImports.createdAt))
      .limit(limit);
  }

  async getTradeHistoryImport(userId: string, id: string): Promise<UserTradeHistoryImport | undefined> {
    const result = await db.select()
      .from(userTradeHistoryImports)
      .where(withUserFilter(userTradeHistoryImports, userId, eq(userTradeHistoryImports.id, id)))
      .limit(1);
    return result[0];
  }

  async updateTradeHistoryImport(userId: string, id: string, updates: Partial<UserTradeHistoryImport>): Promise<UserTradeHistoryImport | undefined> {
    const result = await db.update(userTradeHistoryImports)
      .set(updates)
      .where(withUserFilter(userTradeHistoryImports, userId, eq(userTradeHistoryImports.id, id)))
      .returning();
    return result[0];
  }

  async deleteTradeHistoryImport(userId: string, id: string): Promise<void> {
    await db.delete(userTradeHistoryImports)
      .where(withUserFilter(userTradeHistoryImports, userId, eq(userTradeHistoryImports.id, id)));
  }

  // Trade History Trades methods
  async createTradeHistoryTrade(userId: string, data: InsertUserTradeHistoryTrade): Promise<UserTradeHistoryTrade> {
    const result = await db.insert(userTradeHistoryTrades)
      .values({ ...data, userId })
      .returning();
    return result[0];
  }

  async getTradeHistoryTrades(userId: string, importId: string): Promise<UserTradeHistoryTrade[]> {
    return await db.select()
      .from(userTradeHistoryTrades)
      .where(
        withUserFilter(userTradeHistoryTrades, userId, eq(userTradeHistoryTrades.importId, importId))
      )
      .orderBy(desc(userTradeHistoryTrades.entryTimestamp));
  }

  async deleteTradeHistoryTradesByImportId(userId: string, importId: string): Promise<void> {
    await db.delete(userTradeHistoryTrades)
      .where(
        withUserFilter(userTradeHistoryTrades, userId, eq(userTradeHistoryTrades.importId, importId))
      );
  }

  // Trade Style Profile methods
  async createTradeStyleProfile(userId: string, data: InsertTradeStyleProfile): Promise<TradeStyleProfile> {
    const result = await db.insert(tradeStyleProfiles)
      .values({ ...data, userId })
      .returning();
    return result[0];
  }

  async getTradeStyleProfiles(userId: string, limit: number = 10): Promise<TradeStyleProfile[]> {
    return await db.select()
      .from(tradeStyleProfiles)
      .where(eq(tradeStyleProfiles.userId, userId))
      .orderBy(desc(tradeStyleProfiles.updatedAt))
      .limit(limit);
  }

  async getActiveTradeStyleProfile(userId: string): Promise<TradeStyleProfile | undefined> {
    const result = await db.select()
      .from(tradeStyleProfiles)
      .where(
        withUserFilter(tradeStyleProfiles, userId, eq(tradeStyleProfiles.isActive, 1))
      )
      .orderBy(desc(tradeStyleProfiles.updatedAt))
      .limit(1);
    return result[0];
  }

  async updateTradeStyleProfile(userId: string, id: string, updates: Partial<TradeStyleProfile>): Promise<TradeStyleProfile | undefined> {
    const result = await db.update(tradeStyleProfiles)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(withUserFilter(tradeStyleProfiles, userId, eq(tradeStyleProfiles.id, id)))
      .returning();
    return result[0];
  }

  async deleteTradeStyleProfile(userId: string, id: string): Promise<void> {
    await db.delete(tradeStyleProfiles)
      .where(withUserFilter(tradeStyleProfiles, userId, eq(tradeStyleProfiles.id, id)));
  }

  // Trade Journal Entry methods
  async createTradeJournalEntry(userId: string, data: InsertTradeJournalEntry): Promise<TradeJournalEntry> {
    const result = await db.insert(tradeJournalEntries)
      .values({ ...data, userId })
      .returning();
    return result[0];
  }

  async getTradeJournalEntries(userId: string, filters?: { status?: string; symbol?: string; limit?: number }): Promise<TradeJournalEntryWithStrategy[]> {
    const limit = filters?.limit || 100;
    const conditions: SQL[] = [];
    
    if (filters?.status) {
      conditions.push(eq(tradeJournalEntries.status, filters.status));
    }
    if (filters?.symbol) {
      conditions.push(eq(tradeJournalEntries.symbol, filters.symbol));
    }

    const whereClause = conditions.length > 0
      ? withUserFilter(tradeJournalEntries, userId, ...conditions)
      : withUserFilter(tradeJournalEntries, userId);

    return await db.select({
      id: tradeJournalEntries.id,
      userId: tradeJournalEntries.userId,
      tradeId: tradeJournalEntries.tradeId,
      evaluationId: tradeJournalEntries.evaluationId,
      tradingModeId: tradeJournalEntries.tradingModeId,
      tradingModeName: tradingModes.name,
      symbol: tradeJournalEntries.symbol,
      side: tradeJournalEntries.side,
      entryType: tradeJournalEntries.entryType,
      status: tradeJournalEntries.status,
      orderId: tradeJournalEntries.orderId,
      entryReasoning: tradeJournalEntries.entryReasoning,
      expectations: tradeJournalEntries.expectations,
      exitCriteria: tradeJournalEntries.exitCriteria,
      expectedRoi: tradeJournalEntries.expectedRoi,
      marketContext: tradeJournalEntries.marketContext,
      plannedEntryPrice: tradeJournalEntries.plannedEntryPrice,
      actualEntryPrice: tradeJournalEntries.actualEntryPrice,
      size: tradeJournalEntries.size,
      leverage: tradeJournalEntries.leverage,
      stopLoss: tradeJournalEntries.stopLoss,
      takeProfit: tradeJournalEntries.takeProfit,
      closePrice: tradeJournalEntries.closePrice,
      closePnl: tradeJournalEntries.closePnl,
      closePnlPercent: tradeJournalEntries.closePnlPercent,
      closeReasoning: tradeJournalEntries.closeReasoning,
      hitTarget: tradeJournalEntries.hitTarget,
      hadAdjustments: tradeJournalEntries.hadAdjustments,
      adjustmentDetails: tradeJournalEntries.adjustmentDetails,
      whatWentWrong: tradeJournalEntries.whatWentWrong,
      lessonsLearned: tradeJournalEntries.lessonsLearned,
      createdAt: tradeJournalEntries.createdAt,
      activatedAt: tradeJournalEntries.activatedAt,
      closedAt: tradeJournalEntries.closedAt,
    })
      .from(tradeJournalEntries)
      .leftJoin(tradingModes, eq(tradeJournalEntries.tradingModeId, tradingModes.id))
      .where(whereClause)
      .orderBy(desc(tradeJournalEntries.createdAt))
      .limit(limit);
  }

  async getTradeJournalEntry(userId: string, id: string): Promise<TradeJournalEntry | undefined> {
    const result = await db.select()
      .from(tradeJournalEntries)
      .where(withUserFilter(tradeJournalEntries, userId, eq(tradeJournalEntries.id, id)))
      .limit(1);
    return result[0];
  }

  async getTradeJournalEntryByTradeId(userId: string, tradeId: string): Promise<TradeJournalEntry | undefined> {
    const result = await db.select()
      .from(tradeJournalEntries)
      .where(withUserFilter(tradeJournalEntries, userId, eq(tradeJournalEntries.tradeId, tradeId)))
      .limit(1);
    return result[0];
  }

  async updateTradeJournalEntry(userId: string, id: string, updates: Partial<TradeJournalEntry>): Promise<TradeJournalEntry | undefined> {
    const result = await db.update(tradeJournalEntries)
      .set(updates)
      .where(withUserFilter(tradeJournalEntries, userId, eq(tradeJournalEntries.id, id)))
      .returning();
    return result[0];
  }

  async activateTradeJournalEntry(userId: string, id: string, actualEntryPrice: string): Promise<TradeJournalEntry | undefined> {
    const result = await db.update(tradeJournalEntries)
      .set({ 
        status: "active",
        actualEntryPrice,
        activatedAt: sql`now()`
      })
      .where(withUserFilter(tradeJournalEntries, userId, eq(tradeJournalEntries.id, id)))
      .returning();
    return result[0];
  }

  async closeTradeJournalEntry(userId: string, id: string, closeData: {
    closePrice: string;
    closePnl: string;
    closePnlPercent: string;
    closeReasoning: string;
    hitTarget: number;
    hadAdjustments: number;
    adjustmentDetails?: any;
    whatWentWrong?: string;
    lessonsLearned?: string;
  }): Promise<TradeJournalEntry | undefined> {
    const result = await db.update(tradeJournalEntries)
      .set({
        status: "closed",
        closePrice: closeData.closePrice,
        closePnl: closeData.closePnl,
        closePnlPercent: closeData.closePnlPercent,
        closeReasoning: closeData.closeReasoning,
        hitTarget: closeData.hitTarget,
        hadAdjustments: closeData.hadAdjustments,
        adjustmentDetails: closeData.adjustmentDetails,
        whatWentWrong: closeData.whatWentWrong,
        lessonsLearned: closeData.lessonsLearned,
        closedAt: sql`now()`
      })
      .where(withUserFilter(tradeJournalEntries, userId, eq(tradeJournalEntries.id, id)))
      .returning();
    return result[0];
  }

  async deleteTradeJournalEntry(userId: string, id: string): Promise<void> {
    await db.delete(tradeJournalEntries)
      .where(withUserFilter(tradeJournalEntries, userId, eq(tradeJournalEntries.id, id)));
  }

  async deleteAllTradeJournalEntries(userId: string): Promise<void> {
    await db.delete(tradeJournalEntries)
      .where(eq(tradeJournalEntries.userId, userId));
  }

  async deletePlannedJournalEntryByOrderId(userId: string, symbol: string, orderId: string): Promise<number> {
    const result = await db.delete(tradeJournalEntries)
      .where(
        withUserFilter(
          tradeJournalEntries, 
          userId, 
          eq(tradeJournalEntries.symbol, symbol),
          eq(tradeJournalEntries.orderId, orderId),
          eq(tradeJournalEntries.status, "planned")
        )
      )
      .returning();
    return result.length;
  }

  // Trading Mode methods
  async createTradingMode(userId: string, data: InsertTradingMode): Promise<TradingMode> {
    const result = await db.insert(tradingModes)
      .values({ ...data, userId })
      .returning();
    return result[0];
  }

  async getTradingModes(userId: string): Promise<TradingMode[]> {
    return db.select()
      .from(tradingModes)
      .where(eq(tradingModes.userId, userId))
      .orderBy(desc(tradingModes.createdAt));
  }

  async getTradingMode(userId: string, id: string): Promise<TradingMode | undefined> {
    const result = await db.select()
      .from(tradingModes)
      .where(withUserFilter(tradingModes, userId, eq(tradingModes.id, id)))
      .limit(1);
    return result[0];
  }

  async getActiveTradingMode(userId: string): Promise<TradingMode | undefined> {
    const result = await db.select()
      .from(tradingModes)
      .where(withUserFilter(tradingModes, userId, eq(tradingModes.isActive, 1)))
      .limit(1);
    return result[0];
  }

  async updateTradingMode(userId: string, id: string, updates: Partial<InsertTradingMode>): Promise<TradingMode | undefined> {
    const result = await db.update(tradingModes)
      .set({ ...updates, updatedAt: new Date() })
      .where(withUserFilter(tradingModes, userId, eq(tradingModes.id, id)))
      .returning();
    return result[0];
  }

  async setActiveTradingMode(userId: string, modeId: string): Promise<TradingMode | undefined> {
    // Deactivate all other modes for this user
    await db.update(tradingModes)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(tradingModes.userId, userId));
    
    // Activate the selected mode
    const result = await db.update(tradingModes)
      .set({ isActive: 1, updatedAt: new Date() })
      .where(withUserFilter(tradingModes, userId, eq(tradingModes.id, modeId)))
      .returning();
    return result[0];
  }

  async deleteTradingMode(userId: string, id: string): Promise<void> {
    await db.delete(tradingModes)
      .where(withUserFilter(tradingModes, userId, eq(tradingModes.id, id)));
  }

  // Polymarket Event methods (shared table - no user isolation)
  async createPolymarketEvent(data: InsertPolymarketEvent): Promise<PolymarketEvent> {
    const result = await db.insert(polymarketEvents).values(data).returning();
    return result[0];
  }

  async getPolymarketEvents(filters?: { active?: boolean; limit?: number }): Promise<PolymarketEvent[]> {
    const conditions: SQL[] = [];
    
    if (filters?.active !== undefined) {
      conditions.push(eq(polymarketEvents.active, filters.active ? 1 : 0));
    }
    
    const baseQuery = db.select().from(polymarketEvents);
    const withWhere = conditions.length > 0 
      ? baseQuery.where(and(...conditions)!) 
      : baseQuery;
    const withOrder = withWhere.orderBy(desc(polymarketEvents.createdAt));
    const finalQuery = filters?.limit 
      ? withOrder.limit(filters.limit) 
      : withOrder;
    
    return await finalQuery;
  }

  async getPolymarketEvent(conditionId: string): Promise<PolymarketEvent | undefined> {
    const result = await db.select()
      .from(polymarketEvents)
      .where(eq(polymarketEvents.conditionId, conditionId))
      .limit(1);
    return result[0];
  }

  async updatePolymarketEvent(conditionId: string, updates: Partial<PolymarketEvent>): Promise<PolymarketEvent | undefined> {
    const result = await db.update(polymarketEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(polymarketEvents.conditionId, conditionId))
      .returning();
    return result[0];
  }

  // Polymarket Position methods
  async createPolymarketPosition(userId: string, data: InsertPolymarketPosition): Promise<PolymarketPosition> {
    const result = await db.insert(polymarketPositions).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  async getPolymarketPositions(userId: string, filters?: { eventId?: string }): Promise<PolymarketPosition[]> {
    let conditions = [eq(polymarketPositions.userId, userId)];
    
    if (filters?.eventId) {
      conditions.push(eq(polymarketPositions.eventId, filters.eventId));
    }
    
    return await db.select()
      .from(polymarketPositions)
      .where(and(...conditions)!)
      .orderBy(desc(polymarketPositions.openedAt));
  }

  async getPolymarketPosition(userId: string, id: string): Promise<PolymarketPosition | undefined> {
    const result = await db.select()
      .from(polymarketPositions)
      .where(withUserFilter(polymarketPositions, userId, eq(polymarketPositions.id, id)))
      .limit(1);
    return result[0];
  }

  async updatePolymarketPosition(userId: string, id: string, updates: Partial<PolymarketPosition>): Promise<PolymarketPosition | undefined> {
    const result = await db.update(polymarketPositions)
      .set({ ...updates, updatedAt: new Date() })
      .where(withUserFilter(polymarketPositions, userId, eq(polymarketPositions.id, id)))
      .returning();
    return result[0];
  }

  async deletePolymarketPosition(userId: string, id: string): Promise<void> {
    await db.delete(polymarketPositions)
      .where(withUserFilter(polymarketPositions, userId, eq(polymarketPositions.id, id)));
  }

  // Polymarket Order methods
  async createPolymarketOrder(userId: string, data: InsertPolymarketOrder): Promise<PolymarketOrder> {
    const result = await db.insert(polymarketOrders).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  async getPolymarketOrders(userId: string, filters?: { eventId?: string; status?: string; limit?: number }): Promise<PolymarketOrder[]> {
    const conditions = [eq(polymarketOrders.userId, userId)];
    
    if (filters?.eventId) {
      conditions.push(eq(polymarketOrders.eventId, filters.eventId));
    }
    if (filters?.status) {
      conditions.push(eq(polymarketOrders.status, filters.status));
    }
    
    const baseQuery = db.select()
      .from(polymarketOrders)
      .where(and(...conditions)!)
      .orderBy(desc(polymarketOrders.createdAt));
    
    const finalQuery = filters?.limit 
      ? baseQuery.limit(filters.limit) 
      : baseQuery;
    
    return await finalQuery;
  }

  async getPolymarketOrder(userId: string, id: string): Promise<PolymarketOrder | undefined> {
    const result = await db.select()
      .from(polymarketOrders)
      .where(withUserFilter(polymarketOrders, userId, eq(polymarketOrders.id, id)))
      .limit(1);
    return result[0];
  }

  async updatePolymarketOrder(userId: string, id: string, updates: Partial<PolymarketOrder>): Promise<PolymarketOrder | undefined> {
    const result = await db.update(polymarketOrders)
      .set(updates)
      .where(withUserFilter(polymarketOrders, userId, eq(polymarketOrders.id, id)))
      .returning();
    return result[0];
  }

  // Options Strategy methods
  async createOptionsStrategy(userId: string, data: InsertOptionsStrategy): Promise<OptionsStrategy> {
    const result = await db.insert(optionsStrategies).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  async getOptionsStrategies(userId: string, filters?: { status?: string }): Promise<OptionsStrategy[]> {
    const conditions = [eq(optionsStrategies.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(optionsStrategies.status, filters.status));
    }
    
    return await db.select()
      .from(optionsStrategies)
      .where(and(...conditions)!)
      .orderBy(desc(optionsStrategies.createdAt));
  }

  async getOptionsStrategy(userId: string, id: string): Promise<OptionsStrategy | undefined> {
    const result = await db.select()
      .from(optionsStrategies)
      .where(withUserFilter(optionsStrategies, userId, eq(optionsStrategies.id, id)))
      .limit(1);
    return result[0];
  }

  async updateOptionsStrategy(userId: string, id: string, updates: Partial<OptionsStrategy>): Promise<OptionsStrategy | undefined> {
    const result = await db.update(optionsStrategies)
      .set(updates)
      .where(withUserFilter(optionsStrategies, userId, eq(optionsStrategies.id, id)))
      .returning();
    return result[0];
  }

  // Options Position methods
  async createOptionsPosition(userId: string, data: InsertOptionsPosition): Promise<OptionsPosition> {
    const result = await db.insert(optionsPositions).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  async getOptionsPositions(userId: string, filters?: { strategyId?: string; status?: string }): Promise<OptionsPosition[]> {
    const conditions = [eq(optionsPositions.userId, userId)];
    
    if (filters?.strategyId) {
      conditions.push(eq(optionsPositions.strategyId, filters.strategyId));
    }
    if (filters?.status) {
      conditions.push(eq(optionsPositions.status, filters.status));
    }
    
    return await db.select()
      .from(optionsPositions)
      .where(and(...conditions)!)
      .orderBy(desc(optionsPositions.openedAt));
  }

  async getOptionsPosition(userId: string, id: string): Promise<OptionsPosition | undefined> {
    const result = await db.select()
      .from(optionsPositions)
      .where(withUserFilter(optionsPositions, userId, eq(optionsPositions.id, id)))
      .limit(1);
    return result[0];
  }

  async updateOptionsPosition(userId: string, id: string, updates: Partial<OptionsPosition>): Promise<OptionsPosition | undefined> {
    const result = await db.update(optionsPositions)
      .set(updates)
      .where(withUserFilter(optionsPositions, userId, eq(optionsPositions.id, id)))
      .returning();
    return result[0];
  }

  // Options Order methods
  async createOptionsOrder(userId: string, data: InsertOptionsOrder): Promise<OptionsOrder> {
    const result = await db.insert(optionsOrders).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  async getOptionsOrders(userId: string, filters?: { strategyId?: string; status?: string }): Promise<OptionsOrder[]> {
    const conditions = [eq(optionsOrders.userId, userId)];
    
    if (filters?.strategyId) {
      conditions.push(eq(optionsOrders.strategyId, filters.strategyId));
    }
    if (filters?.status) {
      conditions.push(eq(optionsOrders.status, filters.status));
    }
    
    return await db.select()
      .from(optionsOrders)
      .where(and(...conditions)!)
      .orderBy(desc(optionsOrders.createdAt));
  }

  async getOptionsOrderById(orderId: string): Promise<OptionsOrder | undefined> {
    const result = await db.select()
      .from(optionsOrders)
      .where(eq(optionsOrders.id, orderId))
      .limit(1);
    return result[0];
  }

  async updateOptionsOrder(orderId: string, updates: Partial<OptionsOrder>): Promise<OptionsOrder | undefined> {
    const result = await db.update(optionsOrders)
      .set(updates)
      .where(eq(optionsOrders.id, orderId))
      .returning();
    return result[0];
  }

  // Panel Layout methods
  async getPanelLayout(userId: string, tab: string): Promise<PanelLayout | undefined> {
    const result = await db.select()
      .from(panelLayouts)
      .where(and(eq(panelLayouts.userId, userId), eq(panelLayouts.tab, tab))!)
      .limit(1);
    return result[0];
  }

  async savePanelLayout(userId: string, tab: string, layoutData: any): Promise<PanelLayout> {
    const existing = await this.getPanelLayout(userId, tab);
    
    if (existing) {
      // Update existing layout
      const result = await db.update(panelLayouts)
        .set({ layoutData, updatedAt: new Date() })
        .where(and(eq(panelLayouts.userId, userId), eq(panelLayouts.tab, tab))!)
        .returning();
      return result[0];
    } else {
      // Create new layout
      const result = await db.insert(panelLayouts)
        .values({ userId, tab, layoutData })
        .returning();
      return result[0];
    }
  }

  async deletePanelLayout(userId: string, tab: string): Promise<void> {
    await db.delete(panelLayouts)
      .where(and(eq(panelLayouts.userId, userId), eq(panelLayouts.tab, tab))!);
  }

  // Portfolio Analysis methods
  async createPortfolioAnalysis(userId: string, data: InsertPortfolioAnalysis): Promise<PortfolioAnalysis> {
    const [analysis] = await db.insert(portfolioAnalyses)
      .values({ ...data, userId })
      .returning();
    return analysis;
  }

  async getPortfolioAnalyses(userId: string, limit: number = 10): Promise<PortfolioAnalysis[]> {
    return await db.select()
      .from(portfolioAnalyses)
      .where(eq(portfolioAnalyses.userId, userId))
      .orderBy(desc(portfolioAnalyses.createdAt))
      .limit(limit);
  }

  async getPortfolioAnalysis(userId: string, id: string): Promise<PortfolioAnalysis | undefined> {
    const result = await db.select()
      .from(portfolioAnalyses)
      .where(and(eq(portfolioAnalyses.userId, userId), eq(portfolioAnalyses.id, id))!)
      .limit(1);
    return result[0];
  }

  // Admin methods
  async getAdminUsageStats(): Promise<any> {
    // Get counts and aggregations for admin dashboard
    const totalUsers = await db.select({ count: sql<number>`count(*)::int` })
      .from(users);
    
    const activeUsers = await db.select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`${users.agentMode} = 'active'`);
    
    const totalTrades = await db.select({ count: sql<number>`count(*)::int` })
      .from(trades);
    
    const totalAiRequests = await db.select({ count: sql<number>`count(*)::int` })
      .from(aiUsageLog);
    
    const totalMonitoringRuns = await db.select({ count: sql<number>`count(*)::int` })
      .from(monitoringLog);
    
    // Get AI usage by provider in last 30 days
    const aiUsageByProvider = await db.select({
      provider: aiUsageLog.provider,
      count: sql<number>`count(*)::int`,
      totalTokens: sql<number>`sum(${aiUsageLog.totalTokens})::int`
    })
      .from(aiUsageLog)
      .where(sql`${aiUsageLog.timestamp} > NOW() - INTERVAL '30 days'`)
      .groupBy(aiUsageLog.provider);
    
    // User distribution by monitoring frequency
    const usersByMonitoringFreq = await db.select({
      frequency: users.monitoringFrequencyMinutes,
      count: sql<number>`count(*)::int`
    })
      .from(users)
      .groupBy(users.monitoringFrequencyMinutes);
    
    return {
      totalUsers: totalUsers[0]?.count || 0,
      activeUsers: activeUsers[0]?.count || 0,
      totalTrades: totalTrades[0]?.count || 0,
      totalAiRequests: totalAiRequests[0]?.count || 0,
      totalMonitoringRuns: totalMonitoringRuns[0]?.count || 0,
      aiUsageByProvider,
      usersByMonitoringFreq
    };
  }

  async getBudgetAlert(): Promise<BudgetAlert | undefined> {
    const result = await db.select().from(budgetAlerts).limit(1);
    return result[0];
  }

  async upsertBudgetAlert(data: Partial<InsertBudgetAlert>): Promise<BudgetAlert> {
    // Check if budget alert exists
    const existing = await this.getBudgetAlert();
    
    if (existing) {
      // Update existing
      const result = await db.update(budgetAlerts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(budgetAlerts.id, existing.id))
        .returning();
      return result[0];
    } else {
      // Create new
      const result = await db.insert(budgetAlerts)
        .values(data as InsertBudgetAlert)
        .returning();
      return result[0];
    }
  }
}

export const storage = new DbStorage();
