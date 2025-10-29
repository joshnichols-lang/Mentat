import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Sparkles, TrendingUp, TrendingDown, Minus, Plus, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { OptionsStrategy, InsertOptionsStrategy } from "@shared/schema";

interface OptionsStrategyBuilderProps {
  asset: string;
  currentPrice: number;
  mode: "simple" | "pro";
  onModeChange: (mode: "simple" | "pro") => void;
  onStrategySelect: (strategy: Partial<OptionsStrategy>) => void;
}

// Popular pre-built strategies for Simple mode
const SIMPLE_STRATEGIES = [
  {
    id: "long-straddle",
    name: "Long Straddle",
    type: "neutral",
    description: "Buy Call + Put at same strike (high volatility)",
    icon: <Minus className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/30",
  },
  {
    id: "long-strangle",
    name: "Long Strangle",
    type: "neutral",
    description: "Buy OTM Call + OTM Put (explosive moves)",
    icon: <RefreshCw className="h-4 w-4" />,
    color: "bg-accent/10 text-accent border-accent/30",
  },
  {
    id: "bull-call-spread",
    name: "Bull Call Spread",
    type: "bullish",
    description: "Buy Call + Sell higher Call (limited risk)",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-long/10 text-long border-long/30",
  },
  {
    id: "bear-put-spread",
    name: "Bear Put Spread",
    type: "bearish",
    description: "Buy Put + Sell lower Put (limited risk)",
    icon: <TrendingDown className="h-4 w-4" />,
    color: "bg-short/10 text-short border-short/30",
  },
  {
    id: "iron-condor",
    name: "Iron Condor",
    type: "neutral",
    description: "OTM Call + Put spreads (range-bound)",
    icon: <Minus className="h-4 w-4" />,
    color: "bg-muted/10 text-muted-foreground border-muted/30",
  },
  {
    id: "butterfly",
    name: "Long Butterfly",
    type: "neutral",
    description: "ATM + 2 OTM (pinpoint expiry)",
    icon: <Sparkles className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/30",
  },
];

