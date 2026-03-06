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
    // Network errors
    if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNRESET') {
        return true;
    }
    
    // Rate limiting
    if (error.code === 'RATE_LIMIT' || error.code === 429) {
        return true;
    }
    
    // Server errors
    if (error.code >= 500 && error.code < 600) {
        return true;
    }
    
    // Timeout errors
    if (error.code === 'TIMEOUT' || error.message.includes('timeout')) {
        return true;
    }
    
    // Specific RPC errors that are retryable
    const retryableRpcErrors = [
        -32000, // Server error
        -32002, // Request timeout
        -32004, // Method not found (might be temporary)
        -32603, // Internal error
    ];
    
    return retryableRpcErrors.includes(error.code);
}

/**
 * Get error type for better error messages
 */
function getErrorType(error: any): string {
    if (error.code === 'NETWORK_ERROR') return 'Network Error';
    if (error.code === 'RATE_LIMIT') return 'Rate Limit';
    if (error.code === 'TIMEOUT') return 'Timeout';
    if (error.code === 'INSUFFICIENT_FUNDS') return 'Insufficient Funds';
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') return 'Gas Estimation Failed';
    if (error.code === 'REPLACEMENT_UNDERPRICED') return 'Transaction Underpriced';
    
    return 'RPC Error';
}

/**
 * Enhanced provider with retry logic
 */
export class RetryableRpcProvider {
    private provider: ethers.JsonRpcProvider;
    private config: RetryConfig;
    private chainName: string;

    constructor(rpcUrl: string, chainName: string, config: Partial<RetryConfig> = {}) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.chainName = chainName;
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    }

    /**
     * Execute provider call with retry logic
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
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
                        error.message
                    );
                    break;
                }
                
                console.warn(
                    `Retryable error in ${operationName} on ${this.chainName} (attempt ${attempt + 1}):`,
                    error.message
                );
            }
        }
        
        // Enhance error with context
        const errorType = getErrorType(lastError);
        const enhancedError = new Error(
            `${errorType} on ${this.chainName}: ${lastError.message}`
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
            () => this.provider.call(transaction),
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
}

/**
 * Create a retryable provider for a chain
 */
export function createRetryableProvider(
    rpcUrl: string,
    chainName: string,
    config?: Partial<RetryConfig>
): RetryableRpcProvider {
    return new RetryableRpcProvider(rpcUrl, chainName, config);
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
    ) {}

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
