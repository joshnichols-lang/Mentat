# 1fox

## Overview
1fox is an AI-powered cryptocurrency trading terminal for the Hyperliquid perpetual futures exchange. It allows users to interact with an AI trading agent, "Mr. Fox," using natural language to execute automated strategies. The application provides a "Fantastic Mr. Fox" newspaper-themed interface, real-time market data, portfolio tracking, and comprehensive trading controls. The project aims to deliver a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management. It functions as a multi-tenant SaaS.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.
**Design System:** "Fantastic Mr. Fox" newspaper aesthetic with a grayscale color scheme, "Courier New" monospace typography, newsprint texture, and sharp corners. Dull green/red accents for trading elements.
**Key UI Components:** AI Prompt Panel, Market Overview watchlist (real-time data, drag-and-drop), Portfolio Performance Chart, Positions Grid, Conversation History. Includes hover tooltips with mini price charts and risk management levels.
**TradingView-Style Market Analysis:** Unified interface featuring searchable trading pair selector for all Hyperliquid perpetual and spot markets. Main view includes **interactive line chart** with multiple timeframes (1min, 5min, 15min, 1hr, 4hr, 1day), zoom in/out controls, click-and-drag area selection, and pan/scroll for historical data exploration. Automatically loads 100 historical candles per timeframe with on-demand fetching when scrolling to chart edges. CVD subchart below, and OrderBook with dynamic decimal precision selector. All components auto-update when trading pair changes. OrderBook features intelligent price grouping that rounds bids down and asks up to preserve accurate spreads, with precision options dynamically adjusted based on asset price range.

### Backend
**Server Framework:** Express.js with TypeScript, integrated with Vite middleware.
**Database Strategy:** Drizzle ORM with PostgreSQL for type-safe operations. Schema includes tables for trades, positions, portfolio snapshots, and AI usage logs.
**API Design:** RESTful endpoints (`/api` prefix) for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:**
- Multi-tenant architecture with `isAuthenticated` and `requireVerifiedUser` middleware.
- Passport.js LocalStrategy for username/password authentication (scrypt-hashed passwords).
- PostgreSQL session persistence.
- Multi-step onboarding process requiring Hyperliquid account creation via a referral link and wallet address verification.
- Admin user management for user verification and deletion.
- AES-256-GCM encryption with envelope encryption for storing all API keys (AI and exchange).
- User schema includes agent mode (passive/active), monitoring frequency, and Zod validation for auth requests.
- Form accessibility features (autocomplete, test-ids).
**Contact Admin System:**
- Users can send messages to admin with optional screenshots (max 5MB, images only).
- Server-side validation enforces screenshot format (base64 data:image/*) and size limits.
- Admin page displays pending and resolved messages with resolve functionality.
- Role-based access: admins see all messages, users see only their own.
- Screenshots stored as base64 strings in PostgreSQL; consider external storage if volume grows.
**AI Integration:**
- **Multi-Provider AI Router:** Supports Perplexity, OpenAI/ChatGPT, and xAI/Grok. Retrieves and decrypts user credentials, creates OpenAI-compatible clients, validates model compatibility, tracks usage, and provides default models.
- **Prompt Processing:** "Mr. Fox" processes natural language prompts to generate structured trading strategies, providing interpretations, trading actions, risk management plans, and expected outcomes with required numeric values for position sizes.
**Autonomous Trading System:**
- Multi-tenant system with per-user monitoring loops.
- Uses per-user encrypted Hyperliquid and AI provider credentials.
- Server starts monitoring for active users on startup.
- API controls for agent mode and monitoring frequency.
- Passive (learning-only) and Active (autonomous trading) modes with user confirmation.

### Market Data & Indicators
**WebSocket Service:** Dual WebSocket architecture for real-time market data (trades, L2 book, candles) with client-side aggregation and auto-reconnection.
**CVD Calculator:** Cumulative Volume Delta with spot + perpetual aggregation, normalizing symbols and maintaining chronological history.
**Volume Profile Calculator:** Combines historical candle data with real-time trades, distributing candle volume across prices, tracking buy/sell volume, and calculating Point of Control (POC).

### Core Features
**Autonomous Trading Engine:** AI develops trade theses, identifies market conditions, analyzes volume profiles, executes trades with proper sizing and risk management, and sets stop losses/take profits.
**Order Management System:** Prevents duplicate protective orders, fetches existing orders for AI context, and auto-cancels `reduceOnly` orders before placing new ones.
**Configurable Monitoring Frequency:** Users can adjust autonomous trading frequency (Disabled, 1 min, 5 min, 30 min, 1 hour).
**Enhanced Performance Metrics:** Tracks Sterling, Omega, Max Drawdown, Sharpe, Sortino, and Calmar ratios.
**Trading Controls:** Individual and "Close All" buttons for positions, executing market closes via IOC limit orders.

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