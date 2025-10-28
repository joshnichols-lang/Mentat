import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
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
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { PortfolioAreaChart } from "@/components/PortfolioAreaChart";
import { MarginUsageBar } from "@/components/MarginUsageBar";
import { SharpeGauge } from "@/components/SharpeGauge";
import { TradeDistributionDonut } from "@/components/TradeDistributionDonut";
import { CumulativeReturnsChart } from "@/components/CumulativeReturnsChart";
import { DrawdownChart } from "@/components/DrawdownChart";
import { PositionROEChart } from "@/components/PositionROEChart";
import { 
  Activity, 
  TrendingUp, 
  DollarSign,
  Target,
  BarChart3,
  LineChart
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | 'ALL'>('1W');

  // Fetch real data from APIs
  const { data: userState } = useQuery<any>({
    queryKey: ['/api/hyperliquid/user-state'],
    refetchInterval: 30000,
  });

  const { data: snapshots } = useQuery<any>({
    queryKey: ['/api/portfolio/snapshots'],
    refetchInterval: 30000,
  });

  const { data: positionsData } = useQuery<any>({
    queryKey: ["/api/hyperliquid/positions"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (user?.role === "admin") {
      return;
    }
    
    if (user && user.verificationStatus !== "approved") {
      setLocation("/pending-approval");
    }
  }, [user, setLocation]);

  // Extract real portfolio data
  const accountValue = (userState?.userState?.marginSummary?.accountValue as number) || 0;
  const withdrawable = (userState?.userState?.withdrawable as number) || 0;
  const marginUsed = (userState?.userState?.marginSummary?.totalMarginUsed as number) || 0;
  
  const allSnapshots = snapshots?.snapshots || [];
  const latestSnapshot = allSnapshots.length > 0 ? allSnapshots[allSnapshots.length - 1] : null;
  const sharpeRatio = latestSnapshot ? Number(latestSnapshot.sharpeRatio || 0) : 0;

  // Transform portfolio snapshots for charts
  const portfolioData = useMemo(() => {
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
      benchmark: i * 0.3 // Mock benchmark for now
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

  // Transform positions for ROE chart
  const positionROEData = useMemo(() => {
    const positions = positionsData?.positions || [];
    return positions.map((pos: any) => ({
      symbol: pos.coin,
      roe: (pos.returnOnEquity || 0) * 100,
      position: `${pos.szi > 0 ? 'LONG' : 'SHORT'} ${pos.leverage?.value || 1}x`
    }));
  }, [positionsData]);

  // Calculate trade distribution (mock for now - would need closed trades data)
  const wins = 95;
  const losses = 42;
  const breakeven = 5;

  return (
    <SymbolProvider>
      <div className="min-h-screen">
        <Header />
        
        <main className="h-[calc(100vh-3.5rem)]">
          {/* Resizable 3-Column Layout */}
          <ResizablePanelGroup direction="horizontal" className="h-full">
            
            {/* Left Panel - Portfolio Performance Charts */}
            <ResizablePanel defaultSize={30} minSize={25}>
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
                        Live
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                      <AnimatedCounter value={accountValue} prefix="$" decimals={2} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Free: <AnimatedCounter value={withdrawable} prefix="$" decimals={2} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Margin: <AnimatedCounter value={marginUsed} prefix="$" decimals={2} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Portfolio Performance Chart */}
                {portfolioData.length > 0 && (
                  <PortfolioAreaChart 
                    data={portfolioData}
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

              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Middle Panel - AI & Conversation */}
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className="h-full flex flex-col">
                
                {/* AI Prompt Panel */}
                <div className="p-4 border-b">
                  <AIPromptPanel />
                </div>

                {/* Conversation History */}
                <div className="flex-1 overflow-auto p-4">
                  <ConversationHistory />
                </div>

                {/* Position Analytics Tabs */}
                {positionROEData.length > 0 && (
                  <div className="p-4 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <LineChart className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Position Analytics</h3>
                    </div>
                    
                    <Tabs defaultValue="roe" className="w-full">
                      <TabsList className="grid w-full grid-cols-1">
                        <TabsTrigger value="roe" className="text-xs">ROE Comparison</TabsTrigger>
                      </TabsList>
                      <TabsContent value="roe" className="mt-4">
                        <PositionROEChart data={positionROEData} />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel - Positions & Activity */}
            <ResizablePanel defaultSize={30} minSize={25}>
              <div className="h-full p-4 space-y-4 overflow-auto">
                
                {/* Open Positions */}
                <PositionsGrid />

                {/* AI Usage Tracker */}
                <AIUsageTracker />

              </div>
            </ResizablePanel>

          </ResizablePanelGroup>
        </main>
      </div>
    </SymbolProvider>
  );
}
