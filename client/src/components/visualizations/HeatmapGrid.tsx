import { useMemo } from "react";

interface HeatmapCell {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
}

interface HeatmapGridProps {
  cells: HeatmapCell[];
  columns?: number;
  cellSize?: number;
  gap?: number;
  showLabels?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function HeatmapGrid({
  cells,
  columns = 4,
  cellSize = 60,
  gap = 4,
  showLabels = true,
  showTooltip = true,
  className = "",
}: HeatmapGridProps) {
  // Calculate total for percentage sizing if not provided
  const total = useMemo(() => {
    return cells.reduce((sum, cell) => sum + Math.abs(cell.value), 0);
  }, [cells]);

  // Sort cells by value (largest first) for better visual hierarchy
  const sortedCells = useMemo(() => {
    return [...cells].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [cells]);

  return (
    <div className={`inline-block ${className}`}>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
          gap: `${gap}px`,
        }}
      >
        {sortedCells.map((cell, index) => {
          const percentage = cell.percentage || (Math.abs(cell.value) / total) * 100;
          const isPositive = cell.value >= 0;
          
          // Scale cell slightly based on value
          const scale = 0.7 + (percentage / 100) * 0.3; // Range from 0.7 to 1.0
          
          // Determine background intensity based on value
          const intensity = Math.min(percentage / 50, 1); // Max intensity at 50%
          
          const backgroundColor = cell.color || (
            isPositive
              ? `hsl(var(--success) / ${intensity * 0.3})`
              : `hsl(var(--destructive) / ${intensity * 0.3})`
          );

          return (
            <div
              key={index}
              className="heatmap-cell relative rounded-md transition-all duration-200 cursor-pointer group"
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor,
                transform: `scale(${scale})`,
              }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                {showLabels && (
                  <>
                    <span className="text-xs font-medium text-secondary truncate w-full">
                      {cell.label}
                    </span>
                    <span className={`text-sm font-mono font-bold ${isPositive ? 'text-long' : 'text-short'}`}>
                      {isPositive ? '+' : ''}{cell.value.toFixed(1)}%
                    </span>
                  </>
                )}
              </div>

              {/* Tooltip on hover */}
              {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="bg-popover border border-border rounded-md px-3 py-2 text-xs shadow-lg whitespace-nowrap">
                    <div className="font-medium">{cell.label}</div>
                    <div className="text-tertiary mt-1">
                      {isPositive ? '+' : ''}{cell.value.toFixed(2)}% ({percentage.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
