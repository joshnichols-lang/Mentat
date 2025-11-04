import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: string;
  token: string;
  availableBalance: string;
}

export default function SendModal({ isOpen, onClose, chain, token, availableBalance }: SendModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [gasEstimate, setGasEstimate] = useState<any>(null);
  const [validationError, setValidationError] = useState("");
  const [estimating, setEstimating] = useState(false);
  const queryClient = useQueryClient();

  const estimateMutation = useMutation({
    mutationFn: async (data: { chain: string; token: string; amount: string; recipient: string }) => {
      const response = await apiRequest("POST", "/api/withdrawals/estimate", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setGasEstimate(data.estimate);
      setEstimating(false);
    },
    onError: (error: any) => {
      setValidationError(error.message || "Failed to estimate gas");
      setEstimating(false);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { chain: string; token: string; amount: string; recipient: string }) => {
      const response = await apiRequest("POST", "/api/withdrawals/send", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      onClose();
    },
  });

  useEffect(() => {
    if (recipient && amount && parseFloat(amount) > 0) {
      setEstimating(true);
      setValidationError("");
      const timer = setTimeout(() => {
        estimateMutation.mutate({ chain, token, amount, recipient });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setGasEstimate(null);
    }
  }, [recipient, amount]);

  const handleSend = () => {
    if (!recipient || !amount || parseFloat(amount) <= 0) {
      setValidationError("Please enter a valid recipient and amount");
      return;
    }

    if (parseFloat(amount) > parseFloat(availableBalance)) {
      setValidationError("Insufficient balance");
      return;
    }

    sendMutation.mutate({ chain, token, amount, recipient });
  };

  const handleMaxClick = () => {
    if (!gasEstimate) {
      setAmount(availableBalance);
      return;
    }

    let deduction = 0;
    
    // Determine which fees need to be deducted from the withdrawal token balance
    const isNativeToken = (
      (chain === 'solana' && token === 'SOL') ||
      (chain === 'arbitrum' && token === 'ETH') ||
      (chain === 'polygon' && token === 'MATIC') ||
      (chain === 'ethereum' && token === 'ETH') ||
      (chain === 'bnb' && token === 'BNB') ||
      (chain === 'hyperliquid' && token === 'ETH')
    );
    
    // For native token withdrawals, gas is paid from the same balance
    if (isNativeToken) {
      deduction = parseFloat(gasEstimate.estimatedFee);
    }
    
    // For Hyperliquid USDC withdrawals, deduct the $1 USDC platform fee
    // (gas is paid in ETH separately)
    if (chain === 'hyperliquid' && token === 'USDC' && gasEstimate.platformFee) {
      deduction += parseFloat(gasEstimate.platformFee);
    }
    
    const maxAmount = Math.max(0, parseFloat(availableBalance) - deduction);
    setAmount(maxAmount.toFixed(6));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-send">
        <DialogHeader>
          <DialogTitle>Send {token}</DialogTitle>
          <DialogDescription>
            Send {token} on {chain.charAt(0).toUpperCase() + chain.slice(1)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder={chain === 'solana' ? 'Enter Solana address' : 'Enter wallet address (0x...)'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              data-testid="input-recipient"
            />
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="0.000001"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-amount"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleMaxClick}
                data-testid="button-max"
              >
                Max
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Available: {parseFloat(availableBalance).toFixed(6)} {token}
            </div>
          </div>

          {estimating && (
            <Alert>
              <Loader2 className="w-4 h-4 animate-spin" />
              <AlertDescription>Estimating gas fees...</AlertDescription>
            </Alert>
          )}

          {gasEstimate && !estimating && (
            <div className="space-y-2">
              {gasEstimate.platformFeeDescription && (
                <Alert>
                  <AlertDescription>
                    <div className="font-medium text-sm">Platform Fee Notice</div>
                    <div className="text-xs mt-1">{gasEstimate.platformFeeDescription}</div>
                  </AlertDescription>
                </Alert>
              )}
              <Alert>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Fee Breakdown:</div>
                    <div className="text-sm space-y-0.5">
                      <div className="flex justify-between">
                        <span>Network Gas Fee:</span>
                        <span>{parseFloat(gasEstimate.estimatedFee).toFixed(6)} {
                          chain === 'solana' ? 'SOL' : 
                          chain === 'polygon' ? 'MATIC' : 
                          chain === 'bnb' ? 'BNB' :
                          chain === 'arbitrum' ? 'ETH' :
                          chain === 'hyperliquid' ? 'ETH' :
                          'ETH'
                        }</span>
                      </div>
                      {gasEstimate.platformFee && parseFloat(gasEstimate.platformFee) > 0 && (
                        <div className="flex justify-between">
                          <span>Platform Fee:</span>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">{parseFloat(gasEstimate.platformFee).toFixed(2)} USDC</span>
                        </div>
                      )}
                    </div>
                    {gasEstimate.estimatedFeeUSD && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Network gas ≈ ${parseFloat(gasEstimate.estimatedFeeUSD).toFixed(2)}
                        {gasEstimate.platformFee && parseFloat(gasEstimate.platformFee) > 0 && (
                          <span> + ${parseFloat(gasEstimate.platformFee).toFixed(2)} platform fee</span>
                        )}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {validationError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {sendMutation.error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{(sendMutation.error as any).message || "Failed to send transaction"}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || estimating || !gasEstimate || parseFloat(amount) <= 0}
              className="flex-1"
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Transaction"
              )}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={sendMutation.isPending} data-testid="button-cancel">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
