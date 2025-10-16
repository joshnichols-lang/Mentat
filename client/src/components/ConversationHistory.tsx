import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Bot } from "lucide-react";
import type { AiUsageLog } from "@shared/schema";

export default function ConversationHistory() {
  const { data: usageLogs, isLoading } = useQuery<{ success: boolean; logs: AiUsageLog[] }>({
    queryKey: ["/api/ai/usage"],
    refetchInterval: 5000,
  });

  const conversations = usageLogs?.logs?.filter(log => log.success === 1 && log.userPrompt) || [];

  if (isLoading) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Conversation History</h2>
        <div className="text-xs text-muted-foreground">Loading...</div>
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Conversation History</h2>
        <div className="text-xs text-muted-foreground">No conversations yet. Start by asking Mr. Fox a question.</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold mb-3">Conversation History</h2>
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-3" data-testid="conversation-history">
          {conversations.map((log) => {
            let aiStrategy = null;
            try {
              if (log.aiResponse) {
                aiStrategy = JSON.parse(log.aiResponse);
              }
            } catch (e) {
              console.error("Failed to parse AI response:", e);
            }

            return (
              <div key={log.id} className="space-y-2" data-testid={`conversation-${log.id}`}>
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                    <div className="text-xs font-medium" data-testid="user-prompt">
                      {log.userPrompt}
                    </div>
                  </div>
                </div>

                {aiStrategy && (
                  <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                    <Bot className="h-3.5 w-3.5 mt-0.5 text-primary" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">Mr. Fox</span>
                        <Badge variant="secondary" className="text-xs h-4 px-1.5">
                          {log.model}
                        </Badge>
                      </div>
                      
                      {aiStrategy.interpretation && (
                        <div className="text-xs text-muted-foreground italic" data-testid="ai-interpretation">
                          {aiStrategy.interpretation}
                        </div>
                      )}

                      {aiStrategy.actions && aiStrategy.actions.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold">Actions:</div>
                          {aiStrategy.actions.map((action: any, idx: number) => (
                            <div key={idx} className="text-xs bg-muted/50 p-2 space-y-0.5" data-testid={`action-${idx}`}>
                              <div className="font-mono">
                                {action.action?.toUpperCase()} {action.symbol?.replace("-PERP", "")} {action.side?.toUpperCase()}
                                {action.leverage && ` ${action.leverage}x`}
                              </div>
                              <div className="text-muted-foreground">Size: {action.size}</div>
                              {action.reasoning && (
                                <div className="text-muted-foreground italic">{action.reasoning}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {aiStrategy.riskManagement && (
                        <div className="text-xs">
                          <span className="font-semibold">Risk: </span>
                          <span className="text-muted-foreground">{aiStrategy.riskManagement}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!aiStrategy && log.aiResponse && (
                  <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                    <Bot className="h-3.5 w-3.5 mt-0.5 text-primary" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold mb-1">Mr. Fox</div>
                      <div className="text-xs text-muted-foreground">
                        {log.aiResponse.substring(0, 200)}{log.aiResponse.length > 200 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
