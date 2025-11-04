import { useMemo, useId } from "react";

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showFill?: boolean;
  strokeWidth?: number;
  className?: string;
}

export function SparklineChart({
  data,
  width = 60,
  height = 20,
  color,
  showFill = true,
  strokeWidth = 1.5,
  className = "",
}: SparklineChartProps) {
  const gradientId = useId();

  const { path, fillPath } = useMemo(() => {
    if (data.length === 0) return { path: "", fillPath: "" };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Calculate points
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return { x, y };
    });

    // Create line path
    const linePath = points
      .map((point, index) => {
        return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
      })
      .join(' ');

    // Create fill path
    const fill = showFill
      ? `${linePath} L ${width} ${height} L 0 ${height} Z`
      : "";

    return { path: linePath, fillPath: fill };
  }, [data, width, height, showFill]);

  // Determine color based on trend if not provided
  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
  const lineColor = color || (
    trend >= 0 
      ? "hsl(var(--success))"
      : "hsl(var(--destructive))"
  );

  if (data.length === 0) {
    return (
      <div
        className={`bg-muted/20 rounded ${className}`}
        style={{ width, height }}
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className={`inline-block ${className}`}
      style={{ overflow: 'visible' }}
    >
      {/* Fill gradient */}
      {showFill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={fillPath}
            fill={`url(#${gradientId})`}
          />
        </>
      )}

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="chart-draw"
      />
    </svg>
  );
}
