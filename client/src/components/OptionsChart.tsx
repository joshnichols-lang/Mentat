import { useEffect, useRef, useState } from "react";
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  Time,
  CandlestickSeries,
  LineData,
  LineSeries,
  AreaSeries,
  IPriceLine,
} from "lightweight-charts";
import { useTheme } from "@/components/ThemeProvider";
import { Loader2 } from "lucide-react";
import { OptionsStrategy } from "@shared/schema";

interface OptionsChartProps {
  asset: string; // Underlying asset (BTC, ETH, etc.)
  selectedStrategy?: OptionsStrategy | null;
  onPriceUpdate?: (currentPrice: number) => void;
}

// Theme-specific color configurations (matching TradingChart)
const themeColors = {
  fox: {
    dark: {
      grid: "rgba(255, 163, 82, 0.05)",
      crosshair: "rgba(255, 163, 82, 0.4)",
      crosshairBg: "#B06000",
      border: "rgba(255, 163, 82, 0.1)",
      upColor: "#FFC107",
      downColor: "#F54E2E",
      profitZone: "rgba(34, 197, 94, 0.15)", // Green for profit
      lossZone: "rgba(239, 68, 68, 0.15)", // Red for loss
      strikePrice: "rgba(147, 197, 253, 0.6)", // Blue for strikes
      breakevenPoint: "#FFC107", // Yellow/gold for breakevens
      text: "#9ca3af",
    },
    light: {
      grid: "rgba(176, 96, 0, 0.08)",
      crosshair: "rgba(176, 96, 0, 0.5)",
      crosshairBg: "#B06000",
      border: "rgba(176, 96, 0, 0.15)",
      upColor: "#D4A500",
      downColor: "#D64324",
      profitZone: "rgba(34, 197, 94, 0.2)",
      lossZone: "rgba(220, 38, 38, 0.2)",
      strikePrice: "rgba(59, 130, 246, 0.7)",
      breakevenPoint: "#D4A500",
      text: "#374151",
    },
  },
};

