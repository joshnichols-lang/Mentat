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
    
    const positions = await storage.getPositions();
    
    if (positions.length === 0) {
      console.log("[Monitoring] No positions to analyze");
      return;
    }

    const allMarketData = await hyperliquidClient.getMarketData();
    const marketDataMap = new Map(allMarketData.map(m => [m.symbol, m.price]));
    
    const marketData = positions.map(pos => ({
      symbol: pos.symbol,
      currentPrice: parseFloat(marketDataMap.get(pos.symbol) || pos.currentPrice.toString()),
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

    let analysis: MonitoringAnalysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      console.error("[Monitoring] Failed to parse AI response as JSON:", content);
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

export function startMonitoring(): void {
  if (monitoringInterval) {
    console.log("[Monitoring] Already running");
    return;
  }

  console.log("[Monitoring] Starting automated monitoring (every 5 minutes)");
  
  analyzePositions();
  
  monitoringInterval = setInterval(() => {
    analyzePositions();
  }, 5 * 60 * 1000);
}

export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("[Monitoring] Stopped automated monitoring");
  }
}
