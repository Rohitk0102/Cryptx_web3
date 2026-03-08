import { ethers } from 'ethers';

export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
};

function getErrorMessage(error: any): string {
    return error?.message || 'Unknown error';
}

function parseNumericCode(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const directNumeric = Number(value);
        if (Number.isFinite(directNumeric)) {
            return directNumeric;
        }

        const statusMatch = value.match(/\b(\d{3})\b/);
        if (statusMatch) {
            return Number(statusMatch[1]);
        }
    }

    return null;
}

function getHttpStatusCode(error: any): number | null {
    return (
        parseNumericCode(error?.status) ??
        parseNumericCode(error?.response?.status) ??
        parseNumericCode(error?.info?.responseStatus) ??
        parseNumericCode(error?.info?.statusCode)
    );
}

function getRpcErrorCode(error: any): number | null {
    return (
        parseNumericCode(error?.error?.code) ??
        parseNumericCode(error?.info?.error?.code) ??
        parseNumericCode(error?.code)
    );
}

function responseBodyContains(error: any, text: string): boolean {
    const body = String(error?.info?.responseBody || '').toLowerCase();
    return body.includes(text.toLowerCase());
}

export function isRpcEndpointError(error: any): boolean {
    const httpStatus = getHttpStatusCode(error);
    const rpcCode = getRpcErrorCode(error);
    const message = getErrorMessage(error).toLowerCase();

    if (httpStatus !== null && [401, 403, 408, 425, 429].includes(httpStatus)) {
        return true;
    }

    if (httpStatus !== null && httpStatus >= 500 && httpStatus < 600) {
        return true;
    }

    if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNRESET' || error?.code === 'TIMEOUT') {
        return true;
    }

    if (
        message.includes('timeout') ||
        message.includes('failed to detect network') ||
        message.includes('temporarily unavailable') ||
        message.includes('circuit breaker is open')
    ) {
        return true;
    }

    if (responseBodyContains(error, 'api key') || responseBodyContains(error, 'tenant disabled')) {
        return true;
    }

    return rpcCode !== null && [-32000, -32002, -32004, -32603].includes(rpcCode);
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
    );

    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
    const httpStatus = getHttpStatusCode(error);
    const rpcCode = getRpcErrorCode(error);
    const message = getErrorMessage(error).toLowerCase();

    // Network errors (string codes — do NOT use coerced `code` here)
    if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNRESET') {
        return true;
    }

    // Rate limiting (string sentinel OR numeric 429)
    if (error?.code === 'RATE_LIMIT' || httpStatus === 429) {
        return true;
    }

    // Server errors (5xx) — coerced number prevents "500" >= 500 false positives
    if (httpStatus !== null && httpStatus >= 500 && httpStatus < 600) {
        return true;
    }

    // Timeout errors (string codes — do NOT use coerced `code` here)
    if (error?.code === 'TIMEOUT' || message.includes('timeout') || message.includes('failed to detect network')) {
        return true;
    }

    // Specific RPC errors that are retryable (numeric JSON-RPC codes)
    const retryableRpcErrors = [
        -32000, // Server error
        -32002, // Request timeout
        -32004, // Method not found (might be temporary)
        -32603, // Internal error
    ];

    return rpcCode !== null && retryableRpcErrors.includes(rpcCode);
}

/**
 * Get error type for better error messages
 */
function getErrorType(error: any): string {
    const httpStatus = getHttpStatusCode(error);

    if (httpStatus === 401 || httpStatus === 403) return 'Authentication Error';
    if (httpStatus === 429 || error?.code === 'RATE_LIMIT') return 'Rate Limit';
    if (httpStatus !== null && httpStatus >= 500 && httpStatus < 600) return 'Upstream Error';
    if (error?.code === 'NETWORK_ERROR') return 'Network Error';
    if (error?.code === 'TIMEOUT') return 'Timeout';
    if (error?.code === 'INSUFFICIENT_FUNDS') return 'Insufficient Funds';
    if (error?.code === 'UNPREDICTABLE_GAS_LIMIT') return 'Gas Estimation Failed';
    if (error?.code === 'REPLACEMENT_UNDERPRICED') return 'Transaction Underpriced';

    return 'RPC Error';
}

/**
 * Enhanced provider with retry logic
 */
export class RetryableRpcProvider {
    private provider: ethers.JsonRpcProvider;
    private config: RetryConfig;
    private chainName: string;
    private rpcUrl: string;
    private isInitialized = false;

    constructor(
        rpcUrl: string,
        chainName: string,
        chainId: number,
        config: Partial<RetryConfig> = {}
    ) {
        this.rpcUrl = rpcUrl;
        this.provider = new ethers.JsonRpcProvider(rpcUrl, {
            chainId,
            name: chainName.toLowerCase().replace(/\s+/g, '-'),
        }, {
            staticNetwork: true,
            polling: false
        });
        this.chainName = chainName;
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    }

