import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface WalletBalances {
  solana: {
    sol: number;
    usdc: number;
    totalUsd: number;
  };
  arbitrum: {
    eth: number;
    usdc: number;
    totalUsd: number;
  };
  hyperliquid: {
    accountValue: number;
    withdrawable: number;
  };
  totalUsd: number;
}

export function useWalletBalances() {
  return useQuery<{ success: boolean; balances: WalletBalances }>({
    queryKey: ['/api/wallets/balances'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/wallets/balances');
      if (!res.ok) {
        // If no embedded wallet exists yet, return zeros
        if (res.status === 404 || res.status === 500) {
          return {
            success: true,
            balances: {
              solana: { sol: 0, usdc: 0, totalUsd: 0 },
              arbitrum: { eth: 0, usdc: 0, totalUsd: 0 },
              hyperliquid: { accountValue: 0, withdrawable: 0 },
              totalUsd: 0,
            },
          };
        }
        throw new Error('Failed to fetch wallet balances');
      }
      return await res.json();
    },
  });
}
