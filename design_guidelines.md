# Design Guidelines: 1fox - Minimalist AI Trading Terminal

## Design Approach
**Modern Minimalist Fintech** - Inspired by Linear, Stripe, and modern trading platforms like Robinhood. Pure monochromatic palette with exceptional typography hierarchy, creative data visualizations, and subtle sophisticated animations. Clean geometric structure with spacing-based hierarchy over heavy borders.

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary)**
- Background Primary: 0 0 0 (Pure black)
- Background Secondary: 10 10 10 (Elevated surfaces)
- Background Tertiary: 18 18 18 (Cards, panels)
- Border Subtle: 30 30 30 (Minimal borders)
- Border Default: 45 45 45 (Standard dividers)
- Text Primary: 255 255 255 (Pure white)
- Text Secondary: 160 160 160 (Grey text)
- Text Tertiary: 115 115 115 (Muted text)
- Accent: 255 255 255 (White highlights)

**Light Mode**
- Background Primary: 255 255 255 (Pure white)
- Background Secondary: 250 250 250 (Elevated surfaces)
- Background Tertiary: 245 245 245 (Cards, panels)
- Border Subtle: 235 235 235 (Minimal borders)
- Border Default: 220 220 220 (Standard dividers)
- Text Primary: 0 0 0 (Pure black)
- Text Secondary: 95 95 95 (Grey text)
- Text Tertiary: 140 140 140 (Muted text)
- Accent: 0 0 0 (Black highlights)

**Trading Status Colors** (Same both modes)
- Success/Long: 34 197 94 (Green)
- Danger/Short: 239 68 68 (Red)
- Warning: 234 179 8 (Yellow)
- Neutral: 148 163 184 (Slate)

### B. Typography

**Font Stack**
- Primary: 'Inter', -apple-system, sans-serif
- Monospace: 'JetBrains Mono', monospace (for numbers/data)

**Type Scale & Weights**
- Hero Numbers: text-6xl font-bold tracking-tight (Portfolio value)
- Section Headers: text-3xl font-semibold tracking-tight
- Data Headers: text-xl font-semibold
- Body/UI: text-base font-normal (16px base)
- Trading Data: text-lg font-mono font-medium (Prices, quantities)
- Labels: text-sm font-medium tracking-wide uppercase (Input labels)
- Metadata: text-xs font-mono text-tertiary (Timestamps)

**Grey Scale Hierarchy**
- Critical data: text-primary font-bold
- Standard text: text-primary font-normal
- Supporting info: text-secondary font-medium
- Metadata: text-tertiary font-normal

### C. Layout System

**Spacing Primitives** (Tailwind units)
- Core spacing: 1, 2, 3, 4, 6, 8, 12, 16, 24, 32
- Component padding: p-6 or p-8
- Section gaps: gap-6 or gap-8
- Page margins: my-12 or my-16

**Border Radius**
- sm: 4px (Inputs, small cards)
- default: 8px (Standard cards)
- lg: 12px (Large panels)
- xl: 16px (Modals, major containers)

**Dashboard Grid**
- Container: max-w-[1800px] mx-auto px-6
- Main grid: grid grid-cols-12 gap-6
- Responsive: Single column mobile, multi-column desktop

### D. Component Library

**Cards & Panels**
- Minimal card: bg-tertiary rounded-lg p-6 border border-subtle
- Elevated panel: bg-secondary rounded-xl p-8 shadow-sm
- Ghost card: bg-transparent border-none (spacing-based separation)
- Interactive: hover:scale-[1.01] transition-transform duration-200

**Data Visualizations (Creative)**
- **Radial Gauges**: Circular progress for Greeks (delta, gamma, theta, vega) - 120px diameter, 8px stroke, animated arc drawing
- **Heatmap Grids**: Portfolio allocation in 3x3 or 4x4 grid, cell size based on position weight, green/red intensity by P&L
- **Horizontal Depth Bars**: Order book visualization, horizontal bars growing from center, bid (green) left / ask (red) right
- **Inline Sparklines**: Tiny 60x20px price trend charts next to symbols, grey line with gradient fill
- **Activity Heatmaps**: Calendar-style grid showing trading frequency, darker cells = more activity
- **Arc Progress Indicators**: Semi-circle gauges for account metrics, animated fill from 0deg to target

