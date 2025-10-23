import { X, XCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import MiniPriceChart from "@/components/MiniPriceChart";
import { PositionSparkline } from "@/components/PositionSparkline";
import { AnimatedCounter } from "@/components/AnimatedCounter";

interface HyperliquidPosition {
  coin: string;
  szi: string;
  entryPx?: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity?: string;
  liquidationPx: string | null;
  leverage: {
    type: string;
    value: number;
  };
}

interface Order {
  oid: number;
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  reduceOnly: boolean;
  orderType?: string;
  triggerPx?: string;
  tpsl?: string;
}

export default function PositionsGrid() {
  const { toast } = useToast();
  
  const { data, isLoading } = useQuery<{ positions: HyperliquidPosition[] }>({
    queryKey: ["/api/hyperliquid/positions"],
    refetchInterval: 30000, // Increased from 15s to 30s to reduce API load
  });

  const { data: marketData } = useQuery<{ marketData: Array<{ symbol: string; price: string; change24h: string; }> }>({
    queryKey: ["/api/hyperliquid/market-data"],
  });

  const { data: ordersData } = useQuery<{ orders: Order[] }>({
    queryKey: ["/api/hyperliquid/open-orders"],
    refetchInterval: 30000, // Increased from 15s to 30s to reduce API load
  });

  const positions = data?.positions || [];
  const orders = ordersData?.orders || [];
  
  // Close single position mutation
  const closePositionMutation = useMutation({
    mutationFn: async (coin: string) => {
      const response = await apiRequest("POST", "/api/hyperliquid/close-position", { coin });
      return response.json();
    },
    onSuccess: (_, coin) => {
      toast({
        title: "Position Closed",
        description: `Successfully closed position for ${coin.replace("-PERP", "")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/open-orders"] });
    },
    onError: (error: any, coin) => {
      toast({
        title: "Close Failed",
        description: error.message || `Failed to close position for ${coin.replace("-PERP", "")}`,
        variant: "destructive",
      });
    },
  });

  // Close all positions mutation
  const closeAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/hyperliquid/close-all", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      const { closedPositions, cancelledOrders, errors } = data.results;
      
      let description = "";
      if (closedPositions.length > 0) {
        description += `Closed ${closedPositions.length} position(s). `;
      }
      if (cancelledOrders.length > 0) {
        description += `Cancelled ${cancelledOrders.length} order(s). `;
      }
      if (errors.length > 0) {
        description += `${errors.length} error(s) occurred.`;
      }
      
      toast({
        title: "Close All Completed",
        description: description || "No positions or orders to close",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/open-orders"] });
    },
    onError: (error: any) => {
      toast({
        title: "Close All Failed",
        description: error.message || "Failed to close all positions",
        variant: "destructive",
      });
    },
  });
  
  // Helper to find stop loss and take profit for a position
  const getPositionOrders = (coin: string) => {
    const positionOrders = orders.filter(order => order.coin === coin && order.reduceOnly);
    const stopLoss = positionOrders.find(order => order.tpsl === "sl");
    const takeProfit = positionOrders.find(order => order.tpsl === "tp");
    return { stopLoss, takeProfit };
  };

  const handleClose = (coin: string) => {
    closePositionMutation.mutate(coin);
  };

  const handleCloseAll = () => {
    closeAllMutation.mutate();
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold">Positions</h2>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Card key={i} className="p-3">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold">Positions</h2>
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No active positions
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Positions</h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleCloseAll}
          disabled={closeAllMutation.isPending}
          data-testid="button-close-all"
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          {closeAllMutation.isPending ? "Closing..." : "Close All"}
        </Button>
      </div>
      <div className="space-y-2">
        {positions.map((position) => {
          const size = parseFloat(position.szi);
          const side = size > 0 ? "long" : "short";
          const absSize = Math.abs(size);
          const entryPrice = parseFloat(position.entryPx || "0");
          const pnl = parseFloat(position.unrealizedPnl || "0");
          const roe = parseFloat(position.returnOnEquity || "0");
          const displaySymbol = position.coin.replace("-PERP", "");
          const liquidationPrice = position.liquidationPx ? parseFloat(position.liquidationPx) : null;
          
          // Find matching market data for this position
          const market = marketData?.marketData.find(m => m.symbol === position.coin);
          const currentPrice = market ? parseFloat(market.price) : entryPrice;
          const change24h = market ? parseFloat(market.change24h) : 0;
          const hasMarketData = !!market;
          
          // Generate sparkline data (simulate recent price movement)
          const sparklineData = Array.from({ length: 20 }, (_, i) => {
            const variation = (Math.random() - 0.5) * currentPrice * 0.02;
            return currentPrice + variation;
          });
          
          const { stopLoss, takeProfit } = getPositionOrders(position.coin);
          
          return (
            <Card key={position.coin} className="group p-3 hover-elevate transition-all duration-300 border-l-4" 
                  style={{ borderLeftColor: side === "long" ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
                  data-testid={`card-position-${position.coin}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        side === "long" 
                          ? "bg-gradient-to-br from-primary/20 to-primary/5" 
                          : "bg-gradient-to-br from-destructive/20 to-destructive/5"
                      }`}>
                        {side === "long" ? (
                          <TrendingUp className="h-4 w-4 text-primary" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <HoverCard openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <div className="text-sm font-semibold cursor-default">{displaySymbol}/USD</div>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" align="start" className="w-auto p-3">
                            {hasMarketData ? (
                              <MiniPriceChart
                                symbol={displaySymbol}
                                currentPrice={currentPrice}
                                change24h={change24h}
                              />
                            ) : (
                              <div className="w-[280px] text-center text-sm text-muted-foreground py-4">
                                Market data unavailable
                              </div>
                            )}
                          </HoverCardContent>
                        </HoverCard>
                        <div className="text-xs text-muted-foreground">
                          {absSize.toFixed(4)} @ ${entryPrice.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant={side === "long" ? "default" : "destructive"}
                      className={`gap-1 ${side === "long" ? "bg-long text-long-foreground hover:bg-long/90" : "bg-short text-short-foreground hover:bg-short/90"}`}
                    >
                      {side.toUpperCase()} {position.leverage.value}x
                    </Badge>
                  </div>
                  
                  {/* Inline Sparkline Chart */}
                  <div className="rounded-lg bg-muted/30 p-2">
                    <PositionSparkline 
                      data={sparklineData}
                      color={side === "long" ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                      fillColor={side === "long" ? "hsl(var(--primary) / 0.1)" : "hsl(var(--destructive) / 0.1)"}
                      width={200}
                      height={40}
                    />
                  </div>
                  
                  {/* Metrics Grid with Animated Counters */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">P&L</div>
                      <div className={`text-sm font-bold ${
                        pnl >= 0 ? "text-green-500" : "text-destructive"
                      }`} data-testid={`text-pnl-${position.coin}`}>
                        <AnimatedCounter value={pnl} prefix={pnl >= 0 ? "+" : ""} decimals={2} />
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">ROE</div>
                      <div className="text-sm font-bold">
                        <AnimatedCounter value={roe * 100} suffix="%" decimals={2} />
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Value</div>
                      <div className="text-sm font-medium">
                        $<AnimatedCounter value={parseFloat(position.positionValue)} decimals={2} />
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Liq Price</div>
                      <div className="text-sm font-medium" data-testid={`text-liquidation-${position.coin}`}>
                        {liquidationPrice ? `$${liquidationPrice.toLocaleString()}` : "N/A"}
                      </div>
                    </div>
                  </div>
                  
                  {/* Protective Orders Display */}
                  {(stopLoss || takeProfit) && (
                    <div className="flex gap-2 text-xs">
                      {stopLoss && (
                        <Badge variant="outline" className="text-destructive border-destructive/50">
                          SL: ${parseFloat(stopLoss.limitPx).toFixed(2)}
                        </Badge>
                      )}
                      {takeProfit && (
                        <Badge variant="outline" className="text-green-500 border-green-500/50">
                          TP: ${parseFloat(takeProfit.limitPx).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleClose(position.coin)}
                  data-testid={`button-close-${position.coin}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
