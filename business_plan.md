# 1fox Business Plan - Tiered Pricing Model

## Executive Summary
1fox is a multi-tenant SaaS platform offering AI-powered cryptocurrency trading on Hyperliquid exchange. The platform uses a tiered pricing model based on autonomous monitoring frequency, allowing users to choose their level of automation.

---

## Pricing Tiers

| Tier | Price/Month | Monitoring Frequency | Use Case |
|------|-------------|---------------------|----------|
| **Manual** | $20 | No monitoring | Users manually prompt AI for trade ideas |
| **Casual** | $25 | 1 hour | Swing traders, low-frequency strategies |
| **Active** | $30 | 30 minutes | Day traders, medium-frequency strategies |
| **Pro** | $50 | 5 minutes | Active scalpers, high-frequency trading |
| **Elite** | $100 | 1 minute | Professional traders, ultra-high-frequency |

---

## Unit Economics Analysis

### AI Cost Structure (per monitoring cycle)

**Assumptions:**
- AI model: Grok-4-Fast-Reasoning (primary), fallback to GPT-4o
- Average prompt: ~8,000 tokens (market data + strategy context + system prompt)
- Average completion: ~1,500 tokens (trade thesis + actions)
- Total per cycle: ~9,500 tokens

**Pricing:**
- Grok-4-Fast: $5/M input, $15/M output
- Cost per cycle: (8,000 × $5/M) + (1,500 × $15/M) = $0.0625 per AI call

### Monthly AI Costs by Tier

| Tier | Frequency | Cycles/Month | AI Cost/Month | Gross Margin |
|------|-----------|--------------|---------------|--------------|
| Manual | On-demand | ~30 prompts | $1.88 | **$18.12 (90.6%)** |
| Casual | 1 hour | 720 | $45.00 | **-$20.00 (-80%)** ❌ |
| Active | 30 min | 1,440 | $90.00 | **-$60.00 (-200%)** ❌ |
| Pro | 5 min | 8,640 | $540.00 | **-$490.00 (-980%)** ❌ |
| Elite | 1 min | 43,200 | $2,700.00 | **-$2,600.00 (-2,600%)** ❌ |

**⚠️ CRITICAL PROBLEM: Current pricing model is economically unviable for automated tiers**

---

## Revised Pricing Strategy

### Option A: Cost-Based Pricing (Sustainable)

| Tier | AI Cost | Margin Target | **New Price** | Gross Margin |
|------|---------|---------------|---------------|--------------|
| Manual | $1.88 | 85% | **$20** ✅ | $18.12 (90.6%) |
| Casual | $45.00 | 50% | **$90** | $45.00 (50%) |
| Active | $90.00 | 50% | **$180** | $90.00 (50%) |
| Pro | $540.00 | 40% | **$900** | $360.00 (40%) |
| Elite | $2,700.00 | 30% | **$3,850** | $1,150.00 (30%) |

### Option B: Reduced Frequency + Smart Throttling (Balanced)

**Key Insight:** Most profitable trades don't require 1-minute monitoring. Implement smart throttling:

| Tier | Price | Actual Frequency | Smart Behavior | AI Cost | Margin |
|------|-------|------------------|----------------|---------|--------|
| Manual | $20 | On-demand | User-triggered only | $1.88 | **$18.12 (90.6%)** |
| Casual | $25 | 1 hour | Full monitoring | $45.00 | **-$20.00** ❌ |
| Active | $50 | 30 min | Skip cycles with low volatility | $45.00 | **$5.00 (10%)** |
| Pro | $100 | 5 min | Skip when no positions + low volatility | $90.00 | **$10.00 (10%)** |
| Elite | $250 | 1 min | Intelligent: only active during high volatility/open positions | $180.00 | **$70.00 (28%)** |

**Smart Throttling Rules:**
1. Skip monitoring when: No open positions + volatility < 2% + volume < 80% average
2. During low-activity hours (2-6 AM UTC), reduce frequency by 50%
3. Maximum AI calls per tier per month (hard cap):
   - Casual: 720 (current)
   - Active: 720 (reduced from 1,440)
   - Pro: 1,440 (reduced from 8,640)
   - Elite: 2,880 (reduced from 43,200)

### Option C: Hybrid Model (Recommended)

Combine pricing adjustments with smart features:

