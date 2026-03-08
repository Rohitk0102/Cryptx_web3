import crypto from 'crypto';

/**
 * Configuration for CoinDCX API client
 */
export interface CoinDCXConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

/**
 * Balance data structure from CoinDCX API
 */
export interface CoinDCXBalance {
  currency: string;
  balance: number;
  locked_balance: number;
}

/**
 * Trade data structure from CoinDCX API
 */
export interface CoinDCXTrade {
  id: string;
  order_id: string;
  side: 'buy' | 'sell';
  fee_amount: string;
  ecode: string;
  quantity: number;
  price: number;
  symbol: string;
  timestamp: number;
}

export interface CoinDCXTickerEntry {
  market: string;
  change_24_hour: string;
  high: string;
  low: string;
  volume: string;
  last_price: string;
  bid: string;
  ask: string;
  timestamp: number;
}

export interface CoinDCXUserInfo {
  coindcx_id?: string;
  email?: string;
  mobile_number?: string;
  name?: string;
}

/**
 * Error response from CoinDCX API
 */
interface CoinDCXErrorResponse {
  code?: number;
  message?: string;
}

/**
 * CoinDCX API Client
 * 
 * Handles all communication with the CoinDCX exchange API.
 * Provides methods for authentication, balance fetching, trade history, and credential validation.
 * Implements rate limiting, error handling, and retry logic with exponential backoff.
 * 
 * Requirements: Phase 1.3 - CoinDCX API Client
 */
