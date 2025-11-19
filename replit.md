# Mentat

## Overview
Mentat is an AI-powered non-custodial cryptocurrency trading terminal offering a professional Numora-inspired dark dashboard and a retro blessed.js-inspired Text User Interface (TUI). It unifies trading across Perpetuals, Prediction Markets, Onchain Options, and future Spot Discovery. Users interact with an AI trading agent, "m.teg," via natural language to execute automated strategies, focusing on Sharpe ratio maximization and continuous risk management. The project aims to deliver a powerful AI trading experience through both professional and retro terminal interfaces.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, lightweight-charts, and framer-motion.
**Design Systems:**
-   **Mentat Terminal (Active):** Retro TUI at `/mentat` route with CRT scanlines, dot grid background, zero rounded corners, IBM Plex Mono typography, and box-drawing characters. Uses a dark mode with cyan/yellow/red and a light mode with blue. The theme is scoped to `.mentat-terminal` for controlled overrides.
-   **Numora (Legacy):** Dark-themed dashboard with deep grey backgrounds, lime green for success, and red/pink for danger. Features a grid-based panel layout, unique data visualizations, Inter and JetBrains Mono typography.
**Animation System:** Physics-based motion powered by `framer-motion` for smooth transitions and animations (stiffness: 300, damping: 25-30).
**Unified Terminal Architecture:** Single-page interface with five main tabs (Perpetuals, Prediction Markets, Options, Spot Discovery, Analytics) and a persistent right sidebar for AI chat and trading data.
**Mentat Terminal Architecture:** A single-screen TUI with a top status bar, left sidebar (navigation + metrics), center chart panel, right order book, and bottom AI input/command history.
**Order Entry System:** A 3-tab design (Market | Limit | Advanced) supporting market, limit, and advanced orders (TWAP, Limit Chase, Scaled, Iceberg, OCO, Trailing TP).
**Key Layouts:** Dedicated layouts for Perpetuals (Hyperliquid-style), Prediction Markets (tag-based browser with auto-bridging), Options (AI-powered strategy building), Spot Discovery (multi-exchange market discovery), and Analytics (performance dashboard). The Mentat Terminal layout is a fixed grid with specific panels for navigation, chart, order book, and command input.

### Backend
**Server:** Express.js with TypeScript.
**Database:** PostgreSQL with Drizzle ORM.
**API:** RESTful endpoints for trading, data, and exchange interactions.
**Authentication & Security:** Passport.js with PostgreSQL session persistence, wallet-based authentication via RainbowKit, and AES-256-GCM encryption for API keys.
**Multi-Chain Wallet System:** Non-custodial, BIP39-derived multi-chain wallet generation, including a Hyperliquid dual-wallet architecture. Supports Arbitrum One and Arbitrum Sepolia.
**Withdrawal Fee Disclosure System:** Transparent display of network and platform fees, supporting Hyperliquid gasless USDC withdrawals.
**AI Integration:**
-   **Tiered AI Provider System:** Supports Platform AI and Personal AI Keys (Perplexity, OpenAI, xAI), defaulting to xAI Grok 4.
-   **Unified Conversational AI:** AI responds naturally, answers questions, and generates structured JSON trading actions.
-   **Strategy-Scoped Context:** Independent conversation history and AI context per trading strategy.
-   **Custom Rules Priority:** User-defined rules guide AI behavior and risk management.
-   **Multi-Instrument Portfolio Analysis:** Aggregates live positions across exchanges for cross-platform hedging and correlation analysis.
-   **AI Cost Control System:** Strategy-aware monitoring with per-user hourly rate limits and real-time usage stats.
-   **Tiered Access System:** Five-tier structure (Free to Platinum) based on balance or volume, determining AI call limits and strategy frequency.
-   **x402 Micropayment Infrastructure:** Direct USDC payment system via connected Arbitrum wallet for AI usage when tier quotas are exhausted. Users pay 2x the actual AI API cost.
**Agent Modes:** Passive Mode (discussion) and Active Mode (execution with safety constraints).
**Order Management & Strategy Enforcement:** Enforces max positions, entry limits, and utilizes bracket orders.
**Comprehensive Safety System:** Mandatory protective brackets, liquidation protection, manual override, and protective order validation.
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network, Hyperliquid, Aevo, and Polymarket.
**Advanced Order System:** Institutional-grade execution engine with AI-powered Smart Order Router, Execution Optimizer, and Predictive Execution Timing.
**WebSocket Infrastructure:** Market Data and Aevo WebSocket services with path-specific routing.
**Performance Optimizations:** Tiered data-refresh strategy, memoization using React.useMemo/useCallback, and React.memo for high-frequency components.
**Strategy Character System:** Allows custom avatars, taglines, and descriptions for trading strategies, stored with UUID filenames after validation.

## External Dependencies

**Trading Infrastructure:**
-   Hyperliquid Exchange (`hyperliquid` npm package)
-   Orderly Network (Custom REST API client and WebSocket)
-   Polymarket (`@polymarket/clob-client`)
-   Aevo (Custom REST API client and WebSocket)

**UI Component Libraries:**
-   Radix UI
-   RainbowKit, wagmi, viem (EVM wallet connection)
-   framer-motion (Animations)
-   lightweight-charts (Trading charts)
-   Recharts, Victory, D3, react-sparklines (Data visualization)
-   react-countup (Number animations)
-   Lucide React (Iconography)
-   Embla Carousel (Carousels)

**Database & ORM:**
-   `pg` (node-postgres)
-   Drizzle ORM

**AI/LLM:**
-   OpenAI SDK (for Perplexity API integration)

**Development Tools:**
-   Vite (Frontend build)
-   ESBuild (Server bundling)
-   TypeScript