import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines';

interface PositionSparklineProps {
  data: number[];
  color?: string;
  fillColor?: string;
  width?: number;
  height?: number;
}

export function PositionSparkline({
  data,
  color = "hsl(var(--primary))",
  fillColor = "hsl(var(--primary) / 0.1)",
  width = 80,
  height = 30
}: PositionSparklineProps) {
  return (
    <Sparklines data={data} width={width} height={height} margin={0}>
      <SparklinesLine 
        color={color}
        style={{ 
          strokeWidth: 1.5,
          fill: fillColor
        }} 
      />
      <SparklinesSpots 
        size={2}
        style={{ 
          stroke: color,
          fill: color
        }}
      />
    </Sparklines>
  );
}
