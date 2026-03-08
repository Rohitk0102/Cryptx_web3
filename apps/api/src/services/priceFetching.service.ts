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

import axios from 'axios';
import { Decimal } from '../utils/decimal';
import { getTokenPriceWithFallback } from './priceServiceV2';
import redis from '../utils/redis';

const HISTORICAL_CACHE_TTL = 86400 * 30; // 30 days (historical prices don't change)
const CURRENT_CACHE_TTL = 300; // 5 minutes (current prices change frequently)
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const CRYPTOCOMPARE_API_BASE = 'https://min-api.cryptocompare.com/data/v2';
const STABLECOIN_SYMBOLS = new Set([
  'USDT',
  'USDC',
  'DAI',
  'BUSD',
  'TUSD',
  'USDP',
  'FDUSD',
  'PYUSD',
  'USDE',
  'USD',
]);
const historicalWarningCache = new Set<string>();

function formatHistoricalDayKey(timestamp: Date): string {
  return timestamp.toISOString().slice(0, 10);
}

function formatCoinGeckoDate(timestamp: Date): string {
  const day = timestamp.getUTCDate().toString().padStart(2, '0');
  const month = (timestamp.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = timestamp.getUTCFullYear().toString();
  return `${day}-${month}-${year}`;
}

function getCoinGeckoId(symbol: string): string | null {
  const mapping: Record<string, string> = {
    AAVE: 'aave',
    ADA: 'cardano',
    AVAX: 'avalanche-2',
    BNB: 'binancecoin',
    BTC: 'bitcoin',
    BUSD: 'binance-usd',
    CAKE: 'pancakeswap-token',
    CRV: 'curve-dao-token',
    DAI: 'dai',
    ETH: 'ethereum',
    FDUSD: 'first-digital-usd',
    LINK: 'chainlink',
    MATIC: 'matic-network',
    POL: 'matic-network',
    PYUSD: 'paypal-usd',
    SHIB: 'shiba-inu',
    SOL: 'solana',
    TUSD: 'true-usd',
    UNI: 'uniswap',
    USDC: 'usd-coin',
    USDE: 'ethena-usde',
    USDP: 'pax-dollar',
    USDT: 'tether',
    WBTC: 'wrapped-bitcoin',
    WETH: 'weth',
    WMATIC: 'wrapped-matic',
  };

  return mapping[symbol.toUpperCase()] || null;
}

function logHistoricalWarningOnce(key: string, message: string, error?: unknown): void {
  if (historicalWarningCache.has(key)) {
    return;
  }

  historicalWarningCache.add(key);
  if (error) {
    console.warn(message, error);
    return;
  }

  console.warn(message);
}

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
    const dayKey = formatHistoricalDayKey(timestamp);
    const cacheKey = `historical:${normalizedSymbol}:${dayKey}`;

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
    timestamp: Date,
    allowCurrentPriceFallback = true
  ): Promise<Decimal | null> {
    const normalizedSymbol = tokenSymbol.toUpperCase();

    if (STABLECOIN_SYMBOLS.has(normalizedSymbol)) {
      return new Decimal(1);
    }

    const providerFetchers = [
      () => this.fetchHistoricalPriceFromCryptoCompare(normalizedSymbol, timestamp),
      () => this.fetchHistoricalPriceFromCoinGecko(normalizedSymbol, timestamp),
    ];

    for (const fetcher of providerFetchers) {
      const price = await fetcher();
      if (price && price.greaterThan(0)) {
        return price;
      }
    }

    // If the timestamp is very recent (within last hour), use current price
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (allowCurrentPriceFallback && timestamp.getTime() > hourAgo) {
      const currentPrice = await this.getCurrentPrice(tokenSymbol);
      return currentPrice;
    }

    return null;
  }

  private async fetchHistoricalPriceFromCoinGecko(
    tokenSymbol: string,
    timestamp: Date
  ): Promise<Decimal | null> {
    const coinId = getCoinGeckoId(tokenSymbol);
    if (!coinId) {
      return null;
    }

    try {
      const response = await axios.get(
        `${COINGECKO_API_BASE}/coins/${coinId}/history`,
        {
          params: {
            date: formatCoinGeckoDate(timestamp),
            localization: false,
          },
          headers: process.env.COINGECKO_API_KEY
            ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
            : undefined,
          timeout: 8000,
        }
      );

      const price = response.data?.market_data?.current_price?.usd;
      if (typeof price === 'number' && price > 0) {
        return new Decimal(price);
      }

      return null;
    } catch (error) {
      logHistoricalWarningOnce(
        `historical:coingecko:${tokenSymbol}`,
        `CoinGecko historical price fetch failed for ${tokenSymbol}`,
        error
      );
      return null;
    }
  }

  private async fetchHistoricalPriceFromCryptoCompare(
    tokenSymbol: string,
    timestamp: Date
  ): Promise<Decimal | null> {
    try {
      const toTs = Math.floor(timestamp.getTime() / 1000) + 86400;
      const response = await axios.get(
        `${CRYPTOCOMPARE_API_BASE}/histoday`,
        {
          params: {
            fsym: tokenSymbol,
            tsym: 'USD',
            limit: 2,
            toTs,
          },
          timeout: 8000,
        }
      );

      const points = response.data?.Data?.Data;
      if (!Array.isArray(points) || points.length === 0) {
        return null;
      }

      const targetTime = timestamp.getTime();
      let bestPoint: { time: number; close: number } | null = null;
      let minDiff = Number.POSITIVE_INFINITY;

      for (const point of points) {
        if (typeof point?.time !== 'number' || typeof point?.close !== 'number' || point.close <= 0) {
          continue;
        }

        const pointTimestamp = point.time * 1000;
        const diff = Math.abs(pointTimestamp - targetTime);
        if (diff < minDiff) {
          bestPoint = point;
          minDiff = diff;
        }
      }

      if (bestPoint && minDiff <= 24 * 60 * 60 * 1000) {
        return new Decimal(bestPoint.close);
      }

      return null;
    } catch (error) {
      logHistoricalWarningOnce(
        `historical:cryptocompare:${tokenSymbol}`,
        `CryptoCompare historical price fetch failed for ${tokenSymbol}`,
        error
      );
      return null;
    }
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

    // Historical endpoints used here are day-based, so search nearby days.
    const intervals = [
      0,
      -1,
      1,
    ];

    for (const dayOffset of intervals) {
      const checkTime = targetTime + dayOffset * 24 * 60 * 60 * 1000;
      
      // Skip if outside the window
      if (checkTime < startTime || checkTime > endTime) {
        continue;
      }

      const checkTimestamp = new Date(checkTime);
      const price = await this.fetchHistoricalPriceFromAPI(
        tokenSymbol,
        checkTimestamp,
        false
      );

      if (price) {
        console.log(
          `Found fallback price for ${tokenSymbol} at ${checkTimestamp.toISOString()} ` +
          `(${Math.abs(dayOffset)} days from target)`
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
