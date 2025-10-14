import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function PortfolioPerformanceChart() {
  // todo: remove mock functionality
  const data = [
    { date: "Jan 1", portfolio: 10000, btcHold: 10000 },
    { date: "Jan 3", portfolio: 10250, btcHold: 10150 },
    { date: "Jan 5", portfolio: 10520, btcHold: 10280 },
    { date: "Jan 7", portfolio: 10380, btcHold: 10450 },
    { date: "Jan 9", portfolio: 10890, btcHold: 10520 },
    { date: "Jan 11", portfolio: 11250, btcHold: 10680 },
    { date: "Jan 13", portfolio: 11520, btcHold: 10890 },
    { date: "Jan 14", portfolio: 11900, btcHold: 11050 },
  ];

  return (
    <Card className="p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Portfolio Performance</h2>
        <p className="text-xs text-muted-foreground">AI vs Buy & Hold BTC</p>
      </div>
      
      <ResponsiveContainer width="100%" height={250}>
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
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
          />
          <Legend 
            wrapperStyle={{ 
              paddingTop: "20px",
              color: "hsl(var(--foreground))"
            }}
          />
          <Line 
            type="monotone" 
            dataKey="portfolio" 
            stroke="hsl(var(--chart-1))" 
            strokeWidth={2}
            name="AI Portfolio"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="btcHold" 
            stroke="hsl(var(--chart-4))" 
            strokeWidth={2}
            name="Buy & Hold BTC"
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
        <div>
          <div className="text-xs text-muted-foreground">AI Return</div>
          <div className="font-mono text-sm font-semibold text-chart-2">+19.0%</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">BTC Return</div>
          <div className="font-mono text-sm font-semibold text-chart-4">+10.5%</div>
        </div>
      </div>
    </Card>
  );
}
