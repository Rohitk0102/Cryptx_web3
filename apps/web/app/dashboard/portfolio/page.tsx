'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { portfolioApi, walletApi, PortfolioResponse } from '@/lib/portfolioApi';
import { syncTransactions } from '@/lib/pnlApi';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PortfolioValueChart } from '@/components/charts/PortfolioValueChart';
import { AssetAllocationPie } from '@/components/charts/AssetAllocationPie';
import RealTimeTracking from '@/components/dashboard/RealTimeTracking';
import AddWalletModal from '@/components/wallet/AddWalletModal';
import WalletList from '@/components/wallet/WalletList';
import ExchangeAccountList from '@/components/exchange/ExchangeAccountList';
import { formatUSDAsINR } from '@/lib/currency';

type TabType = 'portfolio' | 'tracking';

let portfolioCache: { data: PortfolioResponse; timestamp: number } | null = null;
const CACHE_DURATION = 30000;

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

    const loadPortfolio = useCallback(async (force = false) => {
        try {
            setLoading(true);
            setError('');
            if (!force && portfolioCache && Date.now() - portfolioCache.timestamp < CACHE_DURATION) {
                setPortfolio(portfolioCache.data);
                setLoading(false);
                loadAnalytics();
                return;
            }
            const data = await portfolioApi.getPortfolio(false);
            portfolioCache = { data, timestamp: Date.now() };
            setPortfolio(data);
            setLastRefreshTime(new Date());
            setNextRefreshIn(30);
            loadAnalytics();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load portfolio');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPortfolio();
        const handleAuthCleared = () => { portfolioCache = null; setPortfolio(null); };
        const handleAuthSynced = () => { portfolioCache = null; loadPortfolio(true); };
        window.addEventListener('auth-cleared', handleAuthCleared);
        window.addEventListener('auth-synced', handleAuthSynced);
        return () => {
            window.removeEventListener('auth-cleared', handleAuthCleared);
            window.removeEventListener('auth-synced', handleAuthSynced);
        };
    }, [loadPortfolio]);

    useEffect(() => {
        if (tabParam && (tabParam === 'portfolio' || tabParam === 'tracking')) setActiveTab(tabParam);
    }, [tabParam]);

    const loadAnalytics = async () => {
        try {
            setAnalyticsLoading(true);
            const [historyData, allocationData] = await Promise.all([
                portfolioApi.getHistory(7),
                portfolioApi.getAllocation(),
            ]);
            setHistoricalData(historyData.map((s: any) => ({ date: s.generatedAt, value: s.totalValueUsd })));
            setAllocation(allocationData);
        } catch (err) {
            console.error('Error loading analytics:', err);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleRefresh = useCallback(async () => {
        try {
            setRefreshing(true); setError('');
            const data = await portfolioApi.refreshPortfolio();
            portfolioCache = { data, timestamp: Date.now() };
            setPortfolio(data);
            setLastRefreshTime(new Date());
            setNextRefreshIn(30);
            loadAnalytics();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to refresh');
        } finally {
            setRefreshing(false);
        }
    }, []);

    const handleSyncTransactions = useCallback(async () => {
        try {
            setSyncing(true); setError('');
            await syncTransactions();
            portfolioCache = null;
            await loadPortfolio(true);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to sync transactions');
        } finally {
            setSyncing(false);
        }
    }, [loadPortfolio]);

    const handleRemoveWallet = useCallback(async (walletId: string) => {
        try {
            await walletApi.deleteWallet(walletId);
            const remaining = await walletApi.getWallets();
            if (remaining.length === 0) { portfolioCache = null; router.push('/'); return; }
            portfolioCache = null;
            await loadPortfolio(true);
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Failed to remove wallet';
            setError(msg);
            alert(`Failed to remove wallet: ${msg}`);
            return false;
        }
    }, [loadPortfolio, router]);

    const handleWalletAdded = useCallback(() => {
        setShowAddWallet(false);
        portfolioCache = null;
        loadPortfolio(true);
    }, [loadPortfolio]);

    useEffect(() => {
        if (!portfolio || activeTab !== 'portfolio') return;
        const countdown = setInterval(() => setNextRefreshIn(p => p <= 1 ? 30 : p - 1), 1000);
        return () => clearInterval(countdown);
    }, [portfolio, activeTab]);

    useEffect(() => {
        if (!portfolio || activeTab !== 'portfolio') return;
        const interval = setInterval(() => { portfolioCache = null; loadPortfolio(true); }, 30000);
        return () => clearInterval(interval);
    }, [portfolio, activeTab, loadPortfolio]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
                    <div className="text-[#D5D5D5] text-sm">Loading portfolio…</div>
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
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00FFB2] animate-pulse" />
                                <span>Live Sync Active</span>
                            </div>
                            <span>•</span>
                            <span>Last updated: {lastRefreshTime.toLocaleTimeString()}</span>
                            <span>•</span>
                            <span>Next in {nextRefreshIn}s</span>
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

            {/* Tab content */}
            {activeTab === 'tracking' ? (
                <RealTimeTracking />
            ) : portfolio ? (
                <PortfolioContent
                    portfolio={portfolio}
                    historicalData={historicalData}
                    allocation={allocation}
                    analyticsLoading={analyticsLoading}
                    onAddWallet={() => setShowAddWallet(true)}
                    onRemoveWallet={handleRemoveWallet}
                />
            ) : (
                <Card className="p-8 text-center">
                    <div className="text-[#D5D5D5] mb-4 text-sm">No Portfolio Data</div>
                    <Button onClick={() => setShowAddWallet(true)}>Add Wallet</Button>
                </Card>
            )}

            {showAddWallet && (
                <AddWalletModal isOpen={showAddWallet} onClose={() => setShowAddWallet(false)} onSuccess={handleWalletAdded} />
            )}
        </div>
    );
}

// ─── Portfolio Content ──────────────────────────────────────────────────────
const PortfolioContent = memo(function PortfolioContent({
    portfolio, historicalData, allocation, analyticsLoading, onAddWallet, onRemoveWallet,
}: {
    portfolio: PortfolioResponse;
    historicalData: any[];
    allocation: any[];
    analyticsLoading: boolean;
    onAddWallet: () => void;
    onRemoveWallet: (id: string) => void;
}) {
    const pnlPositive = portfolio.totalPnL !== undefined && portfolio.totalPnL >= 0;

    return (
        <div className="grid gap-8">

            {/* Performance metrics row */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: '24H Change', value: portfolio.change24h },
                    { label: '7D Change', value: portfolio.change7d },
                    { label: '30D Change', value: portfolio.change30d },
                ].map(({ label, value }) => {
                    const pos = value !== undefined && value >= 0;
                    return (
                        <div key={label} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                            <div className="text-xs text-[#D5D5D5]/60 uppercase tracking-wider font-medium mb-2">{label}</div>
                            <div className={`text-2xl font-bold ${value !== undefined && value >= 0 ? 'text-[#00FFB2]' : 'text-[#FF4C4C]'}`}>
                                {value !== undefined ? `${pos ? '+' : ''}${value.toFixed(2)}%` : '—'}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main value card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 relative overflow-hidden group hover:bg-white/[0.05] transition-all">
                <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#00FFB2] opacity-[0.03] rounded-full blur-3xl group-hover:opacity-[0.07] transition-opacity pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-[#D5D5D5]/60 text-xs font-medium uppercase tracking-wider">Current Value</div>
                        <div className="flex items-center gap-1.5 text-[10px] bg-white/5 px-2 py-1 rounded-full text-[#D5D5D5]/50">
                            <div className="w-1 h-1 rounded-full bg-[#00FFB2] animate-pulse" />
                            Real-time
                        </div>
                    </div>
                    <div className="text-5xl font-black text-[#F5F5F5] tracking-tight mb-6">
                        {formatUSDAsINR(portfolio.totalValueUsd)}
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="text-[#D5D5D5]/60 text-xs font-medium uppercase tracking-wider mb-1">Invested</div>
                            <div className="text-xl font-bold text-[#F5F5F5]">
                                {portfolio.totalInvestedUsd !== undefined ? formatUSDAsINR(portfolio.totalInvestedUsd) : '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-[#D5D5D5]/60 text-xs font-medium uppercase tracking-wider mb-1">Total P&L</div>
                            <div className={`text-xl font-bold ${pnlPositive ? 'text-[#00FFB2]' : 'text-[#FF4C4C]'}`}>
                                {portfolio.totalPnL !== undefined
                                    ? `${pnlPositive ? '+' : ''}${formatUSDAsINR(portfolio.totalPnL)}`
                                    : '—'}
                                {portfolio.totalPnLPercentage !== undefined && (
                                    <span className="text-sm ml-2 opacity-70">
                                        ({portfolio.totalPnLPercentage >= 0 ? '+' : ''}{portfolio.totalPnLPercentage.toFixed(2)}%)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 text-[10px] text-[#D5D5D5]/40">
                        Updated: {new Date(portfolio.lastUpdated).toLocaleTimeString()}
                        {portfolio.cached && <span className="ml-2 text-[#F59E0B]">(Cached)</span>}
                    </div>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/5">
                        <h2 className="text-base font-semibold text-[#F5F5F5]">Portfolio Value (7 Days)</h2>
                    </div>
                    <div className="p-6">
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
                    window.dispatchEvent(new CustomEvent('auth-synced'));
                }} />
            </div>
        </div>
    );
});
