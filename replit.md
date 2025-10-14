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
- PostgreSQL-compatible schema (configured for Neon serverless)
- Current implementation uses in-memory storage (`MemStorage`) for development
- Schema defines user authentication structure with UUID primary keys

**API Design:**
- RESTful endpoints prefixed with `/api`
- Storage interface abstraction allows swapping between in-memory and PostgreSQL implementations
- Centralized error handling middleware

**Data Models:**
- User management with username/password authentication
- Extensible schema structure in `shared/schema.ts` for type safety across client and server

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

### External Dependencies

**Trading Infrastructure:**
- Designed for integration with **Lighter.xyz** perpetual futures exchange
- No active exchange connection implemented yet (mock data currently used)

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
- @neondatabase/serverless for PostgreSQL connection
- Drizzle ORM with Zod integration for schema validation
- Database migrations output to `/migrations` directory

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