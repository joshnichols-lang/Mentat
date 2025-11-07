/**
 * Strategy Analyzer
 * 
 * Uses AI to parse custom trading rules and automatically configure
 * monitoring frequency, indicators, and trigger conditions.
 */

import { makeAIRequest } from "./aiRouter";

/**
 * PHASE 4: Event-Driven AI Trigger System
 * Structured trigger condition extracted from strategy text
 */
export interface TriggerSpec {
  id: string;
  type: 'indicator' | 'price' | 'volume' | 'time';
  indicator?: 'RSI' | 'MACD' | 'SMA' | 'EMA' | 'BB_UPPER' | 'BB_LOWER' | 'STOCH' | 'ATR' | 'VOLUME';
  operator: '<' | '>' | '<=' | '>=' | '==' | 'crosses_above' | 'crosses_below';
  value: number;
  period?: number;
  hysteresis?: number;
  cooldownMinutes?: number;
  description: string;
}

export interface StrategyConfig {
  strategyType: "technical_indicator" | "order_flow" | "market_profile" | "price_action" | "hybrid";
  detectedIndicators?: string[];
  indicatorConfig?: {
    rsi?: { period: number; oversold: number; overbought: number };
    macd?: { fast: number; slow: number; signal: number };
    bollingerBands?: { period: number; stdDev: number };
    stochastic?: { kPeriod: number; dPeriod: number; oversold: number; overbought: number };
  };
  orderFlowConfig?: {
    imbalanceRatio: number;
    minImbalanceVolume: number;
    deltaThreshold: number;
    depthImbalanceRatio: number;
  };
  marketProfileConfig?: {
    tickSize: number;
    detectVABreakouts: boolean;
    detectIBBreakouts: boolean;
    detectPOCTests: boolean;
    pocTolerance: number;
  };
  monitoringFrequencyMinutes: number;
  requiresRealtimeData: boolean;
  triggerMode: "indicator" | "time_based" | "hybrid";
  reasoning: string;
  triggers?: TriggerSpec[];
}

