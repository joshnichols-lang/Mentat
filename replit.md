# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal for the Hyperliquid perpetual futures exchange. It enables users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution. The application provides a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls. The project aims to deliver a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management, operating as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.
**Design System:** "Fantastic Mr. Fox" newspaper aesthetic with a grayscale color scheme, "Courier New" typography, newsprint texture, and sharp corners. Dull green/red accents are used for trading elements.
**Key UI Components:** AI Prompt Panel, TradingView advanced charts, Custom Watchlist with Binance price feeds, Portfolio Performance Chart, Positions Grid, and Conversation History.

### Backend
**Server Framework:** Express.js with TypeScript.
**Database Strategy:** Drizzle ORM with PostgreSQL, including tables for trades, positions, portfolio snapshots, AI usage logs, trade evaluations, strategy learnings, market regime snapshots, and trade history imports.
**API Design:** RESTful endpoints for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:** Multi-tenant architecture with Passport.js and PostgreSQL session persistence. AES-256-GCM encryption secures all API keys. Tiered onboarding supports user registration, AI provider choice, and exchange credential setup, with strong password requirements. **First registered user automatically becomes admin** (for production bootstrap).
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI (shared key) and Personal AI Key (user-provided Perplexity, OpenAI, or xAI credentials). Platform AI defaults to xAI Grok 4 Fast Reasoning, falling back to Perplexity.
- **Multi-Provider AI Router:** Supports Perplexity, OpenAI/ChatGPT, and xAI/Grok, handling credential decryption, client creation, and usage tracking.
- **Grok Live Search:** Utilizes Grok's native real-time web browsing capabilities with `mode: "auto"` and `return_citations: true` for market analysis.
- **Prompt Processing:** "Mr. Fox" processes natural language prompts to generate structured trading strategies, including interpretations, actions, risk management, and numeric values.
- **Strategy-Scoped Context System:** Each trading strategy maintains independent conversation history and AI context.
- **Strategy Context Awareness (Oct 19, 2025):** AI prompts now include active trading strategy details (name, description, risk %, max positions, leverage, timeframe, preferred assets, custom rules) when a strategy is selected. This enables the AI to understand and reference strategy constraints when users ask questions about it, ensuring responses align with the active strategy's rules. Comprehensive logging added (Oct 20, 2025) to diagnose strategy context delivery: frontend logs active mode details in browser console, backend logs strategy fetch status and full details in server logs.
- **AI Price Anchoring:** System prompts require AI to anchor all limit orders to current market prices, quote current price, 24h range, and volatility in reasoning, with maximum 20% distance from current price and bias towards recent price action.
**Autonomous Trading System:** Multi-tenant system with per-user monitoring loops.
- **Passive Mode:** Stops automatic monitoring; AI only analyzes market on manual prompts; trades are not executed.
- **Active Mode:** Enables automatic monitoring; AI autonomously develops and executes trading strategies with minimal hardcoded restrictions ($10 minimum notional, exactly one stop loss per position, asset-specific leverage caps). AI can place multiple take profit orders.
**Order Management & Strategy Enforcement:**
- **Max Positions Enforcement:** Counts unique symbols across filled positions and open entry orders. If AI generates more entry actions than available slots, it ranks symbols by conviction (reasoning length) and selects the highest-conviction trades, preserving protective order updates for existing positions.
- **Per-Symbol Entry Limit:** User-configurable `maxEntryOrdersPerSymbol` (default: 3) to control scaled entry orders per symbol.
- **Bracket Orders:** All entry orders use Hyperliquid's bracket order system, attaching TP/SL directly to entry orders for immediate protection.
- **Market Structure-Based Stop Loss Placement:** Stops are placed at invalidation levels with a small buffer; take profits target opposite range extremes.
- **Scaled Order Entries:** AI distributes limit orders ±1-3% around target entry prices.
- **Order Management System:** Enforces exactly one stop loss per position (multiple take profits allowed), includes duplicate order prevention, and disciplined stop loss management. Protective order management allows AI to place stops at any distance, filters candidates by direction, and uses a 0.3% price tolerance.
- **Stop Loss Market Execution:** Stop loss orders use market execution for guaranteed fills, while take profits remain limit orders.
- **Adaptive Order Management (Oct 19, 2025):** AI intelligently manages unfilled entry orders, canceling only when there's a clear strategic reason: better opportunity identified (cancels only enough orders to free needed margin), fill probability deteriorated with momentum shift, market structure invalidated, or diversification needed (cancels only enough for one new trade). No hard distance-based or count-based thresholds - AI preserves valid setups and only reallocates margin when identifying superior opportunities. Strategy-aware assessment considers timeframe (scalp vs swing) and current market conditions. Time-based or distance-alone reasoning is prohibited. AI receives open orders context in all prompts (manual and autonomous) and uses `cancel_order` actions with symbol, orderId, and detailed reasoning citing specific threshold violations. Defensive validation in tradeExecutor.ts explicitly rejects malformed cancel_order actions missing required fields (symbol/orderId), ensuring fail-closed behavior if AI regresses. Prompts include explicit JSON examples showing mandatory symbol field format.
**Comprehensive Safety System:**
- **Mandatory Protective Orders (Oct 20, 2025):** CRITICAL SAFETY: Two-layer validation ensures complete protection:
  1. **Existing Positions:** Server-side validation REJECTS any trading strategy that would leave existing positions without stop loss orders.
  2. **New Entry Orders (Oct 20, 2025):** Server-side validation REJECTS any new entry order (buy/sell) that lacks BOTH stop loss AND take profit protective brackets. All new positions are created with protective orders attached via Hyperliquid's bracket order system.
  
  This dual-layer protection prevents positions from ever being unprotected, even for a single monitoring cycle. Strategy execution fails immediately if any position lacks stop loss coverage or any entry order lacks protective brackets.
