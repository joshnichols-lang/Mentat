import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  className?: string;
}

export function LeverageSlider({ 
  value, 
  onChange, 
  min = 1, 
  max, 
  className 
}: LeverageSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  // Calculate percentage and position
  const range = max - min;
  const progress = (value - min) / range;
  const percentage = progress * 100;
  
  // Generate ruler marks (every 1x or every 5x for large ranges)
  const step = max > 20 ? 5 : 1;
  const marks = Array.from(
    { length: Math.floor(max / step) + 1 }, 
    (_, i) => i * step
  ).filter(m => m >= min && m <= max);
  
  // Major marks (every 5x or 10x)
  const majorStep = max > 50 ? 25 : max > 20 ? 10 : 5;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    onChange(newValue);
  };
  
  // Color interpolation based on leverage value
  // Green (low) -> Amber -> Orange -> Red (high)
  const getColor = (prc: number) => {
    if (prc < 33) {
      // Green to Amber
      return `color-mix(in lch, hsl(120 60% 50%) ${100 - prc * 3}%, hsl(45 100% 51%) ${prc * 3}%)`;
    } else if (prc < 66) {
      // Amber to Orange
      const localPrc = (prc - 33) * 3;
      return `color-mix(in lch, hsl(45 100% 51%) ${100 - localPrc}%, hsl(33 100% 35%) ${localPrc}%)`;
    } else {
      // Orange to Red
      const localPrc = (prc - 66) * 3;
      return `color-mix(in lch, hsl(33 100% 35%) ${100 - localPrc}%, hsl(9 84% 57%) ${localPrc}%)`;
    }
  };
  
  const currentColor = getColor(percentage);
  
  return (
    <div 
      className={cn("leverage-slider-wrapper", className)}
      style={{
        '--lev-min': min,
        '--lev-max': max,
        '--lev-val': value,
        '--lev-range': range,
        '--lev-progress': progress,
        '--lev-percentage': `${percentage}%`,
        '--lev-color': currentColor,
      } as React.CSSProperties}
    >
      {/* Ruler marks */}
      <div className="ruler" data-testid="leverage-ruler">
        {marks.map((mark) => {
          const markProgress = (mark - min) / range;
          const markPercentage = markProgress * 100;
          const isMajor = mark % majorStep === 0;
          
          // Calculate proximity to current value (for glow effect)
          const distance = Math.abs(mark - value);
          const proximity = Math.max(0, 1 - distance / 6); // Affect 6 marks around thumb
          const opacity = 0.3 + proximity * 0.7;
          const brightness = 40 + proximity * 60;
          
          return (
            <div
              key={mark}
              className={cn(
                "ruler-mark",
                isMajor && "ruler-mark-major"
              )}
              style={{
                left: `${markPercentage}%`,
                opacity,
                '--mark-brightness': `${brightness}%`,
              } as React.CSSProperties}
              data-testid={`ruler-mark-${mark}`}
            >
              {isMajor && <span className="ruler-label">{mark}x</span>}
            </div>
          );
        })}
      </div>
      
      {/* Visual track with glow */}
      <div className="track-glow" />
      <div className="track-fill" />
      
      {/* Range input */}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={handleChange}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        className={cn("leverage-input", isDragging && "dragging")}
        data-testid="input-leverage"
      />
      
      {/* Value display */}
      <output 
        className="leverage-value"
        data-testid="output-leverage-value"
      >
        {value}
      </output>
    </div>
  );
}
