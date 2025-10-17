import { useEffect } from "react";
import { useLocation } from "wouter";
import { useCredentials } from "@/hooks/useCredentials";
import Header from "@/components/Header";
import AIPromptPanel from "@/components/AIPromptPanel";
import MarketOverview from "@/components/MarketOverview";
import PositionsGrid from "@/components/PositionsGrid";
import PerformanceMetrics from "@/components/PerformanceMetrics";
import PortfolioPerformanceChart from "@/components/PortfolioPerformanceChart";
import SharpeRatioChart from "@/components/SharpeRatioChart";
import { AIUsageTracker } from "@/components/AIUsageTracker";
import ConversationHistory from "@/components/ConversationHistory";
import { MonitoringAlerts } from "@/components/MonitoringAlerts";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { hasCredentials, isLoading, error, isSuccess } = useCredentials();

  useEffect(() => {
    if (isSuccess && !hasCredentials) {
      setLocation("/onboarding");
    }
  }, [hasCredentials, isSuccess, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">Failed to load credentials status</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!hasCredentials) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-[1920px] p-4">
        <div className="space-y-4">
          {/* AI Prompt Section */}
          <AIPromptPanel />

          {/* Conversation History */}
          <ConversationHistory />

          {/* Automated Monitoring Alerts */}
          <MonitoringAlerts />

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
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* AI Usage Tracker */}
              <AIUsageTracker />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
