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
  username: text("username").unique(), // Optional for wallet users
  email: text("email").unique(),
  password: text("password"), // Hashed password for username/password auth
  authProviderId: text("auth_provider_id").unique(), // For OAuth (Replit Auth)
  authProvider: text("auth_provider"), // "replit", "email", "wallet", etc.
  firstName: text("first_name"), // From Replit Auth or wallet ENS
  lastName: text("last_name"), // From Replit Auth
  profileImageUrl: text("profile_image_url"), // From Replit Auth
  role: text("role").notNull().default("user"), // "user", "admin"
  subscriptionStatus: text("subscription_status").notNull().default("inactive"), // "inactive", "active", "trial", "cancelled"
  subscriptionId: text("subscription_id"), // Stripe subscription ID
  onboardingStep: text("onboarding_step").notNull().default("auth"), // "auth", "ai_provider", "trading_accounts", "complete"
  agentMode: text("agent_mode").notNull().default("passive"), // "passive", "active"
  monitoringFrequencyMinutes: integer("monitoring_frequency_minutes").notNull().default(0), // 0 = disabled, per-user monitoring frequency
  maxAiCallsPerHour: integer("max_ai_calls_per_hour"), // null = unlimited, integer = max AI calls per hour for cost control
  marginMode: text("margin_mode").notNull().default("isolated"), // "isolated", "cross" - margin mode for trading
  walletAddress: text("wallet_address"), // DEPRECATED: Kept for backward compatibility, migrating to user_wallets table
  verificationStatus: text("verification_status").notNull().default("approved"), // "pending", "approved", "rejected" - Auto-approved for all users
  verifiedAt: timestamp("verified_at"), // Timestamp when admin verified the wallet
  // Tier system for AI access control and monetization
  tier: text("tier").notNull().default("free"), // "free", "bronze", "silver", "gold", "platinum"
  aiCallsToday: integer("ai_calls_today").notNull().default(0), // Track daily AI calls for quota enforcement
  aiCallsResetAt: timestamp("ai_calls_reset_at").notNull().defaultNow(), // When to reset daily counter
  totalDepositUsd: decimal("total_deposit_usd", { precision: 18, scale: 2 }).notNull().default("0"), // Total deposits for tier calculation
  totalVolumeUsd: decimal("total_volume_usd", { precision: 18, scale: 2 }).notNull().default("0"), // Total trading volume for tier calculation
  x402Balance: decimal("x402_balance", { precision: 18, scale: 6 }).notNull().default("0"), // USDC balance for x402 micropayments
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Multi-wallet support for cross-chain trading and authentication
export const userWallets = pgTable("user_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(), // Raw wallet address
  normalizedAddress: text("normalized_address").notNull(), // Lowercased for EVM, checksummed for others
  chain: text("chain").notNull(), // "arbitrum", "mainnet", "base", "optimism", "solana", etc.
  chainId: text("chain_id"), // EVM chain ID or Solana cluster (mainnet-beta, devnet)
  walletType: text("wallet_type").notNull(), // "metamask", "rabby", "walletconnect", "phantom", "backpack"
  purpose: text("purpose").notNull(), // "auth", "trading", "both"
  isAuthPrimary: integer("is_auth_primary").notNull().default(0), // 1 if this is primary auth wallet
  isTrading: integer("is_trading").notNull().default(0), // 1 if used for trading
  isVerified: integer("is_verified").notNull().default(0), // 1 if ownership verified via signature
  verifiedAt: timestamp("verified_at"),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("unique_user_wallet").on(table.userId, table.normalizedAddress, table.chain),
  index("idx_normalized_address").on(table.normalizedAddress),
  index("idx_user_auth_primary").on(table.userId, table.isAuthPrimary),
]);

