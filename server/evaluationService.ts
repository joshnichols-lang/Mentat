import { db } from "../db";
import { trades, tradeEvaluations, strategyLearnings, marketRegimeSnapshots } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { makeAIRequest } from "./aiRouter";
import type { Trade, InsertTradeEvaluation, InsertStrategyLearning } from "../db/schema";

interface TradeEvaluationMetrics {
  pnlVsExpectancy: number | null;
  stopLossAdherence: number;
  riskRewardRatio: number | null;
  entryQuality: number;
  exitQuality: number;
  slippagePercent: number;
  holdingPeriodMinutes: number;
}

interface AIEvaluationResponse {
  summary: string;
  lessonsLearned: {
    entry: string[];
    exit: string[];
    sizing: string[];
    timing: string[];
    riskManagement: string[];
  };
  anomalies: Array<{
    type: string;
    severity: "low" | "medium" | "high";
    description: string;
  }>;
  suggestedLearnings: Array<{
    category: string;
    subcategory: string;
    insight: string;
    confidenceScore: number;
  }>;
}

/**
 * Evaluate a completed trade and generate insights
 */
export async function evaluateCompletedTrade(
  userId: string,
  tradeId: string
): Promise<void> {
  console.log(`[Evaluation] Starting evaluation for trade ${tradeId}`);

  // Fetch the trade
  const [trade] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .limit(1);

  if (!trade) {
    console.error(`[Evaluation] Trade ${tradeId} not found`);
    return;
  }

  if (trade.status !== "closed") {
    console.log(`[Evaluation] Trade ${tradeId} is not closed (status: ${trade.status}), skipping`);
    return;
  }

  // Check if already evaluated
  const existing = await db
    .select()
    .from(tradeEvaluations)
    .where(and(eq(tradeEvaluations.tradeId, tradeId), eq(tradeEvaluations.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Evaluation] Trade ${tradeId} already evaluated, skipping`);
    return;
  }

  // Compute quantitative metrics
  const metrics = computeTradeMetrics(trade);

  // Get market context at trade time
  const marketContext = await getMarketContextAtTime(userId, trade.entryTimestamp);

  // Generate AI-powered qualitative analysis
  const aiAnalysis = await generateAIEvaluation(userId, trade, metrics, marketContext);

  // Store evaluation
  const evaluation: InsertTradeEvaluation = {
    tradeId: trade.id,
    pnlVsExpectancy: metrics.pnlVsExpectancy,
    stopLossAdherence: metrics.stopLossAdherence,
    riskRewardRatio: metrics.riskRewardRatio,
    entryQuality: metrics.entryQuality.toString(),
    exitQuality: metrics.exitQuality.toString(),
    slippagePercent: metrics.slippagePercent.toString(),
    holdingPeriodMinutes: metrics.holdingPeriodMinutes,
    marketRegime: marketContext.regime,
    volumeAtEntry: marketContext.volume24h,
    volatilityAtEntry: marketContext.volatility.toString(),
    aiSummary: aiAnalysis.summary,
    lessonsLearned: aiAnalysis.lessonsLearned,
    anomalyFlags: aiAnalysis.anomalies,
  };

  await db.insert(tradeEvaluations).values({
    ...evaluation,
    userId,
  });

  console.log(`[Evaluation] Stored evaluation for trade ${tradeId}`);

  // Extract and store strategy learnings
  await extractStrategyLearnings(userId, trade, aiAnalysis);

  console.log(`[Evaluation] Completed evaluation for trade ${tradeId}`);
}

/**
 * Compute quantitative metrics for a trade
 */
function computeTradeMetrics(trade: Trade): TradeEvaluationMetrics {
  const entryPrice = parseFloat(trade.entryPrice);
  const exitPrice = trade.exitPrice ? parseFloat(trade.exitPrice) : null;
  const size = parseFloat(trade.size);
  const pnl = trade.pnl ? parseFloat(trade.pnl) : null;

  // PnL vs Expectancy (compare actual to expected based on R:R)
  let pnlVsExpectancy = null;
  if (pnl !== null && exitPrice !== null) {
    const priceMove = Math.abs(exitPrice - entryPrice);
    const expectedPnl = priceMove * size * (trade.side === "long" ? 1 : -1);
    pnlVsExpectancy = expectedPnl !== 0 ? (pnl / expectedPnl) * 100 : null;
  }

  // Stop loss adherence (assume followed if trade closed with PnL)
  const stopLossAdherence = 1; // Default to followed - would need order history to verify

  // Risk:Reward ratio (if we have exit data)
  let riskRewardRatio = null;
  if (pnl !== null && exitPrice !== null) {
    const riskAmount = Math.abs(entryPrice - exitPrice) * size * 0.5; // Estimate
    const rewardAmount = Math.abs(pnl);
    riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : null;
  }

  // Entry quality (100 = perfect, lower if slippage)
  const entryQuality = 95; // High by default for limit orders

  // Exit quality (based on timing - placeholder)
  const exitQuality = pnl && pnl > 0 ? 85 : 60;

  // Slippage (minimal for limit orders)
  const slippagePercent = 0.1;

  // Holding period
  let holdingPeriodMinutes = 0;
  if (trade.exitTimestamp && trade.entryTimestamp) {
    const diffMs = trade.exitTimestamp.getTime() - trade.entryTimestamp.getTime();
    holdingPeriodMinutes = Math.floor(diffMs / 60000);
  }

  return {
    pnlVsExpectancy,
    stopLossAdherence,
    riskRewardRatio,
    entryQuality,
    exitQuality,
    slippagePercent,
    holdingPeriodMinutes,
  };
}

/**
 * Get market context at the time of trade entry
 */
async function getMarketContextAtTime(
  userId: string,
  timestamp: Date
): Promise<{ regime: string; volume24h: string; volatility: number }> {
  // Find the closest market regime snapshot
  const [snapshot] = await db
    .select()
    .from(marketRegimeSnapshots)
    .where(eq(marketRegimeSnapshots.userId, userId))
    .orderBy(desc(marketRegimeSnapshots.timestamp))
    .limit(1);

  if (snapshot) {
    return {
      regime: snapshot.regime,
      volume24h: "0", // Would need to fetch from historical data
      volatility: snapshot.overallVolatility ? parseFloat(snapshot.overallVolatility) : 5.0,
    };
  }

  // Default context if no snapshot found
  return {
    regime: "neutral",
    volume24h: "0",
    volatility: 5.0,
  };
}

/**
 * Generate AI-powered qualitative evaluation
 */
async function generateAIEvaluation(
  userId: string,
  trade: Trade,
  metrics: TradeEvaluationMetrics,
  marketContext: any
): Promise<AIEvaluationResponse> {
  const prompt = `Analyze this completed trade and provide insights on what worked and what didn't:

TRADE DETAILS:
Symbol: ${trade.symbol}
Side: ${trade.side} (${trade.type})
Entry: $${trade.entryPrice}
Exit: $${trade.exitPrice || "N/A"}
Size: ${trade.size}
Leverage: ${trade.leverage}x
PnL: ${trade.pnl || "N/A"}
Holding Period: ${metrics.holdingPeriodMinutes} minutes
Market Regime: ${marketContext.regime}
Volatility: ${marketContext.volatility}%

PERFORMANCE METRICS:
Entry Quality: ${metrics.entryQuality}/100
Exit Quality: ${metrics.exitQuality}/100
Risk:Reward Ratio: ${metrics.riskRewardRatio?.toFixed(2) || "N/A"}
Stop Loss Adherence: ${metrics.stopLossAdherence === 1 ? "Yes" : "No"}

ORIGINAL TRADE THESIS:
${trade.aiPrompt || "No thesis recorded"}

Provide a structured evaluation in JSON format:
{
  "summary": "Brief 2-3 sentence summary of what happened and key takeaways",
  "lessonsLearned": {
    "entry": ["lesson 1", "lesson 2"],
    "exit": ["lesson 1"],
    "sizing": ["lesson 1"],
    "timing": ["lesson 1"],
    "riskManagement": ["lesson 1"]
  },
  "anomalies": [
    { "type": "premature_exit", "severity": "medium", "description": "..." }
  ],
  "suggestedLearnings": [
    {
      "category": "execution",
      "subcategory": "limit_orders",
      "insight": "Key lesson learned that can be applied to future trades",
      "confidenceScore": 75
    }
  ]
}`;

  try {
    const response = await makeAIRequest(userId, {
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      summary: parsed.summary || "Trade completed",
      lessonsLearned: parsed.lessonsLearned || {
        entry: [],
        exit: [],
        sizing: [],
        timing: [],
        riskManagement: [],
      },
      anomalies: parsed.anomalies || [],
      suggestedLearnings: parsed.suggestedLearnings || [],
    };
  } catch (error) {
    console.error("[Evaluation] AI analysis failed:", error);
    return {
      summary: `Trade ${trade.pnl && parseFloat(trade.pnl) > 0 ? "profit" : "loss"} of ${trade.pnl || "0"}`,
      lessonsLearned: { entry: [], exit: [], sizing: [], timing: [], riskManagement: [] },
      anomalies: [],
      suggestedLearnings: [],
    };
  }
}

/**
 * Extract and store strategy learnings from evaluation
 */
async function extractStrategyLearnings(
  userId: string,
  trade: Trade,
  aiAnalysis: AIEvaluationResponse
): Promise<void> {
  for (const learning of aiAnalysis.suggestedLearnings) {
    // Check if similar learning already exists
    const existing = await db
      .select()
      .from(strategyLearnings)
      .where(
        and(
          eq(strategyLearnings.userId, userId),
          eq(strategyLearnings.category, learning.category),
          eq(strategyLearnings.insight, learning.insight)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing learning with new evidence
      const current = existing[0];
      const newSampleSize = (current.sampleSize || 1) + 1;
      const tradePnl = trade.pnl ? parseFloat(trade.pnl) : 0;
      const currentAvgPnl = current.avgPnlWhenApplied ? parseFloat(current.avgPnlWhenApplied) : 0;
      const newAvgPnl = (currentAvgPnl * (newSampleSize - 1) + tradePnl) / newSampleSize;

      await db
        .update(strategyLearnings)
        .set({
          sampleSize: newSampleSize,
          avgPnlWhenApplied: newAvgPnl.toString(),
          confidenceScore: Math.min(100, (learning.confidenceScore + 10)).toString(),
          updatedAt: new Date(),
        })
        .where(eq(strategyLearnings.id, current.id));
    } else {
      // Create new learning
      const newLearning: InsertStrategyLearning = {
        category: learning.category,
        subcategory: learning.subcategory,
        insight: learning.insight,
        supportingEvidence: [
          {
            tradeId: trade.id,
            pnl: trade.pnl,
            date: trade.exitTimestamp?.toISOString(),
          },
        ],
        confidenceScore: learning.confidenceScore.toString(),
        avgPnlWhenApplied: trade.pnl || "0",
        sampleSize: 1,
        successRate: trade.pnl && parseFloat(trade.pnl) > 0 ? "100" : "0",
        decayWeight: "1.0",
      };

      await db.insert(strategyLearnings).values({
        ...newLearning,
        userId,
      });
    }
  }
}

/**
 * Get recent learnings for AI context (with decay-based weighting)
 */
export async function getRecentLearnings(
  userId: string,
  marketRegime?: string,
  limit: number = 10
): Promise<Array<{ insight: string; confidence: number; category: string }>> {
  const halfLifeDays = 30; // Learnings decay with 30-day half-life

  // Build conditions
  const conditions = [
    eq(strategyLearnings.userId, userId),
    eq(strategyLearnings.isActive, 1),
  ];

  // Add regime filter if specified
  if (marketRegime) {
    conditions.push(eq(strategyLearnings.marketRegime, marketRegime));
  }

  const learnings = await db
    .select()
    .from(strategyLearnings)
    .where(and(...conditions))
    .orderBy(desc(strategyLearnings.updatedAt))
    .limit(limit * 2);

  // Apply decay weighting
  const now = new Date();
  const weighted = learnings.map((l: any) => {
    const daysSinceUpdate =
      (now.getTime() - l.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-daysSinceUpdate / halfLifeDays);
    const baseWeight = parseFloat(l.decayWeight || "1.0");
    const finalWeight = baseWeight * decay;

    return {
      insight: l.insight,
      confidence: parseFloat(l.confidenceScore || "50") * finalWeight,
      category: l.category,
      weight: finalWeight,
    };
  });

  // Sort by weighted confidence and take top N
  return weighted
    .sort((a: any, b: any) => b.confidence - a.confidence)
    .slice(0, limit)
    .map(({ insight, confidence, category }: any) => ({ insight, confidence, category }));
}
