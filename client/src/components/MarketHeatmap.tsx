import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketItem {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
}

interface MarketHeatmapProps {
  data: MarketItem[];
}

export function MarketHeatmap({ data }: MarketHeatmapProps) {
  const getColorIntensity = (change: number) => {
    const absChange = Math.abs(change);
    if (absChange < 2) return "bg-muted";
    if (absChange < 5) return change > 0 ? "bg-green-500/20" : "bg-red-500/20";
    if (absChange < 10) return change > 0 ? "bg-green-500/40" : "bg-red-500/40";
    return change > 0 ? "bg-green-500/60" : "bg-red-500/60";
  };

  const getBorderColor = (change: number) => {
    if (Math.abs(change) < 2) return "border-muted-foreground/20";
    return change > 0 ? "border-green-500/50" : "border-red-500/50";
  };

  return (
    <Card className="hover-elevate transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Market Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {data.map((item) => (
            <div
              key={item.symbol}
              className={cn(
                "relative p-3 rounded-lg border transition-all duration-300 hover:scale-105 cursor-pointer group",
                getColorIntensity(item.change24h),
                getBorderColor(item.change24h)
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">{(item.symbol || "").replace("-PERP", "")}</span>
                {item.change24h > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                ${item.price.toLocaleString()}
              </div>
              <div className={cn(
                "text-xs font-bold mt-1",
                item.change24h > 0 ? "text-green-600" : "text-red-600"
              )}>
                {item.change24h > 0 ? "+" : ""}{item.change24h.toFixed(2)}%
              </div>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
