import { storage } from "./storage";
import { makeAIRequest } from "./aiRouter";
import type { UserTradeHistoryTrade } from "@shared/schema";

interface TradeAnalysisResult {
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWinSize: number;
  avgLossSize: number;
  avgHoldingPeriod: number;
  preferredAssets: string[];
  riskRewardRatio: number;
  insights: {
    strengths: string[];
    weaknesses: string[];
    patterns: string[];
    recommendations: string[];
  };
  styleFactors: {
    avgPositionSize: number;
    riskTolerance: "conservative" | "moderate" | "aggressive";
    tradingFrequency: "scalper" | "day_trader" | "swing_trader" | "position_trader";
    preferredSide: "long" | "short" | "balanced";
    avgLeverage: number;
  };
}

/**
 * Analyzes imported trade history and extracts trading style patterns using AI
 */
export async function analyzeTradeHistory(
  userId: string,
  importId: string
): Promise<void> {
  try {
    // Update status to analyzing
    await storage.updateTradeHistoryImport(userId, importId, {
      analysisStatus: "analyzing"
    });

    // Fetch all trades for this import
    const trades = await storage.getTradeHistoryTrades(userId, importId);
    
    if (trades.length === 0) {
      await storage.updateTradeHistoryImport(userId, importId, {
        analysisStatus: "failed",
        analysisResults: { error: "No trades to analyze" }
      });
      return;
    }

    // Calculate basic metrics
    const basicMetrics = calculateBasicMetrics(trades);
    
    // Prepare data for AI analysis
    const aiPrompt = buildAnalysisPrompt(trades, basicMetrics);
    
    // Call AI to extract deeper insights
    const aiResponse = await makeAIRequest(
      userId,
      {
        messages: [
          {
            role: "system",
            content: "You are a professional trading analyst specializing in identifying trading patterns and style characteristics. Analyze the provided trade history and extract actionable insights. Respond with valid JSON only."
          },
          {
            role: "user",
            content: aiPrompt
          }
        ],
        model: "sonar" // Use Perplexity for structured analysis
      },
      "perplexity"
    );

    const aiInsights = JSON.parse(aiResponse.content);
    
    // Combine calculated metrics with AI insights
    const analysisResult: TradeAnalysisResult = {
      ...basicMetrics,
      insights: aiInsights.insights || {
        strengths: [],
        weaknesses: [],
        patterns: [],
        recommendations: []
      },
      styleFactors: {
        ...basicMetrics.styleFactors,
        riskTolerance: aiInsights.riskTolerance || basicMetrics.styleFactors.riskTolerance,
        tradingFrequency: aiInsights.tradingFrequency || basicMetrics.styleFactors.tradingFrequency
      }
    };

    // Store analysis results
    await storage.updateTradeHistoryImport(userId, importId, {
      analysisStatus: "completed",
      analysisResults: analysisResult
    });

    // Create or update trade style profile
    await createOrUpdateStyleProfile(userId, importId, analysisResult);

    console.log(`[TradeHistoryAnalysis] Completed analysis for import ${importId} (${trades.length} trades)`);
  } catch (error: any) {
    console.error(`[TradeHistoryAnalysis] Failed to analyze import ${importId}:`, error);
    await storage.updateTradeHistoryImport(userId, importId, {
      analysisStatus: "failed",
      analysisResults: { 
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Calculate basic trading metrics from trade history
 */
function calculateBasicMetrics(trades: UserTradeHistoryTrade[]): Omit<TradeAnalysisResult, 'insights'> {
  // Filter out open trades (those without exit data)
  const closedTrades = trades.filter(t => t.exitPrice && t.pnl);
  
  // Separate winners and losers
  const winners = closedTrades.filter(t => parseFloat(t.pnl!) > 0);
  const losers = closedTrades.filter(t => parseFloat(t.pnl!) <= 0);
  
  // Calculate metrics
  const totalPnl = closedTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);
  const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
  
  const avgWinSize = winners.length > 0 
    ? winners.reduce((sum, t) => sum + parseFloat(t.pnl!), 0) / winners.length 
    : 0;
  
  const avgLossSize = losers.length > 0 
    ? Math.abs(losers.reduce((sum, t) => sum + parseFloat(t.pnl!), 0) / losers.length)
    : 0;
  
  const riskRewardRatio = avgLossSize > 0 ? avgWinSize / avgLossSize : 0;
  
  // Calculate holding periods
  const holdingPeriods = closedTrades
    .filter(t => t.exitTimestamp)
    .map(t => {
      const entry = new Date(t.entryTimestamp).getTime();
      const exit = new Date(t.exitTimestamp!).getTime();
      return (exit - entry) / (1000 * 60); // minutes
    });
  
  const avgHoldingPeriod = holdingPeriods.length > 0
    ? holdingPeriods.reduce((sum, p) => sum + p, 0) / holdingPeriods.length
    : 0;
  
  // Identify preferred assets (top 5 by frequency)
  const assetCounts: Record<string, number> = {};
  trades.forEach(t => {
    assetCounts[t.symbol] = (assetCounts[t.symbol] || 0) + 1;
  });
  
  const preferredAssets = Object.entries(assetCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symbol]) => symbol);
  
  // Calculate style factors
  const avgPositionSize = trades.reduce((sum, t) => sum + parseFloat(t.size), 0) / trades.length;
  const avgLeverage = trades.reduce((sum, t) => sum + (t.leverage || 1), 0) / trades.length;
  
  // Determine side preference
  const longTrades = trades.filter(t => t.side === "long").length;
  const shortTrades = trades.filter(t => t.side === "short").length;
  const preferredSide: "long" | "short" | "balanced" = 
    longTrades > shortTrades * 1.5 ? "long" :
    shortTrades > longTrades * 1.5 ? "short" :
    "balanced";
  
  // Determine risk tolerance based on leverage and position sizing
  const riskTolerance: "conservative" | "moderate" | "aggressive" =
    avgLeverage >= 5 ? "aggressive" :
    avgLeverage >= 3 ? "moderate" :
    "conservative";
  
  // Determine trading frequency based on avg holding period
  const tradingFrequency: "scalper" | "day_trader" | "swing_trader" | "position_trader" =
    avgHoldingPeriod < 60 ? "scalper" :
    avgHoldingPeriod < 1440 ? "day_trader" :
    avgHoldingPeriod < 10080 ? "swing_trader" :
    "position_trader";
  
  return {
    winRate,
    avgPnl,
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    avgWinSize,
    avgLossSize,
    avgHoldingPeriod,
    preferredAssets,
    riskRewardRatio,
    styleFactors: {
      avgPositionSize,
      riskTolerance,
      tradingFrequency,
      preferredSide,
      avgLeverage
    }
  };
}

/**
 * Build AI analysis prompt from trade data
 */
function buildAnalysisPrompt(trades: UserTradeHistoryTrade[], metrics: any): string {
  const closedTrades = trades.filter(t => t.exitPrice && t.pnl);
  
  // Sample trades (max 50 for token efficiency)
  const sampleTrades = closedTrades.slice(0, 50).map(t => ({
    symbol: t.symbol,
    side: t.side,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    pnl: t.pnl,
    pnlPercent: t.pnlPercent,
    holdingPeriod: t.holdingPeriodMinutes,
    leverage: t.leverage
  }));
  
  return `Analyze this trading history and identify key patterns, strengths, and areas for improvement.

TRADE HISTORY SUMMARY:
- Total trades: ${metrics.totalTrades}
- Win rate: ${metrics.winRate.toFixed(2)}%
- Average PnL: $${metrics.avgPnl.toFixed(2)}
- Risk/Reward ratio: ${metrics.riskRewardRatio.toFixed(2)}
- Average holding period: ${metrics.avgHoldingPeriod.toFixed(0)} minutes
- Preferred assets: ${metrics.preferredAssets.join(", ")}
- Average leverage: ${metrics.styleFactors.avgLeverage.toFixed(1)}x

SAMPLE TRADES (first 50):
${JSON.stringify(sampleTrades, null, 2)}

Please analyze and provide insights in the following JSON format:
{
  "riskTolerance": "conservative" | "moderate" | "aggressive",
  "tradingFrequency": "scalper" | "day_trader" | "swing_trader" | "position_trader",
  "insights": {
    "strengths": ["list of 3-5 trading strengths"],
    "weaknesses": ["list of 3-5 areas needing improvement"],
    "patterns": ["list of 3-5 notable patterns observed"],
    "recommendations": ["list of 3-5 actionable recommendations"]
  }
}

Focus on:
1. Risk management effectiveness
2. Entry/exit timing patterns
3. Asset selection rationale
4. Position sizing discipline
5. Consistency across market conditions`;
}

/**
 * Create or update trade style profile based on analysis
 */
async function createOrUpdateStyleProfile(
  userId: string,
  importId: string,
  analysis: TradeAnalysisResult
): Promise<void> {
  // Check if there's an existing active profile
  const existingProfile = await storage.getActiveTradeStyleProfile(userId);
  
  // Prepare asset analysis data
  const preferredAssets = analysis.preferredAssets.map(symbol => ({
    symbol,
    frequency: 0, // Would need to calculate from trades
    winRate: 0    // Would need to calculate from trades
  }));

  // Prepare improvement suggestions from recommendations
  const improvementSuggestions = analysis.insights.recommendations.map((rec, idx) => ({
    category: "general",
    suggestion: rec,
    priority: idx < 2 ? "high" : "medium"
  }));

  if (existingProfile) {
    // Update existing profile (blend new insights with existing)
    await storage.updateTradeStyleProfile(userId, existingProfile.id, {
      importId,
      avgPositionSize: analysis.styleFactors.avgPositionSize.toString(),
      avgLeverage: analysis.styleFactors.avgLeverage.toString(),
      avgHoldingPeriodMinutes: Math.round(analysis.avgHoldingPeriod),
      preferredAssets,
      riskTolerance: analysis.styleFactors.riskTolerance,
      winRate: analysis.winRate.toFixed(6),
      avgRiskRewardRatio: analysis.riskRewardRatio.toFixed(6),
      strengthsAnalysis: analysis.insights.strengths.join("\n\n"),
      weaknessesAnalysis: analysis.insights.weaknesses.join("\n\n"),
      improvementSuggestions,
      confidenceScore: calculateConfidenceScore(analysis).toFixed(6),
      sampleSize: analysis.totalTrades
    });
  } else {
    // Create new profile
    await storage.createTradeStyleProfile(userId, {
      importId,
      avgPositionSize: analysis.styleFactors.avgPositionSize.toString(),
      avgLeverage: analysis.styleFactors.avgLeverage.toString(),
      avgHoldingPeriodMinutes: Math.round(analysis.avgHoldingPeriod),
      preferredAssets,
      riskTolerance: analysis.styleFactors.riskTolerance,
      winRate: analysis.winRate.toFixed(6),
      avgRiskRewardRatio: analysis.riskRewardRatio.toFixed(6),
      strengthsAnalysis: analysis.insights.strengths.join("\n\n"),
      weaknessesAnalysis: analysis.insights.weaknesses.join("\n\n"),
      improvementSuggestions,
      confidenceScore: calculateConfidenceScore(analysis).toFixed(6),
      sampleSize: analysis.totalTrades,
      isActive: 1
    });
  }
}

/**
 * Calculate confidence score based on trade volume and consistency
 */
function calculateConfidenceScore(analysis: TradeAnalysisResult): number {
  let score = 0;
  
  // More trades = higher confidence (max 40 points)
  const tradeScore = Math.min(analysis.totalTrades / 100, 1) * 40;
  score += tradeScore;
  
  // Win rate consistency (max 30 points)
  const winRateScore = analysis.winRate > 40 && analysis.winRate < 70 ? 30 : 
                       analysis.winRate > 30 && analysis.winRate < 80 ? 20 : 10;
  score += winRateScore;
  
  // Risk/reward ratio (max 30 points)
  const rrScore = analysis.riskRewardRatio > 1.5 ? 30 :
                  analysis.riskRewardRatio > 1.0 ? 20 :
                  analysis.riskRewardRatio > 0.5 ? 10 : 5;
  score += rrScore;
  
  return Math.min(score, 100);
}
