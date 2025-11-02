import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, Wallet, AlertCircle, Zap, Circle, Server, Boxes, Diamond } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletAddress {
  label: string;
  address: string;
  chain: string;
  description: string;
  icon: string;
}

export function MyWallets() {
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    wallet: {
      hyperliquidAddress: string;
      solanaAddress: string;
      evmAddress: string;
      polygonAddress: string;
      bnbAddress: string;
    };
  }>({
    queryKey: ["/api/wallets/embedded"],
  });

  const embeddedWallet = data?.wallet;

  const copyAddress = async (address: string, label: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast({
      title: "Address copied",
      description: `${label} address copied to clipboard`,
    });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  if (isLoading) {
    return (
      <Card data-testid="card-my-wallets">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            My Wallets
          </CardTitle>
          <CardDescription>Your cross-chain wallet addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !embeddedWallet) {
    return (
      <Card data-testid="card-my-wallets">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            My Wallets
          </CardTitle>
          <CardDescription>Your cross-chain wallet addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load wallet addresses. Please ensure you have completed wallet setup.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const wallets: WalletAddress[] = [
    {
      label: "Hyperliquid",
      address: embeddedWallet.hyperliquidAddress,
      chain: "Arbitrum",
      description: "For USDC deposits and perpetual futures trading",
      icon: "zap",
    },
    {
      label: "Polymarket",
      address: embeddedWallet.polygonAddress,
      chain: "Polygon",
      description: "For prediction market trading",
      icon: "circle",
    },
    {
      label: "Solana",
      address: embeddedWallet.solanaAddress,
      chain: "Solana",
      description: "For Solana-based trading",
      icon: "server",
    },
    {
      label: "EVM",
      address: embeddedWallet.evmAddress,
      chain: "Multi-chain",
      description: "For Ethereum and all EVM-compatible chains",
      icon: "boxes",
    },
    {
      label: "BNB Chain",
      address: embeddedWallet.bnbAddress,
      chain: "BSC",
      description: "For BNB Chain (Binance Smart Chain) trading",
      icon: "diamond",
    },
  ];

  const iconComponents = {
    zap: Zap,
    circle: Circle,
    server: Server,
    boxes: Boxes,
    diamond: Diamond,
  };

  return (
    <Card data-testid="card-my-wallets">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          My Wallets
        </CardTitle>
        <CardDescription>Your cross-chain wallet addresses - generated from your recovery key</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Security Note:</strong> These addresses were derived from your recovery key. 
            Never share your recovery key with anyone. These public addresses are safe to share for receiving funds.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {wallets.map((wallet) => {
            const IconComponent = iconComponents[wallet.icon as keyof typeof iconComponents];
            return (
              <div
                key={wallet.label}
                className="rounded-lg border p-4 space-y-2 hover-elevate"
                data-testid={`wallet-${wallet.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-medium text-sm">{wallet.label}</h4>
                      <p className="text-xs text-muted-foreground">{wallet.chain}</p>
                    </div>
                  </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyAddress(wallet.address, wallet.label)}
                  data-testid={`button-copy-${wallet.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {copiedAddress === wallet.address ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                </div>
                <div 
                  className="font-mono text-xs break-all bg-muted p-2 rounded"
                  data-testid={`text-address-${wallet.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {wallet.address}
                </div>
                <p className="text-xs text-muted-foreground">{wallet.description}</p>
              </div>
            );
          })}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Important:</strong> Only send supported tokens to these addresses. 
            For Hyperliquid, only USDC on Arbitrum is accepted. Sending other tokens may result in permanent loss.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
