import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function SharpeRatioChart() {
  // todo: remove mock functionality
  const data = [
    { date: "Jan 1", sharpe: 0.0 },
    { date: "Jan 3", sharpe: 0.85 },
    { date: "Jan 5", sharpe: 1.12 },
    { date: "Jan 7", sharpe: 0.95 },
    { date: "Jan 9", sharpe: 1.35 },
    { date: "Jan 11", sharpe: 1.52 },
    { date: "Jan 13", sharpe: 1.68 },
    { date: "Jan 14", sharpe: 1.85 },
  ];

  return (
    <Card className="p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Sharpe Ratio</h2>
        <p className="text-xs text-muted-foreground">Risk-adjusted returns</p>
      </div>
      
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            domain={[0, 2.5]}
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
            dataKey="sharpe" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div>
          <div className="text-xs text-muted-foreground">Current</div>
          <div className="font-mono text-xl font-bold text-primary">1.85</div>
        </div>
        <div className="text-xs text-chart-2">Excellent</div>
      </div>
    </Card>
  );
}
