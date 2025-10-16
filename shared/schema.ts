import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  symbol: text("symbol").notNull().unique(),
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
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  totalValue: decimal("total_value", { precision: 18, scale: 8 }).notNull(),
  totalPnl: decimal("total_pnl", { precision: 18, scale: 8 }).notNull(),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 6 }),
  numTrades: integer("num_trades").notNull().default(0),
  numWins: integer("num_wins").notNull().default(0),
});

export const aiUsageLog = pgTable("ai_usage_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  provider: text("provider").notNull(), // "openai", "perplexity"
  model: text("model").notNull(), // e.g., "gpt-5", "sonar-pro"
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
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  analysis: text("analysis").notNull(), // AI's position analysis as JSON
  alertLevel: text("alert_level").notNull().default("info"), // "info", "warning", "critical"
  suggestions: text("suggestions"), // Trading suggestions
  dismissed: integer("dismissed").notNull().default(0), // 0 = active, 1 = dismissed by user
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, entryTimestamp: true });
export const insertPositionSchema = createInsertSchema(positions).omit({ id: true, lastUpdated: true });
export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({ id: true, timestamp: true });
export const insertAiUsageLogSchema = createInsertSchema(aiUsageLog).omit({ id: true, timestamp: true });
export const insertMonitoringLogSchema = createInsertSchema(monitoringLog).omit({ id: true, timestamp: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
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
