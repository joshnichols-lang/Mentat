import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeriesPartialOptions } from 'lightweight-charts';
import { TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";

interface OrderbookEntry {
  price: string;
  quantity: string;
}

interface Orderbook {
  symbol: string;
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
}

export default function DexTrading() {
  const { toast } = useToast();
  const [selectedSymbol, setSelectedSymbol] = useState<string>("PERP_BTC_USDC");
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [orderPrice, setOrderPrice] = useState<string>("");
  const [orderQuantity, setOrderQuantity] = useState<string>("");
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Fetch available symbols
  const { data: symbolsData } = useQuery<any>({
    queryKey: ['/api/orderly/symbols'],
  });

  // Fetch orderbook data
  const { data: orderbookData } = useQuery<any>({
    queryKey: ['/api/orderly/orderbook', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/orderly/orderbook?symbol=${selectedSymbol}&maxLevel=20`);
      if (!response.ok) throw new Error('Failed to fetch orderbook');
      return response.json();
    },
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Fetch market data
  const { data: marketData } = useQuery<any>({
    queryKey: ['/api/orderly/market-data', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/orderly/market-data?symbol=${selectedSymbol}`);
      if (!response.ok) throw new Error('Failed to fetch market data');
      return response.json();
    },
    refetchInterval: 3000,
  });

  // Update orderbook when data arrives
  useEffect(() => {
    if (orderbookData?.success && orderbookData?.orderbook) {
      setOrderbook(orderbookData.orderbook);
    }
  }, [orderbookData]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#fafafa' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#e0e0e0' },
        horzLines: { color: '#e0e0e0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: '#cccccc',
      },
      rightPriceScale: {
        borderColor: '#cccccc',
      },
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: 'hsl(var(--foreground))',
      downColor: 'hsl(var(--muted-foreground))',
      borderVisible: false,
      wickUpColor: 'hsl(var(--foreground))',
      wickDownColor: 'hsl(var(--muted-foreground))',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries as any;

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Fetch and update kline data for chart
  useEffect(() => {
    if (!candlestickSeriesRef.current || !selectedSymbol) return;

    const fetchKlines = async () => {
      try {
        const response = await fetch(`/api/orderly/klines?symbol=${selectedSymbol}&interval=15m&limit=100`);
        if (!response.ok) return;
        
        const data = await response.json();
        if (data.success && data.klines) {
          // Orderly klines format: [[timestamp_ms, open, high, low, close, volume], ...]
          const formattedData = data.klines.map((kline: any[]) => ({
            time: Math.floor(kline[0] / 1000) as any, // Convert ms to seconds
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
          }));
          
          candlestickSeriesRef.current.setData(formattedData as any);
        }
      } catch (error) {
        console.error('Failed to fetch klines:', error);
      }
    };

    fetchKlines();
  }, [selectedSymbol]);

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch('/api/orderly/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to place order');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Placed",
        description: "Your order has been submitted successfully",
      });
      // Reset form
      setOrderPrice("");
      setOrderQuantity("");
      // Refetch positions and orders
      queryClient.invalidateQueries({ queryKey: ['/api/orderly/positions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orderly/orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    },
  });

  const handlePlaceOrder = () => {
    if (!orderQuantity || (orderType === 'LIMIT' && !orderPrice)) {
      toast({
        title: "Invalid Order",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    placeOrderMutation.mutate({
      symbol: selectedSymbol,
      side: orderSide,
      orderType,
      orderPrice: orderType === 'LIMIT' ? parseFloat(orderPrice) : undefined,
      orderQuantity: parseFloat(orderQuantity),
    });
  };

  const symbols = symbolsData?.symbols || [];
  const currentPrice = marketData?.marketData?.markPrice 
    ? parseFloat(marketData.marketData.markPrice) 
    : 0;

  // Calculate mid price from orderbook
  const midPrice = orderbook && orderbook.asks.length > 0 && orderbook.bids.length > 0
    ? (parseFloat(orderbook.asks[0][0]) + parseFloat(orderbook.bids[0][0])) / 2
    : currentPrice;

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold font-serif">Orderly DEX Trading</h1>
            <Badge variant="outline" className="text-xs">
              LIVE
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-48" data-testid="select-symbol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((symbol: any) => (
                  <SelectItem key={symbol.symbol} value={symbol.symbol} data-testid={`symbol-${symbol.symbol}`}>
                    {symbol.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {currentPrice > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mark:</span>
                <span className="text-lg font-mono font-semibold" data-testid="text-current-price">
                  ${currentPrice.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Orderbook */}
          <ResizablePanel defaultSize={25} minSize={20}>
            <Card className="h-full rounded-none border-0 border-r">
              <CardHeader className="border-b">
                <CardTitle className="text-sm font-serif">Order Book</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col h-[calc(100vh-180px)]">
                  {/* Header */}
                  <div className="grid grid-cols-3 gap-2 p-3 text-xs font-mono font-semibold text-muted-foreground border-b">
                    <div className="text-left">Price (USDC)</div>
                    <div className="text-right">Size</div>
                    <div className="text-right">Total</div>
                  </div>

                  {/* Asks (Sells) - Red */}
                  <div className="flex-1 overflow-y-auto">
                    {orderbook?.asks.slice().reverse().map((ask, idx) => {
                      const [price, quantity] = ask;
                      const total = parseFloat(price) * parseFloat(quantity);
                      return (
                        <div 
                          key={`ask-${idx}`}
                          className="grid grid-cols-3 gap-2 p-2 text-xs font-mono hover-elevate cursor-pointer"
                          onClick={() => {
                            setOrderPrice(price);
                            setOrderSide("BUY"); // Click ask to BUY at that price
                          }}
                          data-testid={`orderbook-ask-${idx}`}
                        >
                          <div className="text-destructive font-semibold">{parseFloat(price).toFixed(2)}</div>
                          <div className="text-right text-muted-foreground">{parseFloat(quantity).toFixed(4)}</div>
                          <div className="text-right text-muted-foreground">{total.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mid Price */}
                  <div className="border-y p-3 bg-accent/20">
                    <div className="flex items-center justify-center gap-2">
                      <ArrowUpDown className="h-3 w-3" />
                      <span className="text-sm font-mono font-bold" data-testid="text-mid-price">
                        ${midPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Bids (Buys) - Green */}
                  <div className="flex-1 overflow-y-auto">
                    {orderbook?.bids.map((bid, idx) => {
                      const [price, quantity] = bid;
                      const total = parseFloat(price) * parseFloat(quantity);
                      return (
                        <div 
                          key={`bid-${idx}`}
                          className="grid grid-cols-3 gap-2 p-2 text-xs font-mono hover-elevate cursor-pointer"
                          onClick={() => {
                            setOrderPrice(price);
                            setOrderSide("SELL"); // Click bid to SELL at that price
                          }}
                          data-testid={`orderbook-bid-${idx}`}
                        >
                          <div className="text-foreground font-semibold">{parseFloat(price).toFixed(2)}</div>
                          <div className="text-right text-muted-foreground">{parseFloat(quantity).toFixed(4)}</div>
                          <div className="text-right text-muted-foreground">{total.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel - Chart */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <Card className="h-full rounded-none border-0 border-r">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-serif">Price Chart</CardTitle>
                  {marketData?.marketData && (
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">24h Change:</span>
                        <span className={`ml-2 font-mono ${marketData.marketData.change24h >= 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {marketData.marketData.change24h >= 0 ? '+' : ''}{marketData.marketData.change24h?.toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">24h Volume:</span>
                        <span className="ml-2 font-mono">
                          ${parseFloat(marketData.marketData.volume24h || '0').toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div ref={chartContainerRef} className="w-full" data-testid="chart-container" />
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - Order Entry */}
          <ResizablePanel defaultSize={25} minSize={20}>
            <Card className="h-full rounded-none border-0">
              <CardHeader className="border-b">
                <CardTitle className="text-sm font-serif">Place Order</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Side Selector */}
                  <div className="space-y-2">
                    <Label>Side</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={orderSide === "BUY" ? "default" : "outline"}
                        onClick={() => setOrderSide("BUY")}
                        data-testid="button-buy"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Buy
                      </Button>
                      <Button
                        variant={orderSide === "SELL" ? "default" : "outline"}
                        onClick={() => setOrderSide("SELL")}
                        data-testid="button-sell"
                      >
                        <TrendingDown className="h-4 w-4 mr-2" />
                        Sell
                      </Button>
                    </div>
                  </div>

                  {/* Order Type */}
                  <div className="space-y-2">
                    <Label>Order Type</Label>
                    <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="LIMIT" data-testid="tab-limit">Limit</TabsTrigger>
                        <TabsTrigger value="MARKET" data-testid="tab-market">Market</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Price Input (for limit orders) */}
                  {orderType === 'LIMIT' && (
                    <div className="space-y-2">
                      <Label>Price (USDC)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={orderPrice}
                        onChange={(e) => setOrderPrice(e.target.value)}
                        data-testid="input-price"
                      />
                    </div>
                  )}

                  {/* Quantity Input */}
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                      data-testid="input-quantity"
                    />
                  </div>

                  {/* Order Summary */}
                  {orderQuantity && (orderType === 'MARKET' || orderPrice) && (
                    <Card className="bg-accent/20">
                      <CardContent className="p-3 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Notional Value:</span>
                          <span className="font-mono font-semibold">
                            ${((orderType === 'LIMIT' ? parseFloat(orderPrice) : midPrice) * parseFloat(orderQuantity)).toFixed(2)}
                          </span>
                        </div>
                        {orderType === 'MARKET' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Est. Price:</span>
                            <span className="font-mono">${midPrice.toFixed(2)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Submit Button */}
                  <Button
                    className="w-full"
                    onClick={handlePlaceOrder}
                    disabled={placeOrderMutation.isPending}
                    data-testid="button-place-order"
                  >
                    {placeOrderMutation.isPending ? "Placing Order..." : "Place Order"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
