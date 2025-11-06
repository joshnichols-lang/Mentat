import { useState, useRef } from "react";
import { Send, CheckCircle2, AlertCircle, Info, Image, X, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";

interface ExecutionResult {
  success: boolean;
  action: {
    action: string;
    symbol: string;
    side: string;
    size: string;
    leverage?: number;
    reasoning: string;
    expectedEntry?: string;
    stopLoss?: string;
    takeProfit?: string;
  };
  orderId?: string;
  error?: string;
}

interface ExecutionSummary {
  totalActions: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedActions: number;
  results: ExecutionResult[];
}

export default function AIPromptPanel() {
  const [prompt, setPrompt] = useState("");
  const [lastExecution, setLastExecution] = useState<ExecutionSummary | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState("");
  const [strategyToRename, setStrategyToRename] = useState<any>(null);
  const [portfolioAnalysisOpen, setPortfolioAnalysisOpen] = useState(false);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<string | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast} = useToast();

  // Fetch portfolio analysis history
  const { data: portfolioAnalysesData } = useQuery<{
    analyses: Array<{ id: string; createdAt: string; preview: string }>;
  }>({
    queryKey: ["/api/ai/portfolio-analyses"],
    enabled: portfolioAnalysisOpen,
  });

  const { data: tradingModesData } = useQuery<{ modes: any[] }>({
    queryKey: ["/api/trading-modes"],
  });

  const { data: marketData, isSuccess: marketSuccess, isError: marketError } = useQuery<{ success: boolean; marketData?: any; error?: string }>({
    queryKey: ["/api/hyperliquid/market-data"],
    gcTime: 0, // Don't cache on error to prevent stale green lights
  });

  const { data: positions } = useQuery<any>({
    queryKey: ["/api/hyperliquid/positions"],
  });

  // Status indicators - check both success state and response data
  const { data: userData, isSuccess: userSuccess, isError: userError } = useQuery<any>({
    queryKey: ["/api/user"],
    refetchInterval: 5000,
    gcTime: 0, // Don't cache on error to prevent stale green lights
  });

  const { data: balancesData, isSuccess: balancesSuccess, isError: balancesError } = useQuery<{ success: boolean; balances?: any }>({
    queryKey: ["/api/wallets/balances"],
    refetchInterval: 10000,
    gcTime: 0, // Don't cache on error to prevent stale green lights
  });

  const { data: activeModeData, isSuccess: activeModeSuccess, isError: activeModeError } = useQuery<{ success: boolean; mode?: any }>({
    queryKey: ["/api/trading-modes/active"],
    refetchInterval: 5000,
    gcTime: 0, // Don't cache on error to prevent stale green lights
  });

  const activateStrategyMutation = useMutation({
    mutationFn: async (modeId: string) => {
      return apiRequest("POST", `/api/trading-modes/${modeId}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes/active"] });
      toast({
        title: "Strategy Activated",
        description: "The autonomous trading system will now use this strategy",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to activate strategy",
      });
    },
  });

  const renameStrategyMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/trading-modes/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      setRenameDialogOpen(false);
      toast({
        title: "Strategy Renamed",
        description: "Strategy name updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to rename strategy",
      });
    },
  });

  const loadAnalysisMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await apiRequest("GET", `/api/ai/portfolio-analyses/${analysisId}`, {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      setPortfolioAnalysis(data.analysis);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load analysis",
      });
    },
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/analyze-portfolio", {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      console.log("Portfolio analysis response:", data);
      setPortfolioAnalysis(data.analysis);
      setSelectedAnalysisId(data.analysisId);
      setPortfolioAnalysisOpen(true);
      
      // Refresh AI usage data and analysis history
      queryClient.invalidateQueries({ queryKey: ["/api/ai/usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/cost"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/portfolio-analyses"] });
      
      toast({
        title: "Portfolio Analysis Complete",
        description: `Analyzed ${data.portfolio.positionCounts.perpetuals + data.portfolio.positionCounts.options + data.portfolio.positionCounts.predictions} positions across all exchanges`,
      });
    },
    onError: (error: any) => {
      console.error("Portfolio analysis error:", error);
      
      let errorMessage = "Failed to analyze portfolio";
      if (error.data?.error) {
        errorMessage = error.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const executeTradeMutation = useMutation({
    mutationFn: async ({ promptText, images }: { promptText: string; images: string[] }) => {
      const strategyId = activeMode?.id || null;
      console.log("=== TRADING PROMPT REQUEST ===");
      console.log("Active Mode:", activeMode ? { id: activeMode.id, name: activeMode.name, isActive: activeMode.isActive } : null);
      console.log("Sending strategyId:", strategyId);
      console.log("=============================");
      
      const res = await apiRequest("POST", "/api/trading/prompt", {
        prompt: promptText,
        marketData: marketData?.marketData || [],
        currentPositions: positions?.positions || [],
        autoExecute: true,
        screenshots: images.length > 0 ? images : undefined,
        strategyId: strategyId, // null = "general" mode
        // Model is optional - AI router will use provider's default
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      console.log("Trade execution response:", data);
      
      // Check if execution was skipped due to passive mode
      if (data.executionSkipped) {
        toast({
          title: "Passive Mode - Strategy Generated",
          description: "Mr. Fox generated a trading strategy but did not execute trades. Switch to Active Mode to enable autonomous trading.",
        });
      } else if (data.execution) {
        setLastExecution(data.execution);
        
        if (data.execution.successfulExecutions > 0) {
          toast({
            title: "Trades Executed Successfully",
            description: `${data.execution.successfulExecutions} out of ${data.execution.totalActions} trades executed`,
          });
        } else if (data.execution.failedExecutions > 0) {
          toast({
            title: "Trade Execution Failed",
            description: data.execution.error || "Some trades failed to execute",
            variant: "destructive",
          });
        }
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/positions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/user-state"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ai/usage"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ai/cost"] });
      } else {
        toast({
          title: "Strategy Generated",
          description: data.strategy?.interpretation || "Mr. Fox generated a trading strategy",
        });
      }
    },
    onError: (error: any) => {
      console.error("Trade execution error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response,
        data: error.data,
        stack: error.stack
      });
      
      // Try to extract the actual error message from the response
      let errorMessage = "Failed to process trading prompt";
      if (error.data?.error) {
        errorMessage = error.data.error;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    executeTradeMutation.mutate({ promptText: prompt, images: screenshots });
    setPrompt("");
    setScreenshots([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please upload only image files",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Screenshots must be under 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setScreenshots((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const deactivateAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/trading-modes/deactivate-all", {});
    },
    onSuccess: () => {
      // Invalidate all trading mode queries using predicate to match hierarchical keys
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && queryKey.startsWith("/api/trading-modes");
        }
      });
      
      // Invalidate all AI usage queries to refresh conversation history
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && queryKey.startsWith("/api/ai/usage");
        }
      });
      
      toast({
        title: "General Mode Activated",
        description: "You can now have general AI conversations without a trading strategy",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to switch to general mode",
      });
    },
  });

  const handleStrategyChange = (value: string) => {
    if (value === "general") {
      // Deactivate all strategies to enable general conversation mode
      deactivateAllMutation.mutate();
    } else if (value === "custom") {
      const activeModes = tradingModesData?.modes.filter((m: any) => m.isActive);
      if (activeModes && activeModes.length > 0) {
        setStrategyToRename(activeModes[0]);
        setNewStrategyName(activeModes[0].name);
        setRenameDialogOpen(true);
      }
    } else if (value !== "") {
      activateStrategyMutation.mutate(value);
    }
  };

  const handleRenameSubmit = () => {
    if (strategyToRename && newStrategyName.trim()) {
      renameStrategyMutation.mutate({ id: strategyToRename.id, name: newStrategyName.trim() });
    }
  };

  const modes = tradingModesData?.modes || [];
  const activeMode = modes.find((m: any) => m.isActive);

  return (
    <div className="space-y-3">
      <Button 
        variant="outline" 
        className="w-full justify-start gap-2" 
        onClick={() => analyzePortfolioMutation.mutate()}
        disabled={analyzePortfolioMutation.isPending}
        data-testid="button-analyze-portfolio"
      >
        <TrendingUp className="h-4 w-4" />
        {analyzePortfolioMutation.isPending ? "Analyzing Portfolio..." : "Analyze Complete Portfolio"}
      </Button>
      
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Mr. Fox" className="h-5 w-5" />
            <h2 className="text-sm font-semibold">Mr. Fox</h2>
            {executeTradeMutation.isPending && (
              <Badge variant="secondary" className="gap-1.5 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Processing
              </Badge>
            )}
            
            {/* AI Status Lights */}
            <div className="flex items-center gap-1.5 ml-1" data-testid="ai-status-indicators">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`h-2 w-2 rounded-full ${
                      userSuccess && !userError && userData && marketSuccess && !marketError && marketData?.success && marketData?.marketData ? 'bg-long' : 'bg-muted-foreground/30'
                    }`}
                    data-testid="status-ai-live"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>AI {userSuccess && !userError && userData && marketSuccess && !marketError && marketData?.success && marketData?.marketData ? 'Live' : (userError || marketError || marketData?.success === false) ? 'Connection Error' : 'Offline'}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`h-2 w-2 rounded-full ${
                      balancesSuccess && !balancesError && balancesData?.success && balancesData?.balances && Object.keys(balancesData.balances).length > 0 ? 'bg-long' : 'bg-muted-foreground/30'
                    }`}
                    data-testid="status-balance-visible"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>Balance {balancesSuccess && !balancesError && balancesData?.success && balancesData?.balances && Object.keys(balancesData.balances).length > 0 ? 'Visible' : balancesError ? 'Fetch Error' : 'Not Available'}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`h-2 w-2 rounded-full ${
                      activeModeSuccess && !activeModeError && activeModeData?.success && activeModeData?.mode ? 'bg-long animate-pulse' : 'bg-muted-foreground/30'
                    }`}
                    data-testid="status-trading-active"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>{activeModeSuccess && !activeModeError && activeModeData?.success && activeModeData?.mode ? `Trading: ${activeModeData.mode.name}` : activeModeError ? 'Status Error' : 'No Active Trades'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <Select 
              value={activeMode?.id || "general"} 
              onValueChange={handleStrategyChange}
              disabled={activateStrategyMutation.isPending || deactivateAllMutation.isPending}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs" data-testid="select-strategy">
                <SelectValue placeholder="General (No Strategy)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general" data-testid="strategy-general">
                  General (No Strategy)
                </SelectItem>
                {modes.length > 0 && modes.map((mode: any) => (
                  <SelectItem key={mode.id} value={mode.id} data-testid={`strategy-${mode.id}`}>
                    {mode.name}
                  </SelectItem>
                ))}
                {activeMode && (
                  <SelectItem value="custom" data-testid="strategy-custom">
                    Rename Strategy...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2.5">
          {screenshots.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {screenshots.map((screenshot, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={screenshot} 
                    alt={`Screenshot ${index + 1}`}
                    className="h-20 w-20 object-cover rounded-md border"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeScreenshot(index)}
                    data-testid={`button-remove-screenshot-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="relative">
            <Textarea
              placeholder="E.g., 'Maximize Sharpe ratio by trading BTC and ETH perpetuals' - Attach charts to explain market structure"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] resize-none pr-24 text-sm"
              data-testid="input-ai-prompt"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="absolute bottom-2 right-2 flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
                data-testid="input-screenshot-upload"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => fileInputRef.current?.click()}
                disabled={executeTradeMutation.isPending}
                data-testid="button-add-screenshot"
              >
                <Image className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                className="h-9 w-9"
                onClick={handleSubmit}
                disabled={!prompt.trim() || executeTradeMutation.isPending}
                data-testid="button-submit-prompt"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {lastExecution && (
        <Alert className={lastExecution.failedExecutions > 0 ? "border-destructive" : "border-chart-2"}>
          <div className="flex items-start gap-2">
            {lastExecution.failedExecutions > 0 ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : lastExecution.successfulExecutions > 0 ? (
              <CheckCircle2 className="h-4 w-4 text-chart-2" />
            ) : (
              <Info className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="flex-1 space-y-3">
              <AlertDescription className="font-semibold">
                Execution Summary
              </AlertDescription>
              <AlertDescription className="text-xs">
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-chart-2">✓ {lastExecution.successfulExecutions} Successful</span>
                    {lastExecution.failedExecutions > 0 && (
                      <span className="text-destructive">✗ {lastExecution.failedExecutions} Failed</span>
                    )}
                    {lastExecution.skippedActions > 0 && (
                      <span className="text-muted-foreground">○ {lastExecution.skippedActions} Skipped</span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {lastExecution.results.map((result, i) => (
                    <div key={i} className="border-l-2 pl-3 py-1 space-y-1.5" style={{
                      borderColor: result.success ? 'hsl(var(--chart-2))' : result.error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'
                    }}>
                      <div className="font-semibold flex items-center gap-2">
                        <span className={result.success ? "text-chart-2" : result.error ? "text-destructive" : "text-muted-foreground"}>
                          {result.success ? "✓" : result.error ? "✗" : "○"}
                        </span>
                        <span className="font-mono">
                          {result.action.action.toUpperCase()} {result.action.symbol.replace("-PERP", "")} {result.action.side.toUpperCase()}
                        </span>
                        <Badge variant={result.action.side === "long" ? "default" : "destructive"} className="text-xs h-4 px-1.5">
                          {result.action.leverage ? `${result.action.leverage}x` : '1x'}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground space-y-0.5">
                        <div>Size: <span className="font-mono">{result.action.size}</span></div>
                        {result.action.expectedEntry && (
                          <div>Entry: <span className="font-mono">${parseFloat(result.action.expectedEntry).toLocaleString()}</span></div>
                        )}
                        {result.action.stopLoss && (
                          <div>Stop Loss: <span className="font-mono text-destructive">${parseFloat(result.action.stopLoss).toLocaleString()}</span></div>
                        )}
                        {result.action.takeProfit && (
                          <div>Take Profit: <span className="font-mono text-chart-2">${parseFloat(result.action.takeProfit).toLocaleString()}</span></div>
                        )}
                        {result.orderId && (
                          <div>Order ID: <span className="font-mono text-xs">{result.orderId}</span></div>
                        )}
                      </div>
                      {result.action.reasoning && (
                        <div className="text-muted-foreground italic text-xs mt-1">
                          {result.action.reasoning}
                        </div>
                      )}
                      {result.error && (
                        <div className="text-destructive font-semibold">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Strategy</DialogTitle>
            <DialogDescription>
              Give your strategy a custom name that reflects your trading style
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter new strategy name"
                value={newStrategyName}
                onChange={(e) => setNewStrategyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameSubmit();
                  }
                }}
                data-testid="input-strategy-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!newStrategyName.trim() || renameStrategyMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameStrategyMutation.isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={portfolioAnalysisOpen} onOpenChange={setPortfolioAnalysisOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-card/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Multi-Instrument Portfolio Analysis
            </DialogTitle>
            <DialogDescription>
              Comprehensive risk assessment across perpetuals, options, and prediction markets
            </DialogDescription>
          </DialogHeader>

          {portfolioAnalysesData && portfolioAnalysesData.analyses.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">View Past Analysis</label>
              <Select 
                value={selectedAnalysisId || ""} 
                onValueChange={(value) => {
                  setSelectedAnalysisId(value);
                  loadAnalysisMutation.mutate(value);
                }}
              >
                <SelectTrigger data-testid="select-analysis-history">
                  <SelectValue placeholder="Select a past analysis" />
                </SelectTrigger>
                <SelectContent>
                  {portfolioAnalysesData.analyses.map((analysis) => (
                    <SelectItem key={analysis.id} value={analysis.id}>
                      {new Date(analysis.createdAt).toLocaleString()} - {analysis.preview}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              {portfolioAnalysis ? (
                <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                  {portfolioAnalysis}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No analysis available
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPortfolioAnalysisOpen(false)}
              data-testid="button-close-analysis"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
