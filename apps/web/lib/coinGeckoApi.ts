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

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

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
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private cacheTimeout = 30000; // 30 seconds

    private async fetchWithCache(url: string, cacheKey: string): Promise<any> {
        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        // Fetch fresh data
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.statusText}`);
        }

        const data = await response.json();
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    }

    /**
     * Get current prices for multiple tokens
     */
    async getTokenPrices(tokenIds: string[]): Promise<TokenPrice[]> {
        const ids = tokenIds.join(',');
        const url = `${this.baseUrl}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d`;
        
        return this.fetchWithCache(url, `prices_${ids}`);
    }

    /**
     * Get popular tokens with live prices
     */
    async getPopularTokens(): Promise<TokenPrice[]> {
        const ids = POPULAR_TOKENS.map(t => t.id).join(',');
        return this.getTokenPrices(POPULAR_TOKENS.map(t => t.id));
    }

    /**
     * Get detailed token information
     */
    async getTokenDetails(tokenId: string): Promise<TokenDetails> {
        const url = `${this.baseUrl}/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`;
        
        const data = await this.fetchWithCache(url, `details_${tokenId}`);
        
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
        const data = await this.fetchWithCache(url, `history_${tokenId}_${days}`);
        return data.prices; // Returns [[timestamp, price], ...]
    }

    /**
     * Get trending tokens
     */
    async getTrendingTokens(): Promise<any[]> {
        const url = `${this.baseUrl}/search/trending`;
        const data = await this.fetchWithCache(url, 'trending');
        return data.coins.map((item: any) => item.item);
    }
}

export const coinGeckoApi = new CoinGeckoAPI();
