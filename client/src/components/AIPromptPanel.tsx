import { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoUrl from "@assets/generated-image-removebg-preview_1760665535887.png";

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
  const { toast } = useToast();

  const { data: marketData } = useQuery<any>({
    queryKey: ["/api/hyperliquid/market-data"],
  });

  const { data: positions } = useQuery<any>({
    queryKey: ["/api/hyperliquid/positions"],
  });

  const executeTradeMutation = useMutation({
    mutationFn: async (promptText: string) => {
      const res = await apiRequest("POST", "/api/trading/prompt", {
        prompt: promptText,
        marketData: marketData?.marketData || [],
        currentPositions: positions?.positions || [],
        autoExecute: true,
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
      toast({
        title: "Error",
        description: error.message || "Failed to process trading prompt",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    executeTradeMutation.mutate(prompt);
    setPrompt("");
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <img src={logoUrl} alt="Mr. Fox" className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Mr. Fox</h2>
          {executeTradeMutation.isPending && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Processing
            </Badge>
          )}
        </div>
        
        <div className="space-y-2.5">
          <div className="relative">
            <Textarea
              placeholder="E.g., 'Maximize Sharpe ratio by trading BTC and ETH perpetuals'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] resize-none pr-12 text-sm"
              data-testid="input-ai-prompt"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button
              size="icon"
              className="absolute bottom-2 right-2"
              onClick={handleSubmit}
              disabled={!prompt.trim() || executeTradeMutation.isPending}
              data-testid="button-submit-prompt"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
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
    </div>
  );
}
