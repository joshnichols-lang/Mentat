import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSymbol } from "@/contexts/SymbolContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SymbolData {
  symbol: string;
  displayName: string;
  binanceSymbol: string;
  tradingViewSymbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface WatchlistSymbol {
  id: string;
  symbol: string;
  displayName: string;
  binanceSymbol: string;
  tradingViewSymbol: string;
  sortOrder: number;
}

// All available symbols that can be added
const AVAILABLE_SYMBOLS = [
  { symbol: "BTC", displayName: "Bitcoin", binanceSymbol: "btcusdt", tradingViewSymbol: "BINANCE:BTCUSDT" },
  { symbol: "ETH", displayName: "Ethereum", binanceSymbol: "ethusdt", tradingViewSymbol: "BINANCE:ETHUSDT" },
  { symbol: "SOL", displayName: "Solana", binanceSymbol: "solusdt", tradingViewSymbol: "BINANCE:SOLUSDT" },
  { symbol: "BNB", displayName: "BNB", binanceSymbol: "bnbusdt", tradingViewSymbol: "BINANCE:BNBUSDT" },
  { symbol: "ADA", displayName: "Cardano", binanceSymbol: "adausdt", tradingViewSymbol: "BINANCE:ADAUSDT" },
  { symbol: "AVAX", displayName: "Avalanche", binanceSymbol: "avaxusdt", tradingViewSymbol: "BINANCE:AVAXUSDT" },
  { symbol: "DOGE", displayName: "Dogecoin", binanceSymbol: "dogeusdt", tradingViewSymbol: "BINANCE:DOGEUSDT" },
  { symbol: "DOT", displayName: "Polkadot", binanceSymbol: "dotusdt", tradingViewSymbol: "BINANCE:DOTUSDT" },
  { symbol: "MATIC", displayName: "Polygon", binanceSymbol: "maticusdt", tradingViewSymbol: "BINANCE:MATICUSDT" },
  { symbol: "ARB", displayName: "Arbitrum", binanceSymbol: "arbusdt", tradingViewSymbol: "BINANCE:ARBUSDT" },
  { symbol: "XRP", displayName: "Ripple", binanceSymbol: "xrpusdt", tradingViewSymbol: "BINANCE:XRPUSDT" },
  { symbol: "LINK", displayName: "Chainlink", binanceSymbol: "linkusdt", tradingViewSymbol: "BINANCE:LINKUSDT" },
  { symbol: "UNI", displayName: "Uniswap", binanceSymbol: "uniusdt", tradingViewSymbol: "BINANCE:UNIUSDT" },
  { symbol: "LTC", displayName: "Litecoin", binanceSymbol: "ltcusdt", tradingViewSymbol: "BINANCE:LTCUSDT" },
  { symbol: "ATOM", displayName: "Cosmos", binanceSymbol: "atomusdt", tradingViewSymbol: "BINANCE:ATOMUSDT" },
];

