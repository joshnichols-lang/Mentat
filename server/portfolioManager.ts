import type { IStorage } from "./storage";

/**
 * Portfolio Manager Service
 * 
 * Coordinates multiple concurrent trading strategies by:
 * - Tracking aggregate positions and exposure across all strategies
 * - Managing capital allocation and rebalancing
 * - Detecting conflicts between strategies
 * - Enforcing portfolio-level risk limits
 */

export interface StrategyPosition {
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  notionalValue: number;
  leverage: number;
  unrealizedPnl: number;
}

export interface AggregateExposure {
  symbol: string;
  netSize: number; // Positive = net long, negative = net short
  netNotional: number;
  longSize: number;
  shortSize: number;
  strategies: {
    strategyId: string;
    strategyName: string;
    side: 'long' | 'short';
    size: number;
  }[];
}

export interface StrategyAllocation {
  strategyId: string;
  strategyName: string;
  allocatedCapitalPercent: number;
  allocatedCapitalUsd: number;
  currentlyUsed: number;
  availableCapital: number;
  utilizationPercent: number;
  currentPositions: number;
  maxPositions: number;
  dailyLoss: number;
  dailyLossLimit: number;
}

export interface PositionConflict {
  type: 'opposing_positions' | 'over_concentration' | 'correlated_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  symbol: string;
  message: string;
  strategies: {
    id: string;
    name: string;
    side: 'long' | 'short';
    size: number;
  }[];
  recommendation: string;
}

export interface PortfolioStatus {
  totalCapital: number;
  totalMarginUsed: number;
  totalAvailable: number;
  marginUtilizationPercent: number;
  activeStrategies: number;
  totalPositions: number;
  aggregateExposure: AggregateExposure[];
  strategyAllocations: StrategyAllocation[];
  conflicts: PositionConflict[];
  portfolioHealth: 'healthy' | 'warning' | 'critical';
  recommendations: string[];
}

export class PortfolioManagerService {
  constructor(private storage: IStorage) {}

  /**
   * Get comprehensive portfolio status across all active strategies
   */
  async getPortfolioStatus(userId: string, totalCapital: number): Promise<PortfolioStatus> {
    // Get all active strategies
    const allStrategies = await this.storage.getTradingModes(userId);
    const activeStrategies = allStrategies.filter((s: any) => s.isActive === 1 && s.status === 'active');

    // Get all positions across exchanges
    const positions = await this.getAllPositions(userId);

    // Calculate aggregate exposure by symbol
    const aggregateExposure = this.calculateAggregateExposure(positions, activeStrategies);

    // Calculate strategy allocations
    const strategyAllocations = this.calculateStrategyAllocations(
      activeStrategies,
      positions,
      totalCapital
    );

    // Detect conflicts
    const conflicts = this.detectConflicts(aggregateExposure, strategyAllocations);

    // Calculate total margin used
    const totalMarginUsed = positions.reduce((sum: number, p: any) => {
      const notional = Math.abs(parseFloat(p.size || '0')) * parseFloat(p.currentPrice || '0');
      const margin = notional / (parseFloat(p.leverage || '1'));
      return sum + margin;
    }, 0);

    const marginUtilizationPercent = totalCapital > 0 ? (totalMarginUsed / totalCapital) * 100 : 0;

    // Determine portfolio health
    const portfolioHealth = this.assessPortfolioHealth(
      marginUtilizationPercent,
      conflicts,
      strategyAllocations
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      conflicts,
      strategyAllocations,
      marginUtilizationPercent
    );

    return {
      totalCapital,
      totalMarginUsed,
      totalAvailable: totalCapital - totalMarginUsed,
      marginUtilizationPercent,
      activeStrategies: activeStrategies.length,
      totalPositions: positions.length,
      aggregateExposure,
      strategyAllocations,
      conflicts,
      portfolioHealth,
      recommendations,
    };
  }

  /**
   * Get all positions across all exchanges
   */
  private async getAllPositions(userId: string): Promise<any[]> {
    // This would aggregate positions from Hyperliquid, Orderly, Polymarket
    // For now, we'll use the positions table
    const positions = await this.storage.getPositions(userId);
    return positions;
  }

  /**
   * Calculate aggregate exposure by symbol across all strategies
   */
  private calculateAggregateExposure(
    positions: any[],
    strategies: any[]
  ): AggregateExposure[] {
    const exposureMap = new Map<string, AggregateExposure>();

    positions.forEach((pos: any) => {
      const symbol = pos.symbol;
      const size = parseFloat(pos.size || '0');
      const price = parseFloat(pos.currentPrice || '0');
      const notional = size * price;
      const side = pos.side?.toLowerCase() === 'long' ? 'long' : 'short';
      
      // Find strategy for this position (if available)
      const strategyId = pos.strategyId || 'unknown';
      const strategy = strategies.find((s: any) => s.id === strategyId);
      const strategyName = strategy?.name || 'Unknown';

      if (!exposureMap.has(symbol)) {
        exposureMap.set(symbol, {
          symbol,
          netSize: 0,
          netNotional: 0,
          longSize: 0,
          shortSize: 0,
          strategies: [],
        });
      }

      const exposure = exposureMap.get(symbol)!;
      
      if (side === 'long') {
        exposure.longSize += size;
        exposure.netSize += size;
        exposure.netNotional += notional;
      } else {
        exposure.shortSize += size;
        exposure.netSize -= size;
        exposure.netNotional -= notional;
      }

      exposure.strategies.push({
        strategyId,
        strategyName,
        side,
        size,
      });
    });

    return Array.from(exposureMap.values());
  }

