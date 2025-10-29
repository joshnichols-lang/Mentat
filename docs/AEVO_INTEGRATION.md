# Aevo Integration Technical Specification

## Overview
Aevo is the largest decentralized onchain options protocol with $15B+ monthly volume and 28% DeFi options market share. This document outlines the technical integration approach.

## API Endpoints

### Base URLs
- **Mainnet REST**: https://api.aevo.xyz
- **Mainnet WebSocket**: wss://ws.aevo.xyz
- **Testnet REST**: https://api-testnet.aevo.xyz
- **Testnet WebSocket**: wss://ws-testnet.aevo.xyz

## Authentication

### REST API - HMAC SHA256
```typescript
// Message format: "API_KEY,timestamp_ns,METHOD,PATH,BODY"
const timestamp = Date.now() * 1_000_000; // nanoseconds
const message = `${apiKey},${timestamp},${method},${path},${body}`;
const signature = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');

headers = {
  'AEVO-TIMESTAMP': timestamp.toString(),
  'AEVO-SIGNATURE': signature,
  'AEVO-KEY': apiKey
};
```

### Order Signing - EIP-712
Orders must be signed using EIP-712 typed data:
```typescript
const domain = {
  name: 'Aevo Mainnet',  // 'Aevo Testnet' for testnet
  version: '1',
  chainId: 1  // 11155111 for Sepolia testnet
};

const types = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'isBuy', type: 'bool' },
    { name: 'limitPrice', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
    { name: 'instrument', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' }
  ]
};
```

## Key Endpoints

### Market Data
- **GET /markets** - Available instruments (options, perpetuals)
  - Params: `asset` (ETH, BTC), `instrument_type` (OPTION, PERPETUAL)
  - Returns: instrument_id, strike, expiry, mark_price, greeks
  
- **GET /orderbook** - Order book snapshot
  - Params: `instrument_name` (e.g., ETH-31MAR23-2000-C)
  - Returns: bids/asks arrays

### Account Data
- **GET /account** - Account balance, positions, margin
- **GET /portfolio** - Portfolio Greeks aggregated by asset
  - Returns: delta, gamma, theta, vega, rho per asset

### Order Management
- **POST /orders** - Create order
  - Requires: EIP-712 signature + API auth
  - Params: instrument, maker, is_buy, amount, limit_price, salt, timestamp, signature
  
- **POST /orders/{order_id}** - Edit order (re-sign with new params)
- **DELETE /orders/{order_id}** - Cancel order
- **GET /orders** - List open orders
- **GET /order-history** - Historical orders

## Data Format

### Decimals
All prices and amounts use **6 decimals**:
- $1800.50 → `"1800500000"`
- 2.5 contracts → `"2500000"`

### Instrument Naming
Options: `{ASSET}-{EXPIRY}-{STRIKE}-{C|P}`
- Example: `ETH-31MAR23-2000-C` (ETH Call, strike $2000, expires March 31, 2023)

Perpetuals: `{ASSET}:PERPETUAL`
- Example: `ETH:PERPETUAL`

## Greeks Structure
```typescript
interface Greeks {
  delta: string;   // Option price sensitivity to underlying price
  gamma: string;   // Delta change rate
  theta: string;   // Time decay
  vega: string;    // Volatility sensitivity
  rho: string;     // Interest rate sensitivity
}
```

## Multi-Leg Strategies
For strategies like Straddle (buy call + put at same strike):
1. Create two separate orders via POST /orders
2. Both orders share same expiry/strike but different option_type
3. Execute atomically or handle partial fills

## WebSocket Subscriptions
- **ticker:{ASSET}:{TYPE}** - Real-time price updates
- **index:{ASSET}** - Index price
- **orderbook:{INSTRUMENT_NAME}** - L2 order book
- **fills** - Private: user's trade fills
- **orders** - Private: user's order updates

## Settlement
- USDC on Aevo L2 (OP Stack, Ethereum rollup)
- Margin requirements calculated using portfolio Greeks
- Auto-liquidation at maintenance margin threshold

## Integration Architecture

### Backend Components
1. **server/aevo/client.ts** - REST API client
   - Account management
   - Market data fetching
   - Order CRUD operations
   - EIP-712 signing

2. **server/aevo/websocket.ts** - Real-time data service
   - Ticker subscriptions
   - Order book updates
   - Fill notifications

3. **server/routes.ts** - API routes
   - /api/aevo/markets
   - /api/aevo/orders
   - /api/aevo/positions
   - /api/aevo/greeks

### Frontend Components
1. **OptionsChart.tsx** - Chart with strategy overlays
   - Breakeven points
   - Profit/loss zones
   - Strike price visualization

2. **OptionsStrategyBuilder.tsx** - Hybrid UI
   - PRO mode: Manual strike/expiry selection
   - SIMPLE mode: One-click strategies (Straddle, Strap, Strip)

3. **OptionsPositionsGrid.tsx** - Live positions
   - P&L tracking
   - Greeks display
   - Days to expiry
   - Quick close buttons

4. **AIStrategyRecommendations.tsx** - Mr. Fox AI
   - Volatility regime analysis
   - Strategy suggestions
   - Risk assessment

## Strategy Definitions

### Straddle
- Buy 1 ATM Call + Buy 1 ATM Put (same strike/expiry)
- Profit from high volatility in either direction
- Max loss: Total premium paid
- Breakeven: Strike ± Total Premium

### Strap (Bullish Volatility)
- Buy 2 ATM Calls + Buy 1 ATM Put
- Profit from volatility with bullish bias
- Higher upside potential vs Straddle

### Strip (Bearish Volatility)
- Buy 1 ATM Call + Buy 2 ATM Puts
- Profit from volatility with bearish bias
- Higher downside potential vs Straddle

## Chart Visualization Logic

### Breakeven Calculation
```typescript
// Straddle breakeven points
const callPremium = parseFloat(callOption.mark_price);
const putPremium = parseFloat(putOption.mark_price);
const totalPremium = callPremium + putPremium;
const strike = parseFloat(callOption.strike);

const upperBreakeven = strike + totalPremium;
const lowerBreakeven = strike - totalPremium;
```

### P&L Zones
- **Green zones**: Price above upper BE or below lower BE (profit)
- **Red zone**: Price between breakevens (loss)
- **Max loss line**: Horizontal at -totalPremium
- **Strike marker**: Vertical line at strike price

## Security Considerations
1. Store API keys encrypted in database (AES-256-GCM)
2. Generate infinite-expiry signing keys (don't rely on 1-week UI keys)
3. Validate all user inputs before order submission
4. Implement rate limiting (Aevo has per-account limits)
5. Use testnet for all development/testing

## References
- API Docs: https://api-docs.aevo.xyz/
- Python SDK: https://github.com/aevoxyz/aevo-sdk
- Unofficial TypeScript SDK: https://github.com/kelreel/aevo-js-sdk
- Aevo Help Center: https://help.aevo.xyz/
