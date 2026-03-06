import { SUPPORTED_CHAINS } from '../services/blockchain.service';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    supportedChains: string[];
    invalidChains: string[];
}

/**
 * Validate chain configuration
 */
export function validateChain(chain: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if chain is supported
    if (!SUPPORTED_CHAINS[chain]) {
        errors.push(`Chain '${chain}' is not supported`);
        return {
            isValid: false,
            errors,
            warnings,
            supportedChains: Object.keys(SUPPORTED_CHAINS),
            invalidChains: [chain],
        };
    }

    const config = SUPPORTED_CHAINS[chain];

    // Validate RPC URL
    if (!config.rpcUrl) {
        errors.push(`RPC URL not configured for ${chain}`);
    } else if (!isValidUrl(config.rpcUrl)) {
        errors.push(`Invalid RPC URL format for ${chain}: ${config.rpcUrl}`);
    }

    // Validate chain ID
    if (!config.chainId || config.chainId <= 0) {
        errors.push(`Invalid chain ID for ${chain}: ${config.chainId}`);
    }

    // Validate native currency
    if (!config.nativeCurrency) {
        errors.push(`Native currency not configured for ${chain}`);
    } else {
        if (!config.nativeCurrency.symbol) {
            errors.push(`Native currency symbol not configured for ${chain}`);
        }
        if (!config.nativeCurrency.name) {
            warnings.push(`Native currency name not configured for ${chain}`);
        }
        if (!config.nativeCurrency.decimals || config.nativeCurrency.decimals <= 0) {
            errors.push(`Invalid decimals for ${chain} native currency: ${config.nativeCurrency.decimals}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        supportedChains: Object.keys(SUPPORTED_CHAINS),
        invalidChains: [],
    };
}

/**
 * Validate multiple chains
 */
export function validateChains(chains: string[]): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const invalidChains: string[] = [];

    for (const chain of chains) {
        const result = validateChain(chain);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
        
        if (!result.isValid) {
            invalidChains.push(chain);
        }
    }

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        supportedChains: Object.keys(SUPPORTED_CHAINS),
        invalidChains,
    };
}

/**
 * Validate wallet chain types
 */
export function validateWalletChainTypes(chainTypes: string[]): ValidationResult {
    if (!chainTypes || chainTypes.length === 0) {
        return {
            isValid: false,
            errors: ['No chain types specified'],
            warnings: [],
            supportedChains: Object.keys(SUPPORTED_CHAINS),
            invalidChains: [],
        };
    }

    return validateChains(chainTypes);
}

/**
 * Sanitize and filter chain types
 */
export function sanitizeChainTypes(chainTypes: string[]): string[] {
    if (!chainTypes) return [];

    return chainTypes
        .filter(chain => SUPPORTED_CHAINS[chain]) // Only keep supported chains
        .filter((chain, index, arr) => arr.indexOf(chain) === index); // Remove duplicates
}

/**
 * Get chain configuration with validation
 */
export function getValidatedChainConfig(chain: string) {
    const validation = validateChain(chain);
    
    if (!validation.isValid) {
        throw new Error(`Invalid chain configuration: ${validation.errors.join(', ')}`);
    }

    return SUPPORTED_CHAINS[chain];
}

/**
 * Check if URL is valid
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }

    // Check if it's a valid hex string with 0x prefix and 40 hex characters
    if (!address.match(/^0x[0-9a-fA-F]{40}$/)) {
        return false;
    }

    // Address is valid - we accept both checksummed and non-checksummed addresses
    return true;
}

/**
 * Convert to checksum address (simplified version)
 */
function toChecksumAddress(address: string): string {
    if (!address || typeof address !== 'string') {
        return address;
    }

    const lowerAddress = address.toLowerCase().replace('0x', '');
    const hash = lowerAddress.split('').reduce((acc, char) => {
        acc = (acc << 1) + char.charCodeAt(0);
        return acc & 0xffffffffffffffff;
    }, 0);

    let checksumAddress = '0x';
    for (let i = 0; i < lowerAddress.length; i++) {
        const char = lowerAddress[i];
        if (char >= '0' && char <= '9') {
            checksumAddress += char;
        } else {
            const hashBit = (hash >> (i * 4)) & 0x1;
            checksumAddress += hashBit >= 1 ? char.toUpperCase() : char;
        }
    }

    return checksumAddress;
}

/**
 * Validate wallet data
 */
export interface WalletDataValidation {
    address: string;
    chainTypes: string[];
    provider?: string;
}

export function validateWalletData(data: WalletDataValidation): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate address
    if (!data.address) {
        errors.push('Wallet address is required');
    } else if (!isValidEthereumAddress(data.address)) {
        errors.push('Invalid wallet address format');
    }

    // Validate chain types
    const chainValidation = validateWalletChainTypes(data.chainTypes);
    errors.push(...chainValidation.errors);
    warnings.push(...chainValidation.warnings);

    // Validate provider
    if (data.provider && !['metamask', 'walletconnect', 'coinbase'].includes(data.provider)) {
        warnings.push(`Unknown wallet provider: ${data.provider}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        supportedChains: Object.keys(SUPPORTED_CHAINS),
        invalidChains: chainValidation.invalidChains,
    };
}

/**
 * Get supported chains info
 */
export function getSupportedChainsInfo() {
    return Object.entries(SUPPORTED_CHAINS).map(([key, config]) => ({
        id: key,
        name: config.name,
        chainId: config.chainId,
        nativeCurrency: config.nativeCurrency,
        rpcUrl: config.rpcUrl.replace(/\/[^\/]+$/, '/***'), // Hide API keys
    }));
}

/**
 * Chain health check
 */
export async function checkChainHealth(chain: string): Promise<{
    isHealthy: boolean;
    responseTime?: number;
    error?: string;
}> {
    try {
        const config = getValidatedChainConfig(chain);
        const startTime = Date.now();
        
        // Simple health check - try to get latest block number
        const response = await fetch(config.rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1,
            }),
            signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        const responseTime = Date.now() - startTime;
        
        if (!response.ok) {
            return {
                isHealthy: false,
                responseTime,
                error: `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const data = await response.json() as any;
        
        if (data.error) {
            return {
                isHealthy: false,
                responseTime,
                error: data.error.message || 'RPC error',
            };
        }

        return {
            isHealthy: true,
            responseTime,
        };
    } catch (error: any) {
        return {
            isHealthy: false,
            error: error.message || 'Unknown error',
        };
    }
}
