import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { apiRequest } from "@/lib/queryClient";

interface PriceLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

interface VolumeProfileSnapshot {
  coin: string;
  levels: PriceLevel[];
  minPrice: number;
  maxPrice: number;
  totalVolume: number;
  pointOfControl: number;
}

interface VolumeProfileChartProps {
  coin: string;
}

export default function VolumeProfileChart({ coin }: VolumeProfileChartProps) {
  // Subscribe to volume profile updates
  const subscribeMutation = useMutation({
    mutationFn: async (coinSymbol: string) => {
      return apiRequest('POST', '/api/indicators/volume-profile/subscribe', { coin: coinSymbol });
    }
  });

  // Unsubscribe on unmount
  const unsubscribeMutation = useMutation({
    mutationFn: async (coinSymbol: string) => {
      return apiRequest('POST', '/api/indicators/volume-profile/unsubscribe', { coin: coinSymbol });
    }
  });

  // Fetch volume profile data
  const { data: volumeProfileData } = useQuery<{ profile: VolumeProfileSnapshot }>({
    queryKey: [`/api/indicators/volume-profile/${coin}`],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  useEffect(() => {
    subscribeMutation.mutate(coin);
    
    return () => {
      unsubscribeMutation.mutate(coin);
    };
  }, [coin]);

  const profile = volumeProfileData?.profile;

  // Prepare chart data - sort by price descending (highest price at top)
  const chartData = profile?.levels
    ?.map(level => ({
      price: level.price,
      volume: level.volume,
      buyVolume: level.buyVolume,
      sellVolume: level.sellVolume,
      isPOC: level.price === profile.pointOfControl
    }))
    .sort((a, b) => b.price - a.price) || [];

  // Format volume for display
  const formatVolume = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  // Format price for display
  const formatPrice = (value: number) => {
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    });
  };

  return (
    <Card className="border-zinc-800" data-testid="card-volume-profile">
      <CardHeader className="pb-2">
        <CardTitle className="font-['Courier_New'] text-sm font-bold uppercase tracking-wide">
          Volume Profile - {coin}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {!profile || chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground font-['Courier_New'] text-xs" data-testid="text-no-volume-data">
            No volume profile data available
          </div>
        ) : (
          <div className="space-y-2">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 text-xs font-['Courier_New']">
              <div data-testid="text-total-volume">
                <div className="text-muted-foreground">Total Vol</div>
                <div className="font-bold">{formatVolume(profile.totalVolume)}</div>
              </div>
              <div data-testid="text-poc-price">
                <div className="text-muted-foreground">POC</div>
                <div className="font-bold text-yellow-600 dark:text-yellow-500">
                  ${formatPrice(profile.pointOfControl)}
                </div>
              </div>
              <div data-testid="text-price-range">
                <div className="text-muted-foreground">Range</div>
                <div className="font-bold">
                  ${formatPrice(profile.minPrice)} - ${formatPrice(profile.maxPrice)}
                </div>
              </div>
            </div>

            {/* Volume Profile Bar Chart */}
            <ResponsiveContainer width="100%" height={250} data-testid="chart-volume-profile">
              <BarChart 
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 5, left: 50, bottom: 5 }}
              >
                <XAxis 
                  type="number" 
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'Courier New' }}
                  tickFormatter={formatVolume}
                />
                <YAxis 
                  type="category" 
                  dataKey="price"
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'Courier New' }}
                  tickFormatter={formatPrice}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '4px',
                    fontFamily: 'Courier New',
                    fontSize: '11px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'volume') return [formatVolume(value), 'Total Vol'];
                    if (name === 'buyVolume') return [formatVolume(value), 'Buy Vol'];
                    if (name === 'sellVolume') return [formatVolume(value), 'Sell Vol'];
                    return [value, name];
                  }}
                  labelFormatter={(price: number) => `Price: $${formatPrice(price)}`}
                />
                <Bar dataKey="volume" radius={[0, 2, 2, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.isPOC ? '#ca8a04' : '#52525b'} // Yellow for POC, gray for others
                      fillOpacity={entry.isPOC ? 0.9 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Buy/Sell Volume Legend */}
            <div className="flex items-center justify-center gap-4 text-xs font-['Courier_New'] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-[#4d7c4a] opacity-70" />
                <span>Buy Volume</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-[#7c4a4a] opacity-70" />
                <span>Sell Volume</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-600 opacity-90" />
                <span>POC</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