export default function CustomWatchlist() {
  const [symbolData, setSymbolData] = useState<Map<string, SymbolData>>(new Map());
  const { selectedSymbol, setSelectedSymbol } = useSymbol();
  const [isConnected, setIsConnected] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch user's watchlist from database
  const { data: watchlistResponse, isLoading } = useQuery<{ symbols: WatchlistSymbol[] }>({
    queryKey: ["/api/watchlist"],
  });

  const userWatchlist: WatchlistSymbol[] = watchlistResponse?.symbols || [];

  // Add symbol mutation
  const addSymbolMutation = useMutation({
    mutationFn: async (symbolConfig: typeof AVAILABLE_SYMBOLS[0]) => {
      return apiRequest("POST", "/api/watchlist", {
        ...symbolConfig,
        sortOrder: userWatchlist.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Symbol added",
        description: "The symbol has been added to your watchlist",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add symbol to watchlist",
        variant: "destructive",
      });
    },
  });

  // Remove symbol mutation
  const removeSymbolMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("DELETE", `/api/watchlist/${symbol}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Symbol removed",
        description: "The symbol has been removed from your watchlist",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove symbol from watchlist",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Fetch initial 24h ticker data from Binance REST API
    const fetchInitialData = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await response.json();
        
        const newData = new Map<string, SymbolData>();
        
        userWatchlist.forEach(sym => {
          const ticker = data.find((t: any) => t.symbol.toLowerCase() === sym.binanceSymbol);
          if (ticker) {
            newData.set(sym.binanceSymbol, {
              symbol: sym.symbol,
              displayName: sym.displayName,
              binanceSymbol: sym.binanceSymbol,
              tradingViewSymbol: sym.tradingViewSymbol,
              price: parseFloat(ticker.lastPrice),
              change24h: parseFloat(ticker.priceChangePercent),
              volume24h: parseFloat(ticker.volume),
            });
          }
        });
        
        setSymbolData(newData);
      } catch (error) {
        console.error("Failed to fetch initial ticker data:", error);
      }
    };

    if (userWatchlist.length > 0) {
      fetchInitialData();

      // Connect to Binance WebSocket for real-time updates
      const streams = userWatchlist.map(s => `${s.binanceSymbol}@ticker`).join('/');
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

      ws.onopen = () => {
        console.log("Binance WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const ticker = message.data;
          
          if (ticker && ticker.s) {
            const binanceSymbol = ticker.s.toLowerCase();
            const symbolConfig = userWatchlist.find(s => s.binanceSymbol === binanceSymbol);
            
            if (symbolConfig) {
              setSymbolData(prev => {
                const newData = new Map(prev);
                newData.set(binanceSymbol, {
                  symbol: symbolConfig.symbol,
                  displayName: symbolConfig.displayName,
                  binanceSymbol: symbolConfig.binanceSymbol,
                  tradingViewSymbol: symbolConfig.tradingViewSymbol,
                  price: parseFloat(ticker.c),
                  change24h: parseFloat(ticker.P),
                  volume24h: parseFloat(ticker.v),
                });
                return newData;
              });
            }
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("Binance WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("Binance WebSocket disconnected");
        setIsConnected(false);
      };

      return () => {
        ws.close();
      };
    }
  }, [userWatchlist.map(s => s.symbol).join(',')]);

  const handleSymbolClick = (tradingViewSymbol: string) => {
    setSelectedSymbol(tradingViewSymbol);
  };

  const handleAddSymbol = (symbolConfig: typeof AVAILABLE_SYMBOLS[0]) => {
    addSymbolMutation.mutate(symbolConfig);
  };

  const handleRemoveSymbol = (symbol: string) => {
    removeSymbolMutation.mutate(symbol);
  };

  const availableToAdd = AVAILABLE_SYMBOLS.filter(
    sym => !userWatchlist.some(ws => ws.symbol === sym.symbol)
  );

  if (isLoading) {
    return (
      <Card data-testid="card-custom-watchlist">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Market Watch</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading watchlist...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-custom-watchlist">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Market Watch</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                variant="outline"
                data-testid="button-add-symbol"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-symbol">
              <DialogHeader>
                <DialogTitle>Add Symbol to Watchlist</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {availableToAdd.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    All available symbols are already in your watchlist
                  </p>
                ) : (
                  availableToAdd.map(sym => (
                    <Button
                      key={sym.symbol}
                      variant="outline"
                      className="justify-start"
                      onClick={() => handleAddSymbol(sym)}
                      disabled={addSymbolMutation.isPending}
                      data-testid={`button-add-${sym.symbol.toLowerCase()}`}
                    >
                      <span className="font-mono font-semibold">{sym.symbol}</span>
                      <span className="ml-2 text-muted-foreground">{sym.displayName}</span>
                    </Button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {userWatchlist.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Your watchlist is empty
            </p>
            <Button 
              size="sm" 
              onClick={() => setIsAddDialogOpen(true)}
              data-testid="button-add-first-symbol"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Symbols
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {userWatchlist.map(sym => {
              const data = symbolData.get(sym.binanceSymbol);
              const isSelected = selectedSymbol === sym.tradingViewSymbol;
              
              return (
                <div
                  key={sym.symbol}
                  className="flex items-center gap-2 px-4 py-3 group"
                >
                  <button
                    onClick={() => handleSymbolClick(sym.tradingViewSymbol)}
                    className={`flex-1 text-left transition-colors hover-elevate active-elevate-2 rounded px-2 py-1 ${
                      isSelected ? 'bg-accent' : ''
                    }`}
                    data-testid={`button-symbol-${sym.symbol.toLowerCase()}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-semibold">{sym.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">{sym.displayName}</div>
                      </div>
                      {data ? (
                        <div className="text-right ml-2">
                          <div className="font-mono text-sm" data-testid={`text-price-${sym.symbol.toLowerCase()}`}>
                            ${data.price.toLocaleString(undefined, { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: data.price < 1 ? 6 : 2 
                            })}
                          </div>
                          <div 
                            className={`font-mono text-xs ${
                              data.change24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}
                            data-testid={`text-change-${sym.symbol.toLowerCase()}`}
                          >
                            {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
                          </div>
                        </div>
                      ) : (
                        <div className="text-right ml-2">
                          <div className="font-mono text-sm text-muted-foreground">Loading...</div>
                        </div>
                      )}
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveSymbol(sym.symbol)}
                    disabled={removeSymbolMutation.isPending}
                    data-testid={`button-remove-${sym.symbol.toLowerCase()}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
