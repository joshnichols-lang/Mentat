# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. It enables users to interact with an AI trading agent, "Mr. Fox," using natural language to execute automated strategies. The application features a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls. The project's core mission is to deliver a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management, operating as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.
**Design System:** "Fantastic Mr. Fox" newspaper aesthetic featuring a grayscale color scheme, "Courier New" monospace typography, newsprint texture, and sharp corners. Dull green/red accents are used for trading elements.
**Key UI Components:** AI Prompt Panel, Market Overview watchlist (real-time data, drag-and-drop), Portfolio Performance Chart, Positions Grid, and Conversation History. Includes hover tooltips with mini price charts and risk management levels.
**TradingView Integration:** Dedicated Charts page with Advanced Chart (detailed technical analysis) and Market Overview (multi-asset watchlist) widgets. Charts load via TradingView's embeddable iframe widgets without consuming Hyperliquid API capacity. Maximum grayscale configuration applied (candles, grids, backgrounds, plot lines), but iframe isolation prevents complete override of TradingView's internal colored UI elements (positive/negative price change indicators). Symbol logos disabled, Courier New font, transparent backgrounds maintain newspaper aesthetic where configurable.

### Backend
**Server Framework:** Express.js with TypeScript, integrated with Vite middleware.
**Database Strategy:** Drizzle ORM with PostgreSQL for type-safe operations. Schema includes tables for trades, positions, portfolio snapshots, AI usage logs, trade evaluations, strategy learnings, market regime snapshots, and **trade history imports** (user_trade_history_imports, user_trade_history_trades, trade_style_profiles for analyzing past trading patterns).
**API Design:** RESTful endpoints (`/api` prefix) for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:** Multi-tenant architecture with `isAuthenticated` and `requireVerifiedUser` middleware. Passport.js LocalStrategy for authentication (scrypt-hashed passwords) and PostgreSQL session persistence. A tiered onboarding flow supports user registration, AI provider choice (Platform AI or Personal Key), exchange credential setup, and admin verification. Admin users can manage users, view AI usage analytics, and handle contact messages. AES-256-GCM encryption with envelope encryption secures all API keys.
**Contact Admin System:** Allows users to send messages and optional screenshots (max 5MB, base64) to admins.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI (shared key for free tier) and Personal AI Key (user-provided Perplexity, OpenAI, or xAI credentials for premium tier).
- **Multi-Provider AI Router:** Supports Perplexity, OpenAI/ChatGPT, and xAI/Grok. Handles credential decryption, client creation, model validation, and usage tracking, with fallback to the shared platform key.
- **Prompt Processing:** "Mr. Fox" processes natural language prompts to generate structured trading strategies, including interpretations, trading actions, risk management plans, and required numeric values.
- **Strategy-Scoped Context System:** Each trading strategy maintains independent conversation history and AI context, isolated via strategyId filtering in ai_usage_log table. "General" mode (strategyId = null) provides global AI interaction context. Frontend sends selected strategyId with each prompt; backend filters prompt history by strategyId when building AI context. Enables users to maintain separate conversations for different trading approaches (e.g., scalp vs swing strategies) while using general mode for non-trading questions.
**Autonomous Trading System:** Multi-tenant system with per-user monitoring loops using encrypted Hyperliquid and AI credentials. Supports Passive (learning-only, no trade execution) and Active (autonomous trading) modes with safety checks in the monitoring loop to prevent trades when in passive mode. The trading philosophy emphasizes patience, selectivity, and avoiding forced trades to maximize Sharpe ratio. **AI Autonomy Philosophy (14 Hardcoded Restrictions Removed):** System prioritizes maximum AI autonomy over rigid rules - hardcoded position sizing limits (30% margin cap), price deviation validations (±30% entry, ±55% protective), stop loss distance requirements (1.5% min), liquidation buffers (2.5%), and R:R ratio enforcement (2:1 min) have been removed. Volume analysis now uses data-driven percentiles instead of fixed thresholds (3.0x spike, 2.0x/1.5x/0.3x classifications). Market regime detection provides raw statistics for AI analysis rather than pre-classified labels. Only three constraints remain: $10 minimum notional (exchange requirement), exactly ONE stop loss per position (risk discipline), and asset-specific leverage caps (exchange limits). AI can now place multiple take profit orders for scaling out. **Market Structure-Based Stop Loss Placement:** Core trading principle - stops are placed at invalidation levels, not arbitrary percentages. For shorts near resistance: stop just ABOVE resistance (if broken, thesis is wrong). For longs near support: stop just BELOW support (if broken, thesis is wrong). Small buffer (0.3-1%) added for volatility. Take profits target opposite range extreme (longs → resistance, shorts → support). **Scaled Order Entries:** AI distributes limit orders ±1-3% around target entry prices to account for market volatility, avoiding multiple orders at identical prices and improving fill probability across different price levels.
**Order Management System:** Enforces exactly one stop loss per position (multiple take profits allowed for scaling out). Includes quantitative order assessment and anti-churn policy requiring specific metrics for order adjustments. Stop loss is mandatory for every position. **Duplicate Order Prevention:** Exchange-precision deduplication system prevents identical orders by comparing rounded price (tick size) and size (decimals), allowing ladder strategies while blocking true duplicates within execution batches. **Disciplined Stop Loss Management:** Comprehensive protective order tracking system enforces risk management discipline - stop losses are set based on market structure and can ONLY be moved to protect gains when positions are profitable. Server-side validation prevents widening stop losses when trades go against the user, ensuring stops remain fail-safes. System includes protective order state tracking (initial/trailing), audit trail via protective_order_events table, and automatic position discovery on startup.
**Trade Performance Evaluation & Learning System:** Enables continuous AI self-improvement via a feedback loop.
- **Evaluation Process:** Automatic on trade close, including 8 quantitative metrics (e.g., PnL vs expectancy, stop-loss adherence, R:R ratio) and AI-powered qualitative analysis for actionable insights.
- **Learning Repository:** Utilizes decay-based weighting (30-day half-life) for insights, regime-aware filtering, and evidence accumulation to strengthen learnings.
- **Safety Guards:** Weight clamping [0.001-1.0], isFinite() validation, future timestamp reset, invalid data logging to prevent edge cases.
- **Daily Aggregation:** Scheduler runs at 2 AM UTC and on server startup to update decay weights, archive low-confidence learnings, and compute performance metrics.
- **Integration with AI Trading:** Top 5-10 regime-filtered learnings are provided to the AI for each autonomous trading cycle, influencing trade decisions.
**Market Data & Indicators:** Dual WebSocket service for real-time market data. Backend provides CVD Calculator and Volume Profile Calculator for AI trading decisions.
**Trade History Import & Analysis System:** Enables users to upload past trading history (CSV format) for AI-powered style analysis. System parses trade data, validates required fields (symbol, side, entry/exit dates/prices, size, PnL), stores in dedicated tables for lineage tracking and GDPR compliance, and triggers background AI analysis. Analysis service extracts trading patterns, calculates metrics (win rate, R:R ratio, holding periods, asset preferences), classifies trading style (risk tolerance, frequency, side preference), and generates actionable insights (strengths, weaknesses, recommendations). Results are stored in trade_style_profiles for future integration with autonomous trading to personalize strategies based on the user's proven patterns.
**Trade Journal System:** Comprehensive documentation and reasoning tracking for every trade. Automatically creates journal entries when orders are placed, capturing AI's entry reasoning, price expectations (stop loss, take profit, R:R ratio), and trade metadata (symbol, side, entry type). Journal entries are linked to trade records for full lifecycle tracking (planned → active → closed). When trades close, the evaluation service updates journal entries with AI-generated close analysis including profit analysis, target achievement, adjustments made, lessons learned, and anomaly detection. Provides a dedicated Trade Journal UI page with filtering (status, symbol), detailed entry views, and timeline visualization following the newspaper aesthetic. Enables pattern recognition and continuous improvement by documenting what was expected vs. what actually happened for every trade.
**Trading Modes (Strategies):** User-defined trading strategies with customizable parameters (name, description, timeframe, risk %, max positions, leverage, preferred assets, custom rules). Strategy type field is optional (defaults to "custom") allowing users to focus on strategy parameters rather than categorization. Only one strategy can be active at a time, and the active strategy's parameters are enforced by the AI trading system.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency (Disabled, 1 min, 5 min, 30 min, 1 hour), enhanced performance metrics (Sterling, Omega, Max Drawdown, Sharpe, Sortino, Calmar ratios using sample variance for unbiased estimation), and trading controls (individual and "Close All" positions).

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