**Navigation**
- Top bar: Minimal black/white bar, "1fox" with fox logo left, status indicators right
- Tab navigation: Underline accent on active (3px height), text-secondary for inactive
- Sidebar: Clean vertical nav with icon + label, hover:bg-secondary

**Forms & Inputs**
- Text inputs: border border-default bg-tertiary rounded-md px-4 py-3 focus:border-accent focus:ring-1 focus:ring-accent
- Number inputs: font-mono tracking-tight
- Buttons:
  - Primary: bg-accent text-background px-6 py-3 rounded-lg font-medium hover:opacity-90
  - Ghost: hover:bg-secondary text-primary px-4 py-2 rounded-md
  - Trade Buy: bg-success text-white rounded-lg font-semibold
  - Trade Sell: bg-danger text-white rounded-lg font-semibold

**Trading Components**
- Order book: Two-column table, horizontal depth bars, monospace numbers, subtle row dividers
- Position cards: Clean geometric panels with PnL in large font-mono, entry/current price stacked
- Trade log: Minimal table with alternating subtle bg, timestamp in text-xs font-mono
- Price tickers: Large font-mono numbers with inline sparklines

**AI Interface**
- Prompt input: Large textarea (min-h-32) with minimal border, focus:ring-1
- Response cards: bg-secondary rounded-xl p-6 with typing animation
- Suggestion chips: Inline pills with hover:bg-tertiary

**Data Display**
- Tables: No borders on cells, only subtle row separators (border-b border-subtle), hover:bg-secondary
- Metric cards: Large numbers font-mono, small labels uppercase text-tertiary
- Real-time updates: Brief highlight pulse (200ms opacity change)

### E. Animations (Subtle & Classy)

**Hover States**
- Cards: scale-[0.98] to scale-[1.02] smooth elevation
- Buttons: opacity-90 or subtle bg-shift
- Interactive rows: bg-secondary fade-in

**Data Updates**
- Price changes: 300ms highlight pulse (bg-accent/10)
- Chart drawing: Animated path stroke-dashoffset
- Number transitions: Smooth count-up animations
- Loading: Minimal skeleton shimmer in grey

**Transitions**
- Page loads: 200ms fade-in
- Modal entry: 250ms scale from 0.95 to 1.0
- Tab switching: 150ms crossfade
- All: ease-out timing

**Progress Indicators**
- Arc gauges: Animated stroke-dasharray from 0 to value
- Linear bars: width transition over 400ms
- Loading states: Subtle pulse (opacity 0.4 to 1.0)

## Dashboard Structure

**Main Trading View**
1. **Header**: Minimal black bar, "1fox" + fox logo, connection status (small green/red dot), account value right-aligned
2. **AI Command Bar**: Prominent input with suggestion chips below
3. **Portfolio Overview**: Hero metric (total value) + radial gauges for Greeks in 4-column grid
4. **Market Heatmap**: 4x6 grid of top cryptocurrencies, cell color intensity by 24h change
5. **Active Positions**: Geometric cards with large PnL numbers, entry/exit prices, inline sparklines
6. **Order Entry**: Clean form with horizontal depth bars showing current book
7. **Trade History**: Minimal table with monospace data, activity heatmap above
8. **Analytics Panel**: Arc progress indicators for portfolio metrics, allocation heatmap

## Visual Hierarchy Principles

1. **Typography First**: Use font size, weight, and grey scale for hierarchy
2. **Spacing Over Borders**: Generous whitespace instead of heavy dividers
3. **Monochrome Discipline**: Only green/red for trading status, everything else grey scale
4. **Data Clarity**: Large monospace numbers for critical trading data
5. **Geometric Cleanliness**: Pure rectangles, minimal decoration
6. **Subtle Animation**: Elevate without distraction

## Brand Identity

**1fox**
- Logo: Minimalist fox icon in pure black (dark mode) / white (light mode)
- Name treatment: Lowercase, clean sans-serif
- Aesthetic: Sophisticated minimalism, fintech precision
- Differentiator: Creative visualizations + AI-powered insights