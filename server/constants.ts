// Test user ID for single-user operations during multi-tenant migration
export const TEST_USER_ID = "1fox-test-user-0000-000000000001";

// Price Reasonableness Validation Thresholds
// Maximum allowed deviation from current market price for limit orders
export const PRICE_VALIDATION = {
  // Entry orders (buy/sell limits) - more restrictive
  ENTRY_ORDER_MAX_DEVIATION: 0.30, // ±30% from current price
  
  // Protective orders (stop loss / take profit) - wider range for extreme leverage scenarios
  PROTECTIVE_ORDER_MAX_DEVIATION: 0.55, // ±55% from current price
  
  // Optional: Future per-symbol or per-regime overrides can be added here
} as const;
