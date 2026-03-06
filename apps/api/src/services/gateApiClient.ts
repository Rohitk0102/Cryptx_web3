/**
 * Configuration for Market Data API client
 */
export interface MarketDataClientConfig {
  baseUrl?: string;
}

/**
 * Candlestick/OHLCV data structure
 */
export interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Market statistics data structure
 */
export interface MarketStats {
  symbol: string;
  lastPrice: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

/**
 * Market Data API Client (CoinGecko)
 * 
 * Handles all communication with the CoinGecko API for fetching cryptocurrency market data.
 * Provides methods for fetching market data including candlestick data and market statistics.
 * 
 * Note: Using CoinGecko API instead of Gate.io as Gate.io is blocked in India.
 * 
 * Requirements: 1.1, 1.2
 */
export class MarketDataClient {
  private baseUrl: string;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // Minimum 1 second between requests

  /**
   * Initialize Market Data API client with configuration
   * 
   * @param config - API configuration
   */
  constructor(config: MarketDataClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://api.coingecko.com/api/v3';
  }

  /**
   * Throttle requests to avoid rate limiting
   * Ensures minimum time between API requests
   */
  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏱️  Throttling request, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Convert symbol from Gate.io format (BTC_USDT) to CoinGecko format (bitcoin)
   * 
   * @param symbol - Trading pair symbol (e.g., 'BTC_USDT', 'ETH_USDT')
   * @returns CoinGecko coin ID (e.g., 'bitcoin', 'ethereum')
   */
  private symbolToCoinId(symbol: string): string {
    // Map common symbols to CoinGecko IDs
    const symbolMap: Record<string, string> = {
      'BTC_USDT': 'bitcoin',
      'ETH_USDT': 'ethereum',
      'BNB_USDT': 'binancecoin',
      'SOL_USDT': 'solana',
      'ADA_USDT': 'cardano',
      'XRP_USDT': 'ripple',
      'DOT_USDT': 'polkadot',
      'MATIC_USDT': 'polygon',
      'LINK_USDT': 'chainlink',
      'UNI_USDT': 'uniswap',
      'AVAX_USDT': 'avalanche-2',
      'TRX_USDT': 'tron',
    };

    const coinId = symbolMap[symbol];
    if (!coinId) {
      throw new Error(`Symbol ${symbol} not supported. Please use a supported trading pair.`);
    }

    return coinId;
  }

