import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

export function TopPerformingAssets() {
  const { data: tradesData } = useQuery<any>({
    queryKey: ['/api/trades'],
    refetchInterval: 30000,
  });

  const topAssets = useMemo(() => {
    const trades = tradesData?.trades || [];
    
    const assetPnl: Record<string, { pnl: number; trades: number }> = {};
    
    trades.forEach((trade: any) => {
      const symbol = trade.symbol || 'UNKNOWN';
      const pnl = parseFloat(trade.realizedPnl || trade.pnl || '0');
      
      if (!assetPnl[symbol]) {
        assetPnl[symbol] = { pnl: 0, trades: 0 };
      }
      assetPnl[symbol].pnl += pnl;
      assetPnl[symbol].trades++;
    });

    return Object.entries(assetPnl)
      .map(([symbol, data]) => ({
        symbol,
        pnl: data.pnl,
        trades: data.trades,
        avgPnl: data.pnl / data.trades,
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
  }, [tradesData]);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4" />
          Top Performing Assets
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topAssets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trading data available yet.</p>
        ) : (
          <div className="space-y-2">
            {topAssets.map((asset, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg border border-border/30 hover-elevate"
                data-testid={`asset-${asset.symbol}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold">{asset.symbol}</p>
                    <p className="text-xs text-muted-foreground">{asset.trades} trades</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-bold ${asset.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    <span className="inline-flex items-center gap-1">
                      {asset.pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      ${Math.abs(asset.pnl).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Avg: ${asset.avgPnl.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
