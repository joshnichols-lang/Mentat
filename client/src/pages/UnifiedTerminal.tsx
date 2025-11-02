import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { openPolygonBridge, checkPolygonBalance, getBalanceMessage } from "@/lib/polygonBridge";
import { SymbolProvider } from "@/contexts/SymbolContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import Header from "@/components/Header";
import AIPromptPanel from "@/components/AIPromptPanel";
import ConversationHistory from "@/components/ConversationHistory";
import PositionsGrid from "@/components/PositionsGrid";
import { AIUsageTracker } from "@/components/AIUsageTracker";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { PortfolioAreaChart } from "@/components/PortfolioAreaChart";
import { MarginUsageBar } from "@/components/MarginUsageBar";
import { SharpeGauge } from "@/components/SharpeGauge";
import { TradeDistributionDonut } from "@/components/TradeDistributionDonut";
import { CumulativeReturnsChart } from "@/components/CumulativeReturnsChart";
import { DrawdownChart } from "@/components/DrawdownChart";
import { PositionROEChart } from "@/components/PositionROEChart";
import TradingChart from "@/components/TradingChart";
import OptionsChart from "@/components/OptionsChart";
import OptionsStrategyBuilder from "@/components/OptionsStrategyBuilder";
import OrderBook from "@/components/OrderBook";
import RecentTrades from "@/components/RecentTrades";
import OrderEntryPanel from "@/components/OrderEntryPanel";
import OrderManagementPanel from "@/components/OrderManagementPanel";
import MarketSelector from "@/components/MarketSelector";
import GridDashboard from "@/components/GridDashboard";
import Widget from "@/components/Widget";
import LiveGreeks from "@/components/LiveGreeks";
import AssetSelector from "@/components/AssetSelector";
import OptionsChain from "@/components/OptionsChain";
import { 
  Flame,
  Vote,
  Sparkles,
  BarChart3,
  TrendingUp, 
  LineChart,
  Settings,
  Maximize2,
  Minimize2,
  Layers,
} from "lucide-react";

// Perpetuals Trading Interface Component
function PerpetualsInterface() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");

  // Default grid layouts for perpetuals panels
  const defaultLayouts = [
    { i: "chart", x: 0, y: 0, w: 8, h: 14 },
    { i: "orderEntry", x: 0, y: 14, w: 8, h: 8 },
    { i: "orderBook", x: 8, y: 0, w: 4, h: 11 },
    { i: "recentTrades", x: 8, y: 11, w: 4, h: 11 },
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Perpetuals Toolbar */}
      <div className="glass border-b border-glass/20 p-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Perpetuals Trading</h3>
          <MarketSelector
            selectedSymbol={selectedSymbol}
            onSymbolChange={setSelectedSymbol}
          />
          <Badge 
            variant="outline" 
            className="bg-long/10 text-long border-long/30"
            data-testid="badge-price-change"
          >
            +2.4%
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            data-testid="button-chart-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid Dashboard with Draggable Widgets */}
      <GridDashboard
        tab="perpetuals"
        defaultLayouts={defaultLayouts}
        cols={12}
        rowHeight={30}
        width={1400}
      >
        <div key="chart">
          <Widget id="chart" title="Trading Chart">
            <TradingChart 
              symbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
            />
          </Widget>
        </div>

        <div key="orderEntry">
          <Widget id="orderEntry" title="Order Entry">
            <OrderEntryPanel symbol={selectedSymbol} />
          </Widget>
        </div>

        <div key="orderBook">
          <Widget id="orderBook" title="Order Book">
            <OrderBook symbol={selectedSymbol} />
          </Widget>
        </div>

        <div key="recentTrades">
          <Widget id="recentTrades" title="Recent Trades">
            <RecentTrades symbol={selectedSymbol} />
          </Widget>
        </div>
      </GridDashboard>
    </div>
  );
}