export default function OptionsChart({ 
  asset, 
  selectedStrategy, 
  onPriceUpdate 
}: OptionsChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const profitZoneSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const lossZoneSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const strikeLinesRef = useRef<IPriceLine[]>([]);
  const breakevenLinesRef = useRef<IPriceLine[]>([]);
  const maxProfitLineRef = useRef<IPriceLine | null>(null);
  const maxLossLineRef = useRef<IPriceLine | null>(null);
  
  const { themeName, mode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [candleData, setCandleData] = useState<Map<number, CandlestickData>>(new Map());
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Get current theme colors (default to fox theme)
  const colors = themeColors[themeName as keyof typeof themeColors]?.[mode as keyof typeof themeColors.fox] || themeColors.fox.dark;

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: colors.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.crosshairBg,
        },
        horzLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.crosshairBg,
        },
      },
      rightPriceScale: {
        borderColor: colors.border,
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Create candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderUpColor: colors.upColor,
      borderDownColor: colors.downColor,
      wickUpColor: colors.upColor,
      wickDownColor: colors.downColor,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Repaint existing data when chart recreates (e.g., on theme change)
    if (candleData.size > 0) {
      const sorted = Array.from(candleData.entries()).sort((a, b) => a[0] - b[0]);
      const sortedCandles = sorted.map(([_, candle]) => candle);
      candleSeries.setData(sortedCandles);
      chart.timeScale().fitContent();
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [colors, themeName, mode]);

  // Fetch historical candle data and set up WebSocket
  useEffect(() => {
    let isMounted = true;
    
    // Clear chart data when asset changes
    setCandleData(new Map());
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData([]);
    }
    setIsLoading(true);

    // Fetch historical data first
    const fetchHistoricalData = async () => {
      try {
        console.log(`[OptionsChart] Fetching historical data for ${asset}`);
        const response = await fetch(
          `/api/hyperliquid/candles?symbol=${asset}&interval=1h&limit=200`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch historical candles");
        }

        const data = await response.json();
        
        if (!isMounted || !data.success) {
          return;
        }

        const candles = data.candles || [];
        console.log(`[OptionsChart] Loaded ${candles.length} historical candles`);

        // Process and display historical candles
        const candleMap = new Map<number, CandlestickData>();
        
        candles.forEach((candle: any) => {
          if (!candle.t || !candle.o || !candle.h || !candle.l || !candle.c) {
            return;
          }

          const timestamp = Math.floor(candle.t / 1000) as Time;
          
          const candlePoint: CandlestickData = {
            time: timestamp,
            open: parseFloat(candle.o),
            high: parseFloat(candle.h),
            low: parseFloat(candle.l),
            close: parseFloat(candle.c),
          };

          candleMap.set(timestamp as number, candlePoint);
        });

        // Update state with historical data
        setCandleData(candleMap);

        // Sort and display on chart
        const sorted = Array.from(candleMap.entries()).sort((a, b) => a[0] - b[0]);
        
        if (candleSeriesRef.current) {
          const sortedCandles = sorted.map(([_, candle]) => candle);
          candleSeriesRef.current.setData(sortedCandles);
          
          // Set current price from latest candle
          if (sortedCandles.length > 0) {
            const latestPrice = sortedCandles[sortedCandles.length - 1].close;
            setCurrentPrice(latestPrice);
            onPriceUpdate?.(latestPrice);
          }
        }

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        setIsLoading(false);
      } catch (error) {
        console.error("[OptionsChart] Error fetching historical data:", error);
        setIsLoading(false);
      }
    };

    fetchHistoricalData();

    // Set up WebSocket for live price updates
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[OptionsChart] WebSocket connected for ${asset}`);
      ws.send(JSON.stringify({
        method: "subscribe",
        subscription: { type: "candle", coin: asset, interval: "1h" },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.channel === "candle" && message.data?.s === asset) {
          const candle = message.data;
          const timestamp = Math.floor(candle.t / 1000) as Time;
          
          const candlePoint: CandlestickData = {
            time: timestamp,
            open: parseFloat(candle.o),
            high: parseFloat(candle.h),
            low: parseFloat(candle.l),
            close: parseFloat(candle.c),
          };

          // Update candle data
          setCandleData(prev => {
            const updated = new Map(prev);
            updated.set(timestamp as number, candlePoint);
            return updated;
          });

          // Update chart
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(candlePoint);
          }

          // Update current price
          const newPrice = candlePoint.close;
          setCurrentPrice(newPrice);
          onPriceUpdate?.(newPrice);
        }
      } catch (error) {
        console.error("[OptionsChart] WebSocket message error:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[OptionsChart] WebSocket error:", error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          method: "unsubscribe",
          subscription: { type: "candle", coin: asset, interval: "1h" },
        }));
      }
      ws.close();
      isMounted = false;
    };
  }, [asset]);

  // Draw strategy overlays (strike prices, breakeven points, P&L visualization)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    // Clear existing lines and zones
    strikeLinesRef.current.forEach(line => candleSeriesRef.current?.removePriceLine(line));
    breakevenLinesRef.current.forEach(line => candleSeriesRef.current?.removePriceLine(line));
    if (maxProfitLineRef.current) {
      candleSeriesRef.current?.removePriceLine(maxProfitLineRef.current);
      maxProfitLineRef.current = null;
    }
    if (maxLossLineRef.current) {
      candleSeriesRef.current?.removePriceLine(maxLossLineRef.current);
      maxLossLineRef.current = null;
    }
    
    // Remove zone series if exist
    if (profitZoneSeriesRef.current) {
      chartRef.current.removeSeries(profitZoneSeriesRef.current);
      profitZoneSeriesRef.current = null;
    }
    if (lossZoneSeriesRef.current) {
      chartRef.current.removeSeries(lossZoneSeriesRef.current);
      lossZoneSeriesRef.current = null;
    }
    
    strikeLinesRef.current = [];
    breakevenLinesRef.current = [];

    if (!selectedStrategy) return;

    // Draw strike price line
    if (selectedStrategy.strike) {
      const strikePrice = parseFloat(selectedStrategy.strike);
      const strikeLine = candleSeriesRef.current!.createPriceLine({
        price: strikePrice,
        color: colors.strikePrice,
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `Strike: $${strikePrice.toLocaleString()}`,
      });
      strikeLinesRef.current.push(strikeLine);
    }

    // Draw breakeven price lines
    const breakevenPrices: number[] = [];
    if (selectedStrategy.upperBreakeven) {
      breakevenPrices.push(parseFloat(selectedStrategy.upperBreakeven));
    }
    if (selectedStrategy.lowerBreakeven) {
      breakevenPrices.push(parseFloat(selectedStrategy.lowerBreakeven));
    }
    
    breakevenPrices.forEach((breakeven, index) => {
      const breakevenLine = candleSeriesRef.current!.createPriceLine({
        price: breakeven,
        color: colors.breakevenPoint,
        lineWidth: 3,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: `Breakeven ${index + 1}: $${breakeven.toLocaleString()}`,
      });
      breakevenLinesRef.current.push(breakevenLine);
    });

    // Draw max profit/loss lines
    if (selectedStrategy.maxProfit && parseFloat(selectedStrategy.maxProfit) > 0) {
      const maxProfitPrice = parseFloat(selectedStrategy.underlyingPrice) + parseFloat(selectedStrategy.maxProfit);
      maxProfitLineRef.current = candleSeriesRef.current!.createPriceLine({
        price: maxProfitPrice,
        color: colors.profitZone.replace(/[\d.]+\)$/, '0.8)'), // More opaque
        lineWidth: 2,
        lineStyle: 3, // Dotted
        axisLabelVisible: true,
        title: `Max Profit: $${parseFloat(selectedStrategy.maxProfit).toLocaleString()}`,
      });
    }

    if (selectedStrategy.maxLoss) {
      const maxLossPrice = parseFloat(selectedStrategy.underlyingPrice) - parseFloat(selectedStrategy.maxLoss);
      maxLossLineRef.current = candleSeriesRef.current!.createPriceLine({
        price: maxLossPrice,
        color: colors.lossZone.replace(/[\d.]+\)$/, '0.8)'), // More opaque
        lineWidth: 2,
        lineStyle: 3, // Dotted
        axisLabelVisible: true,
        title: `Max Loss: $${parseFloat(selectedStrategy.maxLoss).toLocaleString()}`,
      });
    }

    // Create visual profit/loss zone overlays
    // Use the candleData to create background zones showing profit/loss regions
    if (candleData.size > 0 && breakevenPrices.length > 0) {
      const sortedCandles = Array.from(candleData.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, candle]) => candle);
      
      // Get the time range from candle data
      if (sortedCandles.length >= 2) {
        const startTime = sortedCandles[0].time;
        const endTime = sortedCandles[sortedCandles.length - 1].time;
        
        // Create profit zone overlay (green shaded area above upper breakeven)
        if (selectedStrategy.upperBreakeven) {
          const upperBreakeven = parseFloat(selectedStrategy.upperBreakeven);
          const maxProfitLevel = selectedStrategy.maxProfit 
            ? parseFloat(selectedStrategy.underlyingPrice) + parseFloat(selectedStrategy.maxProfit)
            : upperBreakeven * 1.2; // 20% above if no max profit
          
          const profitZoneData: LineData[] = [
            { time: startTime, value: upperBreakeven },
            { time: endTime, value: upperBreakeven },
          ];
          
          const profitZone = chartRef.current.addSeries(AreaSeries, {
            lineColor: colors.profitZone,
            topColor: colors.profitZone,
            bottomColor: 'transparent',
            invertFilledArea: true, // Shade ABOVE the line (profit zone)
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          
          profitZone.setData(profitZoneData);
          profitZoneSeriesRef.current = profitZone;
        }
        
        // Create loss zone overlay (red shaded area below lower breakeven or strike)
        const lossThreshold = selectedStrategy.lowerBreakeven 
          ? parseFloat(selectedStrategy.lowerBreakeven)
          : selectedStrategy.strike 
            ? parseFloat(selectedStrategy.strike)
            : null;
            
        if (lossThreshold) {
          const maxLossLevel = selectedStrategy.maxLoss
            ? parseFloat(selectedStrategy.underlyingPrice) - parseFloat(selectedStrategy.maxLoss)
            : lossThreshold * 0.8; // 20% below if no max loss
          
          const lossZoneData: LineData[] = [
            { time: startTime, value: lossThreshold },
            { time: endTime, value: lossThreshold },
          ];
          
          const lossZone = chartRef.current.addSeries(AreaSeries, {
            lineColor: colors.lossZone,
            topColor: 'transparent',
            bottomColor: colors.lossZone,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          
          lossZone.setData(lossZoneData);
          lossZoneSeriesRef.current = lossZone;
        }
      }
    }

  }, [selectedStrategy, colors, currentPrice, candleData]);

  return (
    <div className="relative w-full h-full glass rounded-md" data-testid="chart-options">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2 glass-strong p-6 rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading chart...</p>
          </div>
        </div>
      )}
      
      <div 
        ref={chartContainerRef} 
        className="w-full h-full rounded-md overflow-hidden"
        data-testid="chart-options-container"
      />

      {/* Current price indicator */}
      {currentPrice && (
        <div className="absolute top-2 left-2 glass-strong px-3 py-1.5 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Current Price:</span>
            <span className="text-sm font-semibold text-foreground" data-testid="text-current-price">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Strategy info */}
      {selectedStrategy && (
        <div className="absolute top-2 right-2 glass-strong px-3 py-1.5 rounded-md max-w-xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">{selectedStrategy.name}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{selectedStrategy.type}</span>
            </div>
            {(selectedStrategy.upperBreakeven || selectedStrategy.lowerBreakeven) && (
              <div className="text-xs text-muted-foreground">
                Breakevens: {[
                  selectedStrategy.upperBreakeven && `$${parseFloat(selectedStrategy.upperBreakeven).toLocaleString()}`,
                  selectedStrategy.lowerBreakeven && `$${parseFloat(selectedStrategy.lowerBreakeven).toLocaleString()}`
                ].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
