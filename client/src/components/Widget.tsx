import { ReactNode, useState } from 'react';
import { GripVertical, Minimize2, Maximize2, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface WidgetProps {
  id: string;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  compact?: boolean; // Hyperliquid-style ultra-minimal chrome
}

export default function Widget({ id, title, children, onClose, className = '', compact = false }: WidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Hyperliquid compact mode: no borders, minimal padding, no title bar
  if (compact) {
    return (
      <div className={`flex flex-col h-full overflow-hidden bg-card ${className}`} data-testid={`widget-${id}`}>
        {title && (
          <div className="px-1 py-0 border-b border-border/20 shrink-0" style={{minHeight: '16px'}}>
            <h3 className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-4">{title}</h3>
          </div>
        )}
        <div className="flex-1 overflow-auto no-scrollbar p-0">
          {children}
        </div>
      </div>
    );
  }

  return (
    <Card className={`flex flex-col h-full overflow-hidden ${className}`} data-testid={`widget-${id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 shrink-0">
        {/* Drag handle */}
        <div className="drag-handle flex items-center gap-2 cursor-move flex-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            data-testid={`button-${isMinimized ? 'maximize' : 'minimize'}-${id}`}
            className="p-1 rounded hover-elevate active-elevate-2"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              data-testid={`button-close-${id}`}
              className="p-1 rounded hover-elevate active-elevate-2"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex-1 overflow-auto p-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
