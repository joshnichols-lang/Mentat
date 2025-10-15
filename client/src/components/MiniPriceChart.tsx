import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";

interface MiniPriceChartProps {
  symbol: string;
  currentPrice: number;
  change24h: number;
}

export default function MiniPriceChart({ symbol, currentPrice, change24h }: MiniPriceChartProps) {
  // Generate deterministic 48-hour hourly data based on symbol hash and 24h change
  const generateHourlyData = () => {
    const points = 48; // 48 hours of data
    const data = [];
    const changePercent = typeof change24h === 'string' ? parseFloat(change24h) : change24h;
    const priceChange = currentPrice * (changePercent / 100);
    const startPrice = currentPrice - priceChange;
    
    // Create a deterministic seed from symbol
    const symbolHash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      // Use sine wave for deterministic "noise" based on symbol hash
      const deterministicNoise = Math.sin((i + symbolHash) / 4) * (Math.abs(priceChange) * 0.12);
      const price = startPrice + (priceChange * progress) + deterministicNoise;
      
      // Calculate hours ago (48 hours ago to now)
      const hoursAgo = points - i - 1;
      
      data.push({
        time: i,
        price: Math.max(0, price),
        label: hoursAgo === 0 ? 'Now' : `-${hoursAgo}h`,
      });
    }
    
    return data;
  };

  const data = generateHourlyData();
  const changePercent = typeof change24h === 'string' ? parseFloat(change24h) : change24h;
  const isPositive = changePercent >= 0;

  return (
    <div className="w-[320px]">
      <div className="mb-2 space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">{symbol}/USD</div>
        <div className="flex items-baseline gap-2">
          <div className="text-xl font-bold font-mono">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-sm font-semibold ${isPositive ? 'text-long' : 'text-short'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Past 48 hours</div>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis 
            dataKey="time" 
            hide 
          />
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-background border px-2 py-1 text-xs">
                    <div className="font-mono">${payload[0].value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-muted-foreground">{data.label}</div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={isPositive ? 'hsl(var(--long))' : 'hsl(var(--short))'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
