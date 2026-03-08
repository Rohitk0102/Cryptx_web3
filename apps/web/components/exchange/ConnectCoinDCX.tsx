'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { exchangeApi } from '@/lib/exchangeApi';
import { setClerkAuth, setClerkTokenGetter } from '@/lib/api';

interface ConnectCoinDCXProps {
  onSuccess: () => void;
  onClose: () => void;
  onConnectingChange?: (connecting: boolean) => void;
}

export default function ConnectCoinDCX({ onSuccess, onClose, onConnectingChange }: ConnectCoinDCXProps) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    onConnectingChange?.(loading);

    return () => {
      onConnectingChange?.(false);
    };
  }, [loading, onConnectingChange]);

  const getApiErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError<{ error?: string; details?: string }>(error)) {
      const status = error.response?.status;
      const serverError = error.response?.data?.error;
      const serverDetails = error.response?.data?.details;

      // Exchange credential failures should not be shown as app auth failures.
      if (serverError === 'Invalid API credentials') {
        return serverDetails || 'Invalid CoinDCX API credentials. Please check your API key and secret.';
      }

      // Only show session/auth copy for actual application auth failures.
      if (
        status === 401 &&
        ['No token provided', 'Invalid Clerk token', 'Invalid token', 'Token expired', 'User not found'].includes(
          serverError || ''
        )
      ) {
        return 'Your session expired. Please sign out and sign in again.';
      }

      return serverDetails || serverError || error.message || 'Failed to connect CoinDCX account. Please try again.';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Failed to connect CoinDCX account. Please try again.';
  };

  const handleConnect = async () => {
    if (!isLoaded) {
      setError('Authentication is still loading. Please wait a moment and try again.');
      return;
    }

    // Check if user is signed in
    if (!isSignedIn || !userId) {
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
    setSuccess('');
    let completed = false;

    try {
      // Keep the shared API client wired to the active Clerk session for this flow.
      setClerkTokenGetter(async () => await getToken(), userId);

      // Best-effort initial token sync; the interceptor can still fetch a fresh token if needed.
      const token = await getToken();
      console.log('🔐 Clerk token obtained:', token ? 'Yes' : 'No');
      console.log('🔐 User ID:', userId);

      if (token) {
        setClerkAuth(token, userId);
        console.log('✅ Token synced with API client');
      } else {
        console.warn('⚠️ Clerk token was not immediately available; continuing with dynamic token getter');
      }

      console.log('🔗 Attempting to connect CoinDCX...');
      const account = await exchangeApi.connect({
        provider: 'coindcx',
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        nickname: nickname.trim() || undefined,
      });

      console.log('✅ CoinDCX connected successfully');
      let postConnectMessage = 'CoinDCX account connected successfully. Updating your dashboard...';
      
      // Automatically sync trade history after connection
      try {
        console.log('🔄 Syncing trade history...');
        const syncResult = await exchangeApi.syncTradeHistory(account.id, {
          maxBatches: 10, // Fetch up to 10 batches (5000 trades max)
        });
        console.log('✅ Trade history synced successfully');
        if (syncResult.warning) {
          console.warn('⚠️ CoinDCX trade history warning:', syncResult.warning);
          postConnectMessage = `CoinDCX account connected. ${syncResult.warning}`;
        }
      } catch (syncErr) {
        console.error('⚠️  Failed to sync trade history:', syncErr);
        // Don't fail the connection if trade sync fails
      }

      completed = true;
      setSuccess(postConnectMessage);
      setLoading(false);
      window.setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (error: unknown) {
      console.error('❌ Error connecting CoinDCX:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error response:', error.response);
      }
      setError(getApiErrorMessage(error));
    } finally {
      if (!completed) {
        setLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleConnect();
    }
  };

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-text-primary mb-2">Connect CoinDCX Account</h3>
        <p className="text-sm text-text-secondary">
          Enter your CoinDCX API credentials to track your exchange holdings
        </p>
      </div>

      <div className="space-y-3.5">
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
            className="w-full rounded-[2px] border border-border bg-background px-3.5 py-2 text-text-primary transition placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
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
            className="w-full rounded-[2px] border border-border bg-background px-3.5 py-2 text-text-primary transition placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
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
            className="w-full rounded-[2px] border border-border bg-background px-3.5 py-2 text-text-primary transition placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-[2px] border border-error bg-surface p-3.5">
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

        {success && (
          <div className="rounded-[2px] border border-[#00FFB2]/30 bg-[#00FFB2]/10 p-3.5">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#00FFB2] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1">
                <div className="text-[#00FFB2] text-sm font-medium mb-1">Connected</div>
                <div className="text-[#00FFB2]/80 text-xs">{success}</div>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
          <div className="rounded-[2px] border border-border bg-surface p-3.5">
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
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-[2px] border border-border px-4 py-2 text-text-primary transition hover:bg-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || !apiKey.trim() || !apiSecret.trim() || !!success}
            className="btn-brand-solid flex-1 rounded-[2px] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-black/25 border-t-black rounded-full animate-spin" />
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
