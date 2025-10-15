import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TradePriceChart from "./TradePriceChart";
import { useQuery } from "@tanstack/react-query";

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
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const { data: tradesData } = useQuery<any>({
    queryKey: ['/api/trades'],
    refetchInterval: 10000,
  });

  const trades: Trade[] = tradesData?.trades || [];

  const handleTradeClick = (trade: Trade) => {
    console.log("Trade clicked:", trade.id);
    setSelectedTrade(trade);
  };

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Trades</h2>
      <Card className="p-0">
        <ScrollArea className="h-[250px]">
          {trades.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">No trades yet</p>
                <p className="text-xs text-muted-foreground mt-1">Use the AI prompt or Quick Trade to start trading</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="cursor-pointer p-3 hover-elevate active-elevate-2"
                  onClick={() => handleTradeClick(trade)}
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
          )}
        </ScrollArea>
      </Card>

      <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTrade?.symbol}/USD {selectedTrade?.side.toUpperCase()} Trade
            </DialogTitle>
          </DialogHeader>
          {selectedTrade && (
            <TradePriceChart
              symbol={selectedTrade.symbol}
              entryPrice={selectedTrade.price}
              entryTime={selectedTrade.timestamp}
              side={selectedTrade.side}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
