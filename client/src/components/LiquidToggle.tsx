import { useState, useEffect } from 'react';

interface LiquidToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  'data-testid'?: string;
}

export function LiquidToggle({ 
  checked, 
  onCheckedChange, 
  label,
  'data-testid': testId 
}: LiquidToggleProps) {
  const [isActive, setIsActive] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const complete = checked ? 100 : 0;

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setIsActive(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleClick = () => {
    setIsActive(true);
    onCheckedChange(!checked);
  };

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        data-active={isActive}
        data-pressed={isPressed}
        data-bounce="true"
        data-mapped="false"
        className="liquid-toggle"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          '--complete': complete,
          '--hue': 33, // Orange hue for 1fox theme
        } as React.CSSProperties}
      >
        <span className="sr-only">{label || 'Toggle'}</span>
        
        {/* SVG Filters */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            {/* Goo filter for liquid effect */}
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
            
            {/* Remove black filter for knockout effect */}
            <filter id="remove-black">
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        -1 -1 -1 1 0"
              />
            </filter>
          </defs>
        </svg>

        {/* Background indicator */}
        <div className="indicator" />

        {/* Knockout container with goo effect */}
        <div className="knockout">
          {/* Masked indicator */}
          <div className="indicator indicator--masked">
            <div className="mask" />
          </div>

          {/* Liquid wrapper with blur */}
          <div className="wrapper">
            <div className="liquids">
              <div className="liquid__shadow" />
              <div className="liquid__track" />
            </div>
          </div>

          {/* Moving indicator with liquid effect */}
          <div className="indicator__liquid">
            <div className="cover" />
            <div className="shadow" />
            <div className="liquid__track" />
          </div>
        </div>
      </button>
      {label && (
        <span className="text-sm text-foreground/80 select-none">
          {label}
        </span>
      )}
    </div>
  );
}
