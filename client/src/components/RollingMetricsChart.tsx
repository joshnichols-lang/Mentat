import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RollingMetricsChartProps {
  data: { date: string; sharpe: number; sortino: number; calmar: number }[];
}

export function RollingMetricsChart({ data }: RollingMetricsChartProps) {
  const [activeMetric, setActiveMetric] = useState<'all' | 'sharpe' | 'sortino' | 'calmar'>('all');

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <p key={index} className="text-sm font-bold" style={{ color: entry.color }}>
                {entry.name}: {entry.value.toFixed(2)}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="hover-elevate transition-all duration-300 border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Rolling Risk Metrics (30D)</CardTitle>
          <div className="flex gap-1">
            {(['all', 'sharpe', 'sortino', 'calmar'] as const).map((metric) => (
              <Button
                key={metric}
                variant={activeMetric === metric ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs capitalize"
                onClick={() => setActiveMetric(metric)}
              >
                {metric}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '10px' }}
              iconType="line"
            />
            {(activeMetric === 'all' || activeMetric === 'sharpe') && (
              <Line
                type="monotone"
                dataKey="sharpe"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Sharpe Ratio"
                animationDuration={1000}
              />
            )}
            {(activeMetric === 'all' || activeMetric === 'sortino') && (
              <Line
                type="monotone"
                dataKey="sortino"
                stroke="hsl(var(--green-500))"
                strokeWidth={2}
                dot={false}
                name="Sortino Ratio"
                animationDuration={1000}
              />
            )}
            {(activeMetric === 'all' || activeMetric === 'calmar') && (
              <Line
                type="monotone"
                dataKey="calmar"
                stroke="hsl(var(--yellow-500))"
                strokeWidth={2}
                dot={false}
                name="Calmar Ratio"
                animationDuration={1000}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
