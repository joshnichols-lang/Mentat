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
      proName: "BINANCE:BTCUSDT.P",
      title: "BTC/USDT"
    },
    {
      proName: "BINANCE:ETHUSDT.P",
      title: "ETH/USDT"
    },
    {
      proName: "BINANCE:SOLUSDT.P",
      title: "SOL/USDT"
    },
    {
      proName: "BINANCE:ARBUSDT.P",
      title: "ARB/USDT"
    },
    {
      proName: "BINANCE:AVAXUSDT.P",
      title: "AVAX/USDT"
    }
  ],
  colorTheme = "dark",
  width = "100%",
  height = 400
}: TradingViewWatchlistProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = "";

    // Create widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: width,
      height: height,
      symbolsGroups: [
        {
          name: "Crypto Perps",
          originalName: "Crypto",
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
