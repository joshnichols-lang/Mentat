# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading platform providing a comprehensive "one stop shop" for three market types: Perpetuals, Prediction Markets, and Spot Discovery (coming soon). The platform enables users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution across perpetual futures (Hyperliquid, Orderly Network) and prediction markets (Polymarket). Features a glassmorphic "Fantastic Mr. Fox" themed interface with tab-based navigation, real-time market data, portfolio tracking, and comprehensive trading controls. Users authenticate with external wallets, and the platform auto-generates a multi-chain wallet (EVM, Solana, Polygon) for seamless cross-chain trading. 1fox aims to provide a professional AI trading experience focused on Sharpe ratio maximization through optimal trading actions and continuous risk management, delivered as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, and lightweight-charts.
**Design System:** Glassmorphic dark trading terminal with orange/amber/gold/sepia palette. Features frosted glass effects with backdrop blur (35px), semi-transparent backgrounds (10-20% opacity for panels, 30% for header), pure black gradient backgrounds for contrast, gradient overlays (orange → amber → gold), and hover illumination effects. Dark brown/black backgrounds (hsl(18 33% 8%)), orange primary (#B06000 / hsl(33 100% 35%)), yellow for longs (#FFC107 / hsl(45 100% 51%)), red for shorts (#F54E2E / hsl(9 84% 57%)). Modern Roboto typography, rounded corners (8px). Custom glassmorphism utilities: `.glass`, `.glass-strong`, `.glass-header`, `.gradient-border`, `.glow-orange`, `.glow-amber`, `.glow-gold`, `.hover-illuminate`, `.hover-lift`, shimmer animations.
**Hover Illumination:** Interactive card effects with subtle lift (0.2rem translateY), enhanced border glow, and lumen layers (radial gradients creating internal illumination). All Cards automatically have hover effects applied. Uses ::after pseudo-element for layered orange/amber radial gradients (0→50% opacity on hover) over 0.4s smooth transitions.
**Unified Terminal Architecture:** Single-page terminal interface (`UnifiedTerminal.tsx`) consolidating all trading and analytics features. Four main tabs (Perpetuals | Prediction Markets | Spot Discovery | Analytics) with persistent right sidebar containing AI chat, conversation history, positions grid, and AI usage tracker. Resizable panels (70/30 default split) for optimal workflow. Both `/terminal` and `/trade` routes render the unified terminal for backward compatibility.
**Layout & Components:**
- **Perpetuals Tab:** Complete trading interface with TradingChart, MarketSelector, collapsible OrderEntryPanel, and right sidebar containing OrderBook, RecentTrades, and OrderManagementPanel. Vertical resizable split between chart and order entry.
- **Prediction Markets Tab:** Grid-based market browser with category tabs (Trending, Politics, Sports, Finance, Crypto, Culture, World, Elections), search, dynamic tag filters, and trading modal for market/limit orders with real-time cost/profit calculations. Connects to Polymarket via Polygon network.
- **Spot Discovery Tab:** Placeholder for upcoming multi-exchange spot market aggregation feature.
- **Analytics Tab:** Comprehensive performance dashboard with PortfolioOverview (all 7 capital sources), PortfolioAreaChart, CumulativeReturnsChart, DrawdownChart, SharpeGauge, MarginUsageBar, TradeDistributionDonut, and PositionROEChart.
- **Persistent Right Panel:** AI Prompt Panel, Conversation History, PositionsGrid (multi-exchange), and AI Usage Tracker accessible across all tabs.
**TradingChart:** Implemented with lightweight-charts library for perpetuals. Loads up to 1000 historical candles before WebSocket connection for complete price history visualization. Supports multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d, 1w). Symbol normalization strips -USD/-PERP/-SPOT suffixes before Hyperliquid API requests. Real-time updates via WebSocket overlay on historical data.
**MarketSelector:** Searchable dialog component for browsing all Hyperliquid perpetual and spot markets. Displays real-time prices, 24h change percentages, and market type badges. Filters by search query and market type. Integrated into Perpetuals tab header for quick market switching.
**Auto-Bridging System:** Seamless cross-chain bridging for Polymarket trades. Automatically detects insufficient Polygon balance (USDC + MATIC for gas) before order placement and triggers Router Nitro bridge widget with pre-filled asset and amount. Supports both single-asset and multi-step bridging flows. Balance monitoring with 10-second refresh interval ensures trades execute once funds arrive.

