# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading platform offering a "one-stop shop" for four market types: Perpetuals, Prediction Markets, Onchain Options, and Spot Discovery (coming soon). It enables users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution across perpetual futures (Hyperliquid, Orderly Network), prediction markets (Polymarket), and onchain options (Aevo). The platform features a glassmorphic "Fantastic Mr. Fox" themed interface, real-time market data, portfolio tracking, comprehensive trading controls, and institutional-grade advanced order types. 1fox aims to deliver a professional AI trading experience focused on Sharpe ratio maximization and continuous risk management as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, and lightweight-charts.
**Error Handling & Stability (Nov 6, 2025):** Comprehensive error boundary system prevents blank screens from runtime errors. ErrorBoundary component wraps entire application to catch both standard Error objects and non-Error exceptions (converting them to proper Error instances). Displays user-friendly error screen with reload option and detailed error information in collapsible section. Fixed useEffect dependency arrays throughout application to prevent infinite loops and race conditions (SendModal gas estimation debouncing now includes all used variables: recipient, amount, chain, token).
**Design System (Nov 5, 2025 - Numora Redesign):** Sophisticated dark cryptocurrency trading dashboard inspired by Numora. **Deep grey (#0B0B0F)** backgrounds (not pure black), **bright lime green (#00FF87)** success indicators, **bright red/pink (#FF3B69)** for danger. Grid-based panel layout with subtle borders (#1F1F23). **Unique data visualizations:** Transaction heatmap (calendar-style grid showing trading activity), donut/circular charts for portfolio allocation, patterned bar charts with diagonal stripes, gradient area charts. **Typography:** Inter for all UI, JetBrains Mono for numbers/prices. **Panel styling:** Numora-style cards with `bg-card border border-border rounded-lg p-4` pattern. **Time range pills** for 1D/7D/3M/1Y controls. **Token allocation heatmap grid** (144-cell grid with intensity-based coloring). **Metro metric labels** (uppercase text-xs with opacity-60). **Large display numbers** (font-mono text-3xl/5xl). Light/Dark mode support with adaptive color scheme. Fox logo retained. Clean search bar with keyboard shortcut indicator. Profile section with wallet address display.
**Unified Terminal Architecture:** Single-page interface consolidating all trading and analytics features across five main tabs (Perpetuals, Prediction Markets, Options, Spot Discovery, Analytics) with a persistent right sidebar for AI chat, conversation history, positions grid, and AI usage tracker.
**Fixed Optimized Layouts (Nov 5, 2025):** Replaced draggable GridDashboard system with fixed, Hyperliquid-inspired layouts for ultra-dense professional trading experience. Minimal padding (1-2px), ultra-compact widget chrome, fixed proportions optimized for single-viewport display.
**Key Layouts:**
- **Perpetuals Tab (Hyperliquid-style):** Top section (72% height): Chart (70% width) + Order Book (15%) + Trading Panel (15%). Bottom section (28% height): Tabbed interface with Positions | Open Orders | Order History | Trade History. 1px gaps between panels, compact mode widgets with minimal chrome.
- **Prediction Markets Tab:** Tag-based market browser using Polymarket's actual eventTags from Gamma API. Features top 30 most popular tags (Trump, Bitcoin, Sports, etc.) extracted from market eventTags with frequency-based sorting. Single-state tag selection eliminates category/filter state coordination issues. Includes search functionality and trading modal (Polymarket integration). Enhanced cryptocurrency search to match both abbreviations (btc, eth, sol) and full names (bitcoin, ethereum, solana) for better discoverability. **Recent Fixes (Nov 2, 2025):** Replaced keyword-based category filtering with API-driven tag system to fix UI "messing up" when switching categories and ensure short-term Bitcoin/Ethereum markets are visible. Investigated Polymarket LIVE markets (short-term crypto predictions) but confirmed they're not accessible via public API.
- **Options Tab:** Fixed 2-column layout - Left column (58%): OptionsChart (55% height) + OptionsStrategyBuilder (45% height). Right column (42%): OptionsChain (50% height) + LiveGreeks (30% height) + OptionsPositions (20% height). **Completed:** Aevo REST API client (HMAC-SHA256), WebSocket service (ticker/Greeks/fills) on `/aevo-market-data`, AssetSelector toolbar component (ETH/BTC/SOL/ARB), database schema (optionsStrategies, optionsPositions, optionsOrders), storage layer, 8 authenticated routes, 6 one-click strategies (Long Straddle, Long Strangle [10% discount], Bull Call Spread, Bear Put Spread, Iron Condor, Long Butterfly) with realistic premium estimation and breakeven calculations, enhanced UI combining best of both platforms.
- **Analytics Tab:** Comprehensive performance dashboard including PortfolioOverview, various charts (Cumulative Returns, Drawdown, Sharpe), and trade distribution.
**Auto-Bridging System:** Automatically detects insufficient Polygon balance for Polymarket trades and triggers Router Nitro bridge widget.

### Backend
**Server:** Express.js with TypeScript.
**Database:** PostgreSQL with Drizzle ORM.
**API:** RESTful endpoints for trading, data, and exchange interactions.
**Authentication & Security:** Passport.js with PostgreSQL session persistence, wallet-based authentication via RainbowKit with enhanced visual feedback and error handling. Features phased authentication flow with status tracking ('idle' → 'signing' → 'creating_wallet' → 'complete'), user-controlled retry mechanism with race condition prevention (`isManualRetrying` guard), and automatic signature requests for session and embedded wallet generation. AES-256-GCM encryption for API keys. **Recent Improvements (Oct 31, 2025):** Fixed infinite loop in embedded wallet creation by implementing single-attempt enforcement with `walletCreationAttempted` guard, added visual loading indicators for each auth phase, enhanced error messages (signature rejection, nonce fetch failure, wallet creation errors), and implemented manual retry with clear user control.
**Multi-Chain Wallet System:** Non-custodial, BIP39-derived multi-chain wallet generation; seed phrases are shown once and never stored. **Hyperliquid Dual-Wallet Architecture (Nov 4, 2025):** Automatic dual-wallet creation during embedded wallet setup. Main wallet (from BIP39 seed) holds funds for deposits/withdrawals/balance queries. Server-side generated API wallet receives authorized agent permissions via EIP-712 approveAgent signature (signed by main wallet) and is used exclusively for trading operations with no withdrawal permissions. Both private keys are stored encrypted in `api_keys` table: main wallet (`isActive: 0`, `purpose: "withdrawal"`), API wallet (`isActive: 1`, `purpose: "trading"`). Balance queries use main wallet address from metadata; trading operations use API wallet credentials. Supports both Arbitrum One (mainnet: 42161/0xa4b1) and Arbitrum Sepolia (testnet: 421614/0x66eee) chain IDs based on `HYPERLIQUID_TESTNET` environment variable. **Re-sync Feature (Nov 4, 2025):** Browser-compatible wallet re-derivation in Settings using `@scure/bip39` and `@scure/bip32` to replace lost Hyperliquid credentials from seed phrase without Node.js Buffer dependencies.
**Withdrawal Fee Disclosure System (Nov 4, 2025):** Clear, platform-specific fee breakdown in SendModal displays network gas fees and platform fees in their native currencies without cross-currency mixing. **Hyperliquid Gasless Withdrawals:** USDC withdrawals are gasless - validators pay the Arbitrum network fees, users only pay the $1 USDC flat fee which covers all costs (no ETH required). UI displays "Gasless Withdrawal" notice with single "Total Cost: $1.00 USDC" line, hiding network gas display. Backend sets `isGasless: true` flag and `estimatedFee: '0'` for Hyperliquid USDC. Max button allows full balance withdrawal as Hyperliquid deducts the fee server-side. Polymarket (Polygon) displays informational notice confirming no platform fees (only MATIC gas). All other chains show only network gas fees in native tokens (BNB, ETH, SOL). Max button logic correctly deducts fees only when paid from withdrawal token balance: native token withdrawals deduct gas, other tokens have no deductions (gas paid separately). USD estimates show itemized breakdown: "Network gas ≈ $X.XX + $Y.YY platform fee".
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI and Personal AI Keys (Perplexity, OpenAI, xAI), defaulting to xAI Grok 4.
- **Unified Conversational AI:** AI responds naturally, answers questions, and generates structured JSON trading actions based on conversational context.
- **Strategy-Scoped Context:** Independent conversation history and AI context per trading strategy.
- **Custom Rules Priority:** User-defined rules guide AI behavior and risk management.
- **Multi-Instrument Portfolio Analysis:** Unified portfolio aggregator (`server/portfolioAggregator.ts`) fetches live positions from all exchanges (Hyperliquid, Orderly, Aevo, Polymarket) with database fallback. AI endpoint `/api/ai/analyze-portfolio` provides cross-platform hedging recommendations, correlation analysis, and total delta exposure calculations. Trading agent context includes all position types (perpetuals, options, prediction markets) for comprehensive strategy guidance. UI features "Analyze Portfolio" button in AI panel for one-click multi-instrument risk analysis.
- **AI Cost Control System (Nov 2, 2025):** Dual-layer cost optimization combining strategy-aware monitoring with per-user hourly rate limits. Strategy parser (`server/strategyParser.ts`) auto-detects timeframes from descriptions (scalping = 2-3 min cycles, swing = 60+ min) to minimize unnecessary AI calls by 80-95%. Hourly call limits (default: 20 calls/hour) enforce user-configurable caps with rolling window tracking. Rate limiting integrated into autonomous monitoring cycle with early return when limit exceeded. UI displays real-time usage stats with color-coded warnings (yellow near limit, red at limit) and countdown to reset. API endpoints: GET `/api/user/ai-usage` (stats + limit status) and PATCH `/api/user/ai-settings` (configure limits). Database field: `maxAiCallsPerHour` in users table.
**Agent Modes:** Passive Mode (discussion, no execution) and Active Mode (execution with critical safety constraints).
**Order Management & Strategy Enforcement:** Enforces max positions, entry limits, and utilizes Hyperliquid's bracket orders for TP/SL protection.
**Comprehensive Safety System:** Mandatory protective brackets, liquidation protection, manual override, Terminal Safety Guard (20% max order distance), and protective order validation.
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network, Hyperliquid, and Aevo. Polymarket integration via `@polymarket/clob-client`.
**Advanced Order System:** Institutional-grade order execution engine supporting TWAP, Limit Chase, Scaled/Ladder Orders, Iceberg Orders, OCO, and Trailing Take-Profit. Enhanced with AI-powered Smart Order Router, AI Execution Optimizer, and Predictive Execution Timing.
**WebSocket Infrastructure:** Market Data and Aevo WebSocket services operational with `perMessageDeflate: false` configuration. Uses `noServer: true` pattern with manual upgrade handlers for path-specific routing (`/market-data`, `/aevo-market-data`). WebSocket services initialize after Vite HMR setup to prevent upgrade handler conflicts. Each service handles only its designated path, allowing Vite HMR and custom WebSocket servers to coexist without interference.

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