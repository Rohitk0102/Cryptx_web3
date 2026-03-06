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
  const limit = 20;

  useEffect(() => { loadTransactions(); }, [page, tokenFilter, typeFilter, sortBy, sortOrder]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await getTransactions({ page, limit, tokenSymbol: tokenFilter || undefined, txType: typeFilter || undefined, sortBy, sortOrder });
      setTransactions(response.transactions);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (e) { console.error('Failed to load transactions:', e); }
    finally { setLoading(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const formatNum = (v: string, dec = 4) => parseFloat(v).toFixed(dec);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Transaction History</h1>
          <p className="text-sm text-[#D5D5D5]/60 mt-1">{total} transactions found</p>
        </div>
        <Button onClick={() => exportTransactionsCSV(transactions)} disabled={transactions.length === 0} variant="secondary" size="sm">
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Token */}
          <div>
            <label className="block text-xs font-medium text-[#D5D5D5]/60 mb-2 uppercase tracking-wider">Token</label>
            <input
              type="text"
              value={tokenFilter}
              onChange={(e) => { setTokenFilter(e.target.value); setPage(1); }}
              placeholder="e.g. ETH"
              className="input-dark w-full text-sm"
            />
          </div>
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-[#D5D5D5]/60 mb-2 uppercase tracking-wider">Type</label>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="input-dark w-full text-sm">
              <option value="">All Types</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="swap">Swap</option>
              <option value="transfer">Transfer</option>
              <option value="fee">Fee</option>
            </select>
          </div>
          {/* Sort */}
          <div>
            <label className="block text-xs font-medium text-[#D5D5D5]/60 mb-2 uppercase tracking-wider">Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-dark w-full text-sm">
              <option value="timestamp">Date</option>
              <option value="priceUsd">Price</option>
              <option value="quantity">Quantity</option>
            </select>
          </div>
          {/* Order */}
          <div>
            <label className="block text-xs font-medium text-[#D5D5D5]/60 mb-2 uppercase tracking-wider">Order</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')} className="input-dark w-full text-sm">
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-[#D5D5D5]/50 text-sm">
            No transactions found. Try adjusting your filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Date', 'Token', 'Type', 'Quantity', 'Price (INR)', 'Total (INR)', 'Chain'].map((h, i) => (
                      <th key={h} className={`py-4 px-4 text-xs font-semibold text-[#D5D5D5]/50 uppercase tracking-wider ${i > 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 text-xs text-[#D5D5D5]/60">{formatDate(tx.timestamp)}</td>
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
                      <td className="py-3 px-4 text-xs text-[#D5D5D5]/50">{tx.chain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-white/5">
              <div className="text-xs text-[#D5D5D5]/50">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} variant="secondary" size="sm">Prev</Button>
                <span className="text-xs text-[#D5D5D5]/60 px-2">{page} / {totalPages}</span>
                <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} variant="secondary" size="sm">Next</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
