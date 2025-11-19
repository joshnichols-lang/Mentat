import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from 'wagmi';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useEmbeddedWallet } from '@/hooks/use-embedded-wallet';
import { RecoveryPhraseModal } from '@/components/RecoveryPhraseModal';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, TrendingUp, Shield, Zap, Bot, Loader2 } from "lucide-react";
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";

type AuthStep = 'idle' | 'connecting' | 'signing' | 'creating_wallet' | 'complete';

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { address, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('idle');
  const [walletCreationAttempted, setWalletCreationAttempted] = useState(false);
  const [walletCreationFailed, setWalletCreationFailed] = useState(false);
  const [isManualRetrying, setIsManualRetrying] = useState(false);
  
  const {
    hasEmbeddedWallet,
    seedPhrase,
    showRecoveryModal,
    createEmbeddedWallet,
    handleRecoveryConfirm,
    handleRecoveryClose,
    isCreating,
  } = useEmbeddedWallet();

  const walletAuthMutation = useMutation({
    mutationFn: async ({ walletAddress, signature, message, nonce }: { 
      walletAddress: string; 
      signature: string; 
      message: string;
      nonce: string;
    }) => {
      const res = await apiRequest('POST', '/api/auth/wallet', {
        walletAddress,
        signature,
        message,
        nonce,
        walletType: connector?.name || 'unknown',
      });
      return await res.json();
    },
    onSuccess: async (user) => {
      queryClient.setQueryData(['/api/user'], user);
      toast({
        title: 'Connected successfully!',
        description: `Welcome to Mentat`,
      });
      setAuthCompleted(true);
      setAuthStep('complete');
      setIsAuthenticating(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Authentication failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsAuthenticating(false);
      setAuthStep('idle');
    },
  });

  // Authenticate wallet when connected
  useEffect(() => {
    const authenticateWallet = async () => {
      if (isConnected && address && !isAuthenticating && !walletAuthMutation.isPending && !authCompleted) {
        setIsAuthenticating(true);
        setAuthStep('signing');
        
        try {
          // Fetch nonce from server
          const nonceRes = await fetch(`/api/auth/wallet/nonce?address=${address}`);
          if (!nonceRes.ok) {
            throw new Error('Failed to fetch authentication nonce from server');
          }
          const { nonce } = await nonceRes.json();

          // Create message with nonce
          const message = `Sign this message to authenticate with Mentat.\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
          
          // Request signature
          const signature = await signMessageAsync({
            message,
          });

          // Authenticate with backend
          await walletAuthMutation.mutateAsync({
            walletAddress: address,
            signature,
            message,
            nonce,
          });
        } catch (error: any) {
          console.error('Wallet authentication error:', error);
          
          // Handle specific error cases
          if (error.message?.includes('User rejected') || error.message?.includes('denied')) {
            toast({
              title: 'Signature Rejected',
              description: 'You must sign the message to authenticate with Mentat',
              variant: 'destructive',
            });
          } else if (error.message?.includes('nonce')) {
            toast({
              title: 'Authentication Error',
              description: 'Failed to fetch authentication nonce. Please try again.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Authentication Failed',
              description: error.message || 'An unexpected error occurred. Please try again.',
              variant: 'destructive',
            });
          }
          
          setIsAuthenticating(false);
          setAuthStep('idle');
        }
      }
    };

    authenticateWallet();
  }, [isConnected, address, isAuthenticating, walletAuthMutation.isPending, authCompleted, signMessageAsync, connector, toast]);

  // After external wallet auth completes, check if user needs embedded wallets
  useEffect(() => {
    const initializeEmbeddedWallets = async () => {
      // Don't run if manual retry is in progress
      if (authCompleted && !hasEmbeddedWallet && !isCreating && !walletCreationAttempted && !isManualRetrying) {
        setAuthStep('creating_wallet');
        setWalletCreationAttempted(true);
        try {
          await createEmbeddedWallet();
        } catch (error) {
          console.error('Failed to create embedded wallets:', error);
          setWalletCreationFailed(true);
          toast({
            title: 'Wallet Creation Failed',
            description: 'Failed to generate embedded wallets. Please click retry to try again.',
            variant: 'destructive',
          });
          setAuthStep('idle');
        }
      }
    };

    initializeEmbeddedWallets();
  }, [authCompleted, hasEmbeddedWallet, isCreating, walletCreationAttempted, isManualRetrying, createEmbeddedWallet, toast]);

  // Retry wallet creation handler - user-controlled retry with clear ownership
  const retryWalletCreation = async () => {
    setIsManualRetrying(true);
    setWalletCreationFailed(false);
    setAuthStep('creating_wallet');
    
    try {
      await createEmbeddedWallet();
      // Success handled by hasEmbeddedWallet effect
    } catch (error) {
      console.error('Manual retry failed:', error);
      setWalletCreationFailed(true);
      setAuthStep('idle');
      toast({
        title: 'Wallet Creation Failed',
        description: 'Failed to generate embedded wallets. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsManualRetrying(false);
    }
  };

  // Mark auth complete when embedded wallet is created
  useEffect(() => {
    if (hasEmbeddedWallet && authStep === 'creating_wallet') {
      setAuthStep('complete');
    }
  }, [hasEmbeddedWallet, authStep]);

  // Navigate to terminal after recovery modal is confirmed
  useEffect(() => {
    if (authCompleted && hasEmbeddedWallet && !showRecoveryModal) {
      setLocation('/terminal');
    }
  }, [authCompleted, hasEmbeddedWallet, showRecoveryModal, setLocation]);

  // Redirect authenticated users to terminal
  useEffect(() => {
    if (user) {
      setLocation("/terminal");
    }
  }, [user, setLocation]);

  return (
    <>
      <RecoveryPhraseModal
        isOpen={showRecoveryModal}
        seedPhrase={seedPhrase}
        onConfirm={handleRecoveryConfirm}
        onClose={handleRecoveryClose}
      />
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-background/95">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(180,96,0,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,193,7,0.08),transparent_40%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-background border-b border-border/50">
          <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Mentat" className="h-10 w-10" />
              <span className="text-2xl font-bold font-mono glow-orange">MENTAT</span>
            </div>
            <ConnectButton
              showBalance={false}
              accountStatus="address"
              chainStatus="none"
            />
          </div>
        </header>

        {/* Hero Section */}
        <main className="mx-auto max-w-7xl px-4 pt-20 pb-16">
          <div className="text-center space-y-8">
            {/* Main Heading */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold font-mono tracking-tight">
                <span className="glow-orange">AI-Powered Trading</span>
                <br />
                <span className="text-muted-foreground">Across All Markets</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                Your one-stop shop for perpetuals, prediction markets, and spot trading. 
                Let m.teg handle the complexity.
              </p>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <ConnectButton.Custom>
                {({ account, chain, openConnectModal, mounted }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;

                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        style: {
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        },
                      })}
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <Button
                              onClick={openConnectModal}
                              size="lg"
                              className="text-lg px-8 py-6 glow-orange hover-lift"
                              data-testid="button-connect-wallet"
                            >
                              <Bot className="mr-2 h-5 w-5" />
                              Connect Wallet to Start Trading
                              <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>

              {/* Authentication Status Indicator */}
              {authStep !== 'idle' && authStep !== 'complete' && !walletCreationFailed && (
                <Card className="bg-card max-w-md mx-auto mt-6 p-6 border-border/50" data-testid="card-auth-status">
                  <div className="flex items-center gap-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-lg mb-1" data-testid="text-auth-status-title">
                        {authStep === 'signing' && 'Authenticating Wallet'}
                        {authStep === 'creating_wallet' && 'Creating Trading Account'}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-auth-status-description">
                        {authStep === 'signing' && 'Please sign the message in your wallet to verify ownership'}
                        {authStep === 'creating_wallet' && 'Generating secure multi-chain wallets for trading...'}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Wallet Creation Retry */}
              {walletCreationFailed && (
                <Card className="bg-card max-w-md mx-auto mt-6 p-6 border-destructive/50" data-testid="card-wallet-retry">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-destructive" data-testid="text-wallet-retry-title">
                        Wallet Creation Failed
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-wallet-retry-description">
                        We encountered an error while creating your trading wallets. Please try again.
                      </p>
                    </div>
                    <Button
                      onClick={retryWalletCreation}
                      className="w-full"
                      data-testid="button-retry-wallet"
                    >
                      Retry Wallet Creation
                    </Button>
                  </div>
                </Card>
              )}
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 pt-12 max-w-5xl mx-auto">
              <Card className="bg-card hover-elevate p-6 border-border/50">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center glow-amber">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold font-mono">Three Markets</h3>
                  <p className="text-muted-foreground">
                    Trade perpetuals on Hyperliquid, prediction markets on Polymarket, and discover spot opportunities.
                  </p>
                </div>
              </Card>

              <Card className="bg-card hover-elevate p-6 border-border/50">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center glow-amber">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold font-mono">AI Trading Agent</h3>
                  <p className="text-muted-foreground">
                    m.teg analyzes markets 24/7, executes strategies, and maximizes your Sharpe ratio automatically.
                  </p>
                </div>
              </Card>

              <Card className="bg-card hover-elevate p-6 border-border/50">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center glow-amber">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold font-mono">Non-Custodial</h3>
                  <p className="text-muted-foreground">
                    Your keys, your coins. Auto-generated multi-chain wallets with full control and transparency.
                  </p>
                </div>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="pt-12 flex justify-center gap-12 flex-wrap">
              <div className="text-center">
                <div className="text-3xl font-bold font-mono glow-orange">3</div>
                <div className="text-sm text-muted-foreground">Market Types</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold font-mono glow-orange">24/7</div>
                <div className="text-sm text-muted-foreground">AI Monitoring</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold font-mono glow-orange">100%</div>
                <div className="text-sm text-muted-foreground">Non-Custodial</div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="absolute bottom-0 left-0 right-0 p-4 text-center text-sm text-muted-foreground">
          <p>Connect your wallet to get started • No signup required</p>
        </footer>
      </div>
    </div>
    </>
  );
}