## Business Model & AI Cost Analysis

### AI Usage Cost Estimates (Perplexity Platform AI)
Based on actual usage data from admin account over 2 days (Oct 17-18, 2025):

**Average Usage per Autonomous Cycle:**
- ~7,634 tokens per cycle
- Cost: ~$0.008 per cycle

**Monthly Cost by Monitoring Frequency:**
- **30-minute monitoring**: ~$5/month (48 cycles/day)
- **5-minute monitoring**: ~$70/month (288 cycles/day)
- **1-minute monitoring**: ~$345/month (1,440 cycles/day) ⚠️ High cost
- **30-second monitoring**: ~$690/month (2,880 cycles/day) 💸 Very high cost
- **Passive mode only**: ~$3-15/month (manual prompts only)

**Safe Monthly Estimate Per Active User:**
- **Conservative**: $20-50/month AI cost (5-minute monitoring)
- **Moderate**: $70-100/month AI cost (1-5 minute monitoring)
- **Aggressive**: $300+/month AI cost (sub-minute monitoring)

**Pricing Recommendations:**
1. **Tiered Usage Limits**: Free tier (passive + 100 requests), Starter ($20/month, 1,000 requests, 30-min monitoring), Pro ($50/month, 5,000 requests, 5-min monitoring), Unlimited ($150/month, 1-min monitoring)
2. **AI Usage Add-On**: Base subscription $30/month + pay-per-cycle ($0.01/cycle)
3. **Frequency-Based Pricing**: Charge based on monitoring interval (30-min @ $20, 5-min @ $50, 1-min @ $100)

**Cost Control Strategy:**
- Default new users to 30-minute monitoring
- Cap free tier at 5-minute minimum
- Encourage Personal AI Key for intensive usage
- Implement request quotas per billing cycle

**Current Risk**: Admin account running at 1-minute monitoring = $345/month AI cost with Monkey Cipher strategy