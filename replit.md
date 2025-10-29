# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading platform offering a "one-stop shop" for four market types: Perpetuals, Prediction Markets, Onchain Options, and Spot Discovery (coming soon). It enables users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution across perpetual futures (Hyperliquid, Orderly Network), prediction markets (Polymarket), and onchain options (Aevo). The platform features a glassmorphic "Fantastic Mr. Fox" themed interface, real-time market data, portfolio tracking, comprehensive trading controls, and institutional-grade advanced order types. 1fox aims to deliver a professional AI trading experience focused on Sharpe ratio maximization and continuous risk management as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, and lightweight-charts.
**Design System:** Glassmorphic dark trading terminal with an orange/amber/gold/sepia palette, frosted glass effects, semi-transparent backgrounds, gradient overlays, and hover illumination effects. Uses Roboto typography and rounded corners.
**Unified Terminal Architecture:** Single-page interface consolidating all trading and analytics features across five main tabs (Perpetuals, Prediction Markets, Options, Spot Discovery, Analytics) with a persistent right sidebar for AI chat, conversation history, positions grid, and AI usage tracker.
**Key Layouts:**
- **Perpetuals Tab:** TradingChart, MarketSelector, OrderEntryPanel, OrderBook, RecentTrades, OrderManagementPanel.
- **Prediction Markets Tab:** Grid-based market browser with category filters, search, and a trading modal (Polymarket integration).
- **Options Tab:** Professional 3-panel interface with full backend integration. **Completed:** Aevo REST API client (HMAC-SHA256), WebSocket service (ticker/Greeks/fills), database schema (optionsStrategies, optionsPositions, optionsOrders), storage layer, 8 authenticated routes, OptionsChart with strategy P&L overlays (profit/loss zones, breakevens, strike visualization), OptionsStrategyBuilder with hybrid Simple/Pro modes (one-click strategies: Straddle, Strangle, Bull/Bear spreads, Iron Condor, Butterfly with realistic premium estimation and breakeven calculations). **In Progress:** Live Greeks dashboard, options positions grid, AI strategy recommendations.
- **Analytics Tab:** Comprehensive performance dashboard including PortfolioOverview, various charts (Cumulative Returns, Drawdown, Sharpe), and trade distribution.
**Auto-Bridging System:** Automatically detects insufficient Polygon balance for Polymarket trades and triggers Router Nitro bridge widget.

### Backend
**Server:** Express.js with TypeScript.
**Database:** PostgreSQL with Drizzle ORM.
**API:** RESTful endpoints for trading, data, and exchange interactions.
**Authentication & Security:** Passport.js with PostgreSQL session persistence, wallet-based authentication via RainbowKit, and automatic signature requests for session and embedded wallet generation. AES-256-GCM encryption for API keys.
**Multi-Chain Wallet System:** Non-custodial, BIP39-derived multi-chain wallet generation; seed phrases are shown once and never stored. A separate, encrypted API wallet is used for Hyperliquid trading.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI and Personal AI Keys (Perplexity, OpenAI, xAI), defaulting to xAI Grok 4.
- **Unified Conversational AI:** AI responds naturally, answers questions, and generates structured JSON trading actions based on conversational context.
- **Strategy-Scoped Context:** Independent conversation history and AI context per trading strategy.
- **Custom Rules Priority:** User-defined rules guide AI behavior and risk management.
**Agent Modes:** Passive Mode (discussion, no execution) and Active Mode (execution with critical safety constraints).
**Order Management & Strategy Enforcement:** Enforces max positions, entry limits, and utilizes Hyperliquid's bracket orders for TP/SL protection.
**Comprehensive Safety System:** Mandatory protective brackets, liquidation protection, manual override, Terminal Safety Guard (20% max order distance), and protective order validation.
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network, Hyperliquid, and Aevo. Polymarket integration via `@polymarket/clob-client`.
**Advanced Order System:** Institutional-grade order execution engine supporting TWAP, Limit Chase, Scaled/Ladder Orders, Iceberg Orders, OCO, and Trailing Take-Profit. Enhanced with AI-powered Smart Order Router, AI Execution Optimizer, and Predictive Execution Timing.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** `hyperliquid` npm package.
- **Orderly Network:** Custom REST API client and WebSocket service.
- **Polymarket:** `@polymarket/clob-client`.
- **Aevo:** Custom REST API client and WebSocket service.

**UI Component Libraries:**
- **Radix UI**
- **RainbowKit + wagmi + viem:** Wallet connection for EVM.
- **lightweight-charts:** Trading charts.
- **Recharts, Victory, D3, react-sparklines:** Data visualization.
- **react-countup:** Number animations.
- **Lucide React:** Iconography.
- **Embla Carousel:** Carousels.

**Database & ORM:**
- `pg` (node-postgres)
- **Drizzle ORM**

**AI/LLM:**
- **OpenAI SDK:** Used for Perplexity API integration.

**Development Tools:**
- **Vite:** Frontend build.
- **ESBuild:** Server bundling.
- **TypeScript**