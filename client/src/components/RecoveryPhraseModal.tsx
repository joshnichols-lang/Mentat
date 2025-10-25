import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RecoveryPhraseModalProps {
  isOpen: boolean;
  seedPhrase: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function RecoveryPhraseModal({
  isOpen,
  seedPhrase,
  onConfirm,
  onClose,
}: RecoveryPhraseModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(seedPhrase);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Your recovery phrase has been copied.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the recovery phrase manually.",
        variant: "destructive",
      });
    }
  };

  const handleContinue = () => {
    // Security: Clear seed phrase from memory after user confirms
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md bg-[hsl(var(--background))] border-[hsl(var(--border))]"
        data-testid="dialog-recovery-phrase"
      >
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 hover-elevate"
            onClick={onClose}
            data-testid="button-close-recovery"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="text-xl font-bold text-[hsl(var(--foreground))]">
            Recovery Key
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Warning message */}
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            This recovery key will allow you to access your wallet if you ever lose your credentials on your 1fox account.
          </p>

          {/* Recovery phrase label */}
          <div className="space-y-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Recovery Key
            </label>

            {/* Seed phrase display with copy button */}
            <div className="relative bg-[hsl(var(--muted))] rounded-md p-4 border border-[hsl(var(--border))]">
              <p 
                className="text-sm font-mono text-[hsl(var(--foreground))] break-words pr-8"
                data-testid="text-seed-phrase"
              >
                {seedPhrase}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 hover-elevate"
                onClick={handleCopy}
                data-testid="button-copy-seed"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Continue button */}
          <Button
            className="w-full bg-primary text-primary-foreground hover-elevate active-elevate-2"
            onClick={handleContinue}
            data-testid="button-continue-recovery"
          >
            Continue
          </Button>

          {/* Security warning */}
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-xs text-destructive">
              <strong>WARNING:</strong> Your recovery key can grant anyone access to your funds. 
              NEVER SHARE IT WITH ANYONE. Save it in a secure, private location.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
