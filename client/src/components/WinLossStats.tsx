import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function WinLossStats() {
  const { data: tradesData } = useQuery<any>({
    queryKey: ['/api/trades'],
    refetchInterval: 30000,
  });

  const stats = useMemo(() => {
    const trades = tradesData?.trades || [];
    
    let wins = 0;
    let losses = 0;
    let breakeven = 0;
    let totalPnl = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;

    trades.forEach((trade: any) => {
      const pnl = parseFloat(trade.realizedPnl || trade.pnl || '0');
      totalPnl += pnl;
      
      if (pnl > 0.01) {
        wins++;
        totalWinPnl += pnl;
      } else if (pnl < -0.01) {
        losses++;
        totalLossPnl += pnl;
      } else {
        breakeven++;
      }
    });

    const total = wins + losses + breakeven;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const avgWin = wins > 0 ? totalWinPnl / wins : 0;
    const avgLoss = losses > 0 ? totalLossPnl / losses : 0;
    
    // Profit Factor: if no losses, display as infinity/N/A
    let profitFactor: number | null = null;
    if (losses > 0 && totalLossPnl !== 0) {
      profitFactor = Math.abs(totalWinPnl / totalLossPnl);
    }

    return {
      wins,
      losses,
      breakeven,
      total,
      winRate,
      totalPnl,
      avgWin,
      avgLoss,
      profitFactor,
    };
  }, [tradesData]);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4" />
          Win/Loss Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.total === 0 ? (
          <p className="text-xs text-muted-foreground">No trades to analyze yet.</p>
        ) : (
          <>
            {/* Win Rate Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Win Rate</span>
                <span className="font-mono font-semibold" data-testid="text-win-rate">
                  {stats.winRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={stats.winRate} className="h-2" />
            </div>

            {/* Win/Loss Breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1 text-success">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs font-medium">Wins</span>
                </div>
                <p className="text-lg font-bold font-mono" data-testid="text-wins">{stats.wins}</p>
                <p className="text-xs text-muted-foreground">Avg: ${stats.avgWin.toFixed(2)}</p>
              </div>

              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1 text-destructive">
                  <TrendingDown className="h-3 w-3" />
                  <span className="text-xs font-medium">Losses</span>
                </div>
                <p className="text-lg font-bold font-mono" data-testid="text-losses">{stats.losses}</p>
                <p className="text-xs text-muted-foreground">Avg: ${Math.abs(stats.avgLoss).toFixed(2)}</p>
              </div>

              <div className="bg-muted/30 border border-border/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Minus className="h-3 w-3" />
                  <span className="text-xs font-medium">B/E</span>
                </div>
                <p className="text-lg font-bold font-mono" data-testid="text-breakeven">{stats.breakeven}</p>
                <p className="text-xs text-muted-foreground">±$0.00</p>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
              <div>
                <p className="text-xs text-muted-foreground">Total P&L</p>
                <p className={`text-sm font-bold font-mono ${stats.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`} data-testid="text-total-pnl">
                  ${stats.totalPnl.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profit Factor</p>
                <p className="text-sm font-bold font-mono" data-testid="text-profit-factor">
                  {stats.profitFactor !== null ? `${stats.profitFactor.toFixed(2)}x` : 'N/A'}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
