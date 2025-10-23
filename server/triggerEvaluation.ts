/**
 * Smart Trigger Evaluation System
 * 
 * Evaluates market conditions locally to determine if AI analysis is needed.
 * Reduces AI API costs by 80-95% by only calling AI when significant events occur.
 */

export interface TriggerConfig {
  sensitivity: 'conservative' | 'moderate' | 'aggressive'; // 5%, 10%, 20% trigger rates
  volumeSpikeThreshold: number; // Multiplier of average volume
  priceBreakoutPercent: number; // % move from recent range
  positionRiskThreshold: number; // % distance to liquidation
  timeBasedCycles: number; // Call AI every N cycles regardless
}

export interface TriggerResult {
  shouldCallAI: boolean;
  triggeredBy: string[];
  context: Record<string, any>;
}

interface MarketSnapshot {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  currentPrice: number;
  liquidationPrice: number | null;
  pnlPercent: number;
}

/**
 * Get default trigger configuration based on sensitivity level
 */
export function getDefaultTriggerConfig(sensitivity: 'conservative' | 'moderate' | 'aggressive'): TriggerConfig {
  switch (sensitivity) {
    case 'conservative':
      return {
        sensitivity: 'conservative',
        volumeSpikeThreshold: 3.0,      // Only trigger on 3x+ volume
        priceBreakoutPercent: 5.0,       // 5%+ price move
        positionRiskThreshold: 10.0,     // 10% from liquidation
        timeBasedCycles: 60,             // Every 60 cycles (~1hr for 1min frequency)
      };
    case 'moderate':
      return {
        sensitivity: 'moderate',
        volumeSpikeThreshold: 2.0,       // 2x+ volume
        priceBreakoutPercent: 3.0,        // 3%+ price move
        positionRiskThreshold: 15.0,      // 15% from liquidation
        timeBasedCycles: 30,              // Every 30 cycles (~30min for 1min frequency)
      };
    case 'aggressive':
      return {
        sensitivity: 'aggressive',
        volumeSpikeThreshold: 1.5,        // 1.5x+ volume
        priceBreakoutPercent: 2.0,        // 2%+ price move
        positionRiskThreshold: 20.0,      // 20% from liquidation
        timeBasedCycles: 10,              // Every 10 cycles (~10min for 1min frequency)
      };
  }
}

/**
 * Evaluate if AI should be called based on current market conditions
 */
export function evaluateTriggers(
  config: TriggerConfig,
  marketData: MarketSnapshot[],
  positions: Position[],
  cycleCount: number,
  previousVolumeAvg: Map<string, number>
): TriggerResult {
  const triggers: string[] = [];
  const context: Record<string, any> = {};

  // TRIGGER 1: Time-based fallback
  // Always call AI every N cycles to stay aware of gradual market changes
  if (cycleCount % config.timeBasedCycles === 0) {
    triggers.push('time_based_interval');
    context.cycleCount = cycleCount;
    context.interval = config.timeBasedCycles;
  }

  // TRIGGER 2: Volume spike detection
  // Significant volume changes often precede major price moves
  const volumeSpikes = detectVolumeSpikes(marketData, previousVolumeAvg, config.volumeSpikeThreshold);
  if (volumeSpikes.length > 0) {
    triggers.push('volume_spike');
    context.volumeSpikes = volumeSpikes;
  }

  // TRIGGER 3: Price breakout detection
  // Large price movements indicate potential trading opportunities
  const priceBreakouts = detectPriceBreakouts(marketData, config.priceBreakoutPercent);
  if (priceBreakouts.length > 0) {
    triggers.push('price_breakout');
    context.priceBreakouts = priceBreakouts;
  }

  // TRIGGER 4: Position risk management
  // Close to liquidation or hitting profit targets requires immediate AI attention
  const riskAlerts = detectPositionRisk(positions, config.positionRiskThreshold);
  if (riskAlerts.length > 0) {
    triggers.push('position_risk');
    context.riskAlerts = riskAlerts;
  }

  // TRIGGER 5: First open position
  // When a new position opens, AI should monitor closely
  if (positions.length > 0 && cycleCount <= 5) {
    triggers.push('new_position_monitoring');
    context.positionCount = positions.length;
  }

  return {
    shouldCallAI: triggers.length > 0,
    triggeredBy: triggers,
    context,
  };
}

