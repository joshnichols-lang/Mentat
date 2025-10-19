import { useEffect, useRef, memo } from "react";
import { Card } from "@/components/ui/card";

interface TradingViewWatchlistProps {
  symbols?: Array<{
    proName: string;
    title: string;
  }>;
  colorTheme?: "light" | "dark";
  width?: string | number;
  height?: number;
}

function TradingViewWatchlist({ 
  symbols = [
    {
      proName: "HYPERLIQUID:BTCUSDT.P",
      title: "BTC/USD"
    },
    {
      proName: "HYPERLIQUID:ETHUSDT.P",
      title: "ETH/USD"
    },
    {
      proName: "HYPERLIQUID:SOLUSDT.P",
      title: "SOL/USD"
    },
    {
      proName: "HYPERLIQUID:ARBUSDT.P",
      title: "ARB/USD"
    }
  ],
  colorTheme = "dark",
  width = "100%",
  height = 400
}: TradingViewWatchlistProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: width,
      height: height,
      symbolsGroups: [
        {
          name: "Hyperliquid Perps",
          originalName: "Hyperliquid",
          symbols: symbols
        }
      ],
      showSymbolLogo: true,
      colorTheme: colorTheme,
      isTransparent: false,
      locale: "en"
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbols, colorTheme, width, height]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </Card>
  );
}

export default memo(TradingViewWatchlist);
