import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OrderEntryPanelProps {
  symbol: string;
  lastPrice?: number;
}

export default function OrderEntryPanel({ symbol, lastPrice = 0 }: OrderEntryPanelProps) {
  const { toast } = useToast();
  
  // State
  const [orderType, setOrderType] = useState<"market" | "limit" | "scale">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [sliderValue, setSliderValue] = useState([0]);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpslEnabled, setTpslEnabled] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedOrderType, setAdvancedOrderType] = useState("");
  
  // Scale order specific
  const [scaleStart, setScaleStart] = useState("");
  const [scaleEnd, setScaleEnd] = useState("");
  const [scaleOrderCount, setScaleOrderCount] = useState("5");
  const [scaleSizeSkew, setScaleSizeSkew] = useState("1.00");

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

    console.log("[OrderEntry] Placing order:", {
      symbol,
      orderType,
      side,
      amount,
      limitPrice: orderType === "limit" ? limitPrice : undefined,
    });

    // TODO: Implement actual order placement
    toast({
      title: "Order Placed",
      description: `${side.toUpperCase()} order for ${amount} ${symbol}`,
    });
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
    <div className="flex flex-col p-1 w-[280px] min-w-[280px] max-w-[280px] h-[600px] min-h-[600px] max-h-[600px]">
      {/* Tabs - Fixed Header */}
      <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)} className="flex-shrink-0">
        <TabsList className="w-full grid grid-cols-3 h-6">
          <TabsTrigger value="market" className="text-[9px] px-1 py-0">Market</TabsTrigger>
          <TabsTrigger value="limit" className="text-[9px] px-1 py-0">Limit</TabsTrigger>
          <TabsTrigger value="scale" className="text-[9px] px-1 py-0">Scale</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ALL CONTENT - Scrollable with Fixed Height */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col mt-1">
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

        {/* Limit Price (for Limit orders) */}
        {orderType === "limit" && (
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

        {/* Scale Order Fields */}
        {orderType === "scale" && (
          <div className="space-y-1">
            <div className="space-y-0.5">
              <Label className="text-[9px] font-medium">Start</Label>
              <Input
                type="number"
                placeholder="0.0"
                value={scaleStart}
                onChange={(e) => setScaleStart(e.target.value)}
                className="h-6 text-[10px] px-1 py-0"
                data-testid="input-scale-start"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] font-medium">End</Label>
              <div className="flex gap-0.5">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={scaleEnd}
                  onChange={(e) => setScaleEnd(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0 flex-1"
                  data-testid="input-scale-end"
                />
                <span className="text-[9px] text-secondary flex items-center px-1">USD</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-0.5">
              <div className="space-y-0.5">
                <Label className="text-[9px]">Order Count</Label>
                <Input
                  type="number"
                  value={scaleOrderCount}
                  onChange={(e) => setScaleOrderCount(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-order-count"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Size Skew</Label>
                <Input
                  type="number"
                  value={scaleSizeSkew}
                  onChange={(e) => setScaleSizeSkew(e.target.value)}
                  className="h-6 text-[10px] px-1 py-0"
                  data-testid="input-size-skew"
                />
              </div>
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
            <span className="text-[9px] text-secondary flex items-center px-1">BTC</span>
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

        {/* Advanced Dropdown */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[9px] hover-elevate p-1 rounded w-full" data-testid="button-advanced-toggle">
            <span>Advanced</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            <div className="space-y-0.5">
              <Label className="text-[9px]">Order Type</Label>
              <Select value={advancedOrderType} onValueChange={setAdvancedOrderType}>
                <SelectTrigger className="h-6 text-[9px]" data-testid="select-advanced-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stop-limit">Stop Limit</SelectItem>
                  <SelectItem value="stop-market">Stop Market</SelectItem>
                  <SelectItem value="take-profit-limit">Take Profit Limit</SelectItem>
                  <SelectItem value="take-profit-market">Take Profit Market</SelectItem>
                  <SelectItem value="twap">TWAP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>

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
