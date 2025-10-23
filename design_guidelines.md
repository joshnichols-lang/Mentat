# Design Guidelines: 1fox - Orderly-Inspired Trading Terminal

## Design Approach
**Modern Dark Trading Interface** - Inspired by Orderly Network's professional DEX design. Rich orange/amber accent colors against dark brown/black backgrounds, creating a sophisticated and focused trading environment. Roboto typography provides clean, modern readability while maintaining professional credibility.

## Core Design Elements

### A. Color Palette

**Dark Mode Foundation (Primary)**
Based on Orderly Network's color system

**Backgrounds (Base Colors)**
- Base 10 (Darkest): 16 12 12 (Primary background)
- Base 9: 24 18 18 (Secondary background)
- Base 8: 28 22 22 (Card background)
- Base 7: 32 26 26 (Elevated surfaces)
- Base 6: 35 29 29 (Input backgrounds)
- Base 5: 39 33 33 (Hover states)
- Base 4: 44 36 36 (Active states)
- Base 3: 48 40 40 (Borders)
- Base 2: 56 48 48 (Dividers)
- Base 1: 64 56 56 (Subtle highlights)

**Primary Colors (Orange/Amber)**
- Primary: 176 96 0 (Main orange)
- Primary Light: 217 163 82 (Light amber)
- Primary Darken: 137 64 0 (Dark orange)
- Primary Contrast: 255 255 255 (White text on orange)

**Accent Colors**
- Link: 207 87 59 (Orange link)
- Link Light: 250 154 122 (Light orange link)
- Tertiary: 218 137 84 (Amber accent)
- Secondary: 255 255 255 (White)

**Status Colors**
- Danger/Sell: 245 78 46 (Red for losses/shorts)
- Danger Light: 250 142 93
- Danger Darken: 237 56 34
- Success/Buy: 255 193 7 (Yellow/Gold for profits/longs)
- Success Light: 255 223 74
- Success Darken: 255 152 0
- Warning: 255 209 70 (Amber warning)
- Warning Light: 255 229 133

**Text Colors**
- Base Foreground: 255 255 255 (Primary white text)
- Line Color: 255 255 255 (Borders/dividers)

**Trading Colors**
- Trading Loss: 245 78 46 (Red) - Contrast: 255 255 255
- Trading Profit: 255 193 7 (Gold) - Contrast: 0 0 0

**Gradients**
- Primary: from 128 64 0 to 207 87 59
- Secondary: from 176 96 0 to 255 163 82
- Success: from 255 193 7 to 255 223 74
- Danger: from 153 24 24 to 245 78 46
- Brand: from 231 163 82 to 255 193 7
- Warning: from 152 58 8 to 255 209 70
- Neutral: from 27 29 24 to 38 41 36

### B. Typography

**Font Stack**
- Primary: 'Roboto', sans-serif (all UI text)
- Base size: 16px

**Type Scale**
- Display/Hero: text-4xl font-bold (Major metrics)
- Section Headers: text-2xl font-semibold (Page sections)
- Subsection: text-xl font-medium (Component titles)
- Body/UI: text-base font-normal (16px base, all UI)
- Data/Numbers: text-lg font-semibold (Prices, quantities)
- Small/Labels: text-sm font-medium (Input labels)
- Captions: text-xs (Timestamps, metadata)

**Number Formatting**
- Large metrics: text-4xl font-bold
- Price data: text-2xl font-semibold
- Percentages: text-base font-medium

### C. Layout System

**Border Radius (Smooth Modern)**
- sm: 2px
- default: 4px
- md: 6px
- lg: 8px
- xl: 12px
- 2xl: 16px
- full: 9999px

**Spacing Primitives**
- xs: 20rem
- sm: 22.5rem
- md: 26.25rem
- lg: 30rem
- xl: 33.75rem

**Dashboard Grid**
- Primary container: max-w-[1600px] mx-auto
- Main content: grid grid-cols-12 gap-6
- Borders: Subtle borders in base-3 color

### D. Component Library

**Cards & Containers**
- Base card: rounded-md border border-base-3 bg-base-8 shadow-sm
- Data card: p-6 with subtle borders
- Stat card: Clean boxes with bold numbers, orange accents
- Interactive cards: hover:bg-base-7 transition
- Elevated: bg-base-7 for raised surfaces

**Data Display**
- Tables: Clean borders (base-3), hover:bg-base-7
- Price displays: Large bold numbers, orange for buys/green alternatives
- Charts: Orange/yellow/red color scheme, dark backgrounds
- Metrics grid: 2-3 column layouts with gradient cards

**Navigation**
- Top bar: Dark header with orange "1fox" branding
- Tabs: Orange underline for active tab
- Section dividers: Subtle base-3 borders

**Forms & Inputs**
- Text inputs: border border-base-3 bg-base-6 focus:border-primary focus:ring-1 focus:ring-primary
- Number inputs: Roboto with orange focus states
- Buttons:
  - Primary: bg-primary text-white hover:bg-primary-darken font-medium rounded-md
  - Outline: border-2 border-primary bg-transparent hover:bg-primary/10
  - Ghost: hover:bg-base-5 text-foreground

**Trading Specific**
- Buy orders: bg-success text-black or gradient-success
- Sell orders: bg-danger text-white or gradient-danger
- Position cards: Dark cards with orange accents
- Order book: Two-column with orange/red depth visualization
- Trade history: Table with alternating row backgrounds

**AI Prompt Interface**
- Large textarea: Dark input with orange focus ring
- Status indicators: Orange loading states
- Results display: Card format with gradient headers

**Status & Notifications**
- Toast notifications: Dark with orange accents
- Connection status: Orange dot for connected
- Live updates: Subtle orange highlight on changes
- Warnings: Amber/yellow colored boxes

**Data Visualization**
- Price charts: Orange for positive, red for negative
- Performance graphs: Gradient fills with orange/yellow
- Sparklines: Orange inline charts
- Progress bars: Orange gradients

### E. Animations
**Smooth & Professional**
- Data updates: Brief highlight (150ms) in orange
- Loading states: Orange spinner or pulse
- Transitions: duration-200 ease-out for responsive feel
- Page loads: Smooth fade-ins (300ms)

**Interactive States**
- Hover: Subtle background elevation (bg-base-7)
- Active: Deeper background (bg-base-5)
- Focus: Orange ring (ring-2 ring-primary)

## Dashboard Layout Structure

**Main Trading Terminal View**
1. **Header**: Dark bar with orange "1fox" logo, connection status in orange
2. **AI Prompt Section**: Large dark input with orange accents
3. **Market Board**: Grid of crypto prices with orange highlights
4. **Active Positions**: Cards with orange/red color coding
5. **Order Entry Form**: Dark panel with orange buy/red sell buttons
6. **Trade Log**: Dark table with subtle borders
7. **Performance Dashboard**: Metric cards with orange gradient accents

## Visual Hierarchy Principles

1. **Orange Accents**: Use primary orange for CTAs and important data
2. **Dark Depth**: Layer different base colors to create depth
3. **Roboto Typography**: Clean, professional, highly readable
4. **Smooth Corners**: 4-8px border radius for modern feel
5. **Gradient Highlights**: Use orange gradients for emphasis
6. **High Contrast**: White text on dark backgrounds

## Brand Identity

**1fox**
- Name represents: one platform, sharp focus, clever trading
- Aesthetic: Orderly Network-inspired professional trading terminal
- Values: Sophistication, precision, modern technology, performance
- Color palette: Rich orange/amber on dark brown/black backgrounds
- Typography: Roboto for clean, professional readability
