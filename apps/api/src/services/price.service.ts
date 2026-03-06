import { getTokenPriceWithFallback, getBulkPricesWithFallback, calculateUsdValue } from './priceServiceV2';

// Re-export the enhanced functions
export { getTokenPriceWithFallback as getTokenPrice, getBulkPricesWithFallback, calculateUsdValue };

// Keep the old interface for backward compatibility
export type { TokenPrice } from './priceServiceV2';
