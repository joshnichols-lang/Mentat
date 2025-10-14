import Header from "@/components/Header";
import AIPromptPanel from "@/components/AIPromptPanel";
import MarketOverview from "@/components/MarketOverview";
import PositionsGrid from "@/components/PositionsGrid";
import PerformanceMetrics from "@/components/PerformanceMetrics";
import TradeHistory from "@/components/TradeHistory";
import QuickTrade from "@/components/QuickTrade";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-[1920px] p-6">
        <div className="space-y-6">
          {/* AI Prompt Section */}
          <AIPromptPanel />

          {/* Market Overview */}
          <MarketOverview />

          {/* Main Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Positions */}
              <PositionsGrid />

              {/* Performance Metrics */}
              <PerformanceMetrics />

              {/* Trade History */}
              <TradeHistory />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Trade */}
              <QuickTrade />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
