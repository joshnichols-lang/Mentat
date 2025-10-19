import { useEffect, useRef, memo } from "react";
import { Card } from "@/components/ui/card";

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: "light" | "dark";
  height?: number;
}

function TradingViewChart({ 
  symbol = "HYPERLIQUID:BTCUSDT.P",
  interval = "15",
  theme = "dark",
  height = 500
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: interval,
          timezone: "Etc/UTC",
          theme: theme,
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          save_image: false,
          container_id: containerRef.current.id,
          studies: [
            "STD;SMA"
          ],
          disabled_features: [
            "use_localstorage_for_settings"
          ],
          enabled_features: [
            "study_templates"
          ],
          loading_screen: { backgroundColor: "#131722" }
        });
      }
    };

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, interval, theme]);

  return (
    <Card className="p-0 overflow-hidden">
      <div 
        id={`tradingview_${Math.random().toString(36).substring(7)}`}
        ref={containerRef}
        style={{ height: `${height}px` }}
      />
    </Card>
  );
}

export default memo(TradingViewChart);
