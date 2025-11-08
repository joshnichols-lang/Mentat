/**
 * Strategy-Aware Trigger Evaluation
 * 
 * Evaluates triggers based on strategy configuration including
 * technical indicators, order flow, and market profile.
 */

import type { Candle, IndicatorSignal } from './indicators';
import { evaluateIndicatorSignals } from './indicators';
import type { OrderBookSnapshot, Trade, OrderFlowSignal } from './orderFlow';
import { evaluateOrderFlowSignals } from './orderFlow';
import type { MarketProfile, MarketProfileSignal } from './marketProfile';
import { buildMarketProfile, evaluateMarketProfileSignals } from './marketProfile';
import type { StrategyConfig } from './strategyAnalyzer';

export interface StrategyTriggerResult {
  shouldCallAI: boolean;
  triggeredBy: string[];
  signals: Array<IndicatorSignal | OrderFlowSignal | MarketProfileSignal>;
  context: Record<string, any>;
}

/**
 * Evaluate strategy-specific triggers based on configuration
 */
export async function evaluateStrategyTriggers(
  strategyConfig: StrategyConfig,
  candles: Candle[],
  orderBook?: OrderBookSnapshot,
  trades?: Trade[]
): Promise<StrategyTriggerResult> {
  const triggeredBy: string[] = [];
  const allSignals: Array<IndicatorSignal | OrderFlowSignal | MarketProfileSignal> = [];
  const context: Record<string, any> = {};

  // TECHNICAL INDICATOR EVALUATION
  if (strategyConfig.strategyType === 'technical_indicator' || strategyConfig.strategyType === 'hybrid') {
    if (strategyConfig.indicatorConfig) {
      const indicatorSignals = evaluateIndicatorSignals(candles, strategyConfig.indicatorConfig);
      
      if (indicatorSignals.length > 0) {
        triggeredBy.push('indicator_signal');
        allSignals.push(...indicatorSignals);
        context.indicators = indicatorSignals.map(s => s.description);
      }
    }
  }

  // ORDER FLOW EVALUATION
  if (strategyConfig.strategyType === 'order_flow' || strategyConfig.strategyType === 'hybrid') {
    if (strategyConfig.orderFlowConfig && orderBook && trades) {
      const orderFlowSignals = evaluateOrderFlowSignals(
        orderBook,
        trades,
        strategyConfig.orderFlowConfig
      );
      
      if (orderFlowSignals.length > 0) {
        triggeredBy.push('order_flow_signal');
        allSignals.push(...orderFlowSignals);
        context.orderFlow = orderFlowSignals.map(s => s.description);
      }
    }
  }

  // MARKET PROFILE EVALUATION
  if (strategyConfig.strategyType === 'market_profile' || strategyConfig.strategyType === 'hybrid') {
    if (strategyConfig.marketProfileConfig && candles.length > 0) {
      const tickSize = strategyConfig.marketProfileConfig.tickSize || 1;
      const marketProfile = buildMarketProfile(candles, tickSize);
      const currentPrice = candles[candles.length - 1].close;
      
      const profileSignals = evaluateMarketProfileSignals(
        currentPrice,
        marketProfile,
        strategyConfig.marketProfileConfig
      );
      
      if (profileSignals.length > 0) {
        triggeredBy.push('market_profile_signal');
        allSignals.push(...profileSignals);
        context.marketProfile = profileSignals.map(s => s.description);
        context.valueAreaHigh = marketProfile.valueArea.high;
        context.valueAreaLow = marketProfile.valueArea.low;
        context.pointOfControl = marketProfile.valueArea.poc;
      }
    }
  }

  // PRICE ACTION (always uses time-based for now, could add pattern detection later)
  if (strategyConfig.strategyType === 'price_action') {
    // Price action strategies don't have specific triggers yet
    // Fall back to time-based monitoring
    context.note = 'Price action strategy using time-based monitoring';
  }

  return {
    shouldCallAI: allSignals.length > 0,
    triggeredBy,
    signals: allSignals,
    context
  };
}

/**
 * Format trigger signals for AI context
 */
export function formatTriggersForAI(signals: Array<IndicatorSignal | OrderFlowSignal | MarketProfileSignal>): string {
  if (signals.length === 0) return '';

  const descriptions = signals.map(s => s.description);
  return `\n\n**STRATEGY TRIGGERS DETECTED:**\n${descriptions.map(d => `- ${d}`).join('\n')}`;
}

/**
 * Get monitoring frequency from strategy config or fall back to default
 */
export function getMonitoringFrequency(strategyConfig?: StrategyConfig | null, defaultMinutes: number = 5): number {
  if (!strategyConfig) return defaultMinutes;
  return strategyConfig.monitoringFrequencyMinutes || defaultMinutes;
}

/**
 * Check if strategy requires real-time order book data
 */
export function requiresRealtimeData(strategyConfig?: StrategyConfig | null): boolean {
  if (!strategyConfig) return false;
  return strategyConfig.requiresRealtimeData || false;
}

/**
 * Determine if we should use indicator-based triggers or time-based
 */
export function shouldUseIndicatorTriggers(strategyConfig?: StrategyConfig | null): boolean {
  if (!strategyConfig) return false;
  
  return strategyConfig.triggerMode === 'indicator' || 
         strategyConfig.triggerMode === 'hybrid';
}
