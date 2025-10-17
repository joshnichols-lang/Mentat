import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface VolumeLevel {
  price: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
}

interface VolumeProfile {
  coin: string;
  levels: VolumeLevel[];
  pointOfControl: number;
}

interface PriceVolumeChartProps {
  coin: string;
}

type TimeFrame = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAME_CONFIG = {
  "1m": { label: "1min", interval: "1m", historyCount: 100 },
  "5m": { label: "5min", interval: "5m", historyCount: 100 },
  "15m": { label: "15min", interval: "15m", historyCount: 100 },
  "1h": { label: "1hr", interval: "1h", historyCount: 100 },
  "4h": { label: "4hr", interval: "4h", historyCount: 100 },
  "1d": { label: "1day", interval: "1d", historyCount: 100 },
};

export function PriceVolumeChart({ coin }: PriceVolumeChartProps) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [allCandles, setAllCandles] = useState<CandleData[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [timeframe, setTimeframe] = useState<TimeFrame>("1h");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Zoom and pan state
  const [refAreaLeft, setRefAreaLeft] = useState<string | number>("");
  const [refAreaRight, setRefAreaRight] = useState<string | number>("");
  const [left, setLeft] = useState<string | number>("dataMin");
  const [right, setRight] = useState<string | number>("dataMax");
  const [top, setTop] = useState<string | number>("dataMax+10");
  const [bottom, setBottom] = useState<string | number>("dataMin-10");

  // Fetch volume profile data
  const { data: volumeData } = useQuery<{ success: boolean; profile: VolumeProfile }>({
    queryKey: ["/api/indicators/volume-profile", coin],
    refetchInterval: 2000,
  });

  // Calculate time in ms for different intervals
  const getIntervalMs = (interval: string) => {
    const map: { [key: string]: number } = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
    };
    return map[interval] || 60 * 60 * 1000;
  };

  // Fetch historical candles
  const fetchHistoricalCandles = useCallback(async (tf: TimeFrame, loadMore: boolean = false) => {
    setIsLoadingHistory(true);
    try {
      const config = TIMEFRAME_CONFIG[tf];
      const intervalMs = getIntervalMs(config.interval);
      const oldestTime = loadMore && allCandles.length > 0 
        ? Math.min(...allCandles.map(c => c.time)) 
        : Date.now();
      
      const startTime = oldestTime - (config.historyCount * intervalMs);
      const endTime = loadMore ? oldestTime : Date.now();

      const response = await fetch(`https://api.hyperliquid.xyz/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: {
            coin: coin,
            interval: config.interval,
            startTime,
            endTime
          }
        })
      });
      
      const data = await response.json();
      if (data && Array.isArray(data)) {
        const historicalCandles: CandleData[] = data.map((c: any) => ({
          time: c.t,
          open: parseFloat(c.o),
          high: parseFloat(c.h),
          low: parseFloat(c.l),
          close: parseFloat(c.c),
          volume: parseFloat(c.v),
        }));

        if (loadMore) {
          // Prepend older candles
          setAllCandles(prev => [...historicalCandles, ...prev]);
        } else {
          // Initial load
          setAllCandles(historicalCandles);
          setCandles(historicalCandles.slice(-50)); // Show last 50
        }
        
        console.log("[Price Chart] Loaded", historicalCandles.length, "candles for", tf);
      }
    } catch (err) {
      console.error("[Price Chart] Error fetching historical candles:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [coin, allCandles]);

  // Initial load when coin or timeframe changes
  useEffect(() => {
    fetchHistoricalCandles(timeframe, false);
    // Reset zoom when timeframe changes
    setLeft("dataMin");
    setRight("dataMax");
    setTop("dataMax+10");
    setBottom("dataMin-10");
  }, [coin, timeframe]);

  // Update visible candles when allCandles changes
  useEffect(() => {
    if (allCandles.length > 0) {
      setCandles(allCandles);
    }
  }, [allCandles]);

  // Subscribe to WebSocket for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/market-data`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[Price Chart WS] Connected");
      const config = TIMEFRAME_CONFIG[timeframe];
      socket.send(JSON.stringify({
        action: "subscribe",
        type: "candle",
        coin: coin,
        interval: config.interval
      }));
      console.log(`[Price Chart WS] Subscribed to candle:${coin}:${config.interval}`);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "candle" && message.data.s === coin) {
          const candleData: CandleData = {
            time: message.data.t,
            open: parseFloat(message.data.o),
            high: parseFloat(message.data.h),
            low: parseFloat(message.data.l),
            close: parseFloat(message.data.c),
            volume: parseFloat(message.data.v),
          };

          setAllCandles(prev => {
            const updated = [...prev];
            const existingIndex = updated.findIndex(c => c.time === candleData.time);
            
            if (existingIndex >= 0) {
              updated[existingIndex] = candleData;
            } else {
              updated.push(candleData);
            }
            
            return updated.sort((a, b) => a.time - b.time);
          });
        }
      } catch (err) {
        console.error("[Price Chart WS] Error parsing message:", err);
      }
    };

    socket.onerror = (error) => {
      console.error("[Price Chart WS] Error:", error);
    };

    socket.onclose = () => {
      console.log("[Price Chart WS] Disconnected");
    };

    setWs(socket);

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        const config = TIMEFRAME_CONFIG[timeframe];
        socket.send(JSON.stringify({
          action: "unsubscribe",
          type: "candle",
          coin: coin,
          interval: config.interval
        }));
      }
      socket.close();
    };
  }, [coin, timeframe]);

  // Zoom handlers
  const zoom = useCallback(() => {
    if (refAreaLeft === refAreaRight || refAreaRight === "") {
      setRefAreaLeft("");
      setRefAreaRight("");
      return;
    }

    // Ensure left < right
    let left = refAreaLeft;
    let right = refAreaRight;
    if (refAreaLeft > refAreaRight) {
      [left, right] = [right, left];
    }

    setLeft(left);
    setRight(right);
    setRefAreaLeft("");
    setRefAreaRight("");
  }, [refAreaLeft, refAreaRight]);

  const zoomOut = useCallback(() => {
    setLeft("dataMin");
    setRight("dataMax");
    setTop("dataMax+10");
    setBottom("dataMin-10");
  }, []);

  const zoomIn = useCallback(() => {
    if (candles.length < 10) return;
    
    const visibleCandles = candles.filter((c) => {
      if (left === "dataMin" && right === "dataMax") return true;
      return c.time >= (left as number) && c.time <= (right as number);
    });

    if (visibleCandles.length < 4) return;

    const mid = Math.floor(visibleCandles.length / 2);
    const newLeft = visibleCandles[Math.floor(mid * 0.25)].time;
    const newRight = visibleCandles[Math.floor(mid * 1.75)].time;
    
    setLeft(newLeft);
    setRight(newRight);
  }, [candles, left, right]);

  const resetScale = useCallback(() => {
    setLeft("dataMin");
    setRight("dataMax");
    setTop("dataMax+10");
    setBottom("dataMin-10");
  }, []);

  // Load more data when scrolling to edges
  const handleMouseMove = useCallback((e: any) => {
    if (!e) return;
    
    // Check if near left edge and load more history
    if (e.activeLabel && candles.length > 0) {
      const firstVisibleTime = typeof left === "number" ? left : candles[0]?.time;
      if (e.activeLabel <= firstVisibleTime && !isLoadingHistory) {
        fetchHistoricalCandles(timeframe, true);
      }
    }
  }, [candles, left, isLoadingHistory, timeframe, fetchHistoricalCandles]);

  const volumeProfile = volumeData?.profile;
  const poc = volumeProfile?.pointOfControl || 0;

  // Calculate visible data based on zoom
  const visibleData = candles.filter((item) => {
    if (left === "dataMin" && right === "dataMax") return true;
    return item.time >= (left as number) && item.time <= (right as number);
  });

  const minPrice = visibleData.length > 0 ? Math.min(...visibleData.map(c => c.low)) * 0.998 : 0;
  const maxPrice = visibleData.length > 0 ? Math.max(...visibleData.map(c => c.high)) * 1.002 : 0;

  return (
    <Card data-testid="card-price-volume-chart">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono">{coin} Price Chart</CardTitle>
          
          {/* Timeframe Selector */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(Object.keys(TIMEFRAME_CONFIG) as TimeFrame[]).map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(tf)}
                  className="h-7 px-2 font-mono text-xs"
                  data-testid={`button-timeframe-${tf}`}
                >
                  {TIMEFRAME_CONFIG[tf].label}
                </Button>
              ))}
            </div>
            
            {/* Zoom Controls */}
            <div className="flex gap-1 ml-2 border-l pl-2">
              <Button
                variant="outline"
                size="sm"
                onClick={zoomIn}
                className="h-7 w-7 p-0"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                className="h-7 w-7 p-0"
                data-testid="button-zoom-out"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetScale}
                className="h-7 w-7 p-0"
                data-testid="button-reset-scale"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={candles}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            onMouseDown={(e) => setRefAreaLeft(e?.activeLabel || "")}
            onMouseMove={(e) => {
              handleMouseMove(e);
              if (refAreaLeft) setRefAreaRight(e?.activeLabel || "");
            }}
            onMouseUp={zoom}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              allowDataOverflow
              dataKey="time"
              domain={[left, right]}
              type="number"
              tickFormatter={(time) => {
                const date = new Date(time);
                if (timeframe === "1m" || timeframe === "5m" || timeframe === "15m") {
                  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                } else if (timeframe === "1h" || timeframe === "4h") {
                  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
                } else {
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
              }}
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
            />
            <YAxis
              allowDataOverflow
              domain={[bottom, top]}
              type="number"
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tickFormatter={(val) => val.toFixed(2)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
              labelFormatter={(time) => new Date(time as number).toLocaleString()}
              formatter={(value: any) => [parseFloat(value).toFixed(2), 'Price']}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              animationDuration={300}
            />
            {poc > 0 && (
              <ReferenceLine
                y={poc}
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                  value: 'POC',
                  position: 'right',
                  fill: '#fbbf24',
                  fontSize: 10,
                  fontFamily: 'monospace'
                }}
              />
            )}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea
                x1={refAreaLeft}
                x2={refAreaRight}
                strokeOpacity={0.3}
                fill="#8884d8"
                fillOpacity={0.3}
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {candles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">
            Loading price data...
          </div>
        )}

        <div className="mt-2 text-xs text-muted-foreground font-mono">
          {isLoadingHistory && "Loading more history..."}
          {!isLoadingHistory && candles.length > 0 && (
            <>Showing {visibleData.length} of {candles.length} candles • Click and drag to zoom • Scroll left for more history</>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
