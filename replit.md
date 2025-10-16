# 1fox

## Overview

1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. It enables users to interact with an AI trading agent, "Mr. Fox," through natural language prompts to execute automated trading strategies. The application features a "Fantastic Mr. Fox" newspaper-themed aesthetic with a clean grayscale design, modern trading dashboard functionalities, real-time market data, portfolio performance tracking, and comprehensive trading controls. The project aims to provide a professional AI trading experience, focusing on maximizing Sharpe ratio through optimal sizing, entries, exits, and continuous risk management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 16, 2025 - Risk Management Levels in Positions
- Added risk management section to positions display with three key levels:
  - **Liquidation Price:** Extracted from Hyperliquid API's clearinghouse state (`liquidationPx` field)
  - **Stop Loss:** Placeholder showing "Not set" (requires separate order tracking)
  - **Take Profit:** Placeholder showing "Not set" (requires separate order tracking)
- Updated Position interface and Hyperliquid client to extract liquidationPx from API
- Implemented grayscale newspaper styling for risk management section:
  - Liquidation price uses font-semibold for emphasis (no color)
  - Border-muted creates subtle newspaper-style divider
  - Spacing follows 4/6/8/12 newspaper rhythm (pt-4 mt-4)
- Risk levels displayed in 3-column grid below main position details
- Test IDs added for automated testing: `text-liquidation-{coin}`, `text-stoploss-{coin}`, `text-takeprofit-{coin}`

### October 16, 2025 - Conversation History Display
- Added conversation history box showing all user prompts and Mr. Fox AI responses
- Updated aiUsageLog schema with `aiResponse` field to persist AI trading strategies as JSON
- Created ConversationHistory component with scrollable 500px display area
- **Collapsible Conversations:** Each conversation entry can be expanded/collapsed:
  - Click any conversation to toggle expand/collapse
  - Chevron icon rotates to indicate state (down = collapsed, up = expanded)
  - Conversations default to collapsed state for cleaner UI
  - All conversations work independently
- Shows complete conversation flow:
  - User prompts with timestamp and MessageSquare icon
  - Mr. Fox responses with Bot icon and model badge (shown when expanded)
  - AI interpretation, trading actions with symbol/side/leverage/size, and risk management details
  - Gracefully handles missing responses for older conversations
- Component auto-refreshes every 5 seconds to show latest conversations
- Integrated into Dashboard sidebar above AI Usage Tracker
- Each trading action displays detailed reasoning in italic text

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, and shadcn/ui.

**Design System:** Adopts a "Fantastic Mr. Fox" newspaper aesthetic with a grayscale color scheme. It features a uniform "Courier New" monospace typography for all text, subtle newsprint texture overlay, and sharp corners for a clean, minimalist design. Dull green/red accents are used for trading-specific elements.

**Key UI Components:** Includes an AI Prompt Panel, a Market Overview watchlist with real-time data, drag-and-drop reordering, and localStorage persistence. It also features a Portfolio Performance Chart, Sharpe Ratio visualization, Positions Grid, Quick Trade panel, and a detailed Trade History. Hover tooltips with mini price charts display 48-hour hourly data for watchlist items and positions.

### Backend Architecture

**Server Framework:** Express.js with TypeScript, integrated with Vite middleware for development.

**Database Strategy:** Utilizes Drizzle ORM with PostgreSQL (via node-postgres) for type-safe database operations. The schema includes tables for trades, positions, and portfolio snapshots, using DECIMAL(18,8) precision for crypto prices.

**API Design:** RESTful endpoints prefixed with `/api` for trading prompts, database operations (trades, positions, portfolio snapshots), and Hyperliquid exchange interactions (market data, orders, positions, leverage).

### AI Integration

**Perplexity AI Integration:** Uses the Perplexity API for natural language prompt processing. It supports selectable AI models (Sonar, Sonar Pro, Sonar Reasoning, Sonar Reasoning Pro) with varying capabilities and costs. AI usage is tracked for tokens consumed and costs incurred.

**Prompt Processing:** The AI trading agent ("Mr. Fox") processes natural language prompts, generating structured trading strategies. It is context-aware, analyzing recent user prompts and current market conditions (bullish/bearish/volatile) to provide personalized suggestions. Responses include interpretation, trading actions, risk management plans, and expected outcomes.

### Authentication & Security

The system includes a basic user schema with UUID-based identification and Zod validation. Session management infrastructure is present, though full authentication flows (password hashing, JWT, protected routes) are not yet implemented.

## External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange:** Integrated via the `hyperliquid` npm package (v1.7.7) for perpetual futures trading. It provides real-time market data, 24-hour statistics, and supports various order types and position tracking. Trading operations require a `HYPERLIQUID_PRIVATE_KEY`.

**UI Component Libraries:**
- **Radix UI:** For accessible, unstyled UI primitives.
- **Recharts:** Used for data visualization in portfolio and Sharpe ratio charts.
- **Lucide React:** For iconography.
- **Embla Carousel:** For responsive carousels.

**Database & ORM:**
- `pg` (node-postgres) for PostgreSQL connectivity.
- **Drizzle ORM:** For type-safe database interactions and schema validation with Zod.

**AI/LLM:**
- **OpenAI SDK:** Used to access the Perplexity API (OpenAI-compatible) for integrating Perplexity Sonar models.

**Development Tools:**
- **Vite:** For frontend build and development.
- **ESBuild:** For server bundling in production.
- **TypeScript:** With strict mode enabled for type safety.