import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiStrategyDashboard } from "@/components/MultiStrategyDashboard";
import { Plus, Info, AlertCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";

type ModeFormData = {
  name: string;
  description: string;
  timeframe: string;
  riskPercentage: string;
  maxPositions: string;
  preferredLeverage: string;
  maxEntryOrdersPerSymbol: string;
  preferredAssets: string;
  restrictedAssets: string;
  customRules: string;
};

export default function Strategies() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState<ModeFormData>({
    name: "",
    description: "",
    timeframe: "5m",
    riskPercentage: "2",
    maxPositions: "3",
    preferredLeverage: "10",
    maxEntryOrdersPerSymbol: "3",
    preferredAssets: "",
    restrictedAssets: "",
    customRules: "",
  });

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

  const createModeMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/trading-modes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Trading strategy created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create trading strategy",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      timeframe: "5m",
      riskPercentage: "2",
      maxPositions: "3",
      preferredLeverage: "10",
      maxEntryOrdersPerSymbol: "3",
      preferredAssets: "",
      restrictedAssets: "",
      customRules: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parameters = {
      timeframe: formData.timeframe,
      riskPercentage: parseFloat(formData.riskPercentage),
      maxPositions: parseInt(formData.maxPositions),
      preferredLeverage: parseFloat(formData.preferredLeverage),
      maxEntryOrdersPerSymbol: parseInt(formData.maxEntryOrdersPerSymbol),
      preferredAssets: formData.preferredAssets,
      restrictedAssets: formData.restrictedAssets,
      customRules: formData.customRules,
    };

    const modeData = {
      name: formData.name,
      description: formData.description || null,
      parameters,
    };

    createModeMutation.mutate(modeData);
  };

  const handleCreateStrategy = () => {
    if (!canAddMore) {
      toast({
        title: "Maximum Strategies Reached",
        description: `You can run up to ${maxActiveStrategies} strategies simultaneously. Please pause or stop an existing strategy first.`,
        variant: "destructive",
      });
      return;
    }
    setIsCreateOpen(true);
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

      {/* Strategy Creation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">Create Trading Strategy</DialogTitle>
            <DialogDescription>
              Configure your trading strategy parameters and risk management settings
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Strategy Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Scalp BTC 5m"
                required
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your trading strategy..."
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Strategy Parameters</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeframe">Timeframe</Label>
                  <Select value={formData.timeframe} onValueChange={(value) => setFormData({ ...formData, timeframe: value })}>
                    <SelectTrigger id="timeframe" data-testid="select-timeframe">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1m">1 Minute (Event-driven)</SelectItem>
                      <SelectItem value="5m">5 Minutes</SelectItem>
                      <SelectItem value="15m">15 Minutes</SelectItem>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="4h">4 Hours</SelectItem>
                      <SelectItem value="1d">1 Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="riskPercentage">Risk Per Trade (%)</Label>
                  <Input
                    id="riskPercentage"
                    type="number"
                    step="0.1"
                    value={formData.riskPercentage}
                    onChange={(e) => setFormData({ ...formData, riskPercentage: e.target.value })}
                    placeholder="2.0"
                    data-testid="input-risk"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPositions">Max Concurrent Positions</Label>
                  <Input
                    id="maxPositions"
                    type="number"
                    value={formData.maxPositions}
                    onChange={(e) => setFormData({ ...formData, maxPositions: e.target.value })}
                    placeholder="3"
                    data-testid="input-max-positions"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredLeverage">Preferred Leverage</Label>
                  <Input
                    id="preferredLeverage"
                    type="number"
                    value={formData.preferredLeverage}
                    onChange={(e) => setFormData({ ...formData, preferredLeverage: e.target.value })}
                    placeholder="10"
                    data-testid="input-leverage"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxEntryOrdersPerSymbol">Max Entry Orders Per Symbol</Label>
                  <Input
                    id="maxEntryOrdersPerSymbol"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.maxEntryOrdersPerSymbol}
                    onChange={(e) => setFormData({ ...formData, maxEntryOrdersPerSymbol: e.target.value })}
                    placeholder="3"
                    data-testid="input-max-entry-orders"
                  />
                  <p className="text-xs text-muted-foreground">Limits scaled entry orders per symbol</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Additional Settings</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredAssets">Preferred Assets (comma-separated)</Label>
                  <Input
                    id="preferredAssets"
                    value={formData.preferredAssets}
                    onChange={(e) => setFormData({ ...formData, preferredAssets: e.target.value })}
                    placeholder="BTC, ETH, SOL"
                    data-testid="input-assets"
                  />
                  <p className="text-xs text-muted-foreground">Suggestion for AI - not a hard restriction</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restrictedAssets">Restrict Trading To (comma-separated)</Label>
                  <Input
                    id="restrictedAssets"
                    value={formData.restrictedAssets}
                    onChange={(e) => setFormData({ ...formData, restrictedAssets: e.target.value })}
                    placeholder="BTC (leave empty for no restriction)"
                    data-testid="input-restricted-assets"
                  />
                  <p className="text-xs text-muted-foreground">HARD limit - AI can ONLY trade these assets if set</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customRules">Custom Rules (Optional)</Label>
                  <Textarea
                    id="customRules"
                    value={formData.customRules}
                    onChange={(e) => setFormData({ ...formData, customRules: e.target.value })}
                    placeholder="e.g., Buy when RSI drops below 30. Exit when RSI exceeds 70."
                    rows={4}
                    data-testid="input-custom-rules"
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Tip: The AI will analyze your rules and auto-configure monitoring!</p>
                    <div className="flex items-start gap-1 p-2 text-[11px] bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800 mt-2">
                      <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span>Event-driven trigger system enables cost-effective 1-minute monitoring. AI only called when technical indicators cross thresholds (90-95% cost savings).</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createModeMutation.isPending}
                data-testid="button-save"
              >
                Create Strategy
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