### Backend
**Server:** Express.js with TypeScript.
**Database:** PostgreSQL with Drizzle ORM for storing trading data, portfolio snapshots, AI logs, and trade history.
**API:** RESTful endpoints for trading, database operations, and exchange interactions.
**Authentication & Security:** Streamlined multi-tenant architecture with Passport.js and PostgreSQL session persistence. All users are auto-approved on creation (verificationStatus defaults to "approved"). Wallet-based authentication flow: Landing page (/) → Connect wallet via RainbowKit → Automatic signature request → Session creation → Embedded wallet generation → Recovery phrase confirmation → Redirect to /terminal. The LandingPage component includes integrated authentication logic with useAccount, useSignMessage, and useEmbeddedWallet hooks. Complete flow happens automatically after wallet connection without manual approval steps. AES-256-GCM encryption for API keys.
**Multi-Chain Wallet System:** Non-custodial, BIP39-derived multi-chain wallet generation for deposits and trading; seed phrases are shown once and never stored.
**Hyperliquid API Wallet Architecture:** A separate, encrypted API wallet (from a different seed) is used for Hyperliquid trading, authorized by the user's connected wallet via EIP-712 signature. This API wallet has no withdrawal permissions and executes all trades under 1fox's referral code.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI and Personal AI Keys (Perplexity, OpenAI, xAI), with a multi-provider router handling credentials and usage. Defaults to xAI Grok 4.
- **Unified Conversational AI:** AI responds naturally, answers questions, and generates structured trading actions in JSON based on conversational context, maintaining awareness of active strategy parameters and account data.
- **Strategy-Scoped Context:** Each trading strategy has independent conversation history and AI context.
- **Custom Rules Priority:** User-defined rules guide AI behavior and risk management.
**Agent Modes:**
- **Passive Mode (Default):** AI generates actions for discussion; execution is blocked.
- **Active Mode:** AI-generated actions are executed with critical safety constraints (e.g., minimum notional, mandatory protective brackets, Terminal Safety Guard, leverage caps).
**Order Management & Strategy Enforcement:** Enforces max positions, per-symbol entry limits, and uses Hyperliquid's bracket orders for immediate TP/SL protection. Manages unfilled orders and ensures one stop loss per position.
**Comprehensive Safety System:** Mandatory protective brackets, liquidation protection (1.5% buffer), manual override protection, Terminal Safety Guard (20% maximum order distance), and protective order validation.
**Trade Performance Evaluation & Learning System:** Automates trade evaluation and provides learnings to the AI.
**Market Data & Indicators:** Dual WebSocket service for real-time data, CVD Calculator, and Volume Profile Calculator.
**Trade History Import:** CSV upload for AI-powered analysis.
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network and Hyperliquid. Polymarket integration via @polymarket/clob-client with market/limit order support. AI can specify the target exchange and market type.
**Polymarket Integration:** Complete backend wrapper for @polymarket/clob-client with market data fetching from Gamma API (`/events?closed=false` endpoint for live markets), order placement (market/limit), position tracking, and order history. Event-to-market transformation flattens nested API structure and parses stringified `outcomePrices` arrays to enable real-time YES/NO probability display. Dynamic subcategory filtering extracts unique tags from `eventTags` field for granular market browsing. User-scoped positions and orders with shared global event catalog. Polygon wallet credentials managed via encrypted storage. Auto-bridging system checks Polygon USDC + MATIC balances before trades and automatically triggers Router Nitro bridge with correct asset if insufficient.
**Trade Journal System:** Automatically documents trade entries with AI reasoning and updates on close with AI-generated analysis.
**Trading Modes:** User-defined strategies with customizable parameters.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency, and enhanced performance metrics calculated from cumulative portfolio snapshots.
**Monitoring & Resource Management:** Intelligent monitoring frequency and proper cleanup on user deletion.
**Hyperliquid SDK Defensive Guards:** Comprehensive error handling, flexible verification, and production safety.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** Integrated via the `hyperliquid` npm package.
- **Orderly Network:** Custom REST API client and WebSocket service.
- **Polymarket:** Integrated via `@polymarket/clob-client` for prediction market trading on Polygon.

**UI Component Libraries:**
- **Radix UI:** UI primitives.
- **RainbowKit + wagmi + viem:** Wallet connection and authentication for EVM wallets.
- **Recharts, Victory, D3, react-sparklines:** Data visualization.
- **react-countup:** Number animations.
- **Lucide React:** Iconography.
- **Embla Carousel:** Carousels.

**Database & ORM:**
- `pg` (node-postgres) for PostgreSQL.
- **Drizzle ORM:** Type-safe database interactions.

**AI/LLM:**
- **OpenAI SDK:** Used for Perplexity API integration.

**Development Tools:**
- **Vite:** Frontend build.
- **ESBuild:** Server bundling.
- **TypeScript:** With strict mode.