- **Liquidation Protection:** Enforces a 1.5% buffer between stop losses and liquidation price, auto-correcting dangerous stops.
- **Manual Override Protection:** Database flags prevent AI from replacing user's manual stop loss adjustments.
- **MarketContextAnalyzer:** Validates limit order fill probability using ATR-based volatility analysis (1.5× volatility / 2× ATR with 15% hard cap). Sanitizes numeric inputs, uses fail-closed validation, and rejects/auto-corrects orders exceeding thresholds.
- **Terminal Safety Guard:** Final price sanity check with a 20% maximum distance from current market price for all orders.
- **Protective Order Validation:** Validates all stop loss and take profit orders against current market price to prevent nonsensical placements.
- **Fill Probability Integration:** All limit orders are validated before execution, with auto-correction for suggested prices.
**Trade Performance Evaluation & Learning System:** Automates trade evaluation on close using quantitative and AI-powered qualitative analysis. Learns from trades, utilizing decay-based weighting and regime-aware filtering, and provides top learnings to the AI.
**Market Data & Indicators:** Dual WebSocket service for real-time market data. Backend provides CVD Calculator and Volume Profile Calculator.
**Trade History Import & Analysis System:** Allows users to upload CSV trade history for AI-powered style analysis, pattern extraction, metric calculation, and insight generation.
**Trade Journal System:** Automatically documents trade entries with AI reasoning, expectations, and metadata. Updates journal entries on trade close with AI-generated analysis. Includes strategy tracking for each trade. Journal entries now track specific Hyperliquid order IDs (`orderId` field) to enable targeted cleanup when orders are canceled, preventing accidental deletion of unrelated entries.
**Trading Modes (Strategies):** User-defined strategies with customizable parameters (name, description, timeframe, risk %, max positions, leverage, preferred assets, custom rules). Only one strategy can be active at a time.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency, enhanced performance metrics (Sharpe, Sortino, Calmar, Sterling, Omega), and trading controls. Performance metrics are calculated using cumulative data from all snapshots. **Portfolio snapshots are created automatically at the user's configured monitoring frequency**, capturing total account value (including unrealized PnL from open positions), ensuring risk-adjusted metrics accurately reflect real-time portfolio performance.
**Monitoring & Resource Management:** Monitoring frequency intelligence prevents immediate execution on server restart if within the configured interval. User deletion cleans up monitoring intervals to prevent resource leaks.

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