import { ethers } from 'ethers';
import redis from '../utils/redis';
import { discoverTokens, getTokenAddressesForChain } from './tokenDiscovery.service';
import {
    createRetryableProvider,
    isRpcEndpointError,
    RetryableRpcProvider,
    RpcCircuitBreaker,
} from '../utils/rpcRetry';

export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrls: string[];
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
}

const DEFAULT_RPC_URLS: Record<string, string[]> = {
    ethereum: [
        'https://eth.llamarpc.com',
        'https://ethereum-rpc.publicnode.com',
    ],
    polygon: [
        'https://polygon-bor-rpc.publicnode.com',
        'https://polygon.llamarpc.com',
        'https://1rpc.io/matic',
    ],
    bsc: [
        'https://bsc-dataseed.binance.org',
        'https://bsc-rpc.publicnode.com',
    ],
};

function isValidRpcUrl(url?: string): url is string {
    if (!url) {
        return false;
    }

    const normalized = url.trim();
    if (!normalized) {
        return false;
    }

    const lower = normalized.toLowerCase();
    if (
        lower.includes('undefined') ||
        lower.includes('your-') ||
        lower.includes('your_') ||
        lower.includes('<your') ||
        lower.includes('replace-me')
    ) {
        return false;
    }

    try {
        const parsed = new URL(normalized);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function resolveRpcUrls(envValue: string | undefined, fallbacks: string[]): string[] {
    const configuredUrls = (envValue || '')
        .split(',')
        .map((value) => value.trim())
        .filter(isValidRpcUrl);

    return Array.from(new Set([...configuredUrls, ...fallbacks.filter(isValidRpcUrl)]));
}

function maskRpcUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}/***`;
    } catch {
        return url.replace(/\/[^\/]+$/, '/***');
    }
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
    ethereum: {
        chainId: 1,
        name: 'Ethereum',
        rpcUrls: resolveRpcUrls(process.env.ETH_RPC_URL, DEFAULT_RPC_URLS.ethereum),
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
        },
    },
    polygon: {
        chainId: 137,
        name: 'Polygon',
        rpcUrls: resolveRpcUrls(process.env.POLYGON_RPC_URL, DEFAULT_RPC_URLS.polygon),
        nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18,
        },
    },
    bsc: {
        chainId: 56,
        name: 'BSC',
        rpcUrls: resolveRpcUrls(process.env.BSC_RPC_URL, DEFAULT_RPC_URLS.bsc),
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
        },
    },
};

// Circuit breakers for each chain
const circuitBreakers: Record<string, RpcCircuitBreaker> = {
    ethereum: new RpcCircuitBreaker(5, 60000, 300000),
    polygon: new RpcCircuitBreaker(5, 60000, 300000),
    bsc: new RpcCircuitBreaker(5, 60000, 300000),
};

// Retryable providers cache - initialized lazily
const retryableProviders: Record<string, RetryableRpcProvider[]> = {};
const activeProviderIndexes: Record<string, number> = {};

export interface TokenBalance {
    symbol: string;
    name: string;
    balance: string;
    decimals: number;
    contractAddress?: string;
    valueUsd?: number;
}

export interface ChainBalance {
    chain: string;
    chainId: number;
    nativeBalance: TokenBalance;
    tokens: TokenBalance[];
    totalValueUsd: number;
}

function getProviders(chain: string): RetryableRpcProvider[] {
    const config = SUPPORTED_CHAINS[chain];
    if (!config) {
        throw new Error(`Unsupported chain: ${chain}`);
    }

    if (!config.rpcUrls.length) {
        throw new Error(`No valid RPC URLs configured for ${chain}`);
    }

    if (!retryableProviders[chain]) {
        console.log(
            `Creating ${config.rpcUrls.length} RPC provider(s) for ${chain}: ${config.rpcUrls.map(maskRpcUrl).join(', ')}`
        );
        retryableProviders[chain] = config.rpcUrls.map((rpcUrl) =>
            createRetryableProvider(
                rpcUrl,
                config.name,
                config.chainId,
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 10000,
                    backoffMultiplier: 2,
                }
            )
        );
        activeProviderIndexes[chain] = 0;
    }

    return retryableProviders[chain];
}

function getOrderedProviders(chain: string): Array<{ provider: RetryableRpcProvider; index: number }> {
    const providers = getProviders(chain);
    const activeIndex = activeProviderIndexes[chain] ?? 0;

    return Array.from({ length: providers.length }, (_, offset) => {
        const index = (activeIndex + offset) % providers.length;
        return { provider: providers[index], index };
    });
}

async function executeWithProviderFailover<T>(
    chain: string,
    operationName: string,
    operation: (provider: RetryableRpcProvider) => Promise<T>
): Promise<T> {
    const orderedProviders = getOrderedProviders(chain);
    let lastError: any;

    for (let attempt = 0; attempt < orderedProviders.length; attempt++) {
        const { provider, index } = orderedProviders[attempt];

        try {
            const result = await getCircuitBreaker(chain).execute(() => operation(provider));
            activeProviderIndexes[chain] = index;
            return result;
        } catch (error: any) {
            lastError = error;
            const hasFallbackProvider = attempt < orderedProviders.length - 1;

            if (!hasFallbackProvider || !isRpcEndpointError(error)) {
                throw error;
            }

            console.warn(
                `RPC failover for ${chain} during ${operationName}: ${maskRpcUrl(provider.getRpcUrl())} failed with ${error?.message || 'unknown error'}`
            );
        }
    }

    throw lastError;
}

/**
 * Get retryable provider for specific chain
 */
export function getProvider(chain: string): RetryableRpcProvider {
    const config = SUPPORTED_CHAINS[chain];
    if (!config) {
        throw new Error(`Unsupported chain: ${chain}`);
    }

    const providers = getProviders(chain);
    const activeIndex = activeProviderIndexes[chain] ?? 0;
    return providers[activeIndex];
}

/**
 * Get circuit breaker for a chain
 */
export function getCircuitBreaker(chain: string): RpcCircuitBreaker {
    const breaker = circuitBreakers[chain];
    if (!breaker) {
        throw new Error(`No circuit breaker found for chain: ${chain}`);
    }
    return breaker;
}

/**
 * Get native token balance (ETH, MATIC, BNB)
 */
export async function getNativeBalance(
    chain: string,
    address: string
): Promise<TokenBalance> {
    const config = SUPPORTED_CHAINS[chain];

    try {
        const balance = await executeWithProviderFailover(
            chain,
            'getBalance',
            (provider) => provider.getBalance(address)
        ) as bigint;
        const balanceFormatted = ethers.formatEther(balance);

        return {
            symbol: config.nativeCurrency.symbol,
            name: config.nativeCurrency.name,
            balance: balanceFormatted,
            decimals: config.nativeCurrency.decimals,
        };
    } catch (error: any) {
        console.error(`Error fetching native balance on ${chain}:`, error);
        throw new Error(`Failed to fetch balance on ${chain}: ${error?.message || 'Unknown error'}`);
    }
}

/**
 * Get ERC-20 token balance
 */
export async function getTokenBalance(
    chain: string,
    tokenAddress: string,
    walletAddress: string
): Promise<TokenBalance | null> {
    const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)',
    ];

    try {
        const [balance, decimals, symbol, name] = await Promise.all([
            executeWithProviderFailover(chain, 'erc20.balanceOf', (provider) =>
                new ethers.Contract(tokenAddress, abi, provider.getProvider()).balanceOf(walletAddress)
            ) as Promise<bigint>,
            executeWithProviderFailover(chain, 'erc20.decimals', (provider) =>
                new ethers.Contract(tokenAddress, abi, provider.getProvider()).decimals()
            ) as Promise<number>,
            executeWithProviderFailover(chain, 'erc20.symbol', (provider) =>
                new ethers.Contract(tokenAddress, abi, provider.getProvider()).symbol()
            ) as Promise<string>,
            executeWithProviderFailover(chain, 'erc20.name', (provider) =>
                new ethers.Contract(tokenAddress, abi, provider.getProvider()).name()
            ) as Promise<string>,
        ]);

        const balanceFormatted = ethers.formatUnits(balance, decimals);

        // Skip if balance is zero
        if (parseFloat(balanceFormatted) === 0) {
            return null;
        }

        return {
            symbol,
            name,
            balance: balanceFormatted,
            decimals,
            contractAddress: tokenAddress,
        };
    } catch (error: any) {
        console.error(`Error fetching token ${tokenAddress}:`, error);
        return null;
    }
}

