'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { portfolioApi, walletApi, PortfolioResponse } from '@/lib/portfolioApi';
import { syncTransactions } from '@/lib/pnlApi';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PortfolioValueChart } from '@/components/charts/PortfolioValueChart';
import { AssetAllocationPie } from '@/components/charts/AssetAllocationPie';
import RealTimeTracking from '@/components/dashboard/RealTimeTracking';
import AddWalletModal from '@/components/wallet/AddWalletModal';
import WalletList from '@/components/wallet/WalletList';
import ExchangeAccountList from '@/components/exchange/ExchangeAccountList';
import { formatUSDAsINR } from '@/lib/currency';
import { WALLET_DATA_CHANGED_EVENT, notifyWalletsChanged } from '@/lib/walletEvents';

type TabType = 'portfolio' | 'tracking';

let portfolioCache: { data: PortfolioResponse; timestamp: number } | null = null;
const CACHE_DURATION = 30000;

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const createDefaultHistoryRange = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);

    return {
        from: toDateInputValue(from),
        to: toDateInputValue(to),
    };
};

const formatHistoryRangeLabel = (from: string, to: string) => {
    const fromLabel = new Date(from).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const toLabel = new Date(to).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return `${fromLabel} to ${toLabel}`;
};

// ─── Skeleton Components ────────────────────────────────────────────────────
const HeroCardSkeleton = () => (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.06] via-transparent to-white/[0.06] animate-shimmer" />
        <div className="space-y-4">
            <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-12 w-64 bg-white/[0.06] rounded animate-pulse" />
            <div className="flex gap-4">
                <div className="h-6 w-24 bg-white/[0.06] rounded animate-pulse" />
                <div className="h-6 w-32 bg-white/[0.06] rounded animate-pulse" />
            </div>
        </div>
    </div>
);

const AssetRowSkeleton = () => (
    <div className="flex items-center gap-4 p-4 border-b border-white/5 last:border-b-0">
        <div className="w-10 h-10 bg-white/[0.06] rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
            <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
        </div>
        <div className="space-y-2">
            <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-3 w-12 bg-white/[0.06] rounded animate-pulse" />
        </div>
    </div>
);
// ─── StatCard Components ────────────────────────────────────────────────────
interface StatCardProps {
    variant: 'hero' | 'asset';
    value?: string | number;
    change?: number;
    lastUpdated?: Date;
    children?: React.ReactNode;
}

