import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TradeDistributionDonutProps {
  wins: number;
  losses: number;
  breakeven: number;
}

export function TradeDistributionDonut({ wins, losses, breakeven }: TradeDistributionDonutProps) {
  const total = wins + losses + breakeven;
  
  const data = [
    { name: 'Wins', value: wins, color: 'hsl(var(--green-500))' },
    { name: 'Losses', value: losses, color: 'hsl(var(--destructive))' },
    { name: 'Breakeven', value: breakeven, color: 'hsl(var(--muted-foreground))' }
  ];

  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = ((payload[0].value / total) * 100).toFixed(1);
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-2 shadow-xl">
          <p className="text-xs font-medium">{payload[0].name}</p>
          <p className="text-sm font-bold">
            {payload[0].value} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Trade Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                animationDuration={1000}
                animationBegin={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{winRate}%</div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            <div>
              <div className="text-xs text-muted-foreground">Wins</div>
              <div className="text-sm font-bold">{wins}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            <div>
              <div className="text-xs text-muted-foreground">Losses</div>
              <div className="text-sm font-bold">{losses}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Even</div>
              <div className="text-sm font-bold">{breakeven}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
