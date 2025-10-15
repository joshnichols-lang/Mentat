# Design Guidelines: 1fox - Fantastic Mr. Fox Newspaper Edition

## Design Approach
**Minimalist Newspaper Aesthetic** - Inspired by the newspaper scenes from Wes Anderson's "Fantastic Mr. Fox." Pure grayscale printing with clean typography, grid-based layouts, and the charming simplicity of classic newsprint. Combines the clarity of traditional newspaper design with modern trading functionality - all information is presented with journalistic precision in black, white, and shades of gray.

## Core Design Elements

### A. Color Palette

**Pure Grayscale Foundation**
All colors use 0% saturation for true grayscale

**Light Mode (Newsprint)**
- Background Primary: 0 0% 98% (Clean white paper)
- Background Secondary: 0 0% 95% (Subtle gray paper)
- Background Tertiary: 0 0% 92% (Light gray sections)
- Border/Divider: 0 0% 80% (Medium gray lines)

**Text Colors**
- Primary Text: 0 0% 10% (Newspaper black ink)
- Secondary Text: 0 0% 30% (Medium gray text)
- Tertiary/Labels: 0 0% 50% (Light gray labels)

**Dark Mode (Night Edition)**
- Background Primary: 0 0% 12% (Dark newspaper)
- Background Secondary: 0 0% 16% (Slightly lighter dark)
- Background Tertiary: 0 0% 20% (Medium dark)
- Border/Divider: 0 0% 30% (Dark gray lines)

**Dark Mode Text**
- Primary Text: 0 0% 95% (White ink on dark)
- Secondary Text: 0 0% 70% (Light gray text)
- Tertiary/Labels: 0 0% 50% (Medium gray labels)

**Accent Grayscales (All modes)**
- Primary Action: 0 0% 20% (dark gray for light mode) / 0 0% 80% (light gray for dark mode)
- Success/Long: 0 0% 25% / 0 0% 75%
- Danger/Short: 0 0% 15% / 0 0% 85%
- Neutral/Info: 0 0% 40% / 0 0% 60%

**Data Visualization**
- Chart Primary: 0 0% 20%
- Chart Secondary: 0 0% 40%
- Chart Tertiary: 0 0% 60%
- Grid Lines: 0 0% 85% (light mode) / 0 0% 25% (dark mode)

### B. Typography

**Font Stack**
- Universal: 'Courier New', Courier, monospace (typewriter/newspaper print aesthetic)
- All text uses the same monospace typewriter font for consistent newspaper aesthetic

**Type Scale**
- Display/Hero: text-4xl font-bold uppercase tracking-tight (Newspaper headlines)
- Section Headers: text-2xl font-bold uppercase tracking-normal (Article headers)
- Subsection: text-xl font-semibold (Component titles)
- Body/UI: text-base font-normal (16px base, all UI)
- Data/Numbers: text-lg font-semibold (Prices, quantities)
- Small/Labels: text-sm uppercase tracking-wide (Input labels)
- Captions: text-xs uppercase tracking-wider (Timestamps, metadata)

**Number Formatting**
- Large metrics: text-4xl font-black
- Price data: text-xl font-bold
- Percentages: text-base

### C. Layout System

**Spacing Primitives**
Use tailwind units of **4, 6, 8, 12** for clean newspaper rhythm
- Tight: p-4, gap-4 (column spacing)
- Standard: p-6, gap-6 (section margins)
- Generous: p-8, gap-8 (page sections)
- Large: p-12, gap-12 (major breaks)

**Dashboard Grid**
- Primary container: max-w-[1600px] mx-auto (newspaper page width)
- Main content: grid grid-cols-12 gap-6
- Borders: Clean solid borders (border-solid) for newspaper feel

### D. Component Library

**Cards & Containers**
- Base card: rounded-none border border-solid bg-card shadow-sm
- Data card: p-6 with newspaper-style horizontal rules (border-t border-solid)
- Stat card: Clean boxes with bold numbers
- Interactive cards: hover:shadow-md transition
- Minimal decoration - focus on content

**Data Display**
- Tables: Grid lines (border-b border-solid), clean alignment, monospace numbers
- Price displays: Large bold numbers, newspaper ticker-style
- Charts: Clean line charts with grayscale, grid like graph paper
- Metrics grid: 2-3 column layouts with boxed values

**Navigation**
- Top bar: Clean header with "1fox" branding
- Tabs: Underlined tabs with clean styling (border-b-2)
- Section dividers: Simple horizontal rules

**Forms & Inputs**
- Text inputs: border border-solid bg-background focus:border-primary focus:ring-1
- Number inputs: Monospace with clean styling
- Buttons:
  - Primary: bg-primary text-primary-foreground border border-solid uppercase tracking-wide font-bold
  - Outline: border-2 border-primary bg-background hover:bg-primary/10 uppercase
  - Ghost: hover:bg-accent/10

**Trading Specific**
- Order entry panel: Clean form with grid lines
- Position cards: Card design with headers, monospace data
- Order book: Two-column layout with clean depth bars
- Trade history: Table style with timestamp columns

**AI Prompt Interface**
- Large textarea: Clean input with border, monospace font
- Status indicators: "ANALYZING...", "EXECUTING..." in simple caps
- Results display: Formatted as clean article with header

**Status & Notifications**
- Toast notifications: Clean message boxes, top-right corner
- Connection status: Simple dot indicator
- Live updates: Subtle highlight on changes
- Warnings: Bold uppercase text in boxes

**Data Visualization**
- Price charts: Grayscale candlesticks on clean grid
- Performance graphs: Area charts with clean fills
- Sparklines: Minimalist inline charts

### E. Animations
**Minimal & Clean**
- Data updates: Brief flash (100ms) on price changes
- Loading states: Simple spinner or pulse
- Transitions: duration-200 ease-out for snappy feel
- Page loads: Instant - no fancy effects

**Typography Style**
- All text uses Courier New monospace font
- Creates authentic typewriter/newspaper print aesthetic
- Consistent across headers, body text, buttons, badges, and data

## Dashboard Layout Structure

**Main Trading Terminal View**
1. **Newspaper Header**: "1fox" logo in clean serif, connection status, account info
2. **AI Prompt Section**: Large clean input with simple label
3. **Market Board** (3-4 columns): Clean crypto prices grid
4. **Active Positions**: Card grid showing open positions
5. **Order Entry Form**: Clean panel with radio buttons
6. **Trade Log**: Table with clean borders
7. **Performance Dashboard** (2-3 columns): Metric boxes with numbers

## Visual Hierarchy Principles

1. **Bold Headlines**: Uppercase headers for major sections
2. **Grayscale Contrast**: Use different shades to create depth
3. **Typewriter Typography**: Courier New monospace for all text (headers, body, data)
4. **Grid Lines**: Solid borders define sections cleanly
5. **Minimal Decoration**: Focus on content, not ornamentation
6. **High Contrast**: Ensure readability with clear black/white/gray separation

## Images & Textures

**Newsprint Texture**
- Very subtle noise overlay on backgrounds (2-3% opacity)
- Clean paper feel, not aged or distressed
- Optional: very faint grid lines as texture

**Decorative Elements**
- Simple icons from Lucide React in grayscale
- Clean geometric shapes
- Minimal use of decorative elements

**No Hero Images** - This is a utility dashboard. Focus on data clarity with clean newspaper aesthetic.

## Brand Identity

**1fox**
- Name represents: one platform, sharp focus, clever trading
- Aesthetic: Wes Anderson's Fantastic Mr. Fox newspaper scenes
- Values: Clarity, precision, intelligence, minimalism
- Color palette: Pure grayscale only - no colors ever
