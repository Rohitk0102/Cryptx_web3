import axios from 'axios';
import prisma from '../utils/prisma';
import redis from '../utils/redis';

const CACHE_TTL = 300; // 5 minutes

export interface TokenPrice {
    symbol: string;
    priceUsd: number;
    priceChange24h?: number;
    lastUpdated: Date;
    source: string;
}

export interface PriceProvider {
    name: string;
    fetchPrice: (symbol: string) => Promise<number | null>;
    fetchBulkPrices?: (symbols: string[]) => Promise<Record<string, number>>;
    priority: number;
}

/**
 * CoinGecko Provider
 */
const coingeckoProvider: PriceProvider = {
    name: 'CoinGecko',
    priority: 1,
    
    async fetchPrice(symbol: string): Promise<number | null> {
        try {
            const coinId = getCoinGeckoId(symbol);
            if (!coinId) return null;

            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: coinId,
                    vs_currencies: 'usd',
                    include_24hr_change: true,
                },
                timeout: 5000,
            });

            const data = response.data[coinId];
            return data?.usd || null;
        } catch (error) {
            console.warn(`CoinGecko failed for ${symbol}:`, error);
            return null;
        }
    },

    async fetchBulkPrices(symbols: string[]): Promise<Record<string, number>> {
        try {
            const coinIds = symbols
                .map(s => getCoinGeckoId(s))
                .filter(Boolean);

            if (coinIds.length === 0) return {};

            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: coinIds.join(','),
                    vs_currencies: 'usd',
                },
                timeout: 8000,
            });

            const prices: Record<string, number> = {};
            symbols.forEach(symbol => {
                const coinId = getCoinGeckoId(symbol);
                if (coinId && response.data[coinId]?.usd) {
                    prices[symbol.toUpperCase()] = response.data[coinId].usd;
                }
            });

            return prices;
        } catch (error) {
            console.warn('CoinGecko bulk fetch failed:', error);
            return {};
        }
    },
};

/**
 * CoinMarketCap Provider
 */
const coinmarketcapProvider: PriceProvider = {
    name: 'CoinMarketCap',
    priority: 2,
    
    async fetchPrice(symbol: string): Promise<number | null> {
        const apiKey = process.env.COINMARKETCAP_API_KEY;
        if (!apiKey) {
            console.warn('CoinMarketCap API key not configured');
            return null;
        }

        try {
            const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
                params: {
                    symbol: symbol.toUpperCase(),
                    convert: 'USD',
                },
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                },
                timeout: 5000,
            });

            const data = response.data.data[symbol.toUpperCase()];
            return data?.quote?.USD?.price || null;
        } catch (error) {
            console.warn(`CoinMarketCap failed for ${symbol}:`, error);
            return null;
        }
    },
};

/**
 * CryptoCompare Provider
 */
const cryptocompareProvider: PriceProvider = {
    name: 'CryptoCompare',
    priority: 3,
    
    async fetchPrice(symbol: string): Promise<number | null> {
        try {
            const response = await axios.get('https://min-api.cryptocompare.com/data/price', {
                params: {
                    fsym: symbol.toUpperCase(),
                    tsyms: 'USD',
                },
                timeout: 5000,
            });

            return response.data.USD || null;
        } catch (error) {
            console.warn(`CryptoCompare failed for ${symbol}:`, error);
            return null;
        }
    },
};

/**
 * Binance Provider (for major tokens)
 */
const binanceProvider: PriceProvider = {
    name: 'Binance',
    priority: 4,
    
    async fetchPrice(symbol: string): Promise<number | null> {
        try {
            // Map symbols to Binance trading pairs
            const tradingPair = getBinanceTradingPair(symbol);
            if (!tradingPair) return null;

            const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
                params: {
                    symbol: tradingPair,
                },
                timeout: 3000,
            });

            return parseFloat(response.data.price);
        } catch (error) {
            console.warn(`Binance failed for ${symbol}:`, error);
            return null;
        }
    },
};

// All providers ordered by priority
const priceProviders: PriceProvider[] = [
    coingeckoProvider,
    coinmarketcapProvider,
    cryptocompareProvider,
    binanceProvider,
].sort((a, b) => a.priority - b.priority);

/**
 * Token symbol to CoinGecko ID mapping
 */
function getCoinGeckoId(symbol: string): string | null {
    const mapping: Record<string, string> = {
        ETH: 'ethereum',
        MATIC: 'matic-network',
        BNB: 'binancecoin',
        USDT: 'tether',
        USDC: 'usd-coin',
        DAI: 'dai',
        WBTC: 'wrapped-bitcoin',
        BTC: 'bitcoin',
        LINK: 'chainlink',
        UNI: 'uniswap',
        AAVE: 'aave',
        CRV: 'curve-dao-token',
        CAKE: 'pancakeswap-token',
        BUSD: 'binance-usd',
        WETH: 'weth',
        WMATIC: 'wrapped-matic',
    };

    return mapping[symbol.toUpperCase()] || null;
}

/**
 * Get Binance trading pair for symbol
 */
