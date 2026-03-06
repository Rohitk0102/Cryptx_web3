import prisma from '../utils/prisma';
import { getMultiChainBalances, ChainBalance } from './blockchain.service';
import { getTokenPrice, calculateUsdValue } from './price.service';
import { validateWalletChainTypes, sanitizeChainTypes } from '../utils/chainValidation';
import { ExchangeService } from './exchange.service';
import { PnLCalculationEngine } from './pnlCalculationEngine';
import { CostBasisCalculator } from './costBasisCalculator';
import { PriceFetchingService } from './priceFetching.service';

const exchangeService = new ExchangeService();
const priceService = new PriceFetchingService();
const costBasisCalculator = new CostBasisCalculator(prisma);
const pnlEngine = new PnLCalculationEngine(prisma, costBasisCalculator, priceService);

export interface AssetSummary {
    symbol: string;
    name: string;
    totalBalance: string;
    valueUsd: number;
    chains: {
        chain: string;
        balance: string;
        valueUsd: number;
    }[];
    exchanges?: {
        exchangeId: string;
        exchangeName: string;
        balance: string;
        valueUsd: number;
    }[];
}

export interface PortfolioData {
    totalValueUsd: number;
    totalInvestedUsd?: number;
    totalPnL?: number;
    totalPnLPercentage?: number;
    change24h?: number;
    change7d?: number;
    change30d?: number;
    wallets: {
        id: string;
        address: string;
        nickname?: string;
        provider?: string;
        valueUsd: number;
        chains: ChainBalance[];
    }[];
    exchanges: {
        id: string;
        provider: string;
        nickname?: string;
        valueUsd: number;
        lastSyncedAt?: Date;
        balances: {
            symbol: string;
            balance: string;
            lockedBalance: string;
            availableBalance: string;
            valueUsd: number;
        }[];
    }[];
    assets: AssetSummary[];
    lastUpdated: Date;
}

/**
 * Aggregate exchange balances for a user
 */
async function aggregateExchangeBalances(userId: string) {
    console.log(`📊 Aggregating exchange balances for user ${userId}...`);

    // Get all exchange accounts with balances
    const exchangeAccounts = await exchangeService.getUserExchangeBalances(userId);

    const exchangeData = [];
    const assetMap = new Map<string, {
        symbol: string;
        totalBalance: number;
        totalValueUsd: number;
        exchanges: Array<{
            exchangeId: string;
            exchangeName: string;
            balance: string;
            valueUsd: number;
        }>;
    }>();

    for (const account of exchangeAccounts) {
        let accountTotalUsd = 0;
        const balancesWithValue = [];

        for (const balance of account.balances) {
            // Get price for the asset
            const price = await getTokenPrice(balance.symbol);
            const valueUsd = price 
                ? calculateUsdValue(balance.balance, price.priceUsd)
                : 0;

            accountTotalUsd += valueUsd;

            balancesWithValue.push({
                symbol: balance.symbol,
                balance: balance.balance,
                lockedBalance: balance.lockedBalance,
                availableBalance: balance.availableBalance,
                valueUsd,
            });

            // Add to asset map
            if (!assetMap.has(balance.symbol)) {
                assetMap.set(balance.symbol, {
                    symbol: balance.symbol,
                    totalBalance: 0,
                    totalValueUsd: 0,
                    exchanges: [],
                });
            }

            const asset = assetMap.get(balance.symbol)!;
            asset.totalBalance += parseFloat(balance.balance);
            asset.totalValueUsd += valueUsd;
            asset.exchanges.push({
                exchangeId: account.id,
                exchangeName: account.nickname || account.provider,
                balance: balance.balance,
                valueUsd,
            });
        }

        exchangeData.push({
            id: account.id,
            provider: account.provider,
            nickname: account.nickname || undefined,
            valueUsd: accountTotalUsd,
            lastSyncedAt: account.lastSyncedAt || undefined,
            balances: balancesWithValue,
        });
    }

    console.log(`✅ Aggregated ${exchangeAccounts.length} exchange accounts`);

    return { exchangeData, assetMap };
}

