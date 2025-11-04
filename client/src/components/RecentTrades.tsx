import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface RecentTradesProps {
  symbol: string;
}

interface Trade {
  id: number;
  price: number;
  size: number;
  time: number;
  side: "B" | "S"; // Buy or Sell
}

export default function RecentTrades({ symbol }: RecentTradesProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Clear trades when symbol changes
    setTrades([]);
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/market-data`;

    console.log(`[RecentTrades] Connecting to ${wsUrl} for ${symbol}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[RecentTrades] Connected, subscribing to trades for ${symbol}`);
      ws.send(JSON.stringify({
        action: "subscribe",
        type: "trades",
        coin: symbol,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "trade") {
          const data = message.data;
          
          // Validate trade data
          if (!data || !data.px || !data.sz || !data.side || data.tid === undefined) {
            console.warn("[RecentTrades] Invalid trade data:", data);
            return;
          }

          const trade: Trade = {
            id: data.tid,
            price: parseFloat(data.px),
            size: parseFloat(data.sz),
            time: data.time,
            side: data.side,
          };

          console.log(`[RecentTrades] Received trade for ${data.coin}:`, trade);

          // Add new trade to the beginning of the array (newest first)
          setTrades(prev => {
            const updated = [trade, ...prev];
            // Keep only the last 100 trades
            return updated.slice(0, 100);
          });
        }
      } catch (error) {
        console.error("[RecentTrades] Error parsing message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[RecentTrades] WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("[RecentTrades] WebSocket closed");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: "unsubscribe",
          type: "trades",
          coin: symbol,
        }));
      }
      ws.close();
    };
  }, [symbol]);

  // Auto-scroll to top when new trades arrive (if autoScroll is enabled)
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [trades, autoScroll]);

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatSize = (size: number) => {
    return size.toFixed(4);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getSideColor = (side: "B" | "S") => {
    return side === "B" ? "text-long" : "text-short";
  };

  const getSideBgColor = (side: "B" | "S") => {
    return side === "B" ? "bg-long/5" : "bg-short/5";
  };

  const getSideLabel = (side: "B" | "S") => {
    return side === "B" ? "Buy" : "Sell";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with auto-scroll toggle */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-secondary">Live Trades</span>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="text-xs text-tertiary hover:text-foreground transition-colors"
            data-testid="button-auto-scroll-toggle"
          >
            Auto-scroll: {autoScroll ? "On" : "Off"}
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-secondary border-b border-border/30">
        <div>Time</div>
        <div className="text-right">Price</div>
        <div className="text-right">Size</div>
        <div className="text-center">Side</div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-0.5 p-1">
          {trades.map((trade, index) => (
            <div
              key={`${trade.id}-${index}`}
              className={`relative grid grid-cols-4 gap-2 px-2 py-1.5 text-xs rounded hover-elevate cursor-pointer transition-colors ${getSideBgColor(trade.side)}`}
              data-testid={`trade-${index}`}
            >
              <div className="text-tertiary text-[10px] font-mono flex items-center">
                {formatTime(trade.time)}
              </div>
              <div className={`text-right font-mono font-medium ${getSideColor(trade.side)}`}>
                {formatPrice(trade.price)}
              </div>
              <div className="text-right text-secondary font-mono">
                {formatSize(trade.size)}
              </div>
              <div className="flex justify-center">
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 h-4 font-mono ${getSideColor(trade.side)}`}
                  data-testid={`badge-side-${trade.side}`}
                >
                  {getSideLabel(trade.side)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Empty state */}
      {trades.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-tertiary">Waiting for trades...</p>
        </div>
      )}
    </div>
  );
}
