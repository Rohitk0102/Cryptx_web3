import axios from 'axios';
import { ethers } from 'ethers';
import redis from '../utils/redis';
import { SUPPORTED_CHAINS } from './blockchain.service';

export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoUrl?: string;
    verified: boolean;
}

export interface DiscoveredTokens {
    [chainId: number]: TokenInfo[];
}

/**
 * Covalent API for comprehensive token discovery
 */
const COVALENT_API = 'https://api.covalenthq.com/v1';

/**
 * Get API keys for token discovery services
 */
function getApiKeys() {
    return {
        covalent: process.env.COVALENT_API_KEY,
        moralis: process.env.MORALIS_API_KEY,
        alchemy: process.env.ETH_RPC_URL?.includes('alchemy') ? 
            process.env.ETH_RPC_URL.split('/').pop() : null,
    };
}

/**
 * Discover tokens using Covalent API
 */
async function discoverTokensWithCovalent(
    chainId: number, 
    address: string
): Promise<TokenInfo[]> {
    const apiKey = getApiKeys().covalent;
    if (!apiKey) {
        console.warn('Covalent API key not found, skipping Covalent discovery');
        return [];
    }

    try {
        const response = await axios.get(
            `${COVALENT_API}/${chainId}/address/${address}/balances_v2/`,
            {
                params: {
                    'quote-currency': 'USD',
                    'format': 'JSON',
                    'nft': false,
                    'no-nft-fetch': true,
                },
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
                timeout: 10000,
            }
        );

        const tokens: TokenInfo[] = [];
        
        if (response.data.data && response.data.data.items) {
            for (const item of response.data.data.items) {
                // Skip native tokens and zero balances
                if (!item.contract_address || item.quote === 0) continue;
                
                tokens.push({
                    address: item.contract_address,
                    symbol: item.contract_ticker_symbol,
                    name: item.contract_name,
                    decimals: item.contract_decimals,
                    logoUrl: item.logo_url,
                    verified: true, // Covalent typically lists verified tokens
                });
            }
        }

        return tokens;
    } catch (error) {
        console.error('Covalent token discovery error:', error);
        return [];
    }
}

/**
 * Discover tokens using Moralis API
 */
async function discoverTokensWithMoralis(
    chain: string,
    address: string
): Promise<TokenInfo[]> {
    const apiKey = getApiKeys().moralis;
    if (!apiKey) {
        console.warn('Moralis API key not found, skipping Moralis discovery');
        return [];
    }

    try {
        const chainMap: Record<string, string> = {
            ethereum: 'eth',
            polygon: 'polygon',
            bsc: 'bsc',
        };

        const moralisChain = chainMap[chain] || chain;
        
        const response = await axios.get(
            `https://deep-index.moralis.io/api/v2.2/${address}/erc20`,
            {
                params: {
                    chain: moralisChain,
                },
                headers: {
                    'X-API-Key': apiKey,
                },
                timeout: 10000,
            }
        );

        const tokens: TokenInfo[] = [];
        
        if (response.data) {
            for (const token of response.data) {
                // Skip zero balances
                if (ethers.formatUnits(token.balance, token.decimals) === '0') continue;
                
                tokens.push({
                    address: token.token_address,
                    symbol: token.symbol,
                    name: token.name,
                    decimals: token.decimals,
                    verified: token.verifyed || false, // Note: Moralis uses 'verifyed' (typo)
                });
            }
        }

        return tokens;
    } catch (error) {
        console.error('Moralis token discovery error:', error);
        return [];
    }
}

/**
 * Fallback: Scan for popular tokens using known addresses
 */
