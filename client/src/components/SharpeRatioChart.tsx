import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useQuery } from "@tanstack/react-query";

export default function SharpeRatioChart() {
  const { data: snapshots } = useQuery<any>({
    queryKey: ['/api/portfolio/snapshots'],
    refetchInterval: 30000,
  });

  const data = snapshots?.snapshots || [];
  const hasData = data.length > 0;
  const currentSharpe = hasData ? data[data.length - 1]?.sharpeRatio || 0 : 0;

  return (
    <Card className="p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Sharpe Ratio</h2>
        <p className="text-xs text-muted-foreground">Risk-adjusted returns</p>
      </div>
      
      {!hasData ? (
        <div className="flex h-[200px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No performance data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start trading to track risk-adjusted returns</p>
          </div>
        </div>
      ) : (
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
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number) => [value.toFixed(2), "Sharpe Ratio"]}
            />
            <ReferenceLine 
              y={1} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3"
              label={{ value: "Good (1.0)", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <ReferenceLine 
              y={2} 
              stroke="hsl(var(--chart-2))" 
              strokeDasharray="3 3"
              label={{ value: "Excellent (2.0)", position: "right", fill: "hsl(var(--chart-2))", fontSize: 11 }}
            />
            <Line 
              type="monotone" 
              dataKey="sharpeRatio" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      
      {hasData && (
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div>
            <div className="text-xs text-muted-foreground">Current</div>
            <div className="font-mono text-xl font-bold text-primary">{currentSharpe.toFixed(2)}</div>
          </div>
          <div className="text-xs text-chart-2">
            {currentSharpe >= 2 ? "Excellent" : currentSharpe >= 1 ? "Good" : "Developing"}
          </div>
        </div>
      )}
    </Card>
  );
}
