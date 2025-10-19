# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. It allows users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution. The application features a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls. The project aims to deliver a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management, operating as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.
**Design System:** "Fantastic Mr. Fox" newspaper aesthetic with a grayscale color scheme, "Courier New" typography, newsprint texture, and sharp corners. Dull green/red accents are used for trading elements.
**Key UI Components:** AI Prompt Panel, TradingView advanced charts, Custom Watchlist with Binance price feeds, Portfolio Performance Chart, Positions Grid, and Conversation History.
**Custom Watchlist System (Oct 19, 2025):** Replaced TradingView's non-interactive watchlist widget with a custom component that fetches real-time prices via Binance WebSocket API. Clicking any symbol in the watchlist instantly updates the TradingView chart through shared React Context (SymbolContext). Features live connection indicator, 10 popular crypto pairs (BTC, ETH, SOL, BNB, ADA, AVAX, DOGE, DOT, MATIC, ARB), and real-time price/change updates. This solution delivers linked watchlist-chart behavior at zero cost, eliminating the need for TradingView's paid Trading Terminal license ($3k-$4k/year).

### Backend
**Server Framework:** Express.js with TypeScript, integrated with Vite middleware.
**Database Strategy:** Drizzle ORM with PostgreSQL, including tables for trades, positions, portfolio snapshots, AI usage logs, trade evaluations, strategy learnings, market regime snapshots, and trade history imports.
**API Design:** RESTful endpoints for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:** Multi-tenant architecture with Passport.js for authentication and PostgreSQL session persistence. AES-256-GCM encryption secures all API keys. Tiered onboarding supports user registration, AI provider choice, and exchange credential setup. Strong password requirements enforced (8+ characters with uppercase, lowercase, number, and special character) on both registration and admin user creation with consistent frontend/backend validation.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI (shared key) and Personal AI Key (user-provided Perplexity, OpenAI, or xAI credentials). Platform AI defaults to xAI Grok 4 Fast Reasoning when XAI_API_KEY is configured, falling back to Perplexity if unavailable.
- **Multi-Provider AI Router:** Supports Perplexity, OpenAI/ChatGPT, and xAI/Grok, handling credential decryption, client creation, and usage tracking. xAI defaults to grok-4-fast-reasoning model ($0.20/$0.50 per 1M tokens).
- **Prompt Processing:** "Mr. Fox" processes natural language prompts to generate structured trading strategies, including interpretations, actions, risk management, and numeric values.
- **Strategy-Scoped Context System:** Each trading strategy maintains independent conversation history and AI context, isolated via strategyId.
**Autonomous Trading System:** Multi-tenant system with per-user monitoring loops. Supports two agent modes:
- **Passive Mode (Oct 19, 2025):** Stops all automatic monitoring to minimize AI API costs. AI only analyzes market when user sends manual prompts. Trades are NOT executed even when manually prompted.
- **Active Mode:** Enables automatic monitoring at user-configured frequency. AI autonomously develops and executes trading strategies. Prioritizes AI autonomy with minimal hardcoded restrictions: $10 minimum notional, exactly one stop loss per position, and asset-specific leverage caps. AI can place multiple take profit orders.
**Max Positions Enforcement (Oct 19, 2025):** Implemented strategy constraint enforcement that counts unique symbols across both filled positions and open entry orders (preventing double-counting during laddered entries). When AI generates more entry actions than available slots, the system ranks symbols by conviction (using reasoning length as a proxy) and selects the highest-conviction trades. Critically, protective order updates for existing positions are always preserved, even when new entry actions are filtered. This ensures risk management is never compromised while respecting the user's max positions limit.
**Per-Symbol Entry Limit (Oct 19, 2025):** Implemented user-configurable `maxEntryOrdersPerSymbol` strategy parameter (default: 3) to control scaled entry orders per symbol. System groups entry actions by symbol, ranks by conviction (reasoning length), and keeps only top N entry orders per symbol based on user's strategy setting. Users can adjust this limit (1-10) per strategy to match their scaling preferences. Combined with max positions limit, this ensures reasonable total order counts (e.g., 5 symbols × 3 entries × ~2 protective orders = ~27 max orders).
**Bracket Orders (Oct 19, 2025):** All entry orders now use Hyperliquid's bracket order system (`grouping: "normalTpsl"`), attaching TP/SL directly to entry orders. When the entry fills, protective orders activate immediately—eliminating the timing gap where positions sat unprotected between monitoring cycles. This ensures positions are never exposed without risk management.
**Market Structure-Based Stop Loss Placement:** Stops are placed at invalidation levels with a small buffer, targeting opposite range extremes for take profits.
**Scaled Order Entries:** AI distributes limit orders ±1-3% around target entry prices to account for market volatility.
**Order Management System:** Enforces exactly one stop loss per position (multiple take profits allowed). Includes duplicate order prevention and disciplined stop loss management, ensuring stops are set based on market structure and can only be moved to protect gains. Protective order management enhancements allow AI to place stops at any distance, filter candidates by direction, and use a 0.3% price tolerance for order comparison.
**Comprehensive Safety System (Oct 19, 2025):**
- **Liquidation Protection:** Enforces 1.5% buffer between stop losses and liquidation price. For longs, ensures SL > liquidationPrice × 1.015; for shorts, ensures SL < liquidationPrice × 0.985. Auto-corrects dangerous stops instead of rejecting trades.
- **Manual Override Protection:** Database flags (`manualStopLossOverride` + `manualOverrideAt`) prevent AI from replacing user's manual stop loss adjustments. AI skips protective order placement when manual override is detected.
- **MarketContextAnalyzer (Enhanced Oct 19):** Validates limit order fill probability using ATR-based volatility analysis. Reduced thresholds to 1.5× volatility / 2× ATR with 15% hard cap. CRITICAL FIXES: (1) Sanitizes all numeric inputs to prevent NaN propagation when exchange returns invalid data, (2) Fail-closed validation - rejects orders on errors instead of accepting them, (3) Rejects or auto-corrects orders exceeding stricter thresholds. Uses percentage-normalized calculations to prevent unit mismatch bugs.
- **Terminal Safety Guard (Enhanced Oct 19):** Final price sanity check before submitting to exchange. Hard limit reduced from 30% to 20% maximum distance from current market price, preventing catastrophically unrealistic orders with clearer error messages requiring price anchoring.
- **Protective Order Validation (Fixed Oct 19):** Validates all stop loss and take profit orders against current market price to prevent nonsensical placements when entry prices are auto-corrected. For LONG positions: stop loss must be below current price, take profit above. For SHORT positions: stop loss must be above current price, take profit below. Rejects protective orders on wrong side of current price with fail-closed behavior.
- **AI Price Anchoring (Enhanced Oct 19):** Updated system prompts to explicitly require: (1) Anchoring all limit orders to current market price, (2) Quoting current price, 24h range, and volatility in reasoning, (3) Maximum 20% distance from current price with graduated limits based on volatility, (4) Bias towards recent price action over historical levels, (5) Fill probability assessment for every order.
- **Fill Probability Integration:** All limit orders validated before execution. Auto-correction clamps suggested prices to positive values within 24h range. Detailed logging for transparency.
**Trade Performance Evaluation & Learning System:** Automates trade evaluation on close using quantitative and AI-powered qualitative analysis. Learns from trades, utilizing decay-based weighting and regime-aware filtering, and provides top learnings to the AI for future trade decisions.
**Market Data & Indicators:** Dual WebSocket service for real-time market data. Backend provides CVD Calculator and Volume Profile Calculator.
**Trade History Import & Analysis System:** Allows users to upload CSV trade history for AI-powered style analysis, extracting patterns, calculating metrics, classifying trading style, and generating insights.
**Trade Journal System:** Automatically documents trade entries with AI reasoning, expectations (SL, TP, R:R), and metadata. Updates journal entries on trade close with AI-generated analysis, providing a dedicated UI page for review and pattern recognition.
**Trade Journal Side Display (Fixed Oct 19, 2025):** Fixed critical frontend bug where all journal entries displayed "SHORT" regardless of actual position direction. Root cause was type mismatch - backend sent "long"/"short" while frontend checked for "buy"/"sell". Updated TradeJournalEntry interface and getSideBadge function to correctly display LONG/SHORT badges.
**Trade Journal Strategy Tracking (Oct 19, 2025):** Added strategy column to trade journal entries table, showing which trading strategy (trading mode) was active when each trade was planned. Schema includes `tradingModeId` foreign key in `tradeJournalEntries` table, backend threads strategy ID through execution chain (`executeTradeStrategy` → `executeOpenPosition` → `createJournalEntry`), storage performs LEFT JOIN to fetch strategy names, and frontend displays strategy name with fallback for null values. Created `TradeJournalEntryWithStrategy` type for type-safe JOIN results. Essential for users who switch between multiple trading strategies to track strategy-specific performance.
**AI Price Hallucination Fix (Oct 19, 2025):** Resolved critical issue where AI placed orders at nonsensical historical prices from training data (e.g., BTC at $1,785 vs actual $109,000, ETH at $1,475 vs $3,990). Root cause: AI prompt only included top 3 gainers/losers, providing no current price data for other assets. Solution: Added comprehensive "CURRENT MARKET DATA" section to AI prompt listing top 30 assets with current prices, 24h changes, and volumes. AI now anchors all orders to real-time market data.
**Stop Loss Market Execution (Oct 19, 2025):** Changed stop loss orders from stop-limit to stop-market execution by removing `limitPx` parameter in bracket order calls (`tradeExecutor.ts`). Stop losses now use market orders (`isMarket: true`) for guaranteed fills during adverse price movements, while take profits remain limit orders for better pricing. Ensures risk management is never compromised by unfilled stop orders.
**Trading Modes (Strategies):** User-defined strategies with customizable parameters (name, description, timeframe, risk %, max positions, leverage, preferred assets, custom rules). Only one strategy can be active at a time.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency, enhanced performance metrics (Sharpe, Sortino, Calmar, Sterling, Omega), and trading controls.
**Performance Metrics (Fixed Oct 19, 2025):** All metrics now calculated using cumulative data from all snapshots (not sliding 6-hour window), and only include realized PnL from closed trades (not unrealized PnL from open positions). This ensures graphs display correctly and match current values shown in the UI.
**Monitoring Frequency Intelligence (Fixed Oct 19, 2025):** Server startup now checks timestamp of last monitoring run before executing. If last run was within the configured interval (e.g., 30 minutes), startup skips immediate execution and waits for next scheduled interval. Prevents alert spam from frequent server restarts in development mode while preserving monitoring continuity.
**User Deletion Monitoring Cleanup (Fixed Oct 19, 2025):** Fixed resource leak where monitoring intervals continued running after user deletion. Delete user endpoint now calls `stopUserMonitoring(userId)` before removing user from database, ensuring interval timers are properly cleared and no orphaned background processes remain. Monitoring stops immediately upon user deletion.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** Integrated via the `hyperliquid` npm package.

**UI Component Libraries:**
- **Radix UI:** Accessible UI primitives.
- **Recharts:** Data visualization.
- **Lucide React:** Iconography.
- **Embla Carousel:** Responsive carousels.

**Database & ORM:**
- `pg` (node-postgres) for PostgreSQL connectivity.
- **Drizzle ORM:** Type-safe database interactions.

**AI/LLM:**
- **OpenAI SDK:** Used for Perplexity API integration.

**Development Tools:**
- **Vite:** Frontend build and development.
- **ESBuild:** Server bundling in production.
- **TypeScript:** With strict mode.