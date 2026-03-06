import { ethers } from 'ethers';
import redis from '../utils/redis';
import { discoverTokens, getTokenAddressesForChain } from './tokenDiscovery.service';
import { createRetryableProvider, RpcCircuitBreaker } from '../utils/rpcRetry';

export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
    ethereum: {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
        },
    },
    polygon: {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18,
        },
    },
    bsc: {
        chainId: 56,
        name: 'BSC',
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
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

// Retryable providers cache
const retryableProviders: Record<string, any> = {};

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

/**
 * Get retryable provider for specific chain
 */
export function getProvider(chain: string): any {
    const config = SUPPORTED_CHAINS[chain];
    if (!config) {
        throw new Error(`Unsupported chain: ${chain}`);
    }

    // Create and cache retryable provider
    if (!retryableProviders[chain]) {
        retryableProviders[chain] = createRetryableProvider(
            config.rpcUrl,
            config.name,
            {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 10000,
                backoffMultiplier: 2,
            }
        );
    }

    return retryableProviders[chain];
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
    const provider = getProvider(chain);
    const config = SUPPORTED_CHAINS[chain];
    const circuitBreaker = getCircuitBreaker(chain);

    try {
        const balance = await circuitBreaker.execute(() =>
            provider.getBalance(address)
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
    const provider = getProvider(chain);
    const circuitBreaker = getCircuitBreaker(chain);

    const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)',
    ];

    try {
        const contract = new ethers.Contract(tokenAddress, abi, provider.getProvider());

        const [balance, decimals, symbol, name] = await Promise.all([
            circuitBreaker.execute(() => contract.balanceOf(walletAddress)) as Promise<bigint>,
            circuitBreaker.execute(() => contract.decimals()) as Promise<number>,
            circuitBreaker.execute(() => contract.symbol()) as Promise<string>,
            circuitBreaker.execute(() => contract.name()) as Promise<string>,
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

    // Get native balance
    const nativeBalance = await getNativeBalance(chain, address);

    // Get token addresses from discovery or use provided ones
    const addressesToCheck = tokenAddresses || await getTokenAddressesForChain(chain, address);
    
    // Get token balances
    const tokens: TokenBalance[] = [];
    for (const tokenAddress of addressesToCheck) {
        const balance = await getTokenBalance(chain, tokenAddress, address);
        if (balance) {
            tokens.push(balance);
        }
    }

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
    const cacheKey = `balances:${address}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    // Fetch balances in parallel
    const balances = await Promise.all(
        chains.map((chain) => getChainBalances(chain, address))
    );

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(balances));

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
