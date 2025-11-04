import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ExpirationStatus {
  success: boolean;
  hasApiWallet: boolean;
  expirationDate: string | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpiring: boolean;
  isExpired: boolean;
}

export function useAutoRenewHyperliquid() {
  const renewalAttempted = useRef(false);
  const lastRenewAttempt = useRef<number | null>(null);

  const { data: status } = useQuery<ExpirationStatus>({
    queryKey: ["/api/wallets/hyperliquid-expiration"],
    refetchInterval: 60000, // Check every minute
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/wallets/renew-hyperliquid");
    },
    onSuccess: () => {
      console.log('[Auto-Renew] Successfully renewed Hyperliquid API wallet');
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/hyperliquid-expiration"] });
      // Don't reset renewalAttempted here - wait for fresh status from server
    },
    onError: (error: Error) => {
      console.error('[Auto-Renew] Failed to renew API wallet:', error);
      // Allow retry after 5 minutes on error
      setTimeout(() => {
        renewalAttempted.current = false;
        lastRenewAttempt.current = null;
      }, 5 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!status?.hasApiWallet) {
      return;
    }

    // Calculate time remaining
    const daysRemaining = status.daysRemaining || 0;
    const hoursRemaining = status.hoursRemaining || 0;
    const totalHoursRemaining = (daysRemaining * 24) + hoursRemaining;

    // Reset flags if we're well within the valid period (> 48 hours remaining)
    // This allows the next renewal cycle to work when approaching expiration again
    if (totalHoursRemaining > 48) {
      if (renewalAttempted.current || lastRenewAttempt.current) {
        console.log('[Auto-Renew] Status refreshed, clearing renewal flags');
        renewalAttempted.current = false;
        lastRenewAttempt.current = null;
      }
      return;
    }

    // Don't attempt renewal if already attempted or mutation is pending
    if (renewalAttempted.current || renewMutation.isPending) {
      return;
    }

    // Only attempt renewal if we haven't attempted in last 10 minutes
    const now = Date.now();
    const tenMinutesAgo = now - (10 * 60 * 1000);
    
    if (lastRenewAttempt.current && lastRenewAttempt.current > tenMinutesAgo) {
      // Already attempted recently, wait for next refetch cycle
      return;
    }

    // Auto-renew if expired or within 24 hours of expiration
    if (status.isExpired || totalHoursRemaining <= 24) {
      console.log(`[Auto-Renew] API wallet ${status.isExpired ? 'expired' : `expiring in ${totalHoursRemaining}h`}, auto-renewing...`);
      renewalAttempted.current = true;
      lastRenewAttempt.current = now;
      renewMutation.mutate();
    }
  }, [status, renewMutation]);

  return {
    status,
    isAutoRenewing: renewMutation.isPending,
  };
}
