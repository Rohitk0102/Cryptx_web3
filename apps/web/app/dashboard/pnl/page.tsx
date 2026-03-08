'use client';

import { useState, useEffect } from 'react';
import { getPnLSummary, updateCostBasisMethod, syncTransactions, exportPnLCSV, type PnLSummaryResponse } from '@/lib/pnlApi';
import { Button } from '@/components/ui/Button';
import { formatUSDAsINR } from '@/lib/currency';

const getPnLStyle = (value: string) => {
  const n = parseFloat(value);
  if (n > 0) return 'text-[#00FFB2]';
  if (n < 0) return 'text-[#FF4C4C]';
  return 'text-[#D5D5D5]';
};

const getPnLBorderColor = (value: string) => {
  const n = parseFloat(value);
  if (n > 0) return 'border-l-[#00FFB2]';
  if (n < 0) return 'border-l-[#FF4C4C]';
  return 'border-l-[#D5D5D5]/30';
};

const getPnLGlowColor = (value: string) => {
  const n = parseFloat(value);
  if (n > 0) return 'hover:shadow-[#00FFB2]/20';
  if (n < 0) return 'hover:shadow-[#FF4C4C]/20';
  return 'hover:shadow-white/10';
};

// ─── Toast Notification System ──────────────────────────────────────────────
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  progress: number;
}

