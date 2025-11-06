# Multi-Strategy Trading Guide

## Understanding Strategy States

1fox supports running up to 3 trading strategies simultaneously. There are TWO independent concepts:

### 1. **Conversation Context** (`isActive`)
- **What it controls**: Which strategy Mr. Fox is currently discussing with you in the AI chat
- **How to change**: Use the Mr. Fox dropdown in the right sidebar
- **Limitation**: Only ONE strategy can be selected for conversation at a time
- **UI Location**: Right sidebar AI chat panel

### 2. **Trading Execution** (`status`)
- **What it controls**: Which strategies are actively executing trades
- **How to change**: Use the Play/Pause/Stop buttons on the `/strategies` page  
- **Limitation**: Up to THREE strategies can be `active` simultaneously
- **UI Location**: Strategies page (`/strategies`)

## How to Activate Multiple Strategies

### Step 1: Navigate to Strategies Page
Click the "Strategies" icon (Layers) in the header to go to `/strategies`

### Step 2: Activate Strategies
On each strategy card, click the **"Start"** button to activate it for trading execution.

You can have:
- Strategy 1: **Active** (executing trades)
- Strategy 2: **Active** (executing trades)  
- Strategy 3: **Paused** (not trading)

All at the same time!

### Step 3: Select Conversation Context (Optional)
If you want to discuss a specific strategy with Mr. Fox:
1. Open the AI chat in the right sidebar
2. Use the "Mr. Fox" dropdown to select which strategy to discuss
3. This does NOT affect trading execution - it only changes conversation context

## Common Confusion

**❌ WRONG**: "I can only activate one strategy because the Mr. Fox dropdown only lets me select one"
- The dropdown is for CONVERSATION CONTEXT only
- It doesn't control which strategies are trading

**✅ CORRECT**: "I activate multiple strategies on the /strategies page using Start buttons"
- Each strategy can be independently started/paused/stopped
- Trading execution is controlled from the Strategies page
- Conversation context is controlled from the Mr. Fox dropdown

## Technical Details

### Database Fields
- `status`: `'active'` | `'paused'` | `'stopped'` (controls trading)
- `isActive`: `1` | `0` (controls which strategy Mr. Fox discusses)

### API Endpoints
- `POST /api/trading-modes/:id/status` - Toggle trading execution (supports multiple active)
- `POST /api/trading-modes/:id/activate` - Set conversation context (single selection)

### Multi-Strategy Coordination
The Portfolio Manager automatically:
- Detects conflicts between strategies (opposing positions)
- Tracks aggregate exposure across all active strategies
- Enforces portfolio-level safety limits
- Prevents over-concentration in single assets
