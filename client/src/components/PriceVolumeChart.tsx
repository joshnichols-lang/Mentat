import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useQuery } from "@tanstack/react-query";

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

export function PriceVolumeChart({ coin }: PriceVolumeChartProps) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Fetch volume profile data
  const { data: volumeData } = useQuery<{ success: boolean; profile: VolumeProfile }>({
    queryKey: ["/api/indicators/volume-profile", coin],
    refetchInterval: 2000,
  });

  // Subscribe to candle WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/market-data`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[Price Chart WS] Connected");
      // Subscribe to 1h candles for the selected coin
      socket.send(JSON.stringify({
        action: "subscribe",
        type: "candle",
        coin: coin,
        interval: "1h"
      }));
      console.log(`[Price Chart WS] Subscribed to candle:${coin}:1h`);
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

          setCandles(prev => {
            // Keep last 50 candles
            const updated = [...prev];
            const existingIndex = updated.findIndex(c => c.time === candleData.time);
            
            if (existingIndex >= 0) {
              updated[existingIndex] = candleData;
            } else {
              updated.push(candleData);
            }
            
            return updated.slice(-50);
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
        socket.send(JSON.stringify({
          action: "unsubscribe",
          type: "candle",
          coin: coin,
          interval: "1h"
        }));
      }
      socket.close();
    };
  }, [coin]);

  const volumeProfile = volumeData?.profile;
  const poc = volumeProfile?.pointOfControl || 0;

  // Prepare volume profile bars for display
  const volumeBars = volumeProfile?.levels.slice(0, 20).map(level => ({
    price: level.price,
    volume: level.totalVolume,
    buyVolume: level.buyVolume,
    sellVolume: level.sellVolume,
  })) || [];

  // Calculate price range from candles
  const minPrice = candles.length > 0 ? Math.min(...candles.map(c => c.low)) * 0.998 : 0;
  const maxPrice = candles.length > 0 ? Math.max(...candles.map(c => c.high)) * 1.002 : 0;

  // Custom candlestick bar
  const CandlestickBar = (props: any) => {
    const { x, y, width, payload } = props;
    
    if (!payload || !payload.open || !payload.close || !payload.high || !payload.low) {
      return null;
    }

    const isGreen = payload.close >= payload.open;
    const color = isGreen ? "#22c55e" : "#ef4444";
    
    const bodyHeight = Math.abs(payload.close - payload.open);
    const bodyY = Math.min(payload.open, payload.close);
    
    return (
      <g>
        {/* Wick */}
        <line
          x1={x + width / 2}
          y1={payload.high}
          x2={x + width / 2}
          y2={payload.low}
          stroke={color}
          strokeWidth={1}
        />
        {/* Body */}
        <rect
          x={x}
          y={bodyY}
          width={width}
          height={bodyHeight || 1}
          fill={color}
          stroke={color}
        />
      </g>
    );
  };

  return (
    <Card data-testid="card-price-volume-chart">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono">{coin} Price & Volume Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {/* Main Candlestick Chart */}
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart
                data={candles}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(time) => new Date(time).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                  stroke="#666"
                  style={{ fontSize: '10px', fontFamily: 'monospace' }}
                />
                <YAxis
                  domain={[minPrice, maxPrice]}
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
                  formatter={(value: any, name: string) => {
                    if (name === 'volume') return [value.toFixed(2), 'Volume'];
                    return [parseFloat(value).toFixed(2), name.toUpperCase()];
                  }}
                />
                <Bar
                  dataKey="open"
                  shape={<CandlestickBar />}
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Volume Profile Bars on Right */}
          <div className="w-48">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart
                layout="vertical"
                data={volumeBars}
                margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  type="number"
                  stroke="#666"
                  style={{ fontSize: '10px', fontFamily: 'monospace' }}
                />
                <YAxis 
                  type="number"
                  dataKey="price"
                  domain={[minPrice, maxPrice]}
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
                />
                <Bar dataKey="volume" fill="#666">
                  {volumeBars.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.buyVolume > entry.sellVolume ? "#22c55e" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {candles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">
            Waiting for candlestick data...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
