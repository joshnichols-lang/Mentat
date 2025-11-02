import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, Copy, Check, Zap, TrendingUp, Coins, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const { isConnected } = useAccount();
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Get embedded wallet address
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
    enabled: open && isConnected,
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

  // Reset copied state when modal closes
  useEffect(() => {
    if (!open) {
      setCopiedAddress(null);
    }
  }, [open]);

  // Open Router Nitro Widget with destination address
  const openBridgeWidget = () => {
    if (embeddedWallet?.hyperliquidAddress) {
      // URL-encode destination address for safety
      const encodedAddress = encodeURIComponent(embeddedWallet.hyperliquidAddress);
      // Router Nitro widget URL with destination address and Arbitrum as destination chain
      const widgetUrl = `https://app.routernitro.com/swap?destinationAddress=${encodedAddress}&destinationChainId=42161`;
      
      // Open in popup - show popup blocker warning if fails
      const popup = window.open(widgetUrl, 'RouterNitro', 'width=500,height=700');
      
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site and try again",
          variant: "destructive",
        });
      }
    }
  };

  const wallets = [
    {
      icon: TrendingUp,
      name: "Hyperliquid",
      address: embeddedWallet?.hyperliquidAddress,
      depositInfo: "Deposit: USDC on Arbitrum only",
      description: "Perpetual futures trading",
      testId: "hyperliquid",
    },
    {
      icon: Zap,
      name: "Polymarket",
      address: embeddedWallet?.polygonAddress,
      depositInfo: "Deposit: USDC on Polygon",
      description: "Prediction markets",
      testId: "polymarket",
    },
    {
      icon: Coins,
      name: "Solana",
      address: embeddedWallet?.solanaAddress,
      depositInfo: "Deposit: SOL or SPL tokens",
      description: "Solana DeFi & spot markets",
      testId: "solana",
    },
    {
      icon: DollarSign,
      name: "BNB Chain",
      address: embeddedWallet?.bnbAddress,
      depositInfo: "Deposit: BNB or BEP-20 tokens",
      description: "Spot market trading",
      testId: "bnb",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-deposit">
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
          <DialogDescription>
            Your wallet addresses for each trading platform
          </DialogDescription>
        </DialogHeader>

        {!isConnected && (
          <Alert data-testid="alert-connect-wallet">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to view deposit options
            </AlertDescription>
          </Alert>
        )}

        {isConnected && isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {isConnected && error && (
          <Alert variant="destructive" data-testid="alert-wallet-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load embedded wallet address. Please try closing and reopening this dialog.
            </AlertDescription>
          </Alert>
        )}

        {isConnected && !isLoading && !error && !embeddedWallet && (
          <Alert data-testid="alert-no-wallet">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No embedded wallet found. Please ensure you have completed wallet setup.
            </AlertDescription>
          </Alert>
        )}

        {isConnected && !isLoading && !error && embeddedWallet && (
          <div className="space-y-4">
            <Alert variant="destructive" data-testid="alert-critical-warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>CRITICAL:</strong> Each platform only accepts specific tokens on specific chains. 
                Sending the wrong token or using the wrong chain will result in permanent loss of funds. 
                Double-check the deposit requirements below before sending.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              {wallets.map((wallet) => (
                <div
                  key={wallet.testId}
                  className="rounded-lg border p-4 space-y-3"
                  data-testid={`wallet-card-${wallet.testId}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <wallet.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{wallet.name}</h3>
                        <p className="text-xs text-muted-foreground">{wallet.description}</p>
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mt-1">
                          {wallet.depositInfo}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => wallet.address && copyAddress(wallet.address, wallet.name)}
                      data-testid={`button-copy-${wallet.testId}`}
                      className="shrink-0"
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
                    data-testid={`text-address-${wallet.testId}`}
                  >
                    {wallet.address}
                  </div>
                </div>
              ))}
            </div>

            <Alert data-testid="alert-bridge-info">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Need to bridge?</strong> Use Router Nitro to bridge from 30+ chains to the correct destination. 
                The bridge widget below auto-fills Hyperliquid's address (USDC on Arbitrum).
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              <Button
                onClick={openBridgeWidget}
                className="w-full"
                data-testid="button-open-bridge"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Bridge Widget (Hyperliquid)
              </Button>
              
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
