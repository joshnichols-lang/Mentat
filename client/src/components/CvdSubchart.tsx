import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CvdSubchartProps {
  coin: string;
}

export function CvdSubchart({ coin }: CvdSubchartProps) {
  // Fetch CVD data
  const { data } = useQuery<{ success: boolean; cvd: any }>({
    queryKey: ["/api/indicators/cvd", coin],
    refetchInterval: 2000,
  });

  const cvdData = data?.cvd?.data || [];
  const currentDelta = data?.cvd?.currentDelta || 0;

  // Format data for chart
  const chartData = cvdData.map((item: any) => ({
    time: item.timestamp,
    cvd: item.cumulativeDelta,
  }));

  const isPositive = currentDelta >= 0;

  return (
    <Card data-testid="card-cvd-subchart">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono">CVD - Cumulative Volume Delta</CardTitle>
          <div className={`font-mono text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{currentDelta.toFixed(2)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="time"
              tickFormatter={(time) => new Date(time).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
            />
            <YAxis
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tickFormatter={(val) => val.toFixed(0)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
              labelFormatter={(time) => new Date(time as number).toLocaleString()}
              formatter={(value: any) => [parseFloat(value).toFixed(2), 'CVD']}
            />
            <ReferenceLine 
              y={0} 
              stroke="#666" 
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Area
              type="monotone"
              dataKey="cvd"
              stroke={isPositive ? "#22c55e" : "#ef4444"}
              fill={isPositive ? "#22c55e20" : "#ef444420"}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>

        {chartData.length === 0 && (
          <div className="text-center py-4 text-muted-foreground font-mono text-sm">
            No CVD data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
