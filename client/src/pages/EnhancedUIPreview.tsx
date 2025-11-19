import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { PortfolioAreaChart } from "@/components/PortfolioAreaChart";
import { PositionSparkline } from "@/components/PositionSparkline";
import { MarginUsageBar } from "@/components/MarginUsageBar";
import { SharpeGauge } from "@/components/SharpeGauge";
import { TradeDistributionDonut } from "@/components/TradeDistributionDonut";
import { PLWaterfallChart } from "@/components/PLWaterfallChart";
import { CumulativeReturnsChart } from "@/components/CumulativeReturnsChart";
import { DrawdownChart } from "@/components/DrawdownChart";
import { PositionROEChart } from "@/components/PositionROEChart";
import { WinStreakChart } from "@/components/WinStreakChart";
import { HourlyPLHeatmap } from "@/components/HourlyPLHeatmap";
import { PositionScatterPlot } from "@/components/PositionScatterPlot";
import { RollingMetricsChart } from "@/components/RollingMetricsChart";
import { PositionSizeHistogram } from "@/components/PositionSizeHistogram";
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
  RefreshCw,
  BarChart3,
  LineChart
} from "lucide-react";

export default function EnhancedUIPreview() {
  const [portfolioValue, setPortfolioValue] = useState(142285.58);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | 'ALL'>('1W');

  // Generate sample portfolio data
  const portfolioData = Array.from({ length: 30 }, (_, i) => ({
    timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: 130000 + Math.random() * 20000 + i * 400
  }));

  // P&L Waterfall data
  const plWaterfallData = Array.from({ length: 14 }, (_, i) => ({
    day: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    pnl: (Math.random() - 0.45) * 2000
  }));

  // Cumulative returns data
  const cumulativeReturnsData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    portfolio: 5 + (Math.random() - 0.3) * 8 + i * 0.3,
    benchmark: 3 + (Math.random() - 0.5) * 5 + i * 0.15
  }));

  // Drawdown data
  const drawdownData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    drawdown: -(Math.random() * 8 * Math.sin(i * 0.3))
  }));

  // Position ROE data
  const positionROEData = [
    { symbol: "BTC-PERP", roe: 12.5, position: "LONG 2x" },
    { symbol: "ETH-PERP", roe: 8.3, position: "LONG 3x" },
    { symbol: "SOL-PERP", roe: -4.2, position: "SHORT 2x" },
    { symbol: "0G-PERP", roe: 1.15, position: "SHORT 3x" },
    { symbol: "2Z-PERP", roe: 2.18, position: "SHORT 3x" },
    { symbol: "DOGE-PERP", roe: -1.5, position: "LONG 2x" }
  ];

  // Win streak data
  const winStreakData = [
    { trade: "#1", outcome: 'win' as const, streak: 1 },
    { trade: "#2", outcome: 'win' as const, streak: 2 },
    { trade: "#3", outcome: 'win' as const, streak: 3 },
    { trade: "#4", outcome: 'loss' as const, streak: -1 },
    { trade: "#5", outcome: 'win' as const, streak: 1 },
    { trade: "#6", outcome: 'win' as const, streak: 2 },
    { trade: "#7", outcome: 'win' as const, streak: 3 },
    { trade: "#8", outcome: 'win' as const, streak: 4 },
    { trade: "#9", outcome: 'loss' as const, streak: -1 },
    { trade: "#10", outcome: 'loss' as const, streak: -2 },
    { trade: "#11", outcome: 'win' as const, streak: 1 },
    { trade: "#12", outcome: 'win' as const, streak: 2 }
  ];

  // Hourly P&L heatmap data
  const hourlyPLData = [];
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let day of daysOfWeek) {
    for (let hour = 0; hour < 24; hour++) {
      hourlyPLData.push({
        hour,
        dayOfWeek: day,
        pnl: (Math.random() - 0.5) * 50
      });
    }
  }

  // Position scatter data
  const positionScatterData = [
    { symbol: "BTC-PERP", durationHours: 12, pnl: 450, size: 5000 },
    { symbol: "ETH-PERP", durationHours: 24, pnl: 320, size: 3500 },
    { symbol: "SOL-PERP", durationHours: 6, pnl: -120, size: 1200 },
    { symbol: "DOGE-PERP", durationHours: 48, pnl: 180, size: 2000 },
    { symbol: "0G-PERP", durationHours: 3, pnl: 0.57, size: 150 },
    { symbol: "2Z-PERP", durationHours: 8, pnl: 0.10, size: 14 },
    { symbol: "MATIC-PERP", durationHours: 18, pnl: -80, size: 800 },
    { symbol: "AVAX-PERP", durationHours: 36, pnl: 290, size: 4200 }
  ];

  // Rolling metrics data
  const rollingMetricsData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sharpe: 1.5 + (Math.random() - 0.5) * 1.2 + Math.sin(i * 0.2) * 0.5,
    sortino: 2.0 + (Math.random() - 0.5) * 1.5 + Math.sin(i * 0.15) * 0.6,
    calmar: 1.2 + (Math.random() - 0.5) * 0.8 + Math.sin(i * 0.25) * 0.4
  }));

  // Position size histogram data
  const positionSizeData = [
    { range: "$0-500", count: 15, avgPnl: 12.5 },
    { range: "$500-1k", count: 22, avgPnl: 45.3 },
    { range: "$1k-2k", count: 18, avgPnl: -15.2 },
    { range: "$2k-5k", count: 12, avgPnl: 78.9 },
    { range: "$5k+", count: 8, avgPnl: 125.6 }
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
              1fox Terminal - Enhanced Performance Charts
            </h1>
          </div>
          
          <div className="flex-1" />
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2"
            onClick={simulateValueChange}
            data-testid="button-update-data"
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
        
        {/* Left Panel - Portfolio Performance Charts */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <div className="h-full p-4 space-y-4 overflow-auto">
            
            {/* Portfolio Overview Card with Animated Counter */}
            <Card className="border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl shadow-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
                  </div>
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

            {/* Cumulative Returns vs Benchmark */}
            <CumulativeReturnsChart data={cumulativeReturnsData} />

            {/* Daily P&L Waterfall */}
            <PLWaterfallChart data={plWaterfallData} />

            {/* Drawdown Chart */}
            <DrawdownChart data={drawdownData} />

            {/* Rolling Risk Metrics */}
            <RollingMetricsChart data={rollingMetricsData} />

            {/* Sharpe Ratio Gauge */}
            <SharpeGauge value={2.43} />

            {/* Margin Usage Progress Bar */}
            <MarginUsageBar
              used={55104.48}
              total={142285.58}
              warningThreshold={70}
              dangerThreshold={85}
            />

          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle Panel - Position Performance Charts */}
        <ResizablePanel defaultSize={35} minSize={30}>
          <div className="h-full flex flex-col">
            
            {/* Tabs for different chart views */}
            <div className="p-4 border-b">
              <div className="flex items-center gap-2 mb-3">
                <LineChart className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Position Performance Analytics</h3>
              </div>
              
              <Tabs defaultValue="roe" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="roe" className="text-xs">ROE</TabsTrigger>
                  <TabsTrigger value="scatter" className="text-xs">Duration</TabsTrigger>
                  <TabsTrigger value="size" className="text-xs">Size</TabsTrigger>
                </TabsList>
                <TabsContent value="roe" className="mt-4">
                  <PositionROEChart data={positionROEData} />
                </TabsContent>
                <TabsContent value="scatter" className="mt-4">
                  <PositionScatterPlot data={positionScatterData} />
                </TabsContent>
                <TabsContent value="size" className="mt-4">
                  <PositionSizeHistogram data={positionSizeData} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Additional Performance Charts */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              
              {/* Win/Loss Streak */}
              <WinStreakChart data={winStreakData} />

              {/* Trade Distribution Donut */}
              <TradeDistributionDonut wins={95} losses={42} breakeven={5} />

              {/* Hourly P&L Heatmap */}
              <HourlyPLHeatmap data={hourlyPLData} />

              {/* AI Prompt Section */}
              <Card className="border-2 border-primary/20 shadow-lg shadow-primary/5 hover-elevate transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Ask m.teg</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="relative">
                      <textarea 
                        className="w-full min-h-20 p-3 rounded-lg bg-background border border-input resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                        placeholder="Analyze my best performing positions..."
                        data-testid="input-ai-prompt"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        <Target className="h-2.5 w-2.5 mr-1" />
                        No Active Strategy
                      </Badge>
                      <Button className="gap-2 shadow-lg shadow-primary/20 hover-elevate" size="sm">
                        <Zap className="h-4 w-4" />
                        Submit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Open Positions with Sparklines */}
        <ResizablePanel defaultSize={30} minSize={25}>
          <div className="h-full p-4 space-y-4 overflow-auto">
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Open Positions</h3>
              <Button size="sm" variant="ghost" className="gap-1">
                <Maximize2 className="h-3 w-3" />
                Expand
              </Button>
            </div>

            {/* Position Card 1 with Sparkline */}
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

            {/* Position Card 2 */}
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

            {/* Additional Position Cards can be added here */}

          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}
