interface RadialGaugeProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showValue?: boolean;
  color?: string;
  className?: string;
}

export function RadialGauge({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  label,
  showValue = true,
  color,
  className = "",
}: RadialGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const offset = circumference - percentage * circumference;

  // Determine color based on value if not provided
  const strokeColor = color || (
    value >= 0 
      ? "hsl(var(--success))"
      : "hsl(var(--destructive))"
  );

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={strokeWidth}
            className="opacity-20"
          />
          
          {/* Progress circle with animation */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-800 ease-out"
            style={{
              transitionProperty: 'stroke-dashoffset',
            }}
          />
        </svg>

        {/* Center value */}
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-mono tracking-tight">
              {Math.round(value)}
            </span>
            {max !== 100 && (
              <span className="text-xs text-tertiary">
                / {max}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Label */}
      {label && (
        <span className="text-xs font-medium text-secondary uppercase tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}
