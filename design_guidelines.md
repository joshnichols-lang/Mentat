# Design Guidelines: 1fox - Numora-Inspired Crypto Trading Dashboard

## Design Reference
**Numora Cryptocurrency Trading Dashboard** - Grid-based panel layout with unique data visualizations (transaction heatmaps, circular charts, patterned bars, gradients). Dark sophisticated theme with bright green/red accents. Professional fintech aesthetic combining data density with visual clarity.

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary - Numora Style)**
- Background Primary: 11 11 15 (#0B0B0F - Deep dark grey, not pure black)
- Background Secondary: 20 20 24 (#141418 - Panel backgrounds)
- Background Tertiary: 24 24 28 (#18181C - Elevated panels/cards)
- Border Subtle: 31 31 35 (#1F1F23 - Minimal borders)
- Border Default: 45 45 49 (#2D2D31 - Standard dividers)
- Text Primary: 255 255 255 (#FFFFFF - Pure white)
- Text Secondary: 139 139 141 (#8B8B8D - Grey text 55%)
- Text Tertiary: 100 100 102 (#646466 - Muted text 39%)
- Accent: 0 255 135 (#00FF87 - Bright lime green highlight)

**Light Mode**
- Background Primary: 255 255 255 (#FFFFFF - Pure white)
- Background Secondary: 250 250 250 (#FAFAFA - Elevated surfaces)
- Background Tertiary: 245 245 245 (#F5F5F5 - Cards, panels)
- Border Subtle: 235 235 235 (#EBEBEB - Minimal borders)
- Border Default: 220 220 220 (#DCDCDC - Standard dividers)
- Text Primary: 11 11 15 (#0B0B0F - Deep black)
- Text Secondary: 100 100 102 (#646466 - Grey text)
- Text Tertiary: 139 139 141 (#8B8B8D - Muted text)
- Accent: 0 200 100 (#00C864 - Green highlight)

**Trading Status Colors** (Same both modes)
- Success/Long: 0 255 135 (#00FF87 - Bright lime green)
- Danger/Short: 255 59 105 (#FF3B69 - Bright red/pink)
- Warning: 255 193 7 (#FFC107 - Amber)
- Info: 59 130 246 (#3B82F6 - Blue)
- Neutral: 139 139 141 (#8B8B8D - Grey)

### B. Typography

**Font Stack**
- Primary: 'Inter', -apple-system, sans-serif
- Monospace: 'JetBrains Mono', 'SF Mono', monospace (for numbers/data)

**Type Scale & Weights**
- Hero Numbers: text-5xl font-semibold font-mono tracking-tight (Portfolio value: 125,000$)
- Large Metrics: text-3xl font-semibold font-mono (34%, 75%)
- Section Headers: text-xl font-semibold tracking-tight
- Data Labels: text-sm font-medium tracking-wide opacity-70 (USDT, ETH, SUI)
- Body/UI: text-sm font-normal (14px base, compact dashboard)
- Trading Data: text-base font-mono font-medium (Prices, quantities)
- Metadata: text-xs opacity-60 (Timestamps, secondary info)

**Grey Scale Hierarchy**
- Critical data: text-white font-semibold
- Standard text: text-white/90 font-normal
- Supporting info: text-white/55 font-medium
- Metadata: text-white/39 font-normal

### C. Layout System

**Grid-Based Dashboard**
- Container: max-w-[1920px] mx-auto px-6
- Main grid: grid gap-4 (16px gaps between panels)
- Panel structure: Individual cards/panels for each widget
- Responsive: 1-column mobile, 2-column tablet, 3-4 column desktop

**Spacing Primitives**
- Tiny: 2px (0.5)
- Small: 8px (2)
- Medium: 16px (4)
- Large: 24px (6)
- XLarge: 32px (8)
- Component padding: p-4 or p-6
- Panel gaps: gap-4

**Border Radius**
- sm: 6px (Small elements)
- default: 8px (Standard panels)
- lg: 12px (Large panels)
- xl: 16px (Modals)

**Panel Design Pattern**
- Background: bg-[#141418]
- Border: border border-[#1F1F23]
- Padding: p-4 or p-6
- Rounded: rounded-lg
- Example: `className="bg-[#141418] border border-[#1F1F23] rounded-lg p-4"`

### D. Unique Data Visualizations (Numora Style)

**Transaction Heatmap** (Calendar Grid)
- 12-month calendar grid showing trading activity
- Cells: Small squares (12x12px) with opacity based on volume
- Colors: Grey (no activity) → Bright green (high activity)
- Layout: Months labeled, 7x52 grid for weeks
- Hover: Tooltip with exact date and volume

**Circular/Donut Charts** (Portfolio Allocation)
- Large center percentage (34%)
- Thick stroke (12-16px) with segments
- Colors: Green for main metric, grey for remainder
- Labels: Outside with connecting lines
- Animation: Arc drawing from 0 to value

**Patterned Bar Charts** (Holders Distribution)
- Horizontal bars with diagonal stripe pattern
- Height: 80-120px bars
- Pattern: Repeating diagonal lines (striped effect)
- Labels: Percentages on bars (75%, 20%)
- Colors: Green for whales, grey/white pattern for retail

**Area Charts with Gradients** (Long/Short Ratio)
- Smooth area curves with gradient fill
- Two overlapping areas: Long (green) and Short (grey)
- Gradient: Top bright → Bottom transparent
- Grid: Subtle horizontal lines
- Points: Small dots on data points

**Horizontal Depth Bars** (Order Book)
- Bars growing from center
- Left side: Bids (green)
- Right side: Asks (red)
- Height: 24px per row
- Opacity: Based on depth volume

**Inline Sparklines**
- Tiny charts (60x20px) next to symbols
- Single line, no axes
- Color: Green (up trend) or Red (down trend)
- Fill: Subtle gradient below line

**Holders Visualization**
- Vertical bars with segment labels
- Pattern fills for visual interest
- Percentages in large font-mono
- Categories: Whales, Others with distribution

### E. Component Library

**Navigation**
- Top bar: Dark bg (#0B0B0F), search input left, indicators right
- Search: Dark input with subtle border, placeholder grey
- Tabs: Active has bright green underline (3px), inactive grey text
- Icons: 16-20px, grey with opacity 70%

**Cards & Panels**
- Standard panel: bg-[#141418] border border-[#1F1F23] rounded-lg p-4
- Compact panel: bg-[#141418] border border-[#1F1F23] rounded-lg p-3
- Elevated panel: bg-[#18181C] border border-[#2D2D31] rounded-lg p-6
- Hover state: border-white/10 transition-colors

**Buttons & Controls**
- Time range pills: bg-[#2D2D31] text-white/70 px-3 py-1.5 rounded-md text-sm
- Active pill: bg-white/10 text-white
- Icon buttons: p-2 hover:bg-white/5 rounded-md
- Download/Export: Icon-only, subtle hover

**Data Display**
- Large metrics: font-mono text-3xl font-semibold
- Percentage changes: Green/red text with + or - prefix
- Time period labels: Uppercase text-xs opacity-60 (TODAY, MONTH, YEAR)
- Token badges: bg-white/10 px-2 py-1 rounded text-xs (USDT 35%)

**Tables (Minimal)**
- No borders on cells
- Row separator: border-b border-white/5
- Hover row: bg-white/3
- Headers: text-xs uppercase opacity-60
- Data: font-mono for numbers

### F. Animations (Subtle & Professional)

**Hover States**
- Panels: border color shift to white/10
- Buttons: background opacity +5%
- Interactive rows: bg-white/3 fade-in 150ms

**Data Updates**
- Price changes: 200ms highlight pulse
- Chart drawing: Animated path stroke
- Number transitions: Count-up with easing
- Loading: Subtle skeleton shimmer

**Transitions**
- All: transition-all duration-200 ease-out
- Chart animations: 400ms ease-out
- Modal entry: 250ms scale + fade

## Dashboard Layout Reference (Numora)

**Main Trading View**
1. **Top Navigation**: Search bar left, AI Signals/Stake/Portfolio tabs, profile right
2. **Chart Panel**: Large candlestick chart with timeframe controls (1D/7D/3M/1Y/All)
3. **Transaction Heatmap**: Calendar grid (Sep-Jul) showing activity
4. **Holders Panel**: Large percentage bars with patterns (Whales 75%, Others 20%)
5. **Portfolio Metrics**: TODAY/MONTH/YEAR with values and % changes, token allocation grid
6. **Unlocks Donut Chart**: Circular chart with percentages (34% unlocked)
7. **Buys/Sells Volume**: Patterned bar chart with monospace values
8. **Long/Short Ratio**: Area chart with gradient fills
9. **AI Assistant**: Chat interface bottom right with message bubbles

**Grid Structure**
```
┌─────────────────────────────────────────────────────────────┐
│  Top Nav: Logo | Search | Tabs | Profile                    │
├───────────────────────────────┬─────────────────────────────┤
│  Chart (Large)                │  Portfolio Metrics          │
│                               │  (Grid: TODAY/MONTH/YEAR)   │
│                               ├─────────────────────────────┤
│                               │  Unlocks (Donut Chart)      │
├───────────────────────────────┼─────────────────────────────┤
│  Transaction Heatmap          │  AI Assistant Chat          │
├───────────────────────────────┤                             │
│  Holders (Patterned Bars)     │                             │
├───────────────────┬───────────┴─────────────────────────────┤
│  Buys/Sells Vol   │  Long/Short Ratio                       │
└───────────────────┴─────────────────────────────────────────┘
```

## Visual Hierarchy Principles

1. **Dark Sophistication**: Deep grey (#0B0B0F) background, not pure black
2. **Bright Accents**: Lime green (#00FF87) for success, bright red for danger
3. **Panel Separation**: Subtle borders (#1F1F23) with gaps (gap-4)
4. **Data Clarity**: Large monospace numbers for critical metrics
5. **Creative Visualization**: Heatmaps, patterns, donuts, gradients
6. **Compact Density**: Efficient use of space, 14px base font
7. **Professional Polish**: Subtle animations, clean geometry

## Brand Identity

**1fox**
- Logo: Fox icon in white
- Theme: Sophisticated dark trading terminal
- Aesthetic: Numora-inspired with creative data viz
- Differentiator: Grid panels + unique visualizations + AI
