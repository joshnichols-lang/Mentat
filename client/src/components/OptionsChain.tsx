import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OptionsChainProps {
  asset: string;
  currentPrice?: number;
}

interface AevoMarket {
  instrument_id: string;
  instrument_name: string;
  instrument_type: 'OPTION' | 'PERPETUAL';
  option_type?: 'call' | 'put';
  underlying_asset: string;
  strike?: string;
  expiry?: string;
  mark_price: string;
  index_price?: string;
  is_active: boolean;
  greeks?: {
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
    rho: string;
    iv?: string;
  };
}

interface GroupedOption {
  strike: string;
  call?: AevoMarket;
  put?: AevoMarket;
}

export default function OptionsChain({ asset, currentPrice }: OptionsChainProps) {
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ success: boolean; markets: AevoMarket[] }>({
    queryKey: [`/api/aevo/markets?asset=${asset}&instrument_type=OPTION`],
    enabled: !!asset,
  });

  const markets = data?.markets || [];
  
  // Filter for active options matching the selected asset
  const options = markets.filter(m => 
    m.instrument_type === 'OPTION' && 
    m.is_active && 
    m.underlying_asset === asset
  );

  // Get unique expiry dates
  const expiryDates = Array.from(new Set(options.map(o => o.expiry).filter(Boolean))).sort();

  // Set default expiry to nearest one
  useEffect(() => {
    if (expiryDates.length > 0 && !selectedExpiry) {
      setSelectedExpiry(expiryDates[0] || null);
    }
  }, [expiryDates, selectedExpiry]);

  // Filter options by selected expiry
  const filteredOptions = selectedExpiry 
    ? options.filter(o => o.expiry === selectedExpiry)
    : options;

  // Group by strike price
  const groupedByStrike = filteredOptions.reduce((acc, option) => {
    const strike = option.strike || "0";
    if (!acc[strike]) {
      acc[strike] = { strike, call: undefined, put: undefined };
    }
    if (option.option_type === 'call') {
      acc[strike].call = option;
    } else if (option.option_type === 'put') {
      acc[strike].put = option;
    }
    return acc;
  }, {} as Record<string, GroupedOption>);

  const sortedStrikes = Object.values(groupedByStrike).sort((a, b) => 
    parseFloat(a.strike) - parseFloat(b.strike)
  );

  // Format expiry date
  const formatExpiry = (expiryNs: string) => {
    const date = new Date(parseInt(expiryNs) / 1_000_000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  // Format number with appropriate decimals
  const formatNumber = (value: string | number, decimals: number = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return num.toFixed(decimals);
  };

  // Determine if strike is ITM/ATM/OTM
  const getStrikeStatus = (strike: string, optionType?: 'call' | 'put') => {
    if (!currentPrice) return 'otm';
    const strikePrice = parseFloat(strike);
    if (optionType === 'call') {
      return strikePrice < currentPrice ? 'itm' : 'otm';
    } else if (optionType === 'put') {
      return strikePrice > currentPrice ? 'itm' : 'otm';
    }
    return 'otm';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Error loading options chain
      </div>
    );
  }

  if (expiryDates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No active options found for {asset}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Expiry selector */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="text-xs text-muted-foreground">Expiry:</span>
        <Tabs value={selectedExpiry || expiryDates[0] || ''} onValueChange={setSelectedExpiry}>
          <TabsList className="glass-panel h-8">
            {expiryDates.slice(0, 5).map((expiry) => (
              <TabsTrigger 
                key={expiry || 'default'} 
                value={expiry || ''}
                className="text-xs h-7"
                data-testid={`expiry-tab-${expiry}`}
              >
                {expiry && formatExpiry(expiry)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Options chain table */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        <table className="w-full text-xs">
          <thead className="sticky top-0 glass-panel z-10">
            <tr className="border-b border-primary/10">
              {/* Calls header */}
              <th className="text-left py-2 px-2 font-medium text-success">Mark</th>
              <th className="text-left py-2 px-2 font-medium text-success">Delta</th>
              <th className="text-left py-2 px-2 font-medium text-success">IV</th>
              {/* Strike */}
              <th className="text-center py-2 px-3 font-medium text-foreground">Strike</th>
              {/* Puts header */}
              <th className="text-right py-2 px-2 font-medium text-destructive">Mark</th>
              <th className="text-right py-2 px-2 font-medium text-destructive">Delta</th>
              <th className="text-right py-2 px-2 font-medium text-destructive">IV</th>
            </tr>
          </thead>
          <tbody>
            {sortedStrikes.map((row) => {
              const strikeNum = parseFloat(row.strike);
              const isNearMoney = currentPrice && Math.abs(strikeNum - currentPrice) / currentPrice < 0.05;

              return (
                <tr 
                  key={row.strike} 
                  className={`border-b border-primary/5 hover-elevate ${isNearMoney ? 'bg-primary/5' : ''}`}
                  data-testid={`strike-row-${row.strike}`}
                >
                  {/* Call data */}
                  <td className="py-2 px-2 text-success font-medium">
                    {row.call ? `$${formatNumber(row.call.mark_price)}` : '-'}
                  </td>
                  <td className="py-2 px-2 text-success/80">
                    {row.call?.greeks?.delta ? formatNumber(row.call.greeks.delta, 3) : '-'}
                  </td>
                  <td className="py-2 px-2 text-success/70">
                    {row.call?.greeks?.iv ? `${formatNumber(parseFloat(row.call.greeks.iv) * 100, 1)}%` : '-'}
                  </td>

                  {/* Strike */}
                  <td className="py-2 px-3 text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">
                      {currentPrice && strikeNum < currentPrice && <TrendingUp className="w-3 h-3 text-success" />}
                      {currentPrice && strikeNum > currentPrice && <TrendingDown className="w-3 h-3 text-destructive" />}
                      ${formatNumber(row.strike, 0)}
                      {isNearMoney && <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1">ATM</Badge>}
                    </div>
                  </td>

                  {/* Put data */}
                  <td className="py-2 px-2 text-right text-destructive font-medium">
                    {row.put ? `$${formatNumber(row.put.mark_price)}` : '-'}
                  </td>
                  <td className="py-2 px-2 text-right text-destructive/80">
                    {row.put?.greeks?.delta ? formatNumber(row.put.greeks.delta, 3) : '-'}
                  </td>
                  <td className="py-2 px-2 text-right text-destructive/70">
                    {row.put?.greeks?.iv ? `${formatNumber(parseFloat(row.put.greeks.iv) * 100, 1)}%` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
