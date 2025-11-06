import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, Wallet, AlertCircle, Zap, Circle, Server, Boxes, Diamond, Percent } from "lucide-react";
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

  const { data: referralData } = useQuery<{
    success: boolean;
    hasReferral: boolean;
    referralCode: string | null;
  }>({
    queryKey: ["/api/hyperliquid/referral-status"],
    enabled: !!data?.wallet,
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
      description: "Deposit: USDC on Arbitrum only. Perpetual futures trading.",
      icon: "zap",
    },
    {
      label: "Polymarket",
      address: embeddedWallet.polygonAddress,
      chain: "Polygon",
      description: "Deposit: USDC on Polygon. Prediction markets.",
      icon: "circle",
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
            const isHyperliquid = wallet.label === "Hyperliquid";
            const showDiscount = isHyperliquid && referralData?.hasReferral;
            
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
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{wallet.label}</h4>
                        {showDiscount && (
                          <Badge 
                            variant="secondary" 
                            className="text-xs px-1.5 py-0.5 flex items-center gap-1"
                            data-testid="badge-fee-discount"
                          >
                            <Percent className="h-3 w-3" />
                            4% fee discount
                          </Badge>
                        )}
                      </div>
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

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Critical:</strong> Hyperliquid requires USDC on Arbitrum. Polymarket requires USDC on Polygon. 
            Sending wrong tokens or wrong chains causes permanent loss.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
