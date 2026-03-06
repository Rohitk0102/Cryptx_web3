'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard/DashboardNav';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import ClerkAuthSync from '@/components/auth/ClerkAuthSync';
import { memo } from 'react';

// Memoized top-bar header inside dashboard
const DashboardHeader = memo(function DashboardHeader({
  userAddress,
  onBackClick,
}: {
  userAddress?: string;
  onBackClick: () => void;
}) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        {/* Back Button */}
        <button
          onClick={onBackClick}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#00FFB2]/40 transition-all group"
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
        </button>

        <div>
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Dashboard</h1>
          {userAddress && (
            <p className="text-[#D5D5D5] text-xs mt-0.5 font-mono opacity-60 truncate max-w-[240px]">
              {userAddress}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ConnectWallet />
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

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/');
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (user?.publicMetadata?.primaryWallet) {
      setPrimaryWallet(user.publicMetadata.primaryWallet as string);
    }
  }, [user]);

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
    <div className="min-h-screen bg-[#08070E] text-[#F5F5F5] pb-20">
      {/* Sync Clerk auth with API client */}
      <ClerkAuthSync />

      {/* Navigation Tabs */}
      <DashboardNav />

      {/* Page content container */}
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        <DashboardHeader
          userAddress={primaryWallet || user?.primaryEmailAddress?.emailAddress}
          onBackClick={() => router.push('/')}
        />

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
