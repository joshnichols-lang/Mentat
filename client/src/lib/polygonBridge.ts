/**
 * Polygon bridging utilities for Router Nitro
 */

export interface BridgeOptions {
  destinationAddress: string;
  asset: "MATIC" | "USDC"; // Which asset to bridge to Polygon
  minimumAmount?: number; // Minimum amount to bridge
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Open Router Nitro bridge widget for Polygon
 * @param options Bridge configuration options
 * @returns Window object if popup opened successfully, null otherwise
 */
export function openPolygonBridge(options: BridgeOptions): Window | null {
  const { destinationAddress, asset, minimumAmount } = options;
  
  // URL-encode destination address for safety
  const encodedAddress = encodeURIComponent(destinationAddress);
  
  // Polygon mainnet chain ID: 137
  // Asset token addresses on Polygon:
  // MATIC = native token (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
  // USDC = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
  const assetAddress = asset === "MATIC" 
    ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" // Native MATIC
    : "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // USDC
  
  // Router Nitro widget URL with destination address, chain, and asset
  let widgetUrl = `https://app.routernitro.com/swap?destinationAddress=${encodedAddress}&destinationChainId=137&destinationAsset=${assetAddress}`;
  
  // Add suggested amount if provided
  if (minimumAmount) {
    widgetUrl += `&amount=${minimumAmount}`;
  }
  
  // Open in popup window
  const popup = window.open(
    widgetUrl,
    'RouterNitroPolygon',
    'width=500,height=700,scrollbars=yes,resizable=yes'
  );
  
  return popup;
}

/**
 * Check if user has sufficient Polygon balance for a trade
 * @param requiredUsdc Required USDC amount
 * @param currentUsdc Current USDC balance
 * @param currentMatic Current MATIC balance (for gas)
 * @returns Object indicating if balance is sufficient and what's needed
 */
export function checkPolygonBalance(
  requiredUsdc: number,
  currentUsdc: number,
  currentMatic: number
): {
  sufficient: boolean;
  needsUsdc: boolean;
  needsMatic: boolean;
  requiredUsdcAmount: number;
  minimumMaticForGas: number;
} {
  const MINIMUM_MATIC_FOR_GAS = 0.01; // Minimum MATIC needed for gas fees
  
  const needsUsdc = currentUsdc < requiredUsdc;
  const needsMatic = currentMatic < MINIMUM_MATIC_FOR_GAS;
  const sufficient = !needsUsdc && !needsMatic;
  
  return {
    sufficient,
    needsUsdc,
    needsMatic,
    requiredUsdcAmount: Math.max(0, requiredUsdc - currentUsdc),
    minimumMaticForGas: MINIMUM_MATIC_FOR_GAS,
  };
}

/**
 * Format balance check message for user
 */
export function getBalanceMessage(check: ReturnType<typeof checkPolygonBalance>): string {
  if (check.sufficient) {
    return "Sufficient balance";
  }
  
  const messages: string[] = [];
  
  if (check.needsUsdc) {
    messages.push(`Need ${check.requiredUsdcAmount.toFixed(2)} more USDC`);
  }
  
  if (check.needsMatic) {
    messages.push(`Need ${check.minimumMaticForGas} MATIC for gas`);
  }
  
  return messages.join(" and ");
}
