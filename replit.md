# 1fox

## Overview

1fox is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. The application allows users to interact with an AI trading agent through natural language prompts to execute automated trading strategies. The interface is built with a Fantastic Mr. Fox newspaper aesthetic - clean grayscale design with modern trading dashboard functionality, real-time market data, portfolio performance tracking, and comprehensive trading controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 15, 2025 - Mr. Fox Professional Trading Agent
- Rebranded AI trading agent to "Mr. Fox" - professional AI trader managing Hyperliquid perpetual contracts
- Updated system prompt with professional trading methodology:
  - Goal: Maximize Sharpe ratio through optimal sizing, entries, exits, and compounding
  - Multi-timeframe analysis (1m to Daily) using technical indicators, price action, and order flow strategies
  - Market regime identification: Bullish, Neutral, or Bearish
  - Risk-adjusted position sizing based on fixed risk percentage and volatility
  - Strict risk management with stop loss, take profit, and trailing stops
  - Continuous monitoring of Sharpe ratio, drawdown, and risk metrics
  - Respects portfolio size, funding costs, liquidity, and margin requirements
- UI updated: All references changed from "AI Trading Agent" to "Mr. Fox"
- Toast notifications and user-facing text updated to use Mr. Fox branding
- Maintains focus on real-time executed trades with professional precision

### October 15, 2025 - Hover Price Charts on Watchlist and Positions
- Added hover tooltips with mini price charts on watchlist items and position cards
- MiniPriceChart component displays symbol, current price (large bold monospace), 24h change%, and line chart
- **48-hour hourly data**: Charts now show 48 data points representing past 48 hours of hourly price movement
- Charts use deterministic data generation (symbol hash + sine wave) for consistent visualization
- **Improved positioning**: Hover cards appear above symbols (`side="top" align="start"`) instead of far right for better visibility
- **Enhanced readability**: Chart dimensions increased to 320px width × 80px height with "Past 48 hours" label
- Interactive tooltips show exact price and time when hovering over chart points
- Hover cards appear when hovering over symbol names with 200ms open delay, 100ms close delay
- Graceful fallback: "Market data unavailable" message shown when data cannot be fetched
- Fixed DOM nesting error: moved SortableContext outside tbody for valid HTML structure

### October 15, 2025 - AI Context-Aware Trading Agent
- Enhanced AI trading agent to use historical prompt context for personalized suggestions
- AI now analyzes recent user prompts (last 10) to understand trading preferences and patterns
- Added market trend analysis that evaluates current market conditions (bullish/bearish/volatile)
- Market analysis includes trend detection from 24h price changes and volatility assessment
- Fixed Perplexity API compatibility by adding markdown code block stripping (removes ```json``` wrappers)
- AI suggestions now combine user's trading history with real-time market data for smarter recommendations

### October 15, 2025 - Fantastic Mr. Fox Newspaper Theme
- Rebranded application to "1fox" with Wes Anderson newspaper aesthetic
- Complete design transformation to grayscale color scheme with subtle trading colors
- Light mode: Clean white newsprint (0 0% 98%) with black ink (0 0% 10%)
- Dark mode: Dark newspaper (0 0% 12%) with white ink (0 0% 95%)
- **Uniform Typewriter Typography**: Courier New monospace for ALL text (headers, body, buttons, badges, data)
- Subtle newsprint texture overlay (2% opacity) for authentic newspaper feel
- Dull green/red colors for long/short buttons and +/- price changes (25-30% saturation)
- Sharp corners (0 border radius) for clean newspaper aesthetic

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **React** with TypeScript as the core UI framework
- **Vite** for build tooling and development server
- **Wouter** for lightweight client-side routing
- **TanStack Query** for server state management and data fetching
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** components built on Radix UI primitives

**Design System:**
- Fantastic Mr. Fox newspaper aesthetic with grayscale color scheme
- Light mode: Clean white newsprint (0 0% 98%) with black ink (0 0% 10%)
- Dark mode: Dark newspaper (0 0% 12%) with white ink (0 0% 95%)
- **Uniform Typography**: Courier New monospace typewriter font for ALL text elements (headers, body, buttons, badges, numbers, data) - no font mixing
- Grayscale palette with dull green/red accents for trading (25-30% saturation)
- Newsprint texture overlay with SVG noise filter at 2% opacity for subtle texture
- Sharp corners (0 border radius) with clean solid borders for newspaper aesthetic
- Component library following minimalist newspaper design principles

