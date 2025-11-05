interface PatternedBarChartProps {
  title: string;
  data: { label: string; value: number; percentage: number; pattern?: boolean }[];
  timeframeControls?: boolean;
  className?: string;
}

/**
 * PatternedBarChart - Horizontal bar chart with diagonal stripe patterns
 * Used for holders distribution, volume analysis (Numora style)
 */
export default function PatternedBarChart({ 
  title, 
  data,
  timeframeControls = false,
  className = "" 
}: PatternedBarChartProps) {
  return (
    <div className={`numora-panel ${className}`} data-testid="patterned-bar-chart">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {timeframeControls && (
          <div className="flex items-center gap-1">
            <button className="time-pill" data-testid="button-timeframe-24h">24H</button>
            <button className="time-pill time-pill-active" data-testid="button-timeframe-1d">1D</button>
            <button className="time-pill" data-testid="button-timeframe-7d">7D</button>
            <button className="time-pill" data-testid="button-timeframe-all">All</button>
          </div>
        )}
      </div>
      
      {/* Bar Chart */}
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="space-y-2">
            {/* Label and Percentage */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/60">{item.label}</span>
              <span className="display-number-lg text-xl">{item.percentage}%</span>
            </div>
            
            {/* Bar with Pattern */}
            <div className="relative h-24 bg-foreground/5 rounded overflow-hidden">
              {/* Progress Bar */}
              <div 
                className="absolute inset-y-0 left-0 transition-all duration-700 ease-out"
                style={{ width: `${item.percentage}%` }}
              >
                {item.pattern ? (
                  /* Diagonal stripe pattern */
                  <div 
                    className="h-full bg-success/20"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        45deg,
                        hsl(var(--success) / 0.3),
                        hsl(var(--success) / 0.3) 4px,
                        hsl(var(--foreground) / 0.1) 4px,
                        hsl(var(--foreground) / 0.1) 8px
                      )`
                    }}
                  />
                ) : (
                  /* Solid fill */
                  <div className="h-full bg-success/10" />
                )}
                
                {/* Fine vertical lines overlay (Numora detail) */}
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      90deg,
                      transparent,
                      transparent 2px,
                      hsl(var(--foreground) / 0.03) 2px,
                      hsl(var(--foreground) / 0.03) 3px
                    )`
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer Stats */}
      {data.length > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30 text-xs text-foreground/50">
          <span>Whales {data[0]?.percentage.toFixed(1)}%</span>
          <span>Others {data.slice(1).reduce((sum, d) => sum + d.percentage, 0).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
