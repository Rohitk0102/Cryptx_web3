'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { coinGeckoApi, TokenPrice } from '@/lib/coinGeckoApi';
import { Card } from '@/components/ui/Card';
import { usdToInr } from '@/lib/currency';

interface TokenWithBalance extends TokenPrice {
    balance?: number;
    valueUsd?: number;
}

type TrackingFilter = 'all' | 'gainers' | 'losers';

interface TokenCardProps {
    token: TokenWithBalance;
    formatPrice: (price: number) => string;
    formatPercentage: (percentage: number) => string;
    onClick: () => void;
}

const DEFAULT_TOKEN_LIMIT = 50;

function get24hChange(token: TokenWithBalance): number {
    return Number.isFinite(token.price_change_percentage_24h)
        ? token.price_change_percentage_24h
        : 0;
}

function get7dChange(token: TokenWithBalance): number {
    return Number.isFinite(token.price_change_percentage_7d)
        ? token.price_change_percentage_7d
        : 0;
}

// Cache for token data
let tokenCache: { data: TokenWithBalance[]; timestamp: number } | null = null;
const CACHE_DURATION = 30000; // 30 seconds

export default function RealTimeTracking() {
    const router = useRouter();
    const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [filter, setFilter] = useState<TrackingFilter>('all');
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

            const data = await coinGeckoApi.getPopularTokens(DEFAULT_TOKEN_LIMIT);
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
        const filtered = tokens.filter((token) => {
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
                return get24hChange(token) > 0;
            } else if (filter === 'losers') {
                return get24hChange(token) < 0;
            }

            return true;
        });

        if (filter === 'gainers') {
            return filtered.sort((a, b) => get24hChange(b) - get24hChange(a));
        }

        if (filter === 'losers') {
            return filtered.sort((a, b) => get24hChange(a) - get24hChange(b));
        }

        return filtered.sort((a, b) => {
            const marketCapRankA = a.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
            const marketCapRankB = b.market_cap_rank ?? Number.MAX_SAFE_INTEGER;

            if (marketCapRankA !== marketCapRankB) {
                return marketCapRankA - marketCapRankB;
            }

            return b.market_cap - a.market_cap;
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
                        Top {tokens.length} market-cap tokens • Updated {lastUpdate.toLocaleTimeString()}
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
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-[2px] text-sm font-medium transition ${filter === 'all'
                            ? 'border border-[#00FFB2]/35 bg-[#00FFB2]/12 text-[#D8FFF2] shadow-[0_0_16px_rgba(0,255,178,0.08)]'
                            : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border'
                        }`}
                >
                    All Tokens
                </button>
                <button
                    onClick={() => setFilter('gainers')}
                    className={`px-4 py-2 rounded-[2px] text-sm font-medium transition ${filter === 'gainers'
                            ? 'border border-[#00FFB2]/35 bg-[#00FFB2]/12 text-[#D8FFF2] shadow-[0_0_16px_rgba(0,255,178,0.08)]'
                            : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border'
                        }`}
                >
                    Gainers
                </button>
                <button
                    onClick={() => setFilter('losers')}
                    className={`px-4 py-2 rounded-[2px] text-sm font-medium transition ${filter === 'losers'
                            ? 'border border-[#FF4C4C]/35 bg-[#FF4C4C]/12 text-[#FFB2B2] shadow-[0_0_16px_rgba(255,76,76,0.08)]'
                            : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border'
                        }`}
                >
                    Losers
                </button>

                <div className="ml-auto text-xs text-text-secondary">
                    Showing {filteredTokens.length} token{filteredTokens.length === 1 ? '' : 's'}
                </div>
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
                        {filter === 'gainers'
                            ? 'No gainers found for the current search.'
                            : filter === 'losers'
                                ? 'No losers found for the current search.'
                                : 'No tokens found matching your search.'}
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
const TokenCard = memo(function TokenCard({
    token,
    formatPrice,
    formatPercentage,
    onClick,
}: TokenCardProps) {
    const change24h = get24hChange(token);
    const change7d = get7dChange(token);

    return (
    <Card
        hover={true}
        onClick={onClick}
        className="p-4 cursor-pointer group"
    >
        <div className="flex items-center justify-between">
            {/* Token Info */}
            <div className="flex items-center gap-4 flex-1">
                <Image
                    src={token.image || '/globe.svg'}
                    alt={token.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full"
                    unoptimized
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
                        className={`text-sm font-medium ${change24h >= 0
                                ? 'text-success'
                                : 'text-error'
                            }`}
                    >
                        {formatPercentage(change24h)}
                    </div>
                    {Number.isFinite(change7d) && (
                        <div className="text-xs text-text-secondary">
                            7d: {formatPercentage(change7d)}
                        </div>
                    )}
                </div>
            </div>

            {/* Sparkline */}
            {token.sparkline_in_7d && (
                <div className="ml-6 hidden lg:block">
                    <MiniSparkline
                        data={token.sparkline_in_7d.price}
                        isPositive={change7d >= 0}
                    />
                </div>
            )}
        </div>
    </Card>
    );
});

TokenCard.displayName = 'TokenCard';

// Mini sparkline component
function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
    const width = 100;
    const height = 40;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

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
