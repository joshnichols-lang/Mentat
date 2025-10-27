import { useState } from "react";
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

// Prediction Markets Interface Placeholder
function PredictionMarketsInterface() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="glass-strong border-glass/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-primary" />
              Prediction Markets - Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground/70">
              Trade prediction markets on Polymarket. Browse events, analyze probabilities, and trade YES/NO outcomes.
            </p>
            <div className="mt-4 p-4 glass rounded-lg border border-glass/20">
              <h3 className="font-semibold mb-2">Features:</h3>
              <ul className="space-y-1 text-sm text-foreground/70">
                <li>• Browse trending prediction markets</li>
                <li>• Category filters (Politics, Sports, Entertainment, etc.)</li>
                <li>• Real-time probability tracking</li>
                <li>• YES/NO token trading</li>
                <li>• AI-powered event analysis</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
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
