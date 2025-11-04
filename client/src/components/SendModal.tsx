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
    if (gasEstimate && gasEstimate.estimatedFee) {
      const maxAmount = Math.max(0, parseFloat(availableBalance) - parseFloat(gasEstimate.estimatedFee));
      setAmount(maxAmount.toFixed(6));
    } else {
      setAmount(availableBalance);
    }
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
            <Alert>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <AlertDescription>
                <div className="space-y-1">
                  <div>Estimated Fee: {parseFloat(gasEstimate.estimatedFee).toFixed(6)} {chain === 'solana' ? 'SOL' : 'ETH'}</div>
                  {gasEstimate.estimatedFeeUSD && (
                    <div className="text-xs">≈ ${parseFloat(gasEstimate.estimatedFeeUSD).toFixed(2)}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
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
