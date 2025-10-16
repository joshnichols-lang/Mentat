import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
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
  const [isPanelOpen, setIsPanelOpen] = useState(true);

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
    <Collapsible open={isPanelOpen} onOpenChange={setIsPanelOpen}>
      <div className="mb-3 hover-elevate active-elevate-2 -mx-0 group">
        <CollapsibleTrigger className="w-full flex items-center justify-between" data-testid="toggle-trades-panel">
          <h2 className="text-sm font-semibold">TRADES</h2>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
      </div>
      
      <CollapsibleContent>
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
                          className={`text-xs ${trade.side === "long" ? "bg-long text-long-foreground hover:bg-long/90" : "bg-short text-short-foreground hover:bg-short/90"}`}
                        >
                          {trade.side.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {trade.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {trade.timestamp} · {trade.size} @ ${trade.price ? trade.price.toLocaleString() : 'Market'}
                      </div>
                    </div>
                    {trade.pnl !== undefined && trade.pnl !== null && (
                      <div className={`text-right font-mono text-sm font-semibold ${
                        Number(trade.pnl) >= 0 ? "text-long" : "text-short"
                      }`} data-testid={`text-trade-pnl-${trade.id}`}>
                        {Number(trade.pnl) >= 0 ? "+" : ""}${Number(trade.pnl).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
      </CollapsibleContent>

      <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTrade?.symbol}/USD {selectedTrade?.side.toUpperCase()} Trade
            </DialogTitle>
          </DialogHeader>
          {selectedTrade && selectedTrade.price && (
            <TradePriceChart
              symbol={selectedTrade.symbol}
              entryPrice={selectedTrade.price}
              entryTime={selectedTrade.timestamp}
              side={selectedTrade.side}
            />
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
