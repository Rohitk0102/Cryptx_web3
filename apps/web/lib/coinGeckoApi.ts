/**
 * CoinGecko API Client for Real-Time Token Data
 * Free tier: 10-50 calls/minute
 */

export interface TokenPrice {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    market_cap: number;
    market_cap_rank?: number;
    total_volume: number;
    image: string;
    sparkline_in_7d?: {
        price: number[];
    };
}

export interface TokenDetails extends TokenPrice {
    market_cap_rank: number;
    high_24h: number;
    low_24h: number;
    circulating_supply: number;
    total_supply: number;
    ath: number;
    ath_change_percentage: number;
    ath_date: string;
}

interface CoinGeckoMarketToken {
    id: string;
    symbol: string;
    name: string;
    current_price?: number | null;
    price_change_percentage_24h?: number | null;
    price_change_percentage_24h_in_currency?: number | null;
    price_change_percentage_7d?: number | null;
    price_change_percentage_7d_in_currency?: number | null;
    market_cap?: number | null;
    market_cap_rank?: number | null;
    total_volume?: number | null;
    image?: string | null;
    sparkline_in_7d?: {
        price?: number[] | null;
    } | null;
}

interface CoinGeckoTokenDetailsResponse {
    id: string;
    symbol: string;
    name: string;
    image: {
        large: string;
    };
    market_cap_rank: number;
    market_data: {
        current_price: { usd: number };
        price_change_percentage_24h: number;
        price_change_percentage_7d: number;
        market_cap: { usd: number };
        total_volume: { usd: number };
        high_24h: { usd: number };
        low_24h: { usd: number };
        circulating_supply: number;
        total_supply: number;
        ath: { usd: number };
        ath_change_percentage: { usd: number };
        ath_date: { usd: string };
    };
}

interface CoinGeckoHistoryResponse {
    prices: Array<[number, number]>;
}

interface CoinGeckoTrendingResponse {
    coins: Array<{ item: unknown }>;
}

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface FetchOptions {
    allowStaleOnError?: boolean;
    cacheTtlMs?: number;
    maxRetries?: number;
}

class CoinGeckoApiError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'CoinGeckoApiError';
        this.status = status;
    }
}

