/**
 * PHASE 4: Event-Driven AI Trigger System
 * Trigger Supervisor - Monitors indicator values and fires AI calls when conditions met
 * 
 * State Machine: Idle → Watching → Armed → Fired → (cooldown) → Watching
 * - Idle: No monitoring active
 * - Watching: Monitoring indicator but not close to threshold
 * - Armed: Close to threshold (within hysteresis range)
 * - Fired: Trigger condition met - call AI
 */

import { TriggerSpec } from './strategyAnalyzer';
import { IndicatorEngine } from './indicatorEngine';
import type { EventEmitter } from 'events';

/**
 * Trigger state tracking
 */
enum TriggerState {
  IDLE = 'idle',
  WATCHING = 'watching',
  ARMED = 'armed',
  FIRED = 'fired',
  COOLDOWN = 'cooldown'
}

interface TriggerStatus {
  trigger: TriggerSpec;
  state: TriggerState;
  currentValue: number | null;
  targetValue: number;
  lastFired: number | null;
  lastStateChange: number;
  fireCount: number;
}

/**
 * Callback when trigger fires
 */
type TriggerFireCallback = (trigger: TriggerSpec, currentValue: number) => Promise<void>;

/**
 * TriggerSupervisor manages a set of triggers for a strategy
 */
export class TriggerSupervisor {
  private triggers: Map<string, TriggerStatus> = new Map();
  private symbol: string;
  private userId: string;
  private strategyId: string;
  private onTriggerFire: TriggerFireCallback;
  private checkIntervalId: NodeJS.Timeout | null = null;
  
