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

export default function PnLPage() {
  const [summary, setSummary] = useState<PnLSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [costBasisMethod, setCostBasisMethod] = useState<'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'>('FIFO');

  useEffect(() => { loadPnLSummary(); }, []);

  const loadPnLSummary = async () => {
    try {
      setLoading(true);
      const data = await getPnLSummary();
      setSummary(data);
      setCostBasisMethod(data.costBasisMethod as any);
    } catch (e) { console.error('Failed to load P&L:', e); }
    finally { setLoading(false); }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncTransactions();
      await loadPnLSummary();
    } catch (e) { console.error('Sync failed:', e); alert('Failed to sync transactions. Please try again.'); }
    finally { setSyncing(false); }
  };

  const handleMethodChange = async (method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE') => {
    try {
      setLoading(true);
      await updateCostBasisMethod(method);
      setCostBasisMethod(method);
      await loadPnLSummary();
    } catch (e) { alert('Failed to update cost basis method.'); }
    finally { setLoading(false); }
  };

  const fmt = (v: string) => formatUSDAsINR(parseFloat(v));
  const fmtP = (v: string) => { const n = parseFloat(v); return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Profit & Loss Calculator</h1>
          <p className="text-sm text-[#D5D5D5]/60 mt-1">FIFO, LIFO, and weighted average cost basis</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleSync} isLoading={syncing} variant="secondary" size="sm">
            {syncing ? 'Syncing…' : 'Sync Transactions'}
          </Button>
          <Button onClick={() => summary && exportPnLCSV(summary)} disabled={!summary} variant="secondary" size="sm">
            Export CSV
          </Button>
        </div>
      </div>

      {/* Cost basis method */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#F5F5F5] mb-1">Cost Basis Method</h3>
          <p className="text-sm text-[#D5D5D5]/60">Select how to calculate cost basis for P&L</p>
        </div>
        <select
          value={costBasisMethod}
          onChange={(e) => handleMethodChange(e.target.value as any)}
          className="input-dark text-sm"
          disabled={loading}
        >
          <option value="FIFO">FIFO (First In, First Out)</option>
          <option value="LIFO">LIFO (Last In, First Out)</option>
          <option value="WEIGHTED_AVERAGE">Weighted Average</option>
        </select>
      </div>

      {summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Realized P&L', value: summary.totalRealizedPnL, sub: 'From closed positions' },
              { label: 'Unrealized P&L', value: summary.totalUnrealizedPnL, sub: 'From current holdings' },
              { label: 'Total P&L', value: summary.totalPnL, sub: 'Combined total' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                <div className="text-xs font-medium text-[#D5D5D5]/60 uppercase tracking-wider mb-3">{label}</div>
                <div className={`text-3xl font-bold mb-1 ${getPnLStyle(value)}`}>{fmt(value)}</div>
                <div className="text-xs text-[#D5D5D5]/50">{sub}</div>
              </div>
            ))}
          </div>

          {/* Token breakdown table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5">
              <h2 className="text-base font-semibold text-[#F5F5F5]">Token-wise Breakdown</h2>
            </div>
            {summary.byToken.length === 0 ? (
              <div className="text-center py-16 text-[#D5D5D5]/50 text-sm">
                No P&L data. Sync transactions to see breakdown.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Token', 'Holdings', 'Cost Basis', 'Current Value', 'Unrealized P&L', 'Realized P&L', 'Total P&L', 'Gain %'].map((h, i) => (
                        <th key={h} className={`py-4 px-4 text-xs font-semibold text-[#D5D5D5]/50 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byToken.map((token) => (
                      <tr key={token.tokenSymbol} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 font-semibold text-sm text-[#F5F5F5]">{token.tokenSymbol}</td>
                        <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">{parseFloat(token.holdings || '0').toFixed(4)}</td>
                        <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">{fmt(token.costBasis || '0')}</td>
                        <td className="py-3 px-4 text-right text-sm text-[#D5D5D5]/70">{fmt(token.currentValue || '0')}</td>
                        <td className={`py-3 px-4 text-right text-sm font-medium ${getPnLStyle(token.unrealizedPnL || '0')}`}>{fmt(token.unrealizedPnL || '0')}</td>
                        <td className={`py-3 px-4 text-right text-sm font-medium ${getPnLStyle(token.realizedPnL || '0')}`}>{fmt(token.realizedPnL || '0')}</td>
                        <td className={`py-3 px-4 text-right text-sm font-bold ${getPnLStyle(token.totalPnL || '0')}`}>{fmt(token.totalPnL || '0')}</td>
                        <td className={`py-3 px-4 text-right text-sm ${getPnLStyle(token.percentageGain || '0')}`}>{fmtP(token.percentageGain || '0')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
