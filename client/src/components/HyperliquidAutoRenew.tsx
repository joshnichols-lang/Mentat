import { useAutoRenewHyperliquid } from "@/hooks/useAutoRenewHyperliquid";
import { useAuth } from "@/hooks/use-auth";

export function HyperliquidAutoRenew() {
  const { user } = useAuth();
  
  // Only run auto-renewal for authenticated users
  if (!user) {
    return null;
  }

  // Hook will automatically renew when within 24 hours of expiry
  useAutoRenewHyperliquid();

  return null;
}
