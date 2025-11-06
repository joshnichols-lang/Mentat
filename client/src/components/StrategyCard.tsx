import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, TrendingUp, TrendingDown, Settings } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StrategyCardProps {
  strategy: {
    id: string;
    name: string;
    type: string;
    description?: string;
    status: 'active' | 'paused' | 'stopped';
    allocatedCapitalPercent: string;
    maxPositionsPerStrategy: number;
    maxLeveragePerStrategy: number;
    dailyLossLimitPercent: string;
    currentDailyLoss: string;
    parameters: any;
  };
  allocation?: {
    allocatedCapitalUsd: number;
    currentlyUsed: number;
    availableCapital: number;
    utilizationPercent: number;
    currentPositions: number;
    maxPositions: number;
    dailyLoss: number;
    dailyLossLimit: number;
  };
  onEdit?: () => void;
}

export function StrategyCard({ strategy, allocation, onEdit }: StrategyCardProps) {
  const { toast } = useToast();
  const [isAdjustingAllocation, setIsAdjustingAllocation] = useState(false);
  const [newAllocation, setNewAllocation] = useState(parseFloat(strategy.allocatedCapitalPercent || '33.33'));

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'paused' | 'stopped') => {
      return await apiRequest("POST", `/api/trading-modes/${strategy.id}/status`, {
        status: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading-modes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio-manager/status'] });
      toast({ description: "Strategy status updated" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || "Failed to update strategy status",
      });
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async (allocationPercent: number) => {
      const response = await apiRequest("PATCH", `/api/trading-modes/${strategy.id}`, {
        allocatedCapitalPercent: allocationPercent.toFixed(2),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading-modes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio-manager/status'] });
      toast({ description: "Capital allocation updated" });
      setIsAdjustingAllocation(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || "Failed to update capital allocation",
      });
    },
  });

  const handleStatusChange = (newStatus: 'active' | 'paused' | 'stopped') => {
    updateStatusMutation.mutate(newStatus);
  };

  const handleSaveAllocation = () => {
    updateAllocationMutation.mutate(newAllocation);
  };

  const statusColors = {
    active: 'bg-success/20 text-success border-success/30',
    paused: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    stopped: 'bg-muted text-muted-foreground border-border/30',
  };

  const utilizationColor = allocation
    ? allocation.utilizationPercent > 90
      ? 'text-destructive'
      : allocation.utilizationPercent > 70
      ? 'text-yellow-500'
      : 'text-success'
    : 'text-muted-foreground';

  const dailyLossPercent = allocation && allocation.dailyLossLimit > 0
    ? (allocation.dailyLoss / allocation.dailyLossLimit) * 100
    : 0;

  return (
    <Card className="bg-card border-border/50" data-testid={`strategy-card-${strategy.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base">{strategy.name}</CardTitle>
              <Badge variant="outline" className={statusColors[strategy.status]}>
                {strategy.status}
              </Badge>
            </div>
            {strategy.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{strategy.description}</p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            data-testid="button-edit-strategy"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {strategy.status !== 'active' && (
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => handleStatusChange('active')}
              disabled={updateStatusMutation.isPending}
              data-testid="button-start-strategy"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          {strategy.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleStatusChange('paused')}
              disabled={updateStatusMutation.isPending}
              data-testid="button-pause-strategy"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => handleStatusChange('stopped')}
            disabled={updateStatusMutation.isPending}
            data-testid="button-stop-strategy"
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        </div>

        {/* Capital Allocation */}
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Capital Allocation</span>
            {!isAdjustingAllocation ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => setIsAdjustingAllocation(true)}
                data-testid="button-adjust-allocation"
              >
                Adjust
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => {
                    setNewAllocation(parseFloat(strategy.allocatedCapitalPercent));
                    setIsAdjustingAllocation(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleSaveAllocation}
                  disabled={updateAllocationMutation.isPending}
                  data-testid="button-save-allocation"
                >
                  Save
                </Button>
              </div>
            )}
          </div>

          {!isAdjustingAllocation ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold font-mono">{parseFloat(strategy.allocatedCapitalPercent).toFixed(1)}%</span>
                {allocation && (
                  <span className="text-xs text-muted-foreground">
                    ${allocation.allocatedCapitalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Slider
                value={[newAllocation]}
                onValueChange={(values) => setNewAllocation(values[0])}
                min={5}
                max={100}
                step={0.1}
                className="w-full"
              />
              <div className="text-center text-sm font-mono font-semibold">
                {newAllocation.toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* Utilization & Position Stats */}
        {allocation && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Capital Utilization</span>
                <span className={`font-mono font-semibold ${utilizationColor}`}>
                  {allocation.utilizationPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={allocation.utilizationPercent} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used: ${allocation.currentlyUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span>Available: ${allocation.availableCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 bg-muted/30 rounded-lg border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Positions</p>
                <p className="text-sm font-mono font-semibold">
                  {allocation.currentPositions} / {allocation.maxPositions}
                </p>
              </div>
              <div className="p-2 bg-muted/30 rounded-lg border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Max Leverage</p>
                <p className="text-sm font-mono font-semibold">
                  {strategy.maxLeveragePerStrategy}x
                </p>
              </div>
            </div>

            {/* Daily Loss Tracker */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Daily Loss</span>
                <span className={`font-mono font-semibold ${
                  dailyLossPercent > 80 ? 'text-destructive' : dailyLossPercent > 60 ? 'text-yellow-500' : 'text-success'
                }`}>
                  ${allocation.dailyLoss.toFixed(2)} / ${allocation.dailyLossLimit.toFixed(2)}
                </span>
              </div>
              <Progress value={Math.min(dailyLossPercent, 100)} className="h-1.5" />
            </div>
          </div>
        )}

        {/* Strategy Parameters Preview */}
        <div className="pt-2 border-t border-border/30">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Timeframe:</span>
              <span className="ml-1 font-mono">{strategy.parameters?.timeframe || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Risk/Trade:</span>
              <span className="ml-1 font-mono">{strategy.parameters?.riskPercentPerTrade || 'N/A'}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
