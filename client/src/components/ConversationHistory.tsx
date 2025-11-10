import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, Bot, ChevronDown, Search, Activity, Target, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AiUsageLog, TradingMode } from "@shared/schema";

export default function ConversationHistory() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [followUpMessages, setFollowUpMessages] = useState<Record<string, string>>({});
  const { toast } = useToast();
  
  // Fetch active trading strategy - optimized polling
  const { data: activeStrategyData } = useQuery<{ success: boolean; mode: TradingMode | null }>({
    queryKey: ["/api/trading-modes/active"],
    refetchInterval: 30000, // Reduced from 5s to 30s
  });
  
  const activeStrategy = activeStrategyData?.mode;
  const strategyId = activeStrategy?.id;
  
  // Fetch conversation history - optimized polling
  const { data: usageLogs, isLoading } = useQuery<{ success: boolean; logs: AiUsageLog[] }>({
    queryKey: strategyId 
      ? ["/api/ai/usage", `?strategyId=${strategyId}`]
      : ["/api/ai/usage", "?strategyId=null"],
    refetchInterval: 30000, // Reduced from 5s to 30s (conversations don't change frequently)
  });

  const allConversations = usageLogs?.logs?.filter(log => log.success === 1 && log.userPrompt) || [];
  
  const conversations = useMemo(() => {
    // Separate automated alerts from regular conversations
    const automatedAlerts = allConversations.filter(log => 
      log.userPrompt === "[AUTOMATED MONITORING]" || log.userPrompt === "[AUTONOMOUS TRADING]"
    );
    const regularConversations = allConversations.filter(log => 
      log.userPrompt !== "[AUTOMATED MONITORING]" && log.userPrompt !== "[AUTONOMOUS TRADING]"
    );
    
    // Get only the most recent automated alert (last in array = most recent by timestamp)
    const latestAutomatedAlert = automatedAlerts.length > 0 
      ? [automatedAlerts[automatedAlerts.length - 1]] 
      : [];
    
    // Combine: automated alert first (at top), then regular conversations
    const combinedConversations = [...latestAutomatedAlert, ...regularConversations];
    
    // Apply search filter if query exists
    if (!searchQuery.trim()) return combinedConversations;
    
    const query = searchQuery.toLowerCase();
    return combinedConversations.filter(log => {
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

  // Mutation to send follow-up messages with conversation thread context
  const followUpMutation = useMutation({
    mutationFn: async ({ conversationId, message, threadContext, threadStrategyId }: { 
      conversationId: string; 
      message: string; 
      threadContext: { userPrompt: string; aiResponse: string };
      threadStrategyId: string | null;
    }) => {
      // Fetch current market data and positions
      const [marketDataResponse, positionsResponse] = await Promise.all([
        fetch("/api/hyperliquid/market-data"),
        fetch("/api/hyperliquid/positions")
      ]);
      
      const marketDataResult = await marketDataResponse.json();
      const positionsResult = await positionsResponse.json();
      
      // Build context-aware prompt
      const contextualPrompt = `[Continuing previous conversation]
Previous context:
User: ${threadContext.userPrompt}
AI: ${threadContext.aiResponse.substring(0, 500)}${threadContext.aiResponse.length > 500 ? '...' : ''}

Follow-up question: ${message}`;
      
      const response = await apiRequest("POST", "/api/trading/prompt", {
        prompt: contextualPrompt,
        marketData: marketDataResult.marketData || [],
        currentPositions: positionsResult.positions || [],
        strategyId: threadStrategyId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/usage"] });
      toast({
        title: "Follow-up sent",
        description: "Mr. Fox is analyzing your question...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send follow-up message",
        variant: "destructive",
      });
    },
  });

  const handleFollowUpSubmit = (log: AiUsageLog) => {
    const message = followUpMessages[log.id];
    if (!message?.trim()) return;
    
    followUpMutation.mutate({
      conversationId: log.id,
      message: message.trim(),
      threadContext: {
        userPrompt: log.userPrompt || "",
        aiResponse: log.aiResponse || "",
      },
      threadStrategyId: log.strategyId || null,
    });
    
    // Clear the input after sending
    setFollowUpMessages(prev => ({ ...prev, [log.id]: "" }));
  };

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
            <div className="flex flex-col items-start gap-1">
              <h2 className="text-sm font-semibold">CONVERSATION HISTORY</h2>
              {activeStrategy ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" />
                  <span>{activeStrategy.name}</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">General Conversations</div>
              )}
            </div>
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
            const isAutomatedMonitoring = log.userPrompt === "[AUTOMATED MONITORING]";
            const isAutonomousTrading = log.userPrompt === "[AUTONOMOUS TRADING]";
            const isAutomated = isAutomatedMonitoring || isAutonomousTrading;
            
            let aiStrategy = null;
            let monitoringAnalysis = null;
            let autonomousStrategy = null;
            
            try {
              if (log.aiResponse && log.aiResponse.trim()) {
                const parsed = JSON.parse(log.aiResponse);
                if (isAutomatedMonitoring) {
                  monitoringAnalysis = parsed;
                } else if (isAutonomousTrading) {
                  autonomousStrategy = parsed;
                } else {
                  aiStrategy = parsed;
                }
              }
            } catch (e) {
              console.error("Failed to parse AI response:", e);
            }

            return (
              <Collapsible key={log.id} className="space-y-2" data-testid={`conversation-${log.id}`}>
                <div className="flex items-start gap-2">
                  <CollapsibleTrigger className="hover-elevate active-elevate-2 p-1 -m-1 transition-colors group shrink-0" data-testid={`toggle-conversation-${log.id}`}>
                    <div className="flex items-center gap-1.5">
                      {isAutomated ? (
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <div className="flex-1 space-y-1 cursor-text select-text">
                    <div className="text-xs text-muted-foreground select-text">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                    <div className="text-xs font-medium select-text" data-testid="user-prompt">
                      {isAutonomousTrading ? (
                        <div className="flex items-center gap-2">
                          <span>Autonomous Trading</span>
                          {autonomousStrategy && (
                            <Badge variant={
                              autonomousStrategy.marketRegime === 'bullish' ? 'default' :
                              autonomousStrategy.marketRegime === 'bearish' ? 'destructive' : 'secondary'
                            } className="text-xs h-4 px-1.5">
                              {autonomousStrategy.marketRegime}
                            </Badge>
                          )}
                        </div>
                      ) : isAutomatedMonitoring ? (
                        <div className="flex items-center gap-2">
                          <span>Automated Position Monitoring</span>
                          {monitoringAnalysis && (
                            <Badge variant={
                              monitoringAnalysis.alertLevel === 'critical' ? 'destructive' :
                              monitoringAnalysis.alertLevel === 'warning' ? 'default' : 'secondary'
                            } className="text-xs h-4 px-1.5">
                              {monitoringAnalysis.alertLevel}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        log.userPrompt
                      )}
                    </div>
                  </div>
                </div>

                <CollapsibleContent>
                  {aiStrategy && (
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2 cursor-text select-text" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                      <Bot className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold select-text">Mr. Fox</span>
                          <Badge variant="secondary" className="text-xs h-4 px-1.5">
                            {log.model}
                          </Badge>
                        </div>
                        
                        {aiStrategy.interpretation && (
                          <div className="text-xs text-muted-foreground italic select-text" data-testid="ai-interpretation">
                            {aiStrategy.interpretation}
                          </div>
                        )}

                        {aiStrategy.actions && aiStrategy.actions.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold select-text">Actions:</div>
                            {aiStrategy.actions.map((action: any, idx: number) => (
                              <div key={idx} className="text-xs bg-muted/50 p-2 space-y-0.5 select-text" data-testid={`action-${idx}`}>
                                <div className="font-mono select-text">
                                  {action.action?.toUpperCase()} {(action.symbol || "").replace("-PERP", "")} {action.side?.toUpperCase()}
                                  {action.leverage && ` ${action.leverage}x`}
                                </div>
                                <div className="text-muted-foreground select-text">Size: {action.size}</div>
                                {action.reasoning && (
                                  <div className="text-muted-foreground italic select-text">{action.reasoning}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {aiStrategy.riskManagement && (
                          <div className="text-xs select-text">
                            <span className="font-semibold">Risk: </span>
                            <span className="text-muted-foreground">{aiStrategy.riskManagement}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {monitoringAnalysis && (
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2 cursor-text select-text" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                      <Bot className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold select-text">Mr. Fox</span>
                          <Badge variant="secondary" className="text-xs h-4 px-1.5">
                            {log.model}
                          </Badge>
                        </div>
                        
                        {monitoringAnalysis.summary && (
                          <div className="text-xs text-muted-foreground italic select-text">
                            {monitoringAnalysis.summary}
                          </div>
                        )}

                        {monitoringAnalysis.positionAnalysis && monitoringAnalysis.positionAnalysis.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold select-text">Position Analysis:</div>
                            {monitoringAnalysis.positionAnalysis.map((pos: any, idx: number) => (
                              <div key={idx} className="text-xs bg-muted/50 p-2 space-y-0.5 select-text">
                                <div className="font-mono select-text">
                                  {pos.symbol} - P&L: {pos.pnlPercent?.toFixed(2)}%
                                </div>
                                <div className="text-muted-foreground select-text">{pos.assessment}</div>
                                <div className="text-muted-foreground italic select-text">{pos.recommendation}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {monitoringAnalysis.marketContext && (
                          <div className="text-xs select-text">
                            <span className="font-semibold">Market: </span>
                            <span className="text-muted-foreground">{monitoringAnalysis.marketContext}</span>
                          </div>
                        )}

                        {monitoringAnalysis.suggestions && monitoringAnalysis.suggestions.length > 0 && (
                          <div className="text-xs select-text">
                            <span className="font-semibold">Suggestions: </span>
                            <span className="text-muted-foreground">{monitoringAnalysis.suggestions.join(' • ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {autonomousStrategy && (
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2 cursor-text select-text" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                      <Bot className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold select-text">Mr. Fox</span>
                          <Badge variant="secondary" className="text-xs h-4 px-1.5">
                            {log.model}
                          </Badge>
                        </div>
                        
                        {autonomousStrategy.tradeThesis && (
                          <div className="text-xs text-muted-foreground italic select-text">
                            {autonomousStrategy.tradeThesis}
                          </div>
                        )}

                        {autonomousStrategy.volumeAnalysis && (
                          <div className="text-xs select-text">
                            <span className="font-semibold">Volume: </span>
                            <span className="text-muted-foreground">{autonomousStrategy.volumeAnalysis}</span>
                          </div>
                        )}

                        {autonomousStrategy.execution && (
                          <div className="text-xs select-text">
                            <span className="font-semibold">Execution: </span>
                            <span className={autonomousStrategy.execution.successful > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                              {autonomousStrategy.execution.successful}/{autonomousStrategy.execution.totalActions} trades executed
                            </span>
                          </div>
                        )}

                        {autonomousStrategy.execution && autonomousStrategy.execution.results && autonomousStrategy.execution.results.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold select-text">Actions Taken:</div>
                            {autonomousStrategy.execution.results.slice(0, 3).map((result: any, idx: number) => (
                              <div key={idx} className="text-xs bg-muted/50 p-2 space-y-0.5 select-text">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono select-text">
                                    {result.action?.action?.toUpperCase()} {(result.action?.symbol || "").replace("-PERP", "")} {result.action?.side?.toUpperCase()}
                                  </span>
                                  <Badge variant={result.success ? "default" : "destructive"} className="text-xs h-4 px-1.5">
                                    {result.success ? "success" : "failed"}
                                  </Badge>
                                </div>
                                {result.action?.reasoning && (
                                  <div className="text-muted-foreground italic select-text">{result.action.reasoning}</div>
                                )}
                                {result.error && (
                                  <div className="text-red-600 dark:text-red-400 text-xs select-text">{result.error}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {autonomousStrategy.riskAssessment && (
                          <div className="text-xs select-text">
                            <span className="font-semibold">Risk: </span>
                            <span className="text-muted-foreground">{autonomousStrategy.riskAssessment}</span>
                          </div>
                        )}

                        {autonomousStrategy.expectedSharpeImpact && (
                          <div className="text-xs select-text">
                            <span className="font-semibold">Expected Impact: </span>
                            <span className="text-muted-foreground">{autonomousStrategy.expectedSharpeImpact}</span>
                          </div>
                        )}

                        {autonomousStrategy.noTradesReason && (
                          <div className="text-xs text-muted-foreground italic select-text">
                            {autonomousStrategy.noTradesReason}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!aiStrategy && !monitoringAnalysis && !autonomousStrategy && log.aiResponse && (
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2 cursor-text select-text" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                      <Bot className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold select-text">Mr. Fox</span>
                          <Badge variant="secondary" className="text-xs h-4 px-1.5">
                            {log.model}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap select-text">
                          {log.aiResponse}
                        </div>
                      </div>
                    </div>
                  )}

                  {!aiStrategy && !log.aiResponse && (
                    <div className="flex items-start gap-2 pl-5 border-l-2 ml-1.5 mt-2" style={{ borderColor: 'hsl(var(--muted-foreground))' }}>
                      <Bot className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground italic">No response recorded</div>
                      </div>
                    </div>
                  )}

                  {/* Follow-up input for non-automated conversations */}
                  {!isAutomated && log.aiResponse && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder="Continue this conversation..."
                          value={followUpMessages[log.id] || ""}
                          onChange={(e) => setFollowUpMessages(prev => ({ ...prev, [log.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleFollowUpSubmit(log);
                            }
                          }}
                          className="text-xs h-8 flex-1"
                          disabled={followUpMutation.isPending}
                          data-testid={`input-followup-${log.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleFollowUpSubmit(log)}
                          disabled={followUpMutation.isPending || !followUpMessages[log.id]?.trim()}
                          className="h-8"
                          data-testid={`button-send-followup-${log.id}`}
                        >
                          {followUpMutation.isPending ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                        </Button>
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
