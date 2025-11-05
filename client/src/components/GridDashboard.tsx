import { useState, useEffect, ReactNode } from 'react';
import GridLayout, { Layout, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useToast } from '@/hooks/use-toast';

// Responsive grid layout that auto-adjusts to container width
const ResponsiveGridLayout = WidthProvider(GridLayout);

interface GridDashboardProps {
  tab: string;
  children: ReactNode[];
  defaultLayouts: Layout[];
  onLayoutChange?: (layouts: Layout[]) => void;
  cols?: number;
  rowHeight?: number;
}

export default function GridDashboard({
  tab,
  children,
  defaultLayouts,
  onLayoutChange,
  cols = 12,
  rowHeight = 30,
}: GridDashboardProps) {
  const [layouts, setLayouts] = useState<Layout[]>(defaultLayouts);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  // Load saved layout on mount
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const response = await fetch(`/api/panel-layouts/${tab}`);
        if (response.ok) {
          const data = await response.json();
          if (data.layoutData && Array.isArray(data.layoutData)) {
            setLayouts(data.layoutData);
          }
        }
      } catch (error) {
        console.error('Failed to load panel layout:', error);
      } finally {
        setMounted(true);
      }
    };
    loadLayout();
  }, [tab]);

  // Save layout changes
  const handleLayoutChange = async (newLayout: Layout[]) => {
    setLayouts(newLayout);
    onLayoutChange?.(newLayout);

    try {
      await fetch(`/api/panel-layouts/${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutData: newLayout }),
      });
    } catch (error) {
      console.error('Failed to save panel layout:', error);
      toast({
        variant: 'destructive',
        title: 'Layout Save Failed',
        description: 'Could not save your panel layout changes.',
      });
    }
  };

  // Reset to default layout
  const resetLayout = async () => {
    setLayouts(defaultLayouts);
    onLayoutChange?.(defaultLayouts);

    try {
      await fetch(`/api/panel-layouts/${tab}`, {
        method: 'DELETE',
      });
      toast({
        title: 'Layout Reset',
        description: 'Dashboard layout has been reset to default.',
      });
    } catch (error) {
      console.error('Failed to reset panel layout:', error);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading layout...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ResponsiveGridLayout
        className="layout"
        layout={layouts}
        cols={cols}
        rowHeight={rowHeight}
        onLayoutChange={handleLayoutChange}
        isDraggable={true}
        isResizable={true}
        compactType="vertical"
        preventCollision={false}
        margin={[8, 8]}
        containerPadding={[8, 8]}
        draggableHandle=".drag-handle"
      >
        {children}
      </ResponsiveGridLayout>

      {/* Reset button */}
      <button
        onClick={resetLayout}
        data-testid="button-reset-layout"
        className="fixed bottom-4 right-4 px-4 py-2 bg-card/80 backdrop-blur-sm border border-border rounded-md text-sm hover-elevate active-elevate-2 z-50"
      >
        Reset Layout
      </button>
    </div>
  );
}
