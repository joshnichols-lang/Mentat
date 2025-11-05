import { useMemo } from "react";

interface TransactionHeatmapProps {
  data?: { date: string; volume: number }[];
  className?: string;
}

/**
 * Transaction Heatmap - Calendar-style grid visualization
 * Displays trading activity over 12 months in a compact grid
 * Inspired by Numora's dashboard design
 */
export default function TransactionHeatmap({ data = [], className = "" }: TransactionHeatmapProps) {
  // Generate 12 months of mock data for visualization
  const heatmapData = useMemo(() => {
    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const now = new Date();
    const result: { month: string; weeks: number[][] }[] = [];
    
    months.forEach((month, monthIndex) => {
      const weeks: number[][] = [];
      // 4 weeks per month, 7 days per week
      for (let week = 0; week < 4; week++) {
        const weekData: number[] = [];
        for (let day = 0; day < 7; day++) {
          // Random volume between 0-100 for demo
          const volume = Math.random() > 0.3 ? Math.floor(Math.random() * 100) : 0;
          weekData.push(volume);
        }
        weeks.push(weekData);
      }
      result.push({ month, weeks });
    });
    
    return result;
  }, []);
  
  // Get intensity color based on volume (0-100)
  const getIntensity = (volume: number) => {
    if (volume === 0) return 'bg-foreground/5';
    if (volume < 25) return 'bg-success/20';
    if (volume < 50) return 'bg-success/40';
    if (volume < 75) return 'bg-success/60';
    return 'bg-success/80';
  };
  
  return (
    <div className={`numora-panel ${className}`} data-testid="transaction-heatmap">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Transactions Heatmap</h3>
        <div className="flex items-center gap-4 text-xs text-foreground/60">
          <button className="time-pill time-pill-active" data-testid="button-timeframe-1d">1D</button>
          <button className="time-pill" data-testid="button-timeframe-7d">7D</button>
          <button className="time-pill" data-testid="button-timeframe-1m">1M</button>
          <button className="time-pill" data-testid="button-timeframe-all">All</button>
        </div>
      </div>
      
      {/* Heatmap Grid */}
      <div className="space-y-3">
        {heatmapData.map((monthData, monthIndex) => (
          <div key={monthIndex} className="flex items-start gap-2">
            {/* Month Label */}
            <div className="w-8 text-xs text-foreground/50 pt-0.5">{monthData.month}</div>
            
            {/* Week Grid */}
            <div className="flex gap-0.5 flex-1">
              {monthData.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5">
                  {week.map((volume, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={`w-2.5 h-2.5 rounded-sm ${getIntensity(volume)} transition-all duration-200 hover:scale-125 hover:ring-1 hover:ring-success cursor-pointer`}
                      title={`Volume: ${volume}`}
                      data-testid={`heatmap-cell-${monthIndex}-${weekIndex}-${dayIndex}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/30">
        <span className="text-xs text-foreground/50">Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-foreground/5" />
          <div className="w-3 h-3 rounded-sm bg-success/20" />
          <div className="w-3 h-3 rounded-sm bg-success/40" />
          <div className="w-3 h-3 rounded-sm bg-success/60" />
          <div className="w-3 h-3 rounded-sm bg-success/80" />
        </div>
        <span className="text-xs text-foreground/50">More</span>
      </div>
    </div>
  );
}
