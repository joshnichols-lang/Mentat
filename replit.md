# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading platform that serves as a "one-stop shop" for various market types including Perpetuals, Prediction Markets, Onchain Options, and future Spot Discovery. It allows users to interact with an AI trading agent, "Mr. Fox," through natural language to execute automated strategies across perpetual futures (Hyperliquid, Orderly Network), prediction markets (Polymarket), and onchain options (Aevo). The platform features a glassmorphic "Fantastic Mr. Fox" themed interface, real-time market data, portfolio tracking, comprehensive trading controls, and institutional-grade advanced order types. 1fox aims to provide a professional AI trading experience focused on Sharpe ratio maximization and continuous risk management as a multi-tenant SaaS solution.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, and lightweight-charts.
**Design System:** Dark-themed dashboard inspired by Numora, using deep grey backgrounds, lime green for success, and red/pink for danger. Features a grid-based panel layout with subtle borders. Incorporates unique data visualizations like transaction heatmaps, donut/circular charts for portfolio allocation, patterned bar charts, and gradient area charts. Uses Inter for UI typography and JetBrains Mono for numbers. Panel styling follows a `bg-card border border-border rounded-lg p-4` pattern. Includes time range pills, a token allocation heatmap, metro metric labels, and large display numbers. Supports light/dark modes and features a clean search bar and profile section.
**Unified Terminal Architecture:** Single-page interface with five main tabs (Perpetuals, Prediction Markets, Options [Coming Soon], Spot Discovery [Coming Soon], Analytics) and a persistent right sidebar for AI chat, conversation history, positions, and AI usage tracking. Layouts are fixed and optimized for a professional trading experience, with minimal padding and compact widgets.
**Order Entry System:** Restructured into a 3-tab design (Market | Limit | Advanced) for improved UX. Supports market and limit orders via API calls, and advanced orders (TWAP, Limit Chase, Scaled, Iceberg, OCO, Trailing TP) with dynamic input fields.
**Key Layouts:**
- **Perpetuals Tab:** Hyperliquid-style layout with a large chart, order book, and trading panel at the top, and tabbed panels for positions, open orders, order history, and trade history at the bottom.
- **Prediction Markets Tab:** Tag-based market browser using Polymarket's eventTags, including popular tags and search functionality. Features an auto-bridging system for Polygon balance.
- **Options Tab:** Coming Soon placeholder - Will include onchain options trading with AI-powered strategy building, live Greeks, options chain, and multi-leg execution.
- **Spot Discovery Tab:** Coming Soon placeholder - Will include multi-exchange spot market discovery and AI-powered trend analysis.
- **Analytics Tab:** Comprehensive performance dashboard with portfolio overview, cumulative returns, drawdown, and Sharpe ratio charts.

### Backend
**Server:** Express.js with TypeScript.
**Database:** PostgreSQL with Drizzle ORM.
**API:** RESTful endpoints for trading, data, and exchange interactions.
**Authentication & Security:** Passport.js with PostgreSQL session persistence, wallet-based authentication via RainbowKit with enhanced visual feedback and error handling. Features a phased authentication flow and AES-256-GCM encryption for API keys.
**Multi-Chain Wallet System:** Non-custodial, BIP39-derived multi-chain wallet generation. Includes a Hyperliquid dual-wallet architecture with a main wallet for funds and an API wallet for trading operations, both encrypted. Supports Arbitrum One and Arbitrum Sepolia. Features a browser-compatible wallet re-derivation from seed phrase.
**Withdrawal Fee Disclosure System:** Displays clear, platform-specific fee breakdowns in the SendModal, differentiating network gas fees and platform fees. Supports Hyperliquid gasless USDC withdrawals.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI and Personal AI Keys (Perplexity, OpenAI, xAI), defaulting to xAI Grok 4.
- **Unified Conversational AI:** AI responds naturally, answers questions, and generates structured JSON trading actions based on conversational context.
- **Strategy-Scoped Context:** Independent conversation history and AI context per trading strategy.
- **Custom Rules Priority:** User-defined rules guide AI behavior and risk management.
- **Multi-Instrument Portfolio Analysis:** Unified portfolio aggregator fetches live positions from all integrated exchanges. AI endpoint provides cross-platform hedging recommendations, correlation analysis, and total delta exposure calculations.
- **AI Cost Control System:** Dual-layer optimization combining strategy-aware monitoring with per-user hourly rate limits. Strategy parser auto-detects timeframes to minimize AI calls. UI displays real-time usage stats with warnings.
- **AI Status Indicators:** Real-time status lights in the AIPromptPanel header show AI system health, balance visibility, and trading activity.
**Agent Modes:** Passive Mode (discussion) and Active Mode (execution with safety constraints).
**Order Management & Strategy Enforcement:** Enforces max positions, entry limits, and utilizes bracket orders for TP/SL protection.
**Comprehensive Safety System:** Mandatory protective brackets, liquidation protection, manual override, Terminal Safety Guard, and protective order validation.
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network, Hyperliquid, Aevo, and Polymarket.
**Advanced Order System:** Institutional-grade execution engine supporting TWAP, Limit Chase, Scaled/Ladder Orders, Iceberg Orders, OCO, and Trailing Take-Profit, enhanced with AI-powered Smart Order Router, AI Execution Optimizer, and Predictive Execution Timing.
**WebSocket Infrastructure:** Market Data and Aevo WebSocket services operational with path-specific routing and manual upgrade handlers, coexisting with Vite HMR.
**Performance Optimizations:** Tiered data-refresh strategy implemented to ensure buttery-smooth UI. Critical queries poll every 10-15s (orderbooks), status queries every 15-30s (balances, trading mode), and metadata queries every 60s+ (portfolio, analytics). Polymarket markets paginated to 100 per request. Expensive computations memoized using React.useMemo/useCallback. High-frequency components wrapped with React.memo. Production console.logs removed to reduce overhead.
**Strategy Character System:** Trading strategies can have custom avatars, taglines, and descriptions (character identities). Avatar upload endpoint (`/api/upload-avatar`) validates images using sharp (MIME type, 5MB max, minimum 256×256px) and stores in `attached_assets/strategy_avatars` with UUID filenames. Database schema includes `avatar_url`, `tagline` (max 80 chars), and `description` fields. ImageUpload component provides drag-drop interface with preview, progress tracking, and removal. StrategyCard component displays avatar, name, tagline, description, and live performance metrics. TradingModeModal integrates avatar upload and tagline input with proper state management for create/edit/remove flows.

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