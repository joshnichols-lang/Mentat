# 1fox

## Overview

1fox is an AI-powered cryptocurrency trading terminal for the Hyperliquid perpetual futures exchange. It enables users to interact with an AI trading agent, "Mr. Fox," using natural language to execute automated strategies. The application offers a "Fantastic Mr. Fox" newspaper-themed aesthetic, real-time market data, portfolio tracking, and comprehensive trading controls. The project's goal is to provide a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.

**Design System:** Features a "Fantastic Mr. Fox" newspaper aesthetic with a grayscale color scheme, "Courier New" monospace typography, subtle newsprint texture, and sharp corners. Dull green/red accents are used for trading elements.

**Key UI Components:** Includes an AI Prompt Panel, Market Overview watchlist with real-time data and drag-and-drop reordering, Portfolio Performance Chart, Positions Grid, and Conversation History. Hover tooltips with mini price charts display 48-hour hourly data for watchlist items and positions. Risk management levels are displayed within positions.

### Backend Architecture

**Server Framework:** Express.js with TypeScript, integrated with Vite middleware.

**Database Strategy:** Utilizes Drizzle ORM with PostgreSQL for type-safe operations. The schema includes tables for trades, positions, portfolio snapshots (created on server startup, every 5 minutes, and after successful trades), and AI usage logs. Portfolio snapshots calculate total value, P&L, Sharpe ratio, and trade statistics.

**API Design:** RESTful endpoints prefixed with `/api` for trading prompts, database operations, and Hyperliquid exchange interactions (market data, orders, positions, leverage).

### AI Integration

**Perplexity AI Integration:** Uses the Perplexity API (OpenAI-compatible) with selectable AI models (Sonar series) for natural language prompt processing. AI usage for tokens and costs is tracked.

**Prompt Processing:** The AI trading agent ("Mr. Fox") processes natural language prompts, generates structured trading strategies, and is context-aware. It provides interpretations, trading actions (`buy`, `sell`, `stop_loss`, `take_profit`), risk management plans, and expected outcomes, explicitly requiring numeric values for position sizes.

### Authentication & Security

**Multi-Tenant Architecture:** The application is now a fully multi-tenant SaaS. All API routes are protected with `isAuthenticated` middleware using Replit Auth OAuth. User identity is extracted from `req.user.claims.sub` and used for all data operations.

**Authentication Flow:**
1. Users log in via Replit Auth OAuth (handled by `@replit/auth-node` integration)
2. `isAuthenticated` middleware validates session on all protected routes
3. New users are redirected to onboarding to add Hyperliquid API credentials
4. Dashboard checks credentials and redirects to onboarding if missing

**User Credentials:** Uses AES-256-GCM encryption with envelope encryption for storing Hyperliquid API private keys per user. Each credential has a unique Data Encryption Key (DEK) that is encrypted with the master key (ENCRYPTION_MASTER_KEY secret). The `credentialService` provides secure encryption/decryption with proper key isolation - if one credential is compromised, others remain secure.

**User Schema:** Includes UUID-based identification, Zod validation, and per-user settings (monitoring frequency preferences stored in `monitoringFrequencyMinutes` field).

**Data Isolation:** Complete per-user data isolation achieved:
- All database tables have userId foreign keys (trades, positions, portfolio_snapshots, ai_usage_log, monitoring_log, user_api_credentials)
- All storage methods enforce userId-first parameter pattern with `withUserFilter()` helper
- All API routes extract `userId = req.user.claims.sub` and pass to storage/Hyperliquid clients
- Per-user Hyperliquid clients via `getUserHyperliquidClient(userId)` with encrypted credentials
- Monitoring frequency preferences stored per-user (not actively used yet)
- Each user's AI agent learns only from their own interactions

**Background Services Limitation:** The autonomous trading engine (`monitoringService.ts`) and portfolio snapshot service (`portfolioSnapshotService.ts`) currently use a single `TEST_USER_ID` and are NOT multi-tenant ready. Per-user monitoring preferences are stored in the database but not actively used by these services. **For production multi-tenant deployment, these background services should be disabled OR completely refactored to run per-user with separate instances and proper credential isolation.**

### Core Features

**Autonomous Trading Engine:** Mr. Fox autonomously trades based on market analysis, developing trade theses, identifying market conditions, and analyzing volume profiles. It executes trades with proper position sizing and risk management, learns from user prompts, and sets stop losses and take profits based on technical analysis.

**Order Management System:** Prevents duplicate protective orders by fetching existing open orders, displaying them to the AI, and auto-canceling all `reduceOnly` orders for a position before placing new stop loss/take profit orders. Ensures a maximum of one stop loss and one take profit per position.

**Configurable Monitoring Frequency:** Users can adjust the autonomous trading frequency (Disabled, 1 minute, 5 minutes, 30 minutes, 1 hour).

**Enhanced Performance Metrics:** Tracks Sterling Ratio, Omega Ratio, Maximum Drawdown, Sharpe, Sortino, and Calmar ratios.

**Trading Controls:** Individual and "Close All" buttons for positions, executing market closes via IOC limit orders with extreme prices.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** Integrated via the `hyperliquid` npm package for perpetual futures trading, market data, order types, and position tracking. Requires `HYPERLIQUID_PRIVATE_KEY`.

**UI Component Libraries:**
- **Radix UI:** For accessible UI primitives.
- **Recharts:** For data visualization.
- **Lucide React:** For iconography.
- **Embla Carousel:** For responsive carousels.

**Database & ORM:**
- `pg` (node-postgres) for PostgreSQL connectivity.
- **Drizzle ORM:** For type-safe database interactions and schema validation.

**AI/LLM:**
- **OpenAI SDK:** Used to access the Perplexity API for integrating Perplexity Sonar models.

**Development Tools:**
- **Vite:** For frontend build and development.
- **ESBuild:** For server bundling in production.
- **TypeScript:** With strict mode enabled.