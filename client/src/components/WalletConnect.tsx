import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccount, useSignMessage } from 'wagmi';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useEmbeddedWallet } from '@/hooks/use-embedded-wallet';
import { RecoveryPhraseModal } from '@/components/RecoveryPhraseModal';
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";

export default function WalletConnect() {
  const [, setLocation] = useLocation();
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

  useEffect(() => {
    const authenticateWallet = async () => {
      if (isConnected && address && !isAuthenticating && !walletAuthMutation.isPending) {
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
  }, [isConnected, address]);

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
  }, [authCompleted, hasEmbeddedWallet, isCreating]);

  // Navigate to terminal after recovery modal is confirmed
  useEffect(() => {
    if (authCompleted && hasEmbeddedWallet && !showRecoveryModal) {
      setLocation('/terminal');
    }
  }, [authCompleted, hasEmbeddedWallet, showRecoveryModal, setLocation]);

  return (
    <>
      <RecoveryPhraseModal
        isOpen={showRecoveryModal}
        seedPhrase={seedPhrase}
        onConfirm={handleRecoveryConfirm}
        onClose={handleRecoveryClose}
      />
    <div className="min-h-screen flex">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <img src={logoUrl} alt="1fox logo" className="h-10 w-10" />
              <CardTitle className="text-2xl">Welcome to 1fox</CardTitle>
            </div>
            <CardDescription>
              Connect your wallet to start AI-powered trading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Supported wallets: MetaMask, Rabby, Coinbase Wallet, WalletConnect, and more
              </p>
              
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
                              className="w-full"
                              size="lg"
                              data-testid="button-connect-wallet"
                            >
                              Connect Wallet
                            </Button>
                          );
                        }

                        return (
                          <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground">
                              {isAuthenticating || walletAuthMutation.isPending 
                                ? 'Authenticating...' 
                                : 'Connected'}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground">
                              {account.address}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Wallet Benefits
                  </span>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">▸</span>
                  <span>No password to remember - sign in with your wallet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">▸</span>
                  <span>Secure authentication using cryptographic signatures</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">▸</span>
                  <span>Trade directly from your wallet on Hyperliquid</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-muted items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-bold">1fox</h1>
          <p className="text-xl text-muted-foreground">
            AI-Powered Cryptocurrency Trading Terminal
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Wallet-based authentication for Hyperliquid perps</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Multi-provider AI support (Perplexity, ChatGPT, Grok)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Autonomous trading with custom strategies</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Advanced risk management and position tracking</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
    </>
  );
}
