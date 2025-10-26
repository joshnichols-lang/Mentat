import { useEffect, useRef } from "react";
import { useEmbeddedWallet } from "@/hooks/use-embedded-wallet";
import { useAuth } from "@/hooks/use-auth";
import { RecoveryPhraseModal } from "./RecoveryPhraseModal";

/**
 * WalletInitializer - Automatically generates multi-chain wallets for first-time users
 * 
 * Flow:
 * 1. Check if user has an embedded wallet
 * 2. If not, automatically generate one (Solana, EVM, Hyperliquid addresses)
 * 3. Show seed phrase modal - user must save it
 * 4. After confirmation, seed phrase is cleared from memory forever
 * 
 * SECURITY: Seed phrases are NEVER stored - only shown once
 */
export function WalletInitializer() {
  const { user } = useAuth();
  const {
    hasEmbeddedWallet,
    isLoading,
    seedPhrase,
    showRecoveryModal,
    createEmbeddedWallet,
    handleRecoveryConfirm,
    handleRecoveryClose,
    isCreating,
  } = useEmbeddedWallet();

  // Prevent double generation with persistent flag across renders
  const initializationStartedRef = useRef(false);

  // Automatically generate wallet for first-time users
  useEffect(() => {
    if (!user) return;
    if (isLoading) return;
    if (hasEmbeddedWallet) return;
    if (isCreating) return;
    if (showRecoveryModal) return; // Already in process
    if (initializationStartedRef.current) return; // Already started initialization

    // User is authenticated but has no embedded wallet - create one automatically
    console.log('[WalletInitializer] First-time user detected, generating multi-chain wallet...');
    initializationStartedRef.current = true;
    createEmbeddedWallet();
  }, [user, isLoading, hasEmbeddedWallet, isCreating, showRecoveryModal, createEmbeddedWallet]);

  // Reset flag when user logs out or wallet is detected
  useEffect(() => {
    if (!user || hasEmbeddedWallet) {
      initializationStartedRef.current = false;
    }
  }, [user, hasEmbeddedWallet]);

  // Don't render anything - this component just handles the initialization logic
  // The modal is rendered when seed phrase is generated
  // Only render modal when it should be shown to avoid Dialog component errors
  if (!showRecoveryModal) {
    return null;
  }

  return (
    <RecoveryPhraseModal
      isOpen={showRecoveryModal}
      seedPhrase={seedPhrase}
      onConfirm={handleRecoveryConfirm}
      onClose={handleRecoveryClose}
    />
  );
}
