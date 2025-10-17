import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useMarketDataWebSocket } from '@/hooks/useMarketDataWebSocket';

interface OrderBookLevel {
  price: string;
  size: string;
}

interface OrderBookProps {
  coin: string;
  maxLevels?: number;
}

export function OrderBook({ coin, maxLevels = 15 }: OrderBookProps) {
  const { isConnected, subscribe, unsubscribe, addListener } = useMarketDataWebSocket();
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to L2 book data
    subscribe('l2Book', coin);

    // Add listener for book updates
    const cleanup = addListener('l2Book', coin, (data: any) => {
      try {
        if (data.coin === coin && data.levels && Array.isArray(data.levels)) {
          const [rawBids, rawAsks] = data.levels;
          
          if (!Array.isArray(rawBids) || !Array.isArray(rawAsks)) {
            console.error('[OrderBook] Invalid levels format:', data.levels);
            return;
          }
          
          // Hyperliquid sends levels as objects: {px: "price", sz: "size", n: numOrders}
          const formattedBids = rawBids
            .map((level: any) => ({ price: level.px, size: level.sz }))
            .sort((a: OrderBookLevel, b: OrderBookLevel) => parseFloat(b.price) - parseFloat(a.price))
            .slice(0, maxLevels);
          
          const formattedAsks = rawAsks
            .map((level: any) => ({ price: level.px, size: level.sz }))
            .sort((a: OrderBookLevel, b: OrderBookLevel) => parseFloat(a.price) - parseFloat(b.price))
            .slice(0, maxLevels);

          setBids(formattedBids);
          setAsks(formattedAsks);
        }
      } catch (error) {
        console.error('[OrderBook] Error processing l2Book data:', error, data);
      }
    });

    return () => {
      cleanup();
      unsubscribe('l2Book', coin);
    };
  }, [coin, isConnected, subscribe, unsubscribe, addListener, maxLevels]);

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    return num >= 1000 ? num.toFixed(1) : num >= 1 ? num.toFixed(2) : num.toFixed(4);
  };

  const formatSize = (size: string) => {
    const num = parseFloat(size);
    return num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toFixed(3);
  };

  // Calculate max size for depth visualization
  const maxBidSize = Math.max(...bids.map(b => parseFloat(b.size)), 0);
  const maxAskSize = Math.max(...asks.map(a => parseFloat(a.size)), 0);
  const maxSize = Math.max(maxBidSize, maxAskSize);

  return (
    <Card className="p-0 overflow-hidden" data-testid="orderbook-card">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider" data-testid="orderbook-title">
            Order Book
          </h3>
          <span className="text-xs uppercase tracking-wider text-muted-foreground" data-testid="orderbook-coin">
            {coin}
          </span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-4 border-b border-border bg-muted/30 px-4 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Price
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Size
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Total
        </div>
      </div>

      <div className="relative">
        {/* Asks (Sells) - Top section, inverted order */}
        <div className="border-b border-border">
          {(() => {
            const reversedAsks = asks.slice().reverse();
            return reversedAsks.map((ask, idx) => {
              // For reversed asks (lowest price at top), cumulative increases from top to bottom toward the spread
              const cumTotal = reversedAsks.slice(0, idx + 1).reduce((sum, a) => sum + parseFloat(a.size), 0);
              const depthPercent = maxSize > 0 ? (parseFloat(ask.size) / maxSize) * 100 : 0;

              return (
                <div 
                  key={`ask-${idx}`} 
                  className="relative grid grid-cols-3 gap-4 px-4 py-1 hover-elevate"
                  data-testid={`orderbook-ask-${idx}`}
                >
                  {/* Depth bar - red for asks */}
                  <div 
                    className="absolute right-0 top-0 h-full bg-short/10 transition-all duration-200"
                    style={{ width: `${depthPercent}%` }}
                  />
                  
                  <div className="relative text-sm font-semibold text-short text-right" data-testid={`orderbook-ask-price-${idx}`}>
                    {formatPrice(ask.price)}
                </div>
                <div className="relative text-sm text-right" data-testid={`orderbook-ask-size-${idx}`}>
                  {formatSize(ask.size)}
                </div>
                <div className="relative text-sm text-muted-foreground text-right" data-testid={`orderbook-ask-total-${idx}`}>
                  {formatSize(cumTotal.toString())}
                </div>
              </div>
            );
          });
          })()}
        </div>

        {/* Spread indicator */}
        {bids.length > 0 && asks.length > 0 && (
          <div className="bg-muted/50 border-y border-border px-4 py-2" data-testid="orderbook-spread">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Spread</span>
              <span className="text-xs font-semibold">
                {(parseFloat(asks[0].price) - parseFloat(bids[0].price)).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Bids (Buys) - Bottom section */}
        <div>
          {bids.map((bid, idx) => {
            const cumTotal = bids.slice(0, idx + 1).reduce((sum, b) => sum + parseFloat(b.size), 0);
            const depthPercent = maxSize > 0 ? (parseFloat(bid.size) / maxSize) * 100 : 0;

            return (
              <div 
                key={`bid-${idx}`} 
                className="relative grid grid-cols-3 gap-4 px-4 py-1 hover-elevate"
                data-testid={`orderbook-bid-${idx}`}
              >
                {/* Depth bar - green for bids */}
                <div 
                  className="absolute right-0 top-0 h-full bg-long/10 transition-all duration-200"
                  style={{ width: `${depthPercent}%` }}
                />
                
                <div className="relative text-sm font-semibold text-long text-right" data-testid={`orderbook-bid-price-${idx}`}>
                  {formatPrice(bid.price)}
                </div>
                <div className="relative text-sm text-right" data-testid={`orderbook-bid-size-${idx}`}>
                  {formatSize(bid.size)}
                </div>
                <div className="relative text-sm text-muted-foreground text-right" data-testid={`orderbook-bid-total-${idx}`}>
                  {formatSize(cumTotal.toString())}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {bids.length === 0 && asks.length === 0 && (
          <div className="px-4 py-12 text-center" data-testid="orderbook-empty">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">
              {isConnected ? 'Loading order book...' : 'Connecting...'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
