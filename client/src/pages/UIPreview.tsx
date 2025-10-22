import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Target, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  MessageSquare,
  Command,
  Settings,
  Maximize2
} from "lucide-react";

export default function UIPreview() {
  return (
    <div className="h-screen w-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header with Glassmorphism */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              1fox Terminal
            </h1>
          </div>
          
          <div className="flex-1" />
          
          <Button variant="ghost" size="sm" className="gap-2">
            <Command className="h-4 w-4" />
            <span className="text-xs text-muted-foreground">⌘K</span>
          </Button>
          
          <Badge variant="default" className="gap-1">
            <Zap className="h-3 w-3" />
            Active Mode
          </Badge>
          
          <Button size="icon" variant="ghost">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resizable 3-Column Layout */}
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-3.5rem)]">
        
        {/* Left Panel - Market Data & Charts */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <div className="h-full p-4 space-y-4 overflow-auto">
            
            {/* Portfolio Overview Card with Gradient */}
            <Card className="border-0 bg-gradient-to-br from-card via-card to-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    +12.4%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                  $142,285.58
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Free: $67,547.76
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Margin: $55,104.48
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart Placeholder */}
            <Card className="hover-elevate transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Performance</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">1D</Button>
                    <Button variant="default" size="sm" className="h-6 px-2 text-xs">1W</Button>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">1M</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-32 rounded-lg bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center">
                  <Activity className="h-8 w-8 text-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>

            {/* Market Overview */}
            <Card className="hover-elevate transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Market Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {["BTC-PERP", "ETH-PERP", "SOL-PERP"].map((symbol, i) => (
                  <div key={symbol} className="flex items-center justify-between p-2 rounded-lg hover-elevate active-elevate-2 cursor-pointer transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-xs font-bold">{symbol.substring(0, 3)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{symbol.replace("-PERP", "")}</div>
                        <div className="text-xs text-muted-foreground">
                          ${(45000 + i * 1000).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant={i % 2 === 0 ? "default" : "destructive"} className="gap-1">
                      {i % 2 === 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {i % 2 === 0 ? '+2.4%' : '-1.2%'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle Panel - AI Prompt & Conversation */}
        <ResizablePanel defaultSize={35} minSize={30}>
          <div className="h-full flex flex-col">
            
            {/* AI Prompt Input */}
            <div className="p-4 border-b bg-muted/5">
              <Card className="border-2 border-primary/20 shadow-lg shadow-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Ask Mr. Fox</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="relative">
                      <textarea 
                        className="w-full min-h-24 p-3 rounded-lg bg-background border border-input resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="What's your trading move today?"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">
                          <Target className="h-2.5 w-2.5 mr-1" />
                          No Active Strategy
                        </Badge>
                      </div>
                      <Button className="gap-2 shadow-lg shadow-primary/20">
                        <Zap className="h-4 w-4" />
                        Submit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Conversation History */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Conversation History</h3>
              </div>

              {/* Example Message */}
              <Card className="hover-elevate transition-all">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-muted-foreground">10/22/2025, 3:20 PM</div>
                      <div className="text-sm font-medium">how much available margin do I have to trade with</div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Mr. Fox</span>
                        <Badge variant="secondary" className="h-4 text-xs px-1.5">grok-beta</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground italic">
                        You have <span className="font-bold text-foreground">$67,547.76</span> in free margin available to trade with. 
                        Your total portfolio value is $142,285.58 with $55,104.48 currently used as margin.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Loading State Example */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Positions & Performance */}
        <ResizablePanel defaultSize={30} minSize={25}>
          <div className="h-full p-4 space-y-4 overflow-auto">
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Open Positions</h3>
              <Button size="sm" variant="ghost" className="gap-1">
                <Maximize2 className="h-3 w-3" />
                Expand
              </Button>
            </div>

            {/* Position Card with Animation */}
            <Card className="group hover-elevate transition-all duration-300 border-l-4 border-l-destructive">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">0G-PERP</CardTitle>
                      <CardDescription className="text-xs">SHORT · 3x</CardDescription>
                    </div>
                  </div>
                  <Badge variant="destructive" className="gap-1">
                    -82 @ $1.8274
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">P&L</div>
                    <div className="text-sm font-bold text-green-500">+$0.57</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">ROE</div>
                    <div className="text-sm font-bold">+1.15%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Value</div>
                    <div className="text-sm font-medium">$149.27</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin</div>
                    <div className="text-sm font-medium">$50.37</div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                    Adjust SL
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                    Adjust TP
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs">
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Another Position Card */}
            <Card className="group hover-elevate transition-all duration-300 border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">2Z-PERP</CardTitle>
                      <CardDescription className="text-xs">SHORT · 3x</CardDescription>
                    </div>
                  </div>
                  <Badge variant="default" className="gap-1">
                    -59 @ $0.236
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">P&L</div>
                    <div className="text-sm font-bold text-green-500">+$0.10</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">ROE</div>
                    <div className="text-sm font-bold">+2.18%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Value</div>
                    <div className="text-sm font-medium">$13.85</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin</div>
                    <div className="text-sm font-medium">$4.74</div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                    Adjust SL
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                    Adjust TP
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs">
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card className="bg-gradient-to-br from-card to-muted/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Sharpe Ratio</span>
                  <span className="font-bold">2.43</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Win Rate</span>
                  <span className="font-bold">67%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total Trades</span>
                  <span className="font-bold">142</span>
                </div>
              </CardContent>
            </Card>

          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}
