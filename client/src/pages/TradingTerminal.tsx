import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import TradingChart from "@/components/TradingChart";
import { 
  LineChart, 
  TrendingUp, 
  Settings,
  Maximize2,
  Minimize2,
} from "lucide-react";

export default function TradingTerminal() {
  const [orderPanelCollapsed, setOrderPanelCollapsed] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main Chart Area with Vertical Resizing */}
          <ResizablePanel defaultSize={70} minSize={50}>
            <div className="h-full flex flex-col">
              {/* Chart Toolbar */}
              <div className="glass border-b border-glass/20 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="hover:glow-orange"
                    data-testid="button-symbol-selector"
                  >
                    <span className="font-bold text-primary">{selectedSymbol}</span>
                  </Button>
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
                      <div className="h-full glass border-t border-glass/20 p-4 overflow-auto glass-fade-in">
                        <Tabs defaultValue="market" className="w-full">
                          <TabsList className="grid w-[200px] grid-cols-2">
                            <TabsTrigger value="market" data-testid="tab-market-order">Market</TabsTrigger>
                            <TabsTrigger value="limit" data-testid="tab-limit-order">Limit</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="market" className="mt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <Card className="glass border-glass/20">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Order Entry Panel</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-xs text-muted-foreground">Task 10: Order entry form</p>
                                </CardContent>
                              </Card>
                              <Card className="glass border-glass/20">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Position Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-xs text-muted-foreground">Live position data</p>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="limit" className="mt-4">
                            <p className="text-xs text-muted-foreground">Limit order form (Task 10)</p>
                          </TabsContent>
                        </Tabs>
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
                <TabsList className="m-2">
                  <TabsTrigger value="orderbook" data-testid="tab-orderbook">Order Book</TabsTrigger>
                  <TabsTrigger value="trades" data-testid="tab-recent-trades">Trades</TabsTrigger>
                </TabsList>

                <TabsContent value="orderbook" className="flex-1 m-2 mt-0">
                  <Card className="glass-strong border-glass/20 h-full">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Order Book
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">Task 11: Real-time order book</p>
                      <div className="mt-4 space-y-1">
                        {/* Mock order book entries */}
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex justify-between text-xs shimmer rounded p-1">
                            <span className="text-short">--,---</span>
                            <span className="text-muted-foreground">---</span>
                          </div>
                        ))}
                        <div className="my-2 border-t border-glass/20" />
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex justify-between text-xs shimmer rounded p-1">
                            <span className="text-long">--,---</span>
                            <span className="text-muted-foreground">---</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="trades" className="flex-1 m-2 mt-0">
                  <Card className="glass-strong border-glass/20 h-full">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <LineChart className="h-4 w-4 text-primary" />
                        Recent Trades
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">Task 12: Live market trades</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
