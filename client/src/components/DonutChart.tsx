import { useMemo } from "react";

interface DonutChartProps {
  percentage: number;
  label?: string;
  segments?: { label: string; value: number; color: string }[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * DonutChart - Circular progress visualization
 * Displays percentage with segmented ring (Numora style)
 */
export default function DonutChart({ 
  percentage, 
  label = "Unlocked",
  segments = [
    { label: "Total Locked", value: 43.88, color: "text-success" },
    { label: "TBD Locked", value: 52.17, color: "text-foreground/60" },
    { label: "Unlocked", value: 33.90, color: "text-foreground/40" },
    { label: "Untracked", value: 0.00, color: "text-foreground/20" }
  ],
  size = "md",
  className = "" 
}: DonutChartProps) {
  const sizeConfig = {
    sm: { dimension: 120, stroke: 12, center: 60, radius: 54 },
    md: { dimension: 160, stroke: 16, center: 80, radius: 72 },
    lg: { dimension: 200, stroke: 20, center: 100, radius: 90 }
  };
  
  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  
  // Calculate stroke-dasharray for the circular progress
  const progress = useMemo(() => {
    const dashLength = (percentage / 100) * circumference;
    return `${dashLength} ${circumference - dashLength}`;
  }, [percentage, circumference]);
  
  return (
    <div className={`numora-panel ${className}`} data-testid="donut-chart">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Unlocks</h3>
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <span>Time Held / Holdings / Whale</span>
        </div>
      </div>
      
      {/* Circular Chart */}
      <div className="flex items-center justify-center py-6">
        <div className="relative" style={{ width: config.dimension, height: config.dimension }}>
          {/* SVG Circle */}
          <svg
            width={config.dimension}
            height={config.dimension}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={config.center}
              cy={config.center}
              r={config.radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={config.stroke}
              className="text-foreground/10"
            />
            
            {/* Progress circle */}
            <circle
              cx={config.center}
              cy={config.center}
              r={config.radius}
              fill="none"
              stroke="url(#gradient)"
              strokeWidth={config.stroke}
              strokeDasharray={progress}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--success))" />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity="0.6" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="display-number-lg">{percentage}%</div>
            <div className="text-xs text-foreground/50 mt-1">{label}</div>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="space-y-2 border-t border-border/30 pt-4">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${segment.color === 'text-success' ? 'bg-success' : 'bg-foreground/20'}`} />
              <span className="text-foreground/60">{segment.label}</span>
            </div>
            <span className={`font-medium ${segment.color}`}>{segment.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
