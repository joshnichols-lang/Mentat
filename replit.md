# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. It allows users to interact with an AI trading agent, "Mr. Fox," using natural language for automated strategy execution. The application features a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls. The project aims to deliver a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management, operating as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.
**Design System:** "Fantastic Mr. Fox" newspaper aesthetic with a grayscale color scheme, "Courier New" typography, newsprint texture, and sharp corners. Dull green/red accents are used for trading elements.
**Key UI Components:** AI Prompt Panel, Market Overview watchlist, Portfolio Performance Chart, Positions Grid, and Conversation History. Includes hover tooltips and TradingView integration for advanced charting and multi-asset watchlists.

### Backend
**Server Framework:** Express.js with TypeScript, integrated with Vite middleware.
**Database Strategy:** Drizzle ORM with PostgreSQL, including tables for trades, positions, portfolio snapshots, AI usage logs, trade evaluations, strategy learnings, market regime snapshots, and trade history imports.
**API Design:** RESTful endpoints for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:** Multi-tenant architecture with Passport.js for authentication and PostgreSQL session persistence. AES-256-GCM encryption secures all API keys. Tiered onboarding supports user registration, AI provider choice, and exchange credential setup.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI (shared key) and Personal AI Key (user-provided Perplexity, OpenAI, or xAI credentials).
- **Multi-Provider AI Router:** Supports Perplexity, OpenAI/ChatGPT, and xAI/Grok, handling credential decryption, client creation, and usage tracking.
- **Prompt Processing:** "Mr. Fox" processes natural language prompts to generate structured trading strategies, including interpretations, actions, risk management, and numeric values.
- **Strategy-Scoped Context System:** Each trading strategy maintains independent conversation history and AI context, isolated via strategyId.
**Autonomous Trading System:** Multi-tenant system with per-user monitoring loops. Supports Passive (learning-only) and Active (autonomous trading) modes with safety checks. The system prioritizes AI autonomy, removing most hardcoded trading restrictions, with only three remaining constraints: $10 minimum notional, exactly one stop loss per position, and asset-specific leverage caps. AI can now place multiple take profit orders.
**Market Structure-Based Stop Loss Placement:** Stops are placed at invalidation levels with a small buffer, targeting opposite range extremes for take profits.
**Scaled Order Entries:** AI distributes limit orders ±1-3% around target entry prices to account for market volatility.
**Order Management System:** Enforces exactly one stop loss per position (multiple take profits allowed). Includes duplicate order prevention and disciplined stop loss management, ensuring stops are set based on market structure and can only be moved to protect gains. Protective order management enhancements allow AI to place stops at any distance, filter candidates by direction, and use a 0.3% price tolerance for order comparison.
**Comprehensive Safety System (Oct 19, 2025):**
- **Liquidation Protection:** Enforces 1.5% buffer between stop losses and liquidation price. For longs, ensures SL > liquidationPrice × 1.015; for shorts, ensures SL < liquidationPrice × 0.985. Auto-corrects dangerous stops instead of rejecting trades.
- **Manual Override Protection:** Database flags (`manualStopLossOverride` + `manualOverrideAt`) prevent AI from replacing user's manual stop loss adjustments. AI skips protective order placement when manual override is detected.
- **MarketContextAnalyzer:** Validates limit order fill probability using ATR-based volatility analysis. Rejects or auto-corrects orders exceeding 2× volatility or 3× ATR distance thresholds. Uses percentage-normalized calculations to prevent unit mismatch bugs (fixed: ATR converted to percentage before comparison).
- **Fill Probability Integration:** All limit orders validated before execution. Auto-correction clamps suggested prices to positive values within 24h range. Detailed logging for transparency.
**Trade Performance Evaluation & Learning System:** Automates trade evaluation on close using quantitative and AI-powered qualitative analysis. Learns from trades, utilizing decay-based weighting and regime-aware filtering, and provides top learnings to the AI for future trade decisions.
**Market Data & Indicators:** Dual WebSocket service for real-time market data. Backend provides CVD Calculator and Volume Profile Calculator.
**Trade History Import & Analysis System:** Allows users to upload CSV trade history for AI-powered style analysis, extracting patterns, calculating metrics, classifying trading style, and generating insights.
**Trade Journal System:** Automatically documents trade entries with AI reasoning, expectations (SL, TP, R:R), and metadata. Updates journal entries on trade close with AI-generated analysis, providing a dedicated UI page for review and pattern recognition.
**Trading Modes (Strategies):** User-defined strategies with customizable parameters (name, description, timeframe, risk %, max positions, leverage, preferred assets, custom rules). Only one strategy can be active at a time.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency, enhanced performance metrics (Sharpe, Sortino, Calmar, etc.), and trading controls.

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