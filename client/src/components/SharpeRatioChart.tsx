import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TimeRange, timeRanges, formatChartDate, filterDataByTimeRange } from "@/lib/chartUtils";

type RatioType = "sharpe" | "sortino" | "calmar";

export default function SharpeRatioChart() {
  const [selectedRatio, setSelectedRatio] = useState<RatioType>("sharpe");
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
  const latestSnapshot = hasData ? data[data.length - 1] : null;
  const currentSharpe = latestSnapshot ? Number(latestSnapshot.sharpeRatio || 0) : 0;
  const currentSortino = latestSnapshot ? Number(latestSnapshot.sortinoRatio || 0) : 0;
  const currentCalmar = latestSnapshot ? Number(latestSnapshot.calmarRatio || 0) : 0;

  const ratioConfig = {
    sharpe: {
      title: "Sharpe Ratio",
      description: "Return per unit of total volatility",
      dataKey: "sharpeRatio",
      color: "hsl(var(--primary))",
      current: currentSharpe,
    },
    sortino: {
      title: "Sortino Ratio",
      description: "Return per unit of downside volatility",
      dataKey: "sortinoRatio",
      color: "hsl(var(--chart-2))",
      current: currentSortino,
    },
    calmar: {
      title: "Calmar Ratio",
      description: "Annualized return per max drawdown",
      dataKey: "calmarRatio",
      color: "hsl(var(--chart-3))",
      current: currentCalmar,
    },
  };

  const config = ratioConfig[selectedRatio];

  // Format tick for display
  const formatXAxis = (timestamp: number) => {
    return formatChartDate(timestamp, timeRange);
  };

  return (
    <Card className="p-3" data-testid="card-risk-ratios">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" data-testid="text-chart-title">{config.title}</h2>
          <p className="text-xs text-muted-foreground" data-testid="text-chart-subtitle">{config.description}</p>
        </div>
        <div className="flex gap-1">
          <Button
            variant={selectedRatio === "sharpe" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedRatio("sharpe")}
            className="h-7 px-2 text-xs"
            data-testid="button-sharpe"
          >
            Sharpe
          </Button>
          <Button
            variant={selectedRatio === "sortino" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedRatio("sortino")}
            className="h-7 px-2 text-xs"
            data-testid="button-sortino"
          >
            Sortino
          </Button>
          <Button
            variant={selectedRatio === "calmar" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedRatio("calmar")}
            className="h-7 px-2 text-xs"
            data-testid="button-calmar"
          >
            Calmar
          </Button>
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
            data-testid={`button-timerange-${range.value}`}
          >
            {range.label}
          </Button>
        ))}
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
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: any) => [Number(value || 0).toFixed(2), config.title]}
                  labelFormatter={(label) => formatChartDate(label, timeRange)}
                />
                <ReferenceLine 
                  y={0} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeWidth={2}
                  label={{ value: "Breakeven (0)", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
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
                  dataKey={config.dataKey}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={{ fill: config.color, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 border-t pt-3" data-testid="container-current-value">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Current Value</div>
              <div className="font-mono text-xl font-bold" style={{ color: config.color }} data-testid="text-ratio-value">
                {config.current.toFixed(2)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {config.current >= 2 ? "Excellent performance" : config.current >= 1 ? "Good performance" : config.current >= 0 ? "Developing" : "Below breakeven"}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