/**
 * Aggregate portfolio for a user
 */
export async function aggregatePortfolio(userId: string): Promise<PortfolioData> {
    // Get all user wallets
    const wallets = await prisma.wallet.findMany({
        where: { userId, isActive: true },
    });

    // Get exchange balances
    const { exchangeData, assetMap: exchangeAssetMap } = await aggregateExchangeBalances(userId);

    if (wallets.length === 0 && exchangeData.length === 0) {
        return {
            totalValueUsd: 0,
            wallets: [],
            exchanges: [],
            assets: [],
            lastUpdated: new Date(),
        };
    }

    const walletData = [];
    const assetMap = new Map<string, AssetSummary>();

    // Process wallet balances
    for (const wallet of wallets) {
        // Validate and sanitize chain types
        const chainValidation = validateWalletChainTypes(wallet.chainTypes);
        if (!chainValidation.isValid) {
            console.warn(`Invalid chain types for wallet ${wallet.address}:`, chainValidation.errors);
            // Skip this wallet or use only valid chains
            continue;
        }

        const sanitizedChains = sanitizeChainTypes(wallet.chainTypes);
        
        // Fetch balances for this wallet (token discovery is now integrated)
        const chainBalances = await getMultiChainBalances(
            wallet.address,
            sanitizedChains
        );

        let walletTotalUsd = 0;

        // Calculate USD values
        for (const chainBalance of chainBalances) {
            // Native token
            const nativePrice = await getTokenPrice(chainBalance.nativeBalance.symbol);
            if (nativePrice) {
                const valueUsd = calculateUsdValue(
                    chainBalance.nativeBalance.balance,
                    nativePrice.priceUsd
                );
                chainBalance.nativeBalance.valueUsd = valueUsd;
                walletTotalUsd += valueUsd;

                // Add to asset map
                const symbol = chainBalance.nativeBalance.symbol;
                if (!assetMap.has(symbol)) {
                    assetMap.set(symbol, {
                        symbol,
                        name: chainBalance.nativeBalance.name,
                        totalBalance: '0',
                        valueUsd: 0,
                        chains: [],
                        exchanges: [],
                    });
                }
                const asset = assetMap.get(symbol)!;
                asset.totalBalance = (
                    parseFloat(asset.totalBalance) +
                    parseFloat(chainBalance.nativeBalance.balance)
                ).toString();
                asset.valueUsd += valueUsd;
                asset.chains.push({
                    chain: chainBalance.chain,
                    balance: chainBalance.nativeBalance.balance,
                    valueUsd,
                });
            }

            // ERC-20 tokens
            for (const token of chainBalance.tokens) {
                const tokenPrice = await getTokenPrice(token.symbol);
                if (tokenPrice) {
                    const valueUsd = calculateUsdValue(token.balance, tokenPrice.priceUsd);
                    token.valueUsd = valueUsd;
                    walletTotalUsd += valueUsd;

                    // Add to asset map
                    if (!assetMap.has(token.symbol)) {
                        assetMap.set(token.symbol, {
                            symbol: token.symbol,
                            name: token.name,
                            totalBalance: '0',
                            valueUsd: 0,
                            chains: [],
                            exchanges: [],
                        });
                    }
                    const asset = assetMap.get(token.symbol)!;
                    asset.totalBalance = (
                        parseFloat(asset.totalBalance) + parseFloat(token.balance)
                    ).toString();
                    asset.valueUsd += valueUsd;
                    asset.chains.push({
                        chain: chainBalance.chain,
                        balance: token.balance,
                        valueUsd,
                    });
                }
            }

            chainBalance.totalValueUsd = walletTotalUsd;
        }

        walletData.push({
            id: wallet.id,
            address: wallet.address,
            nickname: wallet.nickname || undefined,
            provider: wallet.provider || undefined,
            valueUsd: walletTotalUsd,
            chains: chainBalances,
        });
    }

    // Merge exchange assets into the asset map
    for (const [symbol, exchangeAsset] of exchangeAssetMap.entries()) {
        if (!assetMap.has(symbol)) {
            assetMap.set(symbol, {
                symbol,
                name: symbol, // Exchange assets may not have full names
                totalBalance: exchangeAsset.totalBalance.toString(),
                valueUsd: exchangeAsset.totalValueUsd,
                chains: [],
                exchanges: exchangeAsset.exchanges,
            });
        } else {
            const asset = assetMap.get(symbol)!;
            asset.totalBalance = (
                parseFloat(asset.totalBalance) + exchangeAsset.totalBalance
            ).toString();
            asset.valueUsd += exchangeAsset.totalValueUsd;
            asset.exchanges = exchangeAsset.exchanges;
        }
    }

    // Calculate total value including exchanges
    const walletTotalValue = walletData.reduce(
        (sum, wallet) => sum + wallet.valueUsd,
        0
    );
    const exchangeTotalValue = exchangeData.reduce(
        (sum, exchange) => sum + exchange.valueUsd,
        0
    );
    const totalValueUsd = walletTotalValue + exchangeTotalValue;

    const assets = Array.from(assetMap.values()).sort(
        (a, b) => b.valueUsd - a.valueUsd
    );

    // Calculate PNL data
    let totalInvestedUsd = 0;
    let totalPnL = 0;
    let totalPnLPercentage = 0;

    try {
        console.log(`💰 Calculating PNL for user ${userId}...`);
        // Get PNL summary for the user
        const pnlSummary = await pnlEngine.calculatePnLSummary(userId, {});
        
        console.log(`📊 PNL Summary:`, {
            totalPnL: pnlSummary.totalPnL.toString(),
            tokenCount: pnlSummary.byToken.length,
            tokens: pnlSummary.byToken.map(t => ({
                tokenSymbol: t.tokenSymbol,
                costBasis: t.costBasis.toString(),
                currentValue: t.currentValue.toString(),
                totalPnL: t.totalPnL.toString()
            }))
        });
        
        // Calculate total invested from cost basis
        totalInvestedUsd = pnlSummary.byToken.reduce((sum, token) => {
            return sum + parseFloat(token.costBasis.toString());
        }, 0);

        // Get total PNL
        totalPnL = parseFloat(pnlSummary.totalPnL.toString());

        // Calculate PNL percentage
        if (totalInvestedUsd > 0) {
            totalPnLPercentage = (totalPnL / totalInvestedUsd) * 100;
        }
        
        console.log(`💰 PNL Calculation Results:`, {
            totalInvestedUsd,
            totalPnL,
            totalPnLPercentage
        });
    } catch (error) {
        console.error('❌ Error calculating PNL for portfolio:', error);
        // Continue without PNL data if calculation fails
    }

    // Calculate historical portfolio values using real price data
    let change24h = 0;
    let change7d = 0;
    let change30d = 0;

    try {
        // Get historical prices for all assets in the portfolio
        const historicalValues = await calculateHistoricalPortfolioValues(assets);
        
        // Calculate percentage changes
        if (historicalValues.value24hAgo > 0) {
            change24h = ((totalValueUsd - historicalValues.value24hAgo) / historicalValues.value24hAgo) * 100;
        }
        if (historicalValues.value7dAgo > 0) {
            change7d = ((totalValueUsd - historicalValues.value7dAgo) / historicalValues.value7dAgo) * 100;
        }
        if (historicalValues.value30dAgo > 0) {
            change30d = ((totalValueUsd - historicalValues.value30dAgo) / historicalValues.value30dAgo) * 100;
        }
    } catch (error) {
        console.error('Error calculating historical portfolio values:', error);
        // Continue without historical data if calculation fails
    }

    return {
        totalValueUsd,
        totalInvestedUsd,
        totalPnL,
        totalPnLPercentage,
        change24h,
        change7d,
        change30d,
        wallets: walletData,
        exchanges: exchangeData,
        assets,
        lastUpdated: new Date(),
    };
}