| Tier | Price | Base Frequency | Monthly Cap | AI Cost | Margin | Features |
|------|-------|----------------|-------------|---------|--------|----------|
| **Starter** | $30 | 1 hour | 720 calls | $45.00 | **-$15.00** | Manual + basic automation |
| **Trader** | $99 | 30 min | 1,440 calls | $90.00 | **$9.00 (9%)** | Smart throttling, advanced charts |
| **Pro** | $249 | 5 min | 2,880 calls | $180.00 | **$69.00 (28%)** | Priority AI, strategy backtesting |
| **Elite** | $499 | 1 min | 4,320 calls | $270.00 | **$229.00 (46%)** | Dedicated support, custom strategies |

---

## Revenue Projections (Option C - Hybrid Model)

### Conservative Scenario (12 months)

| Month | Starter | Trader | Pro | Elite | MRR | AI Costs | Net Margin | Cumulative |
|-------|---------|--------|-----|-------|-----|----------|------------|------------|
| 1 | 10 | 2 | 0 | 0 | $498 | $648 | -$150 | -$150 |
| 3 | 25 | 8 | 2 | 0 | $1,540 | $1,845 | -$305 | -$760 |
| 6 | 50 | 20 | 5 | 1 | $4,228 | $4,275 | -$47 | -$1,420 |
| 12 | 100 | 50 | 15 | 3 | $10,182 | $9,900 | **$282** | -$2,850 |

**Break-even:** Month 13 (~$11,000 MRR with 120 total customers)

### Moderate Scenario (12 months)

| Month | Starter | Trader | Pro | Elite | MRR | AI Costs | Net Margin | Cumulative |
|-------|---------|--------|-----|-------|-----|----------|------------|------------|
| 1 | 20 | 5 | 1 | 0 | $1,098 | $1,305 | -$207 | -$207 |
| 3 | 60 | 20 | 5 | 1 | $4,024 | $4,095 | -$71 | -$625 |
| 6 | 120 | 50 | 15 | 3 | $9,432 | $9,000 | **$432** | **$850** ✅ |
| 12 | 250 | 120 | 40 | 10 | $29,360 | $24,300 | **$5,060** | **$25,480** |

**Break-even:** Month 5 (~$8,500 MRR with 180 total customers)

### Aggressive Scenario (12 months)

| Month | Starter | Trader | Pro | Elite | MRR | AI Costs | Net Margin | Cumulative |
|-------|---------|--------|-----|-------|-----|----------|------------|------------|
| 1 | 50 | 15 | 3 | 1 | $2,694 | $3,015 | -$321 | -$321 |
| 3 | 150 | 60 | 15 | 3 | $11,127 | $10,890 | **$237** | **-$150** |
| 6 | 300 | 150 | 40 | 10 | $28,850 | $25,200 | **$3,650** | **$16,200** |
| 12 | 600 | 350 | 100 | 25 | $77,075 | $61,200 | **$15,875** | **$105,000** |

**Break-even:** Month 3 (~$11,000 MRR with 230 total customers)

---

## Additional Cost Structure

### Infrastructure Costs (Monthly)

| Item | Cost | Notes |
|------|------|-------|
| Replit Reserved VM (Production) | $25 | Always-on deployment |
| PostgreSQL (Neon) | $19 | Pro plan for production DB |
| Hyperliquid API | $0 | Free (exchange fees separate) |
| Domain + SSL | $2 | Custom domain |
| **Total Infrastructure** | **$46/month** | |

### Customer Acquisition Cost (CAC) Estimates

| Channel | CAC | Conversion Rate | Notes |
|---------|-----|-----------------|-------|
| Crypto Twitter | $50 | 2-3% | Organic + paid ads |
| YouTube Reviews | $75 | 3-5% | Sponsored content |
| Trading Discord Communities | $30 | 4-6% | Affiliate partnerships |
| Reddit (r/CryptoCurrency, r/algotrading) | $40 | 2-4% | Community engagement |
| **Blended CAC** | **$50** | **3%** | Weighted average |

### Customer Lifetime Value (LTV)

**Assumptions:**
- Average monthly churn: 10% (conservative for crypto SaaS)
- Average customer lifetime: 10 months

