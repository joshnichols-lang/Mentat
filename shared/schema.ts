import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password"), // Hashed password for username/password auth
  authProviderId: text("auth_provider_id").unique(), // For OAuth (Replit Auth)
  authProvider: text("auth_provider"), // "replit", "email", etc.
  firstName: text("first_name"), // From Replit Auth
  lastName: text("last_name"), // From Replit Auth
  profileImageUrl: text("profile_image_url"), // From Replit Auth
  role: text("role").notNull().default("user"), // "user", "admin"
  subscriptionStatus: text("subscription_status").notNull().default("inactive"), // "inactive", "active", "trial", "cancelled"
  subscriptionId: text("subscription_id"), // Stripe subscription ID
  onboardingStep: text("onboarding_step").notNull().default("auth"), // "auth", "ai_provider", "trading_accounts", "complete"
  agentMode: text("agent_mode").notNull().default("passive"), // "passive", "active"
  monitoringFrequencyMinutes: integer("monitoring_frequency_minutes").notNull().default(0), // 0 = disabled, per-user monitoring frequency
  walletAddress: text("wallet_address"), // Hyperliquid wallet address for referral verification
  verificationStatus: text("verification_status").notNull().default("pending"), // "pending", "approved", "rejected"
  verifiedAt: timestamp("verified_at"), // Timestamp when admin verified the wallet
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }), // Track which account executed this trade
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "long" or "short"
  type: text("type").notNull(), // "market" or "limit"
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 18, scale: 8 }),
  leverage: integer("leverage").notNull().default(1),
  pnl: decimal("pnl", { precision: 18, scale: 8 }),
  status: text("status").notNull().default("open"), // "open", "closed", "cancelled"
  entryTimestamp: timestamp("entry_timestamp").notNull().defaultNow(),
  exitTimestamp: timestamp("exit_timestamp"),
  aiPrompt: text("ai_prompt"),
});

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }), // Track which account holds this position
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }).notNull(),
  leverage: integer("leverage").notNull().default(1),
  pnl: decimal("pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  pnlPercent: decimal("pnl_percent", { precision: 10, scale: 6 }).notNull().default("0"),
  // Protective order tracking for risk management
  initialStopLoss: decimal("initial_stop_loss", { precision: 18, scale: 8 }), // Set once when position opens
  currentStopLoss: decimal("current_stop_loss", { precision: 18, scale: 8 }), // Can move to protect gains (only in favorable direction)
  currentTakeProfit: decimal("current_take_profit", { precision: 18, scale: 8 }), // Can be adjusted based on market conditions
  stopLossState: text("stop_loss_state").notNull().default("initial"), // "initial", "locked", "trailing"
  lastAdjustmentAt: timestamp("last_adjustment_at"), // When protective orders were last adjusted
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// Protective order events log - tracks all SL/TP adjustments with reasons
export const protectiveOrderEvents = pgTable("protective_order_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  positionId: varchar("position_id").references(() => positions.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  eventType: text("event_type").notNull(), // "set_initial", "adjust_sl", "adjust_tp", "rejected"
  previousStopLoss: decimal("previous_stop_loss", { precision: 18, scale: 8 }),
  newStopLoss: decimal("new_stop_loss", { precision: 18, scale: 8 }),
  previousTakeProfit: decimal("previous_take_profit", { precision: 18, scale: 8 }),
  newTakeProfit: decimal("new_take_profit", { precision: 18, scale: 8 }),
  reason: text("reason").notNull(), // AI's reasoning for the adjustment (must reference market structure)
  currentPnl: decimal("current_pnl", { precision: 18, scale: 8 }), // PnL at time of adjustment
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }), // Market price at time of adjustment
  rejected: integer("rejected").notNull().default(0), // 1 if adjustment was rejected by validation
  rejectionReason: text("rejection_reason"), // Why adjustment was rejected
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  totalValue: decimal("total_value", { precision: 18, scale: 8 }).notNull(),
  totalPnl: decimal("total_pnl", { precision: 18, scale: 8 }).notNull(),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 6 }),
  calmarRatio: decimal("calmar_ratio", { precision: 10, scale: 6 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 10, scale: 6 }),
  sterlingRatio: decimal("sterling_ratio", { precision: 10, scale: 6 }),
  treynorRatio: decimal("treynor_ratio", { precision: 10, scale: 6 }),
  omegaRatio: decimal("omega_ratio", { precision: 10, scale: 6 }),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 6 }),
  numTrades: integer("num_trades").notNull().default(0),
  numWins: integer("num_wins").notNull().default(0),
});

export const aiUsageLog = pgTable("ai_usage_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  provider: text("provider").notNull(), // "openai", "perplexity", "xai"
  model: text("model").notNull(), // e.g., "gpt-5", "sonar-pro", "grok-2"
  mode: text("mode").notNull().default("passive"), // "passive" or "active"
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 }).notNull(),
  userPrompt: text("user_prompt"),
  aiResponse: text("ai_response"),
  success: integer("success").notNull().default(1), // 1 = success, 0 = error
});

