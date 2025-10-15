import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from "recharts";

interface TradePriceChartProps {
  symbol: string;
  entryPrice: number;
  entryTime: string;
  side: "long" | "short";
}

export default function TradePriceChart({ symbol, entryPrice, entryTime, side }: TradePriceChartProps) {
  // todo: remove mock functionality
  const generatePriceData = () => {
    const basePrice = entryPrice;
    const data = [];
    const startDate = new Date(entryTime);
    
    for (let i = 0; i < 50; i++) {
      const date = new Date(startDate.getTime() + i * 15 * 60000); // 15 min intervals
      const variance = (Math.random() - 0.5) * (basePrice * 0.02);
      const trend = side === "long" ? i * 5 : -i * 2;
      data.push({
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: basePrice + variance + trend,
        isEntry: i === 20, // Entry at 20th point
      });
    }
    return data;
  };

  const data = generatePriceData();
  const entryPoint = data.find(d => d.isEntry);
  const currentPrice = data[data.length - 1].price;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Entry Price</div>
          <div className="font-mono text-sm font-semibold">${entryPrice.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Current Price</div>
          <div className="font-mono text-sm font-semibold">${currentPrice.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Change</div>
          <div className={`font-mono text-sm font-semibold ${
            currentPrice >= entryPrice ? "text-long" : "text-short"
          }`}>
            {currentPrice >= entryPrice ? "+" : ""}
            {((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="time" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            interval={9}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            domain={['dataMin - 100', 'dataMax + 100']}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
          />
          <ReferenceLine 
            y={entryPrice} 
            stroke={side === "long" ? "hsl(var(--long))" : "hsl(var(--short))"} 
            strokeDasharray="5 5"
            label={{ 
              value: `Entry: $${entryPrice.toLocaleString()}`, 
              position: "right", 
              fill: side === "long" ? "hsl(var(--long))" : "hsl(var(--short))",
              fontSize: 12 
            }}
          />
          {entryPoint && (
            <ReferenceDot 
              x={entryPoint.time} 
              y={entryPoint.price} 
              r={6} 
              fill={side === "long" ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"} 
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          )}
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="hsl(var(--chart-1))" 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
