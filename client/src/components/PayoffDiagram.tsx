import { useEffect, useRef, useState } from "react";
import { OptionsStrategy } from "@shared/schema";
import { calculateStrategyPnL } from "@/lib/optionsCalculations";

interface PayoffDiagramProps {
  strategy: Partial<OptionsStrategy> | null;
  currentPrice: number;
  asset: string;
}

export default function PayoffDiagram({ strategy, currentPrice, asset }: PayoffDiagramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ price: number; pnl: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !strategy) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 40, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate price range (±30% from current price)
    const priceRange = currentPrice * 0.3;
    const minPrice = currentPrice - priceRange;
    const maxPrice = currentPrice + priceRange;
    const priceStep = (maxPrice - minPrice) / 100;

    // Calculate P&L for each price point using shared helper
    const points: { price: number; pnl: number }[] = [];
    const strike = parseFloat(strategy.strike || "0");
    const lowerBreakeven = strategy.lowerBreakeven ? parseFloat(strategy.lowerBreakeven) : null;
    const upperBreakeven = strategy.upperBreakeven ? parseFloat(strategy.upperBreakeven) : null;

    // Generate P&L curve for all price points
    for (let price = minPrice; price <= maxPrice; price += priceStep) {
      const pnl = calculateStrategyPnL(strategy, price, currentPrice);
      points.push({ price, pnl });
    }

    // Find min/max P&L for scaling
    const pnlValues = points.map(p => p.pnl);
    const minPnl = Math.min(...pnlValues, 0);
    const maxPnl = Math.max(...pnlValues, 0);
    const pnlRange = Math.max(Math.abs(minPnl), Math.abs(maxPnl)) * 1.2;

    // Helper functions
    const xScale = (price: number) => {
      return padding.left + ((price - minPrice) / (maxPrice - minPrice)) * chartWidth;
    };

    const yScale = (pnl: number) => {
      return padding.top + chartHeight - ((pnl + pnlRange) / (2 * pnlRange)) * chartHeight;
    };

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = padding.left + (i / 4) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Draw zero line
    const zeroY = yScale(0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw profit zone (green)
    ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    for (const point of points) {
      if (point.pnl > 0) {
        ctx.lineTo(xScale(point.price), yScale(point.pnl));
      }
    }
    ctx.lineTo(width - padding.right, zeroY);
    ctx.closePath();
    ctx.fill();

    // Draw loss zone (red)
    ctx.fillStyle = "rgba(239, 68, 68, 0.1)";
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    for (const point of points) {
      if (point.pnl < 0) {
        ctx.lineTo(xScale(point.price), yScale(point.pnl));
      }
    }
    ctx.lineTo(width - padding.right, zeroY);
    ctx.closePath();
    ctx.fill();

    // Draw P&L curve
    ctx.strokeStyle = "rgba(251, 146, 60, 1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((point, i) => {
      const x = xScale(point.price);
      const y = yScale(point.pnl);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw current price line
    const currentPriceX = xScale(currentPrice);
    ctx.strokeStyle = "rgba(251, 146, 60, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(currentPriceX, padding.top);
    ctx.lineTo(currentPriceX, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw strike price line
    const strikeX = xScale(strike);
    ctx.strokeStyle = "rgba(147, 197, 253, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(strikeX, padding.top);
    ctx.lineTo(strikeX, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw breakeven lines
    if (lowerBreakeven) {
      const lowerBE_X = xScale(lowerBreakeven);
      ctx.strokeStyle = "rgba(234, 179, 8, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(lowerBE_X, padding.top);
      ctx.lineTo(lowerBE_X, height - padding.bottom);
      ctx.stroke();
    }

    if (upperBreakeven) {
      const upperBE_X = xScale(upperBreakeven);
      ctx.strokeStyle = "rgba(234, 179, 8, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(upperBE_X, padding.top);
      ctx.lineTo(upperBE_X, height - padding.bottom);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px 'Roboto', sans-serif";
    ctx.textAlign = "center";

    // X-axis labels (prices)
    for (let i = 0; i <= 4; i++) {
      const price = minPrice + (i / 4) * (maxPrice - minPrice);
      const x = padding.left + (i / 4) * chartWidth;
      ctx.fillText(`$${Math.round(price).toLocaleString()}`, x, height - padding.bottom + 20);
    }

    // Y-axis labels (P&L)
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const pnl = -pnlRange + (i / 4) * (2 * pnlRange);
      const y = padding.top + ((4 - i) / 4) * chartHeight;
      const sign = pnl >= 0 ? "+" : "";
      ctx.fillStyle = pnl >= 0 ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)";
      ctx.fillText(`${sign}$${Math.round(pnl).toLocaleString()}`, padding.left - 10, y + 4);
    }

    // Labels for key prices
    ctx.font = "10px 'Roboto', sans-serif";
    ctx.textAlign = "center";
    
    // Current price label
    ctx.fillStyle = "rgba(251, 146, 60, 1)";
    ctx.fillText(`Spot: $${currentPrice.toLocaleString()}`, currentPriceX, height - 5);

    // Strike price label
    ctx.fillStyle = "rgba(147, 197, 253, 1)";
    ctx.fillText(`Strike: $${Math.round(strike).toLocaleString()}`, strikeX, 15);

  }, [strategy, currentPrice, asset]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!strategy) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Calculate corresponding price
    const padding = { left: 60, right: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const priceRange = currentPrice * 0.6;
    const minPrice = currentPrice - (priceRange / 2);
    const maxPrice = currentPrice + (priceRange / 2);
    
    const price = minPrice + ((x - padding.left) / chartWidth) * (maxPrice - minPrice);
    
    // Calculate P&L at this price using shared helper
    const pnl = calculateStrategyPnL(strategy, price, currentPrice);

    setHoveredPoint({ price, pnl });
  };

  return (
    <div className="h-full w-full flex flex-col bg-background" data-testid="diagram-payoff">
      <div className="p-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Payoff Diagram
          </h3>
          {strategy && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{asset}/USD</span>
              <span className="font-semibold text-foreground">${currentPrice.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative p-4">
        {strategy ? (
          <>
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredPoint(null)}
            />
            
            {hoveredPoint && (
              <div className="absolute top-6 left-6 bg-card/90 px-3 py-1.5 rounded-md border border-border/50">
                <div className="text-xs space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-semibold text-foreground">
                      ${hoveredPoint.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">P&L:</span>
                    <span className={`font-semibold ${hoveredPoint.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {hoveredPoint.pnl >= 0 ? '+' : ''}${hoveredPoint.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              Select a strategy to view payoff diagram
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
