'use client';

import { useState, useEffect } from 'react';
import { getTransactions, exportTransactionsCSV, type Transaction } from '@/lib/pnlApi';
import { Button } from '@/components/ui/Button';
import { formatUSDAsINR } from '@/lib/currency';

const TYPE_COLORS: Record<string, string> = {
  buy: 'text-[#00FFB2] bg-[#00FFB2]/10',
  sell: 'text-[#FF4C4C] bg-[#FF4C4C]/10',
  swap: 'text-[#60A5FA] bg-[#60A5FA]/10',
  transfer: 'text-[#D5D5D5] bg-white/5',
  fee: 'text-[#F59E0B] bg-[#F59E0B]/10',
};

// ─── Skeleton Components ────────────────────────────────────────────────────
const TableRowSkeleton = () => (
  <tr className="border-b border-white/[0.04]">
    {Array.from({ length: 9 }).map((_, i) => (
      <td key={i} className="py-3 px-4">
        <div className="relative overflow-hidden">
          <div className="h-4 bg-white/[0.06] rounded animate-pulse" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer" />
        </div>
      </td>
    ))}
  </tr>
);

const MobileCardSkeleton = () => (
  <div className="p-4 border-b border-white/5 last:border-b-0">
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="h-5 w-12 bg-white/[0.06] rounded-full animate-pulse" />
          <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
        </div>
        <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
      </div>
      <div className="flex justify-between items-center">
        <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
      </div>
    </div>
  </div>
);

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [tokenFilter, setTokenFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(20);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [jumpToPage, setJumpToPage] = useState('');

  useEffect(() => { loadTransactions(); }, [page, tokenFilter, typeFilter, sortBy, sortOrder, dateFrom, dateTo, limit]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await getTransactions({ 
        page, 
        limit, 
        tokenSymbol: tokenFilter || undefined, 
        txType: typeFilter || undefined, 
        sortBy, 
        sortOrder,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined
      });
      setTransactions(response.transactions);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (e) { 
      console.error('Failed to load transactions:', e); 
    } finally { 
      setLoading(false); 
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const formatNum = (v: string, dec = 4) => parseFloat(v).toFixed(dec);
  
  const truncateHash = (hash: string) => {
    if (!hash || hash.length < 12) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
  };

  const truncateAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string, type: 'hash' | 'address') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(text);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const clearFilters = () => {
    setTokenFilter('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (tokenFilter) count++;
    if (typeFilter) count++;
    if (dateFrom || dateTo) count++;
    return count;
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
      setJumpToPage('');
    }
  };

  const getSortLabel = () => {
    if (sortBy === 'timestamp') return sortOrder === 'desc' ? 'Newest' : 'Oldest';
    if (sortBy === 'priceUsd') return sortOrder === 'desc' ? 'Highest Value' : 'Lowest Value';
    return 'Newest';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Transaction History</h1>
          <p className="text-sm text-[#D5D5D5]/60 mt-1">{total} transactions found</p>
        </div>
        <Button 
          onClick={() => exportTransactionsCSV(transactions)} 
          disabled={transactions.length === 0} 
          variant="secondary" 
          size="sm"
        >
          Export CSV
        </Button>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-30 bg-[#08070E]/80 backdrop-blur-md border-b border-white/10 -mx-4 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#D5D5D5]">
                Filters
                {getActiveFilterCount() > 0 && (
                  <span className="ml-1 text-[#00FFB2]">({getActiveFilterCount()})</span>
                )}
              </span>
              {getActiveFilterCount() > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-[#D5D5D5]/60 hover:text-[#00FFB2] transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Token Search */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D5D5D5]/40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={tokenFilter}
                onChange={(e) => { setTokenFilter(e.target.value); setPage(1); }}
                placeholder="Search tokens..."
                className="w-full pl-10 pr-10 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-[#F5F5F5] placeholder-[#D5D5D5]/40 focus:border-[#00FFB2] focus:outline-none transition-colors"
              />
              {tokenFilter && (
                <button
                  onClick={() => { setTokenFilter(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D5D5D5]/40 hover:text-[#FF4C4C] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Type Dropdown */}
            <div className="relative">
              <select 
                value={typeFilter} 
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} 
                className="w-full py-2.5 px-3 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-[#F5F5F5] focus:border-[#00FFB2] focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">All Types</option>
                <option value="buy">🟢 Buy</option>
                <option value="sell">🔴 Sell</option>
                <option value="swap">🔵 Swap</option>
                <option value="transfer">⚪ Transfer</option>
                <option value="fee">🟡 Fee</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-[#D5D5D5]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="flex-1 bg-transparent text-sm text-[#F5F5F5] focus:outline-none"
                placeholder="From"
              />
              <span className="text-[#D5D5D5]/40 text-sm">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="flex-1 bg-transparent text-sm text-[#F5F5F5] focus:outline-none"
                placeholder="To"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select 
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder as 'asc' | 'desc');
                }} 
                className="w-full py-2.5 px-3 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-[#F5F5F5] focus:border-[#00FFB2] focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="timestamp-desc">Newest First</option>
                <option value="timestamp-asc">Oldest First</option>
                <option value="priceUsd-desc">Highest Value</option>
                <option value="priceUsd-asc">Lowest Value</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-[#D5D5D5]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <>
            {/* Desktop Skeleton */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#08070E]">
                      {['Date', 'Token', 'Type', 'Amount', 'Price', 'Value', 'Fee', 'Wallet', 'Tx Hash'].map((h, i) => (
                        <th key={h} className={`py-4 px-4 text-xs font-semibold text-[#D5D5D5]/50 uppercase tracking-wider sticky top-0 bg-[#08070E] ${i > 3 ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRowSkeleton key={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Skeleton */}
            <div className="lg:hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <MobileCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            {getActiveFilterCount() > 0 ? (
              // Filtered empty state
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <svg className="w-16 h-16 mx-auto text-[#D5D5D5]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#F5F5F5] mb-2">
                  No transactions match your filters
                </h3>
                <p className="text-[#D5D5D5]/60 mb-6">
                  Try adjusting your search criteria or date range.
                </p>
                <button
                  onClick={clearFilters}
                  className="text-[#00FFB2] hover:text-[#00FFB2]/80 transition-colors font-medium"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              // No transactions empty state
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <svg className="w-16 h-16 mx-auto text-[#D5D5D5]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#F5F5F5] mb-2">
                  Sync your wallets to see transactions
                </h3>
                <p className="text-[#D5D5D5]/60 mb-6">
                  Connect your wallets and sync transactions to start tracking your portfolio history.
                </p>
                <Button 
                  onClick={() => window.location.href = '/dashboard/portfolio'}
                  className="px-5"
                >
                  Sync Transactions
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#08070E] sticky top-0">
                      {['Date', 'Token', 'Type', 'Amount', 'Price', 'Value', 'Fee', 'Wallet', 'Tx Hash'].map((h, i) => (
                        <th key={h} className={`py-4 px-4 text-xs font-semibold text-[#D5D5D5]/50 uppercase tracking-wider ${i > 3 ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <>
                        <tr 
                          key={tx.id} 
                          className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer min-h-[48px]"
                          onClick={() => setExpandedRow(expandedRow === tx.id ? null : tx.id)}
                        >
                          <td className="py-3 px-4 text-xs text-[#D5D5D5]/60">
                            {new Date(tx.timestamp).toLocaleDateString()}
                            <div className="text-[10px] text-[#D5D5D5]/40">
                              {new Date(tx.timestamp).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-sm text-[#F5F5F5]">{tx.tokenSymbol}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${TYPE_COLORS[tx.txType] || 'text-[#D5D5D5] bg-white/5'}`}>
                              {tx.txType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">{formatNum(tx.quantity)}</td>
                          <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">{formatUSDAsINR(parseFloat(tx.priceUsd))}</td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-[#F5F5F5]">
                            {formatUSDAsINR(parseFloat(tx.quantity) * parseFloat(tx.priceUsd))}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-[#D5D5D5]/50">
                            {tx.feeAmount ? formatUSDAsINR(parseFloat(tx.feeAmount)) : '—'}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#D5D5D5]/50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(tx.walletAddress || '', 'address');
                              }}
                              className="hover:text-[#00FFB2] transition-colors relative"
                              title="Click to copy"
                            >
                              {truncateAddress(tx.walletAddress || '')}
                              {copiedHash === tx.walletAddress && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#00FFB2] text-black text-xs px-2 py-1 rounded">
                                  Copied!
                                </div>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#D5D5D5]/50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(tx.txHash || '', 'hash');
                              }}
                              className="hover:text-[#00FFB2] transition-colors relative"
                              title="Click to copy"
                            >
                              {truncateHash(tx.txHash || '')}
                              {copiedHash === tx.txHash && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#00FFB2] text-black text-xs px-2 py-1 rounded">
                                  Copied!
                                </div>
                              )}
                            </button>
                          </td>
                        </tr>
                        
                        {/* Expanded Row Details */}
                        {expandedRow === tx.id && (
                          <tr className="bg-white/[0.02] border-b border-white/[0.04]">
                            <td colSpan={9} className="py-4 px-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <div className="text-[#D5D5D5]/40 mb-1">Transaction Hash</div>
                                  <div className="font-mono text-[#D5D5D5] break-all">{tx.txHash}</div>
                                </div>
                                <div>
                                  <div className="text-[#D5D5D5]/40 mb-1">Chain</div>
                                  <div className="text-[#D5D5D5]">{tx.chain}</div>
                                </div>
                                <div>
                                  <div className="text-[#D5D5D5]/40 mb-1">Block Number</div>
                                  <div className="text-[#D5D5D5]">—</div>
                                </div>
                                <div>
                                  <div className="text-[#D5D5D5]/40 mb-1">Gas Used</div>
                                  <div className="text-[#D5D5D5]">—</div>
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
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                  <div className="space-y-3">
                    {/* Line 1: Type, Token, Amount, Value */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${TYPE_COLORS[tx.txType] || 'text-[#D5D5D5] bg-white/5'}`}>
                          {tx.txType}
                        </span>
                        <span className="font-semibold text-sm text-[#F5F5F5]">{tx.tokenSymbol}</span>
                        <span className="text-sm text-[#D5D5D5]/70">{formatNum(tx.quantity)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[#F5F5F5]">
                          {formatUSDAsINR(parseFloat(tx.quantity) * parseFloat(tx.priceUsd))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Line 2: Date, Tx Hash */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-[#D5D5D5]/60">
                        {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString()}
                      </div>
                      <button
                        onClick={() => copyToClipboard(tx.txHash || '', 'hash')}
                        className="text-xs text-[#D5D5D5]/50 hover:text-[#00FFB2] transition-colors relative"
                        title="Click to copy"
                      >
                        {truncateHash(tx.txHash || '')}
                        {copiedHash === tx.txHash && (
                          <div className="absolute -top-8 right-0 bg-[#00FFB2] text-black text-xs px-2 py-1 rounded">
                            Copied!
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Enhanced Pagination */}
            <div className="border-t border-white/5 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                {/* Items per page & Total count */}
                <div className="flex items-center gap-4 text-xs text-[#D5D5D5]/50">
                  <div className="flex items-center gap-2">
                    <span>Show:</span>
                    <select 
                      value={limit} 
                      onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                      className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[#F5F5F5] text-xs"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <div>
                    Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} transactions
                  </div>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-4">
                  {/* Page Jump */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#D5D5D5]/50">Go to page:</span>
                    <input
                      type="number"
                      value={jumpToPage}
                      onChange={(e) => setJumpToPage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleJumpToPage()}
                      placeholder={page.toString()}
                      min={1}
                      max={totalPages}
                      className="w-16 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[#F5F5F5] text-xs text-center"
                    />
                    <button
                      onClick={handleJumpToPage}
                      disabled={!jumpToPage}
                      className="text-[#00FFB2] hover:text-[#00FFB2]/80 disabled:text-[#D5D5D5]/30 transition-colors"
                    >
                      →
                    </button>
                  </div>

                  {/* Prev/Next */}
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => setPage(p => Math.max(1, p - 1))} 
                      disabled={page === 1} 
                      variant="secondary" 
                      size="sm"
                    >
                      ← Prev
                    </Button>
                    <span className="text-xs text-[#D5D5D5]/60 px-3">
                      Page {page} of {totalPages}
                    </span>
                    <Button 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                      disabled={page === totalPages} 
                      variant="secondary" 
                      size="sm"
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
