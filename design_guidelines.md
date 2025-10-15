# Design Guidelines: AI Crypto Trading Terminal - Vintage Typewriter Edition

## Design Approach
**Vintage Typewriter Dashboard System** - Inspired by 1940s office documents, vintage computing terminals, and classic typewriter aesthetics. Combines the information density of modern trading platforms (TradingView, Bloomberg Terminal) with nostalgic sepia tones, aged paper textures, and authentic typewriter typography. The design evokes trustworthiness through timeless, analog aesthetics while maintaining modern functionality.

## Core Design Elements

### A. Color Palette

**Aged Paper Foundation**
- Background Primary: 45 35% 92% (Cream/aged paper)
- Background Secondary: 40 25% 88% (Slightly darker parchment)
- Background Tertiary: 38 20% 84% (Aged document texture)
- Border/Divider: 30 15% 65% (Faded ink lines)

**Typewriter Ink Colors**
- Primary Text: 0 0% 15% (Dark charcoal ink)
- Secondary Text: 0 0% 35% (Faded ink)
- Tertiary/Labels: 0 0% 50% (Light typewriter gray)

**Accent Colors (Muted/Vintage)**
- Primary Action: 210 25% 45% (Vintage blue ink stamp)
- Success/Long: 140 30% 40% (Faded green ledger)
- Danger/Short: 0 40% 45% (Red pencil markup)
- Warning: 35 45% 50% (Amber highlight)
- Info: 200 20% 55% (Blue carbon copy)

**Data Visualization**
- Chart Primary: 25 25% 35% (Sepia graph line)
- Chart Secondary: 210 20% 50% (Blue ink alternate)
- Grid Lines: 40 10% 80% (Faint ruled lines)

**Paper Texture Overlays**
- Subtle grain/noise at 5-10% opacity
- Coffee stain accents: 30 40% 75% at 20% opacity (decorative use only)
- Typewriter ribbon fade effects on headers

### B. Typography

**Font Stack**
- Primary: 'Courier Prime', 'Courier New', monospace (all body text)
- Display: 'Special Elite', 'American Typewriter', serif (headers, emphasis)
- Alternative Mono: 'IBM Plex Mono' (if Courier Prime unavailable)

**Type Scale**
- Display/Hero: text-4xl font-bold uppercase tracking-wide (Dashboard titles)
- Section Headers: text-2xl font-bold uppercase tracking-wider (Card headers)
- Subsection: text-xl font-semibold (Component titles)
- Body/UI: text-base font-normal (16px base, all UI)
- Data/Numbers: text-lg font-mono font-semibold (Prices, quantities)
- Small/Labels: text-sm font-mono uppercase tracking-wide (Input labels)
- Captions: text-xs uppercase tracking-widest (Timestamps, metadata)

**Number Formatting**
- Large metrics: text-4xl font-mono font-black
- Price data: text-xl font-mono font-bold
- Percentages: text-base font-mono with underline decoration

### C. Layout System

**Spacing Primitives**
Use tailwind units of **3, 4, 6, 8, 12** for typewriter-style rhythm
- Tight: p-3, gap-3 (stamp-like compact spacing)
- Standard: p-4, gap-4 (document margins)
- Generous: p-6, gap-6 (page sections)
- Large: p-8, gap-8 (chapter breaks)

**Dashboard Grid**
- Primary container: max-w-[1600px] mx-auto (vintage paper width)
- Main content: grid grid-cols-12 gap-6
- Borders: Use dashed or dotted borders (border-dashed, border-dotted) for vintage feel

### D. Component Library

**Cards & Containers**
- Base card: rounded-sm border-2 border-dashed bg-background-secondary shadow-lg
- Data card: p-6 with typewriter-style horizontal rules (border-t-2 border-dotted)
- Stat card: Paper-clip or stamp aesthetic with embossed numbers
- Interactive cards: hover:shadow-2xl hover:border-solid transition
- All cards include subtle paper texture overlay

**Data Display**
- Tables: Ruled lines (border-b border-dotted), alternating row tints, monospace alignment
- Price displays: Large bold numbers with underline, vintage ticker-tape style
- Charts: Line charts with sepia tones, grid like graph paper, minimal chrome
- Metrics grid: 2-3 column layouts with rubber stamp icons, boxed values

