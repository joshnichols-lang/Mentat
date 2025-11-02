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
import { AlertCircle, ExternalLink, Copy, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const { isConnected } = useAccount();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

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

  const copyAddress = async () => {
    if (embeddedWallet?.hyperliquidAddress) {
      await navigator.clipboard.writeText(embeddedWallet.hyperliquidAddress);
      setCopied(true);
      toast({
        title: "Address copied",
        description: "Embedded wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Reset copied state when modal closes
  useEffect(() => {
    if (!open) {
      setCopied(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-deposit">
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
          <DialogDescription>
            Bridge USDC to Arbitrum for your Hyperliquid wallet using Router Nitro
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
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Destination Address</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  data-testid="button-copy-address"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="font-mono text-xs break-all bg-muted p-2 rounded" data-testid="text-wallet-address">
                {embeddedWallet.hyperliquidAddress}
              </div>
              <p className="text-xs text-muted-foreground">
                This is your embedded Hyperliquid wallet where funds will be deposited
              </p>
            </div>

            <Alert variant="destructive" data-testid="alert-usdc-arbitrum-only">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>IMPORTANT:</strong> Hyperliquid only accepts USDC on Arbitrum. 
                Bridge USDC to Arbitrum (Chain ID: 42161) only. Other tokens or chains will result in lost funds.
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>How it works:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Click "Open Bridge Widget" to launch Router Nitro</li>
                  <li>Select source chain and token (supports 30+ chains)</li>
                  <li>Bridge to USDC on Arbitrum (destination is pre-filled)</li>
                  <li>Confirm transaction in your wallet</li>
                  <li>Funds will arrive at your embedded Hyperliquid address</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              <Button
                onClick={openBridgeWidget}
                className="w-full"
                data-testid="button-open-bridge"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Bridge Widget
              </Button>
              
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close"
              >
                Close
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Bridge from 30+ chains including Ethereum, Polygon, Base, Optimism. Router Nitro will convert to USDC on Arbitrum automatically.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
