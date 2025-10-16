import { storage } from "./storage";
import { getHyperliquidClient } from "./hyperliquid/client";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai",
});

interface MonitoringAnalysis {
  summary: string;
  positionAnalysis: Array<{
    symbol: string;
    currentPrice: number;
    pnlPercent: number;
    assessment: string;
    recommendation: string;
  }>;
  marketContext: string;
  alertLevel: "info" | "warning" | "critical";
  suggestions: string[];
}

async function analyzePositions(): Promise<void> {
  try {
    console.log("[Monitoring] Starting automated position analysis...");
    
    const hyperliquidClient = getHyperliquidClient();
    if (!hyperliquidClient) {
      console.log("[Monitoring] Hyperliquid client not initialized");
      return;
    }
    
    // Get actual positions from Hyperliquid API
    const hyperliquidPositions = await hyperliquidClient.getPositions();
    
    if (!hyperliquidPositions || hyperliquidPositions.length === 0) {
      console.log("[Monitoring] No positions to analyze");
      return;
    }

    console.log(`[Monitoring] Found ${hyperliquidPositions.length} positions to analyze`);

    const allMarketData = await hyperliquidClient.getMarketData();
    const marketDataMap = new Map(allMarketData.map(m => [m.symbol, m.price]));
    
    const positions = hyperliquidPositions.map(pos => {
      const positionValue = parseFloat(pos.positionValue);
      const unrealizedPnl = parseFloat(pos.unrealizedPnl);
      const pnlPercent = positionValue !== 0 ? (unrealizedPnl / positionValue) * 100 : 0;
      
      return {
        symbol: pos.coin,
        side: parseFloat(pos.szi) > 0 ? 'long' : 'short',
        size: Math.abs(parseFloat(pos.szi)),
        entryPrice: parseFloat(pos.entryPx),
        leverage: pos.leverage.value,
        currentPrice: parseFloat(marketDataMap.get(pos.coin) || pos.entryPx),
        pnlPercent: pnlPercent,
      };
    });
    
    const marketData = positions.map(pos => ({
      symbol: pos.symbol,
      currentPrice: pos.currentPrice,
    }));

    const prompt = `You are Mr. Fox, an AI trading analyst. Analyze the current trading positions:

POSITIONS:
${positions.map((pos, i) => `
- ${pos.symbol}: ${pos.side.toUpperCase()} ${pos.size} @ $${pos.entryPrice} (${pos.leverage}x leverage)
  Current Price: $${marketData[i].currentPrice}
  P&L: ${pos.pnlPercent}%
`).join('\n')}

Provide a structured analysis in JSON format:
{
  "summary": "Brief overall assessment of portfolio health",
  "positionAnalysis": [
    {
      "symbol": "COIN",
      "currentPrice": number,
      "pnlPercent": number,
      "assessment": "Technical analysis and risk assessment",
      "recommendation": "Hold/Close/Adjust - with specific reasoning"
    }
  ],
  "marketContext": "Current market conditions affecting these positions",
  "alertLevel": "info|warning|critical",
  "suggestions": ["Specific actionable suggestions"]
}

Focus on:
- Risk management (proximity to liquidation, excessive drawdown)
- Market momentum and trend changes
- Position sizing and leverage concerns
- Entry/exit timing opportunities`;

    const response = await openai.chat.completions.create({
      model: "sonar",
      messages: [
        { role: "system", content: "You are Mr. Fox, an expert crypto trading analyst. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Clean the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let analysis: MonitoringAnalysis;
    try {
      analysis = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("[Monitoring] Failed to parse AI response as JSON:", cleanedContent);
      throw new Error("AI returned invalid JSON");
    }

    const usageData = response.usage;
    if (usageData) {
      const inputCost = (usageData.prompt_tokens / 1_000_000) * 1.0;
      const outputCost = (usageData.completion_tokens / 1_000_000) * 1.0;
      const totalCost = inputCost + outputCost;

      await storage.logAiUsage({
        provider: "perplexity",
        model: "sonar",
        promptTokens: usageData.prompt_tokens,
        completionTokens: usageData.completion_tokens,
        totalTokens: usageData.total_tokens,
        estimatedCost: totalCost.toFixed(6),
        userPrompt: "[AUTOMATED MONITORING]",
        aiResponse: JSON.stringify(analysis),
        success: 1,
      });
    }

    await storage.createMonitoringLog({
      analysis: JSON.stringify(analysis),
      alertLevel: analysis.alertLevel,
      suggestions: analysis.suggestions.join(" | "),
    });

    console.log(`[Monitoring] Analysis complete. Alert level: ${analysis.alertLevel}`);
    
  } catch (error) {
    console.error("[Monitoring] Error during position analysis:", error);
  }
}

let monitoringInterval: NodeJS.Timeout | null = null;
let currentIntervalMinutes: number = 5; // Default to 5 minutes

export function startMonitoring(intervalMinutes: number = 5): void {
  if (monitoringInterval) {
    console.log("[Monitoring] Already running");
    return;
  }

  if (intervalMinutes === 0) {
    console.log("[Monitoring] Monitoring is disabled");
    return;
  }

  currentIntervalMinutes = intervalMinutes;
  console.log(`[Monitoring] Starting automated monitoring (every ${intervalMinutes} minutes)`);
  
  // Run immediately on start
  analyzePositions();
  
  // Set up recurring interval
  monitoringInterval = setInterval(() => {
    analyzePositions();
  }, intervalMinutes * 60 * 1000);
}

export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("[Monitoring] Stopped automated monitoring");
  }
}

export function restartMonitoring(intervalMinutes: number): void {
  console.log(`[Monitoring] Restarting with interval: ${intervalMinutes} minutes`);
  
  // Stop current monitoring
  stopMonitoring();
  
  // Start with new interval (or stay stopped if 0)
  if (intervalMinutes > 0) {
    startMonitoring(intervalMinutes);
  } else {
    console.log("[Monitoring] Monitoring disabled");
  }
  
  currentIntervalMinutes = intervalMinutes;
}

export function getCurrentInterval(): number {
  return currentIntervalMinutes;
}