const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`relative overflow-hidden rounded-lg border p-4 shadow-lg backdrop-blur-sm min-w-[300px] ${
            toast.type === 'success' 
              ? 'bg-[#00FFB2]/10 border-[#00FFB2]/30 text-[#00FFB2]'
              : toast.type === 'error'
              ? 'bg-[#FF4C4C]/10 border-[#FF4C4C]/30 text-[#FF4C4C]'
              : 'bg-white/10 border-white/20 text-[#F5F5F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <span>✓</span>}
              {toast.type === 'error' && <span>⚠</span>}
              {toast.type === 'info' && <span>ℹ</span>}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current/60 hover:text-current transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 h-1 bg-current/20 w-full">
            <div 
              className="h-full bg-current transition-all duration-100 ease-linear"
              style={{ width: `${toast.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Skeleton Components ────────────────────────────────────────────────────
const HeroCardSkeleton = () => (
  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 border-l-4 border-l-[#D5D5D5]/30">
    <div className="space-y-4">
      <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
      <div className="h-10 w-32 bg-white/[0.06] rounded animate-pulse" />
      <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
    </div>
  </div>
);

const TokenRowSkeleton = () => (
  <tr className="border-b border-white/[0.04]">
    {Array.from({ length: 8 }).map((_, i) => (
      <td key={i} className="py-3 px-4">
        <div className="h-4 bg-white/[0.06] rounded animate-pulse" />
      </td>
    ))}
  </tr>
);

export default function PnLPage() {
  const [summary, setSummary] = useState<PnLSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [costBasisMethod, setCostBasisMethod] = useState<'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'>('FIFO');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'token' | 'holdings' | 'costBasis' | 'currentValue' | 'unrealizedPnL' | 'realizedPnL' | 'totalPnL' | 'percentageGain'>('totalPnL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { 
    loadPnLSummary(); 
    // Set initial last sync time
    setLastSyncTime(new Date());
  }, []);

  // Toast management
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type, progress: 100 };
    setToasts(prev => [...prev, newToast]);

    // Animate progress bar
    const interval = setInterval(() => {
      setToasts(prev => prev.map(toast => 
        toast.id === id 
          ? { ...toast, progress: Math.max(0, toast.progress - 2.5) }
          : toast
      ));
    }, 100);

    // Remove toast after 4 seconds
    setTimeout(() => {
      clearInterval(interval);
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const loadPnLSummary = async () => {
    try {
      setLoading(true);
      const data = await getPnLSummary();
      setSummary(data);
      setCostBasisMethod(data.costBasisMethod as any);
    } catch (e) { 
      console.error('Failed to load P&L:', e);
      showToast('Failed to load P&L data', 'error');
    } finally { 
      setLoading(false); 
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncTransactions();
      await loadPnLSummary();
      setLastSyncTime(new Date());
      showToast('Transactions synced successfully', 'success');
    } catch (e) { 
      console.error('Sync failed:', e);
      showToast('Failed to sync transactions. Please try again.', 'error');
    } finally { 
      setSyncing(false); 
    }
  };

  const handleMethodChange = async (method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE') => {
    try {
      await updateCostBasisMethod(method);
      setCostBasisMethod(method);
      await loadPnLSummary();
      
      const methodNames = {
        'FIFO': 'FIFO',
        'LIFO': 'LIFO', 
        'WEIGHTED_AVERAGE': 'Weighted Average'
      };
      showToast(`Cost basis method updated to ${methodNames[method]}`, 'success');
    } catch (e) { 
      showToast('Failed to update cost basis method', 'error');
    }
  };

  const toggleRowExpansion = (tokenSymbol: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenSymbol)) {
        newSet.delete(tokenSymbol);
      } else {
        newSet.add(tokenSymbol);
      }
      return newSet;
    });
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortedTokens = () => {
    if (!summary?.byToken) return [];
    
    return [...summary.byToken].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'token': aVal = a.tokenSymbol; bVal = b.tokenSymbol; break;
        case 'holdings': aVal = parseFloat(a.holdings || '0'); bVal = parseFloat(b.holdings || '0'); break;
        case 'costBasis': aVal = parseFloat(a.costBasis || '0'); bVal = parseFloat(b.costBasis || '0'); break;
        case 'currentValue': aVal = parseFloat(a.currentValue || '0'); bVal = parseFloat(b.currentValue || '0'); break;
        case 'unrealizedPnL': aVal = parseFloat(a.unrealizedPnL || '0'); bVal = parseFloat(b.unrealizedPnL || '0'); break;
        case 'realizedPnL': aVal = parseFloat(a.realizedPnL || '0'); bVal = parseFloat(b.realizedPnL || '0'); break;
        case 'totalPnL': aVal = parseFloat(a.totalPnL || '0'); bVal = parseFloat(b.totalPnL || '0'); break;
        case 'percentageGain': aVal = parseFloat(a.percentageGain || '0'); bVal = parseFloat(b.percentageGain || '0'); break;
        default: aVal = parseFloat(a.totalPnL || '0'); bVal = parseFloat(b.totalPnL || '0');
      }
      
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  const getRelativeTime = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const fmt = (v: string) => formatUSDAsINR(parseFloat(v));
  const fmtP = (v: string) => { const n = parseFloat(v); return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; };
  const fmtPnL = (v: string) => { const n = parseFloat(v); return `${n >= 0 ? '+' : ''}${fmt(v)}`; };

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#F5F5F5]">Profit & Loss Calculator</h1>
            <p className="text-sm text-[#D5D5D5]/60 mt-1">FIFO, LIFO, and weighted average cost basis</p>
          </div>
          <Button disabled variant="secondary" size="sm">
            Export CSV
          </Button>
        </div>

        {/* Cost Basis Method Skeleton */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-5 w-32 bg-white/[0.06] rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-10 w-48 bg-white/[0.06] rounded animate-pulse" />
          </div>
        </div>

        {/* Hero Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <HeroCardSkeleton key={i} />
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5">
            <div className="h-5 w-40 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <th key={i} className="py-4 px-4">
                      <div className="h-4 bg-white/[0.06] rounded animate-pulse" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TokenRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Profit & Loss Calculator</h1>
          <p className="text-sm text-[#D5D5D5]/60 mt-1">FIFO, LIFO, and weighted average cost basis</p>
        </div>
        <Button 
          onClick={() => summary && exportPnLCSV(summary)} 
          disabled={!summary} 
          variant="secondary" 
          size="sm"
        >
          Export CSV
        </Button>
      </div>

      {/* Cost Basis Method Toggle */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[#F5F5F5] mb-1">Cost Basis Method</h3>
            <p className="text-sm text-[#D5D5D5]/60">Select how to calculate cost basis for P&L</p>
          </div>
          
          <div className="flex rounded-lg border border-white/10 bg-white/[0.02] p-1">
            {[
              { key: 'FIFO', label: 'FIFO', tooltip: 'First In, First Out - Sell oldest holdings first' },
              { key: 'LIFO', label: 'LIFO', tooltip: 'Last In, First Out - Sell newest holdings first' },
              { key: 'WEIGHTED_AVERAGE', label: 'Weighted Avg', tooltip: 'Average cost of all holdings' }
            ].map(({ key, label, tooltip }) => (
              <button
                key={key}
                onClick={() => handleMethodChange(key as any)}
                disabled={loading}
                className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  costBasisMethod === key
                    ? 'bg-[#00FFB2]/10 border border-[#00FFB2] text-[#00FFB2]'
                    : 'bg-transparent border border-transparent text-[#D5D5D5] hover:text-[#F5F5F5] hover:bg-white/[0.03]'
                }`}
                title={tooltip}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {summary && (
        <>
          {/* Hero Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                label: 'Total P&L', 
                value: summary.totalPnL, 
                subtitle: 'Combined total',
                isMain: true
              },
              { 
                label: 'Realized P&L', 
                value: summary.totalRealizedPnL, 
                subtitle: 'Closed positions'
              },
              { 
                label: 'Unrealized P&L', 
                value: summary.totalUnrealizedPnL, 
                subtitle: 'Open positions'
              }
            ].map(({ label, value, subtitle, isMain }) => {
              const percentage = summary.totalPnLPercentage;
              return (
                <div 
                  key={label} 
                  className={`bg-white/[0.03] border border-white/10 rounded-2xl p-6 border-l-4 transition-all duration-200 hover:shadow-lg ${getPnLBorderColor(value)} ${getPnLGlowColor(value)}`}
                >
                  <div className="text-xs font-medium text-[#D5D5D5]/60 uppercase tracking-wider mb-3">
                    {label}
                  </div>
                  <div className={`${isMain ? 'text-4xl' : 'text-3xl'} font-bold mb-2 ${getPnLStyle(value)}`}>
                    {fmtPnL(value)}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-[#D5D5D5]/50">{subtitle}</div>
                    {isMain && percentage && (
                      <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                        parseFloat(percentage) >= 0 
                          ? 'bg-[#00FFB2]/20 text-[#00FFB2]' 
                          : 'bg-[#FF4C4C]/20 text-[#FF4C4C]'
                      }`}>
                        {fmtP(percentage)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Token Breakdown Table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5">
              <h2 className="text-base font-semibold text-[#F5F5F5]">Token-wise Breakdown</h2>
              <p className="text-sm text-[#D5D5D5]/60 mt-1">Click rows to expand details</p>
            </div>
            
            {getSortedTokens().length === 0 ? (
              <div className="text-center py-16">
                <div className="mb-6">
                  <svg className="w-16 h-16 mx-auto text-[#D5D5D5]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#F5F5F5] mb-2">No P&L data available</h3>
                <p className="text-[#D5D5D5]/60 mb-6">Sync your transactions to see detailed P&L breakdown by token.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      {[
                        { key: 'token', label: 'Token', align: 'left' },
                        { key: 'holdings', label: 'Holdings', align: 'right' },
                        { key: 'costBasis', label: 'Cost Basis', align: 'right' },
                        { key: 'currentValue', label: 'Current Value', align: 'right' },
                        { key: 'unrealizedPnL', label: 'Unrealized P&L', align: 'right' },
                        { key: 'realizedPnL', label: 'Realized P&L', align: 'right' },
                        { key: 'totalPnL', label: 'Total P&L', align: 'right' },
                        { key: 'percentageGain', label: 'Gain %', align: 'right' }
                      ].map(({ key, label, align }) => (
                        <th 
                          key={key}
                          className={`py-4 px-4 text-xs font-semibold text-[#D5D5D5]/50 uppercase tracking-wider cursor-pointer hover:text-[#00FFB2] transition-colors ${align === 'left' ? 'text-left' : 'text-right'}`}
                          onClick={() => handleSort(key as any)}
                        >
                          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                            {label}
                            {sortBy === key && (
                              <span className="text-[#00FFB2]">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedTokens().map((token) => (
                      <>
                        <tr 
                          key={token.tokenSymbol} 
                          className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
                          onClick={() => toggleRowExpansion(token.tokenSymbol)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#F5F5F5]">{token.tokenSymbol}</span>
                              {token.hasUnknownCostBasis && (
                                <span className="text-xs bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded-full" title="Cost basis unavailable for some lots">
                                  ⚠ Partial data
                                </span>
                              )}
                              <span className="text-[#D5D5D5]/40">
                                {expandedRows.has(token.tokenSymbol) ? '▼' : '▶'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">
                            {parseFloat(token.holdings || '0').toFixed(4)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">
                            {fmt(token.costBasis || '0')}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">
                            {fmt(token.currentValue || '0')}
                          </td>
                          <td className={`py-3 px-4 text-right text-sm font-medium ${getPnLStyle(token.unrealizedPnL || '0')}`}>
                            {fmtPnL(token.unrealizedPnL || '0')}
                          </td>
                          <td className={`py-3 px-4 text-right text-sm font-medium ${getPnLStyle(token.realizedPnL || '0')}`}>
                            {fmtPnL(token.realizedPnL || '0')}
                          </td>
                          <td className={`py-3 px-4 text-right text-sm font-bold ${getPnLStyle(token.totalPnL || '0')}`}>
                            {fmtPnL(token.totalPnL || '0')}
                          </td>
                          <td className={`py-3 px-4 text-right text-sm ${getPnLStyle(token.percentageGain || '0')}`}>
                            {fmtP(token.percentageGain || '0')}
                          </td>
                        </tr>
                        
                        {/* Expanded Row Details */}
                        {expandedRows.has(token.tokenSymbol) && (
                          <tr className="bg-white/[0.02] border-b border-white/[0.04]">
                            <td colSpan={8} className="py-6 px-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                  <div className="text-xs text-[#D5D5D5]/40 uppercase tracking-wider">Transaction Count</div>
                                  <div className="text-lg font-semibold text-[#F5F5F5]">
                                    {token.transactionCount || 0} trades
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="text-xs text-[#D5D5D5]/40 uppercase tracking-wider">Average Buy Price</div>
                                  <div className="text-lg font-semibold text-[#F5F5F5]">
                                    {token.costBasis && token.holdings 
                                      ? fmt((parseFloat(token.costBasis) / parseFloat(token.holdings)).toString())
                                      : '—'
                                    }
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="text-xs text-[#D5D5D5]/40 uppercase tracking-wider">Current Price</div>
                                  <div className="text-lg font-semibold text-[#F5F5F5]">
                                    {token.currentValue && token.holdings 
                                      ? fmt((parseFloat(token.currentValue) / parseFloat(token.holdings)).toString())
                                      : '—'
                                    }
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="text-xs text-[#D5D5D5]/40 uppercase tracking-wider">Price Chart</div>
                                  <div className="h-16 bg-white/[0.03] rounded-lg flex items-center justify-center border border-white/10">
                                    <span className="text-xs text-[#D5D5D5]/50">Chart coming soon</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Sticky Sync Action Bar */}
      <div className="fixed bottom-0 left-0 lg:left-[240px] right-0 bg-[#08070E]/90 backdrop-blur-md border-t border-white/10 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-[#D5D5D5]/60">
            Last synced: {getRelativeTime(lastSyncTime)}
          </div>
          
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="px-6 py-2 flex items-center gap-2"
          >
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </Button>
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
