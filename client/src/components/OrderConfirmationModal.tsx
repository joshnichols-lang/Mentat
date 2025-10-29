import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, ArrowRight, TrendingUp, TrendingDown, Circle, DollarSign, Target, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StrategyLeg {
  instrumentId: string;
  instrumentName: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  side: "buy" | "sell";
  size: number;
  estimatedPrice: number;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    iv?: number;
  };
}

interface OrderConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyName: string;
  strategyType: string;
  asset: string;
  underlyingPrice: number;
  legs: StrategyLeg[];
  totalCost: number;
  maxProfit: number | null;
  maxLoss: number;
  upperBreakeven: number | null;
  lowerBreakeven: number | null;
}

interface ExecutionResult {
  legIndex: number;
  orderId: string;
  positionId: string;
  status: string;
  fillPrice: number;
}

export function OrderConfirmationModal({
  open,
  onOpenChange,
  strategyName,
  strategyType,
  asset,
  underlyingPrice,
  legs,
  totalCost,
  maxProfit,
  maxLoss,
  upperBreakeven,
  lowerBreakeven,
}: OrderConfirmationModalProps) {
  const [executionState, setExecutionState] = useState<"confirming" | "executing" | "success" | "error">("confirming");
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const executeStrategyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/aevo/execute-strategy", "POST", {
        strategyName,
        strategyType,
        asset,
        underlyingPrice,
        legs,
        totalCost,
        maxProfit,
        maxLoss,
        upperBreakeven,
        lowerBreakeven,
      });
    },
    onSuccess: (data: any) => {
      setExecutionState("success");
      setExecutionResults(data.results || []);
      queryClient.invalidateQueries({ queryKey: ["/api/aevo/strategies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aevo/positions"] });
      toast({
        title: "Strategy Executed",
        description: `Successfully executed ${strategyName} with ${legs.length} legs`,
      });
    },
    onError: (error: any) => {
      setExecutionState("error");
      setExecutionError(error.message || "Failed to execute strategy");
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute strategy",
        variant: "destructive",
      });
    },
  });

  const handleExecute = () => {
    setExecutionState("executing");
    executeStrategyMutation.mutate();
  };

  const handleClose = () => {
    if (executionState === "executing") return;
    setExecutionState("confirming");
    setExecutionResults([]);
    setExecutionError(null);
    onOpenChange(false);
  };

  const aggregatedGreeks = legs.reduce(
    (acc, leg) => {
      const multiplier = leg.side === "buy" ? 1 : -1;
      return {
        delta: acc.delta + (leg.greeks?.delta || 0) * multiplier * leg.size,
        gamma: acc.gamma + (leg.greeks?.gamma || 0) * multiplier * leg.size,
        theta: acc.theta + (leg.greeks?.theta || 0) * multiplier * leg.size,
        vega: acc.vega + (leg.greeks?.vega || 0) * multiplier * leg.size,
      };
    },
    { delta: 0, gamma: 0, theta: 0, vega: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="modal-order-confirmation">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold" data-testid="text-strategy-name">
              {executionState === "confirming" && "Confirm Strategy"}
              {executionState === "executing" && "Executing Strategy..."}
              {executionState === "success" && "Strategy Executed"}
              {executionState === "error" && "Execution Failed"}
            </DialogTitle>
            <Badge variant="outline" className="ml-2" data-testid="badge-strategy-type">
              {strategyName}
            </Badge>
          </div>
          <DialogDescription data-testid="text-asset-price">
            {asset} @ ${underlyingPrice.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-6">
            {executionState === "confirming" && (
              <Alert className="bg-orange-950/20 border-orange-800/30" data-testid="alert-review">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <AlertDescription className="text-sm">
                  Review all details before executing. This will place {legs.length} market orders.
                </AlertDescription>
              </Alert>
            )}

            {executionState === "executing" && (
              <Alert className="bg-blue-950/20 border-blue-800/30" data-testid="alert-executing">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  Placing orders sequentially. Please wait...
                </AlertDescription>
              </Alert>
            )}

            {executionState === "success" && (
              <Alert className="bg-success-dark/20 border-success/30" data-testid="alert-success">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription className="text-sm">
                  All {legs.length} legs executed successfully!
                </AlertDescription>
              </Alert>
            )}

            {executionState === "error" && (
              <Alert className="bg-destructive-dark/20 border-destructive/30" data-testid="alert-error">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm">
                  {executionError}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-3 text-foreground">Strategy Legs</h3>
              <div className="space-y-2">
                {legs.map((leg, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-card/30 border border-border/50"
                    data-testid={`leg-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={leg.side === "buy" ? "default" : "secondary"}
                        className={leg.side === "buy" ? "bg-long/20 text-long border-long/30" : "bg-short/20 text-short border-short/30"}
                        data-testid={`badge-side-${index}`}
                      >
                        {leg.side.toUpperCase()}
                      </Badge>
                      <div>
                        <div className="flex items-center gap-2">
                          {leg.optionType === "call" ? (
                            <TrendingUp className="h-4 w-4 text-long" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-short" />
                          )}
                          <span className="font-medium text-sm" data-testid={`text-instrument-${index}`}>
                            {leg.instrumentName}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Strike ${leg.strike} • {leg.size} contracts
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm" data-testid={`text-price-${index}`}>
                        ${(leg.estimatedPrice * leg.size).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${leg.estimatedPrice.toFixed(4)} each
                      </div>
                    </div>
                    {executionState === "success" && executionResults[index] && (
                      <CheckCircle2 className="h-5 w-5 text-success ml-2" data-testid={`icon-success-${index}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Risk Metrics</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total Cost</span>
                    <span className="text-sm font-semibold" data-testid="text-total-cost">
                      ${totalCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Max Loss</span>
                    <span className="text-sm font-semibold text-destructive" data-testid="text-max-loss">
                      ${maxLoss.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Max Profit</span>
                    <span className="text-sm font-semibold text-success" data-testid="text-max-profit">
                      {maxProfit ? `$${maxProfit.toFixed(2)}` : "Unlimited"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Breakevens</h3>
                <div className="space-y-2">
                  {lowerBreakeven && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Lower</span>
                      <span className="text-sm font-semibold" data-testid="text-lower-breakeven">
                        ${lowerBreakeven.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {upperBreakeven && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Upper</span>
                      <span className="text-sm font-semibold" data-testid="text-upper-breakeven">
                        ${upperBreakeven.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {!lowerBreakeven && !upperBreakeven && (
                    <div className="text-xs text-muted-foreground">
                      Profitable at expiry if profitable now
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-3 text-foreground">Portfolio Greeks</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-card/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Delta</div>
                  <div className="text-sm font-semibold" data-testid="text-delta">
                    {aggregatedGreeks.delta.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-card/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Gamma</div>
                  <div className="text-sm font-semibold" data-testid="text-gamma">
                    {aggregatedGreeks.gamma.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-card/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Theta</div>
                  <div className="text-sm font-semibold" data-testid="text-theta">
                    {aggregatedGreeks.theta.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-card/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Vega</div>
                  <div className="text-sm font-semibold" data-testid="text-vega">
                    {aggregatedGreeks.vega.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {executionState === "confirming" && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecute}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-execute"
              >
                Execute Strategy
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
          {executionState === "executing" && (
            <Button disabled data-testid="button-executing">
              Executing...
            </Button>
          )}
          {(executionState === "success" || executionState === "error") && (
            <Button onClick={handleClose} data-testid="button-close">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
