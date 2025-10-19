import { useEffect, useRef, memo } from "react";
import { Card } from "@/components/ui/card";

interface TradingViewMarketOverviewProps {
  colorTheme?: "light" | "dark";
  width?: string | number;
  height?: number;
  showChart?: boolean;
  locale?: string;
}

function TradingViewMarketOverview({ 
  colorTheme = "dark",
  width = "100%",
  height = 400,
  showChart = true,
  locale = "en"
}: TradingViewMarketOverviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: width,
      height: height,
      defaultColumn: "overview",
      defaultScreen: "general",
      market: "crypto",
      showToolbar: true,
      colorTheme: colorTheme,
      locale: locale,
      isTransparent: false
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [colorTheme, width, height, showChart, locale]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </Card>
  );
}

export default memo(TradingViewMarketOverview);
