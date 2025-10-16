import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";

export default function SharpeRatioChart() {
  const { data: snapshots } = useQuery<any>({
    queryKey: ['/api/portfolio/snapshots'],
    refetchInterval: 30000,
  });

  const data = snapshots?.snapshots || [];
  const hasData = data.length > 0;
  const latestSnapshot = hasData ? data[data.length - 1] : null;
  const currentSharpe = latestSnapshot ? Number(latestSnapshot.sharpeRatio || 0) : 0;
  const currentSortino = latestSnapshot ? Number(latestSnapshot.sortinoRatio || 0) : 0;
  const currentCalmar = latestSnapshot ? Number(latestSnapshot.calmarRatio || 0) : 0;

  return (
    <Card className="p-3" data-testid="card-risk-ratios">
      <div className="mb-3">
        <h2 className="text-sm font-semibold" data-testid="text-chart-title">Risk-Adjusted Performance Ratios</h2>
        <p className="text-xs text-muted-foreground" data-testid="text-chart-subtitle">Sharpe, Sortino & Calmar ratios</p>
      </div>
      
      {!hasData ? (
        <div className="flex h-[200px] items-center justify-center" data-testid="container-no-data">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No performance data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start trading to track risk-adjusted returns</p>
          </div>
        </div>
      ) : (
        <>
          <div data-testid="container-chart">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: any, name: string) => {
                    const displayName = name === "sharpeRatio" ? "Sharpe" 
                      : name === "sortinoRatio" ? "Sortino" 
                      : "Calmar";
                    return [Number(value || 0).toFixed(2), displayName];
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value: string) => {
                    if (value === "sharpeRatio") return "Sharpe";
                    if (value === "sortinoRatio") return "Sortino";
                    if (value === "calmarRatio") return "Calmar";
                    return value;
                  }}
                />
                <ReferenceLine 
                  y={1} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="3 3"
                  label={{ value: "Good (1.0)", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <ReferenceLine 
                  y={2} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="3 3"
                  label={{ value: "Excellent (2.0)", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sharpeRatio" 
                  name="sharpeRatio"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sortinoRatio" 
                  name="sortinoRatio"
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-2))", r: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="calmarRatio" 
                  name="calmarRatio"
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-3))", r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3" data-testid="container-current-values">
            <div data-testid="container-sharpe">
              <div className="text-xs text-muted-foreground" data-testid="text-sharpe-label">Sharpe</div>
              <div className="font-mono text-base font-bold text-primary" data-testid="text-sharpe-value">{currentSharpe.toFixed(2)}</div>
            </div>
            <div data-testid="container-sortino">
              <div className="text-xs text-muted-foreground" data-testid="text-sortino-label">Sortino</div>
              <div className="font-mono text-base font-bold text-chart-2" data-testid="text-sortino-value">{currentSortino.toFixed(2)}</div>
            </div>
            <div data-testid="container-calmar">
              <div className="text-xs text-muted-foreground" data-testid="text-calmar-label">Calmar</div>
              <div className="font-mono text-base font-bold text-chart-3" data-testid="text-calmar-value">{currentCalmar.toFixed(2)}</div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
