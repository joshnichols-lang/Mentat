# Design Guidelines: AI Crypto Trading Terminal

## Design Approach
**Utility-First Dashboard System** - Drawing inspiration from modern trading platforms (Robinhood, TradingView, Binance) and Linear's interface clarity, combined with Material Design principles for data-dense applications. Professional, trustworthy aesthetic with emphasis on information hierarchy and real-time data clarity.

## Core Design Elements

### A. Color Palette

**Dark Theme (Primary)**
- Background Primary: 222 15% 8%
- Background Secondary: 222 15% 12%
- Background Tertiary: 222 15% 16%
- Border/Divider: 222 10% 25%

**Accent Colors**
- Primary Action: 220 85% 55% (Trust blue for CTAs)
- Success/Long: 142 76% 45% (Green for profits, buy orders)
- Danger/Short: 0 72% 55% (Red for losses, sell orders)
- Warning: 38 92% 50% (Amber for alerts, pending states)
- Neutral Info: 217 25% 65% (Muted blue for secondary info)

**Data Visualization**
- Chart Primary: 220 85% 55%
- Chart Secondary: 280 65% 60%
- Grid Lines: 222 10% 20%

**Text Hierarchy**
- Primary Text: 0 0% 95%
- Secondary Text: 0 0% 70%
- Tertiary/Labels: 0 0% 50%

### B. Typography

**Font Stack**
- Primary: Inter (body text, UI elements)
- Monospace: JetBrains Mono (numbers, prices, data tables)

**Type Scale**
- Display/Hero: text-4xl font-semibold (36px) - Dashboard titles
- Section Headers: text-2xl font-semibold (24px) - Card headers
- Subsection: text-lg font-medium (18px) - Component titles
- Body/UI: text-base font-normal (16px) - General text
- Data/Numbers: text-base font-mono (16px) - Prices, quantities
- Small/Labels: text-sm font-medium (14px) - Input labels
- Captions: text-xs (12px) - Timestamps, metadata

**Number Formatting**
- Large metrics: text-3xl font-mono font-bold
- Price data: text-lg font-mono
- Percentages: text-sm font-mono with color coding

### C. Layout System

**Spacing Primitives**
Use tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Tight spacing: p-2, gap-2 (component internals)
- Standard spacing: p-4, gap-4 (card content)
- Generous spacing: p-6, gap-6 (section separation)
- Large spacing: p-8, gap-8 (major layout divisions)

**Dashboard Grid**
- Primary container: max-w-[1920px] mx-auto
- Sidebar navigation: w-64 fixed (if needed)
- Main content: grid grid-cols-12 gap-4
- Responsive breakpoints: Standard tailwind (sm, md, lg, xl, 2xl)

### D. Component Library

**Cards & Containers**
- Base card: rounded-lg border bg-background-secondary
- Data card: p-6 with header/content separation
- Stat card: Compact design with large number display, label, and trend indicator
- Interactive cards: hover:border-primary/50 transition

**Data Display**
- Tables: Striped rows, hover states, monospace numbers right-aligned
- Price displays: Large, prominent with color-coded change indicators
- Charts: TradingView-style with dark background, minimal chrome
- Metrics grid: 2-4 column layout with icon, value, change percentage

**Navigation**
- Top bar: Fixed header with logo, connection status, account info
- Tabs: Underline style for section switching (Orders, Positions, History)
- Breadcrumbs: If needed for deep navigation

**Forms & Inputs**
- Text inputs: Dark background with subtle border, focus:border-primary
- Number inputs: Monospace font for precision
- Select dropdowns: Custom styled to match dark theme
- Buttons:
  - Primary: bg-primary text-white hover:bg-primary/90
  - Danger: bg-danger text-white (for sell/close positions)
  - Success: bg-success text-white (for buy/long)
  - Outline: border-2 bg-transparent backdrop-blur-sm (on images)

**Trading Specific**
- Order entry panel: Compact form with quick access to limit/market toggle
- Position cards: Show asset, size, entry price, current P&L, actions
- Order book: Two-column layout (bids/asks) with depth visualization
- Trade history: Timeline or table with timestamp, type, price, size

**AI Prompt Interface**
- Large textarea: rounded-lg with prominent border
- Suggestion chips: Small pills showing example prompts
- Status indicators: Processing, analyzing, executing states
- Results display: Structured output showing AI interpretation

**Status & Notifications**
- Toast notifications: Top-right corner for trade confirmations
- Connection status: Indicator in header (Connected to Lighter.xyz)
- Live updates: Pulsing dot or subtle animation for real-time data
- Risk warnings: Amber/red badges for high exposure

**Data Visualization**
- Price charts: Candlestick or line charts with TradingView aesthetic
- Performance graphs: Area charts for P&L over time
- Allocation pie/donut: For portfolio composition
- Sparklines: Inline micro-charts in tables

### E. Animations
**Minimal & Purposeful**
- Data updates: Subtle flash/pulse on price changes (green for up, red for down)
- Loading states: Simple spinner or skeleton screens
- Transitions: duration-200 ease-in-out for smooth state changes
- NO decorative animations - focus on performance

## Dashboard Layout Structure

**Main Trading View**
1. **Header Bar** (fixed top): Logo, wallet connection, account balance, settings
2. **AI Prompt Section** (prominent): Large input area with examples and status
3. **Market Overview** (3-4 columns): Key crypto prices (BTC, ETH, SOL, etc.) with 24h change
4. **Positions Grid** (full width): Active positions with P&L, actions
5. **Order Entry Panel** (sidebar or modal): Quick trade execution
6. **Recent Trades** (table): History of AI-executed trades
7. **Performance Metrics** (2-3 columns): Sharpe ratio, total P&L, win rate

**Information Density**
- Dashboard is information-rich, NOT sparse
- Every section serves a clear purpose
- Data is scannable with strong visual hierarchy
- Critical information (P&L, positions) is always visible

## Visual Hierarchy Principles

1. **Price/P&L First**: Largest, most prominent numbers
2. **Color as Signal**: Green/red only for directional data (profits, losses)
3. **Monospace for Data**: All numerical values use monospace for alignment
4. **Icons as Anchors**: Use icons sparingly to mark sections (chart icon, wallet icon, etc.)
5. **Whitespace for Breathing**: Despite density, maintain clear gutters between sections

## Images
No hero images required - this is a utility dashboard. Use icons from Heroicons throughout for UI elements (chart icons, wallet, settings, etc.).