import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface MarginUsageBarProps {
  used: number;
  total: number;
  warningThreshold?: number;
  dangerThreshold?: number;
}

export function MarginUsageBar({
  used,
  total,
  warningThreshold = 70,
  dangerThreshold = 85
}: MarginUsageBarProps) {
  const percentage = (used / total) * 100;
  
  const getColor = () => {
    if (percentage >= dangerThreshold) return "bg-destructive";
    if (percentage >= warningThreshold) return "bg-yellow-500";
    return "bg-primary";
  };

  const getStatus = () => {
    if (percentage >= dangerThreshold) return { text: "High Risk", color: "text-destructive" };
    if (percentage >= warningThreshold) return { text: "Warning", color: "text-yellow-500" };
    return { text: "Healthy", color: "text-green-500" };
  };

  const status = getStatus();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Margin Usage</CardTitle>
          <div className="flex items-center gap-1.5">
            {percentage >= warningThreshold && (
              <AlertTriangle className={cn("h-3.5 w-3.5", status.color)} />
            )}
            <span className={cn("text-xs font-bold", status.color)}>
              {status.text}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Progress 
            value={percentage} 
            className="h-3"
          />
          <div 
            className={cn(
              "absolute inset-0 h-3 rounded-full transition-all duration-500",
              getColor()
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            <span className="font-bold text-foreground">${used.toLocaleString()}</span>
            {" "}used
          </div>
          <div className="text-muted-foreground">
            <span className="font-bold text-foreground">{percentage.toFixed(1)}%</span>
          </div>
          <div className="text-muted-foreground">
            of <span className="font-bold text-foreground">${total.toLocaleString()}</span>
          </div>
        </div>

        {/* Threshold indicators */}
        <div className="relative h-1 bg-muted rounded">
          <div 
            className="absolute h-full w-0.5 bg-yellow-500/50"
            style={{ left: `${warningThreshold}%` }}
          />
          <div 
            className="absolute h-full w-0.5 bg-destructive/50"
            style={{ left: `${dangerThreshold}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