// Embedded wallets - Platform-generated wallets derived from a single BIP39 seed phrase
// CRITICAL SECURITY: Private keys and seed phrases are NEVER stored in database
// Only public addresses are stored for balance queries and transaction monitoring
export const embeddedWallets = pgTable("embedded_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  // Public addresses only - NO PRIVATE KEYS
  solanaAddress: text("solana_address").notNull(), // Solana mainnet address
  evmAddress: text("evm_address").notNull(), // EVM address (Arbitrum, Ethereum, etc)
  polygonAddress: text("polygon_address").notNull(), // Polygon address (same as EVM, for Polymarket)
  hyperliquidAddress: text("hyperliquid_address").notNull(), // Hyperliquid trading address (same as EVM)
  bnbAddress: text("bnb_address").notNull(), // BNB Chain address (same as EVM, BSC is EVM-compatible)
  // API wallet for Hyperliquid trading - separate wallet with limited permissions
  apiWalletAddress: text("api_wallet_address"), // API wallet public address (private key stored encrypted in apiKeys table)
  apiWalletApproved: integer("api_wallet_approved").notNull().default(0), // 1 = user has signed approveAgent transaction
  apiWalletApprovedAt: timestamp("api_wallet_approved_at"),
  // 1fox referral code for earning trading fees
  referralCode: text("referral_code").notNull().default("1FOX"), // Default 1fox referral code
  // Seed phrase shown once on creation, then deleted - NEVER stored
  seedPhraseShown: integer("seed_phrase_shown").notNull().default(0), // 1 = user has seen and confirmed seed phrase
  seedPhraseShownAt: timestamp("seed_phrase_shown_at"),
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
  manualStopLossOverride: integer("manual_stop_loss_override").notNull().default(0), // 1 = user manually set stop loss, AI must not override
  manualOverrideAt: timestamp("manual_override_at"), // When user manually adjusted the stop loss
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
  strategyId: text("strategy_id"), // References trading_modes.id OR null for "general" context
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

// Trade history import system - for uploading and analyzing past trades
export const userTradeHistoryImports = pgTable("user_trade_history_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // "csv", "manual"
  fileName: text("file_name"), // Original filename for CSV uploads
  status: text("status").notNull().default("processing"), // "processing", "completed", "failed"
  totalRows: integer("total_rows").notNull().default(0),
  successfulRows: integer("successful_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  errors: jsonb("errors"), // Array of error objects: [{ row: 5, field: "symbol", error: "Invalid symbol" }]
  analysisStatus: text("analysis_status").notNull().default("pending"), // "pending", "analyzing", "completed", "failed"
  analysisResults: jsonb("analysis_results"), // AI-generated insights from trade history
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const userTradeHistoryTrades = pgTable("user_trade_history_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  importId: varchar("import_id").notNull().references(() => userTradeHistoryImports.id, { onDelete: "cascade" }),
  // Trade data
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "long" or "short"
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 18, scale: 8 }),
  leverage: integer("leverage").notNull().default(1),
  pnl: decimal("pnl", { precision: 18, scale: 8 }),
  pnlPercent: decimal("pnl_percent", { precision: 10, scale: 6 }),
  entryTimestamp: timestamp("entry_timestamp").notNull(),
  exitTimestamp: timestamp("exit_timestamp"),
  notes: text("notes"), // User-provided notes about the trade
  // Metadata
  isWin: integer("is_win"), // 1 = win, 0 = loss, null = open
  holdingPeriodMinutes: integer("holding_period_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tradeStyleProfiles = pgTable("trade_style_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  importId: varchar("import_id").references(() => userTradeHistoryImports.id, { onDelete: "cascade" }), // Optional: link to specific import
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Trading style factors
  preferredAssets: jsonb("preferred_assets"), // [{ symbol: "BTC-PERP", frequency: 45, winRate: 0.62 }]
  avgPositionSize: decimal("avg_position_size", { precision: 18, scale: 8 }),
  avgLeverage: decimal("avg_leverage", { precision: 10, scale: 2 }),
  avgHoldingPeriodMinutes: integer("avg_holding_period_minutes"),
  preferredTimeOfDay: jsonb("preferred_time_of_day"), // [{ hour: 14, frequency: 12, winRate: 0.7 }]
  riskTolerance: text("risk_tolerance"), // "conservative", "moderate", "aggressive"
  avgRiskRewardRatio: decimal("avg_risk_reward_ratio", { precision: 10, scale: 6 }),
  winRate: decimal("win_rate", { precision: 10, scale: 6 }),
  // Pattern recognition
  entryPatterns: jsonb("entry_patterns"), // Common entry triggers identified by AI
  exitPatterns: jsonb("exit_patterns"), // Common exit triggers identified by AI
  strengthsAnalysis: text("strengths_analysis"), // AI summary of what user does well
  weaknessesAnalysis: text("weaknesses_analysis"), // AI summary of areas to improve
  improvementSuggestions: jsonb("improvement_suggestions"), // [{ category: "exit_timing", suggestion: "...", priority: "high" }]
  // Confidence and sample size
  sampleSize: integer("sample_size").notNull().default(0), // Number of trades analyzed
  confidenceScore: decimal("confidence_score", { precision: 10, scale: 6 }), // 0-100 confidence in analysis
  isActive: integer("is_active").notNull().default(1), // 0 = archived, 1 = active
});

// Trade journal - AI's reasoning and analysis for each trading decision
export const tradeJournalEntries = pgTable("trade_journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tradeId: varchar("trade_id").references(() => trades.id, { onDelete: "cascade" }), // Null for planned trades not yet executed
  evaluationId: varchar("evaluation_id").references(() => tradeEvaluations.id, { onDelete: "set null" }), // Link to evaluation when closed
  tradingModeId: varchar("trading_mode_id").references(() => tradingModes.id, { onDelete: "set null" }), // Strategy used for this trade
  
  // Trade identification
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "long" or "short"
  entryType: text("entry_type").notNull(), // "position_opened", "limit_order_placed"
  status: text("status").notNull().default("planned"), // "planned", "active", "closed"
  orderId: text("order_id"), // Hyperliquid order ID (oid) for linking to specific orders
  
  // Entry reasoning and expectations
  entryReasoning: text("entry_reasoning").notNull(), // AI's detailed explanation for why this trade was planned/entered
  expectations: text("expectations").notNull(), // AI's expectations for the trade (targets, timeframe, market conditions)
  exitCriteria: text("exit_criteria"), // AI's detailed reasoning for stop loss placement based on market structure
  expectedRoi: decimal("expected_roi", { precision: 10, scale: 6 }), // Expected ROI percentage for this trade
  marketContext: jsonb("market_context"), // Market conditions at entry: { regime, volatility, volume, etc }
  
  // Planned trade details
  plannedEntryPrice: decimal("planned_entry_price", { precision: 18, scale: 8 }),
  actualEntryPrice: decimal("actual_entry_price", { precision: 18, scale: 8 }),
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  leverage: integer("leverage").notNull().default(1),
  stopLoss: decimal("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: decimal("take_profit", { precision: 18, scale: 8 }),
  
  // Close analysis (populated when trade closes)
  closePrice: decimal("close_price", { precision: 18, scale: 8 }),
  closePnl: decimal("close_pnl", { precision: 18, scale: 8 }),
  closePnlPercent: decimal("close_pnl_percent", { precision: 10, scale: 6 }),
  closeReasoning: text("close_reasoning"), // AI's analysis of what happened
  hitTarget: integer("hit_target"), // 1 = hit target, 0 = did not hit target
  hadAdjustments: integer("had_adjustments").notNull().default(0), // 1 = stop/target were adjusted, 0 = no adjustments
  adjustmentDetails: jsonb("adjustment_details"), // Details of any adjustments made: [{ timestamp, type, from, to, reason }]
  whatWentWrong: text("what_went_wrong"), // If loss, AI's analysis of what went wrong
  lessonsLearned: text("lessons_learned"), // Key takeaways from this trade
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  activatedAt: timestamp("activated_at"), // When limit order filled or position opened
  closedAt: timestamp("closed_at"), // When trade was closed
});

// Trading modes - user-defined strategies for different trading styles
export const tradingModes = pgTable("trading_modes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // User-defined name (e.g., "Aggressive Scalper", "Conservative Swing")
  type: text("type").default("custom"), // Optional: "scalp", "swing", "discretionary", "custom"
  description: text("description"), // Optional user description
  avatarUrl: text("avatar_url"), // Strategy character avatar image path (stored in attached_assets/strategy_avatars)
  tagline: text("tagline"), // Short tagline/slogan (max 80 chars, e.g., "The Night Scalper")
  
  // Strategy parameters (flexible JSON structure)
  parameters: jsonb("parameters").notNull(), // {
  //   timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d",
  //   riskPercentPerTrade: 1-10,
  //   maxPositions: 1-10,
  //   maxLeverage: 1-20,
  //   maxEntryOrdersPerSymbol: 1-10, // Max scaled entry orders per symbol
  //   preferredAssets: ["BTC-PERP", "ETH-PERP"], // AI preference hint
  //   restrictedAssets: ["BTC-PERP"], // HARD restriction - can ONLY trade these symbols if set
  //   tradingHours: { start: "08:00", end: "16:00", timezone: "UTC" },
  //   entryStyle: "patient" | "aggressive",
  //   exitStyle: "target-based" | "trailing",
  //   customRules: "Any custom AI instructions",
  //   triggerSensitivity: "conservative" | "moderate" | "aggressive", // AI call frequency (5%, 10%, 20%)
  // }
  
  // AI-analyzed strategy configuration (auto-generated from custom rules)
  strategyConfig: jsonb("strategy_config"), // {
  //   strategyType: "technical_indicator" | "order_flow" | "market_profile" | "price_action" | "hybrid",
  //   detectedIndicators: ["RSI", "MACD", "BollingerBands", "Stochastic"],
  //   indicatorConfig: {
  //     rsi: { period: 14, oversold: 30, overbought: 70 },
  //     macd: { fast: 12, slow: 26, signal: 9 },
  //     bollingerBands: { period: 20, stdDev: 2 },
  //     stochastic: { kPeriod: 14, dPeriod: 3, oversold: 20, overbought: 80 }
  //   },
  //   orderFlowConfig: {
  //     imbalanceRatio: 3.0, // Trigger when bid/ask imbalance >= 3x
  //     minImbalanceVolume: 1000, // Minimum volume for imbalance detection
  //     deltaThreshold: 30, // Delta % threshold for buy/sell pressure
  //     depthImbalanceRatio: 1.5 // Order book depth imbalance ratio
  //   },
  //   marketProfileConfig: {
  //     tickSize: 1,
  //     detectVABreakouts: true, // Detect Value Area breakouts
  //     detectIBBreakouts: true, // Detect Initial Balance breakouts
  //     detectPOCTests: true, // Detect Point of Control tests
  //     pocTolerance: 0.5 // % tolerance for POC test detection
  //   },
  //   monitoringFrequencyMinutes: 5, // Optimal monitoring frequency
  //   requiresRealtimeData: false, // true for order flow strategies
  //   triggerMode: "indicator" | "time_based" | "hybrid"
  // }
  
  isActive: integer("is_active").notNull().default(0), // Only one mode can be active at a time per user
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Budget alerts - admin cost monitoring and alerts
export const budgetAlerts = pgTable("budget_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  monthlyBudget: decimal("monthly_budget", { precision: 10, scale: 2 }), // Alert threshold in dollars
  alertEmail: text("alert_email"), // Email to send alerts to
  enableAlerts: integer("enable_alerts").notNull().default(1), // 1 = enabled, 0 = disabled
  lastAlertSent: timestamp("last_alert_sent"), // When we last sent an alert
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Polymarket Events - Prediction market events from Polymarket
export const polymarketEvents = pgTable("polymarket_events", {
  id: varchar("id").primaryKey(), // Polymarket's unique event ID
  conditionId: text("condition_id").notNull(), // Polymarket condition ID
  questionId: text("question_id"), // Question ID if part of a multi-market question
  question: text("question").notNull(), // Event question (e.g., "Will Bitcoin reach $100k in 2025?")
  description: text("description"), // Full event description
  category: text("category").notNull(), // "crypto", "politics", "sports", "entertainment", etc.
  outcomes: text("outcomes").array().notNull(), // ["Yes", "No"] or custom outcomes
  
  // Market data
  yesTokenId: text("yes_token_id").notNull(), // Token ID for YES outcome
  noTokenId: text("no_token_id").notNull(), // Token ID for NO outcome
  yesPrice: decimal("yes_price", { precision: 10, scale: 8 }), // Current YES token price (0-1)
  noPrice: decimal("no_price", { precision: 10, scale: 8 }), // Current NO token price (0-1)
  volume24h: decimal("volume_24h", { precision: 18, scale: 2 }), // 24h volume in USDC
  liquidity: decimal("liquidity", { precision: 18, scale: 2 }), // Total liquidity in USDC
  
  // Status
  active: integer("active").notNull().default(1), // 1 = active, 0 = closed/resolved
  closed: integer("closed").notNull().default(0), // 1 = closed for trading
  resolved: integer("resolved").notNull().default(0), // 1 = event resolved
  winningOutcome: text("winning_outcome"), // "Yes" or "No" when resolved
  
  // Metadata
  endDate: timestamp("end_date"), // When event closes for trading
  marketMakerAddress: text("market_maker_address"), // Polymarket market maker contract
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_polymarket_events_category").on(table.category),
  index("idx_polymarket_events_active").on(table.active),
]);

// Polymarket Positions - User positions in prediction markets
export const polymarketPositions = pgTable("polymarket_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: varchar("event_id").notNull().references(() => polymarketEvents.id, { onDelete: "cascade" }),
  
  // Position details
  outcome: text("outcome").notNull(), // "Yes" or "No"
  tokenId: text("token_id").notNull(), // Token ID being held
  shares: decimal("shares", { precision: 18, scale: 8 }).notNull(), // Number of outcome tokens held
  averagePrice: decimal("average_price", { precision: 10, scale: 8 }).notNull(), // Average entry price
  invested: decimal("invested", { precision: 18, scale: 2 }).notNull(), // Total USDC invested
  
  // Current value
  currentPrice: decimal("current_price", { precision: 10, scale: 8 }), // Current token price
  currentValue: decimal("current_value", { precision: 18, scale: 2 }), // Current position value in USDC
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 2 }), // Unrealized profit/loss
  unrealizedPnlPercent: decimal("unrealized_pnl_percent", { precision: 10, scale: 6 }), // Unrealized PnL %
  
  // Status
  status: text("status").notNull().default("open"), // "open", "closed"
  
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_polymarket_positions_user").on(table.userId),
  index("idx_polymarket_positions_event").on(table.eventId),
  index("idx_polymarket_positions_status").on(table.status),
]);

