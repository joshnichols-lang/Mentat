import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, AlertTriangle, Info, AlertCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MonitoringLog } from "@shared/schema";

export function MonitoringAlerts() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  const { data: alerts, isLoading } = useQuery<{ success: boolean; logs: MonitoringLog[] }>({
    queryKey: ["/api/monitoring/active"],
    refetchInterval: 30000,
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/monitoring/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/active"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const activeAlerts = alerts?.logs || [];
      await Promise.all(
        activeAlerts.map(alert => apiRequest("POST", `/api/monitoring/${alert.id}/dismiss`))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/active"] });
    },
  });

  if (isLoading) {
    return null;
  }

  const activeAlerts = alerts?.logs || [];

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isPanelOpen} onOpenChange={setIsPanelOpen}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                data-testid="button-toggle-alerts"
              >
                {isPanelOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <h2 className="text-sm font-semibold tracking-wider uppercase">
              MR. FOX ALERTS ({activeAlerts.length})
            </h2>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearAllMutation.mutate()}
            disabled={clearAllMutation.isPending}
            className="h-7 gap-1.5 text-xs"
            data-testid="button-clear-all-alerts"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </Button>
        </div>

        <CollapsibleContent>
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-3">
              {activeAlerts.map((alert) => {
                const analysis = JSON.parse(alert.analysis);
                const Icon = 
                  alert.alertLevel === "critical" ? AlertCircle :
                  alert.alertLevel === "warning" ? AlertTriangle :
                  Info;

                return (
                  <div
                    key={alert.id}
                    className="p-3 rounded-md border-2"
                    style={{
                      borderColor: 
                        alert.alertLevel === "critical" ? "hsl(0 30% 45%)" :
                        alert.alertLevel === "warning" ? "hsl(35 30% 45%)" :
                        "hsl(210 10% 60%)",
                      backgroundColor: 
                        alert.alertLevel === "critical" ? "hsl(0 30% 45% / 0.05)" :
                        alert.alertLevel === "warning" ? "hsl(35 30% 45% / 0.05)" :
                        "hsl(210 10% 60% / 0.05)",
                    }}
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon 
                            className="h-4 w-4" 
                            style={{
                              color: 
                                alert.alertLevel === "critical" ? "hsl(0 30% 45%)" :
                                alert.alertLevel === "warning" ? "hsl(35 30% 45%)" :
                                "hsl(210 10% 60%)",
                            }}
                          />
                          <span className="font-bold uppercase text-xs tracking-wider">
                            {alert.alertLevel}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <p className="text-sm mb-2" data-testid={`alert-summary-${alert.id}`}>
                          {analysis.summary}
                        </p>

                        {alert.suggestions && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs font-semibold mb-1.5 opacity-70">SUGGESTIONS:</p>
                            <ul className="text-xs space-y-1">
                              {alert.suggestions.split(" | ").map((suggestion, i) => (
                                <li key={i} className="flex gap-2 opacity-80" data-testid={`alert-suggestion-${alert.id}-${i}`}>
                                  <span>•</span>
                                  <span>{suggestion}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => dismissMutation.mutate(alert.id)}
                        disabled={dismissMutation.isPending}
                        className="h-6 w-6 flex-shrink-0"
                        data-testid={`button-dismiss-${alert.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
