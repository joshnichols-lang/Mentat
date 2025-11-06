import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function ExchangeBreakdown() {
  const { data: positionsData } = useQuery<any>({
    queryKey: ["/api/multi-exchange/positions"],
    refetchInterval: 30000,
  });

  const breakdown = useMemo(() => {
    const positions = positionsData?.positions || [];
    
    const exchanges: Record<string, { count: number; totalValue: number }> = {};
    
    positions.forEach((pos: any) => {
      const exchange = pos.exchange || 'unknown';
      if (!exchanges[exchange]) {
        exchanges[exchange] = { count: 0, totalValue: 0 };
      }
      exchanges[exchange].count++;
      
      const notional = Math.abs(parseFloat(pos.notionalValue || pos.size || '0'));
      exchanges[exchange].totalValue += notional;
    });

    const total = Object.values(exchanges).reduce((sum, ex) => sum + ex.totalValue, 0);

    return Object.entries(exchanges)
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: data.count,
        value: data.totalValue,
        percentage: total > 0 ? (data.totalValue / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [positionsData]);

  const colors: Record<string, string> = {
    Hyperliquid: 'bg-primary',
    Orderly: 'bg-success',
    Polymarket: 'bg-purple-500',
    Unknown: 'bg-muted',
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" />
          Exchange Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {breakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active positions across exchanges.</p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((exchange, idx) => (
              <div key={idx} className="space-y-1.5" data-testid={`exchange-${exchange.name.toLowerCase()}`}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${colors[exchange.name] || colors.Unknown}`} />
                    <span className="font-medium">{exchange.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{exchange.count} positions</span>
                    <span className="font-mono font-semibold">{exchange.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <Progress value={exchange.percentage} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