// Polymarket Orders - Orders placed on Polymarket
export const polymarketOrders = pgTable("polymarket_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: varchar("event_id").notNull().references(() => polymarketEvents.id, { onDelete: "cascade" }),
  positionId: varchar("position_id").references(() => polymarketPositions.id, { onDelete: "set null" }),
  
  // Order details
  polymarketOrderId: text("polymarket_order_id"), // Polymarket's order ID
  outcome: text("outcome").notNull(), // "Yes" or "No"
  tokenId: text("token_id").notNull(), // Token ID
  side: text("side").notNull(), // "BUY" or "SELL"
  orderType: text("order_type").notNull(), // "market", "limit"
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 8 }).notNull(), // Limit price or execution price
  size: decimal("size", { precision: 18, scale: 8 }).notNull(), // Number of tokens
  filledSize: decimal("filled_size", { precision: 18, scale: 8 }).notNull().default("0"), // Filled amount
  
  // Fees and totals
  totalCost: decimal("total_cost", { precision: 18, scale: 2 }), // Total USDC cost
  fee: decimal("fee", { precision: 18, scale: 2 }), // Trading fee
  
  // Status
  status: text("status").notNull().default("pending"), // "pending", "filled", "partial", "cancelled"
  
  // AI context
  aiPrompt: text("ai_prompt"), // Original AI prompt that generated this order
  tradingModeId: varchar("trading_mode_id").references(() => tradingModes.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  filledAt: timestamp("filled_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => [
  index("idx_polymarket_orders_user").on(table.userId),
  index("idx_polymarket_orders_event").on(table.eventId),
  index("idx_polymarket_orders_status").on(table.status),
]);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const upsertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true }).partial();
export const insertUserWalletSchema = createInsertSchema(userWallets).omit({ id: true, userId: true, createdAt: true });
export const insertEmbeddedWalletSchema = createInsertSchema(embeddedWallets).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
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
export const insertProtectiveOrderEventSchema = createInsertSchema(protectiveOrderEvents).omit({ id: true, userId: true, timestamp: true });
export const insertUserTradeHistoryImportSchema = createInsertSchema(userTradeHistoryImports).omit({ id: true, userId: true, createdAt: true });
export const insertUserTradeHistoryTradeSchema = createInsertSchema(userTradeHistoryTrades).omit({ id: true, userId: true, createdAt: true });
export const insertTradeStyleProfileSchema = createInsertSchema(tradeStyleProfiles).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const insertTradeJournalEntrySchema = createInsertSchema(tradeJournalEntries).omit({ id: true, userId: true, createdAt: true });
export const insertTradingModeSchema = createInsertSchema(tradingModes).omit({ id: true, userId: true, createdAt: true, updatedAt: true }).extend({
  tagline: z.string().max(80, "Tagline must be 80 characters or less").optional(),
  avatarUrl: z.string().optional(),
});
export const insertBudgetAlertSchema = createInsertSchema(budgetAlerts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPolymarketEventSchema = createInsertSchema(polymarketEvents).omit({ createdAt: true, updatedAt: true });
export const insertPolymarketPositionSchema = createInsertSchema(polymarketPositions).omit({ id: true, userId: true, openedAt: true, updatedAt: true });
export const insertPolymarketOrderSchema = createInsertSchema(polymarketOrders).omit({ id: true, userId: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserWallet = z.infer<typeof insertUserWalletSchema>;
export type UserWallet = typeof userWallets.$inferSelect;
export type InsertEmbeddedWallet = z.infer<typeof insertEmbeddedWalletSchema>;
export type EmbeddedWallet = typeof embeddedWallets.$inferSelect;
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
export type InsertProtectiveOrderEvent = z.infer<typeof insertProtectiveOrderEventSchema>;
export type ProtectiveOrderEvent = typeof protectiveOrderEvents.$inferSelect;
export type InsertUserTradeHistoryImport = z.infer<typeof insertUserTradeHistoryImportSchema>;
export type UserTradeHistoryImport = typeof userTradeHistoryImports.$inferSelect;
export type InsertUserTradeHistoryTrade = z.infer<typeof insertUserTradeHistoryTradeSchema>;
export type UserTradeHistoryTrade = typeof userTradeHistoryTrades.$inferSelect;
export type InsertTradeStyleProfile = z.infer<typeof insertTradeStyleProfileSchema>;
export type TradeStyleProfile = typeof tradeStyleProfiles.$inferSelect;
export type InsertTradeJournalEntry = z.infer<typeof insertTradeJournalEntrySchema>;
export type TradeJournalEntry = typeof tradeJournalEntries.$inferSelect;
export type TradeJournalEntryWithStrategy = TradeJournalEntry & { tradingModeName: string | null };
export type InsertTradingMode = z.infer<typeof insertTradingModeSchema>;
export type TradingMode = typeof tradingModes.$inferSelect;
export type InsertBudgetAlert = z.infer<typeof insertBudgetAlertSchema>;
export type BudgetAlert = typeof budgetAlerts.$inferSelect;
export type InsertPolymarketEvent = z.infer<typeof insertPolymarketEventSchema>;
export type PolymarketEvent = typeof polymarketEvents.$inferSelect;
export type InsertPolymarketPosition = z.infer<typeof insertPolymarketPositionSchema>;
export type PolymarketPosition = typeof polymarketPositions.$inferSelect;
export type InsertPolymarketOrder = z.infer<typeof insertPolymarketOrderSchema>;
export type PolymarketOrder = typeof polymarketOrders.$inferSelect;

// Advanced Orders - Institutional-grade order types (TWAP, Limit Chase, Scaled, Iceberg, etc.)
export const advancedOrders = pgTable("advanced_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }), // Which exchange account
  tradingModeId: varchar("trading_mode_id").references(() => tradingModes.id, { onDelete: "set null" }), // Associated strategy
  
  // Order identification
  orderType: text("order_type").notNull(), // "twap", "limit_chase", "scaled", "iceberg", "oco", "trailing_tp", "grid", "conditional"
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "buy" or "sell"
  
  // Order size and pricing
  totalSize: decimal("total_size", { precision: 18, scale: 8 }).notNull(), // Total order size
  executedSize: decimal("executed_size", { precision: 18, scale: 8 }).notNull().default("0"), // Amount filled so far
  limitPrice: decimal("limit_price", { precision: 18, scale: 8 }), // Limit price (if applicable)
  
  // Order parameters (JSON for flexibility across different order types)
  parameters: jsonb("parameters").notNull(), // Type-specific params: intervals, offsets, grids, etc.
  
  // Execution tracking
  status: text("status").notNull().default("pending"), // "pending", "active", "paused", "completed", "cancelled", "failed"
  progress: decimal("progress", { precision: 5, scale: 2 }).notNull().default("0"), // Percentage complete (0-100)
  
  // Child orders tracking
  childOrderIds: text("child_order_ids").array(), // Array of Hyperliquid order IDs (oids) spawned by this advanced order
  executionLog: jsonb("execution_log"), // Array of execution events: [{ timestamp, action, price, size, reason }]
  
  // AI enhancement
  aiOptimized: integer("ai_optimized").notNull().default(0), // 1 = AI optimized the parameters
  aiReasoning: text("ai_reasoning"), // AI's explanation for parameter choices
  
  // Performance metrics
  averageExecutionPrice: decimal("average_execution_price", { precision: 18, scale: 8 }),
  totalSlippage: decimal("total_slippage", { precision: 10, scale: 6 }), // Actual vs. expected slippage
  estimatedSavings: decimal("estimated_savings", { precision: 18, scale: 2 }), // vs. market order
  
  // Error handling
  errorCount: integer("error_count").notNull().default(0),
  lastError: text("last_error"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  lastExecutionAt: timestamp("last_execution_at"),
}, (table) => [
  index("idx_advanced_orders_user_status").on(table.userId, table.status),
  index("idx_advanced_orders_type").on(table.orderType),
]);

// Advanced Order Executions - Track each child order/slice execution
export const advancedOrderExecutions = pgTable("advanced_order_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advancedOrderId: varchar("advanced_order_id").notNull().references(() => advancedOrders.id, { onDelete: "cascade" }),
  
  // Execution details
  sequenceNumber: integer("sequence_number").notNull(), // Order of execution (1, 2, 3...)
  hyperliquidOrderId: text("hyperliquid_order_id"), // oid from Hyperliquid
  
  // Order specs
  orderType: text("order_type").notNull(), // "market", "limit"
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  limitPrice: decimal("limit_price", { precision: 18, scale: 8 }),
  
  // Execution results
  status: text("status").notNull().default("pending"), // "pending", "submitted", "filled", "partial", "cancelled", "failed"
  filledSize: decimal("filled_size", { precision: 18, scale: 8 }).notNull().default("0"),
  averagePrice: decimal("average_price", { precision: 18, scale: 8 }),
  
  // Market conditions at execution
  marketPrice: decimal("market_price", { precision: 18, scale: 8 }), // Market price when order placed
  slippage: decimal("slippage", { precision: 10, scale: 6 }), // Actual vs. expected
  
  // Reason and context
  executionReason: text("execution_reason"), // Why this slice was executed now
  marketConditions: jsonb("market_conditions"), // { volume, spread, volatility, liquidity }
  
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  filledAt: timestamp("filled_at"),
}, (table) => [
  index("idx_advanced_order_executions_parent").on(table.advancedOrderId),
]);

// Options Trading - Aevo integration for onchain options
// Options Strategies - Pre-built (Straddle, Strap, Strip) and custom strategies
export const optionsStrategies = pgTable("options_strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Strategy definition
  name: text("name").notNull(), // "Straddle", "Strap", "Strip", "Long Call", "Long Put", "Iron Condor", etc.
  type: text("type").notNull(), // "pre_built" or "custom"
  description: text("description"), // User-defined description for custom strategies
  
  // Market and timing
  asset: text("asset").notNull(), // "ETH", "BTC"
  strike: decimal("strike", { precision: 18, scale: 2 }), // Strike price (for ATM strategies, calculated dynamically)
  expiry: timestamp("expiry").notNull(), // Expiration timestamp
  expiryLabel: text("expiry_label"), // Human-readable: "31MAR25", "7DTE", etc.
  
  // Strategy parameters
  totalCost: decimal("total_cost", { precision: 18, scale: 6 }).notNull(), // Total premium paid (sum of all legs)
  maxProfit: decimal("max_profit", { precision: 18, scale: 6 }), // Max possible profit (null for unlimited)
  maxLoss: decimal("max_loss", { precision: 18, scale: 6 }).notNull(), // Max possible loss
  upperBreakeven: decimal("upper_breakeven", { precision: 18, scale: 2 }), // Upper breakeven price
  lowerBreakeven: decimal("lower_breakeven", { precision: 18, scale: 2 }), // Lower breakeven price (null for single-sided)
  
  // Market conditions at entry
  impliedVolatility: decimal("implied_volatility", { precision: 10, scale: 6 }), // IV at entry
  underlyingPrice: decimal("underlying_price", { precision: 18, scale: 2 }).notNull(), // Spot price at entry
  volatilityRegime: text("volatility_regime"), // "low", "medium", "high", "extreme" (for AI recommendations)
  
  // Status and P&L tracking
  status: text("status").notNull().default("active"), // "active", "closed", "expired"
  currentValue: decimal("current_value", { precision: 18, scale: 6 }).notNull().default("0"), // Current value of all legs
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 6 }).notNull().default("0"), // Current P&L
  realizedPnl: decimal("realized_pnl", { precision: 18, scale: 6 }), // P&L at close
  
  // AI suggestions
  aiRecommended: integer("ai_recommended").notNull().default(0), // 1 = suggested by Mr. Fox
  aiReasoning: text("ai_reasoning"), // AI's reasoning for recommending this strategy
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_options_strategies_user_status").on(table.userId, table.status),
  index("idx_options_strategies_asset").on(table.asset),
  index("idx_options_strategies_expiry").on(table.expiry),
]);

