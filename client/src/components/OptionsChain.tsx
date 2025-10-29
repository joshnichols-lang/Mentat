import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { Loader2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStrategyStore } from "@/stores/strategyStore";
import { useToast } from "@/hooks/use-toast";

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
  best_bid?: string;
  best_ask?: string;
  open_interest?: string;
  volume_24h?: string;
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
  const { selectMarket, setExpiry, setCurrentSpotPrice } = useStrategyStore();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ success: boolean; markets: AevoMarket[] }>({
    queryKey: [`/api/aevo/markets?asset=${asset}&instrument_type=OPTION`],
    enabled: !!asset,
  });

  const markets = data?.markets || [];
  
  const options = useMemo(() => 
    markets.filter(m => 
      m.instrument_type === 'OPTION' && 
      m.is_active && 
      m.underlying_asset === asset
    ),
    [markets, asset]
  );

  const expiryDates = useMemo(() => 
    Array.from(new Set(options.map(o => o.expiry).filter(Boolean))).sort(),
    [options]
  );

  useEffect(() => {
    if (expiryDates.length > 0 && !selectedExpiry) {
      const firstExpiry = expiryDates[0] || null;
      setSelectedExpiry(firstExpiry);
      if (firstExpiry) {
        setExpiry(firstExpiry);
      }
    }
  }, [expiryDates, selectedExpiry, setExpiry]);

  useEffect(() => {
    if (currentPrice) {
      setCurrentSpotPrice(currentPrice);
    }
  }, [currentPrice, setCurrentSpotPrice]);

  const handleMarketClick = (market: AevoMarket) => {
    selectMarket(market);
    toast({
      title: "Option Selected",
      description: `${market.option_type?.toUpperCase()} $${market.strike} - ${market.expiry && formatExpiry(market.expiry)}`,
    });
  };

  const filteredOptions = selectedExpiry 
    ? options.filter(o => o.expiry === selectedExpiry)
    : options;

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

  const formatExpiry = (expiryNs: string) => {
    const date = new Date(parseInt(expiryNs) / 1_000_000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatNumber = (value: string | number, decimals: number = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return num.toFixed(decimals);
  };

  const formatVolume = (value?: string) => {
    if (!value) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const getStrikeStatus = (strike: string, optionType?: 'call' | 'put') => {
    if (!currentPrice) return 'otm';
    const strikePrice = parseFloat(strike);
    const threshold = currentPrice * 0.02; // 2% threshold for ATM
    
    if (Math.abs(strikePrice - currentPrice) < threshold) return 'atm';
    
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
    <div className="flex flex-col h-full gap-2">
      {/* Header with spot price */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Expiry:</span>
          <Tabs value={selectedExpiry || expiryDates[0] || ''} onValueChange={setSelectedExpiry}>
            <TabsList className="glass-panel h-7">
              {expiryDates.slice(0, 6).map((expiry) => (
                <TabsTrigger 
                  key={expiry || 'default'} 
                  value={expiry || ''}
                  className="text-xs h-6 px-2"
                  data-testid={`expiry-tab-${expiry}`}
                >
                  {expiry && formatExpiry(expiry)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {currentPrice && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Spot:</span>
            <span className="text-sm font-semibold text-foreground">${formatNumber(currentPrice, 2)}</span>
          </div>
        )}
      </div>

      {/* Options chain table */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 glass-panel z-10">
            <tr className="border-b border-primary/10">
              {/* Calls header */}
              <th className="text-left py-2 px-1.5 font-medium text-success/90">Bid</th>
              <th className="text-left py-2 px-1.5 font-medium text-success">Ask</th>
              <th className="text-left py-2 px-1.5 font-medium text-success/70">OI</th>
              <th className="text-left py-2 px-1.5 font-medium text-success/70">Vol</th>
              <th className="text-left py-2 px-1.5 font-medium text-success/80">Δ</th>
              <th className="text-left py-2 px-1.5 font-medium text-success/70">IV</th>
              {/* Strike */}
              <th className="text-center py-2 px-2 font-medium text-foreground">Strike</th>
              {/* Puts header */}
              <th className="text-right py-2 px-1.5 font-medium text-destructive/70">IV</th>
              <th className="text-right py-2 px-1.5 font-medium text-destructive/80">Δ</th>
              <th className="text-right py-2 px-1.5 font-medium text-destructive/70">Vol</th>
              <th className="text-right py-2 px-1.5 font-medium text-destructive/70">OI</th>
              <th className="text-right py-2 px-1.5 font-medium text-destructive">Bid</th>
              <th className="text-right py-2 px-1.5 font-medium text-destructive/90">Ask</th>
            </tr>
          </thead>
          <tbody>
            {sortedStrikes.map((row) => {
              const strikeNum = parseFloat(row.strike);
              const callStatus = getStrikeStatus(row.strike, 'call');
              const putStatus = getStrikeStatus(row.strike, 'put');
              const isATM = callStatus === 'atm' || putStatus === 'atm';

              return (
                <tr 
                  key={row.strike} 
                  className={`border-b border-primary/5 hover-elevate ${isATM ? 'bg-primary/8' : callStatus === 'itm' ? 'bg-success/5' : putStatus === 'itm' ? 'bg-destructive/5' : ''}`}
                  data-testid={`strike-row-${row.strike}`}
                >
                  {/* Call Bid */}
                  <td 
                    className={`py-1.5 px-1.5 text-success/90 ${row.call ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.call && handleMarketClick(row.call)}
                    data-testid={`call-bid-${row.strike}`}
                  >
                    {row.call?.best_bid ? `$${formatNumber(row.call.best_bid)}` : '-'}
                  </td>
                  {/* Call Ask */}
                  <td 
                    className={`py-1.5 px-1.5 text-success font-medium ${row.call ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.call && handleMarketClick(row.call)}
                    data-testid={`call-ask-${row.strike}`}
                  >
                    {row.call?.best_ask ? `$${formatNumber(row.call.best_ask)}` : '-'}
                  </td>
                  {/* Call OI */}
                  <td 
                    className={`py-1.5 px-1.5 text-success/70 text-[10px] ${row.call ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.call && handleMarketClick(row.call)}
                  >
                    {formatVolume(row.call?.open_interest)}
                  </td>
                  {/* Call Volume */}
                  <td 
                    className={`py-1.5 px-1.5 text-success/70 text-[10px] ${row.call ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.call && handleMarketClick(row.call)}
                  >
                    {formatVolume(row.call?.volume_24h)}
                  </td>
                  {/* Call Delta */}
                  <td 
                    className={`py-1.5 px-1.5 text-success/80 ${row.call ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.call && handleMarketClick(row.call)}
                  >
                    {row.call?.greeks?.delta ? formatNumber(row.call.greeks.delta, 2) : '-'}
                  </td>
                  {/* Call IV */}
                  <td 
                    className={`py-1.5 px-1.5 text-success/70 ${row.call ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.call && handleMarketClick(row.call)}
                  >
                    {row.call?.greeks?.iv ? `${formatNumber(parseFloat(row.call.greeks.iv) * 100, 0)}%` : '-'}
                  </td>

                  {/* Strike */}
                  <td className="py-1.5 px-2 text-center font-bold">
                    <div className="flex items-center justify-center gap-1">
                      {currentPrice && strikeNum < currentPrice && <ArrowUpRight className="w-2.5 h-2.5 text-success" />}
                      {currentPrice && strikeNum > currentPrice && <ArrowDownRight className="w-2.5 h-2.5 text-destructive" />}
                      <span className={isATM ? 'text-primary' : ''}>${formatNumber(row.strike, 0)}</span>
                      {isATM && <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1 h-4">ATM</Badge>}
                    </div>
                  </td>

                  {/* Put IV */}
                  <td 
                    className={`py-1.5 px-1.5 text-right text-destructive/70 ${row.put ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.put && handleMarketClick(row.put)}
                  >
                    {row.put?.greeks?.iv ? `${formatNumber(parseFloat(row.put.greeks.iv) * 100, 0)}%` : '-'}
                  </td>
                  {/* Put Delta */}
                  <td 
                    className={`py-1.5 px-1.5 text-right text-destructive/80 ${row.put ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.put && handleMarketClick(row.put)}
                  >
                    {row.put?.greeks?.delta ? formatNumber(row.put.greeks.delta, 2) : '-'}
                  </td>
                  {/* Put Volume */}
                  <td 
                    className={`py-1.5 px-1.5 text-right text-destructive/70 text-[10px] ${row.put ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.put && handleMarketClick(row.put)}
                  >
                    {formatVolume(row.put?.volume_24h)}
                  </td>
                  {/* Put OI */}
                  <td 
                    className={`py-1.5 px-1.5 text-right text-destructive/70 text-[10px] ${row.put ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.put && handleMarketClick(row.put)}
                  >
                    {formatVolume(row.put?.open_interest)}
                  </td>
                  {/* Put Bid */}
                  <td 
                    className={`py-1.5 px-1.5 text-right text-destructive font-medium ${row.put ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.put && handleMarketClick(row.put)}
                    data-testid={`put-bid-${row.strike}`}
                  >
                    {row.put?.best_bid ? `$${formatNumber(row.put.best_bid)}` : '-'}
                  </td>
                  {/* Put Ask */}
                  <td 
                    className={`py-1.5 px-1.5 text-right text-destructive/90 ${row.put ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                    onClick={() => row.put && handleMarketClick(row.put)}
                    data-testid={`put-ask-${row.strike}`}
                  >
                    {row.put?.best_ask ? `$${formatNumber(row.put.best_ask)}` : '-'}
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
