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
    totalRealizedPnL?: number;
    totalUnrealizedPnL?: number;
    totalPnL?: number;
    totalPnLPercentage?: number;
    pnlStatus?: 'complete' | 'incomplete';
    pnlNotice?: string;
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

export interface AggregatePortfolioOptions {
    exchangePriceUsdBySymbol?: Record<string, number>;
}

/**
 * Aggregate exchange balances for a user
 */
async function aggregateExchangeBalances(
    userId: string,
    options: AggregatePortfolioOptions = {}
) {
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
            const overridePriceUsd = options.exchangePriceUsdBySymbol?.[balance.symbol.toUpperCase()];
            const price = overridePriceUsd !== undefined
                ? { priceUsd: overridePriceUsd }
                : await getTokenPrice(balance.symbol);
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
    return aggregatePortfolioWithOptions(userId);
}

export async function aggregatePortfolioWithOptions(
    userId: string,
    options: AggregatePortfolioOptions = {}
): Promise<PortfolioData> {
    // Get all user wallets
    const wallets = await prisma.wallet.findMany({
        where: { userId, isActive: true },
    });

    // Get exchange balances
    const { exchangeData, assetMap: exchangeAssetMap } = await aggregateExchangeBalances(userId, options);

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
        try {
            // Validate and sanitize chain types
            const chainValidation = validateWalletChainTypes(wallet.chainTypes);
            const sanitizedChains = sanitizeChainTypes(wallet.chainTypes);

            if (!chainValidation.isValid) {
                console.warn(`Invalid chain types for wallet ${wallet.address}:`, chainValidation.errors);
            }

            if (sanitizedChains.length === 0) {
                console.warn(`Skipping wallet ${wallet.address} because it has no supported chain types`);
                continue;
            }

            // Fetch balances for this wallet (token discovery is now integrated)
            const chainBalances = await getMultiChainBalances(
                wallet.address,
                sanitizedChains
            );

            let walletTotalUsd = 0;

            // Calculate USD values
            for (const chainBalance of chainBalances) {
                let chainTotalUsd = 0;

                // Native token
                const nativePrice = await getTokenPrice(chainBalance.nativeBalance.symbol);
                if (nativePrice) {
                    const valueUsd = calculateUsdValue(
                        chainBalance.nativeBalance.balance,
                        nativePrice.priceUsd
                    );
                    chainBalance.nativeBalance.valueUsd = valueUsd;
                    chainTotalUsd += valueUsd;
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
                        chainTotalUsd += valueUsd;
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

                chainBalance.totalValueUsd = chainTotalUsd;
            }

            walletData.push({
                id: wallet.id,
                address: wallet.address,
                nickname: wallet.nickname || undefined,
                provider: wallet.provider || undefined,
                valueUsd: walletTotalUsd,
                chains: chainBalances,
            });
        } catch (error) {
            console.error(`Failed to aggregate wallet ${wallet.address}:`, error);
        }
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
            asset.exchanges = [...(asset.exchanges || []), ...exchangeAsset.exchanges];
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
    let totalInvestedUsd: number | undefined = 0;
    let totalRealizedPnL: number | undefined = 0;
    let totalUnrealizedPnL: number | undefined = 0;
    let totalPnL: number | undefined = 0;
    let totalPnLPercentage: number | undefined = 0;
    let pnlStatus: 'complete' | 'incomplete' = 'complete';
    let pnlNotice: string | undefined;

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

        totalRealizedPnL = parseFloat(pnlSummary.totalRealizedPnL.toString());
        totalUnrealizedPnL = parseFloat(pnlSummary.totalUnrealizedPnL.toString());

        // Get total PNL
        totalPnL = parseFloat(pnlSummary.totalPnL.toString());

        // Calculate PNL percentage
        if ((totalInvestedUsd ?? 0) > 0 && totalPnL !== undefined) {
            totalPnLPercentage = (totalPnL / totalInvestedUsd) * 100;
        }
        
        console.log(`💰 PNL Calculation Results:`, {
            totalInvestedUsd,
            totalRealizedPnL,
            totalUnrealizedPnL,
            totalPnL,
            totalPnLPercentage
        });
    } catch (error) {
        console.error('❌ Error calculating PNL for portfolio:', error);
        // Continue without PNL data if calculation fails
    }

    if (exchangeData.length > 0) {
        const exchangeWalletAddresses = exchangeData.map(exchange => `exchange:${exchange.id}`);
        const [placeholderExchangeTxCount, realExchangeTxCount] = await Promise.all([
            prisma.pnLTransaction.count({
                where: {
                    userId,
                    walletAddress: { in: exchangeWalletAddresses },
                    source: 'coindcx:initial_balance',
                },
            }),
            prisma.pnLTransaction.count({
                where: {
                    userId,
                    walletAddress: { in: exchangeWalletAddresses },
                    source: { not: 'coindcx:initial_balance' },
                },
            }),
        ]);

        if (placeholderExchangeTxCount > 0) {
            pnlStatus = 'incomplete';
            pnlNotice = realExchangeTxCount === 0
                ? 'CoinDCX returned live balances but no historical trade data for this account. Current value is live, but invested and P&L cannot be matched yet.'
                : 'CoinDCX trade history is only partially available for this account. Current value is live, but invested and P&L are incomplete.';

            totalInvestedUsd = undefined;
            totalRealizedPnL = undefined;
            totalUnrealizedPnL = undefined;
            totalPnL = undefined;
            totalPnLPercentage = undefined;
        }
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
        totalRealizedPnL,
        totalUnrealizedPnL,
        totalPnL,
        totalPnLPercentage,
        pnlStatus,
        pnlNotice,
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

    const referenceTimes = {
        value24hAgo: new Date(Date.now() - 24 * 60 * 60 * 1000),
        value7dAgo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        value30dAgo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };

    await Promise.all(
        assets.map(async (asset) => {
            const assetBalance = parseFloat(asset.totalBalance);
            if (!Number.isFinite(assetBalance) || assetBalance <= 0) {
                return;
            }

            try {
                const [price24h, price7d, price30d] = await Promise.all([
                    priceService.getHistoricalPrice(asset.symbol, referenceTimes.value24hAgo),
                    priceService.getHistoricalPrice(asset.symbol, referenceTimes.value7dAgo),
                    priceService.getHistoricalPrice(asset.symbol, referenceTimes.value30dAgo),
                ]);

                if (price24h) {
                    value24hAgo += assetBalance * price24h.toNumber();
                }
                if (price7d) {
                    value7dAgo += assetBalance * price7d.toNumber();
                }
                if (price30d) {
                    value30dAgo += assetBalance * price30d.toNumber();
                }
            } catch (error) {
                console.error(`Error fetching historical data for ${asset.symbol}:`, error);
            }
        })
    );

    return { value24hAgo, value7dAgo, value30dAgo };
}

/**
 * Generate and save portfolio snapshot
 */
export async function generateSnapshot(userId: string, portfolio?: PortfolioData): Promise<void> {
    const snapshotData = portfolio || await aggregatePortfolioWithOptions(userId);

    await prisma.portfolioSnapshot.create({
        data: {
            userId,
            totalValueUsd: snapshotData.totalValueUsd,
            breakdown: snapshotData as any,
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
