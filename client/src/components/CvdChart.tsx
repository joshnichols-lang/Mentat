import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface CvdDataPoint {
  coin: string;
  timestamp: number;
  cumulativeDelta: number;
  buyVolume: number;
  sellVolume: number;
  lastPrice: number;
}

interface CvdSnapshot {
  coin: string;
  data: CvdDataPoint[];
  currentDelta: number;
}

interface CvdChartProps {
  coin: string;
  maxPoints?: number;
}

export function CvdChart({ coin, maxPoints = 100 }: CvdChartProps) {
  // Subscribe to CVD data when component mounts
  const subscribeMutation = useMutation({
    mutationFn: async (coinSymbol: string) => {
      return apiRequest('POST', '/api/indicators/cvd/subscribe', { coin: coinSymbol });
    }
  });

  // Unsubscribe when component unmounts
  const unsubscribeMutation = useMutation({
    mutationFn: async (coinSymbol: string) => {
      return apiRequest('POST', '/api/indicators/cvd/unsubscribe', { coin: coinSymbol });
    }
  });

  // Fetch CVD data
  const { data: cvdData } = useQuery<{ cvd: CvdSnapshot }>({
    queryKey: [`/api/indicators/cvd/${coin}`],
    refetchInterval: 1000, // Refresh every second
  });

  useEffect(() => {
    subscribeMutation.mutate(coin);
    
    return () => {
      unsubscribeMutation.mutate(coin);
    };
  }, [coin]);

  const cvdHistory = cvdData?.cvd?.data?.slice(-maxPoints) || [];
  const currentCvd = cvdData?.cvd?.currentDelta || 0;

  const formatCvd = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (absValue >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const cvdColor = currentCvd >= 0 
    ? 'hsl(120, 25%, 35%)' // Dull green for positive (light mode)
    : 'hsl(0, 30%, 40%)';  // Dull red for negative (light mode)

  const cvdTextClass = currentCvd >= 0 
    ? 'text-long' 
    : 'text-short';

  return (
    <Card className="p-0 overflow-hidden" data-testid="cvd-chart-card">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider" data-testid="cvd-chart-title">
            Cumulative Volume Delta
          </h3>
          <span className="text-xs uppercase tracking-wider text-muted-foreground" data-testid="cvd-chart-coin">
            {coin}
          </span>
        </div>
      </div>

      {/* Current CVD Value */}
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current CVD
          </span>
          <span className={`text-2xl font-black ${cvdTextClass}`} data-testid="cvd-current-value">
            {formatCvd(currentCvd)}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4" style={{ height: '280px' }}>
        {cvdHistory.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground" data-testid="cvd-no-data">
            No CVD data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cvdHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.3}
              />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTime}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                stroke="hsl(var(--border))"
              />
              <YAxis 
                dataKey="cumulativeDelta"
                tickFormatter={formatCvd}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.375rem',
                  fontFamily: 'Courier New, monospace',
                  fontSize: '12px'
                }}
                labelFormatter={(value) => formatTime(value as number)}
                formatter={(value: number) => [formatCvd(value), 'CVD']}
              />
              <Line 
                type="monotone" 
                dataKey="cumulativeDelta" 
                stroke={cvdColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                data-testid="cvd-line"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
