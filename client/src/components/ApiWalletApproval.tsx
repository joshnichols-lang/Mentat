import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ExternalLink, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEmbeddedWallet } from "@/hooks/use-embedded-wallet";
import { apiRequest } from "@/lib/queryClient";

/**
 * ApiWalletApproval - Handles Hyperliquid API wallet delegation
 * 
 * Architecture:
 * 1. Platform generates separate API wallet (different seed) for security
 * 2. User signs EIP-712 approveAgent message with connected wallet
 * 3. API wallet can sign trades on behalf of user's main wallet
 * 4. Only API wallet private key is stored (encrypted) - user maintains full control
 * 5. User can revoke API wallet anytime from Hyperliquid UI
 * 
 * Security model:
 * - API wallet CANNOT withdraw funds (only sign trades)
 * - User's embedded wallet holds the funds
 * - User can revoke approval anytime
 */
export function ApiWalletApproval() {
  const { address } = useAccount();
  const { embeddedWallet, refetch } = useEmbeddedWallet();
  const [showModal, setShowModal] = useState(false);
  const [apiWalletAddress, setApiWalletAddress] = useState<string | null>(null);
  const [step, setStep] = useState<"referral" | "approval" | "complete">("referral");

  // EIP-712 signature for approveAgent
  const { signTypedDataAsync } = useSignTypedData();

  // Generate API wallet
  const generateApiWallet = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallets/generate-api-wallet');
      const data = await response.json() as { apiWalletAddress: string };
      return data;
    },
    onSuccess: (data) => {
      setApiWalletAddress(data.apiWalletAddress);
      setStep("approval");
    },
  });

  // Store API wallet approval
  const storeApproval = useMutation({
    mutationFn: async ({ signature, apiWalletAddress, nonce }: { signature: `0x${string}`; apiWalletAddress: string; nonce: string }) => {
      await apiRequest('POST', '/api/wallets/approve-api-wallet', { signature, apiWalletAddress, nonce });
    },
    onSuccess: () => {
      setStep("complete");
      refetch();
    },
  });

  // Handle approval flow
  const handleApprove = async () => {
    if (!embeddedWallet?.hyperliquidAddress || !apiWalletAddress) return;

    try {
      const nonce = BigInt(Date.now());
      
      // EIP-712 typed data for approveAgent
      const typedData = {
        domain: {
          name: "HyperliquidSignTransaction",
          version: "1",
          chainId: 421614, // 0x66eee - Hyperliquid's chain ID
          verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        },
        types: {
          "HyperliquidTransaction:ApproveAgent": [
            { name: "hyperliquidChain", type: "string" },
            { name: "signatureChainId", type: "string" },
            { name: "agentAddress", type: "string" },
            { name: "agentName", type: "string" },
            { name: "nonce", type: "uint64" },
          ],
        },
        primaryType: "HyperliquidTransaction:ApproveAgent" as const,
        message: {
          hyperliquidChain: "Mainnet",
          signatureChainId: "0x66eee",
          agentAddress: apiWalletAddress,
          agentName: "1fox_agent",
          nonce: nonce,
        },
      };

      // Sign with connected wallet
      const signature = await signTypedDataAsync(typedData);

      // Store approval in backend (include nonce for verification)
      await storeApproval.mutateAsync({ signature, apiWalletAddress, nonce: nonce.toString() });
    } catch (error) {
      console.error('Error approving API wallet:', error);
    }
  };

  // Check if API wallet needs approval
  const needsApproval = embeddedWallet && !embeddedWallet.apiWalletApproved;

  if (!needsApproval) return null;

  return (
    <>
      <Alert className="border-orange-500/50 bg-orange-500/10" data-testid="alert-api-wallet-needed">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <AlertDescription className="ml-2">
          <div className="flex items-center justify-between">
            <span>Enable AI trading by approving the secure API wallet</span>
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                setShowModal(true);
                generateApiWallet.mutate();
              }}
              data-testid="button-setup-api-wallet"
            >
              Setup Now
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-api-wallet-approval">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {step === "referral" && "Step 1: Set Referral Code"}
              {step === "approval" && "Step 2: Approve API Wallet"}
              {step === "complete" && "Setup Complete!"}
            </DialogTitle>
            <DialogDescription>
              {step === "referral" && "First, set the 1fox referral code to earn fee discounts"}
              {step === "approval" && "Sign to authorize secure trading"}
              {step === "complete" && "Your API wallet is ready for AI trading"}
            </DialogDescription>
          </DialogHeader>

          {step === "referral" && (
            <div className="space-y-4 py-4">
              <Alert>
                <AlertDescription>
                  To earn 4% fee discounts and support 1fox, please set the referral code via Hyperliquid's website.
                  This is a one-time step that must be done through their official interface.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm font-medium">Instructions:</p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Click the button below to open Hyperliquid in a new tab</li>
                  <li>Connect your wallet ({address?.slice(0, 6)}...{address?.slice(-4)})</li>
                  <li>Enter referral code: <strong className="text-foreground font-mono">1FOX</strong></li>
                  <li>Confirm and return here to continue</li>
                </ol>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => window.open('https://app.hyperliquid.xyz/referrals', '_blank')}
                data-testid="button-open-hyperliquid-referrals"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Hyperliquid Referrals Page
              </Button>

              <Button
                className="w-full"
                onClick={() => {
                  setStep("approval");
                  generateApiWallet.mutate();
                }}
                disabled={generateApiWallet.isPending}
                data-testid="button-continue-to-approval"
              >
                {generateApiWallet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                I've Set the Referral Code - Continue
              </Button>
            </div>
          )}

          {step === "approval" && (
            <div className="space-y-4 py-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <strong>Security:</strong> The API wallet can only sign trades, not withdraw funds.
                  You maintain full control and can revoke access anytime.
                </AlertDescription>
              </Alert>

              {apiWalletAddress && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">API Wallet Address:</p>
                  <p className="text-xs font-mono break-all text-muted-foreground">{apiWalletAddress}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">What you're approving:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>API wallet can sign trades on your behalf</li>
                  <li>All trades execute under 1fox referral code</li>
                  <li>API wallet CANNOT withdraw your funds</li>
                  <li>You can revoke this anytime from Hyperliquid UI</li>
                </ul>
              </div>

              <Button
                className="w-full"
                onClick={handleApprove}
                disabled={storeApproval.isPending}
                data-testid="button-sign-approval"
              >
                {storeApproval.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign Approval with Wallet
              </Button>
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <div>
                  <p className="font-medium">API Wallet Approved!</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    You can now use AI-powered trading features
                  </p>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Next steps:</strong> Deposit funds to your embedded Hyperliquid wallet to start trading.
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={() => setShowModal(false)}
                  data-testid="button-close-api-approval"
                >
                  Got it!
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
