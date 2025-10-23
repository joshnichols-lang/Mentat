import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

interface WinStreakChartProps {
  data: { trade: string; outcome: 'win' | 'loss'; streak: number }[];
}

export function WinStreakChart({ data }: WinStreakChartProps) {
  const currentStreak = data[data.length - 1]?.streak || 0;
  const maxWinStreak = Math.max(...data.filter(d => d.outcome === 'win').map(d => d.streak));
  const maxLossStreak = Math.abs(Math.min(...data.filter(d => d.outcome === 'loss').map(d => d.streak)));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const outcome = payload[0].payload.outcome;
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-1">{payload[0].payload.trade}</p>
          <p className={`text-sm font-bold ${outcome === 'win' ? 'text-long' : 'text-destructive'}`}>
            {outcome === 'win' ? 'Win' : 'Loss'} Streak: {Math.abs(value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="hover-elevate transition-all duration-300 border-0 bg-gradient-to-br from-card via-card to-long/5 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Win/Loss Streaks</CardTitle>
          <Badge variant="default" className="gap-1 shadow-lg">
            <Flame className="h-3 w-3" />
            Current: {currentStreak > 0 ? `+${currentStreak}` : currentStreak}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3 text-xs">
          <div className="flex-1">
            <div className="text-muted-foreground">Best Win Streak</div>
            <div className="text-sm font-bold text-long">+{maxWinStreak}</div>
          </div>
          <div className="flex-1">
            <div className="text-muted-foreground">Worst Loss Streak</div>
            <div className="text-sm font-bold text-destructive">-{maxLossStreak}</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="trade" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={9}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="streak" radius={[4, 4, 4, 4]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.outcome === 'win' ? 'hsl(var(--long))' : 'hsl(var(--destructive))'}
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
