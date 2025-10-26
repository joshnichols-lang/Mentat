# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal specializing in perpetual futures trading across multiple exchanges. It enables users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution. The platform features a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls for Hyperliquid and Orderly Network. Users authenticate with external wallets, and the platform auto-generates a multi-chain wallet for deposits via Router Nitro cross-chain bridging. 1fox aims to provide a professional AI trading experience focused on Sharpe ratio maximization through optimal trading actions and continuous risk management, delivered as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, and lightweight-charts.
**Design System:** Orderly Network-inspired dark trading terminal aesthetic with orange/amber accents, modern typography (Roboto), and rounded corners.
**Layout & Components:** Resizable 3-panel dashboard, hosted Orderly Network DEX integration, Router Nitro Widget for cross-chain deposits, advanced portfolio and position analytics visualizations (e.g., PortfolioAreaChart, PositionROEChart, HourlyPLHeatmap), enhanced position cards with inline sparklines, and a multi-chain balance display in the header. Key UI components include an AI Prompt Panel, Custom Watchlist, Portfolio Performance Chart, Positions Grid, and Conversation History.

### Backend
**Server:** Express.js with TypeScript.
**Database:** PostgreSQL with Drizzle ORM for storing trading data, portfolio snapshots, AI logs, and trade history.
**API:** RESTful endpoints for trading, database operations, and exchange interactions.
**Authentication & Security:** Multi-tenant architecture with Passport.js and PostgreSQL session persistence. Wallet-based authentication using wagmi, viem, and RainbowKit supports EVM wallets. AES-256-GCM encryption for API keys.
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
**Multi-Exchange Integration:** Full REST API and WebSocket integration for Orderly Network and Hyperliquid. AI can specify the target exchange.
**Trade Journal System:** Automatically documents trade entries with AI reasoning and updates on close with AI-generated analysis.
**Trading Modes:** User-defined strategies with customizable parameters.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency, and enhanced performance metrics calculated from cumulative portfolio snapshots.
**Monitoring & Resource Management:** Intelligent monitoring frequency and proper cleanup on user deletion.
**Hyperliquid SDK Defensive Guards:** Comprehensive error handling, flexible verification, and production safety.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** Integrated via the `hyperliquid` npm package.
- **Orderly Network:** Custom REST API client and WebSocket service.

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