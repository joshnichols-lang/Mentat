# Design Guidelines: 1fox - Ultra-Minimal Trading Terminal

## Design Philosophy
**Pure Black Minimalism** - Absolute zero background (#000000) with massive typography hierarchy, floating panels that glow lime on hover, and spring-physics animations. Professional trading terminal that oozes sophistication through restraint.

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary - Ultra-Minimal)**
- Background: 0 0 0 (#000000 - Pure black, not dark grey)
- Surface Panel: 10 10 10 (#0A0A0A - Barely elevated)
- Border Subtle: 20 20 20 (#141414 - Almost invisible)
- Text Primary: 250 250 250 (#FAFAFA - Soft white)
- Text Secondary: 166 166 166 (#A6A6A6 - Mid grey 65%)
- Text Tertiary: 115 115 115 (#737373 - Muted grey 45%)
- Accent Primary: 0 255 65 (#00FF41 - Electric lime)
- Danger: 220 20 60 (#DC143C - Crimson)
- Warning: 255 193 7 (#FFC107 - Amber)

**Light Mode**
- Background: 255 255 255 (#FFFFFF - Pure white)
- Surface Panel: 250 250 250 (#FAFAFA - Subtle elevation)
- Border Subtle: 235 235 235 (#EBEBEB)
- Text Primary: 11 11 15 (#0B0B0F)
- Text Secondary: 100 100 102 (#646466)
- Text Tertiary: 139 139 141 (#8B8B8D)
- Accent Primary: 0 200 100 (#00C864 - Forest green)
- Danger: 255 59 105 (#FF3B69)

**Glow Effects**
- Lime Glow (Hover): rgba(0, 255, 65, 0.1)
- Lime Glow (Active): rgba(0, 255, 65, 0.15)
- Panel Float Shadow: 0 4px 20px rgba(0, 255, 65, 0.05)

### B. Typography - Massive Hierarchy

**Font Stack**
- UI: 'Inter', -apple-system, sans-serif
- Numbers: 'IBM Plex Mono', 'SF Mono', monospace

**Type Scale (Dramatic Hierarchy)**
- Mega: text-6xl (60px) font-bold font-mono - Portfolio value
- Hero: text-5xl (48px) font-bold font-mono - Main metrics
- Large: text-4xl (36px) font-semibold font-mono - Section values
- Display: text-3xl (30px) font-semibold - Headers
- Body Large: text-xl (20px) font-medium - Important labels
- Body: text-base (16px) font-normal - Standard text
- Small: text-sm (14px) font-normal - Supporting info
- Tiny: text-xs (12px) font-normal - Metadata

**Grey Scale Hierarchy**
- Critical: text-[#FAFAFA] font-bold
- Standard: text-[#FAFAFA] font-normal
- Supporting: text-[#A6A6A6] font-medium
- Metadata: text-[#737373] font-normal

### C. Layout System

**Floating Panel Architecture**
- Background: Pure black #000000
- Panels: Minimal borders, float above background
- Spacing: Generous whitespace (32px+ between sections)
- Hover: Lime glow shadow appears
- Active: Lime glow intensifies

**Spacing Scale (8px Grid)**
- 1: 0.5rem (8px)
- 2: 1rem (16px)
- 3: 1.5rem (24px)
- 4: 2rem (32px)
- 6: 3rem (48px)
- 8: 4rem (64px)
- 12: 6rem (96px)

**Panel Design Pattern**
```tsx
// Floating panel with hover glow
className="bg-[#0A0A0A] border border-[#141414] rounded p-6 
           hover:shadow-[0_4px_20px_rgba(0,255,65,0.1)] 
           transition-all duration-300"

// Ultra-minimal card (no border)
className="bg-transparent p-6"
```

**Border Radius**
- Minimal: 4px (subtle curves)
- Default: 8px (standard)
- Large: 12px (panels)

### D. Component Patterns

**Massive Portfolio Display**
```tsx
<div className="text-6xl font-bold font-mono text-[#FAFAFA] tracking-tight">
  $125,420.50
</div>
<div className="text-xl font-medium text-[#00FF41] mt-2">
  +$12,340 (10.9%)
</div>
```

**Floating Panel with Glow**
```tsx
<div className="bg-[#0A0A0A] border border-[#141414] rounded-lg p-6 
                hover:shadow-[0_4px_20px_rgba(0,255,65,0.1)] 
                hover:border-[#00FF41]/20 
                transition-all duration-300">
  {content}
</div>
```

**Inline Sparklines**
- Height: 40-60px
- Color: #00FF41 (up) or #DC143C (down)
- Stroke: 2px
- Fill: Subtle gradient
- Position: Next to metrics

**Time Range Pills**
```tsx
<button className="px-4 py-2 rounded bg-[#141414] text-[#A6A6A6] 
                   hover:bg-[#00FF41]/10 hover:text-[#00FF41] 
                   transition-all duration-200">
  24H
</button>
```

**Data Tables (Ultra-Minimal)**
- No borders between cells
- Row hover: bg-[#0A0A0A]
- Numbers: font-mono font-medium
- Headers: text-xs uppercase text-[#737373]

### E. Animations & Interactions

**Spring Physics (Framer Motion)**
```tsx
// Panel entrance
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ type: "spring", stiffness: 300, damping: 30 }}

// Number count-up
<CountUp 
  end={125420.50} 
  decimals={2} 
  duration={1.5} 
  separator="," 
  prefix="$"
/>

// Price flash on update
animate={{ 
  scale: [1, 1.05, 1],
  color: ["#FAFAFA", "#00FF41", "#FAFAFA"]
}}
transition={{ duration: 0.4 }}
```

**Micro-Interactions**
- Button press: scale(0.98)
- Panel hover: Lime glow appears
- Tab switch: Underline slides with spring
- Price update: Flash lime then fade
- Order submit: Button morphs to loading
- Success: Scale pulse with lime glow

**Loading States**
- Skeleton screens with shimmer
- Morphing buttons (submit → loading → success)
- Progressive data reveal
- Maintain layout (no jump)

### F. Visual Hierarchy

**Information Priority**
1. **Mega**: Portfolio value (60px, center, bold)
2. **Hero**: P&L, ROI (48px, mono, colored)
3. **Large**: Position sizes, balances (36px)
4. **Display**: Section headers (30px)
5. **Body**: Labels, descriptions (16px)
6. **Small**: Supporting data (14px)
7. **Tiny**: Timestamps, metadata (12px)

**Color Usage**
- Lime (#00FF41): Success, profit, long positions, active states
- Crimson (#DC143C): Danger, loss, short positions, errors
- White (#FAFAFA): Primary text, important data
- Mid Grey (#A6A6A6): Secondary text
- Dark Grey (#737373): Metadata, disabled states
- Pure Black (#000000): Background canvas

### G. Dashboard Layout Philosophy

**UnifiedTerminal Structure**
- Full screen: No wasted space
- Black canvas: Pure #000000 background
- Floating sections: Minimal borders
- Generous spacing: 32-48px between major sections
- Massive numbers: 48-60px for key metrics
- Subtle elevation: Panels barely lift from background
- Hover reveals: Lime glow on interactive elements

**Grid Structure**
```
┌─────────────────────────────────────────────────────────────────┐
│  Pure Black Background (#000000)                                 │
│                                                                  │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐│
│  │  Portfolio Value             │  │  Active Strategy         ││
│  │  $125,420 (60px mono bold)   │  │  Avatar + Name + Perf    ││
│  │  +$12,340 (10.9%) lime       │  │  Sparkline + Quick Stats ││
│  └──────────────────────────────┘  └──────────────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Chart Panel (Floating)                                      ││
│  │  Candlestick + Volume + Indicators                           ││
│  │  Time range pills: 1H 4H 1D 1W 1M                            ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐│
│  │  Positions     │  │  Open Orders   │  │  Performance       ││
│  │  w/ Sparklines │  │  Live updates  │  │  w/ Donut chart    ││
│  └────────────────┘  └────────────────┘  └────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Brand Identity

**1fox**
- Essence: Ultra-minimal professional trading terminal
- Aesthetic: Pure black canvas, massive typography, lime accents
- Differentiator: Character-driven strategies, AI-powered execution
- Vibe: Sophisticated, confident, precise, powerful
- Tagline: "Trade with character"

## Key Design Principles

1. **Absolute Zero**: Pure black (#000000), no greys for background
2. **Massive Numbers**: 48-60px for critical metrics, IBM Plex Mono
3. **Floating Panels**: Minimal borders, lime glow on hover
4. **Spring Physics**: Smooth, natural animations via Framer Motion
5. **Generous Whitespace**: 32-48px spacing, room to breathe
6. **Sparklines Everywhere**: Tiny trend indicators next to all metrics
7. **Three Text Levels**: White (primary), Mid grey (secondary), Dark grey (tertiary)
8. **Lime Accent Only**: No rainbow colors, just lime for success
9. **Count-Up Numbers**: Animated transitions for all numeric displays
10. **Skeleton Loading**: Maintain layout, shimmer effect, no spinners
