import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiStrategyDashboard } from "@/components/MultiStrategyDashboard";
import { Plus, Info, AlertCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

export default function Strategies() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const { data: tradingModesData } = useQuery<{ success: boolean; tradingModes: any[] }>({
    queryKey: ["/api/trading-modes"],
  });

  const tradingModes = tradingModesData?.tradingModes || [];
  const activeStrategies = tradingModes.filter((m: any) => m.status === "active");
  const maxActiveStrategies = user?.maxActiveStrategies || 3;
  const canAddMore = activeStrategies.length < maxActiveStrategies;

  const handleCreateStrategy = () => {
    if (!canAddMore) {
      toast({
        title: "Maximum Strategies Reached",
        description: `You can run up to ${maxActiveStrategies} strategies simultaneously. Please pause or stop an existing strategy first.`,
        variant: "destructive",
      });
      return;
    }
    // Navigate to strategy creation (you can implement this)
    toast({
      title: "Create Strategy",
      description: "Strategy creation flow will be implemented here.",
    });
  };

  return (
    <>
      <Header />
      <div className="flex flex-col bg-background">
        {/* Page Header */}
        <div className="flex-none border-b border-border bg-card">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Strategy Manager</h1>
              <p className="text-xs text-muted-foreground">
                Manage up to {maxActiveStrategies} concurrent trading strategies
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {activeStrategies.length} / {maxActiveStrategies} Active
            </Badge>
            <Button
              size="sm"
              onClick={handleCreateStrategy}
              disabled={!canAddMore}
              data-testid="button-create-strategy"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Strategy
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">
              Performance
            </TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">
              Risk Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-0">
            {/* Info Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Each strategy operates independently with its own capital allocation, AI context, and risk limits. 
                The Portfolio Manager coordinates all strategies to prevent conflicts and manage total exposure.
              </AlertDescription>
            </Alert>

            {/* Multi-Strategy Dashboard */}
            <MultiStrategyDashboard />

            {/* Strategy Guidelines */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Strategy Guidelines</CardTitle>
                <CardDescription className="text-xs">
                  Best practices for managing multiple strategies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Diversify Timeframes</p>
                      <p className="text-xs text-muted-foreground">
                        Run strategies with different timeframes (scalping, swing, position) to reduce correlation
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Monitor Capital Allocation</p>
                      <p className="text-xs text-muted-foreground">
                        Ensure total allocated capital doesn't exceed 100% to prevent over-leveraging
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Watch for Conflicts</p>
                      <p className="text-xs text-muted-foreground">
                        Portfolio Manager will alert you if strategies take opposing positions
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Set Realistic Limits</p>
                      <p className="text-xs text-muted-foreground">
                        Configure position limits and leverage caps appropriate for each strategy's risk profile
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Analytics</CardTitle>
                <CardDescription className="text-xs">
                  Cross-strategy performance metrics coming soon
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This tab will include comprehensive performance analytics across all strategies, 
                  including Sharpe ratios, win rates, and correlation analysis.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk Management</CardTitle>
                <CardDescription className="text-xs">
                  Portfolio-level risk controls and monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This tab will include aggregate risk metrics, correlation heatmaps, and portfolio-level 
                  safety controls including emergency stop-all functionality.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </>
  );
}
