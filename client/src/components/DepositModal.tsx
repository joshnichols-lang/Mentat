import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ArrowRight, Check, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRouterBridge } from "@/hooks/use-router-bridge";
import { useQuery } from "@tanstack/react-query";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Supported chains and tokens
const CHAINS = [
  { 
    id: "1", 
    name: "Ethereum", 
    symbol: "ETH",
    tokens: [
      { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
      { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
    ]
  },
  { 
    id: "42161", 
    name: "Arbitrum", 
    symbol: "ARB",
    tokens: [
      { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
      { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
    ]
  },
  { 
    id: "137", 
    name: "Polygon", 
    symbol: "MATIC",
    tokens: [
      { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
      { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "MATIC", decimals: 18 },
    ]
  },
  { 
    id: "8453", 
    name: "Base", 
    symbol: "BASE",
    tokens: [
      { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
      { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
    ]
  },
];

// Hyperliquid destination (via Arbitrum bridge)
const HYPERLIQUID_CHAIN_ID = "42161"; // Bridge to Arbitrum first, then to Hyperliquid
const HYPERLIQUID_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const [fromChain, setFromChain] = useState(CHAINS[1].id); // Default to Arbitrum
  const [fromToken, setFromToken] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"input" | "quote" | "executing" | "success">("input");

  const { 
    isConnected, 
    address,
    quote,
    txHash,
    error,
    isLoading,
    getQuote,
    executeBridge,
    reset 
  } = useRouterBridge();

  // Get embedded wallet address
  const { data: embeddedWallet } = useQuery<{ hyperliquidAddress: string }>({
    queryKey: ["/api/wallets/embedded"],
    enabled: open && isConnected,
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep("input");
      setAmount("");
      reset();
    }
  }, [open, reset]);

  // Auto-select first token when chain changes
  useEffect(() => {
    const selectedChain = CHAINS.find(c => c.id === fromChain);
    if (selectedChain && selectedChain.tokens.length > 0) {
      setFromToken(selectedChain.tokens[0].address);
    }
  }, [fromChain]);

  const selectedChain = CHAINS.find(c => c.id === fromChain);
  const selectedToken = selectedChain?.tokens.find(t => t.address === fromToken);
  const recipientAddress = embeddedWallet?.hyperliquidAddress;

  const handleGetQuote = async () => {
    if (!amount || !selectedToken || !recipientAddress) return;

    try {
      const amountInSmallestUnit = (parseFloat(amount) * Math.pow(10, selectedToken.decimals)).toString();
      
      await getQuote({
        fromChainId: fromChain,
        fromTokenAddress: fromToken,
        toChainId: HYPERLIQUID_CHAIN_ID,
        toTokenAddress: HYPERLIQUID_USDC,
        amount: amountInSmallestUnit,
        slippageTolerance: "1",
      });

      setStep("quote");
    } catch (err) {
      console.error("Quote error:", err);
    }
  };

  const handleExecute = async () => {
    if (!quote || !recipientAddress) return;

    try {
      setStep("executing");
      await executeBridge({
        quote,
        recipientAddress,
      });
      setStep("success");
    } catch (err) {
      console.error("Execute error:", err);
      setStep("quote"); // Go back to quote step on error
    }
  };

  if (!isConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="dialog-deposit">
          <DialogHeader>
            <DialogTitle>Deposit Funds</DialogTitle>
            <DialogDescription>
              Please connect your wallet to deposit funds
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connect your wallet using the button in the header to continue
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-deposit">
        <DialogHeader>
          <DialogTitle>Deposit to Hyperliquid</DialogTitle>
          <DialogDescription>
            Bridge funds from any chain to your embedded Hyperliquid wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Input */}
          {step === "input" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="from-chain">From Chain</Label>
                <Select value={fromChain} onValueChange={setFromChain}>
                  <SelectTrigger id="from-chain" data-testid="select-from-chain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAINS.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id}>
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger id="token" data-testid="select-token">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedChain?.tokens.map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-amount"
                />
                {selectedToken && (
                  <p className="text-sm text-muted-foreground">
                    You will receive ~{amount || "0"} USDC on Hyperliquid
                  </p>
                )}
              </div>

              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-mono text-xs">
                    {recipientAddress ? `${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}` : "Loading..."}
                  </span>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                onClick={handleGetQuote}
                disabled={!amount || !selectedToken || isLoading || !recipientAddress}
                data-testid="button-get-quote"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  <>
                    Get Quote
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}

          {/* Step 2: Quote Review */}
          {step === "quote" && quote && (
            <>
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">From</span>
                  <span className="text-sm font-medium">
                    {amount} {selectedToken?.symbol} ({selectedChain?.name})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">To</span>
                  <span className="text-sm font-medium">
                    ~{amount} USDC (Hyperliquid)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Route</span>
                  <span className="text-sm font-medium">Router Nitro</span>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("input")}
                  disabled={isLoading}
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleExecute}
                  disabled={isLoading}
                  data-testid="button-execute"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    "Execute Bridge"
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Success */}
          {step === "success" && txHash && (
            <>
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Bridge Transaction Submitted!</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your funds are being bridged to Hyperliquid. This may take a few minutes.
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                  <p className="font-mono text-xs break-all">{txHash}</p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-close"
              >
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