async function discoverPopularTokens(
    chain: string,
    address: string
): Promise<TokenInfo[]> {
    const popularTokens = {
        ethereum: [
            { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 18 },
            { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
            { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
            { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8 },
            { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'ChainLink Token', decimals: 18 },
            { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap Protocol Token', decimals: 18 },
            { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', name: 'Aave Token', decimals: 18 },
            { address: '0xA0b73E1Ff0B80914AB6fe0444E65D68223686B32', symbol: 'CRV', name: 'Curve DAO Token', decimals: 18 },
        ],
        polygon: [
            { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
            { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
            { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
            { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'WMATIC', name: 'Wrapped Matic', decimals: 18 },
            { address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', symbol: 'MATIC', name: 'Polygon', decimals: 18 },
            { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', symbol: 'AAVE', name: 'Aave', decimals: 18 },
            { address: '0x6e7a5FAFcec6BB1e78bAE2A1F0B6Ab0c974942A8', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
        ],
        bsc: [
            { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18 },
            { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18 },
            { address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
            { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', name: 'Binance USD', decimals: 18 },
            { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', name: 'Ethereum Token', decimals: 18 },
            { address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', symbol: 'CAKE', name: 'PancakeSwap Token', decimals: 18 },
        ],
    };

    const chainTokens = popularTokens[chain as keyof typeof popularTokens] || [];
    const provider = new ethers.JsonRpcProvider(SUPPORTED_CHAINS[chain].rpcUrl);
    
    const tokens: TokenInfo[] = [];
    
    for (const tokenInfo of chainTokens) {
        try {
            const contract = new ethers.Contract(
                tokenInfo.address,
                ['function balanceOf(address) view returns (uint256)'],
                provider
            );
            
            const balance = await contract.balanceOf(address);
            const balanceFormatted = ethers.formatUnits(balance, tokenInfo.decimals);
            
            if (parseFloat(balanceFormatted) > 0) {
                tokens.push({
                    ...tokenInfo,
                    verified: true,
                });
            }
        } catch (error) {
            // Skip tokens that fail
            continue;
        }
    }
    
    return tokens;
}

/**
 * Main token discovery function
 */
export async function discoverTokens(
    chain: string,
    address: string
): Promise<TokenInfo[]> {
    const cacheKey = `discovered_tokens:${chain}:${address}`;
    
    // Check cache first (5 minutes)
    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    let allTokens: TokenInfo[] = [];
    const chainId = SUPPORTED_CHAINS[chain].chainId;

    // Try multiple discovery methods in parallel
    try {
        const [covalentTokens, moralisTokens, popularTokens] = await Promise.allSettled([
            discoverTokensWithCovalent(chainId, address),
            discoverTokensWithMoralis(chain, address),
            discoverPopularTokens(chain, address),
        ]);

        // Combine results, prioritizing verified tokens
        const tokenMap = new Map<string, TokenInfo>();

        // Add Covalent tokens (highest priority)
        if (covalentTokens.status === 'fulfilled') {
            covalentTokens.value.forEach(token => {
                tokenMap.set(token.address.toLowerCase(), token);
            });
        }

        // Add Moralis tokens
        if (moralisTokens.status === 'fulfilled') {
            moralisTokens.value.forEach(token => {
                const existing = tokenMap.get(token.address.toLowerCase());
                if (!existing) {
                    tokenMap.set(token.address.toLowerCase(), token);
                }
            });
        }

        // Add popular tokens (fallback)
        if (popularTokens.status === 'fulfilled') {
            popularTokens.value.forEach(token => {
                const existing = tokenMap.get(token.address.toLowerCase());
                if (!existing) {
                    tokenMap.set(token.address.toLowerCase(), token);
                }
            });
        }

        allTokens = Array.from(tokenMap.values())
            .sort((a, b) => {
                // Sort verified tokens first
                if (a.verified && !b.verified) return -1;
                if (!a.verified && b.verified) return 1;
                return a.symbol.localeCompare(b.symbol);
            });

    } catch (error) {
        console.error('Token discovery failed:', error);
        // Fallback to popular tokens only
        allTokens = await discoverPopularTokens(chain, address);
    }

    // Cache results
    await redis.setex(cacheKey, 300, JSON.stringify(allTokens));

    return allTokens;
}

/**
 * Get token addresses for a chain (for balance fetching)
 */
export async function getTokenAddressesForChain(
    chain: string,
    address: string
): Promise<string[]> {
    const tokens = await discoverTokens(chain, address);
    return tokens.map(token => token.address);
}
