# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading platform designed as a "one-stop shop" for various market types including Perpetuals, Prediction Markets, and Onchain Options, with future Spot Discovery. It enables users to interact with an AI trading agent, "Mr. Fox," using natural language to execute automated strategies across integrated exchanges. The platform aims to provide a professional AI trading experience focused on Sharpe ratio maximization and continuous risk management as a multi-tenant SaaS solution, featuring a glassmorphic "Fantastic Mr. Fox" themed interface, real-time market data, portfolio tracking, and institutional-grade advanced order types.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, and lightweight-charts.
**Design System:** Dark-themed dashboard inspired by Numora, featuring deep grey backgrounds, lime green for success, and red/pink for danger. It uses a grid-based panel layout, unique data visualizations (transaction heatmaps, donut/circular charts, patterned bar charts, gradient area charts), Inter for UI typography, and JetBrains Mono for numbers. Panel styling follows a `bg-card border border-border rounded-lg p-4` pattern. Supports light/dark modes and includes time range pills, a token allocation heatmap, and large display numbers.
**Unified Terminal Architecture:** Single-page interface with five main tabs (Perpetuals, Prediction Markets, Options [Coming Soon], Spot Discovery [Coming Soon], Analytics) and a persistent right sidebar for AI chat, conversation history, positions, and AI usage tracking. Layouts are fixed and optimized for a professional trading experience with compact widgets.
**Order Entry System:** 3-tab design (Market | Limit | Advanced) supporting market, limit, and advanced orders (TWAP, Limit Chase, Scaled, Iceberg, OCO, Trailing TP) with dynamic input fields.

### Backend
**Server:** Express.js with TypeScript.
**Database:** PostgreSQL with Drizzle ORM.
**API:** RESTful endpoints for trading, data, and exchange interactions.
**Authentication & Security:** Passport.js with PostgreSQL session persistence, wallet-based authentication via RainbowKit, and AES-256-GCM encryption for API keys. Features a phased authentication flow and enhanced visual feedback.
**Multi-Chain Wallet System:** Non-custodial, BIP39-derived multi-chain wallet generation, supporting Hyperliquid dual-wallet architecture (main and API wallets), Arbitrum One, and Arbitrum Sepolia.
**Withdrawal Fee Disclosure System:** Displays platform-specific fee breakdowns, including support for Hyperliquid gasless USDC withdrawals.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI and Personal AI Keys (Perplexity, OpenAI, xAI), defaulting to xAI Grok 4.
- **Unified Conversational AI:** AI responds naturally, answers questions, and generates structured JSON trading actions based on conversational context.
- **Strategy-Scoped Context:** Independent conversation history and AI context per trading strategy.
- **Custom Rules Priority:** User-defined rules guide AI behavior and risk management.
- **Multi-Instrument Portfolio Analysis:** Unified portfolio aggregator fetches live positions from all integrated exchanges, providing cross-platform hedging recommendations, correlation analysis, and total delta exposure calculations via an AI endpoint.
- **AI Cost Control System:** Multi-phase optimization including strategy cache bug fixes, reduced conversation history, compressed market data, batching AI calls, response similarity caching, and compressed conversation history. UI displays real-time usage stats.
- **AI Status Indicators:** Real-time status lights in the AIPromptPanel header show AI system health, balance visibility, and trading activity.
**Agent Modes:** Passive Mode (discussion) and Active Mode (execution with safety constraints).
**Multi-Strategy Portfolio Manager:** Allows up to 3 concurrent trading strategies with independent capital allocation, position limits, and risk budgets. Includes a centralized coordination layer to detect conflicts, track aggregate exposure, and enforce portfolio-level safety limits. Each strategy operates independently with its own AI context, timeframe, and rules.
**IMPORTANT - Two Strategy Concepts:**
- **Conversation Context** (`isActive` field): The single strategy Mr. Fox is currently discussing in the AI chat.
- **Trading Execution** (`status` field): Up to three strategies that are actively executing trades.
**Order Management & Strategy Enforcement:** Enforces max positions, entry limits, and utilizes bracket orders for TP/SL protection. Position sizing uses a risk-based formula: Risk Amount = Balance × Risk%, SL Distance = |Entry - SL| / Entry, Notional = Risk / SL Distance, Size = Notional / Entry. This applies to both conversational and autonomous trading AI prompts.
**Comprehensive Safety System:** Mandatory protective brackets, liquidation protection, manual override, Terminal Safety Guard, and protective order validation.
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network, Hyperliquid, Aevo, and Polymarket.
**Advanced Order System:** Institutional-grade execution engine supporting TWAP, Limit Chase, Scaled/Ladder Orders, Iceberg Orders, OCO, and Trailing Take-Profit, enhanced with AI-powered Smart Order Router, AI Execution Optimizer, and Predictive Execution Timing.
**WebSocket Infrastructure:** Market Data and Aevo WebSocket services operational with path-specific routing.

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