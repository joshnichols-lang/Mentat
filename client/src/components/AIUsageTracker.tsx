import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Zap, TrendingUp } from "lucide-react";

interface ApiResponse<T> {
  success: boolean;
  [key: string]: any;
}

interface CostResponse extends ApiResponse<string> {
  totalCost: string;
}

interface LogsResponse extends ApiResponse<any[]> {
  logs: any[];
}

export function AIUsageTracker() {
  const { data: costData } = useQuery<CostResponse>({
    queryKey: ['/api/ai/cost'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: logsData } = useQuery<LogsResponse>({
    queryKey: ['/api/ai/usage'],
    refetchInterval: 30000,
  });

  const totalCost = (costData?.success ? costData.totalCost : "0") || "0";
  const logs = (logsData?.success ? logsData.logs : []) || [];
  const totalRequests = logs.length;
  const totalTokens = logs.reduce((sum: number, log: any) => sum + (log.totalTokens || 0), 0);

  return (
    <Card data-testid="card-ai-usage-tracker">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">AI Usage</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold" data-testid="text-total-cost">
              ${parseFloat(totalCost).toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">total spent</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Requests</p>
              <p className="text-lg font-semibold" data-testid="text-total-requests">{totalRequests}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tokens</p>
              <p className="text-lg font-semibold" data-testid="text-total-tokens">
                {totalTokens.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Using Perplexity Sonar ($0.20/M tokens)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
