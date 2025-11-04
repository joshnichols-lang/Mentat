import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ExpirationStatus {
  success: boolean;
  hasApiWallet: boolean;
  expirationDate: string | null;
  approvalTimestamp: string | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpiring: boolean;
  isExpired: boolean;
  message?: string;
}

export function HyperliquidExpirationWarning() {
  const { toast } = useToast();

  const { data: status } = useQuery<ExpirationStatus>({
    queryKey: ["/api/wallets/hyperliquid-expiration"],
    refetchInterval: 60000, // Check every minute
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/wallets/renew-hyperliquid", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "API Wallet Renewed",
        description: `Your Hyperliquid API wallet has been renewed for 180 days. Expires ${new Date(data.expirationDate).toLocaleDateString()}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/hyperliquid-expiration"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Renewal Failed",
        description: error.message || "Failed to renew API wallet",
        variant: "destructive",
      });
    },
  });

  if (!status?.hasApiWallet || (!status.isExpiring && !status.isExpired)) {
    return null;
  }

  const daysRemaining = status.daysRemaining || 0;
  const hoursRemaining = status.hoursRemaining || 0;
  const isUrgent = daysRemaining < 7;
  const isExpired = status.isExpired;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm border-b ${
        isExpired
          ? "bg-destructive/10 border-destructive/20 text-destructive"
          : isUrgent
          ? "bg-destructive/10 border-destructive/20 text-destructive"
          : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
      }`}
      data-testid="expiration-warning-banner"
    >
      <div className="flex items-center gap-2 flex-1">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">
          {isExpired
            ? "Hyperliquid API Wallet Expired"
            : `Hyperliquid API Wallet Expires in ${daysRemaining}d ${hoursRemaining}h`}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => renewMutation.mutate()}
        disabled={renewMutation.isPending}
        className="flex items-center gap-2 border-current hover:bg-current/10"
        data-testid="button-renew-api-wallet"
      >
        {renewMutation.isPending ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" />
            Renewing...
          </>
        ) : (
          <>
            <Clock className="h-3 w-3" />
            Renew Now (180 Days)
          </>
        )}
      </Button>
    </div>
  );
}
