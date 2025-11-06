import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function RecentTradesTable() {
  const { data: tradesData } = useQuery<any>({
    queryKey: ['/api/trades'],
    refetchInterval: 30000,
  });

  const trades = tradesData?.trades || [];
  const recentTrades = trades.slice(-10).reverse();

  if (recentTrades.length === 0) {
    return (
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Recent Trades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No trades yet. Start trading to see your activity here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          Recent Trades ({recentTrades.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 font-medium text-muted-foreground">Time</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Symbol</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Side</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Size</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Price</th>
                <th className="text-right py-2 font-medium text-muted-foreground">P&L</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade: any, idx: number) => {
                const pnl = parseFloat(trade.realizedPnl || trade.pnl || '0');
                const isProfitable = pnl > 0;
                
                return (
                  <tr 
                    key={idx} 
                    className="border-b border-border/20 hover-elevate"
                    data-testid={`row-trade-${idx}`}
                  >
                    <td className="py-2 text-muted-foreground">
                      {trade.timestamp ? formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true }) : 'N/A'}
                    </td>
                    <td className="py-2 font-mono">{trade.symbol || 'N/A'}</td>
                    <td className="py-2">
                      <Badge 
                        variant={trade.side === 'buy' ? 'default' : 'outline'}
                        className={trade.side === 'buy' ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}
                      >
                        {trade.side?.toUpperCase() || 'N/A'}
                      </Badge>
                    </td>
                    <td className="py-2 text-right font-mono">{trade.size || 'N/A'}</td>
                    <td className="py-2 text-right font-mono">${parseFloat(trade.price || '0').toLocaleString()}</td>
                    <td className={`py-2 text-right font-mono ${isProfitable ? 'text-success' : pnl < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {pnl !== 0 && (isProfitable ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                        ${Math.abs(pnl).toFixed(2)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
