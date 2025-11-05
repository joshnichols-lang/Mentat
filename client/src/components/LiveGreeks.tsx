import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Activity, Zap, Wind, Droplets } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface GreeksData {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv?: number; // Implied Volatility
}

interface LiveGreeksProps {
  asset: string; // e.g., "ETH", "BTC"
  instrumentName?: string; // Specific option instrument to track
}

const LiveGreeks = ({ asset, instrumentName }: LiveGreeksProps) => {
  const [greeks, setGreeks] = useState<GreeksData | null>(null);
  const [indexPrice, setIndexPrice] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to Aevo WebSocket for real-time Greeks data
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/aevo-market-data`;
    
    console.log(`[LiveGreeks] Connecting to ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[LiveGreeks] Connected to Aevo WebSocket");
      setIsConnected(true);

      // Subscribe to index price for the asset
      ws.send(JSON.stringify({
        action: "subscribe",
        type: "index",
        instrument: asset
      }));

      // If we have a specific instrument, subscribe to its ticker for Greeks
      if (instrumentName) {
        ws.send(JSON.stringify({
          action: "subscribe",
          type: "ticker",
          instrument: instrumentName
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "index" && message.data) {
          // Update index price
          const price = parseFloat(message.data.price || message.data.index_price);
          if (!isNaN(price)) {
            setIndexPrice(price);
          }
        }

        if (message.type === "ticker" && message.data) {
          // Extract Greeks from ticker data
          const data = message.data;
          
          if (data.greeks) {
            setGreeks({
              delta: parseFloat(data.greeks.delta || "0"),
              gamma: parseFloat(data.greeks.gamma || "0"),
              theta: parseFloat(data.greeks.theta || "0"),
              vega: parseFloat(data.greeks.vega || "0"),
              rho: parseFloat(data.greeks.rho || "0"),
              iv: data.greeks.iv ? parseFloat(data.greeks.iv) : undefined,
            });
          }

          // Also update index price if available in ticker
          if (data.index_price) {
            const price = parseFloat(data.index_price);
            if (!isNaN(price)) {
              setIndexPrice(price);
            }
          }
        }
      } catch (error) {
        console.error("[LiveGreeks] Failed to parse message:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("[LiveGreeks] Disconnected from Aevo WebSocket");
      console.log("[LiveGreeks] Close event - Code:", event.code, "Reason:", event.reason, "Clean:", event.wasClean);
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("[LiveGreeks] WebSocket error:", error);
      console.error("[LiveGreeks] WebSocket readyState:", ws.readyState);
      console.error("[LiveGreeks] WebSocket url:", ws.url);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Unsubscribe before closing
        ws.send(JSON.stringify({
          action: "unsubscribe",
          type: "index",
          instrument: asset
        }));
        
        if (instrumentName) {
          ws.send(JSON.stringify({
            action: "unsubscribe",
            type: "ticker",
            instrument: instrumentName
          }));
        }
      }
      ws.close();
    };
  }, [asset, instrumentName]);

  const formatGreek = (value: number | undefined, decimals: number = 4): string => {
    if (value === undefined || value === null) return "--";
    return value.toFixed(decimals);
  };

  const formatPrice = (value: number | null): string => {
    if (value === null) return "--";
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatIV = (value: number | undefined): string => {
    if (value === undefined || value === null) return "--";
    return `${(value * 100).toFixed(2)}%`;
  };

  const getGreekColor = (value: number | undefined, type: "delta" | "gamma" | "theta" | "vega" | "rho"): string => {
    if (value === undefined || value === null) return "text-foreground/50";
    
    switch (type) {
      case "delta":
        return value > 0 ? "text-long" : value < 0 ? "text-short" : "text-foreground/70";
      case "gamma":
        return value > 0.1 ? "text-primary" : "text-foreground/70";
      case "theta":
        return value < 0 ? "text-short" : "text-foreground/70";
      case "vega":
        return value > 0.1 ? "text-primary" : "text-foreground/70";
      case "rho":
        return value > 0 ? "text-long" : value < 0 ? "text-short" : "text-foreground/70";
      default:
        return "text-foreground/70";
    }
  };

  return (
    <div className="h-full flex flex-col space-y-3 p-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-foreground/90">Market Data</h4>
          <Badge 
            variant="outline" 
            className={`text-xs ${isConnected ? 'bg-long/10 text-long border-long/30' : 'bg-muted'}`}
            data-testid="badge-connection-status"
          >
            {isConnected ? "Live" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Index Price */}
      <Card className="bg-card border-border/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground/60">Index Price</span>
          <span className="text-lg font-bold font-mono" data-testid="text-index-price">
            {formatPrice(indexPrice)}
          </span>
        </div>
      </Card>

      {/* Greeks Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground/90">Option Greeks</h4>
        
        {!greeks && !instrumentName && (
          <Card className="bg-card border-border/50 p-4 text-center">
            <p className="text-xs text-foreground/50">
              Select a strategy to view Greeks
            </p>
          </Card>
        )}

        {!greeks && instrumentName && (
          <Card className="bg-card border-border/50 p-4 text-center">
            <div className="animate-pulse">
              <p className="text-xs text-foreground/50">
                Loading Greeks data...
              </p>
            </div>
          </Card>
        )}

        {greeks && (
          <div className="space-y-2">
            {/* Delta */}
            <Card className="bg-card border-border/50 p-3 hover-elevate transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Delta (Δ)</span>
                </div>
                <span 
                  className={`text-sm font-bold font-mono ${getGreekColor(greeks.delta, "delta")}`}
                  data-testid="text-delta"
                >
                  {formatGreek(greeks.delta, 4)}
                </span>
              </div>
              <p className="text-xs text-foreground/50 mt-1">Price sensitivity</p>
            </Card>

            {/* Gamma */}
            <Card className="bg-card border-border/50 p-3 hover-elevate transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Gamma (Γ)</span>
                </div>
                <span 
                  className={`text-sm font-bold font-mono ${getGreekColor(greeks.gamma, "gamma")}`}
                  data-testid="text-gamma"
                >
                  {formatGreek(greeks.gamma, 4)}
                </span>
              </div>
              <p className="text-xs text-foreground/50 mt-1">Delta acceleration</p>
            </Card>

            {/* Theta */}
            <Card className="bg-card border-border/50 p-3 hover-elevate transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Theta (Θ)</span>
                </div>
                <span 
                  className={`text-sm font-bold font-mono ${getGreekColor(greeks.theta, "theta")}`}
                  data-testid="text-theta"
                >
                  {formatGreek(greeks.theta, 4)}
                </span>
              </div>
              <p className="text-xs text-foreground/50 mt-1">Time decay</p>
            </Card>

            {/* Vega */}
            <Card className="bg-card border-border/50 p-3 hover-elevate transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Vega (ν)</span>
                </div>
                <span 
                  className={`text-sm font-bold font-mono ${getGreekColor(greeks.vega, "vega")}`}
                  data-testid="text-vega"
                >
                  {formatGreek(greeks.vega, 4)}
                </span>
              </div>
              <p className="text-xs text-foreground/50 mt-1">Volatility sensitivity</p>
            </Card>

            {/* Rho */}
            <Card className="bg-card border-border/50 p-3 hover-elevate transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Rho (ρ)</span>
                </div>
                <span 
                  className={`text-sm font-bold font-mono ${getGreekColor(greeks.rho, "rho")}`}
                  data-testid="text-rho"
                >
                  {formatGreek(greeks.rho, 4)}
                </span>
              </div>
              <p className="text-xs text-foreground/50 mt-1">Interest rate sensitivity</p>
            </Card>

            {/* Implied Volatility */}
            {greeks.iv !== undefined && (
              <Card className="bg-card border-border/50 p-3 hover-elevate transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">Implied Vol (IV)</span>
                  </div>
                  <span 
                    className="text-sm font-bold font-mono text-primary"
                    data-testid="text-iv"
                  >
                    {formatIV(greeks.iv)}
                  </span>
                </div>
                <p className="text-xs text-foreground/50 mt-1">Market volatility</p>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="flex-1"></div>
      <div className="pt-3 border-t border-border/20">
        <p className="text-xs text-foreground/40 text-center">
          Real-time data from Aevo
        </p>
      </div>
    </div>
  );
};

export default LiveGreeks;