| Tier | Price | Gross Margin | LTV | LTV:CAC Ratio |
|------|-------|--------------|-----|---------------|
| Starter | $30 | -$15 | -$150 | **-3.0:1** ❌ |
| Trader | $99 | $9 | $90 | **1.8:1** ⚠️ |
| Pro | $249 | $69 | $690 | **13.8:1** ✅ |
| Elite | $499 | $229 | $2,290 | **45.8:1** ✅✅ |

**Key Insight:** Focus acquisition on Pro/Elite tiers. Consider Starter as a loss-leader for upsells.

---

## Go-to-Market Strategy

### Phase 1: MVP Launch (Months 1-3)
**Goal:** 50 paying customers, validate product-market fit

**Tactics:**
1. **Free Beta (2 weeks):** 100 users on Starter tier
2. **Launch Discount:** 50% off first 3 months (Pro/Elite only)
3. **Referral Program:** $50 credit for referrer + referee
4. **Content Marketing:** 
   - Blog: "How AI Trading Beats Human Psychology"
   - YouTube: Strategy tutorials with real P&L
   - Twitter: Daily AI trade thesis snippets

**Budget:** $5,000 (ads + influencer partnerships)
**Target:** 50 customers (30 Starter, 15 Trader, 4 Pro, 1 Elite)
**Expected MRR:** ~$2,000

### Phase 2: Growth (Months 4-9)
**Goal:** 300 paying customers, optimize unit economics

**Tactics:**
1. **Tier Migration:** Email campaigns to upgrade Starter → Trader → Pro
2. **Partner with Crypto Influencers:** Affiliate deals (20% commission)
3. **SEO Content:** Target keywords like "AI crypto trading bot," "Hyperliquid automation"
4. **Community Building:** Discord for Elite members with exclusive alpha

**Budget:** $15,000/month
**Target:** 300 customers (120 Starter, 120 Trader, 45 Pro, 15 Elite)
**Expected MRR:** ~$20,000

### Phase 3: Scale (Months 10-12)
**Goal:** 600+ customers, profitability

**Tactics:**
1. **Performance Marketing:** Facebook/Google ads targeting crypto traders
2. **Strategic Partnerships:** Integrate with portfolio trackers (Delta, CoinStats)
3. **White-Label Offering:** License to trading education platforms
4. **Advanced Features:** Multi-exchange support (Binance, Bybit) as premium add-ons

**Budget:** $30,000/month
**Target:** 600+ customers
**Expected MRR:** $60,000+

---

## Risk Analysis

### Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **AI Costs Exceed Revenue** | HIGH | CRITICAL | Implement smart throttling, raise prices for automated tiers |
| **Regulatory Crackdown** | MEDIUM | HIGH | Add disclaimers, ensure users control their own keys |
| **Hyperliquid API Changes** | MEDIUM | HIGH | Build abstraction layer, add multi-exchange support |
| **Customer Churn (>15%)** | MEDIUM | HIGH | Focus on customer success, prove ROI with P&L tracking |
| **Low Conversion from Free Trial** | HIGH | MEDIUM | Improve onboarding, show immediate value (paper trading mode) |

### Competitive Landscape

**Direct Competitors:**
- 3Commas, Cryptohopper (traditional bots, no AI reasoning)
- TradingView alerts (manual, not autonomous)
- Quantitative hedge funds (inaccessible to retail)

**Competitive Advantages:**
1. **AI Reasoning Transparency:** Show full thought process, not black box
2. **Newspaper Aesthetic:** Unique UX differentiator
3. **Hyperliquid Native:** First AI agent built specifically for HL
4. **Risk Management First:** Mandatory protective brackets vs. competitors' YOLO approach

---

## Key Performance Indicators (KPIs)

### Product Metrics
- **Monthly Active Users (MAU)**
- **Avg AI Calls per User per Tier**
- **Strategy Win Rate %**
- **Customer Sharpe Ratio** (aggregate)
- **Feature Adoption Rate** (% using autonomous vs. manual)

### Business Metrics
- **MRR & MRR Growth Rate**
- **Customer Acquisition Cost (CAC)**
- **Customer Lifetime Value (LTV)**
- **LTV:CAC Ratio** (target: >3:1)
- **Gross Margin %** (target: >40% blended)
- **Net Revenue Retention** (target: >100% via upsells)
- **Churn Rate** (target: <10%/month)