const StatCard = ({ variant, value, change, lastUpdated, children }: StatCardProps) => {
    const [secondsAgo, setSecondsAgo] = useState(0);

    useEffect(() => {
        if (!lastUpdated) return;
        const interval = setInterval(() => {
            setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [lastUpdated]);

    if (variant === 'hero') {
        return (
            <div className="relative overflow-hidden rounded-2xl p-px shadow-[0_0_30px_rgba(0,255,178,0.08)]">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[-140%] will-change-transform motion-safe:animate-[spin_4.8s_linear_infinite] motion-reduce:animate-none"
                    style={{
                        background:
                            'conic-gradient(from 0deg, rgba(0,255,178,0) 0deg, rgba(0,255,178,0.12) 110deg, rgba(0,255,178,0.92) 180deg, rgba(0,255,178,0.28) 235deg, rgba(0,255,178,0) 320deg)',
                    }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(0,255,178,0.18),transparent_62%)] opacity-80" />

                <div className="relative overflow-hidden rounded-[15px] bg-[#0A0A0F] p-8">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-radial from-[#00FFB2]/5 via-transparent to-transparent animate-pulse" />
                    
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-[#D5D5D5]/60 uppercase tracking-wider">
                                Total Portfolio Value
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs bg-white/5 px-3 py-1 rounded-full text-[#D5D5D5]/50">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00FFB2] animate-pulse" />
                                Live
                            </div>
                        </div>
                        
                        <div className="text-5xl font-bold text-[#F5F5F5] tracking-tight">
                            {value || '—'}
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {change !== undefined && (
                                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                                    change >= 0 
                                        ? 'bg-[#00FFB2]/20 text-[#00FFB2]' 
                                        : 'bg-[#FF4C4C]/20 text-[#FF4C4C]'
                                }`}>
                                    {change >= 0 ? '▲' : '▼'}
                                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                                </div>
                            )}
                            {lastUpdated && (
                                <div className="text-xs text-[#D5D5D5]/40">
                                    Last updated {secondsAgo}s ago
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            {children}
        </div>
    );
};
export default function PortfolioPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabParam = searchParams.get('tab') as TabType | null;
    const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'portfolio');
    const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState('');
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const [nextRefreshIn, setNextRefreshIn] = useState<number>(30);
    const [historicalData, setHistoricalData] = useState<any[]>([]);
    const [allocation, setAllocation] = useState<any[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [showAddWallet, setShowAddWallet] = useState(false);
    const [historyRange, setHistoryRange] = useState(createDefaultHistoryRange);
    const [historyRangeError, setHistoryRangeError] = useState('');
    const [liveStatus, setLiveStatus] = useState<'connecting' | 'connected' | 'fallback'>('connecting');
    const [streamRetryNonce, setStreamRetryNonce] = useState(0);

    const applyPortfolioUpdate = useCallback((data: PortfolioResponse) => {
        portfolioCache = { data, timestamp: Date.now() };
        setPortfolio(data);
        setLastRefreshTime(new Date(data.lastUpdated));
        setNextRefreshIn(30);
    }, []);

    const loadAnalytics = useCallback(async () => {
        if (historyRange.from > historyRange.to) {
            setHistoryRangeError('From date cannot be later than To date.');
            return;
        }

        try {
            setAnalyticsLoading(true);
            setHistoryRangeError('');
            const [historyData, allocationData] = await Promise.all([
                portfolioApi.getHistory({
                    limit: 365,
                    from: historyRange.from,
                    to: historyRange.to,
                }),
                portfolioApi.getAllocation(),
            ]);
            setHistoricalData(historyData.map((snapshot) => ({
                date: snapshot.generatedAt,
                value: snapshot.totalValueUsd,
            })));
            setAllocation(allocationData);
        } catch (err: any) {
            setHistoryRangeError(err.response?.data?.error || 'Failed to load chart data');
        } finally {
            setAnalyticsLoading(false);
        }
    }, [historyRange.from, historyRange.to]);

    const loadPortfolio = useCallback(async (force = false) => {
        try {
            setLoading(true);
            setError('');
            if (!force && portfolioCache && Date.now() - portfolioCache.timestamp < CACHE_DURATION) {
                setPortfolio(portfolioCache.data);
                setLastRefreshTime(new Date(portfolioCache.data.lastUpdated));
                setLoading(false);
                return;
            }
            const data = await portfolioApi.getPortfolio(false);
            applyPortfolioUpdate(data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load portfolio');
        } finally {
            setLoading(false);
        }
    }, [applyPortfolioUpdate]);

    useEffect(() => {
        loadPortfolio();
        const handleAuthCleared = () => {
            portfolioCache = null;
            setPortfolio(null);
            setHistoricalData([]);
            setAllocation([]);
            setHistoryRangeError('');
        };
        const handleAuthSynced = () => {
            portfolioCache = null;
            void loadPortfolio(true);
            void loadAnalytics();
        };
        const handleConnectionsChanged = () => {
            portfolioCache = null;
            void loadPortfolio(true);
            void loadAnalytics();
        };
        window.addEventListener('auth-cleared', handleAuthCleared);
        window.addEventListener('auth-synced', handleAuthSynced);
        window.addEventListener(WALLET_DATA_CHANGED_EVENT, handleConnectionsChanged);
        return () => {
            window.removeEventListener('auth-cleared', handleAuthCleared);
            window.removeEventListener('auth-synced', handleAuthSynced);
            window.removeEventListener(WALLET_DATA_CHANGED_EVENT, handleConnectionsChanged);
        };
    }, [loadAnalytics, loadPortfolio]);

    useEffect(() => {
        if (tabParam && (tabParam === 'portfolio' || tabParam === 'tracking')) setActiveTab(tabParam);
    }, [tabParam]);

    useEffect(() => {
        if (activeTab !== 'portfolio') {
            return;
        }

        void loadAnalytics();
    }, [activeTab, loadAnalytics]);

    const handleRefresh = useCallback(async () => {
        try {
            setRefreshing(true); setError('');
            const data = await portfolioApi.refreshPortfolio();
            applyPortfolioUpdate(data);
            await loadAnalytics();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to refresh');
        } finally {
            setRefreshing(false);
        }
    }, [applyPortfolioUpdate, loadAnalytics]);

    const handleSyncTransactions = useCallback(async () => {
        try {
            setSyncing(true); setError('');
            await syncTransactions();
            portfolioCache = null;
            await loadPortfolio(true);
            await loadAnalytics();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to sync transactions');
        } finally {
            setSyncing(false);
        }
    }, [loadAnalytics, loadPortfolio]);

    const handleRemoveWallet = useCallback(async (walletId: string) => {
        try {
            await walletApi.deleteWallet(walletId);
            const remainingWallets = (portfolio?.wallets || []).filter((wallet) => wallet.id !== walletId);
            setPortfolio((currentPortfolio) => {
                if (!currentPortfolio) {
                    return currentPortfolio;
                }

                return {
                    ...currentPortfolio,
                    wallets: currentPortfolio.wallets.filter((wallet) => wallet.id !== walletId),
                };
            });
            portfolioCache = null;
            notifyWalletsChanged();
            if (remainingWallets.length === 0) { router.push('/'); return; }
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Failed to remove wallet';
            setError(msg);
            alert(`Failed to remove wallet: ${msg}`);
            return false;
        }
    }, [portfolio, router]);

    const handleWalletAdded = useCallback(() => {
        setShowAddWallet(false);
        portfolioCache = null;
        void loadPortfolio(true);
        void loadAnalytics();
    }, [loadAnalytics, loadPortfolio]);

    const handleHistoryRangeChange = useCallback((
        field: 'from' | 'to',
        value: string
    ) => {
        setHistoryRange((current) => ({
            ...current,
            [field]: value,
        }));
    }, []);
    useEffect(() => {
        if (!portfolio || activeTab !== 'portfolio' || liveStatus === 'connected') return;
        const countdown = setInterval(() => setNextRefreshIn(p => p <= 1 ? 30 : p - 1), 1000);
        return () => clearInterval(countdown);
    }, [portfolio, activeTab, liveStatus]);

    useEffect(() => {
        if (!portfolio || activeTab !== 'portfolio' || liveStatus === 'connected') return;
        const interval = setInterval(() => { portfolioCache = null; loadPortfolio(true); }, 30000);
        return () => clearInterval(interval);
    }, [portfolio, activeTab, liveStatus, loadPortfolio]);

    useEffect(() => {
        if (activeTab !== 'portfolio') {
            return;
        }

        let isActive = true;
        let teardownStream: (() => Promise<void>) | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        const abortController = new AbortController();

        const scheduleRetry = () => {
            if (!isActive || retryTimer) {
                return;
            }

            retryTimer = setTimeout(() => {
                retryTimer = null;
                if (isActive) {
                    setStreamRetryNonce((current) => current + 1);
                }
            }, 5000);
        };

        const connectLiveStream = async () => {
            try {
                setLiveStatus('connecting');
                teardownStream = await portfolioApi.subscribeLive({
                    signal: abortController.signal,
                    onConnected: () => {
                        if (!isActive) {
                            return;
                        }

                        setLiveStatus('connected');
                    },
                    onPortfolio: ({ portfolio: livePortfolio }) => {
                        if (!isActive) {
                            return;
                        }

                        applyPortfolioUpdate(livePortfolio);
                    },
                    onError: (message) => {
                        if (!isActive || abortController.signal.aborted) {
                            return;
                        }

                        console.warn('Live portfolio stream error:', message);
                        setLiveStatus('fallback');
                        scheduleRetry();
                    },
                });
            } catch (error: any) {
                if (!isActive || abortController.signal.aborted) {
                    return;
                }

                console.warn('Failed to connect live portfolio stream:', error?.message || error);
                setLiveStatus('fallback');
                scheduleRetry();
            }
        };

        void connectLiveStream();

        return () => {
            isActive = false;
            abortController.abort();
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
            if (teardownStream) {
                void teardownStream();
            }
        };
    }, [activeTab, applyPortfolioUpdate, streamRetryNonce]);

    if (loading) {
        return (
            <div className="space-y-8">
                {/* Hero Card Skeleton */}
                <HeroCardSkeleton />

                {/* Asset Table Skeleton */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5">
                        <div className="h-6 w-32 bg-white/[0.06] rounded animate-pulse" />
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <AssetRowSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#F5F5F5]">
                        {activeTab === 'tracking' ? 'Live Token Tracking' : 'Portfolio Overview'}
                    </h2>
                    {activeTab === 'portfolio' && lastRefreshTime && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-[#D5D5D5]/60">
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    liveStatus === 'connected'
                                        ? 'bg-[#00FFB2] animate-pulse'
                                        : liveStatus === 'connecting'
                                            ? 'bg-[#F59E0B] animate-pulse'
                                            : 'bg-[#D5D5D5]/50'
                                }`} />
                                <span>
                                    {liveStatus === 'connected'
                                        ? 'CoinDCX live stream connected'
                                        : liveStatus === 'connecting'
                                            ? 'Connecting live stream'
                                            : 'Polling fallback active'}
                                </span>
                            </div>
                            <span>•</span>
                            <span>Last updated: {lastRefreshTime.toLocaleTimeString()}</span>
                            {liveStatus !== 'connected' && (
                                <>
                                    <span>•</span>
                                    <span>Next in {nextRefreshIn}s</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {activeTab === 'portfolio' && (
                    <div className="flex gap-3">
                        <Button onClick={handleSyncTransactions} isLoading={syncing} variant="secondary" size="sm">
                            {syncing ? 'Syncing…' : 'Sync Txns'}
                        </Button>
                        <Button onClick={handleRefresh} isLoading={refreshing} variant="secondary" size="sm">
                            {refreshing ? 'Refreshing…' : 'Refresh'}
                        </Button>
                    </div>
                )}
            </div>
            {/* Error */}
            {error && (
                <div className="bg-[#FF4C4C]/10 border border-[#FF4C4C]/30 text-[#FF4C4C] px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                    <span>⚠️</span> {error}
                </div>
            )}

            {portfolio?.pnlStatus === 'incomplete' && portfolio.pnlNotice && (
                <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#FCD34D] px-4 py-3 rounded-xl flex items-start gap-3 text-sm">
                    <span>⚠</span>
                    <span>{portfolio.pnlNotice}</span>
                </div>
            )}

            {/* Tab content */}
            {activeTab === 'tracking' ? (
                <RealTimeTracking />
            ) : portfolio ? (
                <PortfolioContent
                    portfolio={portfolio}
                    historicalData={historicalData}
                    allocation={allocation}
                    analyticsLoading={analyticsLoading}
                    historyRange={historyRange}
                    historyRangeError={historyRangeError}
                    onHistoryRangeChange={handleHistoryRangeChange}
                    onAddWallet={() => setShowAddWallet(true)}
                    onRemoveWallet={handleRemoveWallet}
                />
            ) : (
                // Empty State - No Wallets Connected
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-12 text-center">
                    <div className="max-w-md mx-auto">
                        {/* Wallet SVG Illustration */}
                        <div className="mb-8">
                            <svg className="w-24 h-24 mx-auto text-[#D5D5D5]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                        
                        <h3 className="text-xl font-semibold text-[#F5F5F5] mb-3">
                            Connect Your First Wallet
                        </h3>
                        
                        <p className="text-[#D5D5D5]/60 mb-8 leading-relaxed">
                            Start tracking your crypto portfolio by connecting your wallet address. 
                            We'll automatically sync your transactions and calculate your P&L.
                        </p>
                        
                        <Button 
                            onClick={() => setShowAddWallet(true)}
                            className="px-8 py-3"
                        >
                            Add Wallet Address
                        </Button>
                    </div>
                </div>
            )}

            {showAddWallet && (
                <AddWalletModal isOpen={showAddWallet} onClose={() => setShowAddWallet(false)} onSuccess={handleWalletAdded} />
            )}
        </div>
    );
}
// ─── Portfolio Content ──────────────────────────────────────────────────────
const PortfolioContent = memo(function PortfolioContent({
    portfolio, historicalData, allocation, analyticsLoading, historyRange, historyRangeError, onHistoryRangeChange, onAddWallet, onRemoveWallet,
}: {
    portfolio: PortfolioResponse;
    historicalData: any[];
    allocation: any[];
    analyticsLoading: boolean;
    historyRange: {
        from: string;
        to: string;
    };
    historyRangeError: string;
    onHistoryRangeChange: (field: 'from' | 'to', value: string) => void;
    onAddWallet: () => void;
    onRemoveWallet: (id: string) => void;
}) {
    const [sortBy, setSortBy] = useState<'symbol' | 'balance' | 'value' | 'change' | 'pnl'>('value');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const handleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const sortedAssets = portfolio.assets?.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortBy) {
            case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
            case 'balance': aVal = parseFloat(a.totalBalance); bVal = parseFloat(b.totalBalance); break;
            case 'value': aVal = a.valueUsd; bVal = b.valueUsd; break;
            case 'change': aVal = 0; bVal = 0; break; // No change data available in current Asset type
            case 'pnl': aVal = 0; bVal = 0; break; // No PnL data available in current Asset type
            default: aVal = a.valueUsd; bVal = b.valueUsd;
        }
        
        if (typeof aVal === 'string') {
            return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }) || [];

    const getTokenInitials = (symbol: string) => {
        return symbol.slice(0, 2).toUpperCase();
    };

    const getTokenColor = (symbol: string) => {
        const colors = ['#00FFB2', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];
        const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    if (!portfolio) return null;

    const today = toDateInputValue(new Date());
    const historyRangeLabel = formatHistoryRangeLabel(historyRange.from, historyRange.to);

    return (
        <div className="space-y-8">
            {/* Hero Card - Total Portfolio Value */}
            <StatCard
                variant="hero"
                value={formatUSDAsINR(portfolio.totalValueUsd)}
                change={portfolio.change24h}
                lastUpdated={new Date(portfolio.lastUpdated)}
            />

            {/* Asset Holdings Table */}
            <StatCard variant="asset">
                <div className="px-6 py-4 border-b border-white/5">
                    <h3 className="text-lg font-semibold text-[#F5F5F5]">Asset Holdings</h3>
                    <p className="text-sm text-[#D5D5D5]/60 mt-1">Click column headers to sort</p>
                </div>
                
                {/* Table Header */}
                <div className="px-6 py-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="grid grid-cols-7 gap-4 text-xs font-medium text-[#D5D5D5]/60 uppercase tracking-wider">
                        <button 
                            onClick={() => handleSort('symbol')}
                            className="text-left hover:text-[#00FFB2] transition-colors flex items-center gap-1"
                        >
                            Token
                            {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        <button 
                            onClick={() => handleSort('balance')}
                            className="text-right hover:text-[#00FFB2] transition-colors flex items-center justify-end gap-1"
                        >
                            Balance
                            {sortBy === 'balance' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        <div className="text-right">Price</div>
                        <button 
                            onClick={() => handleSort('value')}
                            className="text-right hover:text-[#00FFB2] transition-colors flex items-center justify-end gap-1"
                        >
                            Value (USD)
                            {sortBy === 'value' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        <button 
                            onClick={() => handleSort('change')}
                            className="text-right hover:text-[#00FFB2] transition-colors flex items-center justify-end gap-1"
                        >
                            24h Change
                            {sortBy === 'change' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        <button 
                            onClick={() => handleSort('pnl')}
                            className="text-right hover:text-[#00FFB2] transition-colors flex items-center justify-end gap-1"
                        >
                            P&L
                            {sortBy === 'pnl' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        <div className="text-right">Actions</div>
                    </div>
                </div>
                {/* Table Body */}
                <div className="max-h-96 overflow-y-auto">
                    {sortedAssets.length > 0 ? sortedAssets.map((asset, index) => (
                        <div 
                            key={`${asset.symbol}-${index}`}
                            className={`px-6 py-4 border-b border-white/5 last:border-b-0 hover:bg-white/[0.04] transition-colors ${
                                index % 2 === 1 ? 'bg-white/[0.02]' : ''
                            }`}
                        >
                            <div className="grid grid-cols-7 gap-4 items-center">
                                {/* Token */}
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
                                        style={{ backgroundColor: getTokenColor(asset.symbol) }}
                                    >
                                        {getTokenInitials(asset.symbol)}
                                    </div>
                                    <div>
                                        <div className="font-medium text-[#F5F5F5]">{asset.symbol}</div>
                                        <div className="text-xs text-[#D5D5D5]/60">{asset.name || asset.symbol}</div>
                                    </div>
                                </div>
                                
                                {/* Balance */}
                                <div className="text-right text-sm text-[#F5F5F5]">
                                    {parseFloat(asset.totalBalance).toFixed(6)}
                                </div>
                                
                                {/* Price */}
                                <div className="text-right text-sm text-[#F5F5F5]">
                                    ${(asset.valueUsd / parseFloat(asset.totalBalance)).toFixed(4)}
                                </div>
                                
                                {/* Value */}
                                <div className="text-right text-sm font-medium text-[#F5F5F5]">
                                    {formatUSDAsINR(asset.valueUsd)}
                                </div>
                                
                                {/* 24h Change */}
                                <div className="text-right text-sm font-medium text-[#D5D5D5]/60">
                                    —
                                </div>
                                
                                {/* P&L */}
                                <div className="text-right text-sm font-medium text-[#D5D5D5]/60">
                                    —
                                </div>
                                
                                {/* Actions */}
                                <div className="text-right">
                                    <button className="text-xs text-[#00FFB2] hover:text-[#00FFB2]/80 transition-colors">
                                        View
                                    </button>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="px-6 py-12 text-center">
                            <div className="text-[#D5D5D5]/60 mb-4">No assets found</div>
                            <button 
                                onClick={onAddWallet}
                                className="text-[#00FFB2] hover:text-[#00FFB2]/80 transition-colors text-sm"
                            >
                                Add a wallet to see your assets
                            </button>
                        </div>
                    )}
                </div>
            </StatCard>
            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-[#F5F5F5]">Portfolio Value</h2>
                                <p className="mt-1 text-xs text-[#D5D5D5]/60">{historyRangeLabel}</p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <label className="flex flex-col gap-1 text-xs text-[#D5D5D5]/60">
                                    <span>From</span>
                                    <input
                                        type="date"
                                        value={historyRange.from}
                                        max={historyRange.to || today}
                                        onChange={(event) => onHistoryRangeChange('from', event.target.value)}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#F5F5F5] outline-none transition focus:border-[#00FFB2]/60"
                                    />
                                </label>

                                <label className="flex flex-col gap-1 text-xs text-[#D5D5D5]/60">
                                    <span>To</span>
                                    <input
                                        type="date"
                                        value={historyRange.to}
                                        min={historyRange.from}
                                        max={today}
                                        onChange={(event) => onHistoryRangeChange('to', event.target.value)}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#F5F5F5] outline-none transition focus:border-[#00FFB2]/60"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        {historyRangeError && (
                            <div className="mb-4 rounded-xl border border-[#FF4C4C]/30 bg-[#FF4C4C]/10 px-4 py-3 text-sm text-[#FF8585]">
                                {historyRangeError}
                            </div>
                        )}
                        {analyticsLoading ? (
                            <div className="h-[300px] flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : <PortfolioValueChart data={historicalData} />}
                    </div>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/5">
                        <h2 className="text-base font-semibold text-[#F5F5F5]">Asset Allocation</h2>
                    </div>
                    <div className="p-6">
                        {analyticsLoading ? (
                            <div className="h-[300px] flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : <AssetAllocationPie data={allocation} />}
                    </div>
                </div>
            </div>

            {/* Wallet List */}
            <WalletList wallets={portfolio.wallets || []} onAddWallet={onAddWallet} onRemoveWallet={onRemoveWallet} />

            {/* Exchange accounts */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                <div className="mb-6">
                    <h2 className="text-base font-semibold text-[#F5F5F5]">Exchange Accounts</h2>
                    <p className="text-xs text-[#D5D5D5]/60 mt-1">Manage your connected exchange accounts</p>
                </div>
                <ExchangeAccountList onAccountsChange={() => {
                    portfolioCache = null;
                    notifyWalletsChanged();
                    window.dispatchEvent(new CustomEvent('auth-synced'));
                }} />
            </div>
        </div>
    );
});