    /**
     * Initialize provider connection lazily
     */
    private async ensureInitialized(): Promise<void> {
        if (this.isInitialized) return;

        // Skip network detection to prevent retry loops
        // The provider will work without explicit network detection
        this.isInitialized = true;
    }

    /**
     * Execute provider call with retry logic
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        // Ensure provider is initialized before first use
        await this.ensureInitialized();

        let lastError: any;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = calculateDelay(attempt - 1, this.config);
                    console.log(
                        `Retrying ${operationName} on ${this.chainName} (attempt ${attempt + 1}/${this.config.maxRetries + 1}) after ${delay}ms`
                    );
                    await new Promise<void>(resolve => setTimeout(resolve, delay));
                }

                const result = await operation();

                // Log successful retry
                if (attempt > 0) {
                    console.log(
                        `Successfully retried ${operationName} on ${this.chainName} after ${attempt} attempts`
                    );
                }

                return result;

            } catch (error: any) {
                lastError = error;

                // Don't retry on the last attempt
                if (attempt === this.config.maxRetries) {
                    break;
                }

                // Check if error is retryable
                if (!isRetryableError(error)) {
                    console.warn(
                        `Non-retryable error in ${operationName} on ${this.chainName}:`,
                        getErrorMessage(error)
                    );
                    break;
                }

                console.warn(
                    `Retryable error in ${operationName} on ${this.chainName} (attempt ${attempt + 1}):`,
                    getErrorMessage(error)
                );
            }
        }

        // Enhance error with context
        const errorType = getErrorType(lastError);
        const enhancedError = new Error(
            `${errorType} on ${this.chainName}: ${getErrorMessage(lastError)}`
        ) as any;

        enhancedError.originalError = lastError;
        enhancedError.chainName = this.chainName;
        enhancedError.operationName = operationName;
        enhancedError.errorType = errorType;
        enhancedError.attempts = this.config.maxRetries + 1;

        throw enhancedError;
    }

    /**
     * Get balance with retry
     */
    async getBalance(address: string): Promise<bigint> {
        return this.executeWithRetry(
            () => this.provider.getBalance(address),
            'getBalance'
        );
    }

    /**
     * Call contract with retry
     */
    async call(
        transaction: ethers.TransactionRequest,
        blockTag?: ethers.BlockTag
    ): Promise<string> {
        return this.executeWithRetry(
            () => this.provider.call(blockTag ? { ...transaction, blockTag } : transaction),
            'contractCall'
        );
    }

    /**
     * Get network with retry
     */
    async getNetwork(): Promise<ethers.Network> {
        return this.executeWithRetry(
            () => this.provider.getNetwork(),
            'getNetwork'
        );
    }

    /**
     * Get transaction count with retry
     */
    async getTransactionCount(address: string): Promise<number> {
        return this.executeWithRetry(
            () => this.provider.getTransactionCount(address),
            'getTransactionCount'
        );
    }

    /**
     * Get block with retry
     */
    async getBlock(blockHashOrBlockTag: ethers.BlockTag | string): Promise<ethers.Block | null> {
        return this.executeWithRetry(
            () => this.provider.getBlock(blockHashOrBlockTag),
            'getBlock'
        );
    }

    /**
     * Get raw provider for advanced usage
     */
    getProvider(): ethers.JsonRpcProvider {
        return this.provider;
    }

    getRpcUrl(): string {
        return this.rpcUrl;
    }
}

/**
 * Create a retryable provider for a chain
 */
export function createRetryableProvider(
    rpcUrl: string,
    chainName: string,
    chainId: number,
    config?: Partial<RetryConfig>
): RetryableRpcProvider {
    return new RetryableRpcProvider(rpcUrl, chainName, chainId, config);
}

/**
 * Circuit breaker pattern for RPC providers
 */
export class RpcCircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private failureThreshold = 5,
        private recoveryTimeout = 60000, // 1 minute
        private monitoringPeriod = 300000 // 5 minutes
    ) { }

    /**
     * Check if circuit is open
     */
    private isOpen(): boolean {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
                this.state = 'HALF_OPEN';
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Record success
     */
    recordSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    /**
     * Record failure
     */
    recordFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    /**
     * Execute operation with circuit breaker
     */
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.isOpen()) {
            throw new Error('Circuit breaker is OPEN - RPC provider is temporarily unavailable');
        }

        try {
            const result = await operation();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }

    /**
     * Get current state
     */
    getState(): string {
        return this.state;
    }

    /**
     * Get failure count
     */
    getFailureCount(): number {
        return this.failures;
    }
}