// Options Positions - Individual option legs (calls/puts) within strategies
export const optionsPositions = pgTable("options_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  strategyId: varchar("strategy_id").references(() => optionsStrategies.id, { onDelete: "set null" }), // Null for standalone options
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }), // Aevo API credentials used
  
  // Aevo instrument details
  instrumentId: text("instrument_id").notNull(), // Aevo's instrument ID
  instrumentName: text("instrument_name").notNull(), // e.g., "ETH-31MAR25-2000-C"
  
  // Option specification
  asset: text("asset").notNull(), // "ETH", "BTC"
  optionType: text("option_type").notNull(), // "call" or "put"
  strike: decimal("strike", { precision: 18, scale: 2 }).notNull(),
  expiry: timestamp("expiry").notNull(),
  
  // Position details
  side: text("side").notNull(), // "long" or "short"
  size: decimal("size", { precision: 18, scale: 6 }).notNull(), // Number of contracts
  entryPrice: decimal("entry_price", { precision: 18, scale: 6 }).notNull(), // Premium paid/received per contract
  currentPrice: decimal("current_price", { precision: 18, scale: 6 }).notNull(), // Current option price
  
  // Greeks (updated in real-time from Aevo)
  delta: decimal("delta", { precision: 10, scale: 6 }),
  gamma: decimal("gamma", { precision: 10, scale: 6 }),
  theta: decimal("theta", { precision: 10, scale: 6 }),
  vega: decimal("vega", { precision: 10, scale: 6 }),
  rho: decimal("rho", { precision: 10, scale: 6 }),
  impliedVolatility: decimal("implied_volatility", { precision: 10, scale: 6 }),
  
  // P&L tracking
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 6 }).notNull().default("0"),
  unrealizedPnlPercent: decimal("unrealized_pnl_percent", { precision: 10, scale: 6 }).notNull().default("0"),
  realizedPnl: decimal("realized_pnl", { precision: 18, scale: 6 }),
  
  // Status
  status: text("status").notNull().default("open"), // "open", "closed", "expired"
  
  // Metadata
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_options_positions_user").on(table.userId),
  index("idx_options_positions_strategy").on(table.strategyId),
  index("idx_options_positions_status").on(table.status),
  index("idx_options_positions_expiry").on(table.expiry),
]);

