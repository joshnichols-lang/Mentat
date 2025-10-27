import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Percent, TrendingUp, TrendingDown } from "lucide-react";
import { LeverageSlider } from "@/components/LeverageSlider";

interface OrderEntryPanelProps {
  symbol: string;
  lastPrice?: number;
}

export default function OrderEntryPanel({ symbol, lastPrice = 0 }: OrderEntryPanelProps) {
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [sizeMode, setSizeMode] = useState<"usd" | "percent">("usd");
  const [sizeValue, setSizeValue] = useState("");
  const [leverage, setLeverage] = useState(5);
  const [limitPrice, setLimitPrice] = useState("");
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState("");

  // Fetch asset metadata to get max leverage for the selected symbol
  const { data: assetMetadata } = useQuery<{ 
    success: boolean; 
    metadata: { maxLeverage: number; szDecimals: number; tickSize: number } 
  }>({
    queryKey: ['/api/hyperliquid/asset-metadata', { symbol }],
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const maxLeverage = assetMetadata?.metadata?.maxLeverage ?? 50;

  const handlePlaceOrder = (orderSide: "buy" | "sell") => {
    console.log("[OrderEntry] Placing order:", {
      symbol,
      orderType,
      side: orderSide,
      sizeMode,
      sizeValue,
      leverage,
      limitPrice: orderType === "limit" ? limitPrice : undefined,
      takeProfit: takeProfitEnabled ? takeProfitPrice : undefined,
      stopLoss: stopLossEnabled ? stopLossPrice : undefined,
    });

    // TODO: Implement actual order placement via API
    // This will be done in Task 13
  };

  const estimatedNotional = sizeMode === "usd" 
    ? parseFloat(sizeValue) || 0
    : (parseFloat(sizeValue) || 0) / 100 * 10000; // Placeholder: would use actual account balance

  const estimatedSize = lastPrice > 0 ? estimatedNotional / lastPrice : 0;

  return (
    <div className="h-full p-4 glass">
      <div className="grid grid-cols-2 gap-4 h-full">
        {/* Left Column: Order Type & Size */}
        <div className="space-y-4">
          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "market" | "limit")}>
            <TabsList className="w-full">
              <TabsTrigger value="market" className="flex-1" data-testid="tab-market">
                Market
              </TabsTrigger>
              <TabsTrigger value="limit" className="flex-1" data-testid="tab-limit">
                Limit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="market" className="space-y-4 mt-4">
              {/* Size Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Size</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={sizeMode === "usd" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("usd")}
                      className="h-7 px-2"
                      data-testid="button-size-usd"
                    >
                      <DollarSign className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={sizeMode === "percent" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("percent")}
                      className="h-7 px-2"
                      data-testid="button-size-percent"
                    >
                      <Percent className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder={sizeMode === "usd" ? "Enter USD amount" : "Enter %"}
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  className="glass-strong"
                  data-testid="input-size"
                />
                <p className="text-xs text-muted-foreground">
                  ≈ {estimatedSize.toFixed(4)} {symbol.split("-")[0]}
                </p>
              </div>

              {/* Leverage Slider */}
              <div>
                <LeverageSlider
                  value={leverage}
                  onChange={setLeverage}
                  min={1}
                  max={maxLeverage}
                />
              </div>
            </TabsContent>

            <TabsContent value="limit" className="space-y-4 mt-4">
              {/* Limit Price */}
              <div className="space-y-2">
                <Label className="text-sm">Limit Price</Label>
                <Input
                  type="number"
                  placeholder="Enter price"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="glass-strong"
                  data-testid="input-limit-price"
                />
              </div>

              {/* Size Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Size</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={sizeMode === "usd" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("usd")}
                      className="h-7 px-2"
                      data-testid="button-size-usd-limit"
                    >
                      <DollarSign className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={sizeMode === "percent" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("percent")}
                      className="h-7 px-2"
                      data-testid="button-size-percent-limit"
                    >
                      <Percent className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder={sizeMode === "usd" ? "Enter USD amount" : "Enter %"}
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  className="glass-strong"
                  data-testid="input-size-limit"
                />
                <p className="text-xs text-muted-foreground">
                  ≈ {estimatedSize.toFixed(4)} {symbol.split("-")[0]}
                </p>
              </div>

              {/* Leverage Slider */}
              <div>
                <LeverageSlider
                  value={leverage}
                  onChange={setLeverage}
                  min={1}
                  max={maxLeverage}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: TP/SL & Order Buttons */}
        <div className="space-y-4">
          {/* Take Profit */}
          <Card className="glass-strong border-glass/20">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Take Profit</Label>
                <Switch
                  checked={takeProfitEnabled}
                  onCheckedChange={setTakeProfitEnabled}
                  data-testid="switch-take-profit"
                />
              </div>
              {takeProfitEnabled && (
                <Input
                  type="number"
                  placeholder="TP Price"
                  value={takeProfitPrice}
                  onChange={(e) => setTakeProfitPrice(e.target.value)}
                  className="glass-strong"
                  data-testid="input-take-profit"
                />
              )}
            </CardContent>
          </Card>

          {/* Stop Loss */}
          <Card className="glass-strong border-glass/20">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Stop Loss</Label>
                <Switch
                  checked={stopLossEnabled}
                  onCheckedChange={setStopLossEnabled}
                  data-testid="switch-stop-loss"
                />
              </div>
              {stopLossEnabled && (
                <Input
                  type="number"
                  placeholder="SL Price"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  className="glass-strong"
                  data-testid="input-stop-loss"
                />
              )}
            </CardContent>
          </Card>

          <Separator className="bg-glass/20" />

          {/* Order Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handlePlaceOrder("buy")}
              className="h-12 bg-long hover:bg-long/90 text-background font-semibold glass-strong glow-green"
              data-testid="button-buy"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Buy / Long
            </Button>
            <Button
              onClick={() => handlePlaceOrder("sell")}
              className="h-12 bg-short hover:bg-short/90 text-background font-semibold glass-strong glow-red"
              data-testid="button-sell"
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Sell / Short
            </Button>
          </div>

          {/* Order Summary */}
          <Card className="glass-strong border-glass/20">
            <CardContent className="p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notional</span>
                <span className="font-medium" data-testid="text-notional">${estimatedNotional.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium" data-testid="text-size">{estimatedSize.toFixed(4)} {symbol.split("-")[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leverage</span>
                <span className="font-medium text-primary" data-testid="text-leverage">{leverage}x</span>
              </div>
              {lastPrice > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Entry</span>
                  <span className="font-medium" data-testid="text-entry">${lastPrice.toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
