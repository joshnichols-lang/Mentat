import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TradingMode } from "@shared/schema";

interface StrategyCardProps {
  strategy: TradingMode;
  performanceMetrics?: {
    roi: number;
    winRate: number;
    totalTrades: number;
    maxDrawdown: number;
  };
  onActivate?: (strategyId: string) => void;
  className?: string;
  isActive?: boolean;
}

export function StrategyCard({
  strategy,
  performanceMetrics,
  onActivate,
  className,
  isActive = false,
}: StrategyCardProps) {
  const hasAvatar = !!strategy.avatarUrl;
  const hasMetrics = !!performanceMetrics;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden bg-black border-white/10 hover-elevate transition-all duration-200",
        isActive && "ring-2 ring-[#00FF41]",
        className
      )}
      data-testid={`card-strategy-${strategy.id}`}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-4 right-4 z-10">
          <Badge className="bg-[#00FF41] text-black hover:bg-[#00FF41]" data-testid="badge-active-strategy">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Active
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            {hasAvatar ? (
              <img
                src={`/attached_assets${strategy.avatarUrl}`}
                alt={strategy.name}
                className="w-20 h-20 rounded-md object-cover border border-white/20"
                data-testid="img-strategy-avatar"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-md bg-white/5 border border-white/20 flex items-center justify-center"
                data-testid="div-strategy-avatar-placeholder"
              >
                <Activity className="w-10 h-10 text-white/30" />
              </div>
            )}
          </div>

          {/* Strategy Info */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-xl font-semibold text-white tracking-tight truncate"
              data-testid="text-strategy-name"
            >
              {strategy.name}
            </h3>
            {strategy.tagline && (
              <p
                className="text-sm text-white/60 mt-1 truncate font-medium"
                data-testid="text-strategy-tagline"
              >
                {strategy.tagline}
              </p>
            )}
            {strategy.type && strategy.type !== "custom" && (
              <Badge
                variant="outline"
                className="mt-2 text-xs border-white/20 text-white/70"
                data-testid="badge-strategy-type"
              >
                {strategy.type}
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        {strategy.description && (
          <p
            className="text-sm text-white/50 mt-3 line-clamp-2"
            data-testid="text-strategy-description"
          >
            {strategy.description}
          </p>
        )}
      </CardHeader>

      {/* Performance Metrics */}
      {hasMetrics && (
        <CardContent className="pt-0 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {/* ROI */}
            <div
              className="flex flex-col gap-1 p-3 rounded-md bg-white/5 border border-white/10"
              data-testid="metric-roi"
            >
              <div className="flex items-center gap-1.5">
                {performanceMetrics.roi >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[#00FF41]" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-[#FF3B69]" />
                )}
                <span className="text-xs text-white/50 uppercase tracking-wide">ROI</span>
              </div>
              <span
                className={cn(
                  "text-2xl font-mono font-semibold tracking-tight",
                  performanceMetrics.roi >= 0 ? "text-[#00FF41]" : "text-[#FF3B69]"
                )}
                data-testid="value-roi"
              >
                {performanceMetrics.roi >= 0 ? "+" : ""}
                {performanceMetrics.roi.toFixed(1)}%
              </span>
            </div>

            {/* Win Rate */}
            <div
              className="flex flex-col gap-1 p-3 rounded-md bg-white/5 border border-white/10"
              data-testid="metric-win-rate"
            >
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-white/50" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Win Rate</span>
              </div>
              <span
                className="text-2xl font-mono font-semibold tracking-tight text-white"
                data-testid="value-win-rate"
              >
                {performanceMetrics.winRate.toFixed(0)}%
              </span>
            </div>

            {/* Total Trades */}
            <div
              className="flex flex-col gap-1 p-3 rounded-md bg-white/5 border border-white/10"
              data-testid="metric-trades"
            >
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-white/50" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Trades</span>
              </div>
              <span
                className="text-2xl font-mono font-semibold tracking-tight text-white"
                data-testid="value-trades"
              >
                {performanceMetrics.totalTrades}
              </span>
            </div>

            {/* Max Drawdown */}
            <div
              className="flex flex-col gap-1 p-3 rounded-md bg-white/5 border border-white/10"
              data-testid="metric-max-drawdown"
            >
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-white/50" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Max DD</span>
              </div>
              <span
                className="text-2xl font-mono font-semibold tracking-tight text-[#FF3B69]"
                data-testid="value-max-drawdown"
              >
                -{Math.abs(performanceMetrics.maxDrawdown).toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      )}

      {/* Action Button */}
      <CardFooter className="pt-0 pb-4">
        <Button
          variant={isActive ? "outline" : "default"}
          className={cn(
            "w-full font-medium",
            !isActive && "bg-[#00FF41] text-black hover:bg-[#00FF41]/90 border-[#00FF41]"
          )}
          onClick={() => onActivate?.(strategy.id)}
          disabled={isActive}
          data-testid="button-activate-strategy"
        >
          {isActive ? "Currently Active" : "Activate Strategy"}
        </Button>
      </CardFooter>
    </Card>
  );
}
