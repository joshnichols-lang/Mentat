import { ReactNode, useState } from 'react';
import { GripVertical, Minimize2, Maximize2, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface WidgetProps {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function Widget({ id, title, children, onClose, className = '' }: WidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false);

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
