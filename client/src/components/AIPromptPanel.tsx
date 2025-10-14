import { useState } from "react";
import { Send, Sparkles, TrendingUp, Shield, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function AIPromptPanel() {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const examplePrompts = [
    { icon: TrendingUp, text: "Maximize risk-adjusted returns (Sharpe ratio)" },
    { icon: Shield, text: "Conservative strategy with 2% max position size" },
    { icon: Target, text: "Trade BTC breakout above $45k with 3:1 R:R" },
  ];

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    console.log("AI prompt submitted:", prompt);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setPrompt("");
    }, 2000);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">AI Trading Agent</h2>
        {isProcessing && (
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
            className="min-h-[70px] resize-none pr-12 text-sm"
            data-testid="input-ai-prompt"
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isProcessing}
            data-testid="button-submit-prompt"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {examplePrompts.map((example, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="justify-start gap-1.5 text-xs"
              onClick={() => setPrompt(example.text)}
              data-testid={`button-example-${i}`}
            >
              <example.icon className="h-3 w-3" />
              {example.text}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
