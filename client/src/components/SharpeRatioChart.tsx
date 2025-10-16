import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TimeRange, timeRanges, formatChartDate, filterDataByTimeRange } from "@/lib/chartUtils";

export default function SharpeRatioChart() {
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
  // Get latest values from allData, not filtered data - current values should always show most recent
  const latestSnapshot = allData.length > 0 ? allData[allData.length - 1] : null;
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

  // Calculate Y-axis domain for all three ratios
  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 1];
    
    const allValues = data.flatMap((item: any) => [
      Number(item.sharpeRatio || 0),
      Number(item.sortinoRatio || 0),
      Number(item.calmarRatio || 0),
    ]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Add 5% padding
    const yMin = min <= 0 ? min * 1.05 : 0;
    const yMax = max >= 0 ? max * 1.05 : 0;
    
    return [yMin, yMax];
  }, [data]);

  // Format tick for display
  const formatXAxis = (timestamp: number) => {
    return formatChartDate(timestamp, timeRange);
  };

  return (
    <Card className="p-3" data-testid="card-risk-ratios">
      <div className="mb-3">
        <h2 className="text-sm font-semibold" data-testid="text-chart-title">Risk-Adjusted Performance Ratios</h2>
        <p className="text-xs text-muted-foreground" data-testid="text-chart-subtitle">Three comprehensive risk metrics for portfolio evaluation</p>
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
                  domain={yDomain}
                  padding={{ top: 8, bottom: 8 }}
                  tickFormatter={(value) => Number(value).toFixed(4)}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px' }}
                  iconType="line"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: any, name: string) => [Number(value || 0).toFixed(4), name]}
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
                  name="Sharpe Ratio"
                  dataKey="sharpeRatio"
                  stroke={ratioConfig.sharpe.color}
                  strokeWidth={2}
                  dot={{ fill: ratioConfig.sharpe.color, r: 2 }}
                />
                <Line 
                  type="monotone" 
                  name="Sortino Ratio"
                  dataKey="sortinoRatio"
                  stroke={ratioConfig.sortino.color}
                  strokeWidth={2}
                  dot={{ fill: ratioConfig.sortino.color, r: 2 }}
                />
                <Line 
                  type="monotone" 
                  name="Calmar Ratio"
                  dataKey="calmarRatio"
                  stroke={ratioConfig.calmar.color}
                  strokeWidth={2}
                  dot={{ fill: ratioConfig.calmar.color, r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 border-t pt-3" data-testid="container-current-value">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Sharpe</div>
                <div 
                  className="font-mono text-sm font-bold" 
                  style={{ color: ratioConfig.sharpe.color }} 
                  data-testid="text-sharpe-value"
                >
                  {currentSharpe.toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Sortino</div>
                <div 
                  className="font-mono text-sm font-bold" 
                  style={{ color: ratioConfig.sortino.color }} 
                  data-testid="text-sortino-value"
                >
                  {currentSortino.toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Calmar</div>
                <div 
                  className="font-mono text-sm font-bold" 
                  style={{ color: ratioConfig.calmar.color }} 
                  data-testid="text-calmar-value"
                >
                  {currentCalmar.toFixed(4)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