  // Near-miss detection
  private nearMissThreshold = 0.8; // 80% toward threshold
  private nearMissTimeoutMinutes = 5; // Check AI if near-miss for 5 minutes
  private nearMissTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    userId: string,
    strategyId: string,
    symbol: string,
    triggers: TriggerSpec[],
    onTriggerFire: TriggerFireCallback
  ) {
    this.userId = userId;
    this.strategyId = strategyId;
    this.symbol = symbol;
    this.onTriggerFire = onTriggerFire;
    
    // Initialize trigger states
    triggers.forEach(trigger => {
      this.triggers.set(trigger.id, {
        trigger,
        state: TriggerState.IDLE,
        currentValue: null,
        targetValue: trigger.value,
        lastFired: null,
        lastStateChange: Date.now(),
        fireCount: 0
      });
    });
    
    console.log(`[TriggerSupervisor] Initialized for ${userId}/${strategyId} with ${triggers.length} triggers on ${symbol}`);
  }
  
  /**
   * Start monitoring triggers (check every 10 seconds)
   */
  start(): void {
    if (this.checkIntervalId) {
      console.log('[TriggerSupervisor] Already running');
      return;
    }
    
    console.log(`[TriggerSupervisor] Starting monitoring for ${this.symbol}`);
    
    // Check triggers every 10 seconds
    this.checkIntervalId = setInterval(() => {
      this.checkTriggers();
    }, 10000);
    
    // Run initial check
    this.checkTriggers();
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    
    // Clear near-miss timers
    this.nearMissTimers.forEach(timer => clearTimeout(timer));
    this.nearMissTimers.clear();
    
    console.log(`[TriggerSupervisor] Stopped monitoring for ${this.symbol}`);
  }
  
  /**
   * Check all triggers and update states
   */
  private async checkTriggers(): Promise<void> {
    // Ensure we have data
    if (!IndicatorEngine.hasData(this.symbol, 14)) {
      return;
    }
    
    const now = Date.now();
    
    for (const [triggerId, status] of Array.from(this.triggers.entries())) {
      const { trigger } = status;
      
      // Get current indicator value
      const currentValue = this.getIndicatorValue(trigger);
      if (currentValue === null) {
        continue;
      }
      
      status.currentValue = currentValue;
      
      // Check cooldown
      if (status.state === TriggerState.COOLDOWN) {
        const cooldownMs = (trigger.cooldownMinutes || 5) * 60 * 1000;
        if (status.lastFired && now - status.lastFired < cooldownMs) {
          continue; // Still in cooldown
        }
        // Cooldown expired - back to watching
        this.setState(status, TriggerState.WATCHING);
      }
      
      // Evaluate trigger condition
      const conditionMet = this.evaluateCondition(trigger, currentValue);
      const isNearMiss = this.isNearMiss(trigger, currentValue);
      
      // State machine transitions
      switch (status.state) {
        case TriggerState.IDLE:
        case TriggerState.WATCHING:
          if (conditionMet) {
            // Condition met - fire!
            await this.fireTrigger(status, currentValue);
          } else if (isNearMiss) {
            // Getting close - arm trigger
            this.setState(status, TriggerState.ARMED);
            this.startNearMissTimer(status);
          }
          break;
          
        case TriggerState.ARMED:
          if (conditionMet) {
            // Condition met - fire!
            await this.fireTrigger(status, currentValue);
          } else if (!isNearMiss) {
            // Moved away from threshold - back to watching
            this.setState(status, TriggerState.WATCHING);
            this.clearNearMissTimer(triggerId);
          }
          break;
      }
    }
  }
  
  /**
   * Get indicator value based on trigger spec
   */
  private getIndicatorValue(trigger: TriggerSpec): number | null {
    switch (trigger.indicator) {
      case 'RSI':
        return IndicatorEngine.getRSI(this.symbol, trigger.period || 14);
        
      case 'SMA':
        return IndicatorEngine.getSMA(this.symbol, trigger.period || 20);
        
      case 'EMA':
        return IndicatorEngine.getEMA(this.symbol, trigger.period || 20);
        
      case 'MACD':
        const macd = IndicatorEngine.getMACD(this.symbol);
        return macd ? macd.histogram : null;
        
      case 'ATR':
        return IndicatorEngine.getATR(this.symbol);
        
      case 'BB_UPPER':
        const bbUpper = IndicatorEngine.getBollingerBands(this.symbol);
        return bbUpper ? bbUpper.upper : null;
        
      case 'BB_LOWER':
        const bbLower = IndicatorEngine.getBollingerBands(this.symbol);
        return bbLower ? bbLower.lower : null;
        
      case 'VOLUME':
        return IndicatorEngine.getCurrentVolume(this.symbol);
        
      default:
        if (trigger.type === 'price') {
          return IndicatorEngine.getCurrentPrice(this.symbol);
        }
        return null;
    }
  }
  
  /**
   * Evaluate if trigger condition is met
   */
  private evaluateCondition(trigger: TriggerSpec, currentValue: number): boolean {
    const { operator, value } = trigger;
    
    switch (operator) {
      case '<':
        return currentValue < value;
      case '>':
        return currentValue > value;
      case '<=':
        return currentValue <= value;
      case '>=':
        return currentValue >= value;
      case '==':
        return Math.abs(currentValue - value) < (value * 0.01); // 1% tolerance
      case 'crosses_above':
        // TODO: Need previous value to detect crossover
        return currentValue > value;
      case 'crosses_below':
        // TODO: Need previous value to detect crossover
        return currentValue < value;
      default:
        return false;
    }
  }
  
  /**
   * Check if current value is near threshold (within hysteresis range)
   */
  private isNearMiss(trigger: TriggerSpec, currentValue: number): boolean {
    const { operator, value, hysteresis = 0.02 } = trigger;
    const threshold = value;
    const buffer = Math.abs(threshold * hysteresis);
    
    switch (operator) {
      case '<':
      case '<=':
        // Approaching from above
        return currentValue > threshold && currentValue <= threshold + buffer;
        
      case '>':
      case '>=':
        // Approaching from below
        return currentValue < threshold && currentValue >= threshold - buffer;
        
      case '==':
        return Math.abs(currentValue - threshold) <= buffer;
        
      case 'crosses_above':
      case 'crosses_below':
        return Math.abs(currentValue - threshold) <= buffer;
        
      default:
        return false;
    }
  }
  
  /**
   * Fire trigger - call AI callback
   */
  private async fireTrigger(status: TriggerStatus, currentValue: number): Promise<void> {
    console.log(`[TriggerSupervisor] 🎯 TRIGGER FIRED: ${status.trigger.id} (${status.trigger.description})`);
    console.log(`[TriggerSupervisor]    Current: ${currentValue}, Target: ${status.targetValue}`);
    
    status.fireCount++;
    status.lastFired = Date.now();
    this.setState(status, TriggerState.FIRED);
    
    // Clear near-miss timer if active
    this.clearNearMissTimer(status.trigger.id);
    
    try {
      // Call AI callback
      await this.onTriggerFire(status.trigger, currentValue);
    } catch (error) {
      console.error('[TriggerSupervisor] Error in trigger fire callback:', error);
    }
    
    // Enter cooldown
    this.setState(status, TriggerState.COOLDOWN);
  }
  
  /**
   * Start near-miss timer (call AI if stuck near threshold)
   */
  private startNearMissTimer(status: TriggerStatus): void {
    const triggerId = status.trigger.id;
    
    // Clear existing timer
    this.clearNearMissTimer(triggerId);
    
    // Set new timer
    const timerId = setTimeout(async () => {
      console.log(`[TriggerSupervisor] ⚠️ NEAR-MISS TIMEOUT: ${triggerId} - stuck near threshold for ${this.nearMissTimeoutMinutes} min`);
      
      // Call AI to reassess
      if (status.currentValue !== null) {
        await this.fireTrigger(status, status.currentValue);
      }
    }, this.nearMissTimeoutMinutes * 60 * 1000);
    
    this.nearMissTimers.set(triggerId, timerId);
  }
  
  /**
   * Clear near-miss timer
   */
  private clearNearMissTimer(triggerId: string): void {
    const timer = this.nearMissTimers.get(triggerId);
    if (timer) {
      clearTimeout(timer);
      this.nearMissTimers.delete(triggerId);
    }
  }
  
  /**
   * Set trigger state
   */
  private setState(status: TriggerStatus, newState: TriggerState): void {
    if (status.state !== newState) {
      console.log(`[TriggerSupervisor] ${status.trigger.id}: ${status.state} → ${newState}`);
      status.state = newState;
      status.lastStateChange = Date.now();
    }
  }
  
  /**
   * Get current status of all triggers
   */
  getStatus(): TriggerStatus[] {
    return Array.from(this.triggers.values());
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      totalTriggers: this.triggers.size,
      states: {
        idle: 0,
        watching: 0,
        armed: 0,
        fired: 0,
        cooldown: 0
      },
      totalFires: 0
    };
    
    this.triggers.forEach(status => {
      stats.states[status.state]++;
      stats.totalFires += status.fireCount;
    });
    
    return stats;
  }
}

