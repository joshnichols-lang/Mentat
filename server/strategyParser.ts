/**
 * Strategy Parser - Analyzes trading strategy descriptions to determine optimal monitoring intervals
 * 
 * This module parses natural language strategy descriptions to detect:
 * - Trading timeframes (1-min, 5-min, hourly, daily, etc.)
 * - Trading styles (scalping, day trading, swing, position)
 * - Special analysis types (orderflow, TPO, market profile, etc.)
 * 
 * Based on the analysis, it recommends appropriate monitoring intervals to balance
 * responsiveness with AI API cost efficiency.
 */

export interface StrategyAnalysis {
  detectedTimeframe: string | null;
  detectedStyle: string | null;
  recommendedMonitoringMinutes: number;
  recommendedTimeBasedCycles: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// PHASE 1D: Cache parsed strategy results - strategy descriptions rarely change
// Cache key is the strategy description itself, value is the analysis result
const strategyAnalysisCache = new Map<string, StrategyAnalysis>();

/**
 * PHASE 1D: Clear strategy cache when user modifies their strategy
 * Call this when a strategy is updated to invalidate the cache
 * Updated: Clears all cache entries matching the description prefix
 */
export function invalidateStrategyCache(strategyDescription: string): void {
  // Clear all cache entries that start with this description (handles multiple timeframes)
  let cleared = 0;
  for (const key of strategyAnalysisCache.keys()) {
    if (key.startsWith(strategyDescription + '|')) {
      strategyAnalysisCache.delete(key);
      cleared++;
    }
  }
  console.log(`[Strategy Parser] Cache invalidated for modified strategy (cleared ${cleared} entries)`);
}

/**
 * PHASE 1D: Clear entire strategy cache (use sparingly)
 */
export function clearStrategyCache(): void {
  strategyAnalysisCache.clear();
  console.log('[Strategy Parser] Entire cache cleared');
}

/**
 * PHASE 1D: Helper to cache and return analysis result
 */
function cacheAndReturn(cacheKey: string, analysis: StrategyAnalysis): StrategyAnalysis {
  strategyAnalysisCache.set(cacheKey, analysis);
  console.log(`[Strategy Parser] ✓ Cached ${analysis.detectedTimeframe || 'default'} strategy`);
  return analysis;
}

/**
 * Parse a strategy description and parameters to return recommended monitoring settings
 * PHASE 1D: Now cached - analysis only runs once per unique strategy description
 * Updated: Prioritizes structured parameters.timeframe over description parsing
 */
export function analyzeStrategyForMonitoring(
  strategyDescription: string | null | undefined,
  parameters?: { timeframe?: string } | null
): StrategyAnalysis {
  // PRIORITY 1: Check structured timeframe parameter first (most reliable)
  if (parameters?.timeframe) {
    console.log(`[Strategy Parser] Using structured timeframe: ${parameters.timeframe}`);
    
    const tf = parameters.timeframe.toLowerCase();
    
    // Map timeframe values to monitoring settings
    if (tf === '1m') {
      return {
        detectedTimeframe: '1-min',
        detectedStyle: 'scalping',
        recommendedMonitoringMinutes: 1,
        recommendedTimeBasedCycles: 10, // AI called every 10 minutes
        confidence: 'high',
        reasoning: 'Timeframe set to 1m - scalping strategy requires 1-minute monitoring'
      };
    } else if (tf === '5m') {
      return {
        detectedTimeframe: '5-min',
        detectedStyle: 'short-term intraday',
        recommendedMonitoringMinutes: 3,
        recommendedTimeBasedCycles: 5, // AI called every 15 minutes
        confidence: 'high',
        reasoning: 'Timeframe set to 5m - short-term strategy needs 3-minute monitoring'
      };
    } else if (tf === '15m') {
      return {
        detectedTimeframe: '15-min',
        detectedStyle: 'intraday',
        recommendedMonitoringMinutes: 5,
        recommendedTimeBasedCycles: 3, // AI called every 15 minutes
        confidence: 'high',
        reasoning: 'Timeframe set to 15m - intraday strategy needs 5-minute monitoring'
      };
    } else if (tf === '30m') {
      return {
        detectedTimeframe: '30-min',
        detectedStyle: 'intraday',
        recommendedMonitoringMinutes: 10,
        recommendedTimeBasedCycles: 3, // AI called every 30 minutes
        confidence: 'high',
        reasoning: 'Timeframe set to 30m - intraday strategy needs 10-minute monitoring'
      };
    } else if (tf === '1h') {
      return {
        detectedTimeframe: '1-hour',
        detectedStyle: 'intraday',
        recommendedMonitoringMinutes: 15,
        recommendedTimeBasedCycles: 2, // AI called every 30 minutes
        confidence: 'high',
        reasoning: 'Timeframe set to 1h - hourly strategy needs 15-minute monitoring'
      };
    } else if (tf === '4h') {
      return {
        detectedTimeframe: '4-hour',
        detectedStyle: 'swing',
        recommendedMonitoringMinutes: 30,
        recommendedTimeBasedCycles: 2, // AI called every hour
        confidence: 'high',
        reasoning: 'Timeframe set to 4h - swing strategy needs 30-minute monitoring'
      };
    } else if (tf === '1d') {
      return {
        detectedTimeframe: 'daily',
        detectedStyle: 'position',
        recommendedMonitoringMinutes: 60,
        recommendedTimeBasedCycles: 2, // AI called every 2 hours
        confidence: 'high',
        reasoning: 'Timeframe set to 1d - position strategy needs hourly monitoring'
      };
    }
  }

  // PRIORITY 2: Fall back to description parsing if no structured timeframe
  // Default to moderate settings if no strategy provided
  if (!strategyDescription) {
    return {
      detectedTimeframe: null,
      detectedStyle: null,
      recommendedMonitoringMinutes: 5,
      recommendedTimeBasedCycles: 30,
      confidence: 'low',
      reasoning: 'No strategy description or timeframe provided, using moderate default settings'
    };
  }

  // Create cache key from both description and timeframe
  const cacheKey = `${strategyDescription}|${parameters?.timeframe || 'none'}`;
  
  // PHASE 1D: Check cache first
  const cached = strategyAnalysisCache.get(cacheKey);
  if (cached) {
    console.log('[Strategy Parser] ✓ Cache HIT - Using cached analysis');
    return cached;
  }

  console.log('[Strategy Parser] Cache MISS - Analyzing strategy description...');
  const strategyLower = strategyDescription.toLowerCase();

  // Pattern detection - ordered by specificity (most specific first)
  
  // ULTRA-SHORT TERM: Scalping & Tick Trading (1-2 min monitoring, check AI every 10-15 cycles)
  if (
    /\b(scalp|scalping|tick|ticks|1-?min|1m|30-?sec|seconds?)\b/i.test(strategyLower) ||
    /\b(quick (entry|exit)|rapid|fast|high-?frequency)\b/i.test(strategyLower)
  ) {
    return cacheAndReturn(cacheKey, {
      detectedTimeframe: '1-min',
      detectedStyle: 'scalping',
      recommendedMonitoringMinutes: 1,
      recommendedTimeBasedCycles: 10, // AI called every 10 minutes for 1-min monitoring
      confidence: 'high',
      reasoning: 'Detected scalping/tick trading - very short timeframe requires frequent monitoring but conservative AI calls to manage costs'
    });
  }

  // SHORT TERM: Intraday with orderflow/microstructure (2-5 min monitoring, check AI every 5-8 cycles)
  if (
    /\b(orderflow|order\s*flow|tpo|time\s*price\s*opportunity|market\s*profile|value\s*area|point\s*of\s*control|poc)\b/i.test(strategyLower) ||
    /\b(footprint|delta|cvd|cumulative\s*volume|absorption|imbalance)\b/i.test(strategyLower)
  ) {
    return cacheAndReturn(cacheKey, {
      detectedTimeframe: '5-min',
      detectedStyle: 'orderflow/microstructure',
      recommendedMonitoringMinutes: 3,
      recommendedTimeBasedCycles: 5, // AI called every 15 minutes for 3-min monitoring
      confidence: 'high',
      reasoning: 'Detected orderflow/market microstructure analysis - requires responsive monitoring but setups develop over several minutes'
    });
  }

  // SHORT TERM: 5-minute trading (3-5 min monitoring, check AI every 5 cycles)
  if (/\b(5-?min|5m|3-?min|3m)\b/i.test(strategyLower)) {
    return cacheAndReturn(cacheKey, {
      detectedTimeframe: '5-min',
      detectedStyle: 'short-term intraday',
      recommendedMonitoringMinutes: 3,
      recommendedTimeBasedCycles: 5, // AI called every 15 minutes
      confidence: 'high',
      reasoning: 'Detected 5-minute timeframe trading - moderate frequency monitoring'
    });
  }

  // MEDIUM TERM: 15-minute to hourly (5-15 min monitoring, check AI every 3-6 cycles)
  if (
    /\b(15-?min|15m|30-?min|30m|1-?hour|1h|hourly)\b/i.test(strategyLower) ||
    /\b(day\s*trad(e|ing)|intraday)\b/i.test(strategyLower)
  ) {
    return cacheAndReturn(cacheKey, {
      detectedTimeframe: '15-60min',
      detectedStyle: 'intraday',
      recommendedMonitoringMinutes: 10,
      recommendedTimeBasedCycles: 3, // AI called every 30 minutes for 10-min monitoring
      confidence: 'high',
      reasoning: 'Detected intraday trading on 15-min to 1-hour timeframe - balanced monitoring approach'
    });
  }

  // LONGER TERM: 4-hour and daily (15-30 min monitoring, check AI every 2-4 cycles)
  if (
    /\b(4-?hour|4h|daily|1d|swing|multi-?day)\b/i.test(strategyLower) ||
    /\b(position|hold\s*(for|overnight)|overnight)\b/i.test(strategyLower)
  ) {
    return cacheAndReturn(cacheKey, {
      detectedTimeframe: 'daily/swing',
      detectedStyle: 'swing/position',
      recommendedMonitoringMinutes: 30,
      recommendedTimeBasedCycles: 2, // AI called every hour for 30-min monitoring
      confidence: 'high',
      reasoning: 'Detected swing/position trading - longer timeframe requires less frequent monitoring'
    });
  }

  // FALLBACK: Look for any mention of specific frequencies
  const timeframeMatch = strategyLower.match(/\b(\d+)\s*-?\s*(min|minute|hour|day)/i);
  if (timeframeMatch) {
    const value = parseInt(timeframeMatch[1]);
    const unit = timeframeMatch[2].toLowerCase();
    
    if (unit.startsWith('min')) {
      if (value <= 2) {
        return cacheAndReturn(cacheKey, {
          detectedTimeframe: `${value}-min`,
          detectedStyle: 'scalping',
          recommendedMonitoringMinutes: 1,
          recommendedTimeBasedCycles: 10,
          confidence: 'medium',
          reasoning: `Detected ${value}-minute timeframe - treating as scalping strategy`
        });
      } else if (value <= 10) {
        return cacheAndReturn(cacheKey, {
          detectedTimeframe: `${value}-min`,
          detectedStyle: 'short-term',
          recommendedMonitoringMinutes: 3,
          recommendedTimeBasedCycles: 5,
          confidence: 'medium',
          reasoning: `Detected ${value}-minute timeframe - short-term intraday approach`
        });
      } else if (value <= 60) {
        return cacheAndReturn(cacheKey, {
          detectedTimeframe: `${value}-min`,
          detectedStyle: 'intraday',
          recommendedMonitoringMinutes: 10,
          recommendedTimeBasedCycles: 3,
          confidence: 'medium',
          reasoning: `Detected ${value}-minute timeframe - intraday trading`
        });
      }
    } else if (unit.startsWith('hour')) {
      return cacheAndReturn(cacheKey, {
        detectedTimeframe: `${value}-hour`,
        detectedStyle: 'swing',
        recommendedMonitoringMinutes: 30,
        recommendedTimeBasedCycles: 2,
        confidence: 'medium',
        reasoning: `Detected ${value}-hour timeframe - swing trading approach`
      });
    }
  }

  // DEFAULT: No specific timeframe detected - use moderate settings
  return cacheAndReturn(cacheKey, {
    detectedTimeframe: null,
    detectedStyle: null,
    recommendedMonitoringMinutes: 5,
    recommendedTimeBasedCycles: 30, // Conservative - AI called every 2.5 hours for 5-min monitoring
    confidence: 'low',
    reasoning: 'No specific timeframe or style detected - using conservative default settings to minimize AI costs'
  });
}

/**
 * Calculate estimated AI calls per day based on monitoring settings
 */
export function estimateAiCallsPerDay(
  monitoringMinutes: number,
  timeBasedCycles: number
): number {
  // Calculate cycles per day
  const cyclesPerDay = (24 * 60) / monitoringMinutes;
  
  // AI is called every N cycles (timeBasedCycles)
  const aiCallsPerDay = Math.ceil(cyclesPerDay / timeBasedCycles);
  
  return aiCallsPerDay;
}

/**
 * Estimate monthly AI costs based on monitoring settings
 * Assumes $0.01 per AI call (conservative estimate)
 */
export function estimateMonthlyCost(
  monitoringMinutes: number,
  timeBasedCycles: number
): number {
  const aiCallsPerDay = estimateAiCallsPerDay(monitoringMinutes, timeBasedCycles);
  const costPerCall = 0.01; // $0.01 per AI call
  const monthlyCost = aiCallsPerDay * 30 * costPerCall;
  
  return Math.round(monthlyCost * 100) / 100; // Round to 2 decimals
}
