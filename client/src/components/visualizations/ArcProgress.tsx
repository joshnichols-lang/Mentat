interface ArcProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subLabel?: string;
  showPercentage?: boolean;
  color?: string;
  className?: string;
}

export function ArcProgress({
  value,
  max = 100,
  size = 140,
  strokeWidth = 10,
  label,
  subLabel,
  showPercentage = true,
  color = "hsl(var(--foreground))",
  className = "",
}: ArcProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const percentage = Math.min(Math.max(value / max, 0), 1);
  
  // Arc from -90deg to 90deg (180deg total, bottom semi-circle)
  const startAngle = -90;
  const endAngle = 90;
  const angleRange = endAngle - startAngle;
  const currentAngle = startAngle + (angleRange * percentage);

  // Calculate arc path
  const centerX = size / 2;
  const centerY = size / 2;
  
  const startX = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
  const startY = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
  const endX = centerX + radius * Math.cos((currentAngle * Math.PI) / 180);
  const endY = centerY + radius * Math.sin((currentAngle * Math.PI) / 180);

  const largeArcFlag = angleRange * percentage > 180 ? 1 : 0;

  return (
    <div className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size * 0.6 }}>
        <svg
          width={size}
          height={size * 0.6}
          viewBox={`0 0 ${size} ${size * 0.6}`}
        >
          {/* Background arc */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${centerX + radius * Math.cos((endAngle * Math.PI) / 180)} ${centerY + radius * Math.sin((endAngle * Math.PI) / 180)}`}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="opacity-20"
          />
          
          {/* Progress arc with animation */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-800 ease-out"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          {showPercentage && (
            <span className="text-3xl font-bold font-mono tracking-tight">
              {Math.round(percentage * 100)}%
            </span>
          )}
          {subLabel && (
            <span className="text-xs text-tertiary mt-1">
              {subLabel}
            </span>
          )}
        </div>
      </div>

      {/* Label */}
      {label && (
        <span className="text-sm font-medium text-secondary">
          {label}
        </span>
      )}
    </div>
  );
}