export class CoinDCXClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 100; // Minimum 100ms between requests (10 req/sec)
  private requestCount: number = 0;
  private requestWindowStart: number = Date.now();
  private readonly maxRequestsPerMinute: number = 10;

  /**
   * Initialize CoinDCX API client with configuration
   * 
   * @param config - API configuration including apiKey and apiSecret
   */
  constructor(config: CoinDCXConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl || 'https://api.coindcx.com';
  }

  /**
   * Generate authentication signature for CoinDCX API
   * 
   * CoinDCX requires HMAC-SHA256 signature of the request body
   * The signature is created by: HMAC-SHA256(secret_key, request_body)
   * 
   * @param body - Request body as JSON string
   * @returns HMAC-SHA256 signature in hex format
   */
  private generateSignature(body: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(body)
      .digest('hex');
  }

  /**
   * Rate limiting protection
   * 
   * Implements two-level rate limiting:
   * 1. Minimum interval between requests (100ms)
   * 2. Maximum requests per minute (10)
   * 
   * Throws error if rate limit would be exceeded
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if 60 seconds have passed
    if (now - this.requestWindowStart >= 60000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }
    
    // Check if we've exceeded the per-minute limit
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.requestWindowStart);
      if (waitTime > 0) {
        console.log(`⏱️  Rate limit reached, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Reset after waiting
        this.requestCount = 0;
        this.requestWindowStart = Date.now();
      }
    }
    
    // Enforce minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Make authenticated request to CoinDCX API
   * 
   * @param endpoint - API endpoint path
   * @param body - Request body object
   * @returns Parsed JSON response
   * @throws Error on API errors or network failures
   */
  private async makeRequest<T>(endpoint: string, body: Record<string, any> = {}): Promise<T> {
    await this.enforceRateLimit();

    const timestamp = Date.now();
    const requestBody = JSON.stringify({ ...body, timestamp });
    const signature = this.generateSignature(requestBody);

    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('🔗 CoinDCX API Request:', {
      endpoint,
      timestamp,
      bodyKeys: Object.keys(body),
      signatureLength: signature.length,
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-APIKEY': this.apiKey,
          'X-AUTH-SIGNATURE': signature,
        },
        body: requestBody,
      });

      // Parse response
      const data = await response.json();
      
      console.log('📥 CoinDCX API Response:', {
        status: response.status,
        ok: response.ok,
        dataType: Array.isArray(data) ? 'array' : typeof data,
      });

      // Handle API errors
      if (!response.ok) {
        const errorData = data as CoinDCXErrorResponse;
        const errorMessage = errorData.message || response.statusText;
        
        console.error('❌ CoinDCX API Error:', {
          status: response.status,
          message: errorMessage,
          data: errorData,
        });
        
        if (response.status === 401) {
          throw new Error('Invalid API credentials');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        } else if (response.status >= 500) {
          throw new Error('CoinDCX service temporarily unavailable');
        } else {
          throw new Error(`CoinDCX API error: ${errorMessage}`);
        }
      }

      return data as T;
    } catch (error: any) {
      // Re-throw known errors
      if (error.message.includes('Invalid API credentials') ||
          error.message.includes('Rate limit') ||
          error.message.includes('temporarily unavailable')) {
        throw error;
      }
      
      // Handle network errors
      if (error.name === 'TypeError' || error.code === 'ECONNREFUSED') {
        throw new Error('Network error: Unable to connect to CoinDCX API');
      }
      
      throw new Error(`CoinDCX API request failed: ${error.message}`);
    }
  }

  /**
   * Make unauthenticated GET request to CoinDCX public API.
   */
  private async makePublicGetRequest<T>(endpoint: string): Promise<T> {
    await this.enforceRateLimit();

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as CoinDCXErrorResponse;
        const errorMessage = errorData.message || response.statusText;

        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        } else if (response.status >= 500) {
          throw new Error('CoinDCX service temporarily unavailable');
        }

        throw new Error(`CoinDCX API error: ${errorMessage}`);
      }

      return data as T;
    } catch (error: any) {
      if (error.message.includes('Rate limit') ||
          error.message.includes('temporarily unavailable')) {
        throw error;
      }

      if (error.name === 'TypeError' || error.code === 'ECONNREFUSED') {
        throw new Error('Network error: Unable to connect to CoinDCX API');
      }

      throw new Error(`CoinDCX API request failed: ${error.message}`);
    }
  }

  /**
   * Retry operation with exponential backoff
   * 
   * Implements exponential backoff retry logic for handling rate limits and transient errors.
   * The delay doubles with each retry attempt, starting from 1 second.
   * 
   * @param operation - Async operation to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @returns Result of the operation
   * @throws Error after max retries exceeded or for non-retryable errors
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = 1000; // Start with 1 second delay

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if this is a retryable error
        const isRateLimitError = error.message?.includes('Rate limit exceeded');
        const isServerError = error.message?.includes('temporarily unavailable');
        const isNetworkError = error.message?.includes('Network error');
        const isRetryable = isRateLimitError || isServerError || isNetworkError;

        // If not retryable or we've exhausted retries, throw the error
        if (!isRetryable || attempt === maxRetries) {
          console.error(`❌ CoinDCX operation failed after ${attempt + 1} attempts:`, error.message);
          throw error;
        }

        // Log retry attempt
        console.log(
          `🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay. ` +
          `Reason: ${error.message}`
        );

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));

        // Double the delay for next retry (exponential backoff), max 10 seconds
        delay = Math.min(delay * 2, 10000);
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Get all balances from CoinDCX account
   * 
   * Fetches all cryptocurrency balances including locked and available amounts.
   * Only returns currencies with non-zero balances.
   * 
   * @returns Array of balance objects
   * @throws Error on API errors or authentication failures
   */
  async getBalances(): Promise<CoinDCXBalance[]> {
    return this.retryWithBackoff(async () => {
      try {
        const balances = await this.makeRequest<CoinDCXBalance[]>(
          '/exchange/v1/users/balances',
          {}
        );

        // Validate response
        if (!Array.isArray(balances)) {
          throw new Error('Invalid response format: expected array of balances');
        }

        // Filter out zero balances and validate data
        const nonZeroBalances = balances.filter(balance => {
          if (!balance.currency || balance.balance === undefined || balance.locked_balance === undefined) {
            console.warn('⚠️  Invalid balance entry, skipping:', balance);
            return false;
          }
          return balance.balance > 0 || balance.locked_balance > 0;
        });

        console.log(`✅ Fetched ${nonZeroBalances.length} non-zero balances from CoinDCX`);
        return nonZeroBalances;
      } catch (error: any) {
        console.error('❌ Error fetching balances:', error.message);
        throw error;
      }
    });
  }

  /**
   * Get authenticated user info from CoinDCX.
   *
   * Useful for diagnostics when a key can read balances but not trade history.
   */
  async getUserInfo(): Promise<CoinDCXUserInfo> {
    return this.retryWithBackoff(async () => {
      try {
        const userInfo = await this.makeRequest<CoinDCXUserInfo>(
          '/exchange/v1/users/info',
          {}
        );

        if (!userInfo || typeof userInfo !== 'object') {
          throw new Error('Invalid response format: expected user info object');
        }

        return userInfo;
      } catch (error: any) {
        console.error('❌ Error fetching user info:', error.message);
        throw error;
      }
    });
  }

  /**
   * Get trade history from CoinDCX account
   * 
   * Fetches historical trades with optional filtering by symbol and limit.
   * 
   * @param params - Query parameters
   * @param params.symbol - Trading pair symbol (e.g., 'BTCUSDT') - optional
   * @param params.limit - Maximum number of trades to return (default: 500, max: 500)
   * @param params.from - Start timestamp in milliseconds - optional
   * @param params.to - End timestamp in milliseconds - optional
   * @returns Array of trade objects
   * @throws Error on API errors or authentication failures
   */
  async getTradeHistory(params: {
    symbol?: string;
    limit?: number;
    sort?: 'asc' | 'desc';
    fromTimestamp?: number;
    toTimestamp?: number;
    fromId?: number;
    from?: number;
    to?: number;
  } = {}): Promise<CoinDCXTrade[]> {
    return this.retryWithBackoff(async () => {
      try {
        const requestParams: Record<string, any> = {
          limit: Math.min(params.limit || 500, 5000), // CoinDCX docs allow max 5000
        };
        
        if (params.symbol) {
          requestParams.symbol = params.symbol;
        }
        
        if (params.sort) {
          requestParams.sort = params.sort;
        }

        if (params.fromId !== undefined) {
          requestParams.from_id = params.fromId;
        }

        const fromTimestamp = params.fromTimestamp ?? params.from;
        if (fromTimestamp !== undefined) {
          requestParams.from_timestamp = fromTimestamp;
        }

        const toTimestamp = params.toTimestamp ?? params.to;
        if (toTimestamp !== undefined) {
          requestParams.to_timestamp = toTimestamp;
        }

        console.log(`🔍 Fetching trade history with params:`, requestParams);

        const trades = await this.makeRequest<CoinDCXTrade[]>(
          '/exchange/v1/orders/trade_history',
          requestParams
        );

        // Validate response
        if (!Array.isArray(trades)) {
          throw new Error('Invalid response format: expected array of trades');
        }

        console.log(`✅ Fetched ${trades.length} trades from CoinDCX`);
        return trades;
      } catch (error: any) {
        console.error('❌ Error fetching trade history:', error.message);
        throw error;
      }
    });
  }

  /**
   * Get current ticker snapshot from CoinDCX public API.
   */
  async getTicker(): Promise<CoinDCXTickerEntry[]> {
    return this.retryWithBackoff(async () => {
      const ticker = await this.makePublicGetRequest<CoinDCXTickerEntry[]>(
        '/exchange/ticker'
      );

      if (!Array.isArray(ticker)) {
        throw new Error('Invalid response format: expected array of tickers');
      }

      return ticker;
    });
  }

  /**
   * Validate API credentials
   * 
   * Tests the API credentials by attempting to fetch balances.
   * Returns true if credentials are valid, false otherwise.
   * 
   * @returns Promise<boolean> - true if credentials are valid
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.getBalances();
      console.log('✅ CoinDCX credentials validated successfully');
      return true;
    } catch (error: any) {
      console.error('❌ CoinDCX credential validation failed:', error.message);
      
      // Return false for authentication errors, throw for other errors
      if (error.message.includes('Invalid API credentials')) {
        return false;
      }
      
      // For other errors (network, server), we can't determine validity
      // so we throw to let the caller handle it
      throw error;
    }
  }
}
