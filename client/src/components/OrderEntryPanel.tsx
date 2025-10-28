import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DollarSign, Percent, TrendingUp, TrendingDown, Clock, Target, Layers, IceCream, Zap } from "lucide-react";
import { LeverageSlider } from "@/components/LeverageSlider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OrderEntryPanelProps {
  symbol: string;
  lastPrice?: number;
}

export default function OrderEntryPanel({ symbol, lastPrice = 0 }: OrderEntryPanelProps) {
  const { toast } = useToast();
  const [orderType, setOrderType] = useState<"market" | "limit" | "advanced">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [sizeMode, setSizeMode] = useState<"usd" | "percent">("usd");
  const [sizeValue, setSizeValue] = useState("");
  const [leverage, setLeverage] = useState(5);
  const [limitPrice, setLimitPrice] = useState("");
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState("");
  
  // Advanced order states
  const [advancedType, setAdvancedType] = useState<"twap" | "chase" | "scaled" | "iceberg">("twap");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handlePlaceOrder = async (orderSide: "buy" | "sell") => {
    if (orderType === "advanced") {
      // Handle advanced order creation
      if (!sizeValue || parseFloat(sizeValue) <= 0) {
        toast({
          title: "Invalid Size",
          description: "Please enter a valid order size",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);
      try {
        await apiRequest("/api/advanced-orders", {
          method: "POST",
          body: JSON.stringify({
            orderType: advancedType,
            symbol,
            side: orderSide,
            totalSize: sizeValue,
            parameters: {}, // Would be populated from form fields
            status: "pending",
          }),
        });

        toast({
          title: "Advanced Order Created",
          description: `${advancedType.toUpperCase()} order for ${sizeValue} ${symbol} created`,
        });

        setSizeValue("");
      } catch (error) {
        toast({
          title: "Order Failed",
          description: error instanceof Error ? error.message : "Failed to create advanced order",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Handle regular market/limit order
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
    }
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
          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "market" | "limit" | "advanced")}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="market" data-testid="tab-market">
                Market
              </TabsTrigger>
              <TabsTrigger value="limit" data-testid="tab-limit">
                Limit
              </TabsTrigger>
              <TabsTrigger value="advanced" data-testid="tab-advanced" className="text-xs">
                Advanced
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

            <TabsContent value="advanced" className="space-y-3 mt-4">
              {/* Order Type Selector */}
              <div className="space-y-2">
                <Label className="text-xs">Order Type</Label>
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    variant={advancedType === "twap" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("twap")}
                    className="h-8 px-1 text-xs"
                    data-testid="button-twap"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    TWAP
                  </Button>
                  <Button
                    variant={advancedType === "chase" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("chase")}
                    className="h-8 px-1 text-xs"
                    data-testid="button-chase"
                  >
                    <Target className="h-3 w-3 mr-1" />
                    Chase
                  </Button>
                  <Button
                    variant={advancedType === "scaled" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("scaled")}
                    className="h-8 px-1 text-xs"
                    data-testid="button-scaled"
                  >
                    <Layers className="h-3 w-3 mr-1" />
                    Scaled
                  </Button>
                  <Button
                    variant={advancedType === "iceberg" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("iceberg")}
                    className="h-8 px-1 text-xs"
                    data-testid="button-iceberg"
                  >
                    <IceCream className="h-3 w-3 mr-1" />
                    Iceberg
                  </Button>
                </div>
              </div>

              {/* Size Input */}
              <div className="space-y-2">
                <Label className="text-xs">Total Size</Label>
                <Input
                  type="number"
                  placeholder="Enter USD amount"
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  className="glass-strong h-8 text-sm"
                  data-testid="input-advanced-size"
                />
              </div>

              {/* Type-specific compact parameters */}
              {advancedType === "twap" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Duration (min)</Label>
                    <Input type="number" defaultValue="30" className="glass-strong h-8 text-sm" data-testid="input-twap-duration" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Slices</Label>
                    <Input type="number" defaultValue="10" className="glass-strong h-8 text-sm" data-testid="input-twap-slices" />
                  </div>
                </div>
              )}

              {advancedType === "chase" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Offset (bps)</Label>
                    <Input type="number" defaultValue="1" className="glass-strong h-8 text-sm" data-testid="input-chase-offset" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Chases</Label>
                    <Input type="number" defaultValue="10" className="glass-strong h-8 text-sm" data-testid="input-chase-max" />
                  </div>
                </div>
              )}

              {advancedType === "scaled" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Levels</Label>
                    <Input type="number" defaultValue="5" className="glass-strong h-8 text-sm" data-testid="input-scaled-levels" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Range %</Label>
                    <Input type="number" defaultValue="5" className="glass-strong h-8 text-sm" data-testid="input-scaled-range" />
                  </div>
                </div>
              )}

              {advancedType === "iceberg" && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Display Size</Label>
                    <Input type="number" placeholder="Visible amount" className="glass-strong h-8 text-sm" data-testid="input-iceberg-display" />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: TP/SL & Order Buttons OR AI Optimize */}
        <div className="space-y-4">
          {orderType !== "advanced" ? (
            <>
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
            </>
          ) : (
            <>
              {/* AI Optimization for Advanced Orders */}
              <Card className="glass-strong border-glass/20">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <Label className="text-sm">AI Optimize</Label>
                    </div>
                    <Switch
                      defaultChecked={true}
                      data-testid="switch-ai-optimize"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uses AI to optimize execution parameters
                  </p>
                </CardContent>
              </Card>

              <Separator className="bg-glass/20" />
            </>
          )}

          {/* Order Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handlePlaceOrder("buy")}
              disabled={isSubmitting}
              className="h-12 bg-long hover:bg-long/90 text-background font-semibold glass-strong glow-green"
              data-testid="button-buy"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {orderType === "advanced" ? `Create ${advancedType.toUpperCase()}` : "Buy / Long"}
            </Button>
            <Button
              onClick={() => handlePlaceOrder("sell")}
              disabled={isSubmitting}
              className="h-12 bg-short hover:bg-short/90 text-background font-semibold glass-strong glow-red"
              data-testid="button-sell"
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              {orderType === "advanced" ? "Sell" : "Sell / Short"}
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
