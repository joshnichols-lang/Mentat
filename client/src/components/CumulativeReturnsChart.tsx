import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CumulativeReturnsChartProps {
  data: { date: string; portfolio: number; benchmark: number }[];
}

export function CumulativeReturnsChart({ data }: CumulativeReturnsChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">
              Portfolio: {payload[0].value.toFixed(2)}%
            </p>
            <p className="text-sm font-bold text-muted-foreground">
              Benchmark: {payload[1].value.toFixed(2)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="hover-elevate transition-all duration-300 border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Cumulative Returns vs Benchmark</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="portfolioLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '11px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="url(#portfolioLine)"
              strokeWidth={3}
              dot={false}
              name="Your Portfolio"
              animationDuration={1500}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="BTC Benchmark"
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
