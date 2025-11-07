import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StrategyCard } from "@/components/StrategyCard";
import { 
  Plus, 
  TrendingUp, 
  AlertTriangle, 
  Shield, 
  Activity,
  Target,
  Zap
} from "lucide-react";

interface MultiStrategyDashboardProps {
  onCreateClick?: () => void;
}

export function MultiStrategyDashboard({ onCreateClick }: MultiStrategyDashboardProps) {
  const { data: strategiesData } = useQuery<any>({
    queryKey: ['/api/trading-modes'],
    refetchInterval: 30000,
  });

  const { data: portfolioManagerData } = useQuery<any>({
    queryKey: ['/api/portfolio-manager/status'],
    refetchInterval: 15000,
  });

  const strategies = strategiesData?.tradingModes || [];
  const activeStrategies = strategies.filter((s: any) => s.status === 'active');
  const portfolioStatus = portfolioManagerData?.status;

  const healthColors = {
    healthy: 'bg-success/20 text-success border-success/30',
    warning: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  const healthIcons = {
    healthy: <Shield className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    critical: <AlertTriangle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-4 p-4">
      {/* Portfolio Health Overview */}
      {portfolioStatus && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Portfolio Health
              </CardTitle>
              <Badge 
                variant="outline" 
                className={healthColors[portfolioStatus.portfolioHealth as keyof typeof healthColors] || healthColors.healthy}
              >
                {healthIcons[portfolioStatus.portfolioHealth as keyof typeof healthIcons] || healthIcons.healthy}
                <span className="ml-1 capitalize">{portfolioStatus.portfolioHealth || 'Healthy'}</span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Portfolio Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Total Capital</p>
                <p className="text-lg font-bold font-mono">
                  ${portfolioStatus.totalCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Active Strategies</p>
                <p className="text-lg font-bold font-mono">
                  {portfolioStatus.activeStrategies} / 3
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Total Positions</p>
                <p className="text-lg font-bold font-mono">
                  {portfolioStatus.totalPositions}
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Available</p>
                <p className="text-lg font-bold font-mono text-success">
                  ${portfolioStatus.totalAvailable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* Margin Utilization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Margin Utilization</span>
                <span className={`font-mono font-semibold ${
                  portfolioStatus.marginUtilizationPercent > 85 
                    ? 'text-destructive' 
                    : portfolioStatus.marginUtilizationPercent > 70 
                    ? 'text-yellow-500' 
                    : 'text-success'
                }`}>
                  {portfolioStatus.marginUtilizationPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={portfolioStatus.marginUtilizationPercent} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used: ${portfolioStatus.totalMarginUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span>Total: ${portfolioStatus.totalCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Conflicts & Warnings */}
            {portfolioStatus.conflicts && portfolioStatus.conflicts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Active Alerts</p>
                {portfolioStatus.conflicts.slice(0, 3).map((conflict: any, idx: number) => (
                  <Alert 
                    key={idx}
                    variant={conflict.severity === 'critical' ? 'destructive' : 'default'}
                    className="py-2"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                      <span className="font-semibold">{conflict.symbol}:</span> {conflict.message}
                    </AlertDescription>
                  </Alert>
                ))}
                {portfolioStatus.conflicts.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{portfolioStatus.conflicts.length - 3} more conflicts
                  </p>
                )}
              </div>
            )}

            {/* Recommendations */}
            {portfolioStatus.recommendations && portfolioStatus.recommendations.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border/30">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  AI Recommendations
                </p>
                <div className="space-y-1">
                  {portfolioStatus.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                    <p key={idx} className="text-xs text-foreground/80 pl-4 border-l-2 border-primary/30">
                      {rec}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aggregate Exposure by Symbol */}
      {portfolioStatus && portfolioStatus.aggregateExposure && portfolioStatus.aggregateExposure.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Aggregate Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {portfolioStatus.aggregateExposure.map((exposure: any, idx: number) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30"
                  data-testid={`exposure-${exposure.symbol}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">{exposure.symbol}</span>
                    <Badge variant="outline" className="text-xs">
                      {exposure.strategies.length} {exposure.strategies.length === 1 ? 'strategy' : 'strategies'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      <span className="text-success">Long: {exposure.longSize.toFixed(4)}</span>
                      {' / '}
                      <span className="text-destructive">Short: {exposure.shortSize.toFixed(4)}</span>
                    </div>
                    <div className={`text-sm font-mono font-bold ${
                      exposure.netSize > 0 ? 'text-success' : exposure.netSize < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {exposure.netSize > 0 ? '+' : ''}{exposure.netSize.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategies Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Strategies ({activeStrategies.length}/3)</h2>
        <Button
          size="sm"
          disabled={strategies.length >= 3}
          data-testid="button-create-strategy"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create Strategy
        </Button>
      </div>

      {/* Strategy Cards */}
      {strategies.length === 0 ? (
        <Card className="bg-card border-border/50">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No trading strategies configured yet.</p>
            <Button onClick={onCreateClick} data-testid="button-create-first-strategy">
              <Plus className="h-4 w-4 mr-1" />
              Create Your First Strategy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy: any) => {
            const allocation = portfolioStatus?.strategyAllocations?.find(
              (a: any) => a.strategyId === strategy.id
            );

            return (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                allocation={allocation}
                onEdit={() => {
                  // TODO: Open edit modal
                  console.log('Edit strategy:', strategy.id);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