export default function OptionsStrategyBuilder({
  asset,
  currentPrice,
  mode,
  onModeChange,
  onStrategySelect,
}: OptionsStrategyBuilderProps) {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [customStrike, setCustomStrike] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  
  // Fetch available expiries from Aevo
  const { data: marketsData } = useQuery<{ success: boolean; markets: any[] }>({
    queryKey: ['/api/aevo/markets'],
  });

  const markets = marketsData?.markets || [];
  
  // Extract unique expiry dates
  const expiryDates = Array.from(
    new Set(
      markets
        .filter((m: any) => m.underlying === asset)
        .map((m: any) => new Date(m.expiry * 1000).toISOString().split('T')[0])
    )
  ).sort();

  // Auto-select nearest expiry
  useEffect(() => {
    if (expiryDates.length > 0 && !selectedExpiry) {
      setSelectedExpiry(expiryDates[0]);
    }
  }, [expiryDates, selectedExpiry]);

  // Generate strategy parameters based on simple strategy selection
  const buildSimpleStrategy = (strategyId: string) => {
    if (!selectedExpiry) return;

    const strikeOffset = currentPrice * 0.05; // 5% offset
    const atmStrike = Math.round(currentPrice / 100) * 100; // Round to nearest 100
    
    // Estimate premium as percentage of underlying (simplified - real pricing uses Black-Scholes)
    const daysToExpiry = Math.ceil((new Date(selectedExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const timeFactor = Math.sqrt(daysToExpiry / 365);
    const estimatedCallPremium = currentPrice * 0.03 * timeFactor; // ~3% ATM premium
    const estimatedPutPremium = currentPrice * 0.03 * timeFactor;

    let strategy: Partial<OptionsStrategy> = {
      name: SIMPLE_STRATEGIES.find(s => s.id === strategyId)?.name || "Custom",
      type: strategyId,
      asset: asset,
      underlyingPrice: currentPrice.toString(),
      expiry: new Date(selectedExpiry),
      strike: atmStrike.toString(),
      status: "active",
      currentValue: "0", // Will be updated after entry
      unrealizedPnl: "0",
    };

    // Set strategy-specific parameters
    switch (strategyId) {
      case "long-straddle":
        const straddleCost = estimatedCallPremium + estimatedPutPremium;
        strategy.totalCost = straddleCost.toFixed(6);
        strategy.maxLoss = straddleCost.toFixed(6);
        strategy.maxProfit = null; // Unlimited
        strategy.lowerBreakeven = (atmStrike - straddleCost).toFixed(2);
        strategy.upperBreakeven = (atmStrike + straddleCost).toFixed(2);
        break;

      case "long-strangle":
        const otmCallStrike = atmStrike + strikeOffset;
        const otmPutStrike = atmStrike - strikeOffset;
        const strangleCost = estimatedCallPremium * 0.7 + estimatedPutPremium * 0.7; // OTM cheaper
        strategy.strike = atmStrike.toString();
        strategy.totalCost = strangleCost.toFixed(6);
        strategy.maxLoss = strangleCost.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = (otmPutStrike - strangleCost).toFixed(2);
        strategy.upperBreakeven = (otmCallStrike + strangleCost).toFixed(2);
        break;

      case "bull-call-spread":
        const spreadWidth = strikeOffset;
        const spreadCost = estimatedCallPremium - (estimatedCallPremium * 0.5); // Sell higher strike
        strategy.totalCost = spreadCost.toFixed(6);
        strategy.maxLoss = spreadCost.toFixed(6);
        strategy.maxProfit = (spreadWidth - spreadCost).toFixed(6);
        strategy.lowerBreakeven = (atmStrike + spreadCost).toFixed(2);
        strategy.upperBreakeven = (atmStrike + spreadWidth).toFixed(2);
        break;

      case "bear-put-spread":
        const putSpreadWidth = strikeOffset;
        const putSpreadCost = estimatedPutPremium - (estimatedPutPremium * 0.5);
        strategy.totalCost = putSpreadCost.toFixed(6);
        strategy.maxLoss = putSpreadCost.toFixed(6);
        strategy.maxProfit = (putSpreadWidth - putSpreadCost).toFixed(6);
        strategy.lowerBreakeven = (atmStrike - putSpreadWidth).toFixed(2);
        strategy.upperBreakeven = (atmStrike - putSpreadCost).toFixed(2);
        break;

      case "iron-condor":
        const condorCredit = estimatedCallPremium * 0.4 + estimatedPutPremium * 0.4; // Net credit
        const condorWidth = strikeOffset * 0.5;
        strategy.totalCost = "0"; // Credit spread
        strategy.maxLoss = (condorWidth - condorCredit).toFixed(6);
        strategy.maxProfit = condorCredit.toFixed(6);
        strategy.lowerBreakeven = (atmStrike - strikeOffset - condorCredit).toFixed(2);
        strategy.upperBreakeven = (atmStrike + strikeOffset + condorCredit).toFixed(2);
        break;

      case "butterfly":
        const butterflyDebit = estimatedCallPremium * 0.25; // Minimal cost
        strategy.totalCost = butterflyDebit.toFixed(6);
        strategy.maxLoss = butterflyDebit.toFixed(6);
        strategy.maxProfit = (strikeOffset - butterflyDebit).toFixed(6);
        strategy.lowerBreakeven = (atmStrike - (strikeOffset - butterflyDebit)).toFixed(2);
        strategy.upperBreakeven = (atmStrike + (strikeOffset - butterflyDebit)).toFixed(2);
        break;
    }

    return strategy;
  };

  const handleSimpleStrategyClick = (strategyId: string) => {
    setSelectedStrategyId(strategyId);
    const strategy = buildSimpleStrategy(strategyId);
    if (strategy) {
      onStrategySelect(strategy);
    }
  };

  return (
    <Card className="glass border-glass/20 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-glass/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Strategy Builder
          </CardTitle>
          
          {/* Mode Toggle */}
          <Tabs value={mode} onValueChange={(v) => onModeChange(v as "simple" | "pro")}>
            <TabsList className="h-8 glass">
              <TabsTrigger value="simple" className="text-xs h-6" data-testid="tab-simple-mode">
                <Sparkles className="h-3 w-3 mr-1" />
                Simple
              </TabsTrigger>
              <TabsTrigger value="pro" className="text-xs h-6" data-testid="tab-pro-mode">
                <Layers className="h-3 w-3 mr-1" />
                Pro
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4 space-y-4">
        {mode === "simple" ? (
          // SIMPLE MODE: One-click strategy selection
          <>
            {/* Expiry Selection */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Expiry Date
              </label>
              <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                <SelectTrigger className="w-full h-8 text-xs" data-testid="select-expiry">
                  <SelectValue placeholder="Select expiry..." />
                </SelectTrigger>
                <SelectContent>
                  {expiryDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                      {' '}
                      ({Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strategy Cards */}
            <div>
              <label className="text-xs font-medium mb-2 block text-muted-foreground">
                Select Strategy
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SIMPLE_STRATEGIES.map((strategy) => (
                  <button
                    key={strategy.id}
                    onClick={() => handleSimpleStrategyClick(strategy.id)}
                    className={`
                      p-3 rounded-md border transition-all text-left
                      hover-elevate active-elevate-2
                      ${selectedStrategyId === strategy.id 
                        ? 'bg-primary/10 border-primary/50' 
                        : 'glass border-glass/20'
                      }
                    `}
                    data-testid={`button-strategy-${strategy.id}`}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <div className={`p-1 rounded ${strategy.color}`}>
                        {strategy.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {strategy.name}
                        </div>
                        <Badge 
                          variant="outline" 
                          className="text-[10px] h-4 px-1 mt-0.5"
                        >
                          {strategy.type}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {strategy.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Info */}
            {selectedStrategyId && (
              <div className="glass rounded-md p-3 border border-glass/20 space-y-2">
                <h4 className="text-xs font-semibold text-primary">Strategy Preview</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Current Price:</span>
                    <span className="font-medium text-foreground">
                      ${currentPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expiry:</span>
                    <span className="font-medium text-foreground">
                      {selectedExpiry && new Date(selectedExpiry).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Strategy:</span>
                    <span className="font-medium text-primary">
                      {SIMPLE_STRATEGIES.find(s => s.id === selectedStrategyId)?.name}
                    </span>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="w-full mt-2 h-7 text-xs"
                  data-testid="button-preview-strategy"
                >
                  Preview on Chart
                </Button>
              </div>
            )}
          </>
        ) : (
          // PRO MODE: Manual strike and leg construction
          <>
            {/* Expiry Selection */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Expiry Date
              </label>
              <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                <SelectTrigger className="w-full h-8 text-xs" data-testid="select-expiry-pro">
                  <SelectValue placeholder="Select expiry..." />
                </SelectTrigger>
                <SelectContent>
                  {expiryDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strike Selection */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Strike Price
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customStrike}
                  onChange={(e) => setCustomStrike(e.target.value)}
                  placeholder={`e.g., ${Math.round(currentPrice / 100) * 100}`}
                  className="flex-1 h-8 px-2 text-xs bg-glass/50 border border-glass/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  data-testid="input-strike-price"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 px-2 text-xs"
                  onClick={() => setCustomStrike((Math.round(currentPrice / 100) * 100).toString())}
                  data-testid="button-atm-strike"
                >
                  ATM
                </Button>
              </div>
            </div>

            {/* Leg Builder */}
            <div className="space-y-2">
              <label className="text-xs font-medium block text-muted-foreground">
                Strategy Legs
              </label>
              <div className="glass rounded-md p-3 border border-glass/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">No legs added</span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 px-2 text-xs"
                    data-testid="button-add-leg"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Leg
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/70">
                  Build custom multi-leg strategies by adding calls and puts
                </p>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Quantity (Contracts)
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                step="1"
                placeholder="1"
                className="w-full h-8 px-2 text-xs bg-glass/50 border border-glass/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                data-testid="input-quantity"
              />
            </div>

            {/* Calculate Button */}
            <Button 
              className="w-full h-8 text-xs"
              disabled
              data-testid="button-calculate-payoff"
            >
              Calculate Payoff
            </Button>

            <p className="text-[10px] text-center text-muted-foreground/70 italic">
              Pro mode leg construction coming in next iteration
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
