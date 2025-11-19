interface OrderBookRow {
  price: number;
  size: number;
  total: number;
  side: "buy" | "sell";
}

interface OrderBookProps {
  bids: OrderBookRow[];
  asks: OrderBookRow[];
  maxRows?: number;
}

export function OrderBook({ bids, asks, maxRows = 10 }: OrderBookProps) {
  const displayBids = bids.slice(0, maxRows);
  const displayAsks = asks.slice(0, maxRows).reverse();
  
  return (
    <div className="font-mono text-[10px] leading-tight">
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 pb-1 mb-1 border-b border-primary/30 text-primary/50">
        <div className="text-right">PRICE</div>
        <div className="text-right">SIZE</div>
        <div className="text-right">TOTAL</div>
      </div>
      
      {/* Asks (sells) - red */}
      <div className="space-y-0.5 mb-2">
        {displayAsks.map((ask, idx) => (
          <div
            key={`ask-${idx}`}
            className="grid grid-cols-3 gap-2 hover:bg-destructive/20 cursor-pointer transition-colors py-0.5 px-1"
            data-testid={`orderbook-ask-${idx}`}
          >
            <div className="text-destructive text-right">{ask.price.toFixed(2)}</div>
            <div className="text-destructive/70 text-right">{ask.size.toFixed(4)}</div>
            <div className="text-destructive/50 text-right">{ask.total.toFixed(2)}</div>
          </div>
        ))}
      </div>
      
      {/* Spread indicator */}
      {displayBids.length > 0 && displayAsks.length > 0 && (
        <div className="text-center text-warning py-1 border-y border-primary/20 mb-2">
          SPREAD: {Math.abs(displayAsks[0].price - displayBids[0].price).toFixed(2)}
        </div>
      )}
      
      {/* Bids (buys) - cyan */}
      <div className="space-y-0.5">
        {displayBids.map((bid, idx) => (
          <div
            key={`bid-${idx}`}
            className="grid grid-cols-3 gap-2 hover:bg-success/20 cursor-pointer transition-colors py-0.5 px-1"
            data-testid={`orderbook-bid-${idx}`}
          >
            <div className="text-success text-right">{bid.price.toFixed(2)}</div>
            <div className="text-success/70 text-right">{bid.size.toFixed(4)}</div>
            <div className="text-success/50 text-right">{bid.total.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { OrderBookRow };
