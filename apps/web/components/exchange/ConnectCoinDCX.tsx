'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { exchangeApi } from '@/lib/exchangeApi';
import { setClerkAuth } from '@/lib/api';

interface ConnectCoinDCXProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function ConnectCoinDCX({ onSuccess, onClose }: ConnectCoinDCXProps) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    // Check if user is signed in
    if (!isSignedIn) {
      setError('Please sign in to connect your CoinDCX account');
      return;
    }

    // Validation
    if (!apiKey.trim()) {
      setError('API Key is required');
      return;
    }
    if (!apiSecret.trim()) {
      setError('API Secret is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Ensure we have a fresh Clerk token before making the request
      const token = await getToken();
      console.log('🔐 Clerk token obtained:', token ? 'Yes' : 'No');
      console.log('🔐 User ID:', userId);
      
      if (!token || !userId) {
        setError('Authentication failed. Please try signing in again.');
        setLoading(false);
        return;
      }

      // Manually sync the token with the API client to ensure it's fresh
      setClerkAuth(token, userId);
      console.log('✅ Token synced with API client');

      console.log('🔗 Attempting to connect CoinDCX...');
      const account = await exchangeApi.connect({
        provider: 'coindcx',
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        nickname: nickname.trim() || undefined,
      });

      console.log('✅ CoinDCX connected successfully');
      
      // Automatically sync trade history after connection
      try {
        console.log('🔄 Syncing trade history...');
        await exchangeApi.syncTradeHistory(account.id, {
          maxBatches: 10, // Fetch up to 10 batches (5000 trades max)
        });
        console.log('✅ Trade history synced successfully');
      } catch (syncErr) {
        console.error('⚠️  Failed to sync trade history:', syncErr);
        // Don't fail the connection if trade sync fails
      }
      
      // Success - notify parent
      onSuccess();
    } catch (err: any) {
      console.error('❌ Error connecting CoinDCX:', err);
      console.error('Error response:', err.response);
      
      if (err.response?.status === 401) {
        setError('Authentication failed. Please try signing out and signing in again.');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to connect CoinDCX account. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleConnect();
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-text-primary mb-2">Connect CoinDCX Account</h3>
        <p className="text-sm text-text-secondary">
          Enter your CoinDCX API credentials to track your exchange holdings
        </p>
      </div>

      <div className="space-y-4">
        {/* API Key Input */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            API Key <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your CoinDCX API Key"
            disabled={loading}
            className="w-full px-4 py-2 bg-background border border-border rounded-[2px] text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition disabled:opacity-50"
          />
        </div>

        {/* API Secret Input */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            API Secret <span className="text-error">*</span>
          </label>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your CoinDCX API Secret"
            disabled={loading}
            className="w-full px-4 py-2 bg-background border border-border rounded-[2px] text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition disabled:opacity-50"
          />
        </div>

        {/* Nickname Input */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Nickname (Optional)
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Trading Account"
            disabled={loading}
            className="w-full px-4 py-2 bg-background border border-border rounded-[2px] text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition disabled:opacity-50"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-[2px] bg-surface border border-error">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <div className="text-error text-sm font-medium mb-1">Connection Failed</div>
                <div className="text-error text-xs opacity-80">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 rounded-[2px] bg-surface border border-border">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-text-primary text-sm font-medium mb-1">How to get API credentials</div>
              <div className="text-text-secondary text-xs space-y-1">
                <p>1. Log in to your CoinDCX account</p>
                <p>2. Go to Settings → API Management</p>
                <p>3. Create a new API key with read-only permissions</p>
                <p>4. Copy the API Key and Secret here</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-border text-text-primary hover:bg-surface rounded-[2px] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={loading || !apiKey.trim() || !apiSecret.trim()}
            className="flex-1 px-4 py-2 bg-accent text-white hover:opacity-90 rounded-[2px] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </div>
            ) : (
              'Connect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
