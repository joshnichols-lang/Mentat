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
- **Unified Conversational AI Architecture (Oct 21, 2025):**
  - **Single Conversational Interface:** AI ALWAYS responds naturally like Grok, regardless of context. No dual-mode classification or keyword detection. The AI can answer ANY question - trading analysis, market conditions, math, science, current events, or casual conversation.
  - **Natural Action Generation:** When appropriate (user requests trading, asks for market analysis with trading recommendations, modifies strategy parameters, or autonomous monitoring finds opportunities), the AI includes trading actions in its JSON response. The AI itself decides when to include actions based on conversational context.
  - **Strategy-Aware Context:** When a trading strategy is active, the AI has full awareness of strategy parameters (risk %, max positions, leverage, timeframe, preferred assets, custom rules) and references them naturally in conversation while responding to any type of question.
  - **Full Account Visibility:** AI has real-time access to Hyperliquid account data (portfolio value, available balance, positions, orders) and can discuss account status naturally in any conversation.
- **Prompt Processing:** AI processes natural language prompts to generate structured trading strategies with interpretations, actions, risk management, and numeric values - all while maintaining a conversational tone.
- **Strategy-Scoped Context System:** Each trading strategy maintains independent conversation history and AI context for learning and adaptation.
- **Custom Rules Priority System:** User-defined custom rules in trading strategies guide AI behavior and risk management. Users define their trading philosophy through strategy descriptions and custom rules (e.g., "only 3:1 R:R setups", "max 2% risk per trade", "only enter on confirmed breakouts"). The AI learns and adapts to each strategy's unique approach through conversation and execution feedback.
**Agent Modes (Execution Control):**
- **Passive Mode (Default):** AI generates trading actions in responses for discussion and analysis, but execution is BLOCKED at the tradeExecutor layer. Autonomous monitoring is disabled. Users can ask the AI to analyze markets and generate trade ideas, but no trades will execute. Safe for learning and testing.
- **Active Mode:** AI-generated trading actions are executed when appropriate. Enables autonomous monitoring at user-configured frequency. AI develops and executes trading strategies guided by user-defined custom rules. Critical safety constraints remain ($10 minimum notional, mandatory protective brackets, 20% Terminal Safety Guard max price distance, asset-specific leverage caps).
**Order Management & Strategy Enforcement:**
- **Max Positions Enforcement:** Counts unique symbols across filled positions and open entry orders. If AI generates more entry actions than available slots, it ranks symbols by conviction (reasoning length) and selects the highest-conviction trades, preserving protective order updates for existing positions.
- **Per-Symbol Entry Limit:** User-configurable `maxEntryOrdersPerSymbol` (default: 3) to control scaled entry orders per symbol.
- **Bracket Orders:** All entry orders use Hyperliquid's bracket order system, attaching TP/SL directly to entry orders for immediate protection.
- **Order Management System:** Enforces exactly one stop loss per position (multiple take profits allowed), includes duplicate order prevention, and disciplined stop loss management. Protective order management filters candidates by direction and uses a 0.3% price tolerance. AI determines entry distribution, stop loss placement, and take profit targets based on strategy's custom rules and market analysis.
- **Stop Loss Market Execution:** Stop loss orders use market execution for guaranteed fills, while take profits remain limit orders.
- **Flexible Order Management (Oct 21, 2025):** AI has full autonomy to manage unfilled entry orders based on strategy's custom rules and market analysis. Decisions about canceling, modifying, or maintaining orders are guided by the strategy's philosophy (timeframe, risk tolerance, entry criteria). AI learns optimal order management through strategy conversations and execution feedback. System provides warnings for potential issues (fee waste, unlikely fills) but allows AI to execute per strategy requirements.
**Comprehensive Safety System:**
- **Mandatory Protective Brackets (Oct 21, 2025):** CRITICAL SAFETY: Two-layer validation ensures complete protection:
  1. **Existing Positions:** Server-side validation REJECTS any trading strategy that would leave existing positions without stop loss orders.
  2. **New Entry Orders:** Server-side validation REJECTS any new entry order (buy/sell) that lacks BOTH stop loss AND take profit protective actions. **AI must generate separate `stop_loss` and `take_profit` ACTIONS** (not fields - there are no stopLoss/takeProfit fields in the action schema). Every `buy` or `sell` action requires paired `stop_loss` and `take_profit` actions. All new positions are created with protective orders attached via Hyperliquid's bracket order system.
  
  **Beta User Fix (Oct 21, 2025):** Removed all stopLoss/takeProfit field references from TypeScript interfaces and AI prompts. The AI now clearly receives action-based instructions with concrete examples showing separate protective actions for every entry order. This dual-layer protection prevents positions from ever being unprotected, even for a single monitoring cycle. Strategy execution fails immediately if any position lacks stop loss coverage or any entry order lacks protective brackets.
- **Liquidation Protection:** Enforces a 1.5% buffer between stop losses and liquidation price, auto-correcting dangerous stops.
- **Manual Override Protection:** Database flags prevent AI from replacing user's manual stop loss adjustments.
- **Terminal Safety Guard:** Final price sanity check with a 20% maximum distance from current market price for all orders (prevents catastrophic fat-finger errors).
- **Protective Order Validation:** Validates all stop loss and take profit orders against current market price to prevent nonsensical placements.
- **Flexible Constraint System (Oct 21, 2025):** Removed hardcoded non-critical constraints to enable fully user-defined strategies through custom rules:
  - **Removed:** 1.5:1 minimum R:R ratio requirement (users define their own via custom rules)
  - **Converted to Warnings:** Fill probability validation, anti-churn protection, aggressive limit order checks
  - **Preserved:** Terminal Safety Guard (20% max), liquidation protection, mandatory protective brackets, manual override protection, $10 min notional, leverage caps
  
  System now provides warnings for low fill probability, potential fee waste (anti-churn), and aggressive limit orders, but allows execution when strategy's custom rules justify the approach. Warnings appear in logs for review but don't block user-defined strategies. This enables teaching AI through conversation rather than imposing rigid rules.
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