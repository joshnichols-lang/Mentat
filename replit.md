# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal for perpetual futures trading across multiple exchanges. It allows users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution. The application features a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls across **Hyperliquid** (original) and **Orderly Network** (fully integrated). The project's vision is to provide a professional AI trading experience, prioritizing Sharpe ratio maximization through optimal sizing, entries, exits, and continuous risk management, delivered as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, and lightweight-charts for advanced charting.
**Design System:** Orderly Network-inspired dark trading terminal aesthetic with orange/amber accents. Dark brown/black backgrounds (hsl(18 33% 8%)), orange primary color (#B06000 / hsl(33 100% 35%)), yellow for profits/longs (#FFC107 / hsl(45 100% 51%)), and red for losses/shorts (#F54E2E / hsl(9 84% 57%)). Modern Roboto typography (sans-serif), rounded corners (8px for cards), and solid dark backgrounds. Professional trading platform look matching Orderly DEX aesthetic.
**Dashboard Layout:** Resizable 3-panel layout with portfolio analytics (left), AI conversation (center), and positions/activity (right).
**DEX Trading Interface:** Hosted Orderly Network DEX integration at `dex.orderly.network/1fox-4617`. Users can access the full-featured DEX directly via button in Header (opens in new tab). Future migration to custom domain planned.
**Advanced Visualizations:** 
- **Portfolio Performance Charts:** AnimatedCounter for live portfolio value, PortfolioAreaChart with timeframe selector, CumulativeReturnsChart comparing against benchmark, DrawdownChart showing risk exposure over time, RollingMetricsChart for 30-day Sharpe/Sortino/Calmar ratios, SharpeGauge with animated SVG needle, MarginUsageBar with warning/danger thresholds.
- **Position Analytics:** PositionROEChart ranking all positions by performance, PositionScatterPlot showing duration vs P&L, PositionSizeHistogram analyzing trade sizing, WinStreakChart visualizing trading consistency, TradeDistributionDonut showing win rate, HourlyPLHeatmap with 7-day × 24-hour grid.
- **Enhanced Position Cards:** Inline sparklines showing live price movement, animated P&L and ROE counters, gradient borders by side (long/short), protective order badges (SL/TP), hover effects revealing detailed charts.
**Key UI Components:** AI Prompt Panel, Custom Watchlist with Binance price feeds, Portfolio Performance Chart, Positions Grid, and Conversation History.

### Backend
**Server Framework:** Express.js with TypeScript.
**Database Strategy:** Drizzle ORM with PostgreSQL for storing trades, positions, portfolio snapshots, AI usage logs, trade evaluations, strategy learnings, market regime snapshots, and trade history imports.
**API Design:** RESTful endpoints for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:** Multi-tenant architecture with Passport.js and PostgreSQL session persistence. **Wallet-based authentication** using wagmi + viem + RainbowKit supports MetaMask, Rabby, WalletConnect, and other EVM wallets. Multi-wallet architecture stores wallet addresses per user with normalized addresses, chain tracking, and purpose flags (isAuthPrimary, isTrading). Signature verification using viem ensures only wallet owners can authenticate. AES-256-GCM encryption for API keys. Legacy username/password auth remains supported for backward compatibility.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI (shared key) and Personal AI Key (user-provided Perplexity, OpenAI, or xAI credentials). Defaults to xAI Grok 4 Fast Reasoning with Perplexity fallback.
- **Multi-Provider AI Router:** Handles credential decryption, client creation, and usage tracking for Perplexity, OpenAI/ChatGPT, and xAI/Grok.
- **Grok Live Search:** Utilizes Grok's native real-time web browsing for market analysis.
- **Unified Conversational AI:** The AI responds naturally like Grok, capable of answering any question (trading analysis, market conditions, math, current events, casual conversation). It includes trading actions in JSON responses when appropriate, based on conversational context.
- **Strategy-Aware Context:** AI maintains full awareness of active strategy parameters (risk %, max positions, leverage, timeframe, preferred assets, custom rules) and account data (portfolio value, balance, positions, orders) during conversations.
- **Prompt Processing:** AI processes natural language to generate structured trading strategies with interpretations, actions, risk management, and numeric values, maintaining a conversational tone.
- **Strategy-Scoped Context System:** Each trading strategy maintains independent conversation history and AI context for learning and adaptation.
- **Custom Rules Priority System:** User-defined rules guide AI behavior and risk management, allowing the AI to learn and adapt to unique trading philosophies.
**Agent Modes (Execution Control):**
- **Passive Mode (Default):** AI generates trading actions for discussion; execution is blocked. Autonomous monitoring is disabled.
- **Active Mode:** AI-generated trading actions are executed. Enables autonomous monitoring. Critical safety constraints apply ($10 minimum notional, mandatory protective brackets, 20% Terminal Safety Guard, asset-specific leverage caps).
**Order Management & Strategy Enforcement:**
- **Max Positions Enforcement:** Limits unique symbols based on configured maximums, prioritizing high-conviction trades if limits are exceeded.
- **Per-Symbol Entry Limit:** Configurable `maxEntryOrdersPerSymbol`.
- **Bracket Orders:** All entry orders use Hyperliquid's bracket order system for immediate TP/SL protection.
- **Order Management System:** Enforces one stop loss per position (multiple TPs allowed), prevents duplicate orders, and manages protective orders with price tolerance. AI determines entry distribution, stop loss, and take profit targets based on strategy rules and market analysis.
- **Stop Loss Market Execution:** Stop loss orders use market execution; take profits are limit orders.
- **Flexible Order Management:** AI autonomously manages unfilled entry orders (canceling, modifying, maintaining) based on strategy rules and market analysis.
**Comprehensive Safety System:**
- **Mandatory Protective Brackets:** Two-layer validation ensures all existing positions have stop losses and all new entry orders have both stop loss and take profit actions. The AI must generate separate `stop_loss` and `take_profit` actions for every `buy` or `sell` action. System rejects strategies that violate this.
- **Liquidation Protection:** Enforces a 1.5% buffer between stop losses and liquidation price.
- **Manual Override Protection:** Prevents AI from replacing user's manual stop loss adjustments.
- **Terminal Safety Guard:** 20% maximum distance from current market price for all orders.
- **Protective Order Validation:** Validates stop loss and take profit orders against market price.
- **Flexible Constraint System:** Non-critical constraints (e.g., minimum R:R) are removed or converted to warnings, allowing user-defined strategies through custom rules. Critical constraints (Terminal Safety Guard, liquidation protection, mandatory protective brackets, manual override, min notional, leverage caps) remain.
**Trade Performance Evaluation & Learning System:** Automates trade evaluation, learns from trades, and provides top learnings to the AI, utilizing decay-based weighting and regime-aware filtering.
**Market Data & Indicators:** Dual WebSocket service for real-time market data. Backend provides CVD Calculator and Volume Profile Calculator.
**Trade History Import & Analysis System:** Allows CSV upload for AI-powered style analysis, pattern extraction, and insight generation.
**Multi-Exchange Integration:**
- **Orderly Network:** Hosted DEX at `dex.orderly.network/1fox-4617` provides full trading interface. Backend includes complete REST API and WebSocket integration for AI agent operations, market data, and account management. Supports all trading operations (market/limit orders, position tracking, balance queries).
- **Hyperliquid:** Original exchange integration with full trading capabilities.
- **Multi-Exchange Architecture:** Promise.allSettled pattern for resilient data aggregation across exchanges. AI can specify target exchange via optional "exchange" field in trading actions, defaulting to Hyperliquid for backward compatibility.
- **Credential Management:** Both exchanges use AES-256-GCM envelope encryption for API credentials with per-user storage.
**Trade Journal System:** Automatically documents trade entries with AI reasoning, expectations, and metadata. Updates entries on trade close with AI-generated analysis, tracking specific Hyperliquid order IDs.
**Trading Modes (Strategies):** User-defined strategies with customizable parameters. Only one strategy can be active at a time.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency, enhanced performance metrics (Sharpe, Sortino, Calmar, Sterling, Omega) calculated from cumulative portfolio snapshots. Portfolio snapshots are created automatically at the user's configured monitoring frequency.
**Monitoring & Resource Management:** Monitoring frequency intelligence prevents immediate execution on server restart. User deletion cleans up monitoring intervals.
**Hyperliquid SDK Defensive Guards:** Comprehensive error handling for all exchange API calls, including flexible verification, protected methods, enhanced diagnostics, and production safety to prevent crashes. All client creation functions now force SDK initialization immediately to prevent race conditions.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** Integrated via the `hyperliquid` npm package.
- **Orderly Network:** Custom REST API client and WebSocket service (server/orderly/client.ts, server/orderly/websocket.ts). Supports testnet and mainnet environments.

**UI Component Libraries:**
- **Radix UI:** Accessible UI primitives including resizable panels.
- **RainbowKit + wagmi + viem:** Wallet connection and authentication for EVM wallets (MetaMask, Rabby, WalletConnect).
- **Recharts, Victory, D3, react-sparklines:** Advanced data visualization libraries for interactive charts.
- **react-countup:** Smooth number animations for portfolio metrics.
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