export const monitoringLog = pgTable("monitoring_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  analysis: text("analysis").notNull(), // AI's position analysis as JSON
  alertLevel: text("alert_level").notNull().default("info"), // "info", "warning", "critical"
  suggestions: text("suggestions"), // Trading suggestions
  dismissed: integer("dismissed").notNull().default(0), // 0 = active, 1 = dismissed by user
});

export const userApiCredentials = pgTable("user_api_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  encryptedPrivateKey: text("encrypted_private_key").notNull(), // Private key encrypted with DEK
  credentialIv: text("credential_iv").notNull(), // IV for private key encryption
  encryptedDek: text("encrypted_dek").notNull(), // DEK encrypted with master key
  dekIv: text("dek_iv").notNull(), // IV for DEK encryption
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsed: timestamp("last_used"),
});

// Multi-provider API keys table for AI and Exchange APIs
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerType: text("provider_type").notNull(), // "ai" or "exchange"
  providerName: text("provider_name").notNull(), // AI: "perplexity", "openai", "xai" | Exchange: "hyperliquid", "binance", "bybit"
  label: text("label").notNull(), // User-defined label for this API key (e.g., "Main Account", "Aggressive Strategy")
  // Encrypted credentials using envelope encryption
  encryptedApiKey: text("encrypted_api_key").notNull(), // API key/secret encrypted with DEK
  apiKeyIv: text("api_key_iv").notNull(), // IV for API key encryption
  encryptedDek: text("encrypted_dek").notNull(), // DEK encrypted with master key
  dekIv: text("dek_iv").notNull(), // IV for DEK encryption
  // Optional fields for exchange-specific configs
  publicKey: text("public_key"), // For exchanges that use public/private key pairs
  metadata: jsonb("metadata"), // Additional provider-specific config (e.g., testnet flag, API permissions)
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsed: timestamp("last_used"),
}, (table) => [
  // Ensure unique labels per provider per user
  uniqueIndex("api_keys_unique_label").on(table.userId, table.providerName, table.label),
]);

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: text("status").notNull().default("inactive"), // "inactive", "active", "trial", "cancelled", "past_due"
  planName: text("plan_name"), // "basic", "pro", "enterprise"
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // "trial", "discount", "lifetime"
  durationDays: integer("duration_days"), // For trial/limited access
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  active: integer("active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const promoCodeRedemptions = pgTable("promo_code_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promoCodeId: varchar("promo_code_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
  redeemedAt: timestamp("redeemed_at").notNull().defaultNow(),
});

export const automationRuns = pgTable("automation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: text("status").notNull(), // "success", "error", "skipped"
  tradeThesis: text("trade_thesis"), // AI-generated trade thesis
  marketRegime: text("market_regime"), // "bullish", "bearish", "neutral", "volatile"
  actionsExecuted: integer("actions_executed").notNull().default(0),
  errorMessage: text("error_message"),
});

export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  screenshotUrl: text("screenshot_url"), // Base64 or uploaded file URL
  status: text("status").notNull().default("pending"), // "pending", "resolved"
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }), // Admin who resolved
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Trade evaluation and learning system
export const tradeEvaluations = pgTable("trade_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tradeId: varchar("trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
  evaluatedAt: timestamp("evaluated_at").notNull().defaultNow(),
  // Quantitative metrics
  pnlVsExpectancy: decimal("pnl_vs_expectancy", { precision: 10, scale: 6 }), // Actual PnL vs expected PnL
  stopLossAdherence: integer("stop_loss_adherence").notNull().default(1), // 1 = followed, 0 = violated
  riskRewardRatio: decimal("risk_reward_ratio", { precision: 10, scale: 6 }), // Actual R:R achieved
  entryQuality: decimal("entry_quality", { precision: 10, scale: 6 }), // 0-100 score based on fill price vs limit
  exitQuality: decimal("exit_quality", { precision: 10, scale: 6 }), // 0-100 score based on exit timing
  slippagePercent: decimal("slippage_percent", { precision: 10, scale: 6 }), // Entry/exit slippage
  holdingPeriodMinutes: integer("holding_period_minutes"), // Time held in minutes
  // Market context
  marketRegime: text("market_regime"), // "bullish", "bearish", "volatile", "neutral" at trade time
  volumeAtEntry: decimal("volume_at_entry", { precision: 18, scale: 8 }), // 24h volume when entered
  volatilityAtEntry: decimal("volatility_at_entry", { precision: 10, scale: 6 }), // Market volatility %
  // AI-generated qualitative analysis
  aiSummary: text("ai_summary"), // AI's reflection on what worked/didn't work
  lessonsLearned: jsonb("lessons_learned"), // Structured insights: { entry: [], exit: [], sizing: [], timing: [] }
  anomalyFlags: jsonb("anomaly_flags"), // Detected issues: { type: "premature_exit", severity: "high", description: "..." }
});