// Options Orders - Orders placed on Aevo
export const optionsOrders = pgTable("options_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  strategyId: varchar("strategy_id").references(() => optionsStrategies.id, { onDelete: "set null" }),
  positionId: varchar("position_id").references(() => optionsPositions.id, { onDelete: "set null" }),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  
  // Aevo order details
  aevoOrderId: text("aevo_order_id").unique(), // Aevo's order ID
  instrumentId: text("instrument_id").notNull(),
  instrumentName: text("instrument_name").notNull(),
  
  // Order specification
  asset: text("asset").notNull(),
  optionType: text("option_type").notNull(), // "call" or "put"
  strike: decimal("strike", { precision: 18, scale: 2 }).notNull(),
  expiry: timestamp("expiry").notNull(),
  
  // Order details
  side: text("side").notNull(), // "buy" or "sell"
  orderType: text("order_type").notNull(), // "market" or "limit"
  size: decimal("size", { precision: 18, scale: 6 }).notNull(),
  filledSize: decimal("filled_size", { precision: 18, scale: 6 }).notNull().default("0"),
  limitPrice: decimal("limit_price", { precision: 18, scale: 6 }), // For limit orders
  averageFillPrice: decimal("average_fill_price", { precision: 18, scale: 6 }),
  
  // Status and execution
  status: text("status").notNull().default("pending"), // "pending", "open", "filled", "partial", "cancelled", "rejected"
  
  // EIP-712 signature (for audit trail)
  signature: text("signature"), // EIP-712 signature of the order
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  filledAt: timestamp("filled_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => [
  index("idx_options_orders_user").on(table.userId),
  index("idx_options_orders_strategy").on(table.strategyId),
  index("idx_options_orders_status").on(table.status),
  index("idx_options_orders_aevo").on(table.aevoOrderId),
]);

