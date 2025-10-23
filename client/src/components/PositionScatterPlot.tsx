import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from 'recharts';

interface PositionScatterPlotProps {
  data: { symbol: string; durationHours: number; pnl: number; size: number }[];
}

export function PositionScatterPlot({ data }: PositionScatterPlotProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-xl">
          <p className="text-xs font-bold mb-1">{point.symbol}</p>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              Duration: <span className="font-medium text-foreground">{point.durationHours}h</span>
            </p>
            <p className="text-muted-foreground">
              P&L: <span className={`font-medium ${point.pnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {point.pnl >= 0 ? '+' : ''}${point.pnl.toFixed(2)}
              </span>
            </p>
            <p className="text-muted-foreground">
              Size: <span className="font-medium text-foreground">${point.size}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="hover-elevate transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Position Duration vs P&L</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              type="number"
              dataKey="durationHours"
              name="Duration"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              label={{ value: 'Duration (hours)', position: 'insideBottom', offset: -5, fontSize: 10 }}
            />
            <YAxis 
              type="number"
              dataKey="pnl"
              name="P&L"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              tickFormatter={(value) => `$${value}`}
              label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft', fontSize: 10 }}
            />
            <ZAxis type="number" dataKey="size" range={[50, 400]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} animationDuration={1000}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.pnl >= 0 ? 'hsl(var(--green-500))' : 'hsl(var(--destructive))'}
                  fillOpacity={0.6}
                  stroke={entry.pnl >= 0 ? 'hsl(var(--green-500))' : 'hsl(var(--destructive))'}
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
