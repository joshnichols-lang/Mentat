import { useState } from 'react';
import { ChevronDown, Coins, TrendingUp, Wallet, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWalletBalances } from '@/hooks/use-wallet-balances';

type Chain = 'solana' | 'hyperliquid';

interface ChainConfig {
  id: Chain;
  name: string;
  shortName: string;
  icon: typeof Coins;
}

const CHAINS: ChainConfig[] = [
  {
    id: 'solana',
    name: 'Solana',
    shortName: 'SOL',
    icon: Coins,
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid Perps',
    shortName: 'Perps',
    icon: TrendingUp,
  },
];

export default function ChainSwitcher() {
  const [selectedChain, setSelectedChain] = useState<Chain>('hyperliquid');
  const { data: balancesData, isLoading, error } = useWalletBalances();

  const balances = balancesData?.balances;
  const selectedChainConfig = CHAINS.find(c => c.id === selectedChain)!;
  const Icon = selectedChainConfig.icon;

  // Get balance for selected chain
  const getChainBalance = () => {
    if (!balances) return { primary: 0, secondary: 0, total: 0 };

    if (selectedChain === 'solana') {
      return {
        primary: balances.solana.sol,
        primaryLabel: 'SOL',
        secondary: balances.solana.usdc,
        secondaryLabel: 'USDC',
        total: balances.solana.totalUsd,
      };
    } else {
      return {
        primary: balances.hyperliquid.accountValue,
        primaryLabel: 'Portfolio',
        secondary: balances.hyperliquid.withdrawable,
        secondaryLabel: 'Free Margin',
        total: balances.hyperliquid.accountValue,
      };
    }
  };

  const chainBalance = getChainBalance();
  const hasError = !!error || !balances;

  // Calculate if free margin is critically low (only for Hyperliquid)
  const isLowFreeMargin = selectedChain === 'hyperliquid' && 
    balances && 
    balances.hyperliquid.withdrawable < Math.max(5, balances.hyperliquid.accountValue * 0.01) &&
    balances.hyperliquid.accountValue > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Total Balance */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-right border-l pl-3">
              <div className="flex items-center gap-1.5">
                <div className="text-xs text-muted-foreground">Total Balance</div>
                <Wallet className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="font-mono text-sm font-semibold" data-testid="text-total-balance">
                {isLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : hasError ? (
                  <span className="text-destructive">Error</span>
                ) : (
                  `$${balances?.totalUsd.toFixed(2)}`
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold">Multi-Chain Balance Breakdown:</div>
              <div className="space-y-0.5">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Solana:</span>
                  <span className="font-mono">${balances?.solana.totalUsd.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Arbitrum:</span>
                  <span className="font-mono">${balances?.arbitrum.totalUsd.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Hyperliquid:</span>
                  <span className="font-mono">${balances?.hyperliquid.accountValue.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Chain Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
            data-testid="button-chain-switcher"
          >
            <Icon className="h-4 w-4" />
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{selectedChainConfig.shortName}</span>
                {isLowFreeMargin && (
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                )}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {isLoading ? (
                  'Loading...'
                ) : hasError ? (
                  'Error'
                ) : (
                  `$${chainBalance.total.toFixed(2)}`
                )}
              </div>
            </div>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Select Chain
          </DropdownMenuLabel>
          {CHAINS.map((chain) => {
            const ChainIcon = chain.icon;
            const isActive = selectedChain === chain.id;
            
            let balance = 0;
            let subBalance = '';
            
            if (balances) {
              if (chain.id === 'solana') {
                balance = balances.solana.totalUsd;
                subBalance = `${balances.solana.sol.toFixed(4)} SOL • ${balances.solana.usdc.toFixed(2)} USDC`;
              } else {
                balance = balances.hyperliquid.accountValue;
                subBalance = `Free: $${balances.hyperliquid.withdrawable.toFixed(2)}`;
              }
            }

            return (
              <DropdownMenuItem
                key={chain.id}
                onClick={() => setSelectedChain(chain.id)}
                className="flex items-center justify-between cursor-pointer"
                data-testid={`menu-item-chain-${chain.id}`}
              >
                <div className="flex items-center gap-2">
                  <ChainIcon className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">{chain.name}</div>
                    {!isLoading && !hasError && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {subBalance}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isLoading && !hasError && (
                    <span className="font-mono text-sm font-semibold">
                      ${balance.toFixed(2)}
                    </span>
                  )}
                  {isActive && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      Active
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
          
          <DropdownMenuSeparator />
          
          <div className="px-2 py-1.5">
            <div className="text-xs text-muted-foreground mb-1">Arbitrum (coming soon)</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {balances ? `${balances.arbitrum.eth.toFixed(4)} ETH • ${balances.arbitrum.usdc.toFixed(2)} USDC` : 'Loading...'}
              </span>
              <span className="font-mono">
                ${balances?.arbitrum.totalUsd.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