**State Management:**
- React Query for async state and API caching
- Theme context provider for light/dark mode switching
- Local component state for UI interactions

**Key UI Components:**
- AI Prompt Panel for natural language trading instructions
- Market Overview watchlist with advanced features:
  - Real-time price data (fetches from Hyperliquid every 5 seconds)
  - Drag-and-drop manual reordering using @dnd-kit
  - Column sorting (Price, 24h Change, 24h Volume) with 3-state cycle: desc → asc → cleared
  - Add/remove pairs (max 10 pairs)
  - All preferences persist in localStorage
- Portfolio Performance Chart with AI vs Buy-and-Hold comparison
- Sharpe Ratio visualization for risk-adjusted returns
- Positions Grid for active trades management (fetches from Hyperliquid every 3 seconds)
- Quick Trade panel for manual order entry
- Trade History with detailed execution logs

### Backend Architecture

**Server Framework:**
- **Express.js** with TypeScript for the REST API
- Custom Vite middleware integration for development with HMR
- Session-based request logging and error handling

**Database Strategy:**
- **Drizzle ORM** for type-safe database operations
- PostgreSQL database using node-postgres driver
- Production implementation uses `DbStorage` class with Drizzle ORM
- Schema defines tables for trades, positions, and portfolio snapshots with DECIMAL(18,8) precision for crypto prices

**API Design:**
- RESTful endpoints prefixed with `/api`
- Storage interface abstraction (`IStorage`) implemented by `DbStorage` class
- Centralized error handling middleware
- Available endpoints:
  - **Trading Prompts:**
    - `POST /api/trading/prompt` - Process natural language trading prompts using AI
  - **Database Operations:**
    - `GET /api/trades` - Fetch all trades
    - `POST /api/trades` - Create a new trade
    - `POST /api/trades/:id/close` - Close an existing trade
    - `GET /api/positions` - Fetch all positions
    - `POST /api/positions` - Create a new position
    - `PATCH /api/positions/:id` - Update a position
    - `GET /api/portfolio/snapshots` - Fetch portfolio snapshots
    - `POST /api/portfolio/snapshots` - Create a portfolio snapshot
  - **Hyperliquid Exchange:**
    - `GET /api/hyperliquid/market-data` - Get real-time market data for all assets
    - `GET /api/hyperliquid/positions` - Get user's open positions
    - `POST /api/hyperliquid/order` - Place a new order (limit or market)
    - `POST /api/hyperliquid/cancel-order` - Cancel an existing order
    - `POST /api/hyperliquid/leverage` - Update leverage for a symbol

**Data Models:**
- **Trades**: Store individual trade executions with entry/exit prices, leverage, P&L
- **Positions**: Track active positions with real-time P&L and price updates
- **Portfolio Snapshots**: Historical records of total portfolio value, P&L, Sharpe ratio
- All numeric fields use DECIMAL(18,8) precision for accurate crypto price handling

### Authentication & Security

**Current State:**
- Basic user schema with username/password fields
- UUID-based user identification
- Zod validation schemas for type-safe user input
- Session management infrastructure (connect-pg-simple package included)

**Not Yet Implemented:**
- Password hashing
- JWT or session-based authentication flow
- Protected route middleware
- User registration/login endpoints

### AI Integration

**Perplexity AI Integration:**
- Uses Perplexity API for natural language prompt processing with pay-as-you-go pricing
- API key stored securely in `PERPLEXITY_API_KEY` environment variable
- **Selectable AI Models** with different capabilities and pricing:
  - Sonar ($0.20/M tokens) - Fast & Cost-Effective (default)
  - Sonar Pro ($3-$15/M tokens) - Enhanced Analysis
  - Sonar Reasoning ($1-$5/M tokens) - Advanced Logic
  - Sonar Reasoning Pro ($5-$15/M tokens) - Maximum Intelligence
