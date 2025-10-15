import { TrendingUp, TrendingDown, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface HyperliquidMarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

const DEFAULT_WATCHLIST = ["BTC-PERP", "ETH-PERP", "SOL-PERP", "ARB-PERP"];
const MAX_WATCHLIST_SIZE = 10;

export default function MarketOverview() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem("watchlist");
    return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ marketData: HyperliquidMarketData[] }>({
    queryKey: ["/api/hyperliquid/market-data"],
    refetchInterval: 5000,
  });

  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  const allMarkets = data?.marketData || [];
  const watchlistMarkets = allMarkets.filter(m => watchlist.includes(m.symbol));
  
  const availableMarkets = allMarkets.filter(m => 
    !watchlist.includes(m.symbol) && 
    m.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToWatchlist = (symbol: string) => {
    if (watchlist.length < MAX_WATCHLIST_SIZE && !watchlist.includes(symbol)) {
      setWatchlist([...watchlist, symbol]);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  if (isLoading) {
    return (
      <Card className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Watchlist</h2>
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Watchlist</h2>
          <Badge variant="destructive" className="text-xs">Error</Badge>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Failed to load market data
          </p>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => refetch()}
            data-testid="button-retry-market-data"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Watchlist</h2>
          <Badge variant="outline" className="text-xs">
            {watchlist.length}/{MAX_WATCHLIST_SIZE}
          </Badge>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 gap-1 text-xs"
              disabled={watchlist.length >= MAX_WATCHLIST_SIZE}
              data-testid="button-add-to-watchlist"
            >
              <Plus className="h-3 w-3" />
              Add Pair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Trading Pair</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Search pairs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-pairs"
              />
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {availableMarkets.map((market) => {
                    const price = parseFloat(market.price);
                    const change24h = parseFloat(market.change24h);
                    const displaySymbol = market.symbol.replace("-PERP", "");
                    
                    return (
                      <div
                        key={market.symbol}
                        className="flex items-center justify-between rounded-md border p-3 hover-elevate active-elevate-2"
                        data-testid={`row-available-${displaySymbol}`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold">{displaySymbol}/USD</div>
                          <div className="text-xs text-muted-foreground">
                            ${price.toLocaleString()}
                            <span className={`ml-2 ${change24h >= 0 ? "text-chart-2" : "text-destructive"}`}>
                              {change24h >= 0 ? "+" : ""}{change24h}%
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            addToWatchlist(market.symbol);
                            if (watchlist.length + 1 >= MAX_WATCHLIST_SIZE) {
                              setIsDialogOpen(false);
                            }
                          }}
                          data-testid={`button-add-${displaySymbol}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {availableMarkets.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {searchQuery ? "No pairs found" : "All available pairs are in your watchlist"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Pair</th>
              <th className="pb-2 font-medium text-right">Price</th>
              <th className="pb-2 font-medium text-right">24h Change</th>
              <th className="pb-2 font-medium text-right">24h Volume</th>
              <th className="pb-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {watchlistMarkets.map((market) => {
              const price = parseFloat(market.price);
              const change24h = parseFloat(market.change24h);
              const volume24h = parseFloat(market.volume24h);
              const displaySymbol = market.symbol.replace("-PERP", "");
              
              return (
                <tr 
                  key={market.symbol} 
                  className="border-b last:border-0 hover-elevate"
                  data-testid={`row-watchlist-${displaySymbol}`}
                >
                  <td className="py-2.5">
                    <div className="font-semibold">{displaySymbol}/USD</div>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="font-mono font-semibold" data-testid={`text-price-${displaySymbol}`}>
                      ${price.toLocaleString()}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className={`flex items-center justify-end gap-1 font-mono text-sm font-medium ${
                      change24h >= 0 ? "text-chart-2" : "text-destructive"
                    }`}>
                      {change24h >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="font-mono text-sm text-muted-foreground">
                      ${volume24h >= 1000000 
                        ? `${(volume24h / 1000000).toFixed(1)}M` 
                        : volume24h >= 1000
                        ? `${(volume24h / 1000).toFixed(1)}K`
                        : volume24h.toFixed(0)}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => removeFromWatchlist(market.symbol)}
                      data-testid={`button-remove-${displaySymbol}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {watchlistMarkets.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No pairs in watchlist. Click "Add Pair" to get started.
          </div>
        )}
      </div>
    </Card>
  );
}
