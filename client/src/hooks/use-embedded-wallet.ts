import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { generateEmbeddedWallets, clearWalletData, type GeneratedWallets } from '@/lib/walletGeneration';
import type { EmbeddedWallet } from '@shared/schema';

export function useEmbeddedWallet() {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [generatedWallets, setGeneratedWallets] = useState<GeneratedWallets | null>(null);

  // Query to fetch existing embedded wallet
  const { data: embeddedWallet, isLoading, refetch } = useQuery<{ success: boolean; wallet: EmbeddedWallet }>({
    queryKey: ['/api/wallets/embedded'],
    retry: false,
    // Don't throw on 404 - it's expected if no wallet exists yet
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/wallets/embedded');
      if (res.status === 404) {
        return { success: false, wallet: null as any };
      }
      return await res.json();
    },
  });

  // Mutation to create embedded wallet
  const createWalletMutation = useMutation({
    mutationFn: async (addresses: { 
      solanaAddress: string; 
      evmAddress: string;
      polygonAddress: string;
      hyperliquidAddress: string;
      bnbAddress: string;
    }) => {
      const res = await apiRequest('POST', '/api/wallets/embedded', addresses);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/embedded'] });
    },
  });

  // Mutation to mark seed phrase as shown
  const confirmSeedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/wallets/embedded/confirm-seed', {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/embedded'] });
      setShowRecoveryModal(false);
      
      // CRITICAL SECURITY: Clear sensitive wallet data from memory
      if (generatedWallets) {
        clearWalletData(generatedWallets);
        setGeneratedWallets(null);
      }
    },
  });

  // Function to initiate embedded wallet creation
  const createEmbeddedWallet = async () => {
    // Generate wallets client-side
    const wallets = generateEmbeddedWallets();
    
    // Store temporarily for recovery modal display
    setGeneratedWallets(wallets);
    
    // Save public addresses to database (NO PRIVATE KEYS)
    await createWalletMutation.mutateAsync({
      solanaAddress: wallets.solana.publicKey,
      evmAddress: wallets.evm.address,
      polygonAddress: wallets.polygon.address,
      hyperliquidAddress: wallets.hyperliquid.address,
      bnbAddress: wallets.bnb.address,
    });
    
    // Show recovery modal
    setShowRecoveryModal(true);
  };

  const handleRecoveryConfirm = () => {
    confirmSeedMutation.mutate();
  };

  const handleRecoveryClose = () => {
    // Don't allow closing without confirming
    // User must explicitly click Continue
  };

  // SECURITY: Cleanup sensitive data if component unmounts before confirmation
  useEffect(() => {
    return () => {
      if (generatedWallets) {
        console.log('[Security] Cleaning up wallet data on unmount');
        clearWalletData(generatedWallets);
      }
    };
  }, [generatedWallets]);

  return {
    embeddedWallet: embeddedWallet?.wallet,
    hasEmbeddedWallet: !!embeddedWallet?.wallet,
    isLoading,
    seedPhrase: generatedWallets?.seedPhrase || '',
    showRecoveryModal,
    createEmbeddedWallet,
    handleRecoveryConfirm,
    handleRecoveryClose,
    isCreating: createWalletMutation.isPending,
    isConfirming: confirmSeedMutation.isPending,
    refetch,
  };
}