// Popular tokens to track
export const POPULAR_TOKENS = [
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
    { id: 'solana', symbol: 'SOL', name: 'Solana' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
    { id: 'polygon', symbol: 'MATIC', name: 'Polygon' },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
    { id: 'tron', symbol: 'TRX', name: 'Tron' },
];

class CoinGeckoAPI {
    private baseUrl = COINGECKO_API_BASE;
    private cache = new Map<string, CacheEntry<unknown>>();
    private inFlightRequests = new Map<string, Promise<unknown>>();
    private cacheTimeout = 30000; // 30 seconds
    private historyCacheTimeout = 60000; // 60 seconds
    private minRequestInterval = 1250; // Keep browser requests under the free-tier minute cap
    private lastRequestTime = 0;
    private requestQueue: Promise<void> = Promise.resolve();

    private getStorageKey(cacheKey: string): string {
        return `coingecko:${cacheKey}`;
    }

    private getCacheEntry<T>(cacheKey: string): CacheEntry<T> | null {
        const memoryEntry = this.cache.get(cacheKey);
        if (memoryEntry) {
            return memoryEntry as CacheEntry<T>;
        }

        if (typeof window === 'undefined') {
            return null;
        }

        try {
            const stored = window.localStorage.getItem(this.getStorageKey(cacheKey));
            if (!stored) {
                return null;
            }

            const parsed = JSON.parse(stored) as CacheEntry<T>;
            if (typeof parsed?.timestamp !== 'number') {
                return null;
            }

            this.cache.set(cacheKey, parsed as CacheEntry<unknown>);
            return parsed;
        } catch (error) {
            console.warn(`Failed to restore CoinGecko cache for ${cacheKey}:`, error);
            return null;
        }
    }

    private setCacheEntry<T>(cacheKey: string, data: T): void {
        const entry: CacheEntry<T> = { data, timestamp: Date.now() };
        this.cache.set(cacheKey, entry as CacheEntry<unknown>);

        if (typeof window === 'undefined') {
            return;
        }

        try {
            window.localStorage.setItem(this.getStorageKey(cacheKey), JSON.stringify(entry));
        } catch (error) {
            console.warn(`Failed to persist CoinGecko cache for ${cacheKey}:`, error);
        }
    }

    private isFresh(entry: CacheEntry<unknown>, cacheTtlMs: number): boolean {
        return Date.now() - entry.timestamp < cacheTtlMs;
    }

    private async scheduleRequest<T>(operation: () => Promise<T>): Promise<T> {
        const run = this.requestQueue.then(async () => {
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            const waitTime = Math.max(0, this.minRequestInterval - timeSinceLastRequest);

            if (waitTime > 0) {
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }

            this.lastRequestTime = Date.now();
            return operation();
        });

        this.requestQueue = run.then(
            () => undefined,
            () => undefined
        );

        return run;
    }

    private isRetryableError(error: unknown): boolean {
        if (error instanceof CoinGeckoApiError) {
            return error.status === 429 || (error.status !== undefined && error.status >= 500);
        }

        return error instanceof TypeError;
    }

    private async createApiError(response: Response): Promise<CoinGeckoApiError> {
        let details = '';

        try {
            details = await response.text();
        } catch {
            details = '';
        }

        if (response.status === 429) {
            return new CoinGeckoApiError('CoinGecko rate limit exceeded. Retrying shortly.', response.status);
        }

        if (response.status >= 500) {
            return new CoinGeckoApiError('CoinGecko service is temporarily unavailable.', response.status);
        }

        const suffix = details ? ` ${details}` : '';
        return new CoinGeckoApiError(
            `CoinGecko API error (${response.status} ${response.statusText}).${suffix}`.trim(),
            response.status
        );
    }

    private async fetchWithCache<T>(
        url: string,
        cacheKey: string,
        options: FetchOptions = {}
    ): Promise<T> {
        const cacheTtlMs = options.cacheTtlMs ?? this.cacheTimeout;
        const maxRetries = options.maxRetries ?? 3;
        const allowStaleOnError = options.allowStaleOnError ?? true;
        const cached = this.getCacheEntry<T>(cacheKey);

        if (cached && this.isFresh(cached as CacheEntry<unknown>, cacheTtlMs)) {
            return cached.data;
        }

        const inFlight = this.inFlightRequests.get(cacheKey);
        if (inFlight) {
            return inFlight as Promise<T>;
        }

        const request = this.fetchWithRetry<T>(url, cacheKey, maxRetries, allowStaleOnError);
        this.inFlightRequests.set(cacheKey, request);

        try {
            return await request;
        } finally {
            this.inFlightRequests.delete(cacheKey);
        }
    }

    private async fetchWithRetry<T>(
        url: string,
        cacheKey: string,
        maxRetries: number,
        allowStaleOnError: boolean
    ): Promise<T> {
        let attempt = 0;
        let delay = 1000;

        while (attempt <= maxRetries) {
            try {
                const data = await this.scheduleRequest(async () => {
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok) {
                        throw await this.createApiError(response);
                    }

                    return response.json() as Promise<T>;
                });

                this.setCacheEntry(cacheKey, data);
                return data;
            } catch (error) {
                const staleEntry = allowStaleOnError ? this.getCacheEntry<T>(cacheKey) : null;
                const canUseStale = staleEntry && this.isRetryableError(error);

                if (attempt === maxRetries || !this.isRetryableError(error)) {
                    if (canUseStale) {
                        console.warn(`Using stale CoinGecko cache for ${cacheKey} after fetch failure:`, error);
                        return staleEntry.data;
                    }

                    throw error;
                }

                const retryDelay = delay + Math.floor(Math.random() * 250);
                console.warn(
                    `CoinGecko request failed for ${cacheKey}; retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries}).`,
                    error
                );
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                delay = Math.min(delay * 2, 8000);
                attempt += 1;
            }
        }

        throw new CoinGeckoApiError('CoinGecko request exhausted retries.');
    }

    private normalizeTokenPrice(token: CoinGeckoMarketToken): TokenPrice {
        return {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            current_price: token.current_price ?? 0,
            price_change_percentage_24h:
                token.price_change_percentage_24h_in_currency ??
                token.price_change_percentage_24h ??
                0,
            price_change_percentage_7d:
                token.price_change_percentage_7d_in_currency ??
                token.price_change_percentage_7d ??
                0,
            market_cap: token.market_cap ?? 0,
            market_cap_rank: token.market_cap_rank ?? undefined,
            total_volume: token.total_volume ?? 0,
            image: token.image ?? '',
            sparkline_in_7d: token.sparkline_in_7d?.price?.length
                ? { price: token.sparkline_in_7d.price }
                : undefined,
        };
    }

    /**
     * Get current prices for multiple tokens
     */
    async getTokenPrices(tokenIds: string[]): Promise<TokenPrice[]> {
        const ids = tokenIds.join(',');
        const url = `${this.baseUrl}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d`;

        const data = await this.fetchWithCache<CoinGeckoMarketToken[]>(
            url,
            `prices_${ids}`,
            { cacheTtlMs: this.cacheTimeout }
        );

        return data.map((token) => this.normalizeTokenPrice(token));
    }

    /**
     * Get popular tokens with live prices
     */
    async getPopularTokens(limit = 50): Promise<TokenPrice[]> {
        const perPage = Math.max(1, Math.min(limit, 100));
        const url = `${this.baseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=true&price_change_percentage=24h,7d`;
        const data = await this.fetchWithCache<CoinGeckoMarketToken[]>(
            url,
            `top_markets_${perPage}`,
            { cacheTtlMs: this.cacheTimeout }
        );

        return data.map((token) => this.normalizeTokenPrice(token));
    }

    /**
     * Get detailed token information
     */
    async getTokenDetails(tokenId: string): Promise<TokenDetails> {
        const url = `${this.baseUrl}/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`;
        
        const data = await this.fetchWithCache<CoinGeckoTokenDetailsResponse>(url, `details_${tokenId}`, {
            cacheTtlMs: this.cacheTimeout,
        });
        
        return {
            id: data.id,
            symbol: data.symbol.toUpperCase(),
            name: data.name,
            current_price: data.market_data.current_price.usd,
            price_change_percentage_24h: data.market_data.price_change_percentage_24h,
            price_change_percentage_7d: data.market_data.price_change_percentage_7d,
            market_cap: data.market_data.market_cap.usd,
            total_volume: data.market_data.total_volume.usd,
            image: data.image.large,
            market_cap_rank: data.market_cap_rank,
            high_24h: data.market_data.high_24h.usd,
            low_24h: data.market_data.low_24h.usd,
            circulating_supply: data.market_data.circulating_supply,
            total_supply: data.market_data.total_supply,
            ath: data.market_data.ath.usd,
            ath_change_percentage: data.market_data.ath_change_percentage.usd,
            ath_date: data.market_data.ath_date.usd,
        };
    }

    /**
     * Get token price history for chart
     */
    async getTokenPriceHistory(tokenId: string, days: string): Promise<Array<[number, number]>> {
        const url = `${this.baseUrl}/coins/${tokenId}/market_chart?vs_currency=usd&days=${days}`;
        const data = await this.fetchWithCache<CoinGeckoHistoryResponse>(url, `history_${tokenId}_${days}`, {
            cacheTtlMs: this.historyCacheTimeout,
        });
        return data.prices; // Returns [[timestamp, price], ...]
    }

    /**
     * Get trending tokens
     */
    async getTrendingTokens(): Promise<unknown[]> {
        const url = `${this.baseUrl}/search/trending`;
        const data = await this.fetchWithCache<CoinGeckoTrendingResponse>(url, 'trending', {
            cacheTtlMs: this.cacheTimeout,
        });
        return data.coins.map((item) => item.item);
    }
}

export const coinGeckoApi = new CoinGeckoAPI();
