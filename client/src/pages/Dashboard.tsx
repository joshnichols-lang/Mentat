import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCredentials } from "@/hooks/useCredentials";
import { useAuth } from "@/hooks/use-auth";
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
import { OrderBook } from "@/components/OrderBook";
import { CvdChart } from "@/components/CvdChart";
import VolumeProfileChart from "@/components/VolumeProfileChart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { hasCredentials, isLoading, error, isSuccess } = useCredentials();
  const [selectedCoin, setSelectedCoin] = useState("BTC");

  // Check verification status and redirect if not approved
  useEffect(() => {
    if (user && user.verificationStatus !== "approved") {
      setLocation("/pending-approval");
    }
  }, [user, setLocation]);

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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground" data-testid="text-onboarding-redirect">Redirecting to onboarding...</p>
      </div>
    );
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

              {/* Trading Pair Selector */}
              <Card className="p-4" data-testid="card-coin-selector">
                <h3 className="font-mono text-sm font-bold mb-3">MARKET ANALYSIS</h3>
                <div className="flex gap-2 flex-wrap">
                  {["BTC", "ETH", "SOL"].map((coin) => (
                    <Button
                      key={coin}
                      variant={selectedCoin === coin ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCoin(coin)}
                      className="font-mono"
                      data-testid={`button-select-${coin.toLowerCase()}`}
                    >
                      {coin}
                    </Button>
                  ))}
                </div>
              </Card>

              {/* Order Book */}
              <OrderBook coin={selectedCoin} />

              {/* CVD Chart */}
              <CvdChart coin={selectedCoin} />

              {/* Volume Profile Chart */}
              <VolumeProfileChart coin={selectedCoin} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
