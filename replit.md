# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading platform that serves as a "one-stop shop" for various market types including Perpetuals, Prediction Markets, Onchain Options, and future Spot Discovery. It allows users to interact with an AI trading agent, "Mr. Fox," through natural language to execute automated strategies across perpetual futures (Hyperliquid, Orderly Network), prediction markets (Polymarket), and onchain options (Aevo). The platform features a glassmorphic "Fantastic Mr. Fox" themed interface, real-time market data, portfolio tracking, comprehensive trading controls, and institutional-grade advanced order types. 1fox aims to provide a professional AI trading experience focused on Sharpe ratio maximization and continuous risk management as a multi-tenant SaaS solution.

## Recent Changes
**November 7, 2025:**
- **Phase 4 Event-Driven Trigger System (COMPLETE):** Implemented revolutionary cost-reduction system achieving 90-95% AI cost savings for aggressive monitoring strategies. Built TriggerSpec schema with AI extraction, IndicatorEngine with 500-sample ring buffers (RSI/MACD/MA/BB/ATR), and TriggerSupervisor state machine (Idle→Watching→Armed→Fired→Cooldown) with hysteresis and near-miss detection. Integration test verified 100% reduction in controlled scenario (1 vs 1,440 AI calls/day). Production expectation: ~10-50 AI calls/day vs 1,440 for 1-minute time-based monitoring. System includes safety heartbeat (30-min), WebSocket integration for real-time candle data, and TriggerMonitor UI dashboard. 5-minute minimum removed - event-driven architecture makes 1-minute scalp strategies cost-effective.
- **Strategy Creation Form Restored:** Moved complete working strategy creation form from deprecated TradingModes.tsx to active Strategies.tsx page. Form includes full validation, risk parameters, timeframe selection, asset preferences, and custom rules with AI auto-configuration hints. All interactive elements now have proper data-testid attributes for future automated testing. TradingModes.tsx file deleted - route already redirects to /strategies in App.tsx.
- **Production Bug Fix:** Fixed React error #31 crash in PositionsGrid.tsx - Hyperliquid position leverage object `{type, value}` was being rendered directly instead of extracting `leverage.value` property (line 214-216)

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
- **AI Cost Control System:** Multi-phase optimization achieving ~60% cost reduction (from $14.40/day worst-case to ~$5.75/day):
  - **Phase 1 (~50% reduction)**: Strategy cache bug fix, reduced conversation history 5→3, compressed market data 30→15 assets, UnifiedAdvancedOrderOptimizer batching 3 AI calls into 1
  - **Phase 3A - Response Similarity Caching**: Market fingerprint system with 10-minute TTL, reuses cached AI responses when market conditions change <5%
  - **Phase 3B - Compressed Conversation History**: Compresses stored AI responses by ~50-70%, extracting only key decision points (regime, thesis summary, action summary) to reduce token usage in future AI calls
  - **Phase 3C - Pattern-Based Shortcuts**: Rule-based pre-filter detects obvious "hold" scenarios (ranging markets, dead markets) and skips AI calls when no positions exist
  - Strategy parser auto-detects timeframes to minimize AI calls. UI displays real-time usage stats with warnings.
- **AI Status Indicators:** Real-time status lights in the AIPromptPanel header show AI system health, balance visibility, and trading activity.
**Agent Modes:** Passive Mode (discussion) and Active Mode (execution with safety constraints).
**Multi-Strategy Portfolio Manager:** Allows up to 3 concurrent trading strategies with independent capital allocation, position limits, and risk budgets. Features centralized coordination layer that detects conflicts (opposing positions, over-concentration), tracks aggregate exposure across all strategies, and enforces portfolio-level safety limits. Each strategy operates independently with its own AI context, timeframe, and rules while Portfolio Manager prevents conflicts and manages total risk.

**IMPORTANT - Two Strategy Concepts:**
- **Conversation Context** (`isActive` field): Which SINGLE strategy Mr. Fox is currently discussing with you in the AI chat. Changed via the Mr. Fox dropdown in the right sidebar. Only ONE can be active for conversation.
- **Trading Execution** (`status` field): Which strategies are actively EXECUTING TRADES. Up to THREE can have `status='active'` simultaneously. Managed via Start/Pause/Stop buttons on the `/strategies` page.

**Navigation:**
- `/strategies` - NEW multi-strategy management page with Multi-Strategy Dashboard and StrategyCard components. Use this page to activate multiple concurrent strategies for trading execution.
- `/trading-modes` (deprecated) - OLD single-strategy page that only allows one active conversation context. Redirects to `/strategies`.
**Order Management & Strategy Enforcement:** Enforces max positions, entry limits, and utilizes bracket orders for TP/SL protection.
**Comprehensive Safety System:** Mandatory protective brackets, liquidation protection, manual override, Terminal Safety Guard, and protective order validation.
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network, Hyperliquid, Aevo, and Polymarket.
**Advanced Order System:** Institutional-grade execution engine supporting TWAP, Limit Chase, Scaled/Ladder Orders, Iceberg Orders, OCO, and Trailing Take-Profit, enhanced with AI-powered Smart Order Router, AI Execution Optimizer, and Predictive Execution Timing.
**WebSocket Infrastructure:** Market Data and Aevo WebSocket services operational with path-specific routing and manual upgrade handlers, coexisting with Vite HMR.

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