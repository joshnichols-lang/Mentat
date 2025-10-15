import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

interface MiniPriceChartProps {
  symbol: string;
  currentPrice: number;
  change24h: number;
}

export default function MiniPriceChart({ symbol, currentPrice, change24h }: MiniPriceChartProps) {
  // Generate simple mock data based on current price and 24h change
  const generateMockData = () => {
    const points = 24; // 24 data points
    const data = [];
    const changePercent = typeof change24h === 'string' ? parseFloat(change24h) : change24h;
    const priceChange = currentPrice * (changePercent / 100);
    const startPrice = currentPrice - priceChange;
    
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      // Create a somewhat realistic price movement
      const noise = (Math.random() - 0.5) * (Math.abs(priceChange) * 0.3);
      const price = startPrice + (priceChange * progress) + noise;
      data.push({
        time: i,
        price: Math.max(0, price),
      });
    }
    
    return data;
  };

  const data = generateMockData();
  const changePercent = typeof change24h === 'string' ? parseFloat(change24h) : change24h;
  const isPositive = changePercent >= 0;

  return (
    <div className="w-[200px] h-[80px]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold">{symbol}</span>
        <span className={`text-xs font-semibold ${isPositive ? 'text-long' : 'text-short'}`}>
          {isPositive ? '+' : ''}{change24h}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={data}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
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
