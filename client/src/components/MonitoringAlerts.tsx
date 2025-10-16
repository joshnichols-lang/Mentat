import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MonitoringLog } from "@shared/schema";

export function MonitoringAlerts() {
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

  if (isLoading) {
    return null;
  }

  const activeAlerts = alerts?.logs || [];

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {activeAlerts.map((alert) => {
        const analysis = JSON.parse(alert.analysis);
        const Icon = 
          alert.alertLevel === "critical" ? AlertCircle :
          alert.alertLevel === "warning" ? AlertTriangle :
          Info;

        return (
          <Card
            key={alert.id}
            className="p-4 border-2"
            style={{
              borderColor: 
                alert.alertLevel === "critical" ? "hsl(0 30% 45%)" :
                alert.alertLevel === "warning" ? "hsl(35 30% 45%)" :
                "hsl(210 10% 60%)",
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
                    Mr. Fox Alert - {alert.alertLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-sm mb-3" data-testid={`alert-summary-${alert.id}`}>
                  {analysis.summary}
                </p>

                {alert.suggestions && (
                  <div className="mt-3 pt-3 border-t border-muted">
                    <p className="text-xs font-semibold mb-2">SUGGESTIONS:</p>
                    <ul className="text-xs space-y-1">
                      {alert.suggestions.split(" | ").map((suggestion, i) => (
                        <li key={i} className="flex gap-2" data-testid={`alert-suggestion-${alert.id}-${i}`}>
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
          </Card>
        );
      })}
    </div>
  );
}
