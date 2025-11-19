interface TuiPanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function TuiPanel({ title, children, className = "", noPadding = false }: TuiPanelProps) {
  return (
    <div className={`relative border border-primary tui-box tui-box-shear ${className}`}>
      {/* Corner accents - box drawing characters */}
      <div className="absolute -top-[1px] -left-[1px] text-primary text-xs leading-none pointer-events-none">┌</div>
      <div className="absolute -top-[1px] -right-[1px] text-primary text-xs leading-none pointer-events-none">┐</div>
      <div className="absolute -bottom-[1px] -left-[1px] text-primary text-xs leading-none pointer-events-none">└</div>
      <div className="absolute -bottom-[1px] -right-[1px] text-primary text-xs leading-none pointer-events-none">┘</div>
      
      {/* Counter-skewed content wrapper */}
      <div className="tui-box-shear-content">
        {/* Header with title */}
        {title && (
          <div className="border-b border-primary px-2 py-1 bg-background">
            <span className="text-primary text-xs font-bold tracking-wider">
              [ # {title.toUpperCase()} ]
            </span>
          </div>
        )}
        
        {/* Content */}
        <div className={noPadding ? "" : "p-2"}>
          {children}
        </div>
      </div>
    </div>
  );
}
