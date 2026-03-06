'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { coinGeckoApi, TokenPrice, POPULAR_TOKENS } from '@/lib/coinGeckoApi';
import { Card } from '@/components/ui/Card';
import { formatUSDAsINR, usdToInr } from '@/lib/currency';

interface TokenWithBalance extends TokenPrice {
    balance?: number;
    valueUsd?: number;
}

// Cache for token data
let tokenCache: { data: TokenWithBalance[]; timestamp: number } | null = null;
const CACHE_DURATION = 30000; // 30 seconds

export default function RealTimeTracking() {
    const router = useRouter();
    const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [filter, setFilter] = useState<'all' | 'gainers' | 'losers'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const loadTokens = useCallback(async (force = false) => {
        try {
            // Check cache first
            if (!force && tokenCache && Date.now() - tokenCache.timestamp < CACHE_DURATION) {
                setTokens(tokenCache.data);
                setLastUpdate(new Date(tokenCache.timestamp));
                setLoading(false);
                return;
            }

            const data = await coinGeckoApi.getPopularTokens();
            const now = Date.now();
            tokenCache = { data, timestamp: now };
            setTokens(data);
            setLastUpdate(new Date(now));
        } catch (error) {
            console.error('Error loading tokens:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTokens();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => loadTokens(true), 30000);
        return () => clearInterval(interval);
    }, [loadTokens]);

    const filteredTokens = useMemo(() => {
        return tokens.filter(token => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!token.name.toLowerCase().includes(query) &&
                    !token.symbol.toLowerCase().includes(query)) {
                    return false;
                }
            }

            // Price change filter
            if (filter === 'gainers') {
                return token.price_change_percentage_24h > 0;
            } else if (filter === 'losers') {
                return token.price_change_percentage_24h < 0;
            }

            return true;
        });
    }, [tokens, searchQuery, filter]);

    const formatPrice = useCallback((price: number) => {
        const inrPrice = usdToInr(price);
        if (inrPrice < 1) {
            return `₹${inrPrice.toFixed(6)}`;
        } else if (inrPrice < 100) {
            return `₹${inrPrice.toFixed(4)}`;
        } else {
            return `₹${inrPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }, []);

    const formatPercentage = useCallback((percentage: number) => {
        const sign = percentage >= 0 ? '+' : '';
        return `${sign}${percentage.toFixed(2)}%`;
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <div className="text-text-secondary">Loading live token data...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary mb-1">Real-Time Token Tracking</h2>
                    <p className="text-sm text-text-secondary">
                        Live prices • Updated {lastUpdate.toLocaleTimeString()}
                    </p>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Search tokens..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 pl-10 bg-surface border border-border rounded-[2px] text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">🔍</span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-[2px] text-sm font-medium transition ${filter === 'all'
                            ? 'bg-accent text-white'
                            : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border'
                        }`}
                >
                    All Tokens
                </button>
                <button
                    onClick={() => setFilter('gainers')}
                    className={`px-4 py-2 rounded-[2px] text-sm font-medium transition ${filter === 'gainers'
                            ? 'bg-success text-white border border-success'
                            : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border'
                        }`}
                >
                    Gainers
                </button>
                <button
                    onClick={() => setFilter('losers')}
                    className={`px-4 py-2 rounded-[2px] text-sm font-medium transition ${filter === 'losers'
                            ? 'bg-error text-white border border-error'
                            : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border'
                        }`}
                >
                    Losers
                </button>
            </div>

            {/* Tokens Grid */}
            <div className="grid gap-4">
                {filteredTokens.map((token) => (
                    <TokenCard
                        key={token.id}
                        token={token}
                        formatPrice={formatPrice}
                        formatPercentage={formatPercentage}
                        onClick={() => router.push(`/dashboard/token/${token.id}`)}
                    />
                ))}

                {filteredTokens.length === 0 && (
                    <div className="text-center py-12 text-text-secondary">
                        No tokens found matching your search.
                    </div>
                )}
            </div>

            {/* Auto-refresh indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Auto-refreshing every 30 seconds
            </div>
        </div>
    );
}

// Memoized Token Card Component
const TokenCard = React.memo(({ token, formatPrice, formatPercentage, onClick }: any) => (
    <Card
        hover={true}
        onClick={onClick}
        className="p-4 cursor-pointer group"
    >
        <div className="flex items-center justify-between">
            {/* Token Info */}
            <div className="flex items-center gap-4 flex-1">
                <img
                    src={token.image}
                    alt={token.name}
                    className="w-10 h-10 rounded-full"
                    loading="lazy"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text-primary group-hover:text-accent transition">
                            {token.name}
                        </h3>
                        <span className="text-xs text-text-secondary font-mono uppercase">
                            {token.symbol}
                        </span>
                    </div>
                    <div className="text-sm text-text-secondary mt-0.5">
                        Market Cap: ₹{(usdToInr(token.market_cap) / 1e9).toFixed(2)}B
                    </div>
                </div>
            </div>

            {/* Price Info */}
            <div className="text-right">
                <div className="text-xl font-bold text-text-primary mb-1">
                    {formatPrice(token.current_price)}
                </div>
                <div className="flex items-center gap-3">
                    <div
                        className={`text-sm font-medium ${token.price_change_percentage_24h >= 0
                                ? 'text-success'
                                : 'text-error'
                            }`}
                    >
                        {formatPercentage(token.price_change_percentage_24h)}
                    </div>
                    {token.price_change_percentage_7d !== undefined && (
                        <div className="text-xs text-text-secondary">
                            7d: {formatPercentage(token.price_change_percentage_7d)}
                        </div>
                    )}
                </div>
            </div>

            {/* Sparkline */}
            {token.sparkline_in_7d && (
                <div className="ml-6 hidden lg:block">
                    <MiniSparkline
                        data={token.sparkline_in_7d.price}
                        isPositive={token.price_change_percentage_7d >= 0}
                    />
                </div>
            )}
        </div>
    </Card>
));

TokenCard.displayName = 'TokenCard';

// Required React import for memo
import React from 'react';

// Mini sparkline component
function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
    const width = 100;
    const height = 40;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="opacity-70">
            <polyline
                points={points}
                fill="none"
                stroke={isPositive ? '#2E7D32' : '#DC143C'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