// Polymarket Trading Modal Component
function PolymarketTradingModal({ event, onClose }: { event: any; onClose: () => void }) {
  const [selectedOutcome, setSelectedOutcome] = useState<"Yes" | "No">("Yes");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const { toast } = useToast();

  // Fetch wallet balances for balance checking
  const { data: balancesData } = useQuery<{ success: boolean; balances: any }>({
    queryKey: ['/api/wallets/balances'],
    refetchInterval: 10000,
  });

  // Fetch embedded wallet for bridge widget
  const { data: embeddedWallet } = useQuery<{ polygonAddress: string }>({
    queryKey: ['/api/wallets/embedded'],
  });

  // Get prices from outcomePrices array [YES, NO]
  const outcomePrices = event.outcomePrices || ["0", "0"];
  const clobTokenIds = event.clobTokenIds || [];
  const yesPrice = parseFloat(outcomePrices[0] || "0");
  const noPrice = parseFloat(outcomePrices[1] || "0");
  const yesTokenId = clobTokenIds[0];
  const noTokenId = clobTokenIds[1];
  
  const selectedTokenId = selectedOutcome === "Yes" ? yesTokenId : noTokenId;
  const currentPrice = selectedOutcome === "Yes" ? yesPrice : noPrice;

  // Order placement mutation
  const placeMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await fetch('/api/polymarket/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to place order');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Placed",
        description: `${selectedOutcome} order placed successfully`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePlaceOrder = () => {
    if (!selectedTokenId) {
      toast({
        title: "Invalid Market",
        description: "Market data unavailable. Please try another market.",
        variant: "destructive",
      });
      return;
    }

    if (!size || parseFloat(size) <= 0) {
      toast({
        title: "Invalid Size",
        description: "Please enter a valid order size",
        variant: "destructive",
      });
      return;
    }

    if (orderType === "limit" && (!price || parseFloat(price) <= 0 || parseFloat(price) > 1)) {
      toast({
        title: "Invalid Price",
        description: "Price must be between 0 and 1",
        variant: "destructive",
      });
      return;
    }

    // Check Polygon balance before placing order
    const orderPrice = orderType === "limit" ? parseFloat(price) : currentPrice;
    const requiredUsdc = parseFloat(size) * orderPrice;
    
    if (balancesData?.balances?.polygon) {
      const polygon = balancesData.balances.polygon;
      const balanceCheck = checkPolygonBalance(requiredUsdc, polygon.usdc, polygon.matic);
      
      if (!balanceCheck.sufficient) {
        // Insufficient balance - offer to bridge
        const message = getBalanceMessage(balanceCheck);
        
        // Prioritize MATIC (gas) if needed, otherwise bridge USDC
        const needsMaticBridge = balanceCheck.needsMatic;
        const bridgeAsset: "MATIC" | "USDC" = needsMaticBridge ? "MATIC" : "USDC";
        const bridgeAmount = needsMaticBridge 
          ? balanceCheck.minimumMaticForGas 
          : balanceCheck.requiredUsdcAmount;
        
        const bridgeAssetLabel = needsMaticBridge ? "MATIC for gas fees" : "USDC";
        
        toast({
          title: "Insufficient Balance",
          description: `${message}. Opening bridge to add ${bridgeAssetLabel} to Polygon.`,
          variant: "destructive",
        });
        
        // Open Router Nitro bridge widget for Polygon with correct asset
        if (embeddedWallet?.polygonAddress) {
          const popup = openPolygonBridge({
            destinationAddress: embeddedWallet.polygonAddress,
            asset: bridgeAsset,
            minimumAmount: bridgeAmount,
          });
          
          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            toast({
              title: "Popup Blocked",
              description: "Please allow popups and click Place Order again to bridge funds",
              variant: "destructive",
            });
          } else {
            const instructions = balanceCheck.needsMatic && balanceCheck.needsUsdc
              ? `Bridge ${bridgeAmount.toFixed(4)} MATIC for gas first, then click Place Order again to bridge ${balanceCheck.requiredUsdcAmount.toFixed(2)} USDC.`
              : `Bridge ${bridgeAmount.toFixed(needsMaticBridge ? 4 : 2)} ${bridgeAssetLabel} to complete your trade. Balances refresh every 10 seconds.`;
            
            toast({
              title: "Bridge Opened",
              description: instructions,
              duration: 10000,
            });
          }
        }
        return;
      }
    }

    // Balance sufficient - place order
    placeMutation.mutate({
      eventId: event.conditionId,
      outcome: selectedOutcome,
      tokenId: selectedTokenId,
      side: "BUY",
      orderType,
      price: orderPrice,
      size: parseFloat(size),
      tickSize: "0.01",
      negRisk: false,
    });
  };

  const estimatedCost = parseFloat(size || "0") * (orderType === "limit" ? parseFloat(price || "0") : currentPrice);
  const potentialProfit = parseFloat(size || "0") - estimatedCost;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      data-testid="modal-polymarket-trading"
    >
      <Card
        className="glass-strong border-glass/20 max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="border-b border-glass/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-base mb-2">{event.question}</CardTitle>
              {event.category && (
                <Badge variant="outline" className="text-xs capitalize">
                  {event.category}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-trading-modal"
            >
              <Settings className="h-4 w-4 rotate-45" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Outcome Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Outcome</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={selectedOutcome === "Yes" ? "default" : "outline"}
                className={selectedOutcome === "Yes" ? "bg-long hover:bg-long/90 border-long" : ""}
                onClick={() => setSelectedOutcome("Yes")}
                data-testid="button-outcome-yes"
              >
                <div className="text-center w-full">
                  <div className="font-semibold">YES</div>
                  <div className="text-xs opacity-80">{(yesPrice * 100).toFixed(1)}% ({(yesPrice * 100).toFixed(1)}¢)</div>
                </div>
              </Button>
              <Button
                variant={selectedOutcome === "No" ? "default" : "outline"}
                className={selectedOutcome === "No" ? "bg-short hover:bg-short/90 border-short" : ""}
                onClick={() => setSelectedOutcome("No")}
                data-testid="button-outcome-no"
              >
                <div className="text-center w-full">
                  <div className="font-semibold">NO</div>
                  <div className="text-xs opacity-80">{(noPrice * 100).toFixed(1)}% ({(noPrice * 100).toFixed(1)}¢)</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Order Type Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Order Type</label>
            <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="market" data-testid="tab-market-order">Market</TabsTrigger>
                <TabsTrigger value="limit" data-testid="tab-limit-order">Limit</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Size Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Size (shares)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="Enter number of shares"
              className="w-full px-3 py-2 bg-glass/50 border border-glass/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              data-testid="input-order-size"
            />
          </div>

          {/* Limit Price Input */}
          {orderType === "limit" && (
            <div>
              <label className="text-sm font-medium mb-2 block">Limit Price (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter price (e.g., 0.65)"
                className="w-full px-3 py-2 bg-glass/50 border border-glass/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                data-testid="input-limit-price"
              />
            </div>
          )}

          {/* Order Summary */}
          <div className="glass rounded-lg p-4 space-y-2 border border-glass/20">
            <h3 className="text-sm font-semibold mb-3">Order Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/70">Estimated Cost</span>
              <span className="font-medium">${estimatedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/70">Potential Profit</span>
              <span className={`font-medium ${potentialProfit > 0 ? 'text-long' : ''}`}>
                ${potentialProfit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/70">Potential Return</span>
              <span className="font-medium">
                {estimatedCost > 0 ? `${((potentialProfit / estimatedCost) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              data-testid="button-cancel-order"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handlePlaceOrder}
              disabled={placeMutation.isPending}
              data-testid="button-place-order"
            >
              {placeMutation.isPending ? "Placing..." : `Place ${selectedOutcome} Order`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Prediction Markets Interface
function PredictionMarketsInterface() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Trending");
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Fetch Polymarket markets (500 markets to include short-term predictions)
  const { data: marketsData, isLoading } = useQuery<{ success: boolean; markets: any[] }>({
    queryKey: ['/api/polymarket/markets?limit=500&active=true'],
  });

  const markets = marketsData?.markets || [];

  // Main category tabs (Polymarket style)
  const mainCategories = [
    "Trending",
    "Politics", 
    "Sports",
    "Finance",
    "Crypto",
    "Culture",
    "World",
    "Elections"
  ];

  // Category keyword mapping for flexible filtering (MUST be before getFilterTags)
  const getCategoryKeywords = (category: string): string[] => {
    const keywords: { [key: string]: string[] } = {
      "Trending": [],
      "Politics": ["congress", "senate", "house", "government", "biden", "republican", "democrat", "political", "policy", "governor", "mayor", "administration"],
      "Sports": ["nfl", "nba", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "hockey", "world series", "super bowl", "championship", "playoffs", "athlete", "player"],
      "Finance": ["fed", "federal reserve", "interest rate", "stock market", "dow", "s&p", "nasdaq", "inflation", "gdp", "recession", "treasury", "bonds"],
      "Crypto": ["bitcoin", "btc", "ethereum", "eth", "crypto", "cryptocurrency", "blockchain", "solana", "sol", "defi", "nft", "web3", "token", "15 min", "hourly", "4 hour", "daily", "weekly", "monthly", "price will", "hit", "above", "below", "minute"],
      "Culture": ["celebrity", "entertainment", "movie", "film", "music", "artist", "award", "oscar", "grammy", "emmy", "actor", "actress"],
      "World": ["international", "global", "ukraine", "china", "russia", "europe", "middle east", "war", "conflict", "united nations"],
      "Elections": ["election", "vote", "ballot", "candidate", "primary", "presidential", "2024", "2025", "campaign", "trump", "governor race"]
    };
    return keywords[category] || [];
  };

  // Dynamic filter tags extracted from markets' eventTags based on selected category
  const getFilterTags = () => {
    // First filter markets by main category
    const categoryFilteredMarkets = markets.filter((market: any) => {
      if (selectedCategory === "Trending") return true;
      
      const categoryKeywords = getCategoryKeywords(selectedCategory);
      const question = market.question?.toLowerCase() || "";
      const tags = (market.tags || []).map((t: string) => t.toLowerCase()).join(" ");
      const eventTags = (market.eventTags || []).map((t: any) => t.label?.toLowerCase() || "").join(" ");
      const category = market.category?.toLowerCase() || "";
      const searchText = `${question} ${tags} ${eventTags} ${category}`;
      
      return categoryKeywords.some(keyword => searchText.includes(keyword));
    });
    
    // Extract unique tags from filtered markets
    const tagCounts = new Map<string, number>();
    categoryFilteredMarkets.forEach((market: any) => {
      const eventTags = market.eventTags || [];
      eventTags.forEach((tag: any) => {
        const label = tag.label || tag;
        if (label) {
          tagCounts.set(label, (tagCounts.get(label) || 0) + 1);
        }
      });
    });
    
    // Sort tags by frequency and take top ones
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
    
    return ["All", ...topTags];
  };

  const filterTags = getFilterTags();

  // Apply search/category filters
  let filteredMarkets = markets.filter((market: any) => {
    const matchesSearch = searchQuery === "" || market.question?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category matching using keyword matching
    let matchesCategory = true;
    if (selectedCategory !== "Trending") {
      const categoryKeywords = getCategoryKeywords(selectedCategory);
      const question = market.question?.toLowerCase() || "";
      const tags = (market.tags || []).map((t: string) => t.toLowerCase()).join(" ");
      const category = market.category?.toLowerCase() || "";
      const searchText = `${question} ${tags} ${category}`;
      
      matchesCategory = categoryKeywords.some(keyword => searchText.includes(keyword));
    }
    
    // Subcategory tag matching
    let matchesFilter = selectedFilter === "All";
    if (!matchesFilter) {
      const question = market.question?.toLowerCase() || "";
      const tags = (market.tags || []).map((t: string) => t.toLowerCase()).join(" ");
      const eventTags = (market.eventTags || []).map((t: any) => {
        const label = t.label || t;
        return typeof label === 'string' ? label.toLowerCase() : '';
      }).join(" ");
      const searchText = `${question} ${tags} ${eventTags}`;
      matchesFilter = searchText.includes(selectedFilter.toLowerCase());
    }
    
    return matchesSearch && matchesCategory && matchesFilter;
  });

  // Sort by volume for Trending tab
  if (selectedCategory === "Trending") {
    filteredMarkets = [...filteredMarkets].sort((a, b) => {
      const volumeA = parseFloat(a.volume || "0");
      const volumeB = parseFloat(b.volume || "0");
      return volumeB - volumeA;
    });
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header with Category Tabs */}
      <div className="glass-header border-b border-glass/20">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-glass/10">
          <Vote className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Prediction Markets</h2>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {filteredMarkets.length}
          </Badge>
        </div>

        {/* Main Category Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
          {mainCategories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedFilter("All");
              }}
              className={selectedCategory === cat ? "" : "text-foreground/70 hover:text-foreground"}
              data-testid={`button-category-${cat.toLowerCase()}`}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Quick Filter Tags */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-glass/10">
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-sm bg-glass/30 border border-glass/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
            data-testid="input-search-markets"
          />
          <div className="flex gap-1.5 flex-wrap">
            {filterTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedFilter === tag ? "default" : "outline"}
                className={`cursor-pointer hover-elevate active-elevate-2 ${
                  selectedFilter === tag ? "" : "bg-glass/20 text-foreground/70 hover:text-foreground"
                }`}
                onClick={() => setSelectedFilter(tag)}
                data-testid={`badge-filter-${tag.toLowerCase()}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Markets Grid */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-start justify-center pt-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-foreground/70">Loading markets...</p>
            </div>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="flex items-start justify-center pt-20">
            <Card className="glass-strong border-glass/20 p-6 max-w-md">
              <p className="text-center text-foreground/70">No markets found matching your criteria</p>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {filteredMarkets.map((market: any) => {
              const outcomePrices = market.outcomePrices || ["0", "0"];
              const yesPrice = parseFloat(outcomePrices[0] || "0");
              const noPrice = parseFloat(outcomePrices[1] || "0");
              const volume = market.volume ? parseFloat(market.volume) : 0;

              return (
                <Card
                  key={market.conditionId}
                  className="glass border-glass/30 hover-elevate active-elevate-2 cursor-pointer transition-all duration-300"
                  onClick={() => setSelectedEvent(market)}
                  data-testid={`card-market-${market.conditionId}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-medium line-clamp-3 min-h-[3.5rem] leading-snug">
                      {market.question}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className="text-xs text-foreground/60 font-medium">YES</div>
                        <div className="text-2xl font-bold text-long">
                          {(yesPrice * 100).toFixed(0)}%
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-long/40 text-long hover:bg-long/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(market);
                          }}
                          data-testid={`button-yes-${market.conditionId}`}
                        >
                          Yes
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs text-foreground/60 font-medium">NO</div>
                        <div className="text-2xl font-bold text-short">
                          {(noPrice * 100).toFixed(0)}%
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-short/40 text-short hover:bg-short/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(market);
                          }}
                          data-testid={`button-no-${market.conditionId}`}
                        >
                          No
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-glass/20 text-xs text-foreground/50">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {volume >= 1000000 
                          ? `$${(volume / 1000000).toFixed(1)}M` 
                          : volume >= 1000 
                          ? `$${(volume / 1000).toFixed(0)}k`
                          : `$${volume.toFixed(0)}`
                        }
                      </span>
                      {market.endDate && (
                        <span>{new Date(market.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Trading Modal */}
      {selectedEvent && <PolymarketTradingModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}

// Options Trading Interface Component
function OptionsInterface() {
  const [selectedAsset, setSelectedAsset] = useState("ETH");
  const [mode, setMode] = useState<"simple" | "pro">("simple");
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [currentPrice, setCurrentPrice] = useState(4000);

  // Default grid layouts for options panels
  const defaultLayouts = [
    { i: "chart", x: 0, y: 0, w: 8, h: 14 },
    { i: "strategy", x: 0, y: 14, w: 8, h: 10 },
    { i: "optionsChain", x: 8, y: 0, w: 4, h: 11 },
    { i: "greeks", x: 8, y: 11, w: 4, h: 7 },
    { i: "positions", x: 8, y: 18, w: 4, h: 6 },
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Options Toolbar */}
      <div className="glass border-b border-glass/20 p-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Options Trading</h3>
          <AssetSelector
            selectedAsset={selectedAsset}
            onAssetChange={setSelectedAsset}
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge 
            variant={mode === "simple" ? "default" : "outline"}
            className="cursor-pointer hover-elevate active-elevate-2"
            onClick={() => setMode("simple")}
            data-testid="badge-mode-simple"
          >
            Simple
          </Badge>
          <Badge 
            variant={mode === "pro" ? "default" : "outline"}
            className="cursor-pointer hover-elevate active-elevate-2"
            onClick={() => setMode("pro")}
            data-testid="badge-mode-pro"
          >
            Pro
          </Badge>
        </div>
      </div>

      {/* Grid Dashboard with Draggable Widgets */}
      <GridDashboard
        tab="options"
        defaultLayouts={defaultLayouts}
        cols={12}
        rowHeight={30}
        width={1400}
      >
        <div key="chart">
          <Widget id="chart" title="Options Chart">
            <OptionsChart 
              asset={selectedAsset}
              selectedStrategy={selectedStrategy}
              onPriceUpdate={setCurrentPrice}
            />
          </Widget>
        </div>

        <div key="strategy">
          <Widget id="strategy" title="Strategy Builder">
            <OptionsStrategyBuilder 
              asset={selectedAsset}
              currentPrice={currentPrice}
              mode={mode}
              onModeChange={setMode}
              onStrategySelect={setSelectedStrategy}
            />
          </Widget>
        </div>

        <div key="optionsChain">
          <Widget id="optionsChain" title="Options Chain">
            <OptionsChain 
              asset={selectedAsset}
              currentPrice={currentPrice}
            />
          </Widget>
        </div>

        <div key="greeks">
          <Widget id="greeks" title="Live Greeks">
            <LiveGreeks 
              asset={selectedAsset}
              instrumentName={selectedStrategy?.instrumentName}
            />
          </Widget>
        </div>

        <div key="positions">
          <Widget id="positions" title="Options Positions">
            <div className="space-y-2 text-sm text-foreground/70">
              <p>Live positions with:</p>
              <ul className="space-y-1 text-xs ml-4">
                <li>• P&L tracking</li>
                <li>• Greeks by position</li>
                <li>• Days to expiry</li>
                <li>• Breakeven prices</li>
                <li>• Quick close buttons</li>
              </ul>
              <div className="text-xs text-foreground/50 mt-3">
                📋 Task 10: OptionsPositionsGrid.tsx
              </div>
            </div>
          </Widget>
        </div>
      </GridDashboard>
    </div>
  );
}

// Spot Discovery Interface Placeholder
function SpotDiscoveryInterface() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="glass-strong border-glass/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Spot Discovery - Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground/70">
              Discover and trade spot markets across multiple exchanges with AI-powered insights.
            </p>
            <div className="mt-4 p-4 glass rounded-lg border border-glass/20">
              <h3 className="font-semibold mb-2">Features:</h3>
              <ul className="space-y-1 text-sm text-foreground/70">
                <li>• Multi-exchange spot market aggregation</li>
                <li>• AI trend discovery and analysis</li>
                <li>• Smart order routing</li>
                <li>• Market sentiment indicators</li>
                <li>• Portfolio optimization suggestions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Analytics Dashboard Interface
function AnalyticsInterface() {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | 'ALL'>('1W');

  // Fetch comprehensive portfolio data
  const { data: comprehensivePortfolio } = useQuery<any>({
    queryKey: ['/api/portfolio/comprehensive'],
    refetchInterval: 30000,
  });

  const { data: snapshots } = useQuery<any>({
    queryKey: ['/api/portfolio/snapshots'],
    refetchInterval: 30000,
  });

  const { data: multiExchangePositions } = useQuery<any>({
    queryKey: ["/api/multi-exchange/positions"],
    refetchInterval: 30000,
  });

  // Extract data
  const accountValue = comprehensivePortfolio?.totalCapital || 0;
  const marginUsed = comprehensivePortfolio?.totalMarginUsed || 0;
  
  const allSnapshots = snapshots?.snapshots || [];
  const latestSnapshot = allSnapshots.length > 0 ? allSnapshots[allSnapshots.length - 1] : null;
  const sharpeRatio = latestSnapshot ? Number(latestSnapshot.sharpeRatio || 0) : 0;

  // Transform portfolio snapshots for charts
  const portfolioChartData = useMemo(() => {
    if (!allSnapshots.length) return [];
    return allSnapshots.map((snap: any) => ({
      timestamp: new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: snap.totalValue
    }));
  }, [allSnapshots]);

  // Calculate cumulative returns vs benchmark
  const cumulativeReturnsData = useMemo(() => {
    if (!allSnapshots.length) return [];
    const initialValue = allSnapshots[0].totalValue;
    return allSnapshots.map((snap: any, i: number) => ({
      date: new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      portfolio: ((snap.totalValue - initialValue) / initialValue) * 100,
      benchmark: i * 0.3
    }));
  }, [allSnapshots]);

  // Calculate drawdown data
  const drawdownData = useMemo(() => {
    if (!allSnapshots.length) return [];
    let peak = allSnapshots[0].totalValue;
    return allSnapshots.map((snap: any) => {
      peak = Math.max(peak, snap.totalValue);
      const drawdown = ((snap.totalValue - peak) / peak) * 100;
      return {
        date: new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        drawdown
      };
    });
  }, [allSnapshots]);

  // Transform multi-exchange positions for ROE chart
  const positionROEData = useMemo(() => {
    const positions = multiExchangePositions?.positions || [];
    return positions.map((pos: any) => ({
      symbol: pos.symbol,
      roe: (parseFloat(pos.roe || '0')) * 100,
      position: `${pos.side.toUpperCase()} ${pos.leverage || 1}x`
    }));
  }, [multiExchangePositions]);

  const wins = 95;
  const losses = 42;
  const breakeven = 5;

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Unified Portfolio Overview */}
      <PortfolioOverview />

      {/* Portfolio Performance Chart */}
      {portfolioChartData.length > 0 && (
        <PortfolioAreaChart 
          data={portfolioChartData}
          timeframe={timeframe}
          onTimeframeChange={(tf) => setTimeframe(tf as any)}
        />
      )}

      {/* Cumulative Returns vs Benchmark */}
      {cumulativeReturnsData.length > 0 && (
        <CumulativeReturnsChart data={cumulativeReturnsData} />
      )}

      {/* Drawdown Chart */}
      {drawdownData.length > 0 && (
        <DrawdownChart data={drawdownData} />
      )}

      {/* Sharpe Ratio Gauge */}
      <SharpeGauge value={sharpeRatio} />

      {/* Margin Usage Progress Bar */}
      {accountValue > 0 && (
        <MarginUsageBar
          used={marginUsed}
          total={accountValue}
          warningThreshold={70}
          dangerThreshold={85}
        />
      )}

      {/* Trade Distribution */}
      <TradeDistributionDonut wins={wins} losses={losses} breakeven={breakeven} />

      {/* Position ROE Chart */}
      {positionROEData.length > 0 && (
        <div className="glass border border-glass/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <LineChart className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Position ROE Comparison</h3>
          </div>
          <PositionROEChart data={positionROEData} />
        </div>
      )}
    </div>
  );
}

// Main Unified Terminal
export default function UnifiedTerminal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("perpetuals");

  return (
    <SymbolProvider>
      <div className="min-h-screen">
        <Header />
        
        <main className="h-[calc(100vh-3.5rem)]">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            
            {/* Main Content Area with Tabs */}
            <ResizablePanel defaultSize={70} minSize={50}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                {/* Tab Navigation Header */}
                <div className="glass-header border-b border-glass/20 px-4 py-2">
                  <TabsList className="grid w-full max-w-3xl grid-cols-5 bg-glass/50">
                    <TabsTrigger 
                      value="perpetuals" 
                      className="flex items-center gap-2"
                      data-testid="tab-perpetuals"
                    >
                      <Flame className="h-4 w-4" />
                      Perpetuals
                    </TabsTrigger>
                    <TabsTrigger 
                      value="prediction" 
                      className="flex items-center gap-2"
                      data-testid="tab-prediction-markets"
                    >
                      <Vote className="h-4 w-4" />
                      Prediction Markets
                    </TabsTrigger>
                    <TabsTrigger 
                      value="options" 
                      className="flex items-center gap-2"
                      data-testid="tab-options"
                    >
                      <Layers className="h-4 w-4" />
                      Options
                    </TabsTrigger>
                    <TabsTrigger 
                      value="spot" 
                      className="flex items-center gap-2"
                      data-testid="tab-spot-discovery"
                    >
                      <Sparkles className="h-4 w-4" />
                      Spot Discovery
                    </TabsTrigger>
                    <TabsTrigger 
                      value="analytics" 
                      className="flex items-center gap-2"
                      data-testid="tab-analytics"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab Content */}
                <TabsContent value="perpetuals" className="m-0 flex-1 flex flex-col">
                  <PerpetualsInterface />
                </TabsContent>

                <TabsContent value="prediction" className="m-0 flex-1 flex flex-col">
                  <PredictionMarketsInterface />
                </TabsContent>

                <TabsContent value="options" className="m-0 flex-1 flex flex-col">
                  <OptionsInterface />
                </TabsContent>

                <TabsContent value="spot" className="m-0 flex-1 flex flex-col">
                  <SpotDiscoveryInterface />
                </TabsContent>

                <TabsContent value="analytics" className="m-0 flex-1 flex flex-col">
                  <AnalyticsInterface />
                </TabsContent>
              </Tabs>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel - AI Chat & Positions */}
            <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
              <div className="h-full flex flex-col">
                
                {/* AI Prompt Panel */}
                <div className="p-4 border-b">
                  <AIPromptPanel />
                </div>

                {/* Conversation History */}
                <div className="flex-1 overflow-auto p-4">
                  <ConversationHistory />
                </div>

                {/* Positions & Activity */}
                <div className="p-4 border-t space-y-4 overflow-auto max-h-[40vh]">
                  <PositionsGrid />
                  <AIUsageTracker />
                </div>

              </div>
            </ResizablePanel>

          </ResizablePanelGroup>
        </main>
      </div>
    </SymbolProvider>
  );
}
