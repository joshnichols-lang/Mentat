import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";

export default function PortfolioPerformanceChart() {
  const { data: snapshots } = useQuery<any>({
    queryKey: ['/api/portfolio/snapshots'],
    refetchInterval: 30000,
  });

  const data = snapshots?.snapshots || [];
  const hasData = data.length > 0;

  return (
    <Card className="p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Portfolio Performance</h2>
        <p className="text-xs text-muted-foreground">Historical portfolio value tracking</p>
      </div>
      
      {!hasData ? (
        <div className="flex h-[250px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No historical data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start trading to see your portfolio performance</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
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
              tickFormatter={(value) => `$${value.toLocaleString()}`}
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
              dataKey="totalValue" 
              stroke="hsl(var(--chart-1))" 
              strokeWidth={2}
              name="Portfolio Value"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