const STRATEGY_ANALYSIS_PROMPT = `You are a trading strategy analyzer. Your job is to parse natural language trading rules and extract structured configuration for automated monitoring.

Analyze the user's custom trading rules and determine:

1. **Strategy Type**: What type of strategy is this?
   - "technical_indicator": Uses RSI, MACD, Bollinger Bands, Stochastic, etc.
   - "order_flow": Uses bid/ask imbalance, delta, order book depth
   - "market_profile": Uses TPO, Value Area, POC, Initial Balance
   - "price_action": Uses price patterns, support/resistance, trendlines
   - "hybrid": Combines multiple types

2. **Indicators Required**: Which technical indicators are mentioned?
   - RSI (Relative Strength Index)
   - MACD (Moving Average Convergence Divergence)
   - Bollinger Bands
   - Stochastic Oscillator
   - EMAs/SMAs

3. **Indicator Parameters**: Extract specific parameters mentioned
   - RSI: period (default 14), oversold level (default 30), overbought level (default 70)
   - MACD: fast period (default 12), slow period (default 26), signal period (default 9)
   - Bollinger Bands: period (default 20), standard deviation multiplier (default 2)
   - Stochastic: %K period (default 14), %D period (default 3), oversold (default 20), overbought (default 80)

4. **Order Flow Parameters** (if mentioned):
   - Bid/ask imbalance ratio threshold (e.g., "3x imbalance" = 3.0)
   - Minimum volume for detection
   - Delta threshold for buy/sell pressure
   - Order book depth imbalance ratio

5. **Market Profile Parameters** (if mentioned):
   - Tick size for TPO calculation
   - Whether to detect Value Area breakouts
   - Whether to detect Initial Balance breakouts
   - Whether to detect Point of Control tests
   - Price tolerance for POC tests

6. **Monitoring Frequency**: How often should the monitoring loop run?
   - MINIMUM: 5 minutes (cost control - prevents excessive AI calls)
   - Fast scalping: 5 minutes
   - Swing trading: 15-60 minutes
   - Position trading: 60-240 minutes
   - IMPORTANT: Always recommend at least 5 minutes to balance responsiveness with AI cost efficiency

7. **Realtime Data**: Does this strategy need live order book data?
   - true: Order flow strategies, market profile with live TPO
   - false: Technical indicators on candle data

8. **Trigger Mode**: When should AI be called?
   - "indicator": Call AI when indicator conditions are met (RSI < 30, MACD crossover, etc.)
   - "time_based": Call AI on regular intervals (no specific triggers)
   - "hybrid": Use both indicator triggers and time-based fallback

9. **PHASE 4 - Specific Triggers**: Extract EXACT trigger conditions that should fire AI calls
   - For each trigger condition mentioned (e.g., "RSI < 30", "price crosses 200 SMA"), create a TriggerSpec:
     * id: unique identifier (e.g., "rsi_oversold", "price_above_ma200")
     * type: "indicator" | "price" | "volume" | "time"
     * indicator: "RSI" | "MACD" | "SMA" | "EMA" | "BB_UPPER" | "BB_LOWER" | "STOCH" | "ATR" | "VOLUME"
     * operator: "<" | ">" | "<=" | ">=" | "==" | "crosses_above" | "crosses_below"
     * value: numeric threshold
     * period: indicator period (e.g., RSI(14), SMA(200))
     * hysteresis: optional buffer to prevent thrashing (default 0.02 = 2%)
     * cooldownMinutes: minimum time between triggers (default 5 minutes)
     * description: human-readable explanation

Return your analysis as a JSON object matching the StrategyConfig interface. IMPORTANT: Include a "triggers" array with all extractable trigger conditions.

Example 1:
Input: "Trade BTC when RSI drops below 30 on the 5-minute timeframe. Exit when it crosses back above 50."
Output: {
  "strategyType": "technical_indicator",
  "detectedIndicators": ["RSI"],
  "indicatorConfig": {
    "rsi": { "period": 14, "oversold": 30, "overbought": 70 }
  },
  "monitoringFrequencyMinutes": 1,
  "requiresRealtimeData": false,
  "triggerMode": "indicator",
  "triggers": [
    {
      "id": "rsi_entry",
      "type": "indicator",
      "indicator": "RSI",
      "operator": "<",
      "value": 30,
      "period": 14,
      "hysteresis": 0.02,
      "cooldownMinutes": 5,
      "description": "RSI drops below 30 - oversold entry signal"
    },
    {
      "id": "rsi_exit",
      "type": "indicator",
      "indicator": "RSI",
      "operator": "crosses_above",
      "value": 50,
      "period": 14,
      "hysteresis": 0.02,
      "cooldownMinutes": 5,
      "description": "RSI crosses back above 50 - exit signal"
    }
  ],
  "reasoning": "RSI-based scalping strategy on 5-min timeframe. PHASE 4: Event-driven triggers allow 1-min monitoring without excessive AI costs - AI only called when RSI actually crosses thresholds."
}

Example 2:
Input: "Look for 3x bid/ask imbalances at key support levels. Enter when imbalance appears with high volume."
Output: {
  "strategyType": "order_flow",
  "orderFlowConfig": {
    "imbalanceRatio": 3.0,
    "minImbalanceVolume": 5000,
    "deltaThreshold": 30,
    "depthImbalanceRatio": 1.5
  },
  "monitoringFrequencyMinutes": 5,
  "requiresRealtimeData": true,
  "triggerMode": "indicator",
  "reasoning": "Order flow imbalance strategy requiring realtime order book monitoring. 5-min frequency balances responsiveness with cost efficiency. AI called when 3x+ imbalance detected."
}

Example 3:
Input: "Trade Value Area breakouts on 30-minute Market Profile. Enter when price breaks above VAH with volume confirmation."
Output: {
  "strategyType": "market_profile",
  "marketProfileConfig": {
    "tickSize": 1,
    "detectVABreakouts": true,
    "detectIBBreakouts": false,
    "detectPOCTests": false,
    "pocTolerance": 0.5
  },
  "monitoringFrequencyMinutes": 30,
  "requiresRealtimeData": false,
  "triggerMode": "indicator",
  "reasoning": "Market Profile strategy on 30-min timeframe. Build new profile every 30 minutes and detect VAH/VAL breakouts. AI called when breakout occurs."
}

Example 4:
Input: "Scalp BTC using MACD and RSI combined. Enter long when MACD crosses bullish AND RSI is oversold. 1-minute timeframe."
Output: {
  "strategyType": "hybrid",
  "detectedIndicators": ["MACD", "RSI"],
  "indicatorConfig": {
    "rsi": { "period": 14, "oversold": 30, "overbought": 70 },
    "macd": { "fast": 12, "slow": 26, "signal": 9 }
  },
  "monitoringFrequencyMinutes": 1,
  "requiresRealtimeData": false,
  "triggerMode": "indicator",
  "triggers": [
    {
      "id": "macd_bullish_cross",
      "type": "indicator",
      "indicator": "MACD",
      "operator": "crosses_above",
      "value": 0,
      "period": 26,
      "hysteresis": 0.01,
      "cooldownMinutes": 5,
      "description": "MACD line crosses above signal line (bullish)"
    },
    {
      "id": "rsi_oversold",
      "type": "indicator",
      "indicator": "RSI",
      "operator": "<",
      "value": 30,
      "period": 14,
      "hysteresis": 0.02,
      "cooldownMinutes": 5,
      "description": "RSI drops below 30 (oversold)"
    }
  ],
  "reasoning": "Hybrid MACD+RSI scalping strategy on 1-min timeframe. PHASE 4: Event-driven triggers monitor indicators continuously but only call AI when both conditions met, reducing costs by 90%+."
}

Now analyze the following custom trading rules:`;

