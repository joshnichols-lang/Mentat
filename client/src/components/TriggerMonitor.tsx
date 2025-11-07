import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingDown, Zap, CheckCircle2, AlertCircle, Eye, Target } from "lucide-react";

interface TriggerStatus {
  id: string;
  type: string;
  description: string;
  state: 'idle' | 'watching' | 'armed' | 'fired' | 'cooldown';
  currentValue: number | null;
  targetValue: number;
  operator: string;
  lastFired: number | null;
  fireCount: number;
  lastStateChange: number;
}

interface TriggerData {
  success: boolean;
  hasActiveTriggers: boolean;
  triggers: TriggerStatus[];
  stats: {
    totalTriggers: number;
    states: {
      idle: number;
      watching: number;
      armed: number;
      fired: number;
      cooldown: number;
    };
    totalFires: number;
  } | null;
  costMetrics: {
    monitoringFrequencyMinutes: number;
    potentialCallsPerDay: number;
    actualCallsToday: number;
    reductionPercent: number;
    potentialCostPerDay: string;
    actualCostToday: string;
    savingsToday: string;
  } | null;
  message?: string;
}

const STATE_COLORS = {
  idle: 'bg-gray-500/10 text-gray-700 dark:text-gray-300',
  watching: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  armed: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  fired: 'bg-green-500/10 text-green-700 dark:text-green-300',
  cooldown: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
};

const STATE_ICONS = {
  idle: <AlertCircle className="h-3 w-3" />,
  watching: <Eye className="h-3 w-3" />,
  armed: <Target className="h-3 w-3" />,
  fired: <Zap className="h-3 w-3" />,
  cooldown: <CheckCircle2 className="h-3 w-3" />,
};

export function TriggerMonitor() {
  const { data: triggerData } = useQuery<TriggerData>({
    queryKey: ['/api/monitoring/triggers'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (!triggerData?.success || !triggerData.hasActiveTriggers) {
    return null; // Don't show if no active triggers
  }

  const { triggers, stats, costMetrics } = triggerData;

  return (
    <Card data-testid="card-trigger-monitor">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Event-Driven Triggers</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Cost Reduction Summary */}
          {costMetrics && (
            <div className="p-2 bg-green-50 dark:bg-green-900/10 rounded border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">
                  {costMetrics.reductionPercent}% AI cost reduction
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-muted-foreground">Potential:</span>
                  <div className="font-semibold">{costMetrics.potentialCallsPerDay} calls/day</div>
                  <div className="text-muted-foreground">${costMetrics.potentialCostPerDay}/day</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Actual:</span>
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    {costMetrics.actualCallsToday} calls today
                  </div>
                  <div className="text-green-600 dark:text-green-400">${costMetrics.actualCostToday} today</div>
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-green-200 dark:border-green-800">
                <span className="text-[10px] text-muted-foreground">Savings: </span>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  ${costMetrics.savingsToday}/day
                </span>
              </div>
            </div>
          )}

          {/* Trigger States Summary */}
          {stats && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Active Triggers: {stats.totalTriggers}</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.states).map(([state, count]) => (
                  count > 0 && (
                    <Badge 
                      key={state} 
                      variant="outline" 
                      className={`text-[10px] ${STATE_COLORS[state as keyof typeof STATE_COLORS]}`}
                      data-testid={`badge-state-${state}`}
                    >
                      {STATE_ICONS[state as keyof typeof STATE_ICONS]}
                      <span className="ml-1">{state}: {count}</span>
                    </Badge>
                  )
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Total fires: {stats.totalFires}
              </div>
            </div>
          )}

          {/* Individual Trigger Status */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {triggers.map((trigger) => (
              <div 
                key={trigger.id} 
                className="p-2 bg-card border border-border rounded-md text-xs"
                data-testid={`trigger-${trigger.id}`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" title={trigger.description}>
                      {trigger.description}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {trigger.type.toUpperCase()}
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] flex-shrink-0 ${STATE_COLORS[trigger.state]}`}
                  >
                    {STATE_ICONS[trigger.state]}
                    <span className="ml-1">{trigger.state}</span>
                  </Badge>
                </div>
                {trigger.currentValue !== null && (
                  <div className="text-[10px] text-muted-foreground">
                    Current: <span className="font-mono">{trigger.currentValue.toFixed(2)}</span> | 
                    Target: <span className="font-mono">{trigger.operator} {trigger.targetValue}</span>
                  </div>
                )}
                {trigger.fireCount > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    Fired: {trigger.fireCount} times
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
