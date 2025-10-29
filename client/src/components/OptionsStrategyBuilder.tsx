import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Sparkles, TrendingUp, TrendingDown, Minus, Activity, RefreshCw, ArrowUpCircle, ArrowDownCircle, Circle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { OptionsStrategy, InsertOptionsStrategy } from "@shared/schema";

interface OptionsStrategyBuilderProps {
  asset: string;
  currentPrice: number;
  mode: "simple" | "pro";
  onModeChange: (mode: "simple" | "pro") => void;
  onStrategySelect: (strategy: Partial<OptionsStrategy>) => void;
}

type Sentiment = "bullish" | "bearish" | "neutral" | "volatile";

const SENTIMENT_OPTIONS = [
  {
    id: "bullish" as Sentiment,
    label: "Bullish",
    icon: <ArrowUpCircle className="h-5 w-5" />,
    description: "Price rises sharply",
    color: "text-success",
    bgColor: "bg-success/10 hover:bg-success/20 border-success/30",
  },
  {
    id: "bearish" as Sentiment,
    label: "Bearish",
    icon: <ArrowDownCircle className="h-5 w-5" />,
    description: "Price falls significantly",
    color: "text-destructive",
    bgColor: "bg-destructive/10 hover:bg-destructive/20 border-destructive/30",
  },
  {
    id: "neutral" as Sentiment,
    label: "Neutral",
    icon: <Circle className="h-5 w-5" />,
    description: "Price stays flat",
    color: "text-muted-foreground",
    bgColor: "bg-muted/10 hover:bg-muted/20 border-muted/30",
  },
  {
    id: "volatile" as Sentiment,
    label: "High Volatility",
    icon: <Activity className="h-5 w-5" />,
    description: "Big move expected",
    color: "text-primary",
    bgColor: "bg-primary/10 hover:bg-primary/20 border-primary/30",
  },
];

const SIMPLE_STRATEGIES = [
  {
    id: "long-straddle",
    name: "Long Straddle",
    sentiment: "volatile" as Sentiment,
    description: "Buy Call + Put at same strike",
    expectedMove: "High profits if price rises or falls significantly",
    icon: <Minus className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/30",
    discount: null,
  },
  {
    id: "long-strangle",
    name: "Long Strangle",
    sentiment: "volatile" as Sentiment,
    description: "Buy OTM Call + OTM Put",
    expectedMove: "Low cost, very high profits if explosive moves",
    icon: <RefreshCw className="h-4 w-4" />,
    color: "bg-accent/10 text-accent border-accent/30",
    discount: "10% discount",
  },
  {
    id: "bull-call-spread",
    name: "Bull Call Spread",
    sentiment: "bullish" as Sentiment,
    description: "Buy Call + Sell higher Call",
    expectedMove: "Decent profits if price rises to certain level",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-long/10 text-long border-long/30",
    discount: null,
  },
  {
    id: "bear-put-spread",
    name: "Bear Put Spread",
    sentiment: "bearish" as Sentiment,
    description: "Buy Put + Sell lower Put",
    expectedMove: "Decent profits if price stays at certain level or rises",
    icon: <TrendingDown className="h-4 w-4" />,
    color: "bg-short/10 text-short border-short/30",
    discount: null,
  },
  {
    id: "iron-condor",
    name: "Iron Condor",
    sentiment: "neutral" as Sentiment,
    description: "OTM Call + Put spreads",
    expectedMove: "Low cost, decent profits if price stays at certain level or rises",
    icon: <Minus className="h-4 w-4" />,
    color: "bg-muted/10 text-muted-foreground border-muted/30",
    discount: null,
  },
  {
    id: "butterfly",
    name: "Long Butterfly",
    sentiment: "neutral" as Sentiment,
    description: "ATM + 2 OTM",
    expectedMove: "High profits if price falls to certain level",
    icon: <Sparkles className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/30",
    discount: null,
  },
];