**Navigation**
- Top bar: Fixed header resembling typewriter paper header with company letterhead aesthetic
- Tabs: Underlined tabs with typewriter key styling (rounded-sm border-2)
- Section dividers: Decorative horizontal rules with centered labels

**Forms & Inputs**
- Text inputs: border-2 border-dashed bg-background-primary focus:border-solid focus:border-primary
- Number inputs: Monospace with underline decoration
- Buttons:
  - Primary: bg-primary text-cream border-2 border-primary uppercase tracking-wide font-bold
  - Danger: bg-danger text-cream border-2 uppercase
  - Success: bg-success text-cream border-2 uppercase
  - Outline: border-2 border-primary bg-background-primary/80 backdrop-blur-sm uppercase

**Trading Specific**
- Order entry panel: Ledger-style form with ruled lines, carbon-copy aesthetic
- Position cards: Filing card design with metal tab headers, typewriter data rows
- Order book: Two-column telegraph/ticker layout with vintage depth bars
- Trade history: Receipt/telegram style with timestamp stamps

**AI Prompt Interface**
- Large textarea: Typewriter carriage return style, monospace, border-4 border-dashed
- Suggestion chips: Vintage tag/label aesthetic with string attachment visual
- Status indicators: "PROCESSING...", "ANALYZING...", "EXECUTING..." in stamp style
- Results display: Formatted like typed memo with header/footer rules

**Status & Notifications**
- Toast notifications: Telegram-style messages, top-right corner
- Connection status: Vintage LED indicator or typewriter ribbon color indicator
- Live updates: Typewriter key strike flash effect (subtle)
- Risk warnings: Red rubber stamp boxes with bold uppercase text

**Data Visualization**
- Price charts: Sepia candlesticks on aged graph paper grid
- Performance graphs: Vintage area charts with cross-hatching patterns
- Allocation pie: Hand-drawn aesthetic with labeled segments, dotted connecting lines
- Sparklines: Minimalist telegraph-wire style inline charts

### E. Animations
**Vintage-Inspired Minimal**
- Data updates: Typewriter key press flash (100ms) on price changes
- Loading states: Typewriter carriage return animation or paper feed
- Transitions: duration-300 ease-out with slight mechanical feel
- Page loads: Brief paper-insertion effect (slide from top)

## Dashboard Layout Structure

**Main Trading Terminal View**
1. **Letterhead Header**: Logo in vintage script, connection status as wax seal, account in corner banner
2. **AI Prompt Section**: Large typewriter-style input with "ENTER COMMAND:" label, suggestion tags below
3. **Market Telegraph Board** (3-4 columns): Ticker-tape style crypto prices with 24h change stamps
4. **Active Positions Ledger**: Filing cards grid showing open positions with P&L in red/green pencil
5. **Order Entry Form**: Carbon-copy style panel with limit/market radio buttons (vintage switches)
6. **Trade Receipt Log**: Table formatted as itemized receipt with dotted borders
7. **Performance Dashboard** (2-3 columns): Rubber-stamped metrics boxes with embossed numbers

## Visual Hierarchy Principles

1. **Bold Typewriter Emphasis**: Uppercase headers, underlines for critical data
2. **Ink Color as Signal**: Dark green/red pencil marks for profits/losses only
3. **Monospace Everything**: Authentic typewriter alignment throughout
4. **Ruled Lines & Boxes**: Dotted/dashed borders define sections like form fields
5. **Paper Texture Foundation**: Subtle grain on all backgrounds maintains analog feel
6. **Stamps & Labels**: Use decorative elements sparingly (connection status, trade confirmations)

## Images & Textures

**Paper Textures**
- Subtle noise overlay on all background sections (3-5% opacity)
- Coffee ring stains as decorative accents (not on data areas)
- Creased paper effect on card edges (subtle shadow)

**Decorative Elements**
- Rubber stamp graphics for status indicators (SVG, monochrome)
- Paper clip illustrations for pinned sections
- Vintage computing iconography from Heroicons rendered in ink-style

**No Hero Images** - This is a utility dashboard. Focus on data clarity with vintage aesthetic treatments throughout the interface.