import { TrendingUp, Target, Award } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Metric {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export default function PerformanceMetrics() {
  // todo: remove mock functionality
  const metrics: Metric[] = [
    {
      icon: TrendingUp,
      label: "Total P&L",
      value: "+$1,900.00",
      change: "+8.2%",
      positive: true,
    },
    {
      icon: Target,
      label: "Sharpe Ratio",
      value: "1.85",
      change: "Good",
      positive: true,
    },
    {
      icon: Award,
      label: "Win Rate",
      value: "68%",
      change: "34/50 trades",
      positive: true,
    },
  ];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Performance</h2>
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