/**
 * Calculate historical portfolio values using real price data from CoinGecko
 */
async function calculateHistoricalPortfolioValues(assets: AssetSummary[]): Promise<{
    value24hAgo: number;
    value7dAgo: number;
    value30dAgo: number;
}> {
    let value24hAgo = 0;
    let value7dAgo = 0;
    let value30dAgo = 0;

    // Map common symbols to CoinGecko IDs
    const symbolToCoinGeckoId: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT': 'tether',
        'USDC': 'usd-coin',
        'BNB': 'binancecoin',
        'MATIC': 'matic-network',
        'POL': 'matic-network',
        'SOL': 'solana',
        'ADA': 'cardano',
        'DOT': 'polkadot',
        'AVAX': 'avalanche-2',
        'LINK': 'chainlink',
        'UNI': 'uniswap',
        'AAVE': 'aave',
        'SHIB': 'shiba-inu',
        'DAI': 'dai',
    };

    for (const asset of assets) {
        const coinId = symbolToCoinGeckoId[asset.symbol.toUpperCase()];
        if (!coinId) {
            console.warn(`No CoinGecko ID mapping for ${asset.symbol}, skipping historical calculation`);
            continue;
        }

        try {
            // Fetch historical market data from CoinGecko
            // This gives us price data for the last 30 days
            const response = await fetch(
                `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily`
            );

            if (!response.ok) {
                console.warn(`Failed to fetch historical data for ${asset.symbol}`);
                continue;
            }

            const data = await response.json() as { prices: [number, number][] };
            const prices = data.prices; // Array of [timestamp, price]

            if (!prices || prices.length === 0) {
                continue;
            }

            // Get prices at specific time points
            const now = Date.now();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;
            const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
            const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

            // Find closest price data points
            const price24h = findClosestPrice(prices, oneDayAgo);
            const price7d = findClosestPrice(prices, sevenDaysAgo);
            const price30d = findClosestPrice(prices, thirtyDaysAgo);

            // Calculate value for this asset at each time point
            const assetBalance = parseFloat(asset.totalBalance);
            
            if (price24h) {
                value24hAgo += assetBalance * price24h;
            }
            if (price7d) {
                value7dAgo += assetBalance * price7d;
            }
            if (price30d) {
                value30dAgo += assetBalance * price30d;
            }

            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error fetching historical data for ${asset.symbol}:`, error);
        }
    }

    return { value24hAgo, value7dAgo, value30dAgo };
}

/**
 * Find the closest price to a target timestamp
 */
function findClosestPrice(prices: [number, number][], targetTimestamp: number): number | null {
    if (!prices || prices.length === 0) return null;

    let closest = prices[0];
    let minDiff = Math.abs(prices[0][0] - targetTimestamp);

    for (const [timestamp, price] of prices) {
        const diff = Math.abs(timestamp - targetTimestamp);
        if (diff < minDiff) {
            minDiff = diff;
            closest = [timestamp, price];
        }
    }

    return closest[1];
}

/**
 * Generate and save portfolio snapshot
 */
export async function generateSnapshot(userId: string): Promise<void> {
    const portfolio = await aggregatePortfolio(userId);

    await prisma.portfolioSnapshot.create({
        data: {
            userId,
            totalValueUsd: portfolio.totalValueUsd,
            breakdown: portfolio as any,
        },
    });
}

/**
 * Get latest snapshot
 */
export async function getLatestSnapshot(userId: string) {
    return await prisma.portfolioSnapshot.findFirst({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
    });
}
