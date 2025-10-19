import { useEffect, useRef, memo } from "react";
import { Card } from "@/components/ui/card";

interface TradingViewWatchlistProps {
  colorTheme?: "light" | "dark";
  width?: string | number;
  height?: number;
}

function TradingViewWatchlist({ 
  colorTheme = "dark",
  width = "100%",
  height = 500
}: TradingViewWatchlistProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = "";

    // Create widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: colorTheme,
      dateRange: "1D",
      showChart: true,
      locale: "en",
      width: width,
      height: height,
      largeChartUrl: "",
      isTransparent: false,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      plotLineColorGrowing: "rgba(41, 98, 255, 1)",
      plotLineColorFalling: "rgba(41, 98, 255, 1)",
      gridLineColor: "rgba(42, 46, 57, 0)",
      scaleFontColor: "rgba(134, 137, 147, 1)",
      belowLineFillColorGrowing: "rgba(41, 98, 255, 0.12)",
      belowLineFillColorFalling: "rgba(41, 98, 255, 0.12)",
      belowLineFillColorGrowingBottom: "rgba(41, 98, 255, 0)",
      belowLineFillColorFallingBottom: "rgba(41, 98, 255, 0)",
      symbolActiveColor: "rgba(41, 98, 255, 0.12)",
      tabs: [
        {
          title: "Crypto",
          symbols: [
            { s: "BINANCE:BTCUSDT", d: "Bitcoin" },
            { s: "BINANCE:ETHUSDT", d: "Ethereum" },
            { s: "BINANCE:SOLUSDT", d: "Solana" },
            { s: "BINANCE:BNBUSDT", d: "BNB" },
            { s: "BINANCE:ADAUSDT", d: "Cardano" },
            { s: "BINANCE:AVAXUSDT", d: "Avalanche" },
            { s: "BINANCE:DOGEUSDT", d: "Dogecoin" },
            { s: "BINANCE:DOTUSDT", d: "Polkadot" },
            { s: "BINANCE:MATICUSDT", d: "Polygon" },
            { s: "BINANCE:ARBUSDT", d: "Arbitrum" }
          ],
          originalTitle: "Crypto"
        }
      ]
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [colorTheme, width, height]);

  return (
    <Card className="p-0 overflow-hidden" data-testid="card-watchlist">
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </Card>
  );
}

export default memo(TradingViewWatchlist);