// Panel Layouts - Stores user's customizable dashboard layouts
export const panelLayouts = pgTable("panel_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tab: text("tab").notNull(), // "perpetuals", "options", "predictions", "analytics"
  layoutData: jsonb("layout_data").notNull(), // Array of {i, x, y, w, h, minW, minH} for react-grid-layout
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("unique_user_tab_layout").on(table.userId, table.tab),
  index("idx_panel_layouts_user").on(table.userId),
]);

// Portfolio Analysis History - Stores past AI portfolio analyses
export const portfolioAnalyses = pgTable("portfolio_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  analysis: text("analysis").notNull(), // The AI-generated analysis text
  portfolioSnapshot: jsonb("portfolio_snapshot").notNull(), // Portfolio data at time of analysis
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_portfolio_analyses_user").on(table.userId),
  index("idx_portfolio_analyses_created").on(table.createdAt),
]);

// Withdrawal Transactions - Tracks all withdrawals from embedded wallets
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chain: text("chain").notNull(), // "ethereum", "polygon", "solana", "bnb", "hyperliquid"
  token: text("token").notNull(), // "ETH", "MATIC", "USDC", "SOL", "BNB"
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  recipient: text("recipient").notNull(), // Destination wallet address
  fromAddress: text("from_address").notNull(), // Source wallet address (from embedded wallet)
  transactionHash: text("transaction_hash"), // Blockchain transaction hash
  status: text("status").notNull().default("pending"), // "pending", "confirmed", "failed"
  gasUsed: decimal("gas_used", { precision: 18, scale: 8 }), // Gas used in native token
  gasPriceGwei: decimal("gas_price_gwei", { precision: 18, scale: 8 }), // Gas price in Gwei (EVM) or lamports (Solana)
  totalFee: decimal("total_fee", { precision: 18, scale: 8 }), // Total fee in native token
  blockNumber: text("block_number"), // Block number where transaction was included
  errorMessage: text("error_message"), // Error message if transaction failed
  explorerUrl: text("explorer_url"), // Link to block explorer
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
}, (table) => [
  index("idx_withdrawals_user").on(table.userId),
  index("idx_withdrawals_status").on(table.status),
  index("idx_withdrawals_chain").on(table.chain),
  index("idx_withdrawals_tx_hash").on(table.transactionHash),
]);

