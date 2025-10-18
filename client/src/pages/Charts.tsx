import { useEffect, useRef } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3 } from "lucide-react";

const grayscaleCSS = `
  .tradingview-widget-container iframe {
    color-scheme: dark;
  }
  
  /* Override any colored text in TradingView widgets */
  .tradingview-widget-container * {
    color: inherit !important;
  }
  
  /* Force grayscale for positive/negative values */
  .tradingview-widget-container [class*="positive"],
  .tradingview-widget-container [class*="negative"],
  .tradingview-widget-container [class*="up"],
  .tradingview-widget-container [class*="down"],
  .tradingview-widget-container [style*="color: rgb(34, 171, 148)"],
  .tradingview-widget-container [style*="color: rgb(240, 67, 56)"],
  .tradingview-widget-container [style*="color: green"],
  .tradingview-widget-container [style*="color: red"] {
    color: rgb(150, 150, 150) !important;
  }
`;

export default function Charts() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const watchlistContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject grayscale CSS
    const styleEl = document.createElement("style");
    styleEl.innerHTML = grayscaleCSS;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  useEffect(() => {
    // Advanced Chart Widget
    if (chartContainerRef.current && !chartContainerRef.current.querySelector('script')) {
      const chartScript = document.createElement("script");
      chartScript.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      chartScript.type = "text/javascript";
      chartScript.async = true;
      chartScript.innerHTML = JSON.stringify({
        autosize: true,
        symbol: "BINANCE:BTCUSDT",
        interval: "D",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        allow_symbol_change: true,
        calendar: false,
        support_host: "https://www.tradingview.com",
        backgroundColor: "rgba(0, 0, 0, 0)",
        gridColor: "rgba(255, 255, 255, 0.06)",
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: "tradingview-chart-widget",
        studies_overrides: {
          "volume.volume.color.0": "rgba(120, 120, 120, 0.5)",
          "volume.volume.color.1": "rgba(180, 180, 180, 0.5)"
        },
        overrides: {
          "mainSeriesProperties.candleStyle.upColor": "#FFFFFF",
          "mainSeriesProperties.candleStyle.downColor": "#404040",
          "mainSeriesProperties.candleStyle.borderUpColor": "#FFFFFF",
          "mainSeriesProperties.candleStyle.borderDownColor": "#404040",
          "mainSeriesProperties.candleStyle.wickUpColor": "#FFFFFF",
          "mainSeriesProperties.candleStyle.wickDownColor": "#404040",
          "mainSeriesProperties.priceLineColor": "#888888",
          "mainSeriesProperties.priceLineWidth": 1,
          "scalesProperties.lineColor": "#333333",
          "scalesProperties.textColor": "#888888",
          "paneProperties.background": "#000000",
          "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.06)",
          "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.06)",
          "paneProperties.legendProperties.showSeriesTitle": true,
          "paneProperties.legendProperties.showLegend": true
        },
        loading_screen: { backgroundColor: "#000000", foregroundColor: "#888888" },
        toolbar_bg: "#000000",
        custom_css_url: ""
      });
      chartContainerRef.current.appendChild(chartScript);
    }

    // Market Overview Widget (Watchlist)
    if (watchlistContainerRef.current && !watchlistContainerRef.current.querySelector('script')) {
      const watchlistScript = document.createElement("script");
      watchlistScript.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
      watchlistScript.type = "text/javascript";
      watchlistScript.async = true;
      watchlistScript.innerHTML = JSON.stringify({
        colorTheme: "dark",
        dateRange: "12M",
        showChart: true,
        locale: "en",
        width: "100%",
        height: "100%",
        largeChartUrl: "",
        isTransparent: true,
        showSymbolLogo: false,
        showFloatingTooltip: false,
        plotLineColorGrowing: "rgba(180, 180, 180, 1)",
        plotLineColorFalling: "rgba(120, 120, 120, 1)",
        gridLineColor: "rgba(240, 243, 250, 0)",
        scaleFontColor: "rgba(150, 150, 150, 1)",
        belowLineFillColorGrowing: "rgba(180, 180, 180, 0.12)",
        belowLineFillColorFalling: "rgba(120, 120, 120, 0.12)",
        belowLineFillColorGrowingBottom: "rgba(180, 180, 180, 0)",
        belowLineFillColorFallingBottom: "rgba(120, 120, 120, 0)",
        symbolActiveColor: "rgba(150, 150, 150, 0.12)",
        valuesTracking: "1",
        changeMode: "price-and-percent",
        fontFamily: "Courier New, monospace",
        fontSize: "10",
        tabs: [
          {
            title: "Crypto",
            symbols: [
              { s: "BINANCE:BTCUSDT", d: "Bitcoin" },
              { s: "BINANCE:ETHUSDT", d: "Ethereum" },
              { s: "BINANCE:SOLUSDT", d: "Solana" },
              { s: "BINANCE:BNBUSDT", d: "BNB" },
              { s: "BINANCE:ADAUSDT", d: "Cardano" },
              { s: "BINANCE:DOGEUSDT", d: "Dogecoin" },
              { s: "BINANCE:DOTUSDT", d: "Polkadot" },
              { s: "BINANCE:MATICUSDT", d: "Polygon" },
              { s: "BINANCE:AVAXUSDT", d: "Avalanche" },
              { s: "BINANCE:LINKUSDT", d: "Chainlink" }
            ],
            originalTitle: "Crypto"
          }
        ]
      });
      watchlistContainerRef.current.appendChild(watchlistScript);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-[1800px] p-4 space-y-4">
        <div className="mb-6">
          <h1 className="text-3xl font-mono font-bold flex items-center gap-2" data-testid="text-page-title">
            <TrendingUp className="h-8 w-8" />
            Market Charts
          </h1>
          <p className="text-muted-foreground mt-2">
            Advanced technical analysis powered by TradingView
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Advanced Chart - Takes 2 columns on xl screens */}
          <Card className="xl:col-span-2" data-testid="card-chart">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Advanced Chart
              </CardTitle>
              <CardDescription>
                Full-featured TradingView chart with technical indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div 
                ref={chartContainerRef}
                className="tradingview-widget-container"
                style={{ height: "600px", width: "100%" }}
              >
                <div 
                  id="tradingview-chart-widget"
                  style={{ height: "calc(100% - 32px)", width: "100%" }}
                />
                <div className="tradingview-widget-copyright">
                  <a 
                    href="https://www.tradingview.com/" 
                    rel="noopener nofollow" 
                    target="_blank"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Track all markets on TradingView
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Market Overview Watchlist - Takes 1 column */}
          <Card data-testid="card-watchlist">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Market Overview
              </CardTitle>
              <CardDescription>
                Track multiple crypto assets at a glance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div 
                ref={watchlistContainerRef}
                className="tradingview-widget-container"
                style={{ height: "600px", width: "100%" }}
              >
                <div style={{ height: "calc(100% - 32px)", width: "100%" }} />
                <div className="tradingview-widget-copyright">
                  <a 
                    href="https://www.tradingview.com/" 
                    rel="noopener nofollow" 
                    target="_blank"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Track all markets on TradingView
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground p-4 border-t">
          <p className="font-mono">
            Chart data provided by TradingView. Prices may differ from Hyperliquid exchange.
          </p>
        </div>
      </main>
    </div>
  );
}