### Operational Metrics
- **AI Cost per Customer** (monitor for outliers)
- **API Uptime %** (Hyperliquid + AI providers)
- **P95 Latency** (trade execution speed)
- **Customer Support Tickets/User**

---

## Financial Summary (Year 1 - Moderate Scenario)

| Metric | Value |
|--------|-------|
| **Total Customers (End of Year 1)** | 400 |
| **Monthly Recurring Revenue (MRR)** | $29,360 |
| **Annual Recurring Revenue (ARR)** | $352,320 |
| **Total AI Costs (Year 1)** | $145,800 |
| **Total Infrastructure Costs** | $552 |
| **Customer Acquisition Costs** | $20,000 |
| **Total Operating Expenses** | $166,352 |
| **Net Revenue** | $185,968 |
| **Net Margin** | **52.8%** |

### 3-Year Projection (Moderate Growth)

| Year | Customers | ARR | Net Margin | Net Profit |
|------|-----------|-----|------------|------------|
| **Year 1** | 400 | $352,320 | 52.8% | $185,968 |
| **Year 2** | 1,200 | $1,056,960 | 58.2% | $615,150 |
| **Year 3** | 3,000 | $2,642,400 | 62.5% | $1,651,500 |

---

## Recommendations

### Immediate Actions (Week 1)

1. **Fix Pricing Model:**
   - Implement Option C (Hybrid Model): $30/$99/$249/$499
   - OR implement smart throttling with current prices (risky)

2. **Add Usage Caps:**
   - Hard limits on AI calls per tier to prevent cost overruns
   - Warning at 80% usage with upsell prompt

3. **Fix Platform AI Key:**
   - Verify XAI_API_KEY secret is valid
   - Add fallback to OpenAI if Grok fails

4. **Database Sync:**
   - Document that dev/published apps have separate databases
   - Create strategy import/export feature

### Short-term (Month 1)

1. **Launch Beta Program:**
   - 50 users, free for 2 weeks on Starter tier
   - Collect feedback on pricing sensitivity

2. **Build Analytics Dashboard:**
   - Track AI cost per customer
   - Monitor tier distribution
   - Alert on margin compression

3. **Create Onboarding Flow:**
   - Strategy templates (Momentum, Mean Reversion, Breakout)
   - Paper trading mode for new users
   - Tutorial videos showing ROI

### Medium-term (Months 2-6)

1. **Optimize AI Costs:**
   - Implement smart throttling (skip low-volatility periods)
   - Cache market data between cycles
   - Use cheaper models (GPT-4o-mini) for non-critical analysis

2. **Build Upsell Funnel:**
   - Email campaigns showing missed opportunities on lower tiers
   - In-app notifications when strategy would benefit from higher frequency

3. **Add Revenue Streams:**
   - Premium strategy marketplace (creators earn %)
   - White-label licensing to education platforms
   - API access for quant researchers ($199/month)

### Long-term (Months 7-12)

1. **Multi-Exchange Support:**
   - Binance, Bybit, OKX integrations
   - Premium tier: $699/month for cross-exchange arbitrage

2. **Enterprise Offering:**
   - Dedicated instances for hedge funds
   - Custom AI models trained on proprietary data
   - Pricing: $5,000-$20,000/month

3. **International Expansion:**
   - Localize to Chinese, Spanish, Korean
   - Partner with regional crypto communities

---

## Conclusion

**Current State:** The original pricing ($20-$100) is economically unviable for autonomous tiers due to AI costs exceeding revenue.

**Recommended Path:** Implement **Option C (Hybrid Model)** with smart throttling:
- Starter: $30 (loss leader for acquisition)
- Trader: $99 (low margin, upsell target)
- Pro: $249 (healthy 28% margin)
- Elite: $499 (highly profitable 46% margin)

**Success Criteria:**
- Month 6: Break-even with 180 customers
- Month 12: $30k MRR with 400 customers
- Year 2: $1M ARR with 1,200 customers

**Key Risk:** AI costs. Must implement smart throttling or raise prices to avoid burning cash on every customer.

**Next Step:** User research to validate willingness to pay $99+ for AI-powered trading automation. Alternative: Keep low prices but monetize through other means (trading signal subscriptions, strategy licensing, performance fees on profits).
