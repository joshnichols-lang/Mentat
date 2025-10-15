import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

interface HyperliquidPosition {
  coin: string;
  szi: string;
  entryPx?: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity?: string;
  leverage: {
    type: string;
    value: number;
  };
}

export default function PositionsGrid() {
  const { data, isLoading } = useQuery<{ positions: HyperliquidPosition[] }>({
    queryKey: ["/api/hyperliquid/positions"],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const positions = data?.positions || [];

  const handleClose = (coin: string) => {
    console.log("Close position:", coin);
    // TODO: Implement position closing
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold">Positions</h2>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Card key={i} className="p-3">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold">Positions</h2>
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No active positions
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Positions</h2>
      <div className="space-y-2">
        {positions.map((position) => {
          const size = parseFloat(position.szi);
          const side = size > 0 ? "long" : "short";
          const absSize = Math.abs(size);
          const entryPrice = parseFloat(position.entryPx || "0");
          const pnl = parseFloat(position.unrealizedPnl || "0");
          const roe = parseFloat(position.returnOnEquity || "0");
          const displaySymbol = position.coin.replace("-PERP", "");
          
          return (
            <Card key={position.coin} className="p-3" data-testid={`card-position-${position.coin}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{displaySymbol}/USD</div>
                    <Badge 
                      variant={side === "long" ? "default" : "destructive"}
                      className={`text-xs ${side === "long" ? "bg-chart-2 hover:bg-chart-2/90" : ""}`}
                    >
                      {side.toUpperCase()} {position.leverage.value}x
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Size</div>
                      <div className="font-mono text-xs font-medium">{absSize.toFixed(4)} {displaySymbol}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Entry</div>
                      <div className="font-mono text-xs font-medium">${entryPrice.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Value</div>
                      <div className="font-mono text-xs font-medium">${parseFloat(position.positionValue).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">P&L</div>
                      <div className={`font-mono text-xs font-semibold ${
                        pnl >= 0 ? "text-chart-2" : "text-destructive"
                      }`} data-testid={`text-pnl-${position.coin}`}>
                        ${pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} ({pnl >= 0 ? "+" : ""}{(roe * 100).toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleClose(position.coin)}
                  data-testid={`button-close-${position.coin}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