export const strategyLearnings = pgTable("strategy_learnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Categorization
  category: text("category").notNull(), // "regime", "execution", "sizing", "asset", "timing", "risk_management"
  subcategory: text("subcategory"), // More specific: "bullish_regime", "limit_orders", "btc_specific", etc
  marketRegime: text("market_regime"), // Regime-specific insights ("bullish", "bearish", "volatile", "neutral")
  assetSymbol: text("asset_symbol"), // Asset-specific insights (e.g., "BTC-PERP")
  // Learning content
  insight: text("insight").notNull(), // Core lesson learned
  supportingEvidence: jsonb("supporting_evidence"), // Trades that support this learning: [{ tradeId, pnl, date }, ...]
  confidenceScore: decimal("confidence_score", { precision: 10, scale: 6 }), // 0-100 based on sample size & consistency
  // Performance metrics
  avgPnlWhenApplied: decimal("avg_pnl_when_applied", { precision: 18, scale: 8 }), // Average PnL from trades following this rule
  sampleSize: integer("sample_size").notNull().default(1), // Number of trades contributing to this learning
  successRate: decimal("success_rate", { precision: 10, scale: 6 }), // Win rate when applied
  // Decay and relevance
  decayWeight: decimal("decay_weight", { precision: 10, scale: 6 }).notNull().default("1.0"), // Exponential decay: base * exp(-days/half_life)
  lastApplied: timestamp("last_applied"), // When this learning was last used in a trade decision
  isActive: integer("is_active").notNull().default(1), // 0 = archived, 1 = active
});

export const marketRegimeSnapshots = pgTable("market_regime_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  regime: text("regime").notNull(), // "bullish", "bearish", "volatile", "neutral"
  // Market indicators
  overallVolatility: decimal("overall_volatility", { precision: 10, scale: 6 }), // Market-wide volatility %
  btcTrend: text("btc_trend"), // "up", "down", "sideways"
  ethTrend: text("eth_trend"), // "up", "down", "sideways"
  dominantVolumeAssets: jsonb("dominant_volume_assets"), // Top 5 by volume: [{ symbol, volume24h, change24h }, ...]
  // Performance in this regime
  tradesInRegime: integer("trades_in_regime").notNull().default(0),
  avgPnlInRegime: decimal("avg_pnl_in_regime", { precision: 18, scale: 8 }),
  winRateInRegime: decimal("win_rate_in_regime", { precision: 10, scale: 6 }),
  sharpeInRegime: decimal("sharpe_in_regime", { precision: 10, scale: 6 }),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const upsertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true }).partial();
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, userId: true, entryTimestamp: true });
export const insertPositionSchema = createInsertSchema(positions).omit({ id: true, userId: true, lastUpdated: true });
export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({ id: true, userId: true, timestamp: true });
export const insertAiUsageLogSchema = createInsertSchema(aiUsageLog).omit({ id: true, userId: true, timestamp: true });
export const insertMonitoringLogSchema = createInsertSchema(monitoringLog).omit({ id: true, userId: true, timestamp: true });
export const insertUserApiCredentialSchema = createInsertSchema(userApiCredentials).omit({ id: true, createdAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, userId: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, createdAt: true });
export const insertPromoCodeRedemptionSchema = createInsertSchema(promoCodeRedemptions).omit({ id: true, redeemedAt: true });
export const insertAutomationRunSchema = createInsertSchema(automationRuns).omit({ id: true, timestamp: true });
export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, userId: true, createdAt: true });
export const insertTradeEvaluationSchema = createInsertSchema(tradeEvaluations).omit({ id: true, userId: true, evaluatedAt: true });
export const insertStrategyLearningSchema = createInsertSchema(strategyLearnings).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const insertMarketRegimeSnapshotSchema = createInsertSchema(marketRegimeSnapshots).omit({ id: true, userId: true, timestamp: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;
export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type AiUsageLog = typeof aiUsageLog.$inferSelect;
export type InsertMonitoringLog = z.infer<typeof insertMonitoringLogSchema>;
export type MonitoringLog = typeof monitoringLog.$inferSelect;
export type InsertUserApiCredential = z.infer<typeof insertUserApiCredentialSchema>;
export type UserApiCredential = typeof userApiCredentials.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCodeRedemption = z.infer<typeof insertPromoCodeRedemptionSchema>;
export type PromoCodeRedemption = typeof promoCodeRedemptions.$inferSelect;
export type InsertAutomationRun = z.infer<typeof insertAutomationRunSchema>;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertTradeEvaluation = z.infer<typeof insertTradeEvaluationSchema>;
export type TradeEvaluation = typeof tradeEvaluations.$inferSelect;
export type InsertStrategyLearning = z.infer<typeof insertStrategyLearningSchema>;
export type StrategyLearning = typeof strategyLearnings.$inferSelect;
export type InsertMarketRegimeSnapshot = z.infer<typeof insertMarketRegimeSnapshotSchema>;
export type MarketRegimeSnapshot = typeof marketRegimeSnapshots.$inferSelect;
