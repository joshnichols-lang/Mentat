import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Zap, TrendingUp, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface StatsResponse extends ApiResponse<any> {
  stats: {
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCost: string;
  };
  hasPersonalAiKeys: boolean;
}

const MONITORING_FREQUENCIES = [
  { value: "0", label: "Disabled" },
  { value: "1", label: "1 minute" },
  { value: "5", label: "5 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
];

export function AIUsageTracker() {
  const { toast } = useToast();
  const [monitoringFrequency, setMonitoringFrequency] = useState<string>(() => {
    return localStorage.getItem("monitoringFrequency") || "5";
  });

  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ['/api/ai/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get current AI usage (hourly call limiting)
  const { data: usageData } = useQuery<{
    success: boolean;
    usage: {
      callsThisHour: number;
      limit: number | null;
      remaining: number;
      resetInMinutes: number;
    };
  }>({
    queryKey: ['/api/user/ai-usage'],
    refetchInterval: 60000, // Refresh every minute
  });

  const updateFrequencyMutation = useMutation({
    mutationFn: async (frequency: string) => {
      const res = await apiRequest('POST', '/api/monitoring/frequency', { 
        minutes: parseInt(frequency) 
      });
      
      if (!res.ok) {
        throw new Error(`Failed to update frequency: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: (data, frequency) => {
      toast({
        title: "Monitoring Updated",
        description: frequency === "0" 
          ? "Automated monitoring disabled" 
          : `Monitoring every ${MONITORING_FREQUENCIES.find(f => f.value === frequency)?.label}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update monitoring frequency",
        variant: "destructive",
      });
    },
  });

  // REMOVED: Auto-sync on mount was causing monitoring loops to restart on every page load
  // This caused excessive AI costs when users refreshed or had multiple tabs
  // Monitoring frequency is now only updated when user explicitly changes it via the dropdown

  const handleFrequencyChange = (value: string) => {
    const previousValue = monitoringFrequency;
    
    setMonitoringFrequency(value);
    localStorage.setItem("monitoringFrequency", value);
    
    updateFrequencyMutation.mutate(value, {
      onError: () => {
        // Rollback if mutation fails
        setMonitoringFrequency(previousValue);
        localStorage.setItem("monitoringFrequency", previousValue);
      }
    });
  };

  const stats = statsData?.success ? statsData.stats : null;
  const totalCost = stats?.totalCost || "0";
  const totalRequests = stats?.totalRequests || 0;
  const totalTokens = stats?.totalTokens || 0;
  
  const usage = usageData?.usage;
  const isUnlimited = usage?.limit === null;
  const isNearLimit = usage && !isUnlimited && usage.remaining <= 5;
  const atLimit = usage && !isUnlimited && usage.remaining === 0;

  // Hide AI usage stats for platform AI users
  if (statsData?.hasPersonalAiKeys === false) {
    return null;
  }

  return (
    <Card data-testid="card-ai-usage-tracker">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
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

          {usage && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Calls this hour</p>
                {usage.resetInMinutes > 0 && !isUnlimited && (
                  <p className="text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    Resets in {usage.resetInMinutes}m
                  </p>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-lg font-semibold ${atLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : ''}`} data-testid="text-calls-this-hour">
                  {isUnlimited ? (
                    <span className="text-muted-foreground text-sm">Unlimited</span>
                  ) : (
                    `${usage.callsThisHour} / ${usage.limit}`
                  )}
                </p>
                {isNearLimit && !atLimit && (
                  <span className="text-[10px] text-yellow-500">Near limit</span>
                )}
                {atLimit && (
                  <span className="text-[10px] text-red-500">Limit reached</span>
                )}
              </div>
            </div>
          )}

          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Using Perplexity Sonar ($0.20/M tokens)</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Auto-monitoring</span>
              </div>
              <Select value={monitoringFrequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger className="h-8" data-testid="select-monitoring-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONITORING_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