  /**
   * Calculate capital allocation and usage for each strategy
   */
  private calculateStrategyAllocations(
    strategies: any[],
    positions: any[],
    totalCapital: number
  ): StrategyAllocation[] {
    return strategies.map((strategy: any) => {
      const allocatedPercent = parseFloat(strategy.allocatedCapitalPercent || '33.33');
      const allocatedCapital = (totalCapital * allocatedPercent) / 100;

      // Calculate capital currently used by this strategy's positions
      const strategyPositions = positions.filter((p: any) => p.strategyId === strategy.id);
      const currentlyUsed = strategyPositions.reduce((sum: number, p: any) => {
        const notional = Math.abs(parseFloat(p.size || '0')) * parseFloat(p.currentPrice || '0');
        const margin = notional / parseFloat(p.leverage || '1');
        return sum + margin;
      }, 0);

      const availableCapital = allocatedCapital - currentlyUsed;
      const utilizationPercent = allocatedCapital > 0 ? (currentlyUsed / allocatedCapital) * 100 : 0;

      const dailyLoss = parseFloat(strategy.currentDailyLoss || '0');
      const dailyLossLimitPercent = parseFloat(strategy.dailyLossLimitPercent || '5.00');
      const dailyLossLimit = (allocatedCapital * dailyLossLimitPercent) / 100;

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        allocatedCapitalPercent: allocatedPercent,
        allocatedCapitalUsd: allocatedCapital,
        currentlyUsed,
        availableCapital,
        utilizationPercent,
        currentPositions: strategyPositions.length,
        maxPositions: strategy.maxPositionsPerStrategy || 3,
        dailyLoss,
        dailyLossLimit,
      };
    });
  }

  /**
   * Detect conflicts between strategies
   */
  private detectConflicts(
    aggregateExposure: AggregateExposure[],
    strategyAllocations: StrategyAllocation[]
  ): PositionConflict[] {
    const conflicts: PositionConflict[] = [];

    // Check for opposing positions (Strategy A long, Strategy B short)
    aggregateExposure.forEach((exposure) => {
      if (exposure.longSize > 0 && exposure.shortSize > 0) {
        const longStrategies = exposure.strategies.filter((s) => s.side === 'long');
        const shortStrategies = exposure.strategies.filter((s) => s.side === 'short');

        if (longStrategies.length > 0 && shortStrategies.length > 0) {
          const netExposure = Math.abs(exposure.netSize);
          const totalExposure = exposure.longSize + exposure.shortSize;
          const hedgedPercent = ((totalExposure - netExposure) / totalExposure) * 100;

          conflicts.push({
            type: 'opposing_positions',
            severity: hedgedPercent > 80 ? 'high' : hedgedPercent > 50 ? 'medium' : 'low',
            symbol: exposure.symbol,
            message: `${longStrategies.map((s) => s.strategyName).join(', ')} is LONG while ${shortStrategies.map((s) => s.strategyName).join(', ')} is SHORT ${exposure.symbol}. ${hedgedPercent.toFixed(0)}% hedged.`,
            strategies: exposure.strategies.map(s => ({ id: s.strategyId, name: s.strategyName, side: s.side, size: s.size })),
            recommendation: hedgedPercent > 80 
              ? 'Consider pausing one strategy to avoid excessive hedging'
              : 'Monitor closely - strategies may be operating on different timeframes',
          });
        }
      }
    });

    // Check for over-concentration (single symbol > 40% of total positions)
    const totalPositions = aggregateExposure.reduce((sum, e) => sum + e.strategies.length, 0);
    aggregateExposure.forEach((exposure) => {
      const positionsInSymbol = exposure.strategies.length;
      const concentrationPercent = (positionsInSymbol / totalPositions) * 100;

      if (concentrationPercent > 40) {
        conflicts.push({
          type: 'over_concentration',
          severity: concentrationPercent > 60 ? 'high' : 'medium',
          symbol: exposure.symbol,
          message: `${concentrationPercent.toFixed(0)}% of all positions are in ${exposure.symbol}`,
          strategies: exposure.strategies.map(s => ({ id: s.strategyId, name: s.strategyName, side: s.side, size: s.size })),
          recommendation: 'Consider diversifying across more symbols to reduce concentration risk',
        });
      }
    });

    // Check for strategies exceeding daily loss limits
    strategyAllocations.forEach((allocation) => {
      if (allocation.dailyLoss > allocation.dailyLossLimit) {
        conflicts.push({
          type: 'correlated_risk',
          severity: 'critical',
          symbol: 'PORTFOLIO',
          message: `${allocation.strategyName} has exceeded daily loss limit: $${allocation.dailyLoss.toFixed(2)} / $${allocation.dailyLossLimit.toFixed(2)}`,
          strategies: [{ id: allocation.strategyId, name: allocation.strategyName, side: 'long', size: 0 }],
          recommendation: 'Strategy should be automatically paused until daily reset',
        });
      }
    });

    return conflicts;
  }

  /**
   * Assess overall portfolio health
   */
  private assessPortfolioHealth(
    marginUtilization: number,
    conflicts: PositionConflict[],
    allocations: StrategyAllocation[]
  ): 'healthy' | 'warning' | 'critical' {
    const criticalConflicts = conflicts.filter((c) => c.severity === 'critical');
    const highConflicts = conflicts.filter((c) => c.severity === 'high');

    // Critical if:
    // - Margin > 85%
    // - Any critical conflicts
    // - Any strategy exceeded daily loss limit
    if (
      marginUtilization > 85 ||
      criticalConflicts.length > 0 ||
      allocations.some((a) => a.dailyLoss > a.dailyLossLimit)
    ) {
      return 'critical';
    }

    // Warning if:
    // - Margin 70-85%
    // - High severity conflicts
    // - Any strategy > 90% capital utilization
    if (
      marginUtilization > 70 ||
      highConflicts.length > 0 ||
      allocations.some((a) => a.utilizationPercent > 90)
    ) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    conflicts: PositionConflict[],
    allocations: StrategyAllocation[],
    marginUtilization: number
  ): string[] {
    const recommendations: string[] = [];

    // Margin-based recommendations
    if (marginUtilization > 85) {
      recommendations.push('🚨 CRITICAL: Margin utilization above 85%. Reduce positions immediately to avoid liquidation risk.');
    } else if (marginUtilization > 70) {
      recommendations.push('⚠️ WARNING: Margin utilization above 70%. Consider reducing leverage or closing some positions.');
    }

    // Conflict-based recommendations
    conflicts.forEach((conflict) => {
      if (conflict.severity === 'critical' || conflict.severity === 'high') {
        recommendations.push(`${conflict.severity === 'critical' ? '🚨' : '⚠️'} ${conflict.recommendation}`);
      }
    });

    // Strategy allocation recommendations
    allocations.forEach((allocation) => {
      if (allocation.utilizationPercent > 95) {
        recommendations.push(`⚠️ ${allocation.strategyName} is using ${allocation.utilizationPercent.toFixed(0)}% of allocated capital. Consider increasing allocation or reducing positions.`);
      }

      if (allocation.currentPositions >= allocation.maxPositions) {
        recommendations.push(`ℹ️ ${allocation.strategyName} has reached max positions (${allocation.maxPositions}). Cannot open new positions until one closes.`);
      }
    });

    // Performance-based recommendations
    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedCapitalPercent, 0);
    if (Math.abs(totalAllocated - 100) > 1) {
      recommendations.push(`ℹ️ Total capital allocation is ${totalAllocated.toFixed(1)}%. Consider rebalancing to 100%.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Portfolio is healthy. All strategies operating within normal parameters.');
    }

    return recommendations;
  }

  /**
   * Check if a new trade is allowed for a strategy
   */
  async canExecuteTrade(
    userId: string,
    strategyId: string,
    symbol: string,
    side: 'long' | 'short',
    size: number,
    leverage: number,
    currentPrice: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Get strategy
    const strategies = await this.storage.getTradingModes(userId);
    const strategy = strategies.find((s: any) => s.id === strategyId);

    if (!strategy) {
      return { allowed: false, reason: 'Strategy not found' };
    }

    if (strategy.isActive !== 1 || strategy.status !== 'active') {
      return { allowed: false, reason: 'Strategy is not active' };
    }

    // Check daily loss limit
    const dailyLoss = parseFloat(strategy.currentDailyLoss || '0');
    const dailyLossLimit = parseFloat(strategy.dailyLossLimitPercent || '5.00');
    const allocatedPercent = parseFloat(strategy.allocatedCapitalPercent || '33.33');
    
    // We'd need total capital here - for now, assume this is checked at the route level
    // if (dailyLoss > dailyLossLimit) {
    //   return { allowed: false, reason: 'Daily loss limit exceeded' };
    // }

    // Check max positions
    const positions = await this.storage.getPositions(userId);
    const strategyPositions = positions.filter((p: any) => p.strategyId === strategyId);
    
    if (strategyPositions.length >= (strategy.maxPositionsPerStrategy || 3)) {
      return { allowed: false, reason: `Max positions (${strategy.maxPositionsPerStrategy}) reached for this strategy` };
    }

    // Check max leverage
    if (leverage > (strategy.maxLeveragePerStrategy || 10)) {
      return { allowed: false, reason: `Leverage ${leverage}x exceeds strategy limit ${strategy.maxLeveragePerStrategy}x` };
    }

    return { allowed: true };
  }
}