/**
 * Get all balances for a wallet on a specific chain
 */
export async function getChainBalances(
    chain: string,
    address: string,
    tokenAddresses?: string[]
): Promise<ChainBalance> {
    const config = SUPPORTED_CHAINS[chain];
    if (!config) {
        throw new Error(`Unsupported chain: ${chain}`);
    }

    // Get native balance
    const nativeBalance = await getNativeBalance(chain, address);

    // Get token addresses from discovery or use provided ones
    let addressesToCheck = tokenAddresses;
    if (!addressesToCheck) {
        try {
            addressesToCheck = await getTokenAddressesForChain(chain, address);
        } catch (error) {
            console.error(`Token discovery failed for ${chain}, falling back to common tokens:`, error);
            addressesToCheck = COMMON_TOKENS[chain] || [];
        }
    }

    const uniqueTokenAddresses = Array.from(new Set(addressesToCheck));

    // Get token balances in parallel
    const results = await Promise.allSettled(
        uniqueTokenAddresses.map((tokenAddress) => getTokenBalance(chain, tokenAddress, address))
    );
    const tokens: TokenBalance[] = results
        .filter(
            (r): r is PromiseFulfilledResult<TokenBalance> =>
                r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value);

    return {
        chain: config.name,
        chainId: config.chainId,
        nativeBalance,
        tokens,
        totalValueUsd: 0, // Will be calculated with price service
    };
}

