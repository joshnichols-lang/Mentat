import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function AIInsightsPanel() {
  const { data: learningsData } = useQuery<any>({
    queryKey: ['/api/learnings'],
    refetchInterval: 60000,
  });

  const learnings = learningsData?.learnings || [];
  const recentLearnings = learnings.slice(0, 5);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4" />
          AI Trading Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentLearnings.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            AI will generate insights from your trading activity. Start trading to see personalized recommendations.
          </p>
        ) : (
          <div className="space-y-3">
            {recentLearnings.map((learning: any, idx: number) => (
              <div 
                key={idx}
                className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2"
                data-testid={`insight-${idx}`}
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-xs leading-relaxed">{learning.content || learning.observation}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {learning.category && (
                        <Badge variant="outline" className="text-xs">
                          {learning.category}
                        </Badge>
                      )}
                      {learning.confidence && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            parseFloat(learning.confidence) >= 0.8 
                              ? 'border-success/50 text-success' 
                              : 'border-muted-foreground/50'
                          }`}
                        >
                          {(parseFloat(learning.confidence) * 100).toFixed(0)}% confidence
                        </Badge>
                      )}
                      {learning.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(learning.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