function getBinanceTradingPair(symbol: string): string | null {
    const mapping: Record<string, string> = {
        BTC: 'BTCUSDT',
        ETH: 'ETHUSDT',
        BNB: 'BNBUSDT',
        MATIC: 'MATICUSDT',
        USDT: 'USDTUSDT', // USDT paired with itself (stablecoin)
        USDC: 'USDCUSDT', // USDC paired with USDT
        BUSD: 'BUSDUSDT', // BUSD paired with USDT
        LINK: 'LINKUSDT',
        UNI: 'UNIUSDT',
        AAVE: 'AAVEUSDT',
        CAKE: 'CAKEUSDT',
    };

    return mapping[symbol.toUpperCase()] || null;
}

/**
 * Get token price with fallback providers
 */
export async function getTokenPriceWithFallback(symbol: string): Promise<TokenPrice | null> {
    const normalizedSymbol = symbol.toUpperCase();
    const cacheKey = `price:${normalizedSymbol}`;

    // Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    // Check database cache
    const dbCache = await prisma.priceCache.findUnique({
        where: { symbol: normalizedSymbol },
    });

    // Use DB cache if less than 5 minutes old
    if (dbCache && Date.now() - dbCache.updatedAt.getTime() < CACHE_TTL * 1000) {
        const price: TokenPrice = {
            symbol: normalizedSymbol,
            priceUsd: dbCache.priceUsd,
            lastUpdated: dbCache.updatedAt,
            source: 'cache',
        };
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(price));
        return price;
    }

    // Try each provider in order of priority
    let lastError: any;
    for (const provider of priceProviders) {
        try {
            const priceUsd = await provider.fetchPrice(normalizedSymbol);
            if (priceUsd && priceUsd > 0) {
                const price: TokenPrice = {
                    symbol: normalizedSymbol,
                    priceUsd,
                    lastUpdated: new Date(),
                    source: provider.name,
                };

                // Update database
                await prisma.priceCache.upsert({
                    where: { symbol: normalizedSymbol },
                    create: {
                        symbol: normalizedSymbol,
                        priceUsd,
                    },
                    update: {
                        priceUsd,
                        updatedAt: new Date(),
                    },
                });

                // Cache in Redis
                await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(price));

                console.log(`✅ Got price for ${normalizedSymbol} from ${provider.name}: $${priceUsd}`);
                return price;
            }
        } catch (error) {
            lastError = error;
            console.warn(`❌ ${provider.name} failed for ${normalizedSymbol}:`, error);
            continue;
        }
    }

    // All providers failed
    console.error(`❌ All price providers failed for ${normalizedSymbol}`);
    return null;
}

/**
 * Get multiple token prices in bulk with fallback
 */
export async function getBulkPricesWithFallback(
    symbols: string[]
): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const uncachedSymbols: string[] = [];

    // First, check cache for all symbols
    for (const symbol of symbols) {
        const normalizedSymbol = symbol.toUpperCase();
        const cacheKey = `price:${normalizedSymbol}`;
        
        const cached = await redis.get(cacheKey);
        if (cached) {
            const price = JSON.parse(cached) as TokenPrice;
            prices[normalizedSymbol] = price.priceUsd;
        } else {
            uncachedSymbols.push(normalizedSymbol);
        }
    }

    if (uncachedSymbols.length === 0) {
        return prices;
    }

    // Try bulk fetch from CoinGecko first
    try {
        const bulkPrices = await coingeckoProvider.fetchBulkPrices?.(uncachedSymbols);
        if (bulkPrices) {
            for (const [symbol, price] of Object.entries(bulkPrices)) {
                prices[symbol] = price;
                
                // Cache individual prices
                const priceData: TokenPrice = {
                    symbol,
                    priceUsd: price,
                    lastUpdated: new Date(),
                    source: 'CoinGecko',
                };
                
                await redis.setex(`price:${symbol}`, CACHE_TTL, JSON.stringify(priceData));
                
                // Update database
                await prisma.priceCache.upsert({
                    where: { symbol },
                    create: { symbol, priceUsd: price },
                    update: { priceUsd: price, updatedAt: new Date() },
                });
            }
        }
    } catch (error) {
        console.warn('Bulk price fetch failed, falling back to individual requests');
    }

    // For remaining symbols, fetch individually
    const remainingSymbols = uncachedSymbols.filter(s => !prices[s]);
    if (remainingSymbols.length > 0) {
        await Promise.all(
            remainingSymbols.map(async (symbol) => {
                const price = await getTokenPriceWithFallback(symbol);
                if (price) {
                    prices[symbol] = price.priceUsd;
                }
            })
        );
    }

    return prices;
}

/**
 * Calculate USD value
 */
export function calculateUsdValue(balance: string, priceUsd: number): number {
    return parseFloat(balance) * priceUsd;
}

/**
 * Get provider health status
 */
export async function getProviderHealthStatus(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    await Promise.all(
        priceProviders.map(async (provider) => {
            try {
                // Test with BTC price
                const price = await provider.fetchPrice('BTC');
                health[provider.name] = price !== null && price > 0;
            } catch {
                health[provider.name] = false;
            }
        })
    );

    return health;
}
