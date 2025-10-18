# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. It enables users to interact with an AI trading agent, "Mr. Fox," using natural language to execute automated strategies. The application features a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls. The project's core mission is to deliver a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management, operating as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.
**Design System:** "Fantastic Mr. Fox" newspaper aesthetic featuring a grayscale color scheme, "Courier New" monospace typography, newsprint texture, and sharp corners. Dull green/red accents are used for trading elements.
**Key UI Components:** AI Prompt Panel, Market Overview watchlist (real-time data, drag-and-drop), Portfolio Performance Chart, Positions Grid, and Conversation History. Includes hover tooltips with mini price charts and risk management levels. Chart and order book components are omitted to optimize API request capacity for autonomous trading.

### Backend
**Server Framework:** Express.js with TypeScript, integrated with Vite middleware.
**Database Strategy:** Drizzle ORM with PostgreSQL for type-safe operations. Schema includes tables for trades, positions, portfolio snapshots, AI usage logs, trade evaluations, strategy learnings, and market regime snapshots.
**API Design:** RESTful endpoints (`/api` prefix) for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:** Multi-tenant architecture with `isAuthenticated` and `requireVerifiedUser` middleware. Passport.js LocalStrategy for authentication (scrypt-hashed passwords) and PostgreSQL session persistence. A tiered onboarding flow supports user registration, AI provider choice (Platform AI or Personal Key), exchange credential setup, and admin verification. Admin users can manage users, view AI usage analytics, and handle contact messages. AES-256-GCM encryption with envelope encryption secures all API keys.
**Contact Admin System:** Allows users to send messages and optional screenshots (max 5MB, base64) to admins.
**AI Integration:**
- **Tiered AI Provider System:** Supports Platform AI (shared key for free tier) and Personal AI Key (user-provided Perplexity, OpenAI, or xAI credentials for premium tier).
- **Multi-Provider AI Router:** Supports Perplexity, OpenAI/ChatGPT, and xAI/Grok. Handles credential decryption, client creation, model validation, and usage tracking, with fallback to the shared platform key.
- **Prompt Processing:** "Mr. Fox" processes natural language prompts to generate structured trading strategies, including interpretations, trading actions, risk management plans, and required numeric values.
**Autonomous Trading System:** Multi-tenant system with per-user monitoring loops using encrypted Hyperliquid and AI credentials. Supports Passive (learning-only) and Active (autonomous trading) modes. The trading philosophy emphasizes patience, selectivity, and avoiding forced trades to maximize Sharpe ratio.
**Order Management System:** Enforces exactly one stop loss and one take profit per position, both at full position size, with server-side validation. Includes quantitative order assessment, an anti-churn policy requiring specific metrics for order adjustments, and a liquidation safety system (2.5% buffer). Mandatory protective orders (stop loss and take profit) are required for every position.
**Trade Performance Evaluation & Learning System:** Enables continuous AI self-improvement via a feedback loop.
- **Evaluation Process:** Automatic on trade close, including 8 quantitative metrics (e.g., PnL vs expectancy, stop-loss adherence, R:R ratio) and AI-powered qualitative analysis for actionable insights.
- **Learning Repository:** Utilizes decay-based weighting (30-day half-life) for insights, regime-aware filtering, and evidence accumulation to strengthen learnings.
- **Integration with AI Trading:** Top 5-10 regime-filtered learnings are provided to the AI for each autonomous trading cycle, influencing trade decisions.
**Market Data & Indicators:** Dual WebSocket service for real-time market data. Backend provides CVD Calculator and Volume Profile Calculator for AI trading decisions.
**Core Features:** Autonomous trading engine, order management, configurable monitoring frequency (Disabled, 1 min, 5 min, 30 min, 1 hour), enhanced performance metrics (Sterling, Omega, Max Drawdown, Sharpe, Sortino, Calmar ratios), and trading controls (individual and "Close All" positions).

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