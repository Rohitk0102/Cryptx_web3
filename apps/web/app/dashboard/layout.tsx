'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import ClerkAuthSync from '@/components/auth/ClerkAuthSync';
import AddWalletModal from '@/components/wallet/AddWalletModal';
import { useApiClient } from '@/hooks/useApiClient';
import { WALLET_DATA_CHANGED_EVENT } from '@/lib/walletEvents';
import { memo } from 'react';

interface DashboardWallet {
  id: string;
  address: string;
}

interface DashboardExchangeAccount {
  id: string;
}

// Memoized top-bar header inside dashboard
const DashboardHeader = memo(function DashboardHeader({
  onBackClick,
  onAddAccountClick,
  linkedAccountCount,
}: {
  onBackClick: () => void;
  onAddAccountClick: () => void;
  linkedAccountCount: number;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        {/* Back Button */}
        <button
          onClick={onBackClick}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 transition-all group hover:bg-white/[0.08] hover:border-[#00FFB2]/40"
          title="Back to Home"
        >
          <svg
            className="w-5 h-5 text-[#D5D5D5] group-hover:text-[#00FFB2] transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium text-[#D5D5D5] group-hover:text-white transition-colors">Home</span>
        </button>

        <div>
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Dashboard</h1>
          <p className="mt-1 text-sm text-[#D5D5D5]/70">
            Move between portfolio, markets, and account management without leaving your workspace.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-[#D5D5D5]">
          {linkedAccountCount > 0
            ? `${linkedAccountCount} linked account${linkedAccountCount === 1 ? '' : 's'}`
            : 'No linked accounts yet'}
        </div>
        <button
          type="button"
          onClick={onAddAccountClick}
          className="btn-brand-solid rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Link Account
        </button>
      </div>
    </header>
  );
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [primaryWallet, setPrimaryWallet] = useState<string | undefined>();
  const [linkedAccountCount, setLinkedAccountCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const apiClient = useApiClient();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/');
    }
  }, [isLoaded, isSignedIn, router]);

  const fallbackPrimaryWallet =
    typeof user?.publicMetadata?.primaryWallet === 'string'
      ? (user.publicMetadata.primaryWallet as string)
      : undefined;

  const loadWallets = useCallback(async () => {
    if (!isSignedIn) {
      setPrimaryWallet(undefined);
      setLinkedAccountCount(0);
      return;
    }

    try {
      const [walletsResult, exchangesResult] = await Promise.allSettled([
        apiClient.get<DashboardWallet[]>('/wallets'),
        apiClient.get<DashboardExchangeAccount[]>('/exchange/accounts'),
      ]);

      const wallets = walletsResult.status === 'fulfilled' ? walletsResult.value : [];
      const exchanges = exchangesResult.status === 'fulfilled' ? exchangesResult.value : [];

      if (walletsResult.status === 'rejected') {
        console.error('Failed to load dashboard wallets:', walletsResult.reason);
      }

      if (exchangesResult.status === 'rejected') {
        console.error('Failed to load dashboard exchange accounts:', exchangesResult.reason);
      }

      setLinkedAccountCount(wallets.length + exchanges.length);
      setPrimaryWallet(wallets[0]?.address || fallbackPrimaryWallet);
    } catch (error) {
      console.error('Failed to load dashboard accounts:', error);
      setLinkedAccountCount(0);
      setPrimaryWallet(fallbackPrimaryWallet);
    }
  }, [apiClient, fallbackPrimaryWallet, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    void loadWallets();
  }, [isLoaded, isSignedIn, loadWallets]);

  useEffect(() => {
    const handleWalletsChanged = () => {
      void loadWallets();
    };

    const handleAuthCleared = () => {
      setPrimaryWallet(undefined);
      setLinkedAccountCount(0);
      setShowAddWallet(false);
    };

    window.addEventListener('auth-synced', handleWalletsChanged);
    window.addEventListener(WALLET_DATA_CHANGED_EVENT, handleWalletsChanged);
    window.addEventListener('auth-cleared', handleAuthCleared);

    return () => {
      window.removeEventListener('auth-synced', handleWalletsChanged);
      window.removeEventListener(WALLET_DATA_CHANGED_EVENT, handleWalletsChanged);
      window.removeEventListener('auth-cleared', handleAuthCleared);
    };
  }, [loadWallets]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await apiClient.post('/transactions/sync');
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#08070E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
          <div className="text-[#D5D5D5] text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#08070E] flex items-center justify-center">
        <div className="text-[#D5D5D5] text-sm">Redirecting…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08070E] text-[#F5F5F5]">
      {/* Sync Clerk auth with API client */}
      <ClerkAuthSync />

      {/* Sidebar Navigation */}
      <Sidebar 
        primaryWallet={primaryWallet}
        linkedAccountCount={linkedAccountCount}
        onAddWallet={() => setShowAddWallet(true)}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      {/* Main content area with responsive margin */}
      <div className="ml-0 lg:ml-[240px] min-h-screen">
        {/* Page content container */}
        <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
          <DashboardHeader
            onBackClick={() => router.push('/')}
            onAddAccountClick={() => setShowAddWallet(true)}
            linkedAccountCount={linkedAccountCount}
          />

          {/* Page content */}
          {children}
        </div>
      </div>

      <AddWalletModal
        isOpen={showAddWallet}
        onClose={() => setShowAddWallet(false)}
        onSuccess={() => {
          setShowAddWallet(false);
          void loadWallets();
        }}
      />
    </div>
  );
}
