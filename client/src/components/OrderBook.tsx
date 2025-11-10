import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface OrderBookProps {
  symbol: string;
}

interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
}

export default function OrderBook({ symbol }: OrderBookProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: 0,
    spreadPercent: 0,
  });
  const [maxTotal, setMaxTotal] = useState(0);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/market-data`;

    // console.log(`[OrderBook] Connecting to ${wsUrl} for ${symbol}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // console.log(`[OrderBook] Connected, subscribing to L2 book for ${symbol}`);
      ws.send(JSON.stringify({
        action: "subscribe",
        type: "l2Book",
        coin: symbol,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "orderBook") {
          const data = message.data;
          
          // Validate data structure
          if (!data || !data.levels || !Array.isArray(data.levels) || data.levels.length !== 2) {
            console.warn("[OrderBook] Invalid order book data:", data);
            return;
          }

          // console.log(`[OrderBook] Received order book for ${data.coin}:`, data);

          // data.levels is [bids, asks]
          const [rawBids, rawAsks] = data.levels;
          const bids: OrderBookLevel[] = [];
          const asks: OrderBookLevel[] = [];
          
          // Process bids
          rawBids.forEach((level: any) => {
            if (level && level.px && level.sz) {
              bids.push({
                price: parseFloat(level.px),
                size: parseFloat(level.sz),
                total: 0,
              });
            }
          });

          // Process asks
          rawAsks.forEach((level: any) => {
            if (level && level.px && level.sz) {
              asks.push({
                price: parseFloat(level.px),
                size: parseFloat(level.sz),
                total: 0,
              });
            }
          });

          // Sort and calculate running totals
          bids.sort((a, b) => b.price - a.price); // Descending
          asks.sort((a, b) => a.price - b.price); // Ascending

          let bidTotal = 0;
          bids.forEach(level => {
            bidTotal += level.size;
            level.total = bidTotal;
          });

          let askTotal = 0;
          asks.forEach(level => {
            askTotal += level.size;
            level.total = askTotal;
          });

          // Calculate spread
          const bestBid = bids[0]?.price || 0;
          const bestAsk = asks[0]?.price || 0;
          const spread = bestAsk - bestBid;
          const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

          // Limit display to top 20 levels each side
          const displayBids = bids.slice(0, 20);
          const displayAsks = asks.slice(0, 20);

          // Calculate max total for depth visualization
          const maxBidTotal = displayBids[displayBids.length - 1]?.total || 0;
          const maxAskTotal = displayAsks[displayAsks.length - 1]?.total || 0;
          const maxTotalValue = Math.max(maxBidTotal, maxAskTotal);

          setMaxTotal(maxTotalValue);
          setOrderBook({
            bids: displayBids,
            asks: displayAsks,
            spread,
            spreadPercent,
          });
        }
      } catch (error) {
        console.error("[OrderBook] Error parsing message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[OrderBook] WebSocket error:", error);
    };

    ws.onclose = () => {
      // console.log("[OrderBook] WebSocket closed");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: "unsubscribe",
          type: "l2Book",
          coin: symbol,
        }));
      }
      ws.close();
    };
  }, [symbol]);

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatSize = (size: number) => {
    return size.toFixed(4);
  };

  const getDepthPercentage = (total: number) => {
    if (maxTotal === 0) return 0;
    return (total / maxTotal) * 100;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with spread */}
      <div className="px-1 py-0.5 border-b border-border/50" style={{minHeight: '18px'}}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-secondary leading-none">Spread</span>
          <Badge 
            variant="outline" 
            className="text-[9px] font-mono h-4 px-1"
            data-testid="badge-spread"
          >
            ${orderBook.spread.toFixed(2)} ({orderBook.spreadPercent.toFixed(3)}%)
          </Badge>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 gap-1 px-1 py-0.5 text-[9px] text-secondary border-b border-border/30" style={{minHeight: '14px'}}>
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      <ScrollArea className="flex-1 no-scrollbar">
        {/* Asks (sell orders) - reverse display so best ask is at bottom */}
        <div className="flex flex-col-reverse">
          {orderBook.asks.map((level, index) => (
            <div
              key={`ask-${index}`}
              className="relative grid grid-cols-3 gap-1 px-1 py-px text-[9px] hover-elevate cursor-pointer transition-colors leading-tight"
              data-testid={`orderbook-ask-${index}`}
            >
              {/* Horizontal depth visualization */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-short/10 transition-all duration-200"
                style={{ width: `${getDepthPercentage(level.total)}%` }}
              />
              <div className="relative z-10 text-short font-mono font-medium">
                {formatPrice(level.price)}
              </div>
              <div className="relative z-10 text-right text-secondary font-mono">
                {formatSize(level.size)}
              </div>
              <div className="relative z-10 text-right text-tertiary font-mono">
                {formatSize(level.total)}
              </div>
            </div>
          ))}
        </div>

        {/* Spread indicator */}
        {orderBook.bids.length > 0 && orderBook.asks.length > 0 && (
          <div className="px-1 py-0.5 text-center border-y border-border/30 bg-muted/30" style={{minHeight: '16px'}}>
            <span className="text-[9px] font-mono font-medium leading-none">
              ${formatPrice((orderBook.bids[0].price + orderBook.asks[0].price) / 2)}
            </span>
          </div>
        )}

        {/* Bids (buy orders) */}
        <div>
          {orderBook.bids.map((level, index) => (
            <div
              key={`bid-${index}`}
              className="relative grid grid-cols-3 gap-1 px-1 py-px text-[9px] hover-elevate cursor-pointer transition-colors leading-tight"
              data-testid={`orderbook-bid-${index}`}
            >
              {/* Horizontal depth visualization */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-long/10 transition-all duration-200"
                style={{ width: `${getDepthPercentage(level.total)}%` }}
              />
              <div className="relative z-10 text-long font-mono font-medium">
                {formatPrice(level.price)}
              </div>
              <div className="relative z-10 text-right text-secondary font-mono">
                {formatSize(level.size)}
              </div>
              <div className="relative z-10 text-right text-tertiary font-mono">
                {formatSize(level.total)}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Empty state */}
      {orderBook.bids.length === 0 && orderBook.asks.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-1">
          <p className="text-[9px] text-tertiary">Waiting for order book data...</p>
        </div>
      )}
    </div>
  );
}
