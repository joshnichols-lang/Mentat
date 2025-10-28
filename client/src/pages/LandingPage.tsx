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
import { ArrowRight, TrendingUp, Shield, Zap, Bot } from "lucide-react";
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { address, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  
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
        description: `Welcome to 1fox`,
      });
      setAuthCompleted(true);
    },
    onError: (error: Error) => {
      toast({
        title: 'Authentication failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsAuthenticating(false);
    },
  });

  // Authenticate wallet when connected
  useEffect(() => {
    const authenticateWallet = async () => {
      if (isConnected && address && !isAuthenticating && !walletAuthMutation.isPending && !authCompleted) {
        setIsAuthenticating(true);
        
        try {
          // Fetch nonce from server
          const nonceRes = await fetch(`/api/auth/wallet/nonce?address=${address}`);
          if (!nonceRes.ok) {
            throw new Error('Failed to fetch nonce');
          }
          const { nonce } = await nonceRes.json();

          // Create message with nonce
          const message = `Sign this message to authenticate with 1fox.\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
          
          const signature = await signMessageAsync({
            message,
          });

          await walletAuthMutation.mutateAsync({
            walletAddress: address,
            signature,
            message,
            nonce,
          });
        } catch (error: any) {
          console.error('Wallet authentication error:', error);
          toast({
            title: 'Signature required',
            description: 'Please sign the message to authenticate',
            variant: 'destructive',
          });
          setIsAuthenticating(false);
        }
      }
    };

    authenticateWallet();
  }, [isConnected, address, isAuthenticating, walletAuthMutation.isPending, authCompleted, signMessageAsync, connector, toast]);

  // After external wallet auth completes, check if user needs embedded wallets
  useEffect(() => {
    const initializeEmbeddedWallets = async () => {
      if (authCompleted && !hasEmbeddedWallet && !isCreating) {
        try {
          await createEmbeddedWallet();
        } catch (error) {
          console.error('Failed to create embedded wallets:', error);
          toast({
            title: 'Wallet Creation Failed',
            description: 'Failed to generate embedded wallets. Please try again.',
            variant: 'destructive',
          });
        }
      }
    };

    initializeEmbeddedWallets();
  }, [authCompleted, hasEmbeddedWallet, isCreating, createEmbeddedWallet, toast]);

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
        <header className="glass-header border-b border-border/40">
          <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="1fox" className="h-10 w-10" />
              <span className="text-2xl font-bold font-mono glow-orange">1fox</span>
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
                Let Mr. Fox handle the complexity.
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
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 pt-12 max-w-5xl mx-auto">
              <Card className="glass hover-illuminate p-6 border-border/40">
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

              <Card className="glass hover-illuminate p-6 border-border/40">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center glow-amber">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold font-mono">AI Trading Agent</h3>
                  <p className="text-muted-foreground">
                    Mr. Fox analyzes markets 24/7, executes strategies, and maximizes your Sharpe ratio automatically.
                  </p>
                </div>
              </Card>

              <Card className="glass hover-illuminate p-6 border-border/40">
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
