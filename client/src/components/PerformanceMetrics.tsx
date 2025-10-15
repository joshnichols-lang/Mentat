import { TrendingUp, Wallet, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
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
    refetchInterval: 5000,
  });

  const accountValue = (userState?.userState?.marginSummary?.accountValue as number) || 0;
  const withdrawable = (userState?.userState?.withdrawable as number) || 0;
  const marginUsed = (userState?.userState?.marginSummary?.totalMarginUsed as number) || 0;

  const metrics: Metric[] = [
    {
      icon: DollarSign,
      label: "Account Value",
      value: `$${accountValue.toFixed(2)}`,
      change: undefined,
      positive: true,
    },
    {
      icon: Wallet,
      label: "Available",
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
  ];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Account Overview</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((metric, i) => (
          <Card key={i} className="p-3" data-testid={`card-metric-${i}`}>
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
        ))}
      </div>
    </div>
  );
}