/**
 * Get balances across all supported chains
 */
export async function getMultiChainBalances(
    address: string,
    chains: string[] = ['ethereum', 'polygon', 'bsc']
): Promise<ChainBalance[]> {
    const requestedChains = Array.from(new Set(chains.filter(Boolean)));
    const supportedChains = requestedChains.filter((chain) => SUPPORTED_CHAINS[chain]);

    if (supportedChains.length === 0) {
        return [];
    }

    const cacheKey = `balances:${address}:${[...supportedChains].sort().join(',')}`;

    // Check cache — Redis failures must never crash this function
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (error) {
        console.warn('[Cache] redis.get() failed, fetching live data:', error);
    }

    // Fetch balances in parallel
    const results = await Promise.allSettled(
        supportedChains.map((chain) => getChainBalances(chain, address))
    );
    const balances: ChainBalance[] = [];
    const failedChains: string[] = [];

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            balances.push(result.value);
            return;
        }

        failedChains.push(supportedChains[index]);
        console.error(`Failed to fetch balances on ${supportedChains[index]}:`, result.reason);
    });

    if (failedChains.length > 0) {
        console.warn(
            `Balance fetch returned partial data for ${address}. Failed chains: ${failedChains.join(', ')}`
        );
    }

    if (balances.length === 0) {
        throw new Error(`Failed to fetch balances on all requested chains: ${failedChains.join(', ')}`);
    }

    // Cache for 5 minutes — failure is non-fatal
    try {
        await redis.setex(cacheKey, 300, JSON.stringify(balances));
    } catch (error) {
        console.warn('[Cache] redis.setex() failed, continuing without cache:', error);
    }

    return balances;
}

/**
 * Common ERC-20 tokens by chain
 */
export const COMMON_TOKENS: Record<string, string[]> = {
    ethereum: [
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    ],
    polygon: [
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
    ],
    bsc: [
        '0x55d398326f99059fF775485246999027B3197955', // USDT
        '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
        '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', // DAI
    ],
};
