'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { coinGeckoApi, TokenDetails } from '@/lib/coinGeckoApi';
import { Card } from '@/components/ui/Card';
import TokenChart from '@/components/dashboard/TokenChart';

type TimeRange = '1' | '7' | '30' | '365';

export default function TokenDetailPage() {
    const router = useRouter();
    const params = useParams();
    const tokenId = params.id as string;

    const [token, setToken] = useState<TokenDetails | null>(null);
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>('7');
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const loadTokenData = async () => {
        try {
            setLoading(true);
            const [tokenData, priceData] = await Promise.all([
                coinGeckoApi.getTokenDetails(tokenId),
                coinGeckoApi.getTokenPriceHistory(tokenId, timeRange)
            ]);

            setToken(tokenData);
            setChartData(priceData);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Error loading token:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTokenData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(loadTokenData, 30000);
        return () => clearInterval(interval);
    }, [tokenId, timeRange]);

    const formatPrice = (price: number) => {
        if (price < 0.01) {
            return `$${price.toFixed(6)}`;
        } else if (price < 1) {
            return `$${price.toFixed(4)}`;
        } else {
            return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    };

    const formatLargeNumber = (num: number) => {
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        return `$${num.toLocaleString()}`;
    };

    const formatSupply = (num: number) => {
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        return num.toLocaleString();
    };

    if (loading || !token) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <div className="text-text-secondary">Loading token data...</div>
                </div>
            </div>
        );
    }

    const priceChange = token.price_change_percentage_24h;
    const isPositive = priceChange >= 0;

    return (
        <div className="min-h-screen bg-background text-text-primary pb-20">
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push('/dashboard?tab=tracking')}
                        className="p-2 rounded-[2px] bg-surface hover:bg-surface-elevated border border-border hover:border-accent transition group"
                    >
                        <svg className="w-6 h-6 text-text-secondary group-hover:text-accent transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-4 flex-1">
                        <img src={token.image} alt={token.name} className="w-12 h-12 rounded-full" />
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">{token.name}</h1>
                            <p className="text-sm text-text-secondary uppercase">{token.symbol}</p>
                        </div>
                    </div>

                    <div className="text-xs text-text-secondary">
                        Updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                </div>

                {/* Price Section */}
                <Card className="p-6 mb-6">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <div className="text-4xl font-bold text-text-primary mb-2">
                                {formatPrice(token.current_price)}
                            </div>
                            <div className={`text-lg font-medium ${isPositive ? 'text-success' : 'text-error'}`}>
                                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                                <span className="text-sm text-text-secondary ml-2">(24h)</span>
                            </div>
                        </div>

                        {/* Time Range Selector */}
                        <div className="flex gap-2">
                            {[
                                { label: '1D', value: '1' },
                                { label: '1W', value: '7' },
                                { label: '1M', value: '30' },
                                { label: '1Y', value: '365' }
                            ].map((range) => (
                                <button
                                    key={range.value}
                                    onClick={() => setTimeRange(range.value as TimeRange)}
                                    className={`px-4 py-2 rounded-[2px] text-sm font-medium transition ${timeRange === range.value
                                            ? 'bg-accent text-white'
                                            : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border'
                                        }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chart */}
                    {chartData && (
                        <TokenChart
                            data={chartData}
                            isPositive={isPositive}
                            timeRange={timeRange}
                        />
                    )}
                </Card>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card className="p-4">
                        <div className="text-sm text-text-secondary mb-1">Market Cap</div>
                        <div className="text-xl font-bold text-text-primary">{formatLargeNumber(token.market_cap)}</div>
                        <div className="text-xs text-text-secondary mt-1">Rank #{token.market_cap_rank}</div>
                    </Card>

                    <Card className="p-4">
                        <div className="text-sm text-text-secondary mb-1">24h Volume</div>
                        <div className="text-xl font-bold text-text-primary">{formatLargeNumber(token.total_volume)}</div>
                        <div className="text-xs text-text-secondary mt-1">
                            Vol/MCap: {((token.total_volume / token.market_cap) * 100).toFixed(2)}%
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="text-sm text-text-secondary mb-1">Circulating Supply</div>
                        <div className="text-xl font-bold text-text-primary">{formatSupply(token.circulating_supply)}</div>
                        <div className="text-xs text-text-secondary mt-1">{token.symbol}</div>
                    </Card>

                    <Card className="p-4">
                        <div className="text-sm text-text-secondary mb-1">Total Supply</div>
                        <div className="text-xl font-bold text-text-primary">
                            {token.total_supply ? formatSupply(token.total_supply) : 'N/A'}
                        </div>
                        <div className="text-xs text-text-secondary mt-1">{token.symbol}</div>
                    </Card>
                </div>

                {/* Price Stats */}
                <Card className="p-6 mb-6">
                    <h2 className="text-lg font-bold text-text-primary mb-4">Price Statistics</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-text-secondary">24h Low</span>
                                <span className="text-text-primary font-medium">{formatPrice(token.low_24h)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-text-secondary">24h High</span>
                                <span className="text-text-primary font-medium">{formatPrice(token.high_24h)}</span>
                            </div>
                            <div className="h-2 bg-surface-elevated rounded-[2px] overflow-hidden border border-border">
                                <div
                                    className="h-full bg-accent"
                                    style={{
                                        width: `${((token.current_price - token.low_24h) / (token.high_24h - token.low_24h)) * 100}%`
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-text-secondary">All-Time High</span>
                                <span className="text-text-primary font-medium">{formatPrice(token.ath)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-text-secondary">From ATH</span>
                                <span className="text-error font-medium">
                                    {token.ath_change_percentage.toFixed(2)}%
                                </span>
                            </div>
                            <div className="text-xs text-text-secondary">
                                {new Date(token.ath_date).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Auto-refresh indicator */}
                <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    Auto-refreshing every 30 seconds
                </div>
            </div>
        </div>
    );
}
