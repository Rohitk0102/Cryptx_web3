'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';

interface SidebarProps {
  primaryWallet?: string;
  linkedAccountCount?: number;
  onAddWallet?: () => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export default function Sidebar({
  primaryWallet,
  linkedAccountCount = 0,
  onAddWallet,
  onSync,
  isSyncing,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/dashboard/portfolio') {
      return pathname === '/dashboard' || pathname === '/dashboard/portfolio';
    }
    return pathname?.startsWith(path);
  };

  const handleSync = async () => {
    try {
      await onSync();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleNavClick = () => {
    setIsMobileOpen(false);
  };

  const handleAddWallet = () => {
    setIsMobileOpen(false);
    onAddWallet?.();
  };

  const handleSignOut = async () => {
    try {
      setIsMobileOpen(false);
      await signOut({ redirectUrl: '/' });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    if (user?.emailAddresses?.[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const navItems = [
    {
      path: '/dashboard/portfolio',
      label: 'Portfolio',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      path: '/dashboard/tracking',
      label: 'Live Tracking',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      path: '/dashboard/wallets',
      label: 'Wallets',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2m-2 0h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      path: '/dashboard/transactions',
      label: 'Transactions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      path: '/dashboard/pnl',
      label: 'Profit & Loss',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      path: '/dashboard/forecasting',
      label: 'AI Forecasting',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0A0A0F] border-r border-white/10">
      {/* Logo Section */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#00FFB2] rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-sm">C</span>
          </div>
          <span className="text-[#00FFB2] font-bold text-xl">CryptX</span>
        </div>
      </div>

      {/* Wallet Address Section */}
      {primaryWallet ? (
        <div className="p-4 border-b border-white/10">
          <div className="group relative">
            <div className="text-xs text-[#D5D5D5]/60 mb-1">Wallet Address</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[#D5D5D5]">
                {truncateAddress(primaryWallet)}
              </span>
              <button
                onClick={() => copyToClipboard(primaryWallet)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                title="Copy to clipboard"
              >
                <svg className="w-4 h-4 text-[#D5D5D5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-[#D5D5D5]/50">
              {linkedAccountCount} linked account{linkedAccountCount === 1 ? '' : 's'}
            </div>
            {onAddWallet && (
              <button
                onClick={handleAddWallet}
                className="text-xs font-medium text-[#00FFB2] hover:text-[#00FFB2]/80 transition-colors"
              >
                Link Account
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-white/10">
          <div className="text-xs text-[#D5D5D5]/60 mb-1">
            {linkedAccountCount > 0 ? 'Exchange account linked' : 'No account linked yet'}
          </div>
          <div className="mb-3 text-xs text-[#D5D5D5]/45">
            {linkedAccountCount > 0
              ? `${linkedAccountCount} linked account${linkedAccountCount === 1 ? '' : 's'} ready to sync`
              : 'Link a wallet or exchange to unlock portfolio tracking'}
          </div>
          {onAddWallet && (
            <button
              onClick={handleAddWallet}
              className="btn-brand-soft w-full rounded-lg px-3 py-2 text-sm font-semibold"
            >
              {linkedAccountCount > 0 ? 'Link Another Account' : 'Link Your First Account'}
            </button>
          )}
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={handleNavClick}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative
                ${isActive(item.path)
                  ? 'text-[#00FFB2] bg-white/5 border-l-3 border-[#00FFB2]'
                  : 'text-[#D5D5D5]/70 hover:text-[#D5D5D5] hover:bg-white/[0.04]'
                }
              `}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-white/10 space-y-4">
        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="btn-brand-solid w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold disabled:opacity-50"
        >
          {isSyncing ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Syncing...
            </>
          ) : syncSuccess ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Synced!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Transactions
            </>
          )}
        </button>

        {/* User Section */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00FFB2] rounded-full flex items-center justify-center">
              <span className="text-black font-medium text-xs">{getUserInitials()}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm text-[#D5D5D5] truncate max-w-[150px]">
                {user?.firstName || user?.emailAddresses?.[0]?.emailAddress}
              </div>
              <div className="text-xs text-[#D5D5D5]/50 truncate max-w-[150px]">
                {user?.emailAddresses?.[0]?.emailAddress || 'Signed in'}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/"
              onClick={handleNavClick}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#D5D5D5] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              Home
            </Link>
            <button
              onClick={() => void handleSignOut()}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#D5D5D5] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              title="Sign out"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 w-[240px] h-screen z-40">
        {renderSidebarContent()}
      </div>

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="btn-brand-solid lg:hidden fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full"
      >
        <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="absolute left-0 top-0 w-[280px] h-full">
            {renderSidebarContent()}
          </div>
        </div>
      )}
    </>
  );
}
