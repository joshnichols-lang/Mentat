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
**UI Optimization:** Chart and order book components removed to optimize API request capacity for autonomous trading operations. Focus is on AI-driven trading rather than manual technical analysis.

### Backend
**Server Framework:** Express.js with TypeScript, integrated with Vite middleware.
**Database Strategy:** Drizzle ORM with PostgreSQL for type-safe operations. Schema includes tables for trades, positions, portfolio snapshots, and AI usage logs.
**API Design:** RESTful endpoints (`/api` prefix) for trading prompts, database operations, and Hyperliquid exchange interactions.
**Authentication & Security:**
- Multi-tenant architecture with `isAuthenticated` and `requireVerifiedUser` middleware.
- Passport.js LocalStrategy for username/password authentication (scrypt-hashed passwords).
- PostgreSQL session persistence.
- **Tiered Onboarding Flow:**
  1. User Registration (username, password, email)
  2. AI Provider Choice: Platform AI (shared key, free tier) or Personal Key (premium tier)
  3. AI Provider Setup (optional - only if Personal Key selected)
  4. Exchange Credentials (Hyperliquid wallet + private key)
  5. Admin Verification & Approval
- Admin user management for user verification, deletion, and AI usage analytics.
  - Admin page displays per-user AI usage statistics: total requests, total tokens consumed, and estimated total cost.
  - Statistics aggregated from AI usage logs and displayed in real-time for all users.
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
- **Tiered AI Provider System:**
  - **Platform AI (Free/Basic Tier):** Users without personal credentials automatically use shared `PERPLEXITY_API_KEY` from environment. Single shared key serves all free-tier users with complete context isolation per user. AI usage statistics hidden from platform users.
  - **Personal AI Key (Premium Tier):** Users can provide their own Perplexity, OpenAI, or xAI credentials for direct billing control and premium model access. AI usage statistics (cost, tokens, requests) visible only to personal key users.
  - Settings UI shows current tier: "Using Platform AI" or "Using Personal AI Key" with switching capabilities.
- **Multi-Provider AI Router:** Supports Perplexity, OpenAI/ChatGPT, and xAI/Grok. Retrieves and decrypts user credentials, creates OpenAI-compatible clients, validates model compatibility, tracks usage, and provides default models. Falls back to shared platform key when users lack personal credentials.
- **Prompt Processing:** "Mr. Fox" processes natural language prompts to generate structured trading strategies, providing interpretations, trading actions, risk management plans, and expected outcomes with required numeric values for position sizes.
**Autonomous Trading System:**
- Multi-tenant system with per-user monitoring loops.
- Uses per-user encrypted Hyperliquid and AI provider credentials.
- Server starts monitoring for active users on startup.
- API controls for agent mode and monitoring frequency.
- Passive (learning-only) and Active (autonomous trading) modes with user confirmation.
- **Trading Philosophy:** Emphasizes patience and selectivity. Default behavior is NO ACTION unless genuinely compelling, high-probability setups exist. Cash is considered a valid position. AI instructed to avoid forced trades, focusing instead on quality over quantity to maximize Sharpe ratio. Explicit guidance provided on when to stay out of markets (choppy conditions, weak volume, insufficient conviction, poor risk/reward, FOMO-based entries).

### Market Data & Indicators
**WebSocket Service:** Dual WebSocket architecture for real-time market data (trades, L2 book, candles) with client-side aggregation and auto-reconnection.
**Backend Indicators:** CVD Calculator and Volume Profile Calculator available via API for AI trading decisions (not exposed in UI to conserve API requests).

### Core Features
**Autonomous Trading Engine:** AI develops trade theses, identifies market conditions, analyzes volume profiles, executes trades with proper sizing and risk management, and sets stop losses/take profits.
**Order Management System:** Enforces EXACTLY ONE stop loss and EXACTLY ONE take profit per position, both at full position size. Server-side validation rejects duplicate protective orders for same symbol. Fetches existing orders for AI context, and auto-cancels `reduceOnly` orders before placing new ones. **Quantitative Order Assessment:** AI evaluates existing stop loss and take profit orders against specific thresholds before replacing them: 5% price movement limit, 2:1 minimum risk/reward ratio, 3 ATR distance check, and market regime consistency. Default behavior is to KEEP orders unless thresholds are violated, with AI required to cite calculated metrics when canceling orders to enforce disciplined decision-making. **Liquidation Safety System:** Stop losses use MARKET execution for guaranteed fills. Server-side validation enforces 2% buffer from liquidation price - long positions require stops at least 2% above liquidation, shorts require stops at least 2% below liquidation. Orders violating safety rules are rejected with clear error messages showing safe stop levels. **Mandatory Protective Orders:** AI must ALWAYS place both stop loss and take profit orders for every position as part of proper risk management discipline.
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