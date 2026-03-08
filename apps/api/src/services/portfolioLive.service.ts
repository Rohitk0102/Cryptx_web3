import crypto from 'crypto';
import prisma from '../utils/prisma';
import redisClient from '../utils/redis';
import { decryptCredential } from '../utils/exchangeEncryption';
import { ExchangeService } from './exchange.service';
import {
    AggregatePortfolioOptions,
    aggregatePortfolioWithOptions,
    PortfolioData,
} from './portfolio.service';

const socketIoClient = require('socket.io-client');

type RealtimeSocket = any;

type PortfolioLiveListener = (event: {
    portfolio: PortfolioData;
    reason: string;
}) => void;

interface CoinDCXAccountSocketState {
    accountId: string;
    userId: string;
    socket: RealtimeSocket;
}

interface CoinDCXBalanceUpdate {
    currency_short_name?: string;
    balance?: string | number;
    locked_balance?: string | number;
}

const STREAM_URL = 'wss://stream.coindcx.com';
const PRIVATE_CHANNEL = 'coindcx';
const PUBLIC_PRICE_CHANNEL = 'currentPrices@spot@10s';
const PUBLIC_STATS_CHANNEL = 'priceStats@spot@60s';
const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'PYUSD', 'DAI', 'TUSD', 'USDP']);

class PortfolioLiveService {
    private readonly exchangeService = new ExchangeService();
    private readonly listeners = new Map<string, Set<PortfolioLiveListener>>();
    private readonly accountSockets = new Map<string, CoinDCXAccountSocketState>();
    private readonly accountRefreshTimers = new Map<string, NodeJS.Timeout>();
    private readonly userRefreshTimers = new Map<string, NodeJS.Timeout>();
    private readonly publicPrices = new Map<string, number>();
    private readonly publicPriceChanges = new Map<string, number>();
    private publicSocket: RealtimeSocket | null = null;
    private reconcileTimer: NodeJS.Timeout | null = null;
    private started = false;

    subscribe(userId: string, listener: PortfolioLiveListener): () => void {
        this.start();

        if (!this.listeners.has(userId)) {
            this.listeners.set(userId, new Set());
        }

        this.listeners.get(userId)!.add(listener);
        void this.reconcilePrivateSockets();
        void this.emitPortfolio(userId, 'initial');

        return () => {
            const userListeners = this.listeners.get(userId);
            if (!userListeners) {
                return;
            }

            userListeners.delete(listener);
            if (userListeners.size === 0) {
                this.listeners.delete(userId);
            }
        };
    }

    start(): void {
        if (this.started) {
            return;
        }

        this.started = true;
        this.ensurePublicSocket();
        void this.reconcilePrivateSockets();
        this.reconcileTimer = setInterval(() => {
            void this.reconcilePrivateSockets();
        }, 60000);
    }

    stop(): void {
        this.reconcileTimer && clearInterval(this.reconcileTimer);
        this.reconcileTimer = null;

        for (const timer of this.accountRefreshTimers.values()) {
            clearTimeout(timer);
        }
        this.accountRefreshTimers.clear();

        for (const timer of this.userRefreshTimers.values()) {
            clearTimeout(timer);
        }
        this.userRefreshTimers.clear();

        for (const state of this.accountSockets.values()) {
            state.socket.disconnect();
        }
        this.accountSockets.clear();

        if (this.publicSocket) {
            this.publicSocket.disconnect();
            this.publicSocket = null;
        }

        this.started = false;
    }

    private async emitPortfolio(userId: string, reason: string): Promise<void> {
        const userListeners = this.listeners.get(userId);
        if (!userListeners || userListeners.size === 0) {
            return;
        }

        try {
            const portfolio = await aggregatePortfolioWithOptions(
                userId,
                this.getAggregateOptions()
            );

            for (const listener of userListeners) {
                listener({ portfolio, reason });
            }
        } catch (error) {
            console.error(`❌ Failed to emit live portfolio for user ${userId}:`, error);
        }
    }

    private scheduleUserRefresh(userId: string, reason: string, delayMs = 1250): void {
        if (!this.listeners.has(userId)) {
            return;
        }

        const existingTimer = this.userRefreshTimers.get(userId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            this.userRefreshTimers.delete(userId);
            void this.emitPortfolio(userId, reason);
        }, delayMs);