/**
 * Detect volume spikes across all markets
 */
function detectVolumeSpikes(
  marketData: MarketSnapshot[],
  previousVolumeAvg: Map<string, number>,
  threshold: number
): Array<{ symbol: string; currentVolume: number; avgVolume: number; ratio: number }> {
  const spikes: Array<{ symbol: string; currentVolume: number; avgVolume: number; ratio: number }> = [];

  // Calculate current average volume across all markets
  const totalVolume = marketData.reduce((sum, m) => sum + parseFloat(m.volume24h), 0);
  const avgVolume = totalVolume / marketData.length;

  for (const market of marketData) {
    const currentVolume = parseFloat(market.volume24h);
    const prevAvg = previousVolumeAvg.get(market.symbol) || avgVolume;

    const ratio = currentVolume / prevAvg;
    
    if (ratio >= threshold) {
      spikes.push({
        symbol: market.symbol,
        currentVolume,
        avgVolume: prevAvg,
        ratio,
      });
    }

    // Update rolling average (exponential moving average)
    const newAvg = prevAvg * 0.9 + currentVolume * 0.1;
    previousVolumeAvg.set(market.symbol, newAvg);
  }

  return spikes;
}

/**
 * Detect significant price breakouts (> threshold % move)
 */
function detectPriceBreakouts(
  marketData: MarketSnapshot[],
  threshold: number
): Array<{ symbol: string; change24h: number }> {
  const breakouts: Array<{ symbol: string; change24h: number }> = [];

  for (const market of marketData) {
    const change = Math.abs(parseFloat(market.change24h));
    
    if (change >= threshold) {
      breakouts.push({
        symbol: market.symbol,
        change24h: parseFloat(market.change24h),
      });
    }
  }

  // Sort by magnitude of change
  return breakouts.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
}

/**
 * Detect positions at risk or hitting profit targets
 */
function detectPositionRisk(
  positions: Position[],
  riskThreshold: number
): Array<{ symbol: string; type: string; detail: string }> {
  const alerts: Array<{ symbol: string; type: string; detail: string }> = [];

  for (const pos of positions) {
    // Check liquidation risk
    if (pos.liquidationPrice) {
      const distanceToLiq = Math.abs((pos.currentPrice - pos.liquidationPrice) / pos.currentPrice) * 100;
      
      if (distanceToLiq <= riskThreshold) {
        alerts.push({
          symbol: pos.symbol,
          type: 'liquidation_risk',
          detail: `${distanceToLiq.toFixed(2)}% from liquidation`,
        });
      }
    }

    // Check profit targets (>10% gain deserves consideration)
    if (pos.pnlPercent > 10) {
      alerts.push({
        symbol: pos.symbol,
        type: 'profit_target',
        detail: `${pos.pnlPercent.toFixed(2)}% profit - consider taking profits`,
      });
    }

    // Check significant losses (>5% loss needs attention)
    if (pos.pnlPercent < -5) {
      alerts.push({
        symbol: pos.symbol,
        type: 'loss_alert',
        detail: `${pos.pnlPercent.toFixed(2)}% loss - review position`,
      });
    }
  }

  return alerts;
}

/**
 * Calculate expected AI call rate based on sensitivity
 */
export function getExpectedTriggerRate(sensitivity: 'conservative' | 'moderate' | 'aggressive'): number {
  switch (sensitivity) {
    case 'conservative': return 0.05;  // 5% of cycles
    case 'moderate': return 0.10;      // 10% of cycles
    case 'aggressive': return 0.20;    // 20% of cycles
  }
}

/**
 * Estimate monthly cost based on frequency and trigger rate
 */
export function estimateMonthlyAICost(
  monitoringFrequencyMinutes: number,
  sensitivity: 'conservative' | 'moderate' | 'aggressive'
): { cycles: number; aiCalls: number; cost: number } {
  const cyclesPerMonth = (30 * 24 * 60) / monitoringFrequencyMinutes;
  const triggerRate = getExpectedTriggerRate(sensitivity);
  const aiCalls = Math.ceil(cyclesPerMonth * triggerRate);
  
  // Average cost per AI call (Grok 4 Fast): ~$0.0012
  const cost = aiCalls * 0.0012;

  return {
    cycles: cyclesPerMonth,
    aiCalls,
    cost: parseFloat(cost.toFixed(2)),
  };
}