/**
 * Analyze custom trading rules using AI and return structured configuration
 */
export async function analyzeStrategy(
  userId: string,
  customRules: string,
  strategyDescription?: string
): Promise<StrategyConfig> {
  try {
    // Combine strategy description and custom rules for analysis
    const fullContext = strategyDescription 
      ? `Strategy Description: ${strategyDescription}\n\nCustom Rules: ${customRules}`
      : customRules;

    console.log('[Strategy Analyzer] Analyzing strategy rules...');

    const aiResponse = await makeAIRequest(userId, {
      messages: [
        {
          role: 'system',
          content: STRATEGY_ANALYSIS_PROMPT
        },
        {
          role: 'user',
          content: fullContext
        }
      ],
      model: 'grok',
      temperature: 0.3 // Lower temperature for more consistent parsing
    });

    const config = JSON.parse(aiResponse.content) as StrategyConfig;

    // PHASE 4: Smart frequency enforcement based on trigger availability
    const MIN_MONITORING_FREQUENCY = 5;
    const frequency = Number(config.monitoringFrequencyMinutes);
    
    // Handle undefined, NaN values
    if (!frequency || isNaN(frequency)) {
      config.monitoringFrequencyMinutes = MIN_MONITORING_FREQUENCY;
      console.log(`[Strategy Analyzer] ⚠️ AI returned invalid frequency, using ${MIN_MONITORING_FREQUENCY} min default`);
    }
    // PHASE 4: If triggers detected, allow fast monitoring (event-driven)
    else if (config.triggers && config.triggers.length > 0) {
      // Event-driven mode - monitoring frequency can be aggressive since AI is only called on trigger fires
      console.log(`[Strategy Analyzer] ✓ Event-driven mode with ${config.triggers.length} triggers - allowing ${frequency} min monitoring`);
    }
    // No triggers - enforce minimum to control costs
    else if (frequency < MIN_MONITORING_FREQUENCY) {
      const originalValue = config.monitoringFrequencyMinutes;
      config.monitoringFrequencyMinutes = MIN_MONITORING_FREQUENCY;
      console.log(`[Strategy Analyzer] ⚠️ No triggers detected - enforcing ${MIN_MONITORING_FREQUENCY} min minimum (was ${originalValue}) for cost control`);
    }

    console.log('[Strategy Analyzer] Analysis complete:', {
      strategyType: config.strategyType,
      detectedIndicators: config.detectedIndicators,
      monitoringFrequency: config.monitoringFrequencyMinutes,
      triggerMode: config.triggerMode,
      triggersDetected: config.triggers?.length || 0
    });

    return config;

  } catch (error: any) {
    console.error('[Strategy Analyzer] Error analyzing strategy:', error);

    // Return conservative defaults on error (always safe 15-minute frequency)
    return {
      strategyType: 'price_action',
      monitoringFrequencyMinutes: 15,
      requiresRealtimeData: false,
      triggerMode: 'time_based',
      reasoning: 'Failed to parse strategy rules - using conservative time-based monitoring'
    };
  }
}

/**
 * Get recommended trigger sensitivity based on strategy type
 */
export function getRecommendedTriggerSensitivity(
  strategyType: StrategyConfig['strategyType'],
  monitoringFrequencyMinutes: number
): 'conservative' | 'moderate' | 'aggressive' {
  // Indicator-based strategies can use conservative triggers (only call AI when conditions met)
  if (strategyType === 'technical_indicator' || strategyType === 'order_flow' || strategyType === 'market_profile') {
    return 'conservative'; // Relies on specific triggers
  }

  // Fast timeframes need more frequent checks
  if (monitoringFrequencyMinutes <= 5) {
    return 'aggressive'; // Check frequently for fast-moving markets
  }

  // Medium timeframes
  if (monitoringFrequencyMinutes <= 30) {
    return 'moderate';
  }

  // Slow timeframes
  return 'conservative';
}
