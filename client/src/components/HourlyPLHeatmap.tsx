import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HourlyPLHeatmapProps {
  data: { hour: number; dayOfWeek: string; pnl: number }[];
}

export function HourlyPLHeatmap({ data }: HourlyPLHeatmapProps) {
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Find min/max for color scaling
  const values = data.map(d => d.pnl);
  const maxPnl = Math.max(...values);
  const minPnl = Math.min(...values);

  const getColorIntensity = (pnl: number) => {
    if (pnl === 0) return "bg-muted";
    
    const absMax = Math.max(Math.abs(maxPnl), Math.abs(minPnl));
    const intensity = Math.abs(pnl) / absMax;
    
    if (pnl > 0) {
      if (intensity < 0.25) return "bg-green-500/20";
      if (intensity < 0.5) return "bg-green-500/40";
      if (intensity < 0.75) return "bg-green-500/60";
      return "bg-green-500/80";
    } else {
      if (intensity < 0.25) return "bg-destructive/20";
      if (intensity < 0.5) return "bg-destructive/40";
      if (intensity < 0.75) return "bg-destructive/60";
      return "bg-destructive/80";
    }
  };

  const getDataForCell = (day: string, hour: number) => {
    return data.find(d => d.dayOfWeek === day && d.hour === hour)?.pnl || 0;
  };

  return (
    <Card className="hover-elevate transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Trading Performance by Hour</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header row with hours */}
          <div className="flex gap-1">
            <div className="w-8" /> {/* Spacer for day labels */}
            {[0, 6, 12, 18].map(hour => (
              <div key={hour} className="flex-1 text-center text-[9px] text-muted-foreground">
                {hour}h
              </div>
            ))}
          </div>
          
          {/* Heatmap grid */}
          {daysOfWeek.map(day => (
            <div key={day} className="flex gap-1 items-center">
              <div className="w-8 text-[9px] text-muted-foreground font-medium">{day}</div>
              {hours.map(hour => {
                const pnl = getDataForCell(day, hour);
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={cn(
                      "flex-1 h-4 rounded-sm transition-all duration-200 hover:scale-110 cursor-pointer group relative",
                      getColorIntensity(pnl)
                    )}
                    title={`${day} ${hour}:00 - $${pnl.toFixed(2)}`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                      <div className="bg-background/95 backdrop-blur-sm border rounded px-2 py-1 text-[9px] whitespace-nowrap shadow-xl">
                        <div className="text-muted-foreground">{day} {hour}:00</div>
                        <div className={cn("font-bold", pnl >= 0 ? "text-green-500" : "text-destructive")}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-3 text-[9px] text-muted-foreground">
          <span>Loss</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-destructive/20" />
            <div className="w-3 h-3 rounded-sm bg-destructive/40" />
            <div className="w-3 h-3 rounded-sm bg-destructive/60" />
            <div className="w-3 h-3 rounded-sm bg-destructive/80" />
          </div>
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500/20" />
            <div className="w-3 h-3 rounded-sm bg-green-500/40" />
            <div className="w-3 h-3 rounded-sm bg-green-500/60" />
            <div className="w-3 h-3 rounded-sm bg-green-500/80" />
          </div>
          <span>Profit</span>
        </div>
      </CardContent>
    </Card>
  );
}
