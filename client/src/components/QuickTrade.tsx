import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QuickTrade() {
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [symbol, setSymbol] = useState("BTC");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [leverage, setLeverage] = useState("3");

  const handleTrade = (side: "long" | "short") => {
    console.log("Trade submitted:", { side, symbol, size, price, leverage, orderType });
  };

  return (
    <Card className="p-3">
      <h2 className="mb-3 text-sm font-semibold">Quick Trade</h2>
      
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="symbol">Market</Label>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger id="symbol" data-testid="select-symbol">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BTC">BTC/USD</SelectItem>
              <SelectItem value="ETH">ETH/USD</SelectItem>
              <SelectItem value="SOL">SOL/USD</SelectItem>
              <SelectItem value="ARB">ARB/USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "market" | "limit")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="market" data-testid="tab-market">Market</TabsTrigger>
            <TabsTrigger value="limit" data-testid="tab-limit">Limit</TabsTrigger>
          </TabsList>
          
          <TabsContent value="market" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="size-market">Size</Label>
              <Input
                id="size-market"
                type="number"
                placeholder="0.00"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="font-mono"
                data-testid="input-size"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="limit" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price-limit">Limit Price</Label>
              <Input
                id="price-limit"
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="font-mono"
                data-testid="input-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size-limit">Size</Label>
              <Input
                id="size-limit"
                type="number"
                placeholder="0.00"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="font-mono"
                data-testid="input-size-limit"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="leverage">Leverage</Label>
          <Select value={leverage} onValueChange={setLeverage}>
            <SelectTrigger id="leverage" data-testid="select-leverage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
              <SelectItem value="3">3x</SelectItem>
              <SelectItem value="5">5x</SelectItem>
              <SelectItem value="10">10x</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            className="bg-long text-long-foreground hover:bg-long/90"
            onClick={() => handleTrade("long")}
            data-testid="button-long"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Long
          </Button>
          <Button
            className="bg-short text-short-foreground hover:bg-short/90"
            onClick={() => handleTrade("short")}
            data-testid="button-short"
          >
            <TrendingDown className="mr-2 h-4 w-4" />
            Short
          </Button>
        </div>
      </div>
    </Card>
  );
}
