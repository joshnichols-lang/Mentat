import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TimeRange, timeRanges, formatChartDate, filterDataByTimeRange } from "@/lib/chartUtils";

export default function PortfolioPerformanceChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
  
  const { data: snapshots } = useQuery<any>({
    queryKey: ['/api/portfolio/snapshots'],
    refetchInterval: 30000,
  });

  const allData = snapshots?.snapshots || [];
  
  // Filter data by time range and convert timestamps to numbers for linear scaling
  const data = useMemo(() => {
    const filtered = filterDataByTimeRange(allData, timeRange);
    return filtered.map((item: any) => ({
      ...item,
      timestampNum: new Date(item.timestamp).getTime(),
    }));
  }, [allData, timeRange]);
  
  const hasData = data.length > 0;

  // Format tick for display
  const formatXAxis = (timestamp: number) => {
    return formatChartDate(timestamp, timeRange);
  };

  return (
    <Card className="p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Portfolio Performance</h2>
          <p className="text-xs text-muted-foreground">Historical portfolio value tracking</p>
        </div>
      </div>

      <div className="mb-3 flex gap-1">
        {timeRanges.map((range) => (
          <Button
            key={range.value}
            variant={timeRange === range.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setTimeRange(range.value)}
            className="h-6 px-2 text-xs"
            data-testid={`button-portfolio-timerange-${range.value}`}
          >
            {range.label}
          </Button>
        ))}
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
              dataKey="timestampNum"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={formatXAxis}
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
              labelFormatter={(label) => formatChartDate(label, timeRange)}
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
