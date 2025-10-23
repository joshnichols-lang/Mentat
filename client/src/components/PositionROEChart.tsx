import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown } from "lucide-react";

interface PositionROEChartProps {
  data: { symbol: string; roe: number; position: string }[];
}

export function PositionROEChart({ data }: PositionROEChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const position = payload[0].payload.position;
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-1">{payload[0].payload.symbol}</p>
          <p className={`text-sm font-bold ${value >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            ROE: {value >= 0 ? '+' : ''}{value.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground">{position}</p>
        </div>
      );
    }
    return null;
  };

  const sortedData = [...data].sort((a, b) => b.roe - a.roe);

  return (
    <Card className="hover-elevate transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Position ROE Comparison</CardTitle>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">Winners</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingDown className="h-3 w-3 text-destructive" />
              <span className="text-muted-foreground">Losers</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sortedData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              type="number"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              dataKey="symbol"
              type="category"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="roe" radius={[0, 4, 4, 0]}>
              {sortedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.roe >= 0 ? 'hsl(var(--green-500))' : 'hsl(var(--destructive))'}
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
