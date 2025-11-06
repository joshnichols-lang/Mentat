import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OrderEntryPanelProps {
  symbol: string;
  lastPrice?: number;
}

export default function OrderEntryPanel({ symbol, lastPrice = 0 }: OrderEntryPanelProps) {
  const { toast } = useToast();
  
  // State
  const [orderType, setOrderType] = useState<"market" | "limit" | "advanced">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [sliderValue, setSliderValue] = useState([0]);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpslEnabled, setTpslEnabled] = useState(false);
  
  // Advanced order type state
  const [advancedOrderType, setAdvancedOrderType] = useState<string>("twap");
  
  // TWAP parameters
  const [twapDuration, setTwapDuration] = useState("60");
  const [twapSlices, setTwapSlices] = useState("10");
  const [twapRandomize, setTwapRandomize] = useState(false);
  const [twapPriceLimit, setTwapPriceLimit] = useState("");
  
  // Limit Chase parameters
  const [chaseOffset, setChaseOffset] = useState("1");
  const [chaseMaxChases, setChaseMaxChases] = useState("5");
  const [chaseInterval, setChaseInterval] = useState("30");
  const [chasePriceLimit, setChasePriceLimit] = useState("");
  const [chaseGiveBehavior, setChaseGiveBehavior] = useState<"cancel" | "market" | "wait">("wait");
  
  // Scaled/Ladder parameters
  const [scaledLevels, setScaledLevels] = useState("5");
  const [scaledStart, setScaledStart] = useState("");
  const [scaledEnd, setScaledEnd] = useState("");
  const [scaledDistribution, setScaledDistribution] = useState<"linear" | "geometric" | "custom">("linear");
  
  // Iceberg parameters
  const [icebergDisplay, setIcebergDisplay] = useState("");
  const [icebergTotal, setIcebergTotal] = useState("");
  const [icebergRefresh, setIcebergRefresh] = useState<"immediate" | "delayed">("immediate");
  const [icebergRefreshDelay, setIcebergRefreshDelay] = useState("5");

  const { data: userData } = useQuery<{ user: any }>({
    queryKey: ["/api/user"],
  });

  const isConnected = !!userData?.user;

  const handlePlaceOrder = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to trade",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid order amount",
        variant: "destructive",
      });
      return;
    }

    // Handle advanced orders
    if (orderType === "advanced") {
      try {
        let parameters: any = {};

        // Build parameters based on order type with validation
        switch (advancedOrderType) {
          case "twap":
            const duration = parseFloat(twapDuration);
            const slices = parseInt(twapSlices);
            if (isNaN(duration) || duration <= 0) {
              toast({
                title: "Invalid Duration",
                description: "Duration must be a positive number",
                variant: "destructive",
              });
              return;
            }
            if (isNaN(slices) || slices < 2) {
              toast({
                title: "Invalid Slices",
                description: "Slices must be at least 2",
                variant: "destructive",
              });
              return;
            }
            parameters = {
              durationMinutes: duration,
              slices,
              randomizeIntervals: twapRandomize,
            };
            if (twapPriceLimit) {
              const pLimit = parseFloat(twapPriceLimit);
              if (isNaN(pLimit) || pLimit <= 0) {
                toast({
                  title: "Invalid Price Limit",
                  description: "Price limit must be a positive number",
                  variant: "destructive",
                });
                return;
              }
              parameters.priceLimit = pLimit.toString();
            }
            break;

          case "limit_chase":
            const offset = parseFloat(chaseOffset);
            const maxChases = parseInt(chaseMaxChases);
            const interval = parseFloat(chaseInterval);
            if (isNaN(offset)) {
              toast({
                title: "Invalid Offset",
                description: "Offset must be a valid number",
                variant: "destructive",
              });
              return;
            }
            if (isNaN(maxChases) || maxChases <= 0) {
              toast({
                title: "Invalid Max Chases",
                description: "Max chases must be a positive number",
                variant: "destructive",
              });
              return;
            }
            if (isNaN(interval) || interval <= 0) {
              toast({
                title: "Invalid Interval",
                description: "Interval must be a positive number",
                variant: "destructive",
              });
              return;
            }
            parameters = {
              offset,
              maxChases,
              chaseIntervalSeconds: interval,
              giveBehavior: chaseGiveBehavior,
            };
            if (chasePriceLimit) {
              const pLimit = parseFloat(chasePriceLimit);
              if (isNaN(pLimit) || pLimit <= 0) {
                toast({
                  title: "Invalid Price Limit",
                  description: "Price limit must be a positive number",
                  variant: "destructive",
                });
                return;
              }
              parameters.priceLimit = pLimit.toString();
            }
            break;

          case "scaled":
            if (!scaledStart || !scaledEnd) {
              toast({
                title: "Missing Parameters",
                description: "Please enter start and end prices for scaled order",
                variant: "destructive",
              });
              return;
            }
            const levels = parseInt(scaledLevels);
            const priceStart = parseFloat(scaledStart);
            const priceEnd = parseFloat(scaledEnd);
            if (isNaN(levels) || levels < 2) {
              toast({
                title: "Invalid Levels",
                description: "Levels must be at least 2",
                variant: "destructive",
              });
              return;
            }
            if (isNaN(priceStart) || priceStart <= 0) {
              toast({
                title: "Invalid Start Price",
                description: "Start price must be a positive number",
                variant: "destructive",
              });
              return;
            }
            if (isNaN(priceEnd) || priceEnd <= 0) {
              toast({
                title: "Invalid End Price",
                description: "End price must be a positive number",
                variant: "destructive",
              });
              return;
            }
            if (scaledDistribution === "custom") {
              toast({
                title: "Custom Distribution Not Supported",
                description: "Custom distribution is not yet implemented. Please use Linear or Geometric.",
                variant: "destructive",
              });
              return;
            }
            parameters = {
              levels,
              priceStart: priceStart.toString(),
              priceEnd: priceEnd.toString(),
              distribution: scaledDistribution,
            };
            break;

          case "iceberg":
            if (!icebergDisplay || !icebergTotal) {
              toast({
                title: "Missing Parameters",
                description: "Please enter display and total sizes for iceberg order",
                variant: "destructive",
              });
              return;
            }
            const displaySize = parseFloat(icebergDisplay);
            const totalSize = parseFloat(icebergTotal);
            if (isNaN(displaySize) || displaySize <= 0) {
              toast({
                title: "Invalid Display Size",
                description: "Display size must be a positive number",
                variant: "destructive",
              });
              return;
            }
            if (isNaN(totalSize) || totalSize <= 0) {
              toast({
                title: "Invalid Total Size",
                description: "Total size must be a positive number",
                variant: "destructive",
              });
              return;
            }
            if (displaySize >= totalSize) {
              toast({
                title: "Invalid Iceberg Sizes",
                description: "Display size must be less than total size",
                variant: "destructive",
              });
              return;
            }
            if (!limitPrice) {
              toast({
                title: "Missing Limit Price",
                description: "Iceberg orders require a limit price",
                variant: "destructive",
              });
              return;
            }
            parameters = {
              displaySize: displaySize.toString(),
              totalSize: totalSize.toString(),
              priceLimit: limitPrice,
              refreshBehavior: icebergRefresh,
            };
            if (icebergRefresh === "delayed") {
              const delay = parseFloat(icebergRefreshDelay);
              if (isNaN(delay) || delay <= 0) {
                toast({
                  title: "Invalid Refresh Delay",
                  description: "Refresh delay must be a positive number",
                  variant: "destructive",
                });
                return;
              }
              parameters.refreshDelaySeconds = delay;
            }
            break;

          default:
            toast({
              title: "Coming Soon",
              description: `${advancedOrderType.toUpperCase()} order type is not yet available`,
              variant: "destructive",
            });
            return;
        }

        // Validate and convert totalSize
        const totalSizeNum = parseFloat(amount);
        if (isNaN(totalSizeNum) || totalSizeNum <= 0) {
          toast({
            title: "Invalid Amount",
            description: "Amount must be a positive number",
            variant: "destructive",
          });
          return;
        }

        // Create advanced order
        const response = await apiRequest("POST", "/api/advanced-orders", {
          orderType: advancedOrderType,
          symbol,
          side,
          totalSize: totalSizeNum.toString(),
          limitPrice: limitPrice || undefined,
          parameters,
        });

        toast({
          title: "Advanced Order Created",
          description: `${advancedOrderType.toUpperCase()} order for ${amount} ${symbol}`,
        });

        // Reset form
        setAmount("");
        setLimitPrice("");
      } catch (error: any) {
        toast({
          title: "Order Failed",
          description: error.message || "Failed to create advanced order",
          variant: "destructive",
        });
      }
      return;
    }

    // Handle regular market/limit orders
    console.log("[OrderEntry] Placing order:", {
      symbol,
      orderType,
      side,
      amount,
      limitPrice: orderType === "limit" ? limitPrice : undefined,
    });

    try {
      // Validate limit price for limit orders
      if (orderType === "limit") {
        if (!limitPrice || parseFloat(limitPrice) <= 0) {
          toast({
            title: "Invalid Limit Price",
            description: "Please enter a valid limit price",
            variant: "destructive",
          });
          return;
        }
      }

      // Extract coin symbol (remove -PERP or -USD suffix if present)
      const coin = symbol.replace("-PERP", "").replace("-USD", "");

      // Prepare order parameters
      const orderParams = {
        coin,
        is_buy: side === "buy",
        sz: parseFloat(amount),
        order_type: orderType,
        limit_px: orderType === "limit" ? parseFloat(limitPrice) : undefined,
        reduce_only: reduceOnly,
      };

      // Place order via API
      const response = await apiRequest("POST", "/api/hyperliquid/order", orderParams);

      toast({
        title: "Order Placed Successfully",
        description: `${side.toUpperCase()} ${orderType} order for ${amount} ${coin}`,
      });

      // Reset form
      setAmount("");
      setLimitPrice("");
      setReduceOnly(false);
    } catch (error: any) {
      console.error("[OrderEntry] Order failed:", error);
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    }
  };

  const handleSetMidPrice = () => {
    if (lastPrice > 0) {
      setLimitPrice(lastPrice.toString());
    }
  };

  const handleSliderChange = (value: number[]) => {
    setSliderValue(value);
    // Update amount based on slider percentage
    // TODO: Calculate based on available balance
  };

  return (
    <div className="flex flex-col p-1 w-full h-full">
      {/* Order Type Selection - Fixed Header */}
      <div className="flex-shrink-0">
        <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
          <TabsList className="w-full grid grid-cols-3 h-6">
            <TabsTrigger value="market" className="text-[9px] px-1 py-0" data-testid="tab-market">Market</TabsTrigger>
            <TabsTrigger value="limit" className="text-[9px] px-1 py-0" data-testid="tab-limit">Limit</TabsTrigger>
            <TabsTrigger value="advanced" className="text-[9px] px-1 py-0" data-testid="tab-advanced">Advanced</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ALL CONTENT - No scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col mt-0.5">
        {/* Buy/Sell Toggle */}
        <div className="grid grid-cols-2 gap-0.5 flex-shrink-0">
          <Button
            variant={side === "buy" ? "default" : "outline"}
            onClick={() => setSide("buy")}
            className={`h-7 text-[10px] font-semibold ${
              side === "buy" ? "bg-long hover:bg-long/90 text-background" : ""
            }`}
            data-testid="button-buy-long"
          >
            Buy / Long
          </Button>
          <Button
            variant={side === "sell" ? "default" : "outline"}
            onClick={() => setSide("sell")}
            className={`h-7 text-[10px] font-semibold ${
              side === "sell" ? "bg-short hover:bg-short/90 text-background" : ""
            }`}
            data-testid="button-sell-short"
          >
            Sell / Short
          </Button>
        </div>

        <div className="space-y-1 mt-1">
        {/* Available / Position Info */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px]">
            <span className="text-secondary">Available to Trade:</span>
            <span className="font-mono">-</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-secondary">Position:</span>
            <span className="font-mono">-</span>
          </div>
        </div>

        {/* Advanced Order Type Selector - Only show when Advanced tab is active */}
        {orderType === "advanced" && (
          <div className="space-y-0.5">
            <Label className="text-[9px] font-medium">Order Type</Label>
            <Select value={advancedOrderType} onValueChange={setAdvancedOrderType}>
              <SelectTrigger className="h-6 text-[9px]" data-testid="select-advanced-type">
                <SelectValue placeholder="Select advanced order type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twap">TWAP</SelectItem>
                <SelectItem value="limit_chase">Limit Chase</SelectItem>
                <SelectItem value="scaled">Scaled/Ladder</SelectItem>
                <SelectItem value="iceberg">Iceberg</SelectItem>
                <SelectItem value="oco">OCO</SelectItem>
                <SelectItem value="trailing_tp">Trailing TP</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="conditional">Conditional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Limit Price (for Limit orders and certain Advanced orders like Iceberg) */}
        {(orderType === "limit" || (orderType === "advanced" && advancedOrderType === "iceberg")) && (
          <div className="space-y-0.5">
            <Label className="text-[9px] font-medium">Limit Price</Label>
            <div className="flex gap-0.5">
              <Input
                type="number"
                placeholder="Price"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="h-6 text-[10px] px-1 py-0 flex-1"
                data-testid="input-limit-price"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetMidPrice}
                className="h-6 px-2 text-[9px]"
                data-testid="button-mid-price"
              >
                Mid
              </Button>
            </div>
          </div>
        )}

        {/* Advanced Order Type Parameters */}
        {orderType === "advanced" && advancedOrderType === "twap" && (
          <div className="space-y-1 p-1 border border-border rounded">
            <div className="text-[9px] font-medium text-primary">TWAP Settings</div>
            <div className="grid grid-cols-2 gap-0.5">
              <div className="space-y-0.5">
                <Label className="text-[9px]">Duration (min)</Label>
                <Input
                  type="number"
                  value={twapDuration}
                  onChange={(e) => setTwapDuration(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-twap-duration"
                  placeholder="60"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Slices (min 2)</Label>
                <Input
                  type="number"
                  value={twapSlices}
                  onChange={(e) => setTwapSlices(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-twap-slices"
                  placeholder="10"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Price Limit (optional)</Label>
              <Input
                type="number"
                value={twapPriceLimit}
                onChange={(e) => setTwapPriceLimit(e.target.value)}
                className="h-6 text-[10px] px-1 py-0"
                data-testid="input-twap-price-limit"
                placeholder="Max buy / Min sell price"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="twap-randomize"
                checked={twapRandomize}
                onCheckedChange={(checked) => setTwapRandomize(checked as boolean)}
                data-testid="checkbox-twap-randomize"
              />
              <label htmlFor="twap-randomize" className="text-[9px] cursor-pointer">
                Randomize Intervals
              </label>
            </div>
          </div>
        )}

        {orderType === "advanced" && advancedOrderType === "limit_chase" && (
          <div className="space-y-1 p-1 border border-border rounded">
            <div className="text-[9px] font-medium text-primary">Limit Chase Settings</div>
            <div className="grid grid-cols-2 gap-0.5">
              <div className="space-y-0.5">
                <Label className="text-[9px]">Offset (ticks)</Label>
                <Input
                  type="number"
                  value={chaseOffset}
                  onChange={(e) => setChaseOffset(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-chase-offset"
                  placeholder="1"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Max Chases</Label>
                <Input
                  type="number"
                  value={chaseMaxChases}
                  onChange={(e) => setChaseMaxChases(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-chase-max"
                  placeholder="5"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Interval (sec)</Label>
              <Input
                type="number"
                value={chaseInterval}
                onChange={(e) => setChaseInterval(e.target.value)}
                className="h-6 text-[10px] px-1 py-0"
                data-testid="input-chase-interval"
                placeholder="30"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Price Limit (optional)</Label>
              <Input
                type="number"
                value={chasePriceLimit}
                onChange={(e) => setChasePriceLimit(e.target.value)}
                className="h-6 text-[10px] px-1 py-0"
                data-testid="input-chase-price-limit"
                placeholder="Don't chase beyond"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Give Behavior</Label>
              <Select value={chaseGiveBehavior} onValueChange={(v) => setChaseGiveBehavior(v as any)}>
                <SelectTrigger className="h-6 text-[9px]" data-testid="select-chase-behavior">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wait">Wait</SelectItem>
                  <SelectItem value="cancel">Cancel</SelectItem>
                  <SelectItem value="market">Market Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {orderType === "advanced" && advancedOrderType === "scaled" && (
          <div className="space-y-1 p-1 border border-border rounded">
            <div className="text-[9px] font-medium text-primary">Scaled/Ladder Settings</div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Levels (min 2)</Label>
              <Input
                type="number"
                value={scaledLevels}
                onChange={(e) => setScaledLevels(e.target.value)}
                className="h-6 text-[10px] px-1 py-0"
                data-testid="input-scaled-levels"
                placeholder="5"
              />
            </div>
            <div className="grid grid-cols-2 gap-0.5">
              <div className="space-y-0.5">
                <Label className="text-[9px]">Start Price</Label>
                <Input
                  type="number"
                  value={scaledStart}
                  onChange={(e) => setScaledStart(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-scaled-start"
                  placeholder="Lower price"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px]">End Price</Label>
                <Input
                  type="number"
                  value={scaledEnd}
                  onChange={(e) => setScaledEnd(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-scaled-end"
                  placeholder="Upper price"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Distribution</Label>
              <Select value={scaledDistribution} onValueChange={(v) => setScaledDistribution(v as any)}>
                <SelectTrigger className="h-6 text-[9px]" data-testid="select-scaled-dist">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="geometric">Geometric</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {orderType === "advanced" && advancedOrderType === "iceberg" && (
          <div className="space-y-1 p-1 border border-border rounded">
            <div className="text-[9px] font-medium text-primary">Iceberg Settings</div>
            <div className="grid grid-cols-2 gap-0.5">
              <div className="space-y-0.5">
                <Label className="text-[9px]">Display Size</Label>
                <Input
                  type="number"
                  value={icebergDisplay}
                  onChange={(e) => setIcebergDisplay(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-iceberg-display"
                  placeholder="Visible size"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Total Size</Label>
                <Input
                  type="number"
                  value={icebergTotal}
                  onChange={(e) => setIcebergTotal(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-iceberg-total"
                  placeholder="Hidden total"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Refresh</Label>
              <Select value={icebergRefresh} onValueChange={(v) => setIcebergRefresh(v as any)}>
                <SelectTrigger className="h-6 text-[9px]" data-testid="select-iceberg-refresh">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {icebergRefresh === "delayed" && (
              <div className="space-y-0.5">
                <Label className="text-[9px]">Refresh Delay (sec)</Label>
                <Input
                  type="number"
                  value={icebergRefreshDelay}
                  onChange={(e) => setIcebergRefreshDelay(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-iceberg-delay"
                  placeholder="5"
                />
              </div>
            )}
          </div>
        )}

        {orderType === "advanced" && !["twap", "limit_chase", "scaled", "iceberg"].includes(advancedOrderType) && (
          <div className="p-2 border border-border rounded">
            <div className="text-[9px] text-secondary text-center">
              {advancedOrderType.toUpperCase()} order type coming soon
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="space-y-0.5">
          <Label className="text-[9px] font-medium">Amount</Label>
          <div className="flex gap-0.5">
            <Input
              type="number"
              placeholder="0.00000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-6 text-[10px] px-1 py-0 flex-1"
              data-testid="input-amount"
            />
            <span className="text-[9px] text-secondary flex items-center px-1">{symbol}</span>
          </div>
        </div>

        {/* Amount Slider */}
        <div className="flex items-center gap-2 px-0.5">
          <Slider
            value={sliderValue}
            onValueChange={handleSliderChange}
            max={100}
            step={1}
            className="flex-1"
            data-testid="slider-amount"
          />
          <div className="flex items-center gap-1 text-[9px] text-secondary">
            <span>0</span>
            <span>%</span>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="reduce-only"
              checked={reduceOnly}
              onCheckedChange={(checked) => setReduceOnly(checked as boolean)}
              data-testid="checkbox-reduce-only"
            />
            <label htmlFor="reduce-only" className="text-[9px] cursor-pointer">
              Reduce Only
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="tpsl"
              checked={tpslEnabled}
              onCheckedChange={(checked) => setTpslEnabled(checked as boolean)}
              data-testid="checkbox-tpsl"
            />
            <label htmlFor="tpsl" className="text-[9px] cursor-pointer">
              Take Profit / Stop Loss
            </label>
          </div>
        </div>

        {/* Connect Wallet / Place Order Button */}
        <div className="mt-1 flex-shrink-0">
          <Button
            onClick={handlePlaceOrder}
            className="w-full h-8 text-[10px] font-semibold bg-primary hover:bg-primary/90"
            data-testid="button-place-order"
          >
            {isConnected ? (side === "buy" ? "Buy" : "Sell") : "Connect Wallet to Trade"}
          </Button>
        </div>

        {/* Bottom Info Section */}
        <div className="mt-1 space-y-px text-[9px] flex-shrink-0">
          <div className="flex justify-between">
            <span className="text-secondary">Maximum Order Value:</span>
            <span className="font-mono">-</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Order Value:</span>
            <span className="font-mono">-</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Est. Liq. Price:</span>
            <span className="font-mono">-</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Position Margin:</span>
            <span className="font-mono">$0.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Fees:</span>
            <span className="font-mono">Taker: 0% | Maker: 0%</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
