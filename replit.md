# 1fox

## Overview

1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. It allows users to interact with an AI trading agent, "Mr. Fox," using natural language to execute automated trading strategies. The application features a "Fantastic Mr. Fox" newspaper-themed aesthetic with a grayscale design, modern trading dashboard functionalities, real-time market data, portfolio performance tracking, and comprehensive trading controls. The project aims to provide a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 16, 2025 - Fully Autonomous Trading Engine with Order Management
- **Transformed from monitoring to autonomous trading** - Mr. Fox now trades automatically based on market analysis
- **Autonomous capabilities:**
  - Develops trade theses based on market regime analysis and volume profiles
  - Identifies market conditions: bullish, bearish, neutral, or volatile with confidence levels
  - Analyzes volume profiles to detect high-volume breakout opportunities (compares to market average)
  - Executes trades automatically with proper position sizing and risk management
  - **Learns from user prompts** - Analyzes historical prompts to understand trading style and preferences
  - Sets stop losses and take profits based on technical analysis
  - **Order Management System** - Prevents duplicate protective orders:
    - Fetches existing open orders from Hyperliquid before each protective order placement
    - Displays existing orders to AI for context-aware decision making
    - **Auto-cancel logic**: Cancels ALL reduceOnly orders for a position before placing new stop loss/take profit
    - Ensures maximum ONE stop loss and ONE take profit per position (never duplicates)
    - **Short-circuit on failure**: Skips protective order placement if any cancellation fails
    - **Hyperliquid API adaptation**: Filters by `reduceOnly: true` flag since openOrders endpoint lacks trigger metadata
    - AI can also issue explicit cancel_order commands for non-protective orders
- **Configuration**: Frequency control (Disabled/1min/5min/30min/1hr) via AI Usage panel dropdown
- **Results displayed**: Conversation history shows trade thesis, volume analysis, market regime, execution results, and risk assessment
- **Error handling**: Graceful handling of insufficient margin, minimum order sizes, exchange errors, order conflicts, and cancellation failures

### October 16, 2025 - Configurable Automated Monitoring Frequency
- **Added monitoring frequency control** - Users can now adjust how often autonomous trading runs
- **Frequency options**: Disabled, 1 minute, 5 minutes (default), 30 minutes, 1 hour
- **Implementation details:**
  - Dropdown selector in AI Usage panel with localStorage persistence
  - Auto-sync with backend on component mount (100ms delay for server readiness)
  - Proper error handling with rollback on failure
  - Backend endpoint `/api/monitoring/frequency` validates frequency (0-1440 minutes)
  - Service dynamically restarts with new interval
  - Zero minutes disables autonomous trading completely
- **Error resilience**: Optimistic updates with rollback on server errors, graceful handling of sync failures

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.

**Design System:** Adopts a "Fantastic Mr. Fox" newspaper aesthetic with a grayscale color scheme, uniform "Courier New" monospace typography, subtle newsprint texture, and sharp corners for a clean, minimalist design. Dull green/red accents are used for trading-specific elements.

**Key UI Components:** Includes an AI Prompt Panel, a Market Overview watchlist with real-time data, drag-and-drop reordering, and localStorage persistence. It also features a Portfolio Performance Chart, Sharpe Ratio visualization, Positions Grid, Quick Trade panel, and a detailed Trade History. Hover tooltips with mini price charts display 48-hour hourly data for watchlist items and positions. Conversation history and trade panels are collapsible and searchable. Risk management levels (liquidation price, stop loss, take profit) are displayed within positions. Automated monitoring assessments appear in conversation history, displaying portfolio health, position assessment, market context analysis, and actionable trading suggestions.

### Backend Architecture

**Server Framework:** Express.js with TypeScript, integrated with Vite middleware for development.

**Database Strategy:** Utilizes Drizzle ORM with PostgreSQL (via node-postgres) for type-safe database operations. The schema includes tables for trades, positions, portfolio snapshots, and AI usage logs. Portfolio snapshots are created on server startup, every 5 minutes, and after each successful trade, calculating total value, P&L, Sharpe ratio, and trade statistics.

**API Design:** RESTful endpoints prefixed with `/api` for trading prompts, database operations, and Hyperliquid exchange interactions (market data, orders, positions, leverage).

### AI Integration

**Perplexity AI Integration:** Uses the Perplexity API (OpenAI-compatible) for natural language prompt processing, supporting selectable AI models (Sonar series). AI usage is tracked for tokens and costs.

**Prompt Processing:** The AI trading agent ("Mr. Fox") processes natural language prompts, generates structured trading strategies, and is context-aware (analyzing recent user prompts and market conditions). It provides interpretations, trading actions (including `buy`, `sell`, `stop_loss`, `take_profit`), risk management plans, and expected outcomes. The AI is designed to explicitly require numeric values for position sizes.

### Authentication & Security

The system includes a basic user schema with UUID-based identification and Zod validation.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** Integrated via the `hyperliquid` npm package for perpetual futures trading, providing real-time market data, statistics, and supporting various order types and position tracking. Requires a `HYPERLIQUID_PRIVATE_KEY`. Hyperliquid API requires all orders to be limit orders, handled by using IOC limit orders with extreme prices for market-like execution and correct price calculation. Trigger orders are used for stop loss and take profit functionalities.

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