import Header from "@/components/Header";
import AIPromptPanel from "@/components/AIPromptPanel";
import MarketOverview from "@/components/MarketOverview";
import PositionsGrid from "@/components/PositionsGrid";
import PerformanceMetrics from "@/components/PerformanceMetrics";
import TradeHistory from "@/components/TradeHistory";
import QuickTrade from "@/components/QuickTrade";
import PortfolioPerformanceChart from "@/components/PortfolioPerformanceChart";
import SharpeRatioChart from "@/components/SharpeRatioChart";
import { AIUsageTracker } from "@/components/AIUsageTracker";
import ConversationHistory from "@/components/ConversationHistory";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-[1920px] p-4">
        <div className="space-y-4">
          {/* AI Prompt Section */}
          <AIPromptPanel />

          {/* Conversation History */}
          <ConversationHistory />

          {/* Market Overview */}
          <MarketOverview />

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PortfolioPerformanceChart />
            <SharpeRatioChart />
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {/* Positions */}
              <PositionsGrid />

              {/* Performance Metrics */}
              <PerformanceMetrics />

              {/* Trade History */}
              <TradeHistory />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* AI Usage Tracker */}
              <AIUsageTracker />
              
              {/* Quick Trade */}
              <QuickTrade />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
