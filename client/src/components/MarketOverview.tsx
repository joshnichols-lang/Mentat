import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: string;
}

export default function MarketOverview() {
  // todo: remove mock functionality
  const markets: MarketData[] = [
    { symbol: "BTC", price: 43250.50, change24h: 2.45, volume24h: "$1.2B" },
    { symbol: "ETH", price: 2285.75, change24h: -1.23, volume24h: "$850M" },
    { symbol: "SOL", price: 98.32, change24h: 5.67, volume24h: "$420M" },
    { symbol: "ARB", price: 1.85, change24h: 3.21, volume24h: "$180M" },
  ];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Market Overview</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {markets.map((market) => (
          <Card key={market.symbol} className="p-4" data-testid={`card-market-${market.symbol}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{market.symbol}/USD</div>
                <div className="mt-1 text-2xl font-mono font-bold" data-testid={`text-price-${market.symbol}`}>
                  ${market.price.toLocaleString()}
                </div>
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                market.change24h >= 0 ? "text-chart-2" : "text-destructive"
              }`}>
                {market.change24h >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {Math.abs(market.change24h)}%
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              24h Vol: <span className="font-mono">{market.volume24h}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
