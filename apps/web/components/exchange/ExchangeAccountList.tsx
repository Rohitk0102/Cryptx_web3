'use client';

import { useState, useEffect } from 'react';
import { exchangeApi, ExchangeAccount } from '@/lib/exchangeApi';

interface ExchangeAccountListProps {
  onAccountsChange?: () => void;
}

export default function ExchangeAccountList({ onAccountsChange }: ExchangeAccountListProps) {
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [syncingTradesAccountId, setSyncingTradesAccountId] = useState<string | null>(null);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    
    try {
      const data = await exchangeApi.getAccounts();
      setAccounts(data);
    } catch (err: any) {
      console.error('Error fetching exchange accounts:', err);
      setError('Failed to load exchange accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncingAccountId(accountId);
    setError('');
    setNotice('');

    try {
      await exchangeApi.syncBalances(accountId);
      
      // Refresh accounts to get updated lastSyncedAt
      await fetchAccounts();
      
      // Notify parent to refresh portfolio
      if (onAccountsChange) {
        onAccountsChange();
      }
    } catch (err: any) {
      console.error('Error syncing balances:', err);
      setError(err.response?.data?.error || 'Failed to sync balances');
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleSyncTrades = async (accountId: string) => {
    setSyncingTradesAccountId(accountId);
    setError('');
    setNotice('');

    try {
      const result = await exchangeApi.syncTradeHistory(accountId, {
        maxBatches: 10, // Fetch up to 10 batches (5000 trades max)
      });
      
      console.log(`✅ Synced ${result.tradeCount} trades from CoinDCX`);

      if (result.warning) {
        setNotice(result.warning);
      } else if (result.newTradesCount === 0 && result.tradeCount === 0) {
        setNotice('CoinDCX did not return any trade history for this API key.');
      }
      
      // Refresh accounts to get updated lastSyncedAt
      await fetchAccounts();
      
      // Notify parent to refresh portfolio (trades are converted to PnL transactions)
      if (onAccountsChange) {
        onAccountsChange();
      }
    } catch (err: any) {
      console.error('Error syncing trade history:', err);
      setError(err.response?.data?.error || 'Failed to sync trade history');
    } finally {
      setSyncingTradesAccountId(null);
    }
  };

  const handleRemove = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this exchange account?')) {
      return;
    }

    setRemovingAccountId(accountId);
    setError('');
    setNotice('');

    try {
      await exchangeApi.deleteAccount(accountId);
      
      // Refresh accounts list
      await fetchAccounts();
      
      // Notify parent to refresh portfolio
      if (onAccountsChange) {
        onAccountsChange();
      }
    } catch (err: any) {
      console.error('Error removing account:', err);
      setError(err.response?.data?.error || 'Failed to remove account');
    } finally {
      setRemovingAccountId(null);
    }
  };

  const formatLastSync = (lastSyncedAt?: string) => {
    if (!lastSyncedAt) return 'Never synced';
    
    const date = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-secondary mt-3">Loading exchange accounts...</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🪙</div>
        <p className="text-sm text-text-secondary">No exchange accounts connected</p>
        <p className="text-xs text-text-secondary mt-1">Connect your CoinDCX account to track exchange holdings</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-4 rounded-[2px] bg-surface border border-error">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-error text-sm font-medium">{error}</div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-[2px] bg-[#F59E0B]/10 border border-[#F59E0B]/30">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-[#FCD34D] text-sm font-medium">{notice}</div>
            </div>
          </div>
        </div>
      )}

      {accounts.map((account) => (
        <div
          key={account.id}
          className="p-4 border border-border rounded-[2px] hover:border-accent transition"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🪙</span>
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    {account.nickname || 'CoinDCX Account'}
                  </div>
                  <div className="text-xs text-text-secondary uppercase">
                    {account.provider}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-text-secondary">
                  Last synced: {formatLastSync(account.lastSyncedAt)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSync(account.id)}
                disabled={syncingAccountId === account.id || syncingTradesAccountId === account.id || removingAccountId === account.id}
                className="px-3 py-1.5 text-xs font-medium border border-border text-text-primary hover:bg-surface rounded-[2px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {syncingAccountId === account.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Sync Balances</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleSyncTrades(account.id)}
                disabled={syncingAccountId === account.id || syncingTradesAccountId === account.id || removingAccountId === account.id}
                className="px-3 py-1.5 text-xs font-medium border border-border text-text-primary hover:bg-surface rounded-[2px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {syncingTradesAccountId === account.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Sync Trades</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleRemove(account.id)}
                disabled={syncingAccountId === account.id || syncingTradesAccountId === account.id || removingAccountId === account.id}
                className="px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 rounded-[2px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {removingAccountId === account.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-error border-t-transparent rounded-full animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Remove</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
