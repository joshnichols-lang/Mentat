import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { openPolygonBridge, checkPolygonBalance, getBalanceMessage } from "@/lib/polygonBridge";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import TradingChart from "@/components/TradingChart";
import OrderBook from "@/components/OrderBook";
import RecentTrades from "@/components/RecentTrades";
import OrderEntryPanel from "@/components/OrderEntryPanel";
import OrderManagementPanel from "@/components/OrderManagementPanel";
import MarketSelector from "@/components/MarketSelector";
import { 
  LineChart, 
  TrendingUp, 
  Settings,
  Maximize2,
  Minimize2,
  ListOrdered,
  Flame,
  Vote,
  Sparkles,
} from "lucide-react";

// Perpetuals Trading Interface Component
function PerpetualsInterface() {
  const [orderPanelCollapsed, setOrderPanelCollapsed] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");

  return (
    <div className="flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Chart Area with Vertical Resizing */}
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="h-full flex flex-col">
            {/* Chart Toolbar */}
            <div className="glass border-b border-glass/20 p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setOrderPanelCollapsed(!orderPanelCollapsed)}
                  data-testid="button-toggle-order-panel"
                >
                  {orderPanelCollapsed ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Vertical Resizable Group: Chart + Order Entry */}
            <ResizablePanelGroup direction="vertical" className="flex-1">
              {/* Chart Panel */}
              <ResizablePanel defaultSize={orderPanelCollapsed ? 100 : 70} minSize={30}>
                <div className="h-full relative">
                  <TradingChart 
                    symbol={selectedSymbol}
                    onSymbolChange={setSelectedSymbol}
                  />
                </div>
              </ResizablePanel>

              {/* Order Entry Panel (Resizable) */}
              {!orderPanelCollapsed && (
                <>
                  <ResizableHandle withHandle className="bg-glass-border/30" />
                  <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
                    <div className="h-full border-t border-glass/20 overflow-auto glass-fade-in">
                      <OrderEntryPanel symbol={selectedSymbol} />
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-glass-border/30" />

        {/* Right Sidebar: Order Book + Recent Trades */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <div className="h-full flex flex-col glass">
            <Tabs defaultValue="orderbook" className="flex-1 flex flex-col">
              <TabsList className="m-2 grid grid-cols-3">
                <TabsTrigger value="orderbook" data-testid="tab-orderbook">Book</TabsTrigger>
                <TabsTrigger value="trades" data-testid="tab-recent-trades">Trades</TabsTrigger>
                <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
              </TabsList>

              <TabsContent value="orderbook" className="flex-1 m-2 mt-0 overflow-hidden">
                <Card className="glass-strong border-glass/20 h-full overflow-hidden flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Order Book
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 overflow-hidden">
                    <OrderBook symbol={selectedSymbol} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trades" className="flex-1 m-2 mt-0 overflow-hidden">
                <Card className="glass-strong border-glass/20 h-full overflow-hidden flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-primary" />
                      Recent Trades
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 overflow-hidden">
                    <RecentTrades symbol={selectedSymbol} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="orders" className="flex-1 m-2 mt-0 overflow-auto">
                <OrderManagementPanel />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
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
    refetchInterval: 10000, // Refetch every 10s to catch balance updates after bridging
  });

  // Fetch embedded wallet for bridge widget
  const { data: embeddedWallet } = useQuery<{ polygonAddress: string }>({
    queryKey: ['/api/wallets/embedded'],
  });

  const yesToken = event.tokens?.find((t: any) => t.outcome === "Yes");
  const noToken = event.tokens?.find((t: any) => t.outcome === "No");
  const selectedToken = selectedOutcome === "Yes" ? yesToken : noToken;
  const currentPrice = selectedToken ? parseFloat(selectedToken.price) : 0;

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
    if (!selectedToken || !selectedToken.tokenId) {
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
              duration: 10000, // Show longer for multi-step instructions
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
      tokenId: selectedToken.tokenId,
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
                  <div className="text-xs opacity-80">{(parseFloat(yesToken?.price || "0") * 100).toFixed(1)}% ({(parseFloat(yesToken?.price || "0") * 100).toFixed(1)}¢)</div>
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
                  <div className="text-xs opacity-80">{(parseFloat(noToken?.price || "0") * 100).toFixed(1)}% ({(parseFloat(noToken?.price || "0") * 100).toFixed(1)}¢)</div>
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

  // Fetch Polymarket markets
  const { data: marketsData, isLoading } = useQuery<{ success: boolean; markets: any[] }>({
    queryKey: ['/api/polymarket/markets?limit=100&active=true'],
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

  // Dynamic filter tags based on selected category and markets
  const getFilterTags = () => {
    if (selectedCategory === "Trending") {
      return ["All", "Trump", "Elections", "Sports"];
    }
    if (selectedCategory === "Politics") {
      return ["All", "Trump", "Gov Shutdown", "NYC Mayor"];
    }
    if (selectedCategory === "Sports") {
      return ["All", "World Series", "NFL", "NBA"];
    }
    if (selectedCategory === "Finance") {
      return ["All", "Fed", "Crypto", "Stocks"];
    }
    if (selectedCategory === "Crypto") {
      return ["All", "Bitcoin", "Ethereum", "Solana"];
    }
    return ["All"];
  };

  const filterTags = getFilterTags();

  // Category keyword mapping for flexible filtering
  const getCategoryKeywords = (category: string): string[] => {
    const keywords: { [key: string]: string[] } = {
      "Trending": [], // Show all
      "Politics": ["congress", "senate", "house", "government", "biden", "republican", "democrat", "political", "policy", "governor", "mayor", "administration"],
      "Sports": ["nfl", "nba", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "hockey", "world series", "super bowl", "championship", "playoffs", "athlete", "player"],
      "Finance": ["fed", "federal reserve", "interest rate", "stock market", "dow", "s&p", "nasdaq", "inflation", "gdp", "recession", "treasury", "bonds"],
      "Crypto": ["bitcoin", "btc", "ethereum", "eth", "crypto", "cryptocurrency", "blockchain", "solana", "sol", "defi", "nft", "web3", "token"],
      "Culture": ["celebrity", "entertainment", "movie", "film", "music", "artist", "award", "oscar", "grammy", "emmy", "actor", "actress"],
      "World": ["international", "global", "ukraine", "china", "russia", "europe", "middle east", "war", "conflict", "united nations"],
      "Elections": ["election", "vote", "ballot", "candidate", "primary", "presidential", "2024", "2025", "campaign", "trump", "governor race"]
    };
    return keywords[category] || [];
  };

  // Filter markets by search, category, and filter tag
  const filteredMarkets = markets.filter((market: any) => {
    const matchesSearch = market.question?.toLowerCase().includes(searchQuery.toLowerCase());
    
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
    
    // Filter tag matching
    let matchesFilter = selectedFilter === "All";
    if (!matchesFilter) {
      const question = market.question?.toLowerCase() || "";
      const tags = (market.tags || []).map((t: string) => t.toLowerCase()).join(" ");
      const searchText = `${question} ${tags}`;
      matchesFilter = searchText.includes(selectedFilter.toLowerCase());
    }
    
    return matchesSearch && matchesCategory && matchesFilter && market.active && !market.closed;
  });

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
              const yesToken = market.tokens?.find((t: any) => t.outcome === "Yes");
              const noToken = market.tokens?.find((t: any) => t.outcome === "No");
              const yesPrice = yesToken ? parseFloat(yesToken.price) : 0;
              const noPrice = noToken ? parseFloat(noToken.price) : 0;
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

// Main Trading Terminal with Market Type Tabs
export default function TradingTerminal() {
  const [activeMarketType, setActiveMarketType] = useState("perpetuals");

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      {/* Market Type Navigation Tabs */}
      <Tabs value={activeMarketType} onValueChange={setActiveMarketType} className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Header */}
        <div className="glass-header border-b border-glass/20 px-4 py-2">
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-glass/50">
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
              value="spot" 
              className="flex items-center gap-2"
              data-testid="tab-spot-discovery"
            >
              <Sparkles className="h-4 w-4" />
              Spot Discovery
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Perpetuals Tab Content */}
        <TabsContent value="perpetuals" className="m-0 flex-1 flex flex-col">
          <PerpetualsInterface />
        </TabsContent>

        {/* Prediction Markets Tab Content */}
        <TabsContent value="prediction" className="m-0 flex-1 flex flex-col">
          <PredictionMarketsInterface />
        </TabsContent>

        {/* Spot Discovery Tab Content */}
        <TabsContent value="spot" className="m-0 flex-1 flex flex-col">
          <SpotDiscoveryInterface />
        </TabsContent>
      </Tabs>
    </div>
  );
}
