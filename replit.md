# 1fox

## Overview

1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. It allows users to interact with an AI trading agent, "Mr. Fox," using natural language to execute automated trading strategies. The application features a "Fantastic Mr. Fox" newspaper-themed aesthetic with a grayscale design, modern trading dashboard functionalities, real-time market data, portfolio performance tracking, and comprehensive trading controls. The project aims to provide a professional AI trading experience focused on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 16, 2025 - Position Close Controls
- **Individual close buttons** - Each position now has a close button (X icon) to instantly market close that position
- **Close All button** - Added "Close All" button at top of Positions panel to close all positions and cancel all orders at once
- **Implementation details:**
  - Backend endpoints: `/api/hyperliquid/close-position` (single) and `/api/hyperliquid/close-all` (all)
  - Market closes via IOC (immediate-or-cancel) limit orders with extreme prices
  - Close All cancels all open orders then closes all positions
  - Toast notifications for success/failure with detailed results
  - Loading states during operations ("Closing..." button text)
  - Query cache invalidation to refresh UI immediately

### October 16, 2025 - Removed Quick Trade Panel
- **Quick Trade panel removed** - Streamlined dashboard by removing redundant quick trade functionality
- **AI-first approach** - All trading now done through AI prompt panel for consistency

### October 16, 2025 - Positions Grid Simplified
- **Removed stop loss/take profit sections** - Positions grid now shows only essential position info on one clean line
- **Streamlined display**: Size, Entry, Value, Liquidation, P&L all on single row below pair symbol
- **SL/TP still active** - Protective orders are still managed by Mr. Fox automatically, just not displayed in positions view

### October 16, 2025 - Unified Chart Time Scaling
- **Linear time scaling** - All charts (Portfolio Performance, Risk Ratios) use linear x-axis with `scale="time"` for accurate temporal representation
- **Time frame selection** - Both main charts have 1H, 1D (default), 1W, 1M, 1Y buttons
- **Uniform date formatting** - All charts use consistent formatting: time (1H/1D), dates (1W/1M), month/year (1Y)
- **Y-axis optimization** - Risk ratio charts start at 0, portfolio chart auto-scales
- **Reference lines**: Risk charts show 0 (Breakeven), 1.0 (Good), 2.0 (Excellent)

### October 16, 2025 - Fixed Watchlist Drag-and-Drop
- **Clear visual indicators** - Drag handles now show when drag is enabled/disabled
- **Easy sort clearing** - Added "Clear" button next to "Sorted by X" badge to quickly re-enable dragging
- **Tooltips** - Drag handle shows helpful tooltips: "Drag to reorder" when enabled, "Clear sort to enable drag" when disabled
- **Technical fix**: Drag-and-drop is automatically disabled when column sorting is active (by design), but this was not obvious to users
- **User-friendly solution**: Visual dimming (opacity-40), cursor changes, and one-click sort clearing make it clear when/how to drag

### October 16, 2025 - Enhanced Risk Metrics: Calmar and Sortino Ratios
- **Added Sortino and Calmar ratios** - Portfolio performance now tracks three comprehensive risk-adjusted metrics
- **Sortino Ratio**: Measures return per unit of downside deviation (only penalizes negative volatility, better for asymmetric returns)
- **Calmar Ratio**: Measures annualized return (CAGR) per unit of maximum drawdown (focuses on worst-case losses)
- **Updated chart display**: Risk-Adjusted Performance Ratios chart now shows all three metrics with color-coded lines (Sharpe/primary, Sortino/chart-2, Calmar/chart-3)
- **Implementation details:**
  - Added calmarRatio and sortinoRatio columns to portfolioSnapshots schema
  - Calculation functions implemented in portfolioSnapshotService.ts
  - Sortino uses downside deviation (only negative returns), capped at 10 for no downside volatility
  - Calmar uses CAGR formula: (finalValue/initialValue)^(365.25/elapsedDays) - 1, divided by max drawdown
  - Requires minimum 1 hour of data for Calmar calculation to prevent runaway annualization
  - Values capped at ±100 to prevent chart display issues with extreme scenarios
  - Frontend chart displays all three ratios with legend, color-coded lines, and current values in 3-column grid
- **Database schema updated**: Pushed changes with `npm run db:push --force`
- **Testing**: End-to-end tests verify chart rendering with all three metrics and accessible test IDs

### October 16, 2025 - Fixed Open Orders Display
- **Created /api/hyperliquid/open-orders endpoint** - Positions grid now correctly displays stop loss and take profit orders
- **Hyperliquid API limitation workaround**: openOrders endpoint doesn't include trigger metadata (tpsl field), so endpoint infers SL vs TP based on trigger price relative to current price (long: SL < price, TP > price; short: reversed)
- **Order enrichment**: Endpoint fetches positions and market data to accurately categorize protective orders

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

### October 16, 2025 - AI Usage Tracking Fix
- **Fixed cumulative counting** - AI usage metrics now show accurate cumulative totals
- **Root cause**: Frontend was limited to last 100 log entries, missing older requests when total exceeded 100
- **Solution**: Created `/api/ai/stats` endpoint that calculates totals directly from database (all records)
- **New backend method**: `getAiUsageStats()` returns cumulative totals for requests, tokens, and cost
- **Frontend update**: Now uses stats endpoint instead of manually summing limited logs

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