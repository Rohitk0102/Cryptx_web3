import { CoinDCXTickerEntry, CoinDCXTrade } from './coindcxClient';

export interface CoinDCXHoldingSnapshot {
    currency: string;
    balance: number;
    locked_balance: number;
    available_balance: number;
    price_inr: number | null;
    value_inr: number | null;
}

export interface CoinDCXPortfolioMetrics {
    current_portfolio_value: number;
    total_invested: number;
    unrealized_pnl: number;
    pnl_percentage: number;
}

const STABLE_INR_QUOTES = new Set(['INR']);
const STABLE_USD_QUOTES = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'PYUSD', 'DAI', 'TUSD', 'USDP']);

function roundTo(value: number, precision = 2): number {
    return Number(value.toFixed(precision));
}

export function buildTickerPriceMap(ticker: CoinDCXTickerEntry[]): Record<string, number> {
    return ticker.reduce<Record<string, number>>((acc, entry) => {
        const price = Number(entry.last_price);
        if (entry.market && Number.isFinite(price) && price > 0) {
            acc[entry.market.toUpperCase()] = price;
        }

        return acc;
    }, {});
}

export function resolvePriceInInr(
    currency: string,
    priceMap: Record<string, number>
): number | null {
    const symbol = currency.toUpperCase();

    if (STABLE_INR_QUOTES.has(symbol)) {
        return 1;
    }

    const directInr = priceMap[`${symbol}INR`];
    if (directInr) {
        return directInr;
    }

    if (STABLE_USD_QUOTES.has(symbol)) {
        return priceMap[`${symbol}INR`] || priceMap.USDTINR || null;
    }

    const usdtInr = priceMap.USDTINR;
    const usdcInr = priceMap.USDCINR || usdtInr;
    const btcInr = priceMap.BTCINR;
    const ethInr = priceMap.ETHINR;

    if (priceMap[`${symbol}USDT`] && usdtInr) {
        return priceMap[`${symbol}USDT`] * usdtInr;
    }

    if (priceMap[`${symbol}USDC`] && usdcInr) {
        return priceMap[`${symbol}USDC`] * usdcInr;
    }

    if (priceMap[`${symbol}BTC`] && btcInr) {
        return priceMap[`${symbol}BTC`] * btcInr;
    }

    if (priceMap[`${symbol}ETH`] && ethInr) {
        return priceMap[`${symbol}ETH`] * ethInr;
    }

    return null;
}

export function buildHoldingSnapshots(
    balances: Array<{
        currency: string;
        balance: number;
        locked_balance: number;
    }>,
    priceMap: Record<string, number>
): CoinDCXHoldingSnapshot[] {
    return balances.map((balance) => {
        const totalBalance = Number(balance.balance);
        const lockedBalance = Number(balance.locked_balance);
        const availableBalance = totalBalance - lockedBalance;
        const priceInr = resolvePriceInInr(balance.currency, priceMap);
        const valueInr = priceInr !== null ? totalBalance * priceInr : null;

        return {
            currency: balance.currency.toUpperCase(),
            balance: roundTo(totalBalance, 8),
            locked_balance: roundTo(lockedBalance, 8),
            available_balance: roundTo(availableBalance, 8),
            price_inr: priceInr !== null ? roundTo(priceInr, 8) : null,
            value_inr: valueInr !== null ? roundTo(valueInr, 2) : null,
        };
    });
}

export function calculatePortfolioMetrics(
    holdings: CoinDCXHoldingSnapshot[],
    trades: CoinDCXTrade[]
): CoinDCXPortfolioMetrics {
    const currentPortfolioValue = holdings.reduce((sum, holding) => {
        return sum + (holding.value_inr || 0);
    }, 0);

    const totalInvested = trades.reduce((sum, trade) => {
        if (trade.side !== 'buy') {
            return sum;
        }

        return sum + Number(trade.quantity) * Number(trade.price);
    }, 0);

    const unrealizedPnL = currentPortfolioValue - totalInvested;
    const pnlPercentage = totalInvested > 0
        ? (unrealizedPnL / totalInvested) * 100
        : 0;

    return {
        current_portfolio_value: roundTo(currentPortfolioValue, 2),
        total_invested: roundTo(totalInvested, 2),
        unrealized_pnl: roundTo(unrealizedPnL, 2),
        pnl_percentage: roundTo(pnlPercentage, 2),
    };
}