- Model selection persisted in localStorage for user preference
- Trading agent (`server/tradingAgent.ts`) processes user prompts and generates trading strategies
- Automatic usage tracking and cost calculation for every API request

**Usage Tracking:**
- Database table `ai_usage_log` stores all API requests with token counts and costs
- Real-time cost calculation based on model pricing ($0.20/M tokens for Sonar)
- API endpoints for retrieving usage logs and total costs
- UI component displays:
  - Total spent in dollars
  - Number of requests made
  - Total tokens consumed
  - Auto-refreshes every 30 seconds

**Prompt Processing:**
- Users can submit natural language prompts like "maximize sharpe ratio" or "analyze market trends"
- AI interprets prompts and returns structured trading strategies
- **Context-Aware Analysis:**
  - Fetches user's recent prompts (last 10) from database to understand trading patterns
  - Analyzes current market conditions (bullish/bearish/volatile) from 24h price changes
  - Combines historical user preferences with real-time market trends for personalized suggestions
- Response includes: interpretation, trading actions, risk management plan, expected outcomes
- Trading actions specify: action type, symbol, side, size, leverage, reasoning, and optional price targets
- Markdown code block stripping ensures reliable JSON parsing from Perplexity responses
- All suggestions are educational and for simulation purposes

**API Endpoints:**
- `POST /api/trading/prompt` - Process natural language trading prompts
- `GET /api/ai/usage` - Retrieve AI usage logs
- `GET /api/ai/cost` - Get total AI spending

### External Dependencies

**Trading Infrastructure:**
- **Hyperliquid Exchange** integration via `hyperliquid` npm package (v1.7.7)
- Supports perpetual futures trading (BTC-PERP, ETH-PERP, SOL-PERP, ARB-PERP, etc.)
- Real-time market data fetching (no authentication required)
- **24h Statistics Implementation:**
  - Uses `getAllMids()` for current prices (returns symbols with "-PERP"/"-SPOT" suffixes)
  - Fetches 24h change/volume via POST to `https://api.hyperliquid.xyz/info` endpoint with `{"type": "metaAndAssetCtxs"}`
  - Response contains metadata array (coin names without suffixes) and context array (statistics)
  - Strips "-PERP"/"-SPOT" suffix from price symbols to match with metadata names for correct mapping
  - Calculates 24h % change: `((currentPrice - prevDayPx) / prevDayPx) * 100`
  - Extracts 24h volume from `dayNtlVlm` field in context data
- Trading operations require HYPERLIQUID_PRIVATE_KEY environment variable
- Order types: Limit (Gtc, Ioc, Alo) and Market orders
- Position tracking with real-time P&L and leverage information

**UI Component Libraries:**
- Radix UI primitives for accessible, unstyled components
- Recharts for data visualization (portfolio and Sharpe ratio charts)
- Lucide React for iconography
- Embla Carousel for responsive carousels

**Development Tools:**
- Replit-specific plugins for runtime error overlay and dev banner
- ESBuild for production server bundling
- TypeScript with strict mode enabled
- Path aliases configured for clean imports (@, @shared, @assets)

**Database & ORM:**
- `pg` (node-postgres) for PostgreSQL connection pooling
- Drizzle ORM with Zod integration for schema validation
- Database schema synchronization via `npm run db:push`
- Timestamp handling uses SQL `now()` for proper timezone support

**AI/LLM:**
- OpenAI SDK for Perplexity API access (OpenAI-compatible)
- Perplexity Sonar model for educational trading strategy generation
- Structured JSON responses for reliable strategy output
- Automatic token usage tracking and cost calculation

### Build & Deployment

**Development:**
- Vite dev server with HMR proxied through Express
- TypeScript compilation checking via `tsc`
- Hot module replacement for React components

**Production:**
- Vite builds client to `dist/public`
- ESBuild bundles server to `dist/index.js` as ESM
- Static file serving configured for production mode
- Environment-based configuration (NODE_ENV)

**Database Operations:**
- `db:push` script for schema synchronization using Drizzle Kit
- PostgreSQL connection via DATABASE_URL environment variable