import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown } from "lucide-react";

interface Market {
  symbol: string;
  displayName: string;
  type: "perp" | "spot";
  szDecimals?: number;
  maxLeverage?: number;
}

interface MarketSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

export default function MarketSelector({ selectedSymbol, onSymbolChange }: MarketSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all available markets
  const { data: marketsData, isLoading } = useQuery({
    queryKey: ["/api/hyperliquid/markets"],
    enabled: open, // Only fetch when dialog is open
  });

  // Fetch current market data for prices
  const { data: marketData } = useQuery({
    queryKey: ["/api/hyperliquid/market-data"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const markets: Market[] = (marketsData as any)?.markets || [];
  const prices = (marketData as any)?.marketData || [];

  // Filter markets based on search query - ONLY PERPETUALS
  const filteredMarkets = markets.filter((market) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      market.symbol.toLowerCase().includes(query) ||
      market.displayName.toLowerCase().includes(query);
    
    // Only show perpetual markets
    return matchesSearch && market.type === "perp";
  });

  // All filtered markets are perpetuals
  const perpMarkets = filteredMarkets;

  const handleSelectMarket = (market: Market) => {
    onSymbolChange(market.symbol);
    setOpen(false);
    setSearchQuery("");
  };

  const getPriceInfo = (symbol: string) => {
    const priceData = prices.find((p: any) => p.symbol === symbol);
    return priceData || null;
  };

  const MarketRow = ({ market }: { market: Market }) => {
    const priceInfo = getPriceInfo(market.symbol);
    const change24h = priceInfo?.change24h ? parseFloat(priceInfo.change24h) : 0;
    const isPositive = change24h >= 0;

    return (
      <button
        onClick={() => handleSelectMarket(market)}
        className="w-full flex items-center justify-between p-3 rounded-md hover-elevate active-elevate-2 text-left"
        data-testid={`market-option-${market.symbol}`}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium">{market.displayName}</div>
            <div className="text-xs text-muted-foreground">
              {market.type === "perp" ? "Perpetual" : "Spot"}
              {market.maxLeverage && (
                <span className="ml-2 text-primary">{market.maxLeverage}x</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          {priceInfo && (
            <>
              <div className="font-mono text-sm">${parseFloat(priceInfo.price).toLocaleString()}</div>
              <div className={`text-xs flex items-center justify-end gap-1 ${
                isPositive ? "text-long" : "text-short"
              }`}>
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(change24h).toFixed(2)}%
              </div>
            </>
          )}
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hover:glow-orange"
          data-testid="button-market-selector"
        >
          <span className="font-bold text-primary">{selectedSymbol}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-glass/30 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Select Market
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass"
              data-testid="input-market-search"
            />
          </div>

          {/* Markets List */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading markets...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Perpetual Markets Only */}
                {perpMarkets.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                        Perpetual Futures
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {perpMarkets.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {perpMarkets.map((market) => (
                        <MarketRow key={market.symbol} market={market} />
                      ))}
                    </div>
                  </div>
                ) : (
                  !isLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      No perpetual markets found
                    </div>
                  )
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
