# AI Crypto Trading Terminal

## Overview

This is an AI-powered cryptocurrency trading terminal designed for the Hyperliquid perpetual futures exchange. The application allows users to interact with an AI trading agent through natural language prompts to execute automated trading strategies. The interface is built as a modern trading dashboard with real-time market data, portfolio performance tracking, and comprehensive trading controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 15, 2025 - AI Context-Aware Trading Agent
- Enhanced AI trading agent to use historical prompt context for personalized suggestions
- AI now analyzes recent user prompts (last 10) to understand trading preferences and patterns
- Added market trend analysis that evaluates current market conditions (bullish/bearish/volatile)
- Market analysis includes trend detection from 24h price changes and volatility assessment
- Fixed Perplexity API compatibility by adding markdown code block stripping (removes ```json``` wrappers)
- AI suggestions now combine user's trading history with real-time market data for smarter recommendations

### October 15, 2025 - Vintage Typewriter Theme
- Complete design transformation to vintage typewriter aesthetic
- Updated all fonts to Courier New monospace throughout the entire application
- Implemented aged paper color palette: cream/sepia tones for light mode (45 35% 92%), dark aged paper for dark mode (30 20% 12%)
- Added paper texture overlay with SVG noise filter (5% opacity) for authentic vintage feel
- Uppercase headers with enhanced letter spacing for typewriter effect
- Muted vintage accent colors for all trading states and UI elements

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
- Vintage typewriter aesthetic with aged paper backgrounds and authentic typewriter fonts
- Light mode: Cream/sepia tones (45 35% 92%) with dark ink text (0 0% 15%)
- Dark mode: Dark aged paper (30 20% 12%) with light cream ink (45 35% 92%)
- Typography: Courier New monospace typewriter font throughout - all UI elements, data, and headings
- Vintage accent colors: Muted blues, greens, and reds for trading states
- Paper texture overlay with SVG noise filter at 5% opacity for authentic aged paper feel
- Component library following vintage typewriter principles with uppercase headers and enhanced letter spacing

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