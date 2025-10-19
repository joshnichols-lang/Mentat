import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSymbol } from "@/contexts/SymbolContext";

interface SymbolData {
  symbol: string;
  displayName: string;
  binanceSymbol: string;
  tradingViewSymbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

const SYMBOLS: Omit<SymbolData, 'price' | 'change24h' | 'volume24h'>[] = [
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
];

export default function CustomWatchlist() {
  const [symbolData, setSymbolData] = useState<Map<string, SymbolData>>(new Map());
  const { selectedSymbol, setSelectedSymbol } = useSymbol();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Fetch initial 24h ticker data from Binance REST API
    const fetchInitialData = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await response.json();
        
        const newData = new Map<string, SymbolData>();
        
        SYMBOLS.forEach(sym => {
          const ticker = data.find((t: any) => t.symbol.toLowerCase() === sym.binanceSymbol);
          if (ticker) {
            newData.set(sym.binanceSymbol, {
              ...sym,
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

    fetchInitialData();

    // Connect to Binance WebSocket for real-time updates
    const streams = SYMBOLS.map(s => `${s.binanceSymbol}@ticker`).join('/');
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
          const symbolConfig = SYMBOLS.find(s => s.binanceSymbol === binanceSymbol);
          
          if (symbolConfig) {
            setSymbolData(prev => {
              const newData = new Map(prev);
              newData.set(binanceSymbol, {
                ...symbolConfig,
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
  }, []);

  const handleSymbolClick = (tradingViewSymbol: string) => {
    setSelectedSymbol(tradingViewSymbol);
  };

  return (
    <Card data-testid="card-custom-watchlist">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">Market Watch</CardTitle>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {SYMBOLS.map(sym => {
            const data = symbolData.get(sym.binanceSymbol);
            const isSelected = selectedSymbol === sym.tradingViewSymbol;
            
            return (
              <button
                key={sym.symbol}
                onClick={() => handleSymbolClick(sym.tradingViewSymbol)}
                className={`w-full px-4 py-3 text-left transition-colors hover-elevate active-elevate-2 ${
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