// Zod schemas and types
export const insertAdvancedOrderSchema = createInsertSchema(advancedOrders).omit({ id: true, createdAt: true });
export const insertAdvancedOrderExecutionSchema = createInsertSchema(advancedOrderExecutions).omit({ id: true, timestamp: true });
export const insertOptionsStrategySchema = createInsertSchema(optionsStrategies).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const insertOptionsPositionSchema = createInsertSchema(optionsPositions).omit({ id: true, userId: true, openedAt: true, updatedAt: true });
export const insertOptionsOrderSchema = createInsertSchema(optionsOrders).omit({ id: true, userId: true, createdAt: true });
export const insertPanelLayoutSchema = createInsertSchema(panelLayouts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPortfolioAnalysisSchema = createInsertSchema(portfolioAnalyses).omit({ id: true, createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, userId: true, createdAt: true });

export type InsertAdvancedOrder = z.infer<typeof insertAdvancedOrderSchema>;
export type AdvancedOrder = typeof advancedOrders.$inferSelect;
export type InsertAdvancedOrderExecution = z.infer<typeof insertAdvancedOrderExecutionSchema>;
export type AdvancedOrderExecution = typeof advancedOrderExecutions.$inferSelect;
export type InsertOptionsStrategy = z.infer<typeof insertOptionsStrategySchema>;
export type OptionsStrategy = typeof optionsStrategies.$inferSelect;
export type InsertOptionsPosition = z.infer<typeof insertOptionsPositionSchema>;
export type OptionsPosition = typeof optionsPositions.$inferSelect;
export type InsertOptionsOrder = z.infer<typeof insertOptionsOrderSchema>;
export type OptionsOrder = typeof optionsOrders.$inferSelect;
export type InsertPanelLayout = z.infer<typeof insertPanelLayoutSchema>;
export type PanelLayout = typeof panelLayouts.$inferSelect;
export type InsertPortfolioAnalysis = z.infer<typeof insertPortfolioAnalysisSchema>;
export type PortfolioAnalysis = typeof portfolioAnalyses.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
