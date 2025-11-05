import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Sparkles, TrendingUp, TrendingDown, Minus, Activity, RefreshCw, ArrowUpCircle, ArrowDownCircle, Circle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { OptionsStrategy, InsertOptionsStrategy } from "@shared/schema";
import { useStrategyStore } from "@/stores/strategyStore";
import { OrderConfirmationModal } from "@/components/OrderConfirmationModal";

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
  // Bullish Strategies
  {
    id: "long-call",
    name: "Call",
    sentiment: "bullish" as Sentiment,
    description: "Buy Call",
    expectedMove: "High profits if the price rises sharply",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-long/10 text-long border-long/30",
    discount: null,
  },
  {
    id: "strap",
    name: "Strap",
    sentiment: "bullish" as Sentiment,
    description: "2 Calls + 1 Put",
    expectedMove: "High profits if the price rises sharply, reasonable profits if the price falls",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-long/10 text-long border-long/30",
    discount: null,
  },
  {
    id: "bull-call-spread",
    name: "Bull Call Spread",
    sentiment: "bullish" as Sentiment,
    description: "Buy Call + Sell higher Call",
    expectedMove: "Low cost, decent profits if the price rises to a certain level",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-long/10 text-long border-long/30",
    discount: null,
  },
  {
    id: "bull-put-spread",
    name: "Bull Put Spread",
    sentiment: "bullish" as Sentiment,
    description: "Sell Put + Buy lower Put",
    expectedMove: "Low cost, decent profits if the price stays at a certain level or rises",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-long/10 text-long border-long/30",
    discount: null,
  },
  // Bearish Strategies
  {
    id: "long-put",
    name: "Put",
    sentiment: "bearish" as Sentiment,
    description: "Buy Put",
    expectedMove: "High profits if the price falls sharply",
    icon: <TrendingDown className="h-4 w-4" />,
    color: "bg-short/10 text-short border-short/30",
    discount: null,
  },
  {
    id: "strip",
    name: "Strip",
    sentiment: "bearish" as Sentiment,
    description: "1 Call + 2 Puts",
    expectedMove: "High profits if the price falls sharply, reasonable profits if the price rises",
    icon: <TrendingDown className="h-4 w-4" />,
    color: "bg-short/10 text-short border-short/30",
    discount: null,
  },
  {
    id: "bear-put-spread",
    name: "Bear Put Spread",
    sentiment: "bearish" as Sentiment,
    description: "Buy Put + Sell lower Put",
    expectedMove: "Low cost, decent profits if the price falls to a certain level",
    icon: <TrendingDown className="h-4 w-4" />,
    color: "bg-short/10 text-short border-short/30",
    discount: null,
  },
  {
    id: "bear-call-spread",
    name: "Bear Call Spread",
    sentiment: "bearish" as Sentiment,
    description: "Sell Call + Buy higher Call",
    expectedMove: "Low cost, decent profits if the price stays at a certain level or falls",
    icon: <TrendingDown className="h-4 w-4" />,
    color: "bg-short/10 text-short border-short/30",
    discount: null,
  },
  // High Volatility Strategies
  {
    id: "long-straddle",
    name: "Straddle",
    sentiment: "volatile" as Sentiment,
    description: "Buy Call + Put at same strike",
    expectedMove: "High profits if the price rises or falls sharply during the period of holding",
    icon: <Activity className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/30",
    discount: "10% discount",
  },
  {
    id: "long-strangle",
    name: "Strangle",
    sentiment: "volatile" as Sentiment,
    description: "Buy OTM Call + OTM Put",
    expectedMove: "Low cost, very high profits if the price rises or falls significantly",
    icon: <RefreshCw className="h-4 w-4" />,
    color: "bg-accent/10 text-accent border-accent/30",
    discount: null,
  },
  {
    id: "short-straddle",
    name: "Short Straddle",
    sentiment: "volatile" as Sentiment,
    description: "Sell Call + Put at same strike",
    expectedMove: "Profit if price stays near strike, unlimited risk if price moves sharply",
    icon: <Activity className="h-4 w-4" />,
    color: "bg-destructive/10 text-destructive border-destructive/30",
    discount: null,
  },
  {
    id: "short-strangle",
    name: "Short Strangle",
    sentiment: "volatile" as Sentiment,
    description: "Sell OTM Call + OTM Put",
    expectedMove: "Profit if price stays in range, high risk if price breaks out",
    icon: <RefreshCw className="h-4 w-4" />,
    color: "bg-destructive/10 text-destructive border-destructive/30",
    discount: null,
  },
  // Low Volatility / Neutral Strategies
  {
    id: "butterfly",
    name: "Long Butterfly",
    sentiment: "neutral" as Sentiment,
    description: "ATM + 2 OTM",
    expectedMove: "Low cost, high profits if the price is about a strike price",
    icon: <Sparkles className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/30",
    discount: null,
  },
  {
    id: "long-condor",
    name: "Long Condor",
    sentiment: "neutral" as Sentiment,
    description: "4 strikes spread",
    expectedMove: "Decent profits if the price changes slightly",
    icon: <Layers className="h-4 w-4" />,
    color: "bg-muted/10 text-muted-foreground border-muted/30",
    discount: null,
  },
  {
    id: "iron-condor",
    name: "Iron Condor",
    sentiment: "neutral" as Sentiment,
    description: "OTM Call + Put spreads",
    expectedMove: "Low cost, decent profits if price stays in a range",
    icon: <Minus className="h-4 w-4" />,
    color: "bg-muted/10 text-muted-foreground border-muted/30",
    discount: null,
  },
  {
    id: "iron-butterfly",
    name: "Iron Butterfly",
    sentiment: "neutral" as Sentiment,
    description: "ATM straddle + OTM strangle",
    expectedMove: "Maximum profit if price stays at strike, limited risk",
    icon: <Sparkles className="h-4 w-4" />,
    color: "bg-muted/10 text-muted-foreground border-muted/30",
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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  
  // Get selected market from strategy store
  const { selectedMarket, strategyType, setStrategyType } = useStrategyStore();
  
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
        .filter((date): date is string => date !== null)
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
      // Simple Calls and Puts
      case "long-call":
        strategy.totalCost = estimatedCallPremium.toFixed(6);
        strategy.maxLoss = estimatedCallPremium.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = null;
        strategy.upperBreakeven = (atmStrike + estimatedCallPremium).toFixed(2);
        break;

      case "long-put":
        strategy.totalCost = estimatedPutPremium.toFixed(6);
        strategy.maxLoss = estimatedPutPremium.toFixed(6);
        strategy.maxProfit = (atmStrike - estimatedPutPremium).toFixed(6);
        strategy.lowerBreakeven = (atmStrike - estimatedPutPremium).toFixed(2);
        strategy.upperBreakeven = null;
        break;

      // Straps and Strips
      case "strap":
        const strapCost = (2 * estimatedCallPremium) + estimatedPutPremium;
        strategy.totalCost = strapCost.toFixed(6);
        strategy.maxLoss = strapCost.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = (atmStrike - (strapCost / 1.5)).toFixed(2);
        strategy.upperBreakeven = (atmStrike + (strapCost / 2.5)).toFixed(2);
        break;

      case "strip":
        const stripCost = estimatedCallPremium + (2 * estimatedPutPremium);
        strategy.totalCost = stripCost.toFixed(6);
        strategy.maxLoss = stripCost.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = (atmStrike - (stripCost / 2.5)).toFixed(2);
        strategy.upperBreakeven = (atmStrike + (stripCost / 1.5)).toFixed(2);
        break;

      // Straddles and Strangles
      case "long-straddle":
        const straddleCost = (estimatedCallPremium + estimatedPutPremium) * 0.9; // 10% discount
        strategy.totalCost = straddleCost.toFixed(6);
        strategy.maxLoss = straddleCost.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = (atmStrike - straddleCost).toFixed(2);
        strategy.upperBreakeven = (atmStrike + straddleCost).toFixed(2);
        break;

      case "long-strangle":
        const otmCallStrike = atmStrike + strikeOffset;
        const otmPutStrike = atmStrike - strikeOffset;
        const strangleCost = estimatedCallPremium * 0.7 + estimatedPutPremium * 0.7;
        strategy.strike = atmStrike.toString();
        strategy.totalCost = strangleCost.toFixed(6);
        strategy.maxLoss = strangleCost.toFixed(6);
        strategy.maxProfit = null;
        strategy.lowerBreakeven = (otmPutStrike - strangleCost).toFixed(2);
        strategy.upperBreakeven = (otmCallStrike + strangleCost).toFixed(2);
        break;

      case "short-straddle":
        const shortStraddleCredit = estimatedCallPremium + estimatedPutPremium;
        strategy.totalCost = "0";
        strategy.maxLoss = undefined;
        strategy.maxProfit = shortStraddleCredit.toFixed(6);
        strategy.lowerBreakeven = (atmStrike - shortStraddleCredit).toFixed(2);
        strategy.upperBreakeven = (atmStrike + shortStraddleCredit).toFixed(2);
        break;

      case "short-strangle":
        const shortStrangleCredit = (estimatedCallPremium * 0.7) + (estimatedPutPremium * 0.7);
        strategy.totalCost = "0";
        strategy.maxLoss = undefined;
        strategy.maxProfit = shortStrangleCredit.toFixed(6);
        strategy.lowerBreakeven = (atmStrike - strikeOffset - shortStrangleCredit).toFixed(2);
        strategy.upperBreakeven = (atmStrike + strikeOffset + shortStrangleCredit).toFixed(2);
        break;

      // Spreads
      case "bull-call-spread":
        const spreadWidth = strikeOffset;
        const spreadCost = estimatedCallPremium - (estimatedCallPremium * 0.5);
        strategy.totalCost = spreadCost.toFixed(6);
        strategy.maxLoss = spreadCost.toFixed(6);
        strategy.maxProfit = (spreadWidth - spreadCost).toFixed(6);
        strategy.lowerBreakeven = (atmStrike + spreadCost).toFixed(2);
        strategy.upperBreakeven = (atmStrike + spreadWidth).toFixed(2);
        break;

      case "bull-put-spread":
        const bullPutCredit = estimatedPutPremium - (estimatedPutPremium * 0.5);
        const bullPutWidth = strikeOffset;
        strategy.totalCost = "0";
        strategy.maxLoss = (bullPutWidth - bullPutCredit).toFixed(6);
        strategy.maxProfit = bullPutCredit.toFixed(6);
        strategy.lowerBreakeven = (atmStrike - bullPutWidth).toFixed(2);
        strategy.upperBreakeven = (atmStrike - bullPutCredit).toFixed(2);
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

      case "bear-call-spread":
        const bearCallCredit = estimatedCallPremium - (estimatedCallPremium * 0.5);
        const bearCallWidth = strikeOffset;
        strategy.totalCost = "0";
        strategy.maxLoss = (bearCallWidth - bearCallCredit).toFixed(6);
        strategy.maxProfit = bearCallCredit.toFixed(6);
        strategy.lowerBreakeven = (atmStrike + bearCallCredit).toFixed(2);
        strategy.upperBreakeven = (atmStrike + bearCallWidth).toFixed(2);
        break;

      // Complex Strategies
      case "butterfly":
        const butterflyDebit = estimatedCallPremium * 0.25;
        strategy.totalCost = butterflyDebit.toFixed(6);
        strategy.maxLoss = butterflyDebit.toFixed(6);
        strategy.maxProfit = (strikeOffset - butterflyDebit).toFixed(6);
        strategy.lowerBreakeven = (atmStrike - (strikeOffset - butterflyDebit)).toFixed(2);
        strategy.upperBreakeven = (atmStrike + (strikeOffset - butterflyDebit)).toFixed(2);
        break;

      case "long-condor":
        const condorDebit = estimatedCallPremium * 0.15;
        const condorRange = strikeOffset * 1.5;
        strategy.totalCost = condorDebit.toFixed(6);
        strategy.maxLoss = condorDebit.toFixed(6);
        strategy.maxProfit = (strikeOffset - condorDebit).toFixed(6);
        strategy.lowerBreakeven = (atmStrike - condorRange + condorDebit).toFixed(2);
        strategy.upperBreakeven = (atmStrike + condorRange - condorDebit).toFixed(2);
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

      case "iron-butterfly":
        const ironButterflyCredit = estimatedCallPremium * 0.3 + estimatedPutPremium * 0.3;
        const ironButterflyWidth = strikeOffset;
        strategy.totalCost = "0";
        strategy.maxLoss = (ironButterflyWidth - ironButterflyCredit).toFixed(6);
        strategy.maxProfit = ironButterflyCredit.toFixed(6);
        strategy.lowerBreakeven = (atmStrike - ironButterflyCredit).toFixed(2);
        strategy.upperBreakeven = (atmStrike + ironButterflyCredit).toFixed(2);
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

  const handleExecuteStrategy = () => {
    if (!selectedStrategyId || !selectedExpiry) return;
    
    const strategy = buildSimpleStrategy(selectedStrategyId);
    if (!strategy) return;
    
    const atmStrike = Math.round(currentPrice / 100) * 100;
    const daysToExpiry = Math.ceil((new Date(selectedExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const timeFactor = Math.sqrt(daysToExpiry / 365);
    const estimatedCallPremium = currentPrice * 0.03 * timeFactor;
    const estimatedPutPremium = currentPrice * 0.03 * timeFactor;
    
    // Build legs array based on strategy type
    const legs: any[] = [];
    
    switch (selectedStrategyId) {
      case "long-call":
        legs.push({
          instrumentId: `${asset}-${atmStrike}-C-${selectedExpiry}`,
          instrumentName: `${asset} $${atmStrike} Call`,
          optionType: "call" as const,
          strike: atmStrike,
          expiry: selectedExpiry,
          side: "buy" as const,
          size: 1,
          estimatedPrice: estimatedCallPremium,
          greeks: { delta: 0.5, gamma: 0.05, theta: -0.02, vega: 0.1, iv: 0.6 }
        });
        break;
      
      case "long-put":
        legs.push({
          instrumentId: `${asset}-${atmStrike}-P-${selectedExpiry}`,
          instrumentName: `${asset} $${atmStrike} Put`,
          optionType: "put" as const,
          strike: atmStrike,
          expiry: selectedExpiry,
          side: "buy" as const,
          size: 1,
          estimatedPrice: estimatedPutPremium,
          greeks: { delta: -0.5, gamma: 0.05, theta: -0.02, vega: 0.1, iv: 0.6 }
        });
        break;
        
      // TODO: Add other strategy types with multiple legs
      default:
        break;
    }
    
    if (legs.length === 0) return;
    
    setConfirmationData({
      strategyName: strategy.name!,
      strategyType: selectedStrategyId,
      asset,
      underlyingPrice: currentPrice,
      legs,
      totalCost: parseFloat(strategy.totalCost || "0"),
      maxProfit: strategy.maxProfit ? parseFloat(strategy.maxProfit) : null,
      maxLoss: parseFloat(strategy.maxLoss || "0"),
      upperBreakeven: strategy.upperBreakeven ? parseFloat(strategy.upperBreakeven) : null,
      lowerBreakeven: strategy.lowerBreakeven ? parseFloat(strategy.lowerBreakeven) : null,
    });
    setShowConfirmation(true);
  };

  const filteredStrategies = SIMPLE_STRATEGIES.filter(s => s.sentiment === selectedSentiment);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 pb-3 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Strategy Builder
          </h3>
          
          <Tabs value={mode} onValueChange={(v) => onModeChange(v as "simple" | "pro")}>
            <TabsList className="h-8 bg-muted/30">
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
            {/* Selected Market Display */}
            {selectedMarket && (
              <div className="bg-card rounded-md p-3 border border-border/50" data-testid="selected-market-display">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-xs font-semibold text-foreground">Selected Market</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] h-5 ${selectedMarket.option_type === 'call' ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}
                  >
                    {selectedMarket.option_type?.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Strike:</span>
                    <div className="font-bold text-foreground">${selectedMarket.strike}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mark:</span>
                    <div className="font-bold text-foreground">${parseFloat(selectedMarket.mark_price).toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bid:</span>
                    <div className="font-semibold text-success">${selectedMarket.best_bid ? parseFloat(selectedMarket.best_bid).toFixed(2) : '-'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ask:</span>
                    <div className="font-semibold text-destructive">${selectedMarket.best_ask ? parseFloat(selectedMarket.best_ask).toFixed(2) : '-'}</div>
                  </div>
                  {selectedMarket.greeks?.delta && (
                    <div>
                      <span className="text-muted-foreground">Delta:</span>
                      <div className="font-semibold text-foreground">{parseFloat(selectedMarket.greeks.delta).toFixed(3)}</div>
                    </div>
                  )}
                  {selectedMarket.greeks?.iv && (
                    <div>
                      <span className="text-muted-foreground">IV:</span>
                      <div className="font-semibold text-foreground">{(parseFloat(selectedMarket.greeks.iv) * 100).toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                        : 'bg-background border-border/30'
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
                className="w-full h-1.5 bg-muted/30 rounded-lg appearance-none cursor-pointer slider"
                data-testid="slider-period"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1d</span>
                <span>90d</span>
              </div>
            </div>

            {/* Expiry Date Display */}
            {selectedExpiry && (
              <div className="bg-card rounded-md p-2 border border-border/30">
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
                          : 'bg-background border-border/30'
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
                            <div className="mt-2 pt-2 border-t border-border/20">
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
                <div className="bg-card rounded-md p-3 border border-border/50">
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
                    onClick={handleExecuteStrategy}
                    data-testid="button-execute-strategy"
                  >
                    Execute Strategy
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

            <div className="bg-card rounded-md p-3 border border-border/30">
              <p className="text-xs text-center text-muted-foreground italic">
                Pro mode leg construction coming in next iteration
              </p>
            </div>
          </>
        )}
      </div>
      
      {/* Order Confirmation Modal */}
      {confirmationData && (
        <OrderConfirmationModal
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          {...confirmationData}
        />
      )}
    </div>
  );
}
