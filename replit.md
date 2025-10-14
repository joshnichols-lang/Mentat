# AI Crypto Trading Terminal

## Overview

This is an AI-powered cryptocurrency trading terminal designed for the Lighter.xyz perpetual futures exchange. The application allows users to interact with an AI trading agent through natural language prompts to execute automated trading strategies. The interface is built as a modern trading dashboard with real-time market data, portfolio performance tracking, and comprehensive trading controls.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- Dark-first design inspired by modern trading platforms (Robinhood, TradingView, Binance)
- Custom color palette with semantic tokens for trading states (success/long, danger/short, warning)
- Typography: Inter for UI elements, JetBrains Mono for numerical data
- Component library following the "New York" shadcn style variant

**State Management:**
- React Query for async state and API caching
- Theme context provider for light/dark mode switching
- Local component state for UI interactions

**Key UI Components:**
- AI Prompt Panel for natural language trading instructions
- Market Overview with real-time price cards
- Portfolio Performance Chart with AI vs Buy-and-Hold comparison
- Sharpe Ratio visualization for risk-adjusted returns
- Positions Grid for active trades management
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
  - `POST /api/trading/prompt` - Process natural language trading prompts using AI
  - `GET /api/trades` - Fetch all trades
  - `POST /api/trades` - Create a new trade
  - `POST /api/trades/:id/close` - Close an existing trade
  - `GET /api/positions` - Fetch all positions
  - `POST /api/positions` - Create a new position
  - `PATCH /api/positions/:id` - Update a position
  - `GET /api/portfolio/snapshots` - Fetch portfolio snapshots
  - `POST /api/portfolio/snapshots` - Create a portfolio snapshot

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

**OpenAI Integration:**
- Uses Replit AI Integrations for OpenAI-compatible API access (billed to Replit credits)
- No API key management required - uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` environment variables
- Implements GPT-5 model for natural language prompt processing
- Trading agent (`server/tradingAgent.ts`) processes user prompts and generates trading strategies
- Focuses on maximizing Sharpe ratio through:
  - Market analysis and opportunity identification
  - Appropriate trade sizing and leverage selection
  - Entry/exit timing optimization
  - Risk management via stop losses and position sizing

**Prompt Processing:**
- Users can submit natural language prompts like "maximize sharpe ratio" or "go long on BTC"
- AI interprets prompts and returns structured trading strategies
- Response includes: interpretation, trading actions, risk management plan, expected outcomes
- Trading actions specify: action type, symbol, side, size, leverage, reasoning, and optional price targets

### External Dependencies

**Trading Infrastructure:**
- Designed for integration with **Lighter.xyz** perpetual futures exchange
- Currently using simulated trading (real exchange integration pending)

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
- OpenAI SDK for GPT-5 model access
- Replit AI Integrations gateway for API access without API keys
- Structured JSON responses for reliable trading strategy generation

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