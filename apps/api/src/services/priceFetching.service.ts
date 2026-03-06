/**
 * Price Fetching Service
 * 
 * Provides historical and current price fetching with caching for P&L calculations.
 * 
 * Requirements:
 * - 3.1: Fetch historical prices using transaction timestamp
 * - 3.2: Normalize all prices to USD
 * - 3.3: Use closest available price within 24 hours if exact timestamp unavailable
 * - 3.4: Fetch prices for both tokens in swap transactions
 * - 3.5: Cache historical prices to minimize external API calls
 */

import { Decimal } from '../utils/decimal';
import { getTokenPriceWithFallback } from './priceServiceV2';
import redis from '../utils/redis';

const HISTORICAL_CACHE_TTL = 86400 * 30; // 30 days (historical prices don't change)
const CURRENT_CACHE_TTL = 300; // 5 minutes (current prices change frequently)

export interface HistoricalPriceResult {
  price: Decimal;
  timestamp: Date;
  source: 'exact' | 'fallback';
}

export class PriceFetchingService {
  private cache: Map<string, { price: Decimal; timestamp: Date }>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get historical price for a token at a specific timestamp
   * Implements caching and 24-hour fallback window
   * 
   * @param tokenSymbol - Token symbol (e.g., "ETH", "USDC")
   * @param timestamp - The timestamp to fetch price for
   * @returns Historical price in USD as Decimal, or null if unavailable
   */
  async getHistoricalPrice(
    tokenSymbol: string,
    timestamp: Date
  ): Promise<Decimal | null> {
    const normalizedSymbol = tokenSymbol.toUpperCase();
    const cacheKey = `historical:${normalizedSymbol}:${timestamp.toISOString()}`;

    // Check in-memory cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.price;
    }

    // Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      const price = new Decimal(cached);
      this.cache.set(cacheKey, { price, timestamp });
      return price;
    }

    // Try to fetch exact historical price
    // Note: The existing price service doesn't have historical price support yet
    // For now, we'll use the current price as a placeholder
    // In production, this would integrate with CoinGecko's historical API or similar
    const exactPrice = await this.fetchHistoricalPriceFromAPI(
      normalizedSymbol,
      timestamp
    );

    if (exactPrice) {
      // Cache the result
      await this.cacheHistoricalPrice(cacheKey, exactPrice, timestamp);
      return exactPrice;
    }

    // Fallback: Try to find closest price within 24-hour window
    const fallbackPrice = await this.findClosestPrice(
      normalizedSymbol,
      timestamp,
      24 * 60 * 60 * 1000 // 24 hours in milliseconds
    );

    if (fallbackPrice) {
      // Cache the fallback result
      await this.cacheHistoricalPrice(cacheKey, fallbackPrice, timestamp);
      return fallbackPrice;
    }

    // No price found
    console.error(
      `No historical price found for ${normalizedSymbol} at ${timestamp.toISOString()}`
    );
    return null;
  }

  /**
   * Get current price for a token
   * Uses the existing price service with caching
   * 
   * @param tokenSymbol - Token symbol (e.g., "ETH", "USDC")
   * @returns Current price in USD as Decimal, or null if unavailable
   */
  async getCurrentPrice(tokenSymbol: string): Promise<Decimal | null> {
    try {
      const normalizedSymbol = tokenSymbol.toUpperCase();
      const price = await getTokenPriceWithFallback(normalizedSymbol);
      
      if (!price || !price.priceUsd) {
        return null;
      }

      return new Decimal(price.priceUsd);
    } catch (error) {
      console.error(`Failed to fetch current price for ${tokenSymbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch historical price from external API
   * This is a placeholder for actual historical price API integration
   * 
   * @param tokenSymbol - Token symbol
   * @param timestamp - Timestamp to fetch price for
   * @returns Price as Decimal, or null if unavailable
   */
  private async fetchHistoricalPriceFromAPI(
    tokenSymbol: string,
    timestamp: Date
  ): Promise<Decimal | null> {
    // TODO: Integrate with CoinGecko historical price API or similar
    // For now, we'll use current price as a fallback
    // This is a temporary implementation until historical API is integrated
    
    // If the timestamp is very recent (within last hour), use current price
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (timestamp.getTime() > hourAgo) {
      const currentPrice = await this.getCurrentPrice(tokenSymbol);
      return currentPrice;
    }

    // For older timestamps, we need actual historical data
    // Return null to trigger fallback logic
    return null;
  }

  /**
   * Find the closest available price within a time window
   * Implements the 24-hour fallback requirement
   * 
   * @param tokenSymbol - Token symbol
   * @param targetTimestamp - Target timestamp
   * @param windowMs - Time window in milliseconds (default: 24 hours)
   * @returns Closest price as Decimal, or null if none found
   */
  private async findClosestPrice(
    tokenSymbol: string,
    targetTimestamp: Date,
    windowMs: number
  ): Promise<Decimal | null> {
    const targetTime = targetTimestamp.getTime();
    const startTime = targetTime - windowMs;
    const endTime = targetTime + windowMs;

    // Try timestamps at 1-hour intervals within the window
    const intervals = [
      0, // exact time
      1, -1, // ±1 hour
      2, -2, // ±2 hours
      4, -4, // ±4 hours
      8, -8, // ±8 hours
      12, -12, // ±12 hours
      24, -24, // ±24 hours
    ];

    for (const hourOffset of intervals) {
      const checkTime = targetTime + hourOffset * 60 * 60 * 1000;
      
      // Skip if outside the window
      if (checkTime < startTime || checkTime > endTime) {
        continue;
      }

      const checkTimestamp = new Date(checkTime);
      const price = await this.fetchHistoricalPriceFromAPI(
        tokenSymbol,
        checkTimestamp
      );

      if (price) {
        console.log(
          `Found fallback price for ${tokenSymbol} at ${checkTimestamp.toISOString()} ` +
          `(${Math.abs(hourOffset)} hours from target)`
        );
        return price;
      }
    }

    return null;
  }

  /**
   * Cache a historical price in both Redis and in-memory cache
   * 
   * @param cacheKey - Cache key
   * @param price - Price to cache
   * @param timestamp - Timestamp of the price
   */
  private async cacheHistoricalPrice(
    cacheKey: string,
    price: Decimal,
    timestamp: Date
  ): Promise<void> {
    // Store in in-memory cache
    this.cache.set(cacheKey, { price, timestamp });

    // Store in Redis with long TTL (historical prices don't change)
    await redis.setex(cacheKey, HISTORICAL_CACHE_TTL, price.toString());
  }

  /**
   * Get prices for multiple tokens at a specific timestamp
   * Useful for swap transactions that involve two tokens
   * 
   * @param tokenSymbols - Array of token symbols
   * @param timestamp - Timestamp to fetch prices for
   * @returns Map of token symbol to price
   */
  async getMultipleHistoricalPrices(
    tokenSymbols: string[],
    timestamp: Date
  ): Promise<Map<string, Decimal>> {
    const prices = new Map<string, Decimal>();

    // Fetch prices in parallel
    await Promise.all(
      tokenSymbols.map(async (symbol) => {
        const price = await this.getHistoricalPrice(symbol, timestamp);
        if (price) {
          prices.set(symbol.toUpperCase(), price);
        }
      })
    );

    return prices;
  }

  /**
   * Clear the in-memory cache
   * Useful for testing or memory management
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * Useful for monitoring and debugging
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export a singleton instance
export const priceFetchingService = new PriceFetchingService();
