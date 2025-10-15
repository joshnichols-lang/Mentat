import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface HyperliquidMarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

export default function MarketOverview() {
  const { data, isLoading } = useQuery<{ marketData: HyperliquidMarketData[] }>({
    queryKey: ["/api/hyperliquid/market-data"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Filter to show only major perpetual contracts
  const majorSymbols = ["BTC-PERP", "ETH-PERP", "SOL-PERP", "ARB-PERP"];
  const markets = data?.marketData?.filter(m => majorSymbols.includes(m.symbol)) || [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-3">
            <Skeleton className="h-16 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {markets.map((market) => {
        const price = parseFloat(market.price);
        const change24h = parseFloat(market.change24h);
        const displaySymbol = market.symbol.replace("-PERP", "");
        
        return (
          <Card key={market.symbol} className="p-3" data-testid={`card-market-${displaySymbol}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{displaySymbol}/USD</div>
                <div className="mt-0.5 font-mono text-xl font-bold" data-testid={`text-price-${displaySymbol}`}>
                  ${price.toLocaleString()}
                </div>
              </div>
              <div className={`flex items-center gap-0.5 text-xs font-medium ${
                change24h >= 0 ? "text-chart-2" : "text-destructive"
              }`}>
                {change24h >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(change24h)}%
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
