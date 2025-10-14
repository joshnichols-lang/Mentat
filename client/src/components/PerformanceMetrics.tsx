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
      <h2 className="mb-4 text-lg font-semibold">Performance</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((metric, i) => (
          <Card key={i} className="p-4" data-testid={`card-metric-${i}`}>
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <metric.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{metric.label}</div>
                <div className="mt-1 text-2xl font-mono font-bold" data-testid={`text-metric-${i}`}>
                  {metric.value}
                </div>
                {metric.change && (
                  <div className={`mt-1 text-xs ${
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
