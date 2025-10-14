import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Trade {
  id: string;
  timestamp: string;
  symbol: string;
  side: "long" | "short";
  type: "market" | "limit";
  size: number;
  price: number;
  pnl?: number;
  status: "filled" | "partial" | "cancelled";
}

export default function TradeHistory() {
  // todo: remove mock functionality
  const trades: Trade[] = [
    {
      id: "1",
      timestamp: "2025-01-14 14:32",
      symbol: "BTC",
      side: "long",
      type: "market",
      size: 0.5,
      price: 42100,
      pnl: 1725,
      status: "filled",
    },
    {
      id: "2",
      timestamp: "2025-01-14 13:15",
      symbol: "ETH",
      side: "short",
      type: "limit",
      size: 5,
      price: 2320,
      pnl: 175,
      status: "filled",
    },
    {
      id: "3",
      timestamp: "2025-01-14 11:45",
      symbol: "SOL",
      side: "long",
      type: "market",
      size: 10,
      price: 92.50,
      pnl: -85,
      status: "filled",
    },
  ];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Recent Trades</h2>
      <Card className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="divide-y">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="p-4 hover-elevate"
                data-testid={`row-trade-${trade.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{trade.symbol}/USD</span>
                      <Badge
                        variant={trade.side === "long" ? "default" : "destructive"}
                        className={`text-xs ${trade.side === "long" ? "bg-chart-2 hover:bg-chart-2/90" : ""}`}
                      >
                        {trade.side.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {trade.type}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {trade.timestamp} · {trade.size} @ ${trade.price.toLocaleString()}
                    </div>
                  </div>
                  {trade.pnl !== undefined && (
                    <div className={`text-right font-mono text-sm font-semibold ${
                      trade.pnl >= 0 ? "text-chart-2" : "text-destructive"
                    }`} data-testid={`text-trade-pnl-${trade.id}`}>
                      {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
