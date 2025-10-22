import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface SharpeGaugeProps {
  value: number;
  min?: number;
  max?: number;
}

export function SharpeGauge({ value, min = -2, max = 4 }: SharpeGaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(min);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  // Calculate angle for the needle (-90 to 90 degrees)
  const normalizedValue = Math.max(min, Math.min(max, animatedValue));
  const percentage = ((normalizedValue - min) / (max - min));
  const angle = -90 + (percentage * 180);

  const getColor = () => {
    if (value < 0) return "text-destructive";
    if (value < 1) return "text-yellow-500";
    if (value < 2) return "text-primary";
    return "text-green-500";
  };

  const getLabel = () => {
    if (value < 0) return "Poor";
    if (value < 1) return "Fair";
    if (value < 2) return "Good";
    if (value < 3) return "Very Good";
    return "Excellent";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Sharpe Ratio</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-[2/1] flex items-center justify-center">
          {/* Gauge background */}
          <svg className="w-full h-full" viewBox="0 0 200 100">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--destructive))" />
                <stop offset="33%" stopColor="hsl(var(--yellow-500))" />
                <stop offset="66%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--green-500))" />
              </linearGradient>
            </defs>
            
            {/* Arc background */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
              strokeLinecap="round"
            />
            
            {/* Colored arc */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            
            {/* Needle */}
            <line
              x1="100"
              y1="90"
              x2="100"
              y2="30"
              stroke="hsl(var(--foreground))"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                transformOrigin: '100px 90px',
                transform: `rotate(${angle}deg)`,
                transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            />
            
            {/* Center dot */}
            <circle
              cx="100"
              cy="90"
              r="4"
              fill="hsl(var(--foreground))"
            />
          </svg>
          
          {/* Value display */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <div className={`text-2xl font-bold ${getColor()}`}>
              {value.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              {getLabel()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
