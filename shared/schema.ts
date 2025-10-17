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
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
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
