import { useEffect, useRef, useState } from "react";
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  Time,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface TradingChartProps {
  symbol: string;
  onSymbolChange?: (symbol: string) => void;
}

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";

export default function TradingChart({ symbol, onSymbolChange }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const { mode } = useTheme();
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [isLoading, setIsLoading] = useState(true);
  const [candleData, setCandleData] = useState<Map<number, { candle: CandlestickData, volume: number }>>(new Map());

  // Minimalist monochrome colors
  const colors = {
    grid: mode === "dark" ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.05)",
    crosshair: mode === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
    border: mode === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
    text: mode === "dark" ? "#a1a1aa" : "#52525b",
    upColor: "#22c55e",
    downColor: "#ef4444",
    volumeUp: "rgba(34, 197, 94, 0.3)",
    volumeDown: "rgba(239, 68, 68, 0.3)",
  };

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
          labelBackgroundColor: colors.text,
        },
        horzLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.text,
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

    // Create volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: colors.volumeUp,
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Repaint existing data when chart recreates (e.g., on theme change)
    if (candleData.size > 0) {
      const sorted = Array.from(candleData.entries()).sort((a, b) => a[0] - b[0]);
      
      const sortedCandles = sorted.map(([_, data]) => data.candle);
      candleSeries.setData(sortedCandles);
      
      const sortedVolumes = sorted.map(([_, data]) => {
        const volumeColor = data.candle.close >= data.candle.open ? 
          colors.volumeUp : colors.volumeDown;
        
        return {
          time: data.candle.time,
          value: data.volume,
          color: volumeColor,
        };
      });
      
      volumeSeries.setData(sortedVolumes);
      
      // Fit content after repainting
      chart.timeScale().fitContent();
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    handleResize();

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [colors, mode]);

  // Fetch historical candle data and set up WebSocket
  useEffect(() => {
    let isMounted = true;
    
    // Clear chart data when symbol or timeframe changes
    setCandleData(new Map());
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData([]);
    }
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData([]);
    }
    setIsLoading(true);

    // Fetch historical data first
    const fetchHistoricalData = async () => {
      try {
        console.log(`[TradingChart] Fetching historical data for ${symbol} ${timeframe}`);
        const response = await fetch(
          `/api/hyperliquid/candles?symbol=${symbol}&interval=${timeframe}&limit=1000`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch historical candles");
        }

        const data = await response.json();
        
        if (!isMounted || !data.success) {
          return;
        }

        const candles = data.candles || [];
        console.log(`[TradingChart] Loaded ${candles.length} historical candles`);

        // Process and display historical candles
        const candleMap = new Map<number, { candle: CandlestickData, volume: number }>();
        
        candles.forEach((candle: any) => {
          if (!candle.t || !candle.o || !candle.h || !candle.l || !candle.c) {
            return;
          }

          const timestamp = Math.floor(candle.t / 1000) as Time;
          const volume = candle.v ? parseFloat(candle.v) : 0;
          
          const candlePoint: CandlestickData = {
            time: timestamp,
            open: parseFloat(candle.o),
            high: parseFloat(candle.h),
            low: parseFloat(candle.l),
            close: parseFloat(candle.c),
          };

          candleMap.set(timestamp as number, { candle: candlePoint, volume });
        });

        // Update state with historical data
        setCandleData(candleMap);

        // Sort and display on chart
        const sorted = Array.from(candleMap.entries()).sort((a, b) => a[0] - b[0]);
        
        if (candleSeriesRef.current) {
          const sortedCandles = sorted.map(([_, data]) => data.candle);
          candleSeriesRef.current.setData(sortedCandles);
        }

        if (volumeSeriesRef.current) {
          const sortedVolumes = sorted.map(([_, data]) => {
            const volumeColor = data.candle.close >= data.candle.open ? 
              colors.volumeUp : colors.volumeDown;
            
            return {
              time: data.candle.time,
              value: data.volume,
              color: volumeColor,
            };
          });
          
          volumeSeriesRef.current.setData(sortedVolumes);
        }

        // Fit content after loading historical data
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        setIsLoading(false);
      } catch (error) {
        console.error("[TradingChart] Error fetching historical data:", error);
        setIsLoading(false);
      }
    };

    // Fetch historical data first, then connect WebSocket
    fetchHistoricalData();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/market-data`;

    console.log(`[TradingChart] Connecting to ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[TradingChart] Connected, subscribing to ${symbol} ${timeframe}`);
      // Subscribe to candle data for live updates
      ws.send(JSON.stringify({
        action: "subscribe",
        type: "candle",
        coin: symbol,
        interval: timeframe,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "candle") {
          const candle = message.data;
          
          // Defensive parsing - validate required fields
          if (!candle || !candle.t || !candle.o || !candle.h || !candle.l || !candle.c) {
            console.warn("[TradingChart] Incomplete candle data:", candle);
            return;
          }

          console.log("[TradingChart] Received candle:", candle);
          
          // Convert Hyperliquid candle to lightweight-charts format
          const timestamp = Math.floor(candle.t / 1000) as Time; // Convert ms to seconds
          const volume = candle.v ? parseFloat(candle.v) : 0;
          
          const candlePoint: CandlestickData = {
            time: timestamp,
            open: parseFloat(candle.o),
            high: parseFloat(candle.h),
            low: parseFloat(candle.l),
            close: parseFloat(candle.c),
          };

          // Update candle data map with both candle and volume
          setCandleData(prev => {
            const newData = new Map(prev);
            newData.set(timestamp as number, { candle: candlePoint, volume });
            
            // Sort by time
            const sorted = Array.from(newData.entries()).sort((a, b) => a[0] - b[0]);
            
            // Update candlestick chart
            if (candleSeriesRef.current) {
              const sortedCandles = sorted.map(([_, data]) => data.candle);
              candleSeriesRef.current.setData(sortedCandles);
            }

            // Update volume histogram with full history
            if (volumeSeriesRef.current) {
              const sortedVolumes = sorted.map(([_, data]) => {
                const volumeColor = data.candle.close >= data.candle.open ? 
                  colors.volumeUp : colors.volumeDown;
                
                return {
                  time: data.candle.time,
                  value: data.volume,
                  color: volumeColor,
                };
              });
              
              volumeSeriesRef.current.setData(sortedVolumes);
            }
            
            return newData;
          });
        }
      } catch (error) {
        console.error("[TradingChart] Error parsing message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[TradingChart] WebSocket error:", error);
      setIsLoading(false);
    };

    ws.onclose = () => {
      console.log("[TradingChart] WebSocket closed");
    };

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN) {
        // Unsubscribe
        ws.send(JSON.stringify({
          action: "unsubscribe",
          type: "candle",
          coin: symbol,
          interval: timeframe,
        }));
      }
      ws.close();
    };
  }, [symbol, timeframe]);

  // Separate effect to update volume colors when theme changes (without clearing data)
  useEffect(() => {
    if (candleData.size === 0 || !volumeSeriesRef.current) return;
    
    // Recompute volume colors with new theme palette
    const sorted = Array.from(candleData.entries()).sort((a, b) => a[0] - b[0]);
    const sortedVolumes = sorted.map(([_, data]) => {
      const volumeColor = data.candle.close >= data.candle.open ? 
        colors.volumeUp : colors.volumeDown;
      
      return {
        time: data.candle.time,
        value: data.volume,
        color: volumeColor,
      };
    });
    
    volumeSeriesRef.current.setData(sortedVolumes);
  }, [colors, candleData]);

  const timeframes: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D"];

  return (
    <div className="h-full w-full flex flex-col">
      {/* Timeframe Selector */}
      <div className="flex items-center gap-1 p-2 border-b border-border/50">
        {timeframes.map((tf) => (
          <Button
            key={tf}
            variant={timeframe === tf ? "default" : "ghost"}
            size="sm"
            onClick={() => setTimeframe(tf)}
            data-testid={`button-timeframe-${tf}`}
          >
            {tf}
          </Button>
        ))}
        {isLoading && (
          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
        )}
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 mx-auto animate-spin" />
              <p className="text-sm text-tertiary">Loading chart data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