        this.userRefreshTimers.set(userId, timer);
    }

    private scheduleAccountSync(accountId: string, userId: string, reason: string): void {
        const existingTimer = this.accountRefreshTimers.get(accountId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.accountRefreshTimers.delete(accountId);

            try {
                await this.exchangeService.syncBalances(accountId);
            } catch (error) {
                console.error(`❌ Realtime balance sync failed for account ${accountId}:`, error);
            }

            try {
                await this.exchangeService.syncTradeHistory(accountId, {
                    limit: 100,
                    maxBatches: 1,
                });
            } catch (error) {
                console.error(`❌ Realtime trade sync failed for account ${accountId}:`, error);
            }

            this.scheduleUserRefresh(userId, reason, 250);
        }, 1500);

        this.accountRefreshTimers.set(accountId, timer);
    }

    private getAggregateOptions(): AggregatePortfolioOptions {
        const exchangePriceUsdBySymbol: Record<string, number> = {};

        const uniqueSymbols = new Set<string>([
            'INR',
            'BTC',
            'ETH',
            'USDT',
            'USDC',
        ]);

        for (const marketSymbol of this.publicPrices.keys()) {
            const match = marketSymbol.match(/^([A-Z0-9]+?)(USDT|USDC|INR|BTC|ETH)$/);
            if (match) {
                uniqueSymbols.add(match[1]);
            }
        }

        for (const symbol of uniqueSymbols) {
            const priceUsd = this.resolveUsdPrice(symbol);
            if (priceUsd !== undefined && Number.isFinite(priceUsd) && priceUsd > 0) {
                exchangePriceUsdBySymbol[symbol] = priceUsd;
            }
        }

        return { exchangePriceUsdBySymbol };
    }

    private resolveUsdPrice(symbol: string): number | undefined {
        const normalizedSymbol = symbol.toUpperCase();

        if (STABLECOINS.has(normalizedSymbol)) {
            return 1;
        }

        if (normalizedSymbol === 'INR') {
            const usdtInr = this.publicPrices.get('USDTINR');
            return usdtInr ? 1 / usdtInr : undefined;
        }

        const directUsdPair =
            this.publicPrices.get(`${normalizedSymbol}USDT`) ??
            this.publicPrices.get(`${normalizedSymbol}USDC`);
        if (directUsdPair) {
            return directUsdPair;
        }

        const usdtInr = this.publicPrices.get('USDTINR');
        const inrPair = this.publicPrices.get(`${normalizedSymbol}INR`);
        if (inrPair && usdtInr) {
            return inrPair / usdtInr;
        }

        const btcPair = this.publicPrices.get(`${normalizedSymbol}BTC`);
        const btcUsd = this.publicPrices.get('BTCUSDT');
        if (btcPair && btcUsd) {
            return btcPair * btcUsd;
        }

        const ethPair = this.publicPrices.get(`${normalizedSymbol}ETH`);
        const ethUsd = this.publicPrices.get('ETHUSDT');
        if (ethPair && ethUsd) {
            return ethPair * ethUsd;
        }

        return undefined;
    }

    private ensurePublicSocket(): void {
        if (this.publicSocket) {
            return;
        }

        const socket = socketIoClient(STREAM_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
        });

        socket.on('connect', () => {
            console.log('📡 Connected to CoinDCX public socket');
            socket.emit('join', {
                channelName: PUBLIC_PRICE_CHANNEL,
            });
            socket.emit('join', {
                channelName: PUBLIC_STATS_CHANNEL,
            });
        });

        socket.on(PUBLIC_PRICE_CHANNEL, (response: { data?: Record<string, string | number> }) => {
            const prices = response?.data || {};
            let changed = false;

            for (const [symbol, rawPrice] of Object.entries(prices)) {
                const price = Number(rawPrice);
                if (!Number.isFinite(price) || price <= 0) {
                    continue;
                }

                if (this.publicPrices.get(symbol) !== price) {
                    changed = true;
                }

                this.publicPrices.set(symbol, price);
            }

            if (changed) {
                for (const userId of this.listeners.keys()) {
                    this.scheduleUserRefresh(userId, 'market-price-update', 500);
                }
            }
        });

        socket.on(PUBLIC_STATS_CHANNEL, (response: { data?: Record<string, { change_24_hour?: string | number }> }) => {
            const stats = response?.data || {};
            for (const [symbol, payload] of Object.entries(stats)) {
                const change = Number(payload?.change_24_hour);
                if (Number.isFinite(change)) {
                    this.publicPriceChanges.set(symbol, change);
                }
            }
        });

        socket.on('disconnect', (reason: string) => {
            console.warn(`⚠️ CoinDCX public socket disconnected: ${reason}`);
        });

        socket.on('connect_error', (error: Error) => {
            console.error('❌ CoinDCX public socket connection error:', error.message);
        });

        this.publicSocket = socket;
    }

    private async reconcilePrivateSockets(): Promise<void> {
        const activeAccounts = await prisma.exchangeAccount.findMany({
            where: {
                isActive: true,
                provider: 'coindcx',
            },
            select: {
                id: true,
                userId: true,
                apiKey: true,
                apiSecret: true,
            },
        });

        const activeAccountIds = new Set(activeAccounts.map((account) => account.id));

        for (const existingAccountId of this.accountSockets.keys()) {
            if (!activeAccountIds.has(existingAccountId)) {
                const state = this.accountSockets.get(existingAccountId);
                state?.socket.disconnect();
                this.accountSockets.delete(existingAccountId);
            }
        }

        for (const account of activeAccounts) {
            if (this.accountSockets.has(account.id)) {
                continue;
            }

            try {
                this.connectPrivateSocket({
                    accountId: account.id,
                    userId: account.userId,
                    apiKey: decryptCredential(account.apiKey),
                    apiSecret: decryptCredential(account.apiSecret),
                });
            } catch (error) {
                console.error(`❌ Failed to connect CoinDCX realtime socket for account ${account.id}:`, error);
            }
        }
    }

    private connectPrivateSocket(account: {
        accountId: string;
        userId: string;
        apiKey: string;
        apiSecret: string;
    }): void {
        const socket = socketIoClient(STREAM_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
        });

        socket.on('connect', () => {
            console.log(`📡 Connected to CoinDCX private socket for account ${account.accountId}`);
            const channelPayload = {
                channel: PRIVATE_CHANNEL,
            };
            const channelJson = JSON.stringify(channelPayload);
            const authSignature = crypto
                .createHmac('sha256', account.apiSecret)
                .update(channelJson)
                .digest('hex');

            socket.emit('join', {
                ...channelPayload,
                authSignature,
                apiKey: account.apiKey,
            });
        });

        socket.on('balance-update', (response: { data?: CoinDCXBalanceUpdate[] }) => {
            void this.handleBalanceUpdate(account.accountId, account.userId, response?.data);
        });

        socket.on('order-update', () => {
            this.scheduleAccountSync(account.accountId, account.userId, 'order-update');
        });

        socket.on('trade-update', () => {
            this.scheduleAccountSync(account.accountId, account.userId, 'trade-update');
        });

        socket.on('disconnect', (reason: string) => {
            console.warn(`⚠️ CoinDCX private socket disconnected for ${account.accountId}: ${reason}`);
        });

        socket.on('connect_error', (error: Error) => {
            console.error(`❌ CoinDCX private socket connection error for ${account.accountId}:`, error.message);
        });

        this.accountSockets.set(account.accountId, {
            accountId: account.accountId,
            userId: account.userId,
            socket,
        });
    }

    private async handleBalanceUpdate(
        accountId: string,
        userId: string,
        updates?: CoinDCXBalanceUpdate[]
    ): Promise<void> {
        if (!Array.isArray(updates) || updates.length === 0) {
            this.scheduleAccountSync(accountId, userId, 'balance-update');
            return;
        }

        await Promise.all(
            updates.map(async (update) => {
                const symbol = update.currency_short_name?.toUpperCase();
                if (!symbol) {
                    return;
                }

                const availableBalance = Number(update.balance || 0);
                const lockedBalance = Number(update.locked_balance || 0);
                const totalBalance = availableBalance + lockedBalance;

                if (!Number.isFinite(totalBalance)) {
                    return;
                }

                await prisma.exchangeBalance.upsert({
                    where: {
                        exchangeAccountId_symbol: {
                            exchangeAccountId: accountId,
                            symbol,
                        },
                    },
                    create: {
                        exchangeAccountId: accountId,
                        symbol,
                        balance: totalBalance.toString(),
                        lockedBalance: lockedBalance.toString(),
                        availableBalance: availableBalance.toString(),
                        lastUpdated: new Date(),
                    },
                    update: {
                        balance: totalBalance.toString(),
                        lockedBalance: lockedBalance.toString(),
                        availableBalance: availableBalance.toString(),
                        lastUpdated: new Date(),
                    },
                });
            })
        );

        await prisma.exchangeAccount.update({
            where: { id: accountId },
            data: { lastSyncedAt: new Date() },
        });

        await Promise.all([
            redisClient.del(`exchange:balances:${accountId}`),
            redisClient.del(`exchange:user:${userId}`),
        ]);

        this.scheduleUserRefresh(userId, 'balance-update', 250);
    }
}

export const portfolioLiveService = new PortfolioLiveService();
