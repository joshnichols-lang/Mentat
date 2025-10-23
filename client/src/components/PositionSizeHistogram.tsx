import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PositionSizeHistogramProps {
  data: { range: string; count: number; avgPnl: number }[];
}

export function PositionSizeHistogram({ data }: PositionSizeHistogramProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const avgPnl = payload[0].payload.avgPnl;
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-1">{payload[0].payload.range}</p>
          <p className="text-sm font-bold text-foreground">
            {payload[0].value} positions
          </p>
          <p className={`text-xs font-medium ${avgPnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            Avg P&L: {avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="hover-elevate transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Position Size Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="range" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={9}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              label={{ value: 'Count', angle: -90, position: 'insideLeft', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.avgPnl >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                  opacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
