import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
}

export default function PositionsGrid() {
  // todo: remove mock functionality
  const positions: Position[] = [
    {
      id: "1",
      symbol: "BTC",
      side: "long",
      size: 0.5,
      entryPrice: 42100,
      currentPrice: 43250,
      leverage: 3,
      pnl: 1725,
      pnlPercent: 2.73,
    },
    {
      id: "2",
      symbol: "ETH",
      side: "short",
      size: 5,
      entryPrice: 2320,
      currentPrice: 2285,
      leverage: 2,
      pnl: 175,
      pnlPercent: 1.51,
    },
  ];

  const handleClose = (id: string) => {
    console.log("Close position:", id);
  };

  if (positions.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Active Positions</h2>
        <Card className="p-8 text-center text-muted-foreground">
          No active positions
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Active Positions</h2>
      <div className="space-y-3">
        {positions.map((position) => (
          <Card key={position.id} className="p-4" data-testid={`card-position-${position.id}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold">{position.symbol}/USD</div>
                  <Badge 
                    variant={position.side === "long" ? "default" : "destructive"}
                    className={position.side === "long" ? "bg-chart-2 hover:bg-chart-2/90" : ""}
                  >
                    {position.side.toUpperCase()} {position.leverage}x
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Size</div>
                    <div className="font-mono text-sm font-medium">{position.size} {position.symbol}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Entry Price</div>
                    <div className="font-mono text-sm font-medium">${position.entryPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Current Price</div>
                    <div className="font-mono text-sm font-medium">${position.currentPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">P&L</div>
                    <div className={`font-mono text-sm font-semibold ${
                      position.pnl >= 0 ? "text-chart-2" : "text-destructive"
                    }`} data-testid={`text-pnl-${position.id}`}>
                      ${position.pnl >= 0 ? "+" : ""}{position.pnl.toFixed(2)} ({position.pnl >= 0 ? "+" : ""}{position.pnlPercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleClose(position.id)}
                data-testid={`button-close-${position.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
