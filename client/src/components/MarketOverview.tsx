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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {markets.map((market) => (
        <Card key={market.symbol} className="p-3" data-testid={`card-market-${market.symbol}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{market.symbol}/USD</div>
              <div className="mt-0.5 font-mono text-xl font-bold" data-testid={`text-price-${market.symbol}`}>
                ${market.price.toLocaleString()}
              </div>
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${
              market.change24h >= 0 ? "text-chart-2" : "text-destructive"
            }`}>
              {market.change24h >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(market.change24h)}%
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