/**
 * Global registry of active trigger supervisors
 */
class TriggerSupervisorRegistry {
  private supervisors: Map<string, TriggerSupervisor> = new Map();
  
  /**
   * Create and register a supervisor
   */
  create(
    userId: string,
    strategyId: string,
    symbol: string,
    triggers: TriggerSpec[],
    onTriggerFire: TriggerFireCallback
  ): TriggerSupervisor {
    const key = `${userId}:${strategyId}`;
    
    // Stop existing supervisor if any
    this.stop(userId, strategyId);
    
    const supervisor = new TriggerSupervisor(userId, strategyId, symbol, triggers, onTriggerFire);
    this.supervisors.set(key, supervisor);
    
    return supervisor;
  }
  
  /**
   * Get supervisor
   */
  get(userId: string, strategyId: string): TriggerSupervisor | undefined {
    const key = `${userId}:${strategyId}`;
    return this.supervisors.get(key);
  }
  
  /**
   * Stop and remove supervisor
   */
  stop(userId: string, strategyId: string): void {
    const key = `${userId}:${strategyId}`;
    const supervisor = this.supervisors.get(key);
    
    if (supervisor) {
      supervisor.stop();
      this.supervisors.delete(key);
    }
  }
  
  /**
   * Get all active supervisors
   */
  getAll(): TriggerSupervisor[] {
    return Array.from(this.supervisors.values());
  }
  
  /**
   * Stop all supervisors
   */
  stopAll(): void {
    this.supervisors.forEach(supervisor => supervisor.stop());
    this.supervisors.clear();
  }
}

// Singleton registry
export const TriggerRegistry = new TriggerSupervisorRegistry();
