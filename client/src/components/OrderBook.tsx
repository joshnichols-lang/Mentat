import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useMarketDataWebSocket } from '@/hooks/useMarketDataWebSocket';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [decimalPrecision, setDecimalPrecision] = useState<number | null>(null);

  // Calculate default precision based on mid price
  const getDefaultPrecision = (midPrice: number) => {
    if (midPrice >= 10000) return 10;
    if (midPrice >= 1000) return 1;
    if (midPrice >= 100) return 0.1;
    if (midPrice >= 1) return 0.01;
    return 0.0001;
  };

  // Group order book levels by precision
  const groupLevels = (levels: OrderBookLevel[], precision: number, isAsk: boolean = false) => {
    const grouped = new Map<string, number>();
    
    levels.forEach(level => {
      const price = parseFloat(level.price);
      // For asks, round UP to bucket; for bids, round DOWN
      const groupedPrice = isAsk 
        ? Math.ceil(price / precision) * precision
        : Math.floor(price / precision) * precision;
      const key = groupedPrice.toFixed(10); // Use high precision key to avoid rounding issues
      
      const currentSize = grouped.get(key) || 0;
      grouped.set(key, currentSize + parseFloat(level.size));
    });

    return Array.from(grouped.entries())
      .map(([price, size]) => ({
        price: parseFloat(price).toFixed(getPriceDecimals(precision)),
        size: size.toString()
      }))
      // Sort asks ascending (lowest first), bids descending (highest first)
      .sort((a, b) => isAsk 
        ? parseFloat(a.price) - parseFloat(b.price)
        : parseFloat(b.price) - parseFloat(a.price)
      );
  };

  const getPriceDecimals = (precision: number) => {
    if (precision >= 10) return 0;
    if (precision >= 1) return 1;
    if (precision >= 0.1) return 2;
    if (precision >= 0.01) return 3;
    if (precision >= 0.001) return 4;
    if (precision >= 0.0001) return 5;
    return 6; // For very fine precisions like 0.00001
  };

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
            .sort((a: OrderBookLevel, b: OrderBookLevel) => parseFloat(b.price) - parseFloat(a.price));
          
          const formattedAsks = rawAsks
            .map((level: any) => ({ price: level.px, size: level.sz }))
            .sort((a: OrderBookLevel, b: OrderBookLevel) => parseFloat(a.price) - parseFloat(b.price));

          // Set default precision on first data
          if (decimalPrecision === null && formattedBids.length > 0) {
            const midPrice = parseFloat(formattedBids[0].price);
            setDecimalPrecision(getDefaultPrecision(midPrice));
          }

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
  }, [coin, isConnected, subscribe, unsubscribe, addListener, decimalPrecision]);

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    return num >= 1000 ? num.toFixed(1) : num >= 1 ? num.toFixed(2) : num.toFixed(4);
  };

  const formatSize = (size: string) => {
    const num = parseFloat(size);
    return num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toFixed(3);
  };

  // Apply grouping if precision is set
  const displayBids = decimalPrecision !== null ? groupLevels(bids, decimalPrecision, false).slice(0, maxLevels) : bids.slice(0, maxLevels);
  const displayAsks = decimalPrecision !== null ? groupLevels(asks, decimalPrecision, true).slice(0, maxLevels) : asks.slice(0, maxLevels);

  // Calculate max size for depth visualization
  const maxBidSize = Math.max(...displayBids.map(b => parseFloat(b.size)), 0);
  const maxAskSize = Math.max(...displayAsks.map(a => parseFloat(a.size)), 0);
  const maxSize = Math.max(maxBidSize, maxAskSize);

  // Precision options based on price range
  const precisionOptions = bids.length > 0 ? (() => {
    const midPrice = parseFloat(bids[0]?.price || '0');
    if (midPrice >= 10000) return [100, 50, 10, 5, 1];
    if (midPrice >= 1000) return [10, 5, 1, 0.5, 0.1];
    if (midPrice >= 100) return [1, 0.5, 0.1, 0.05, 0.01];
    if (midPrice >= 1) return [0.1, 0.05, 0.01, 0.005, 0.001];
    return [0.01, 0.001, 0.0001, 0.00001];
  })() : [0.01];

  return (
    <Card className="p-0 overflow-hidden" data-testid="orderbook-card">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider" data-testid="orderbook-title">
            Order Book
          </h3>
          <div className="flex items-center gap-2">
            <Select 
              value={decimalPrecision?.toString() || ''}
              onValueChange={(value) => setDecimalPrecision(parseFloat(value))}
            >
              <SelectTrigger 
                className="w-[90px] h-7 text-xs font-mono"
                data-testid="select-precision"
              >
                <SelectValue placeholder="0.01" />
              </SelectTrigger>
              <SelectContent>
                {precisionOptions.map(opt => (
                  <SelectItem 
                    key={opt} 
                    value={opt.toString()}
                    className="text-xs font-mono"
                    data-testid={`precision-option-${opt}`}
                  >
                    {opt >= 1 ? opt.toFixed(0) : opt.toFixed(opt < 0.01 ? 4 : 2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs uppercase tracking-wider text-muted-foreground" data-testid="orderbook-coin">
              {coin}
            </span>
          </div>
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
            const reversedAsks = displayAsks.slice().reverse();
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
                    {ask.price}
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
        {displayBids.length > 0 && displayAsks.length > 0 && (
          <div className="bg-muted/50 border-y border-border px-4 py-2" data-testid="orderbook-spread">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Spread</span>
              <span className="text-xs font-semibold">
                {(parseFloat(displayAsks[0].price) - parseFloat(displayBids[0].price)).toFixed(decimalPrecision !== null ? getPriceDecimals(decimalPrecision) : 2)}
              </span>
            </div>
          </div>
        )}

        {/* Bids (Buys) - Bottom section */}
        <div>
          {displayBids.map((bid, idx) => {
            const cumTotal = displayBids.slice(0, idx + 1).reduce((sum, b) => sum + parseFloat(b.size), 0);
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
                  {bid.price}
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
        {displayBids.length === 0 && displayAsks.length === 0 && (
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
