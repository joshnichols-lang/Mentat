import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Progress } from "@/components/ui/progress";
import { 
  Wallet, 
  TrendingUp,
  DollarSign,
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
      <Card className="border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Loading Portfolio...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCapital = portfolioData?.totalCapital || 0;
  const totalUnrealizedPnl = portfolioData?.totalUnrealizedPnl || 0;
  const totalMarginUsed = portfolioData?.totalMarginUsed || 0;
  const marginRatio = totalCapital > 0 ? (totalMarginUsed / totalCapital) * 100 : 0;

  // Prepare capital sources with their icons and colors
  const sources: PortfolioSource[] = [
    {
      name: "External Wallet",
      value: portfolioData?.walletBalances?.externalWallet || 0,
      percentage: 0,
      icon: Wallet,
      color: "text-blue-500"
    },
    {
      name: "Embedded EVM",
      value: portfolioData?.walletBalances?.embeddedEvm || 0,
      percentage: 0,
      icon: Coins,
      color: "text-purple-500"
    },
    {
      name: "Embedded Solana",
      value: portfolioData?.walletBalances?.embeddedSolana || 0,
      percentage: 0,
      icon: Coins,
      color: "text-green-500"
    },
    {
      name: "Embedded Polygon",
      value: portfolioData?.walletBalances?.embeddedPolygon || 0,
      percentage: 0,
      icon: Coins,
      color: "text-violet-500"
    },
    {
      name: "Hyperliquid",
      value: portfolioData?.exchangeBalances?.hyperliquid || 0,
      percentage: 0,
      icon: BarChart3,
      color: "text-primary"
    },
    {
      name: "Orderly Network",
      value: portfolioData?.exchangeBalances?.orderly || 0,
      percentage: 0,
      icon: BarChart3,
      color: "text-amber-500"
    },
    {
      name: "Polymarket",
      value: portfolioData?.exchangeBalances?.polymarket || 0,
      percentage: 0,
      icon: Target,
      color: "text-orange-500"
    }
  ];

  // Calculate percentages
  sources.forEach(source => {
    source.percentage = totalCapital > 0 ? (source.value / totalCapital) * 100 : 0;
  });

  // Show ALL sources, even with zero balances
  const allSources = sources;

  return (
    <div className="space-y-4">
      {/* Total Portfolio Value Card */}
      <Card className="border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl shadow-primary/5" data-testid="card-portfolio-total">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
            </div>
            <Badge variant="secondary" className="gap-1 hover-elevate" data-testid="badge-portfolio-live">
              <TrendingUp className="h-3 w-3" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent" data-testid="text-total-capital">
            <AnimatedCounter value={totalCapital} prefix="$" decimals={2} />
          </div>
          
          {/* P&L and Margin Summary */}
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Unrealized P&L</div>
              <div 
                className={`font-semibold ${totalUnrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
                data-testid="text-unrealized-pnl"
              >
                <AnimatedCounter 
                  value={Math.abs(totalUnrealizedPnl)} 
                  prefix={totalUnrealizedPnl >= 0 ? '+$' : '-$'} 
                  decimals={2}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Margin Used</div>
              <div className="font-semibold" data-testid="text-margin-used">
                <AnimatedCounter value={totalMarginUsed} prefix="$" decimals={2} />
              </div>
            </div>
          </div>

          {/* Margin Ratio Progress Bar */}
          {totalMarginUsed > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Margin Ratio</span>
                <span className={`font-semibold ${
                  marginRatio > 85 ? 'text-red-500' : 
                  marginRatio > 70 ? 'text-amber-500' : 
                  'text-green-500'
                }`} data-testid="text-margin-ratio">
                  {marginRatio.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={marginRatio} 
                className={`h-2 ${
                  marginRatio > 85 ? '[&>div]:bg-red-500' : 
                  marginRatio > 70 ? '[&>div]:bg-amber-500' : 
                  '[&>div]:bg-green-500'
                }`}
                data-testid="progress-margin-ratio"
              />
              {marginRatio > 70 && (
                <div className="flex items-center gap-1 text-xs text-amber-500 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>High margin usage</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capital Sources Breakdown - Always show all sources */}
      <Card data-testid="card-capital-sources">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Capital Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allSources.map((source, index) => {
            const Icon = source.icon;
            const isZero = source.value === 0;
            return (
              <div 
                key={source.name} 
                className={`flex items-center justify-between ${isZero ? 'opacity-50' : ''}`}
                data-testid={`row-source-${index}`}
              >
                <div className="flex items-center gap-2 flex-1">
                  <Icon className={`h-4 w-4 ${source.color}`} />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${isZero ? 'text-muted-foreground' : ''}`}>
                      {source.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {source.percentage.toFixed(1)}% of total
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${isZero ? 'text-muted-foreground' : ''}`} data-testid={`text-value-${index}`}>
                  <AnimatedCounter value={source.value} prefix="$" decimals={2} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Exchange Risk Exposure */}
      {portfolioData?.riskMetrics?.exposureByExchange && (
        <Card data-testid="card-exchange-exposure">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Exchange Exposure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(portfolioData.riskMetrics.exposureByExchange as Record<string, number>).map(([exchange, value], index) => {
              const percentage = totalCapital > 0 ? (value as number / totalCapital) * 100 : 0;
              return (
                <div 
                  key={exchange} 
                  className="space-y-1.5"
                  data-testid={`row-exchange-${index}`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{exchange}</span>
                    <span className="text-muted-foreground" data-testid={`text-exchange-value-${index}`}>
                      <AnimatedCounter value={value as number} prefix="$" decimals={2} />
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-1.5"
                    data-testid={`progress-exchange-${index}`}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
