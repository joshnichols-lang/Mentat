import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, Target, Layers, IceCream, GitBranch, TrendingDown, Grid, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AdvancedOrderEntryProps {
  symbol: string;
  currentPrice: number;
}

export function AdvancedOrderEntry({ symbol, currentPrice }: AdvancedOrderEntryProps) {
  const [orderType, setOrderType] = useState<string>("twap");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [totalSize, setTotalSize] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // TWAP parameters
  const [twapDuration, setTwapDuration] = useState<number>(30);
  const [twapSlices, setTwapSlices] = useState<number>(10);
  const [twapRandomize, setTwapRandomize] = useState<boolean>(false);
  const [twapPriceLimit, setTwapPriceLimit] = useState<string>("");

  // Limit Chase parameters
  const [chaseOffset, setChaseOffset] = useState<number>(1);
  const [chaseMaxChases, setChaseMaxChases] = useState<number>(10);
  const [chaseInterval, setChaseInterval] = useState<number>(5);
  const [chasePriceLimit, setChasePriceLimit] = useState<string>("");

  // Scaled Order parameters
  const [scaledLevels, setScaledLevels] = useState<number>(5);
  const [scaledPriceStart, setScaledPriceStart] = useState<string>("");
  const [scaledPriceEnd, setScaledPriceEnd] = useState<string>("");
  const [scaledDistribution, setScaledDistribution] = useState<"linear" | "geometric">("linear");

  // Iceberg parameters
  const [icebergDisplay, setIcebergDisplay] = useState<string>("");
  const [icebergPrice, setIcebergPrice] = useState<string>("");
  const [icebergRefresh, setIcebergRefresh] = useState<"immediate" | "delayed">("immediate");

  const handleSubmit = async () => {
    if (!totalSize || parseFloat(totalSize) <= 0) {
      toast({
        title: "Invalid Size",
        description: "Please enter a valid order size",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let parameters: any = {};

      switch (orderType) {
        case "twap":
          parameters = {
            durationMinutes: twapDuration,
            slices: twapSlices,
            randomizeIntervals: twapRandomize,
            priceLimit: twapPriceLimit || undefined,
          };
          break;

        case "limit_chase":
          parameters = {
            offset: chaseOffset,
            maxChases: chaseMaxChases,
            chaseIntervalSeconds: chaseInterval,
            priceLimit: chasePriceLimit || undefined,
            giveUpBehavior: "cancel",
          };
          break;

        case "scaled":
          parameters = {
            levels: scaledLevels,
            priceStart: scaledPriceStart || currentPrice.toString(),
            priceEnd: scaledPriceEnd || (currentPrice * (side === "buy" ? 0.95 : 1.05)).toString(),
            distribution: scaledDistribution,
          };
          break;

        case "iceberg":
          parameters = {
            displaySize: icebergDisplay,
            totalSize: totalSize,
            priceLimit: icebergPrice || currentPrice.toString(),
            refreshBehavior: icebergRefresh,
          };
          break;
      }

      const response = await apiRequest("/api/advanced-orders", {
        method: "POST",
        body: JSON.stringify({
          orderType,
          symbol,
          side,
          totalSize,
          parameters,
          status: "pending",
        }),
      });

      toast({
        title: "Advanced Order Created",
        description: `${orderType.toUpperCase()} order for ${totalSize} ${symbol} created successfully`,
      });

      // Reset form
      setTotalSize("");
    } catch (error) {
      console.error("Error creating advanced order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Advanced Orders
        </CardTitle>
        <CardDescription>
          Institutional-grade order types for optimal execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={orderType} onValueChange={setOrderType}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="twap" data-testid="tab-twap">
              <TrendingUp className="w-4 h-4 mr-1" />
              TWAP
            </TabsTrigger>
            <TabsTrigger value="limit_chase" data-testid="tab-limit-chase">
              <Target className="w-4 h-4 mr-1" />
              Chase
            </TabsTrigger>
            <TabsTrigger value="scaled" data-testid="tab-scaled">
              <Layers className="w-4 h-4 mr-1" />
              Scaled
            </TabsTrigger>
            <TabsTrigger value="iceberg" data-testid="tab-iceberg">
              <IceCream className="w-4 h-4 mr-1" />
              Iceberg
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Common fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Side</Label>
                <Select value={side} onValueChange={(v: any) => setSide(v)}>
                  <SelectTrigger data-testid="select-side">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Size</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={totalSize}
                  onChange={(e) => setTotalSize(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-total-size"
                />
              </div>
            </div>

            {/* TWAP Parameters */}
            <TabsContent value="twap" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Duration (minutes): {twapDuration}</Label>
                <Slider
                  value={[twapDuration]}
                  onValueChange={([v]) => setTwapDuration(v)}
                  min={5}
                  max={240}
                  step={5}
                  data-testid="slider-twap-duration"
                />
              </div>
              <div className="space-y-2">
                <Label>Number of Slices: {twapSlices}</Label>
                <Slider
                  value={[twapSlices]}
                  onValueChange={([v]) => setTwapSlices(v)}
                  min={2}
                  max={50}
                  step={1}
                  data-testid="slider-twap-slices"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Randomize Intervals (Anti-Gaming)</Label>
                <Switch
                  checked={twapRandomize}
                  onCheckedChange={setTwapRandomize}
                  data-testid="switch-twap-randomize"
                />
              </div>
              <div className="space-y-2">
                <Label>Price Limit (Optional)</Label>
                <Input
                  type="number"
                  value={twapPriceLimit}
                  onChange={(e) => setTwapPriceLimit(e.target.value)}
                  placeholder={`Max ${side === "buy" ? "buy" : "sell"} price`}
                  data-testid="input-twap-price-limit"
                />
              </div>
            </TabsContent>

            {/* Limit Chase Parameters */}
            <TabsContent value="limit_chase" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Offset (ticks from best price): {chaseOffset}</Label>
                <Slider
                  value={[chaseOffset]}
                  onValueChange={([v]) => setChaseOffset(v)}
                  min={-5}
                  max={5}
                  step={1}
                  data-testid="slider-chase-offset"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Price Adjustments: {chaseMaxChases}</Label>
                <Slider
                  value={[chaseMaxChases]}
                  onValueChange={([v]) => setChaseMaxChases(v)}
                  min={1}
                  max={50}
                  step={1}
                  data-testid="slider-chase-max"
                />
              </div>
              <div className="space-y-2">
                <Label>Check Interval (seconds): {chaseInterval}</Label>
                <Slider
                  value={[chaseInterval]}
                  onValueChange={([v]) => setChaseInterval(v)}
                  min={1}
                  max={60}
                  step={1}
                  data-testid="slider-chase-interval"
                />
              </div>
              <div className="space-y-2">
                <Label>Price Limit (Optional)</Label>
                <Input
                  type="number"
                  value={chasePriceLimit}
                  onChange={(e) => setChasePriceLimit(e.target.value)}
                  placeholder="Don't chase beyond this price"
                  data-testid="input-chase-price-limit"
                />
              </div>
            </TabsContent>

            {/* Scaled Order Parameters */}
            <TabsContent value="scaled" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Number of Levels: {scaledLevels}</Label>
                <Slider
                  value={[scaledLevels]}
                  onValueChange={([v]) => setScaledLevels(v)}
                  min={2}
                  max={20}
                  step={1}
                  data-testid="slider-scaled-levels"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Price</Label>
                  <Input
                    type="number"
                    value={scaledPriceStart}
                    onChange={(e) => setScaledPriceStart(e.target.value)}
                    placeholder={currentPrice.toString()}
                    data-testid="input-scaled-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Price</Label>
                  <Input
                    type="number"
                    value={scaledPriceEnd}
                    onChange={(e) => setScaledPriceEnd(e.target.value)}
                    placeholder={(currentPrice * (side === "buy" ? 0.95 : 1.05)).toString()}
                    data-testid="input-scaled-end"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Size Distribution</Label>
                <Select value={scaledDistribution} onValueChange={(v: any) => setScaledDistribution(v)}>
                  <SelectTrigger data-testid="select-scaled-distribution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear (Equal sizes)</SelectItem>
                    <SelectItem value="geometric">Geometric (Increasing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Iceberg Parameters */}
            <TabsContent value="iceberg" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Display Size (visible portion)</Label>
                <Input
                  type="number"
                  value={icebergDisplay}
                  onChange={(e) => setIcebergDisplay(e.target.value)}
                  placeholder="Amount shown in order book"
                  data-testid="input-iceberg-display"
                />
              </div>
              <div className="space-y-2">
                <Label>Limit Price</Label>
                <Input
                  type="number"
                  value={icebergPrice}
                  onChange={(e) => setIcebergPrice(e.target.value)}
                  placeholder={currentPrice.toString()}
                  data-testid="input-iceberg-price"
                />
              </div>
              <div className="space-y-2">
                <Label>Refresh Behavior</Label>
                <Select value={icebergRefresh} onValueChange={(v: any) => setIcebergRefresh(v)}>
                  <SelectTrigger data-testid="select-iceberg-refresh">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate (instant refresh)</SelectItem>
                    <SelectItem value="delayed">Delayed (5s delay)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !totalSize}
          className="w-full"
          data-testid="button-create-advanced-order"
        >
          {isSubmitting ? "Creating..." : `Create ${orderType.toUpperCase()} Order`}
        </Button>
      </CardContent>
    </Card>
  );
}
