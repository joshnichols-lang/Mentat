import { useQuery } from "@tanstack/react-query";
import { Info, CheckCircle2 } from "lucide-react";

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
  const { data: status } = useQuery<ExpirationStatus>({
    queryKey: ["/api/wallets/hyperliquid-expiration"],
    refetchInterval: 60000, // Check every minute
  });

  if (!status?.hasApiWallet) {
    return null;
  }

  const daysRemaining = status.daysRemaining || 0;
  const hoursRemaining = status.hoursRemaining || 0;
  const totalHoursRemaining = (daysRemaining * 24) + hoursRemaining;

  // Only show banner if within 48 hours of expiry (auto-renewal happens at 24h)
  // This gives users visibility that renewal is happening
  if (totalHoursRemaining > 48 && !status.isExpired) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm border-b bg-chart-2/10 border-chart-2/20 text-chart-2"
      data-testid="expiration-info-banner"
    >
      <div className="flex items-center gap-2 flex-1">
        {totalHoursRemaining <= 24 ? (
          <>
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 animate-pulse" />
            <span className="font-medium">
              Auto-renewing Hyperliquid API wallet...
            </span>
          </>
        ) : (
          <>
            <Info className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">
              Hyperliquid API wallet will auto-renew in {totalHoursRemaining}h
            </span>
          </>
        )}
      </div>
    </div>
  );
}
