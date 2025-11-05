import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
    queryKey: [`/api/hyperliquid/asset-metadata?symbol=${symbol}`],
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
        await apiRequest("POST", "/api/advanced-orders", {
          orderType: advancedType,
          symbol,
          side: orderSide,
          totalSize: sizeValue,
          parameters: {}, // Would be populated from form fields
          status: "pending",
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
    <div className="h-full p-0.5 flex flex-col">
      <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "market" | "limit" | "advanced")} className="flex flex-col flex-1">
          <TabsList className="w-full grid grid-cols-3 h-6 shrink-0">
            <TabsTrigger value="market" data-testid="tab-market" className="text-[9px] py-0 px-1">
              Market
            </TabsTrigger>
            <TabsTrigger value="limit" data-testid="tab-limit" className="text-[9px] py-0 px-1">
              Limit
            </TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced" className="text-[9px] py-0 px-1">
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="space-y-0.5 mt-0.5 flex-1 overflow-auto px-0.5">
              {/* Size Input */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] font-medium">Size</Label>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant={sizeMode === "usd" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("usd")}
                      className="h-4 w-4 p-0"
                      data-testid="button-size-usd"
                    >
                      <DollarSign className="h-2 w-2" />
                    </Button>
                    <Button
                      variant={sizeMode === "percent" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("percent")}
                      className="h-4 w-4 p-0"
                      data-testid="button-size-percent"
                    >
                      <Percent className="h-2 w-2" />
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder={sizeMode === "usd" ? "USD" : "%"}
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-size"
                />
                <p className="text-[9px] text-muted-foreground leading-none">
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

            <TabsContent value="limit" className="space-y-0.5 mt-0.5 flex-1 overflow-auto px-0.5">
              {/* Limit Price */}
              <div className="space-y-0.5">
                <Label className="text-[9px] font-medium">Limit Price</Label>
                <Input
                  type="number"
                  placeholder="Price"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-limit-price"
                />
              </div>

              {/* Size Input */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] font-medium">Size</Label>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant={sizeMode === "usd" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("usd")}
                      className="h-4 w-4 p-0"
                      data-testid="button-size-usd-limit"
                    >
                      <DollarSign className="h-2 w-2" />
                    </Button>
                    <Button
                      variant={sizeMode === "percent" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSizeMode("percent")}
                      className="h-4 w-4 p-0"
                      data-testid="button-size-percent-limit"
                    >
                      <Percent className="h-2 w-2" />
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder={sizeMode === "usd" ? "USD" : "%"}
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-size-limit"
                />
                <p className="text-[9px] text-muted-foreground leading-none">
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

            <TabsContent value="advanced" className="space-y-0.5 mt-0.5 flex-1 overflow-auto px-0.5">
              {/* Order Type Selector */}
              <div className="space-y-0.5">
                <Label className="text-[9px] font-medium">Order Type</Label>
                <div className="grid grid-cols-4 gap-0.5">
                  <Button
                    variant={advancedType === "twap" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("twap")}
                    className="h-6 px-0.5 text-[9px]"
                    data-testid="button-twap"
                  >
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    TWAP
                  </Button>
                  <Button
                    variant={advancedType === "chase" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("chase")}
                    className="h-6 px-0.5 text-[9px]"
                    data-testid="button-chase"
                  >
                    <Target className="h-2.5 w-2.5 mr-0.5" />
                    Chase
                  </Button>
                  <Button
                    variant={advancedType === "scaled" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("scaled")}
                    className="h-6 px-0.5 text-[9px]"
                    data-testid="button-scaled"
                  >
                    <Layers className="h-2.5 w-2.5 mr-0.5" />
                    Scaled
                  </Button>
                  <Button
                    variant={advancedType === "iceberg" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedType("iceberg")}
                    className="h-6 px-0.5 text-[9px]"
                    data-testid="button-iceberg"
                  >
                    <IceCream className="h-2.5 w-2.5 mr-0.5" />
                    Iceberg
                  </Button>
                </div>
              </div>

              {/* Size Input */}
              <div className="space-y-0.5">
                <Label className="text-[9px] font-medium">Total Size</Label>
                <Input
                  type="number"
                  placeholder="USD"
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-advanced-size"
                />
              </div>

              {/* Type-specific compact parameters */}
              {advancedType === "twap" && (
                <div className="grid grid-cols-2 gap-0.5">
                  <div className="space-y-0.5">
                    <Label className="text-[9px]">Duration (min)</Label>
                    <Input type="number" defaultValue="30" className="h-6 text-[10px] px-1 py-0" data-testid="input-twap-duration" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px]">Slices</Label>
                    <Input type="number" defaultValue="10" className="h-6 text-[10px] px-1 py-0" data-testid="input-twap-slices" />
                  </div>
                </div>
              )}

              {advancedType === "chase" && (
                <div className="grid grid-cols-2 gap-0.5">
                  <div className="space-y-0.5">
                    <Label className="text-[9px]">Offset (bps)</Label>
                    <Input type="number" defaultValue="1" className="h-6 text-[10px] px-1 py-0" data-testid="input-chase-offset" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px]">Max Chases</Label>
                    <Input type="number" defaultValue="10" className="h-6 text-[10px] px-1 py-0" data-testid="input-chase-max" />
                  </div>
                </div>
              )}

              {advancedType === "scaled" && (
                <div className="grid grid-cols-2 gap-0.5">
                  <div className="space-y-0.5">
                    <Label className="text-[9px]">Levels</Label>
                    <Input type="number" defaultValue="5" className="h-6 text-[10px] px-1 py-0" data-testid="input-scaled-levels" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px]">Range %</Label>
                    <Input type="number" defaultValue="5" className="h-6 text-[10px] px-1 py-0" data-testid="input-scaled-range" />
                  </div>
                </div>
              )}

              {advancedType === "iceberg" && (
                <div className="space-y-0.5">
                  <div className="space-y-0.5">
                    <Label className="text-[9px]">Display Size</Label>
                    <Input type="number" placeholder="Visible amount" className="h-6 text-[10px] px-1 py-0" data-testid="input-iceberg-display" />
                  </div>
                </div>
              )}
          </TabsContent>
      </Tabs>

      {/* Order Buttons - Fixed at bottom */}
      <div className="grid grid-cols-2 gap-0.5 shrink-0 mt-0.5">
        <Button
          onClick={() => handlePlaceOrder("buy")}
          disabled={isSubmitting}
          className="h-6 bg-long hover:bg-long/90 text-background font-semibold text-[10px]"
          data-testid="button-buy"
        >
          Buy
        </Button>
        <Button
          onClick={() => handlePlaceOrder("sell")}
          disabled={isSubmitting}
          className="h-6 bg-short hover:bg-short/90 text-background font-semibold text-[10px]"
          data-testid="button-sell"
        >
          Sell
        </Button>
      </div>
    </div>
  );
}
