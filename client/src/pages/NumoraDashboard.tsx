import NumoraHeader from "@/components/NumoraHeader";
import TransactionHeatmap from "@/components/TransactionHeatmap";
import DonutChart from "@/components/DonutChart";
import PatternedBarChart from "@/components/PatternedBarChart";
import TradingChart from "@/components/TradingChart";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

/**
 * NumoraDashboard - Reference implementation matching Numora design
 * Grid-based panel layout with unique data visualizations
 */
export default function NumoraDashboard() {
  const holdersData = [
    { label: "Whales", value: 75000, percentage: 75, pattern: true },
    { label: "Others", value: 20000, percentage: 20, pattern: false },
  ];

  const volumeData = [
    { label: "Type", value: 45447, percentage: 60, pattern: true },
    { label: "Vol", value: 150, percentage: 40, pattern: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      <NumoraHeader />
      
      <main className="max-w-[1920px] mx-auto p-6">
        {/* Grid Layout - Matching Numora Reference */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Left Column - Chart */}
          <div className="col-span-8 space-y-4">
            {/* Main Trading Chart */}
            <div className="numora-panel p-0 overflow-hidden" data-testid="main-chart-panel">
              {/* Chart Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">S</div>
                    <span className="font-semibold">SUI</span>
                    <span className="text-xs text-foreground/50">$0.4020</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-xs px-2 py-1 rounded hover:bg-foreground/5">Price / Market Cap</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="time-pill time-pill-active">1D</button>
                  <button className="time-pill">7D</button>
                  <button className="time-pill">3M</button>
                  <button className="time-pill">1Y</button>
                  <button className="time-pill">All</button>
                </div>
              </div>
              
              {/* Chart */}
              <div className="h-96">
                <TradingChart symbol="SUI-USD" onSymbolChange={() => {}} />
              </div>
            </div>
            
            {/* Transaction Heatmap + Holders */}
            <div className="grid grid-cols-2 gap-4">
              <TransactionHeatmap />
              <PatternedBarChart 
                title="Holders" 
                data={holdersData}
                timeframeControls
              />
            </div>
          </div>
          
          {/* Right Column - Metrics & Analytics */}
          <div className="col-span-4 space-y-4">
            {/* Portfolio Metrics */}
            <div className="numora-panel">
              <h3 className="text-sm font-semibold mb-4">Portfolio</h3>
              
              {/* Time Period Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="metric-label">TODAY</div>
                  <div className="display-number-lg text-xl mt-1">3,585$</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-success">
                    <TrendingUp className="h-3 w-3" />
                    <span>+25.50%</span>
                  </div>
                </div>
                <div>
                  <div className="metric-label">MONTH</div>
                  <div className="display-number-lg text-xl mt-1">12,005$</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                    <TrendingDown className="h-3 w-3" />
                    <span>-5.50%</span>
                  </div>
                </div>
                <div>
                  <div className="metric-label">YEAR</div>
                  <div className="display-number-lg text-xl mt-1">125,000$</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-success">
                    <TrendingUp className="h-3 w-3" />
                    <span>+25.50%</span>
                  </div>
                </div>
              </div>
              
              {/* Token Allocation Grid (Heatmap Style) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-foreground/60 mb-2">
                  <span>Token Allocation</span>
                  <span>UNI 10.2%</span>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  {Array.from({ length: 144 }).map((_, i) => {
                    const intensity = Math.random();
                    const bgClass = 
                      intensity > 0.7 ? 'bg-success/60' :
                      intensity > 0.5 ? 'bg-success/40' :
                      intensity > 0.3 ? 'bg-success/20' :
                      intensity > 0.1 ? 'bg-foreground/10' :
                      'bg-foreground/5';
                    return (
                      <div 
                        key={i} 
                        className={`aspect-square rounded-sm ${bgClass} transition-all hover:scale-110`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="token-badge">
                    <span className="text-foreground/60">USDT</span>
                    <span>35%</span>
                  </span>
                  <span className="token-badge">
                    <span className="text-foreground/60">ETH</span>
                    <span>32.5%</span>
                  </span>
                  <span className="token-badge">
                    <span className="text-foreground/60">SUI</span>
                    <span>20.5%</span>
                  </span>
                </div>
              </div>
            </div>
            
            {/* Unlocks Donut Chart */}
            <DonutChart percentage={34} />
            
            {/* AI Assistant */}
            <div className="numora-panel">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
                  <span className="text-xs">🤖</span>
                </div>
                <h3 className="text-sm font-semibold">AI Assistant</h3>
              </div>
              
              {/* Chat Messages */}
              <div className="space-y-3 mb-4">
                <div className="bg-secondary rounded-lg p-3 text-sm">
                  <div className="text-foreground/60 mb-2">Give me a forecast for the SUI coin</div>
                  <div className="text-xs text-foreground/40">15:01</div>
                </div>
                <div className="bg-card rounded-lg p-3 text-sm border border-border/50">
                  <div className="text-foreground/90">
                    Sure! SUI is currently trading at $7.95, with a 24h change of +2.8%. Based on recent trends and volume inflows, short-term momentum appears bullish.
                  </div>
                  <div className="text-xs text-foreground/40 mt-2">15:01</div>
                </div>
              </div>
              
              {/* Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter a message..."
                  className="w-full bg-secondary border border-border/50 rounded-md pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  data-testid="input-ai-message"
                />
                <button className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-foreground/5 rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Bottom Row - Volume & Ratio Charts */}
          <div className="col-span-6">
            <PatternedBarChart 
              title="Buys/Sells Volume" 
              data={volumeData}
              timeframeControls
            />
          </div>
          
          <div className="col-span-6">
            <div className="numora-panel">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Long/Short Ratio</h3>
                <div className="flex items-center gap-1">
                  <button className="time-pill">24H</button>
                  <button className="time-pill time-pill-active">1D</button>
                  <button className="time-pill">7D</button>
                  <button className="time-pill">All</button>
                </div>
              </div>
              
              {/* Area Chart Placeholder */}
              <div className="h-48 bg-foreground/5 rounded flex items-center justify-center text-foreground/40 text-sm">
                Long/Short Ratio Chart
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-foreground/60">Long</span>
                  <span className="font-semibold">49.42%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-foreground/40" />
                  <span className="text-foreground/60">Long/Short</span>
                  <span className="font-semibold">1.003</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
