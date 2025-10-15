import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

interface MiniPriceChartProps {
  symbol: string;
  currentPrice: number;
  change24h: number;
}

export default function MiniPriceChart({ symbol, currentPrice, change24h }: MiniPriceChartProps) {
  // Generate deterministic mock data based on symbol hash and 24h change
  const generateDeterministicData = () => {
    const points = 24;
    const data = [];
    const changePercent = typeof change24h === 'string' ? parseFloat(change24h) : change24h;
    const priceChange = currentPrice * (changePercent / 100);
    const startPrice = currentPrice - priceChange;
    
    // Create a deterministic seed from symbol
    const symbolHash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      // Use sine wave for deterministic "noise" based on symbol hash
      const deterministicNoise = Math.sin((i + symbolHash) / 3) * (Math.abs(priceChange) * 0.15);
      const price = startPrice + (priceChange * progress) + deterministicNoise;
      data.push({
        time: i,
        price: Math.max(0, price),
      });
    }
    
    return data;
  };

  const data = generateDeterministicData();
  const changePercent = typeof change24h === 'string' ? parseFloat(change24h) : change24h;
  const isPositive = changePercent >= 0;

  return (
    <div className="w-[240px]">
      <div className="mb-2 space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">{symbol}/USD</div>
        <div className="flex items-baseline gap-2">
          <div className="text-lg font-bold font-mono">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs font-semibold ${isPositive ? 'text-long' : 'text-short'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </div>
        </div>
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
