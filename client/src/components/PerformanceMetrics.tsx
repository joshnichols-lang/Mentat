import { TrendingUp, Wallet, DollarSign, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";

interface Metric {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export default function PerformanceMetrics() {
  const { data: userState } = useQuery<any>({
    queryKey: ['/api/hyperliquid/user-state'],
    refetchInterval: 30000,
  });

  const { data: snapshots } = useQuery<any>({
    queryKey: ['/api/portfolio/snapshots'],
    refetchInterval: 30000,
  });

  const accountValue = (userState?.userState?.marginSummary?.accountValue as number) || 0;
  const withdrawable = (userState?.userState?.withdrawable as number) || 0;
  const marginUsed = (userState?.userState?.marginSummary?.totalMarginUsed as number) || 0;
  
  const allSnapshots = snapshots?.snapshots || [];
  const latestSnapshot = allSnapshots.length > 0 ? allSnapshots[allSnapshots.length - 1] : null;
  const maxDrawdown = latestSnapshot ? Number(latestSnapshot.maxDrawdown || 0) : 0;

  const metrics: Metric[] = [
    {
      icon: DollarSign,
      label: "Portfolio Value",
      value: `$${accountValue.toFixed(2)}`,
      change: undefined,
      positive: true,
    },
    {
      icon: Wallet,
      label: "Free Margin",
      value: `$${withdrawable.toFixed(2)}`,
      change: undefined,
      positive: true,
    },
    {
      icon: TrendingUp,
      label: "Margin Used",
      value: `$${marginUsed.toFixed(2)}`,
      change: marginUsed > 0 ? `${((marginUsed / accountValue) * 100).toFixed(1)}%` : undefined,
      positive: marginUsed === 0,
    },
    {
      icon: TrendingDown,
      label: "Max Drawdown",
      value: `${(maxDrawdown * 100).toFixed(2)}%`,
      change: undefined,
      positive: maxDrawdown === 0,
    },
  ];

  return (
    <TooltipProvider>
      <div>
        <h2 className="mb-3 text-sm font-semibold">Account Overview</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Card className="p-3" data-testid={`card-metric-${i}`}>
                  <div className="flex items-start gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5">
                      <metric.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{metric.label}</div>
                      <div className="mt-0.5 font-mono text-xl font-bold" data-testid={`text-metric-${i}`}>
                        {metric.value}
                      </div>
                      {metric.change && (
                        <div className={`mt-0.5 text-xs ${
                          metric.positive ? "text-chart-2" : "text-muted-foreground"
                        }`}>
                          {metric.change}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                {i === 0 && "Total account equity including positions and unrealized P&L"}
                {i === 1 && "Available capital for opening new positions (withdrawable balance)"}
                {i === 2 && "Capital committed to maintaining open positions"}
                {i === 3 && "Largest portfolio decline from peak"}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
