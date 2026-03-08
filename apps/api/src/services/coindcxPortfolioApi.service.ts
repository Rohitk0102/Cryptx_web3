import { CoinDCXBalance, CoinDCXTrade } from './coindcxClient';
import { createCoinDCXEnvClient } from './coindcxEnv.service';
import {
    buildHoldingSnapshots,
    buildTickerPriceMap,
    calculatePortfolioMetrics,
} from './coindcxPortfolioCalculator';

export interface CoinDCXTradeHistoryQuery {
    from_timestamp?: number;
    to_timestamp?: number;
    symbol?: string;
    limit?: number;
    page?: number;
    sort?: 'asc' | 'desc';
}

export class CoinDCXPortfolioApiService {
    private readonly MAX_LIMIT = 5000;

    private getClient() {
        return createCoinDCXEnvClient();
    }

    async getLivePrices(): Promise<Record<string, number>> {
        const client = this.getClient();
        const ticker = await client.getTicker();
        return buildTickerPriceMap(ticker);
    }

    async getBalances() {
        const client = this.getClient();
        const [balances, priceMap] = await Promise.all([
            client.getBalances(),
            this.getLivePrices(),
        ]);

        const nonZeroBalances = balances.filter((balance: CoinDCXBalance) => {
            return balance.balance > 0 || balance.locked_balance > 0;
        });
        const holdings = buildHoldingSnapshots(nonZeroBalances, priceMap);

        return {
            holdings,
            prices: priceMap,
            fetched_at: new Date().toISOString(),
        };
    }

    async getTrades(query: CoinDCXTradeHistoryQuery) {
        const client = this.getClient();
        const limit = this.normalizeLimit(query.limit);
        const page = this.normalizePage(query.page);
        const offset = (page - 1) * limit;

        if (offset >= this.MAX_LIMIT) {
            throw new Error(`Page ${page} with limit ${limit} exceeds CoinDCX trade history window of ${this.MAX_LIMIT} records`);
        }

        const fetchLimit = Math.min(offset + limit + 1, this.MAX_LIMIT);
        const trades = await client.getTradeHistory({
            symbol: query.symbol,
            limit: fetchLimit,
            sort: query.sort || 'desc',
            fromTimestamp: query.from_timestamp,
            toTimestamp: query.to_timestamp,
        });

        const pageSlice = trades.slice(offset, offset + limit);
        const hasMore = trades.length > offset + limit;

        return {
            trades: pageSlice.map((trade) => this.mapTrade(trade)),
            pagination: {
                page,
                limit,
                has_more: hasMore,
                returned: pageSlice.length,
            },
            filters: {
                from_timestamp: query.from_timestamp ?? null,
                to_timestamp: query.to_timestamp ?? null,
                symbol: query.symbol ?? null,
                sort: query.sort || 'desc',
            },
        };
    }

    async getPortfolioSummary() {
        const [balancesResponse, trades] = await Promise.all([
            this.getBalances(),
            this.getAllTrades(),
        ]);

        const metrics = calculatePortfolioMetrics(
            balancesResponse.holdings,
            trades
        );

        return {
            ...metrics,
            holdings_count: balancesResponse.holdings.length,
            trade_count: trades.length,
            fetched_at: new Date().toISOString(),
        };
    }

    private async getAllTrades(): Promise<CoinDCXTrade[]> {
        const client = this.getClient();
        const allTrades: CoinDCXTrade[] = [];
        let fromId: number | undefined;

        while (true) {
            const batch = await client.getTradeHistory({
                limit: this.MAX_LIMIT,
                sort: 'asc',
                fromId,
            });

            if (batch.length === 0) {
                break;
            }

            allTrades.push(...batch);

            if (batch.length < this.MAX_LIMIT) {
                break;
            }

            const lastTradeId = Number(batch[batch.length - 1]?.id);
            if (!Number.isFinite(lastTradeId)) {
                break;
            }

            if (fromId !== undefined && lastTradeId === fromId) {
                break;
            }

            fromId = lastTradeId;
        }

        return allTrades;
    }

    private normalizeLimit(limit?: number): number {
        if (!limit || Number.isNaN(limit)) {
            return 100;
        }

        return Math.max(1, Math.min(Math.floor(limit), this.MAX_LIMIT));
    }

    private normalizePage(page?: number): number {
        if (!page || Number.isNaN(page)) {
            return 1;
        }

        return Math.max(1, Math.floor(page));
    }

    private mapTrade(trade: CoinDCXTrade) {
        return {
            symbol: trade.symbol,
            side: trade.side,
            quantity: Number(trade.quantity),
            price: Number(trade.price),
            fee: Number(trade.fee_amount),
            timestamp: trade.timestamp,
        };
    }
}
