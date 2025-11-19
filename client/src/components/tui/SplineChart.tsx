import { useMemo } from "react";

interface DataPoint {
  x: number;
  y: number;
}

interface SplineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  className?: string;
}

// Catmull-Rom spline interpolation for smooth curves
function catmullRomSpline(points: DataPoint[], tension = 0.5): string {
  if (points.length < 2) return "";
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
    
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  
  return path;
}

export function SplineChart({ 
  data, 
  width = 600, 
  height = 300, 
  color = "#00ffff",
  showDots = true,
  className = ""
}: SplineChartProps) {
  const { scaledData, pathD } = useMemo(() => {
    if (data.length === 0) {
      return { scaledData: [], pathD: "" };
    }
    
    // Find data bounds
    const xValues = data.map(d => d.x);
    const yValues = data.map(d => d.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    
    // Add padding
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Scale points to fit chart
    const scaled = data.map(point => ({
      x: padding + ((point.x - minX) / (maxX - minX)) * chartWidth,
      y: padding + chartHeight - ((point.y - minY) / (maxY - minY)) * chartHeight,
    }));
    
    const path = catmullRomSpline(scaled);
    
    return { scaledData: scaled, pathD: path };
  }, [data, width, height]);
  
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <span className="text-primary/30 text-xs">NO DATA</span>
      </div>
    );
  }
  
  return (
    <svg width={width} height={height} className={className}>
      <defs>
        {/* Glow filter for the line */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Pulse animation for live price dot */}
        <filter id="pulse-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Spline path */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        filter="url(#glow)"
        data-testid="spline-path"
      />
      
      {/* Data points */}
      {showDots && scaledData.map((point, idx) => {
        const isLast = idx === scaledData.length - 1;
        return (
          <circle
            key={idx}
            cx={point.x}
            cy={point.y}
            r={isLast ? 4 : 2}
            fill={isLast ? "#ffffff" : color}
            stroke={isLast ? color : "none"}
            strokeWidth={isLast ? 2 : 0}
            filter={isLast ? "url(#pulse-glow)" : undefined}
            data-testid={isLast ? "live-price-dot" : `data-dot-${idx}`}
          >
            {isLast && (
              <animate
                attributeName="r"
                values="4;6;4"
                dur="2s"
                repeatCount="indefinite"
              />
            )}
          </circle>
        );
      })}
    </svg>
  );
}

export type { DataPoint };