export default function OptionsStrategyBuilder({
  asset,
  currentPrice,
  mode,
  onModeChange,
  onStrategySelect,
}: OptionsStrategyBuilderProps) {
  const [selectedSentiment, setSelectedSentiment] = useState<Sentiment>("bullish");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [period, setPeriod] = useState<number>(7); // Days
  
  const { data: marketsData } = useQuery<{ success: boolean; markets: any[] }>({
    queryKey: ['/api/aevo/markets'],
  });

  const markets = marketsData?.markets || [];
  
  const expiryDates = Array.from(
    new Set(
      markets
        .filter((m: any) => m.underlying_asset === asset && m.instrument_type === 'OPTION' && m.is_active)
        .map((m: any) => {
          if (!m.expiry) return null;
          // Convert nanoseconds timestamp to milliseconds
          const date = new Date(parseInt(m.expiry) / 1_000_000);
          return date.toISOString().split('T')[0];
        })
        .filter(Boolean)
    )
  ).sort();

  useEffect(() => {
    if (expiryDates.length > 0 && !selectedExpiry) {
      setSelectedExpiry(expiryDates[0]);
    }
  }, [expiryDates, selectedExpiry]);

  // Update period when expiry changes
  useEffect(() => {
    if (selectedExpiry) {
      const days = Math.ceil((new Date(selectedExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setPeriod(days);
    }
  }, [selectedExpiry]);

  const buildSimpleStrategy = (strategyId: string) => {
    if (!selectedExpiry) return;

    const strikeOffset = currentPrice * 0.05;
    const atmStrike = Math.round(currentPrice / 100) * 100;
    
    const daysToExpiry = Math.ceil((new Date(selectedExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const timeFactor = Math.sqrt(daysToExpiry / 365);
    const estimatedCallPremium = currentPrice * 0.03 * timeFactor;
    const estimatedPutPremium = currentPrice * 0.03 * timeFactor;

    let strategy: Partial<OptionsStrategy> = {
      name: SIMPLE_STRATEGIES.find(s => s.id === strategyId)?.name || "Custom",
      type: strategyId,
      asset: asset,
      underlyingPrice: currentPrice.toString(),
      expiry: new Date(selectedExpiry),
      strike: atmStrike.toString(),
      status: "active",
      currentValue: "0",
      unrealizedPnl: "0",
    };

    switch (strategyId) {
      case "long-straddle":
        const straddleCost = estimatedCallPremium + estimatedPutPremium;
        strategy.totalCost = straddleCost.toFixed(6);
        strategy.maxLoss = straddleCost.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = (atmStrike - straddleCost).toFixed(2);
        strategy.upperBreakeven = (atmStrike + straddleCost).toFixed(2);
        break;

      case "long-strangle":
        const otmCallStrike = atmStrike + strikeOffset;
        const otmPutStrike = atmStrike - strikeOffset;
        const strangleCost = (estimatedCallPremium * 0.7 + estimatedPutPremium * 0.7) * 0.9; // 10% discount
        strategy.strike = atmStrike.toString();
        strategy.totalCost = strangleCost.toFixed(6);
        strategy.maxLoss = strangleCost.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = (otmPutStrike - strangleCost).toFixed(2);
        strategy.upperBreakeven = (otmCallStrike + strangleCost).toFixed(2);
        break;

      case "bull-call-spread":
        const spreadWidth = strikeOffset;
        const spreadCost = estimatedCallPremium - (estimatedCallPremium * 0.5);
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
        const condorCredit = estimatedCallPremium * 0.4 + estimatedPutPremium * 0.4;
        const condorWidth = strikeOffset * 0.5;
        strategy.totalCost = "0";
        strategy.maxLoss = (condorWidth - condorCredit).toFixed(6);
        strategy.maxProfit = condorCredit.toFixed(6);
        strategy.lowerBreakeven = (atmStrike - strikeOffset - condorCredit).toFixed(2);
        strategy.upperBreakeven = (atmStrike + strikeOffset + condorCredit).toFixed(2);
        break;

      case "butterfly":
        const butterflyDebit = estimatedCallPremium * 0.25;
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

  const filteredStrategies = SIMPLE_STRATEGIES.filter(s => s.sentiment === selectedSentiment);

  return (
    <div className="h-full flex flex-col glass">
      <div className="p-4 pb-3 border-b border-glass/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Strategy Builder
          </h3>
          
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

        {/* Asset Selector - already exists in parent, show current price */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{asset}/USD</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Current Price:</span>
            <span className="font-semibold text-foreground">${currentPrice.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {mode === "simple" ? (
          <>
            {/* Sentiment Selector */}
            <div>
              <label className="text-xs font-medium mb-2 block text-muted-foreground">
                Market Sentiment
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SENTIMENT_OPTIONS.map((sentiment) => (
                  <button
                    key={sentiment.id}
                    onClick={() => setSelectedSentiment(sentiment.id)}
                    className={`
                      p-3 rounded-md border transition-all
                      hover-elevate active-elevate-2
                      ${selectedSentiment === sentiment.id 
                        ? sentiment.bgColor.replace('hover:', '') + ' border-current' 
                        : 'glass border-glass/20'
                      }
                    `}
                    data-testid={`button-sentiment-${sentiment.id}`}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={selectedSentiment === sentiment.id ? sentiment.color : 'text-muted-foreground'}>
                        {sentiment.icon}
                      </div>
                      <span className={`text-xs font-semibold ${selectedSentiment === sentiment.id ? sentiment.color : 'text-foreground'}`}>
                        {sentiment.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        {sentiment.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Period Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Period
                </label>
                <span className="text-xs font-semibold text-foreground">
                  {period} days
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="90"
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value))}
                className="w-full h-1.5 bg-glass/30 rounded-lg appearance-none cursor-pointer slider"
                data-testid="slider-period"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1d</span>
                <span>90d</span>
              </div>
            </div>

            {/* Expiry Date Display */}
            {selectedExpiry && (
              <div className="glass rounded-md p-2 border border-glass/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Expiration Date:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(selectedExpiry).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Strategy Cards */}
            <div>
              <label className="text-xs font-medium mb-2 block text-muted-foreground">
                Select Strategy
              </label>
              <div className="space-y-2">
                {filteredStrategies.map((strategy) => {
                  const strategyData = buildSimpleStrategy(strategy.id);
                  
                  return (
                    <button
                      key={strategy.id}
                      onClick={() => handleSimpleStrategyClick(strategy.id)}
                      className={`
                        w-full p-3 rounded-md border transition-all text-left
                        hover-elevate active-elevate-2
                        ${selectedStrategyId === strategy.id 
                          ? 'bg-primary/10 border-primary/50' 
                          : 'glass border-glass/20'
                        }
                      `}
                      data-testid={`button-strategy-${strategy.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded ${strategy.color} mt-0.5`}>
                          {strategy.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">{strategy.name}</span>
                            {strategy.discount && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-success/10 text-success border-success/30">
                                {strategy.discount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-2">
                            {strategy.description}
                          </p>
                          <p className="text-[10px] text-foreground/80 leading-tight">
                            {strategy.expectedMove}
                          </p>
                          
                          {/* Profit Zone Preview */}
                          {strategyData && (
                            <div className="mt-2 pt-2 border-t border-glass/20">
                              <div className="flex items-center justify-between text-[10px]">
                                <div>
                                  <span className="text-muted-foreground">Profit Zone:</span>
                                  <span className="ml-1 text-success font-medium">
                                    {strategyData.lowerBreakeven && strategyData.upperBreakeven 
                                      ? `<$${parseFloat(strategyData.lowerBreakeven).toFixed(0)} - >$${parseFloat(strategyData.upperBreakeven).toFixed(0)}`
                                      : strategyData.lowerBreakeven
                                      ? `<$${parseFloat(strategyData.lowerBreakeven).toFixed(0)}`
                                      : strategyData.upperBreakeven
                                      ? `>$${parseFloat(strategyData.upperBreakeven).toFixed(0)}`
                                      : 'Unlimited'
                                    }
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Max Loss:</span>
                                  <span className="ml-1 text-destructive font-medium">
                                    ${parseFloat(strategyData.maxLoss || '0').toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total Cost */}
            {selectedStrategyId && (() => {
              const strategyData = buildSimpleStrategy(selectedStrategyId);
              const strategy = SIMPLE_STRATEGIES.find(s => s.id === selectedStrategyId);
              const cost = parseFloat(strategyData?.totalCost || '0');
              const originalCost = strategy?.discount ? cost / 0.9 : cost;
              
              return (
                <div className="glass rounded-md p-3 border border-primary/30">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total Cost</span>
                      <div className="flex items-center gap-2">
                        {strategy?.discount && (
                          <span className="text-xs text-muted-foreground line-through">
                            ${originalCost.toFixed(2)} USDC.e
                          </span>
                        )}
                        <span className="text-base font-bold text-primary">
                          ${cost.toFixed(2)} USDC.e
                        </span>
                      </div>
                    </div>
                    {strategy?.discount && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-success/10 text-success border-success/30">
                        {strategy.discount}
                      </Badge>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full mt-3 h-8 text-xs"
                    data-testid="button-connect-wallet"
                  >
                    Connect
                  </Button>
                </div>
              );
            })()}
          </>
        ) : (
          // PRO MODE
          <>
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

            <div className="glass rounded-md p-3 border border-glass/20">
              <p className="text-xs text-center text-muted-foreground italic">
                Pro mode leg construction coming in next iteration
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