  /**
   * Fetch historical candlestick data from Binance
   * 
   * @param symbol - Trading pair symbol (e.g., 'BTC_USDT')
   * @param _interval - Candlestick interval (not used, kept for API compatibility)
   * @param from - Start timestamp (Unix timestamp in seconds)
   * @param to - End timestamp (Unix timestamp in seconds)
   * @returns Array of candlestick data
   * 
   * Requirements: 1.3, 2.1, 2.2
   */
  async getCandlesticks(
    symbol: string,
    _interval: string,
    from: number,
    to: number
  ): Promise<CandlestickData[]> {
    // Throttle request to avoid rate limiting
    await this.throttleRequest();
    
    // Wrap the operation in retry logic
    return this.retryWithBackoff(async () => {
      try {
        // Convert symbol format: BTC_USDT -> BTCUSDT (Binance format)
        const binanceSymbol = symbol.replace('_', '');
        
        // Calculate the number of days for the request
        const days = Math.ceil((to - from) / 86400);
        const limit = Math.min(days, 1000); // Binance max is 1000
        
        console.log(`📊 Fetching ${limit} days of data for ${binanceSymbol} from Binance...`);
        
        // Binance API endpoint for candlestick data
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=${limit}`;
        
        const response = await fetch(url);
        
        // Handle API errors
        if (!response.ok) {
          const statusCode = response.status;
          if (statusCode === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          } else if (statusCode >= 500) {
            throw new Error('Market data service temporarily unavailable. Please try again later.');
          } else if (statusCode === 400) {
            // Symbol might not exist on Binance, try with USDT suffix variations
            throw new Error(`Symbol ${symbol} not found on Binance.`);
          } else {
            const errorText = await response.text();
            throw new Error(`Failed to fetch candlestick data: ${errorText}`);
          }
        }
        
        const data = await response.json();
        
        // Parse and validate the response
        if (!Array.isArray(data)) {
          throw new Error('Invalid API response: expected array of candlestick data');
        }
        
        console.log(`✅ Received ${data.length} candlesticks from Binance for ${binanceSymbol}`);
        
        const candlesticks: CandlestickData[] = data.map((candle: any) => {
          // Binance API returns: [
          //   0: Open time (ms),
          //   1: Open,
          //   2: High,
          //   3: Low,
          //   4: Close,
          //   5: Volume,
          //   6: Close time,
          //   7: Quote asset volume,
          //   8: Number of trades,
          //   9: Taker buy base asset volume,
          //   10: Taker buy quote asset volume,
          //   11: Ignore
          // ]
          if (!Array.isArray(candle) || candle.length < 6) {
            throw new Error('Invalid candlestick data format from Binance');
          }
          
          const [timestamp, open, high, low, close, volume] = candle;
          
          // Validate all required fields
          if (
            timestamp === undefined ||
            open === undefined ||
            high === undefined ||
            low === undefined ||
            close === undefined ||
            volume === undefined
          ) {
            throw new Error('Missing required OHLCV fields in candlestick data');
          }
          
          return {
            timestamp: Math.floor(Number(timestamp) / 1000), // Convert from milliseconds to seconds
            open: Number(open),
            high: Number(high),
            low: Number(low),
            close: Number(close),
            volume: Number(volume),
          };
        });
        
        // Filter candlesticks to match the requested time range
        const filteredCandlesticks = candlesticks.filter(
          (candle) => candle.timestamp >= from && candle.timestamp <= to
        );
        
        console.log(`📈 Returning ${filteredCandlesticks.length} candlesticks after filtering`);
        
        return filteredCandlesticks;
      } catch (error: any) {
        console.error(`❌ Error fetching candlesticks for ${symbol}:`, error.message);
        
        // If error already has a descriptive message, re-throw it
        if (error.message.includes('Rate limit') || 
            error.message.includes('temporarily unavailable') ||
            error.message.includes('not found')) {
          throw error;
        }
        
        // Re-throw with descriptive message
        throw new Error(`Failed to fetch candlestick data: ${error.message}`);
      }
    });
  }

  /**
   * Fetch current market statistics from CoinGecko
   * 
   * @param symbol - Trading pair symbol (e.g., 'BTC_USDT')
   * @returns Market statistics including price, volume, and 24h changes
   * 
   * Requirements: 1.3, 2.1
   */
  async getMarketStats(symbol: string): Promise<MarketStats> {
    // Throttle request to avoid rate limiting
    await this.throttleRequest();
    
    // Wrap the operation in retry logic
    return this.retryWithBackoff(async () => {
      try {
        // Convert symbol to CoinGecko coin ID
        const coinId = this.symbolToCoinId(symbol);

        // Fetch market data from CoinGecko API
        const url = `${this.baseUrl}/coins/markets?vs_currency=usd&ids=${coinId}`;
        const response = await fetch(url);

        // Handle API errors with descriptive messages
        if (!response.ok) {
          const statusCode = response.status;
          if (statusCode === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          } else if (statusCode >= 500) {
            throw new Error('Market data service temporarily unavailable. Please try again later.');
          } else if (statusCode === 404) {
            throw new Error(`Symbol ${symbol} not found or invalid.`);
          } else {
            const errorText = await response.text();
            throw new Error(`Failed to fetch market statistics: ${errorText}`);
          }
        }

        const data = await response.json();

        // Parse and validate the response
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error(`No market data found for symbol ${symbol}`);
        }

        const marketData = data[0];

        // Validate all required fields are present
        if (
          !marketData.id ||
          marketData.current_price === undefined ||
          marketData.price_change_percentage_24h === undefined ||
          marketData.total_volume === undefined ||
          marketData.high_24h === undefined ||
          marketData.low_24h === undefined
        ) {
          throw new Error('Missing required fields in market statistics data');
        }

        return {
          symbol: symbol,
          lastPrice: Number(marketData.current_price),
          priceChange24h: Number(marketData.price_change_percentage_24h),
          volume24h: Number(marketData.total_volume),
          high24h: Number(marketData.high_24h),
          low24h: Number(marketData.low_24h),
        };
      } catch (error: any) {
        // If error already has a descriptive message, re-throw it
        if (error.message.includes('Rate limit') || 
            error.message.includes('temporarily unavailable') ||
            error.message.includes('not found') ||
            error.message.includes('not supported') ||
            error.message.includes('No market data found')) {
          throw error;
        }

        // Re-throw with descriptive message
        throw new Error(`Failed to fetch market statistics: ${error.message}`);
      }
    });
  }

  /**
   * Handle rate limiting with exponential backoff
   * 
   * Implements exponential backoff retry logic for handling rate limits and transient errors.
   * The delay doubles with each retry attempt, starting from 2 seconds.
   * 
   * @param operation - Async operation to retry
   * @param maxRetries - Maximum number of retry attempts (default: 5)
   * @returns Result of the operation
   * @throws Error after max retries exceeded or for non-retryable errors
   * 
   * Requirements: 1.4, 1.5
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = 2000; // Start with 2 second delay

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Attempt the operation
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if this is a retryable error (429 rate limit or 5xx server errors)
        const isRateLimitError = error.message?.includes('Rate limit exceeded');
        const isServerError = error.message?.includes('temporarily unavailable');
        const isRetryable = isRateLimitError || isServerError;

        // If not retryable or we've exhausted retries, throw the error
        if (!isRetryable || attempt === maxRetries) {
          console.error(`Operation failed after ${attempt + 1} attempts:`, error.message);
          throw error;
        }

        // Log retry attempt
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay. ` +
          `Reason: ${isRateLimitError ? 'Rate limit' : 'Server error'}`
        );

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));

        // Double the delay for next retry (exponential backoff), max 30 seconds
        delay = Math.min(delay * 2, 30000);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Operation failed after retries');
  }
}

// Backward compatibility: Keep GateApiClient as an alias
export const GateApiClient = MarketDataClient;
export type GateApiClientConfig = MarketDataClientConfig;
