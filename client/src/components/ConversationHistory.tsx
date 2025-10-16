import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, Bot, ChevronDown, Search } from "lucide-react";
import type { AiUsageLog } from "@shared/schema";

export default function ConversationHistory() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: usageLogs, isLoading } = useQuery<{ success: boolean; logs: AiUsageLog[] }>({
    queryKey: ["/api/ai/usage"],
    refetchInterval: 5000,
  });

  const allConversations = usageLogs?.logs?.filter(log => log.success === 1 && log.userPrompt) || [];
  
  const conversations = useMemo(() => {
    if (!searchQuery.trim()) return allConversations;
    
    const query = searchQuery.toLowerCase();
    return allConversations.filter(log => {
      // Search in user prompt
      if (log.userPrompt?.toLowerCase().includes(query)) return true;
      
      // Search in AI response
      if (log.aiResponse?.toLowerCase().includes(query)) return true;
      
      // Search in parsed strategy
      try {
        if (log.aiResponse) {
          const strategy = JSON.parse(log.aiResponse);
          if (strategy.interpretation?.toLowerCase().includes(query)) return true;
          if (strategy.riskManagement?.toLowerCase().includes(query)) return true;
          if (strategy.actions?.some((action: any) => 
            action.symbol?.toLowerCase().includes(query) ||
            action.action?.toLowerCase().includes(query) ||
            action.reasoning?.toLowerCase().includes(query)
          )) return true;
        }
      } catch (e) {
        // Ignore parse errors
      }
      
      return false;
    });
  }, [allConversations, searchQuery]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">CONVERSATION HISTORY</h2>
        <div className="text-xs text-muted-foreground">Loading...</div>
      </Card>
    );
  }

  if (allConversations.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">CONVERSATION HISTORY</h2>
        <div className="text-xs text-muted-foreground">No conversations yet. Start by asking Mr. Fox a question.</div>
      </Card>
    );
  }

  return (
    <Collapsible open={isPanelOpen} onOpenChange={setIsPanelOpen}>
      <Card className="p-4">
        <CollapsibleTrigger className="w-full hover-elevate active-elevate-2 -m-4 p-4 mb-0 group" data-testid="toggle-conversation-panel">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">CONVERSATION HISTORY</h2>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="pt-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-8"
              data-testid="input-search-conversations"
            />
          </div>
          
          {conversations.length === 0 && searchQuery.trim() && (
            <div className="text-xs text-muted-foreground text-center py-8">
              No conversations found matching "{searchQuery}"
            </div>
          )}
          
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-3" data-testid="conversation-history">
          {conversations.map((log) => {
            let aiStrategy = null;
            try {
              if (log.aiResponse && log.aiResponse.trim()) {
                aiStrategy = JSON.parse(log.aiResponse);
              }
            } catch (e) {
              console.error("Failed to parse AI response:", e);
            }

            return (
              <Collapsible key={log.id} className="space-y-2" data-testid={`conversation-${log.id}`}>
                <CollapsibleTrigger className="w-full hover-elevate active-elevate-2 p-2 -m-2 transition-colors group" data-testid={`toggle-conversation-${log.id}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                      <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                    <div className="flex-1 space-y-1 text-left">
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs font-medium" data-testid="user-prompt">
                        {log.userPrompt}
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {aiStrategy && (
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
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
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                      <Bot className="h-3.5 w-3.5 mt-0.5 text-primary" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold mb-1">Mr. Fox</div>
                        <div className="text-xs text-muted-foreground">
                          {log.aiResponse.substring(0, 200)}{log.aiResponse.length > 200 ? '...' : ''}
                        </div>
                      </div>
                    </div>
                  )}

                  {!aiStrategy && !log.aiResponse && (
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                      <Bot className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground italic">No response recorded</div>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
