import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Progress } from "@/components/ui/progress";
import { 
  Wallet, 
  TrendingUp,
  Target,
  AlertTriangle,
  BarChart3,
  Coins
} from "lucide-react";

interface PortfolioSource {
  name: string;
  value: number;
  percentage: number;
  icon?: any;
  color?: string;
}

export function PortfolioOverview() {
  const { data: portfolioData, isLoading } = useQuery<any>({
    queryKey: ['/api/portfolio/comprehensive'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="bg-[#0A0A0A] border border-[#141414] rounded-lg p-6">
        <div className="text-xs uppercase tracking-wide text-[#737373] mb-4">Loading Portfolio...</div>
        <div className="space-y-4">
          <div className="h-16 bg-[#141414] rounded overflow-hidden relative">
            <div className="absolute inset-0 shimmer"></div>
          </div>
          <div className="h-8 bg-[#141414] rounded w-3/4 overflow-hidden relative">
            <div className="absolute inset-0 shimmer"></div>
          </div>
          <div className="h-6 bg-[#141414] rounded w-1/2 overflow-hidden relative">
            <div className="absolute inset-0 shimmer"></div>
          </div>
        </div>
      </div>
    );
  }

  const totalCapital = portfolioData?.totalCapital || 0;
  const totalUnrealizedPnl = portfolioData?.totalUnrealizedPnl || 0;
  const totalMarginUsed = portfolioData?.totalMarginUsed || 0;
  const marginRatio = totalCapital > 0 ? (totalMarginUsed / totalCapital) * 100 : 0;

  // Prepare capital sources with their icons (lime accent only per design spec)
  const sources: PortfolioSource[] = [
    {
      name: "External Wallet",
      value: portfolioData?.walletBalances?.externalWallet || 0,
      percentage: 0,
      icon: Wallet,
      color: "text-[#00FF41]"
    },
    {
      name: "Embedded EVM",
      value: portfolioData?.walletBalances?.embeddedEvm || 0,
      percentage: 0,
      icon: Coins,
      color: "text-[#A6A6A6]"
    },
    {
      name: "Embedded Solana",
      value: portfolioData?.walletBalances?.embeddedSolana || 0,
      percentage: 0,
      icon: Coins,
      color: "text-[#A6A6A6]"
    },
    {
      name: "Embedded Polygon",
      value: portfolioData?.walletBalances?.embeddedPolygon || 0,
      percentage: 0,
      icon: Coins,
      color: "text-[#A6A6A6]"
    },
    {
      name: "Hyperliquid",
      value: portfolioData?.exchangeBalances?.hyperliquid || 0,
      percentage: 0,
      icon: BarChart3,
      color: "text-[#00FF41]"
    },
    {
      name: "Orderly Network",
      value: portfolioData?.exchangeBalances?.orderly || 0,
      percentage: 0,
      icon: BarChart3,
      color: "text-[#A6A6A6]"
    },
    {
      name: "Polymarket",
      value: portfolioData?.exchangeBalances?.polymarket || 0,
      percentage: 0,
      icon: Target,
      color: "text-[#A6A6A6]"
    }
  ];

  // Calculate percentages
  sources.forEach(source => {
    source.percentage = totalCapital > 0 ? (source.value / totalCapital) * 100 : 0;
  });

  // Show ALL sources, even with zero balances
  const allSources = sources;

  return (
    <div className="space-y-8">
      {/* Total Portfolio Value - Massive Display */}
      <div 
        className="bg-transparent p-6 rounded-lg hover:shadow-[0_4px_20px_rgba(0,255,65,0.1)] transition-all duration-300" 
        data-testid="card-portfolio-total"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-[#737373]">Total Portfolio Value</span>
          </div>
          <Badge 
            variant="secondary" 
            className="gap-1 bg-[#0A0A0A] border-[#141414] text-[#00FF41] hover-elevate" 
            data-testid="badge-portfolio-live"
          >
            <TrendingUp className="h-3 w-3 text-[#00FF41]" />
            Live
          </Badge>
        </div>

        {/* MASSIVE Portfolio Value - 60px */}
        <div 
          className="text-6xl font-bold font-mono text-[#FAFAFA] tracking-tight mb-4" 
          data-testid="text-total-capital"
        >
          <AnimatedCounter value={totalCapital} prefix="$" decimals={2} />
        </div>
          
        {/* P&L and Margin Summary - Larger Size */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <div className="text-sm text-[#A6A6A6] font-medium">Unrealized P&L</div>
            <div 
              className={`text-2xl font-bold font-mono ${totalUnrealizedPnl >= 0 ? 'text-[#00FF41]' : 'text-[#DC143C]'}`}
              data-testid="text-unrealized-pnl"
            >
              <AnimatedCounter 
                value={Math.abs(totalUnrealizedPnl)} 
                prefix={totalUnrealizedPnl >= 0 ? '+$' : '-$'} 
                decimals={2}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-sm text-[#A6A6A6] font-medium">Margin Used</div>
            <div className="text-2xl font-bold font-mono text-[#FAFAFA]" data-testid="text-margin-used">
              <AnimatedCounter value={totalMarginUsed} prefix="$" decimals={2} />
            </div>
          </div>
        </div>

        {/* Margin Ratio Progress Bar */}
        {totalMarginUsed > 0 && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#A6A6A6]">Margin Ratio</span>
              <span className={`font-bold font-mono ${
                marginRatio > 85 ? 'text-[#DC143C]' : 
                marginRatio > 70 ? 'text-[#FFC107]' : 
                'text-[#00FF41]'
              }`} data-testid="text-margin-ratio">
                {marginRatio.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={marginRatio} 
              className={`h-2 ${
                marginRatio > 85 ? '[&>div]:bg-[#DC143C]' : 
                marginRatio > 70 ? '[&>div]:bg-[#FFC107]' : 
                '[&>div]:bg-[#00FF41]'
              }`}
              data-testid="progress-margin-ratio"
            />
            {marginRatio > 70 && (
              <div className="flex items-center gap-1 text-sm text-[#FFC107] mt-2">
                <AlertTriangle className="h-3 w-3" />
                <span>High margin usage</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Capital Sources Breakdown - Floating Panel */}
      <div 
        className="bg-[#0A0A0A] border border-[#141414] rounded-lg p-6 hover:shadow-[0_4px_20px_rgba(0,255,65,0.1)] hover:border-[#00FF41]/20 transition-all duration-300" 
        data-testid="card-capital-sources"
      >
        <div className="mb-4">
          <span className="text-xs uppercase tracking-wide text-[#737373]">Capital Distribution</span>
        </div>
        <div className="space-y-4">
          {allSources.map((source, index) => {
            const Icon = source.icon;
            const isZero = source.value === 0;
            return (
              <div 
                key={source.name} 
                className={`flex items-center justify-between ${isZero ? 'opacity-40' : ''}`}
                data-testid={`row-source-${index}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Icon className={`h-5 w-5 ${source.color}`} />
                  <div className="flex-1">
                    <div className={`text-base font-medium ${isZero ? 'text-[#737373]' : 'text-[#FAFAFA]'}`}>
                      {source.name}
                    </div>
                    <div className="text-xs text-[#A6A6A6]">
                      {source.percentage.toFixed(1)}% of total
                    </div>
                  </div>
                </div>
                <div className={`text-base font-bold font-mono ${isZero ? 'text-[#737373]' : 'text-[#FAFAFA]'}`} data-testid={`text-value-${index}`}>
                  <AnimatedCounter value={source.value} prefix="$" decimals={2} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exchange Risk Exposure - Floating Panel */}
      {portfolioData?.riskMetrics?.exposureByExchange && (
        <div 
          className="bg-[#0A0A0A] border border-[#141414] rounded-lg p-6 hover:shadow-[0_4px_20px_rgba(0,255,65,0.1)] hover:border-[#00FF41]/20 transition-all duration-300" 
          data-testid="card-exchange-exposure"
        >
          <div className="mb-4">
            <span className="text-xs uppercase tracking-wide text-[#737373]">Exchange Exposure</span>
          </div>
          <div className="space-y-4">
            {Object.entries(portfolioData.riskMetrics.exposureByExchange as Record<string, number>).map(([exchange, value], index) => {
              const percentage = totalCapital > 0 ? (value as number / totalCapital) * 100 : 0;
              return (
                <div 
                  key={exchange} 
                  className="space-y-2"
                  data-testid={`row-exchange-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium capitalize text-[#FAFAFA]">{exchange}</span>
                    <span className="text-base font-bold font-mono text-[#A6A6A6]" data-testid={`text-exchange-value-${index}`}>
                      <AnimatedCounter value={value as number} prefix="$" decimals={2} />
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2 [&>div]:bg-[#00FF41]"
                    data-testid={`progress-exchange-${index}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
