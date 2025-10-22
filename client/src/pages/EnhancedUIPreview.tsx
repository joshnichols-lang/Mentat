import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { PortfolioAreaChart } from "@/components/PortfolioAreaChart";
import { PositionSparkline } from "@/components/PositionSparkline";
import { MarketHeatmap } from "@/components/MarketHeatmap";
import { MarginUsageBar } from "@/components/MarginUsageBar";
import { SharpeGauge } from "@/components/SharpeGauge";
import { TradeDistributionDonut } from "@/components/TradeDistributionDonut";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Target, 
  DollarSign,
  Bot,
  MessageSquare,
  Command,
  Settings,
  Maximize2,
  RefreshCw
} from "lucide-react";

export default function EnhancedUIPreview() {
  const [portfolioValue, setPortfolioValue] = useState(142285.58);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | 'ALL'>('1W');

  // Generate sample portfolio data
  const portfolioData = Array.from({ length: 30 }, (_, i) => ({
    timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: 130000 + Math.random() * 20000 + i * 400
  }));

  // Sample market data
  const marketData = [
    { symbol: "BTC-PERP", price: 45234.50, change24h: 5.2, volume: 1250000000 },
    { symbol: "ETH-PERP", price: 2350.75, change24h: 3.8, volume: 650000000 },
    { symbol: "SOL-PERP", price: 98.45, change24h: -2.1, volume: 120000000 },
    { symbol: "DOGE-PERP", price: 0.0825, change24h: 8.5, volume: 95000000 },
    { symbol: "MATIC-PERP", price: 0.65, change24h: -1.2, volume: 45000000 },
    { symbol: "AVAX-PERP", price: 18.90, change24h: 4.5, volume: 78000000 }
  ];

  // Sample sparkline data for positions
  const sparklineData1 = Array.from({ length: 20 }, () => 1.80 + Math.random() * 0.15);
  const sparklineData2 = Array.from({ length: 20 }, () => 0.23 + Math.random() * 0.03);

  const simulateValueChange = () => {
    setPortfolioValue(prev => prev + (Math.random() - 0.5) * 1000);
  };

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
              1fox Terminal - Enhanced
            </h1>
          </div>
          
          <div className="flex-1" />
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2"
            onClick={simulateValueChange}
          >
            <RefreshCw className="h-4 w-4" />
            Update Data
          </Button>
          
          <Button variant="ghost" size="sm" className="gap-2">
            <Command className="h-4 w-4" />
            <span className="text-xs text-muted-foreground">⌘K</span>
          </Button>
          
          <Badge variant="default" className="gap-1 shadow-lg shadow-primary/20">
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
            
            {/* Portfolio Overview Card with Animated Counter */}
            <Card className="border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl shadow-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
                  <Badge variant="secondary" className="gap-1 hover-elevate">
                    <TrendingUp className="h-3 w-3" />
                    +12.4%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                  <AnimatedCounter value={portfolioValue} prefix="$" decimals={2} />
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Free: <AnimatedCounter value={67547.76} prefix="$" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Margin: <AnimatedCounter value={55104.48} prefix="$" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interactive Portfolio Performance Chart */}
            <PortfolioAreaChart 
              data={portfolioData}
              timeframe={timeframe}
              onTimeframeChange={(tf) => setTimeframe(tf as any)}
            />

            {/* Margin Usage Progress Bar */}
            <MarginUsageBar
              used={55104.48}
              total={142285.58}
              warningThreshold={70}
              dangerThreshold={85}
            />

            {/* Market Heatmap */}
            <MarketHeatmap data={marketData} />

            {/* Sharpe Ratio Gauge */}
            <SharpeGauge value={2.43} />

            {/* Trade Distribution Donut */}
            <TradeDistributionDonut wins={95} losses={42} breakeven={5} />

          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle Panel - AI Prompt & Conversation */}
        <ResizablePanel defaultSize={35} minSize={30}>
          <div className="h-full flex flex-col">
            
            {/* AI Prompt Input */}
            <div className="p-4 border-b bg-muted/5">
              <Card className="border-2 border-primary/20 shadow-lg shadow-primary/5 hover-elevate transition-all">
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
                      <Button className="gap-2 shadow-lg shadow-primary/20 hover-elevate">
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

              {/* Example Conversation Messages */}
              <Card className="hover-elevate transition-all duration-300">
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
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
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

            {/* Position Card with Sparkline */}
            <Card className="group hover-elevate transition-all duration-300 border-l-4 border-l-destructive shadow-lg hover:shadow-xl">
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
                {/* Sparkline Chart */}
                <div className="rounded-lg bg-muted/30 p-2">
                  <PositionSparkline 
                    data={sparklineData1}
                    color="hsl(var(--destructive))"
                    fillColor="hsl(var(--destructive) / 0.1)"
                    width={200}
                    height={40}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">P&L</div>
                    <div className="text-sm font-bold text-green-500">
                      <AnimatedCounter value={0.57} prefix="+" decimals={2} />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">ROE</div>
                    <div className="text-sm font-bold">
                      <AnimatedCounter value={1.15} suffix="%" decimals={2} />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Value</div>
                    <div className="text-sm font-medium">
                      $<AnimatedCounter value={149.27} decimals={2} />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin</div>
                    <div className="text-sm font-medium">
                      $<AnimatedCounter value={50.37} decimals={2} />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs hover-elevate">
                    Adjust SL
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs hover-elevate">
                    Adjust TP
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs">
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Another Position Card */}
            <Card className="group hover-elevate transition-all duration-300 border-l-4 border-l-primary shadow-lg hover:shadow-xl">
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
                {/* Sparkline Chart */}
                <div className="rounded-lg bg-muted/30 p-2">
                  <PositionSparkline 
                    data={sparklineData2}
                    color="hsl(var(--primary))"
                    fillColor="hsl(var(--primary) / 0.1)"
                    width={200}
                    height={40}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">P&L</div>
                    <div className="text-sm font-bold text-green-500">
                      <AnimatedCounter value={0.10} prefix="+" decimals={2} />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">ROE</div>
                    <div className="text-sm font-bold">
                      <AnimatedCounter value={2.18} suffix="%" decimals={2} />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Value</div>
                    <div className="text-sm font-medium">
                      $<AnimatedCounter value={13.85} decimals={2} />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin</div>
                    <div className="text-sm font-medium">
                      $<AnimatedCounter value={4.74} decimals={2} />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs hover-elevate">
                    Adjust SL
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs hover-elevate">
                    Adjust TP
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs">
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}
