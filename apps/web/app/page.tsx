'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk, useUser, SignInButton } from '@clerk/nextjs';
import CryptoMotionBackground from '@/components/home/CryptoMotionBackground';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import ClerkAuthSync from '@/components/auth/ClerkAuthSync';
import { exchangeApi } from '@/lib/exchangeApi';
import { walletApi } from '@/lib/portfolioApi';

// Feature items for the home grid
const features = [
  {
    path: '/dashboard/portfolio',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Portfolio Tracking',
    desc: 'Monitor all your assets across multiple chains in one unified dashboard.',
    cta: 'Open portfolio',
  },
  {
    path: '/dashboard/tracking',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Live Price Feeds',
    desc: 'Real-time market data with institutional-grade accuracy and refresh rates.',
    cta: 'View live tracking',
  },
  {
    path: '/dashboard/wallets',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a5 5 0 00-10 0v2m-2 0h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
      </svg>
    ),
    title: 'Wallets & Exchanges',
    desc: 'Link wallets and exchange accounts from one place without leaving the dashboard.',
    cta: 'Manage accounts',
  },
  {
    path: '/dashboard/pnl',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'P&L Calculator',
    desc: 'FIFO, LIFO, and weighted average cost basis methods for tax reporting.',
    cta: 'Review P&L',
  },
];

const signedInNavItems = [
  { label: 'Portfolio', path: '/dashboard/portfolio' },
  { label: 'Tracking', path: '/dashboard/tracking' },
  { label: 'Wallets', path: '/dashboard/wallets' },
];

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [hasLinkedAccounts, setHasLinkedAccounts] = useState<boolean | null>(null);
  const [walletCount, setWalletCount] = useState(0);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [checkingAccounts, setCheckingAccounts] = useState(false);
  const [authSynced, setAuthSynced] = useState(false);

  const loadLinkedAccounts = useCallback(async () => {
    setCheckingAccounts(true);
    try {
      const [walletsResult, exchangesResult] = await Promise.allSettled([
        walletApi.getWallets(),
        exchangeApi.getAccounts(),
      ]);

      const wallets = walletsResult.status === 'fulfilled' ? walletsResult.value : [];
      const exchanges = exchangesResult.status === 'fulfilled' ? exchangesResult.value : [];

      if (walletsResult.status === 'rejected') {
        console.error('Error checking wallets:', walletsResult.reason);
      }

      if (exchangesResult.status === 'rejected') {
        console.error('Error checking exchange accounts:', exchangesResult.reason);
      }

      setWalletCount(wallets.length);
      setExchangeCount(exchanges.length);
      setHasLinkedAccounts(wallets.length + exchanges.length > 0);
    } catch (error) {
      console.error('Error checking linked accounts:', error);
      setWalletCount(0);
      setExchangeCount(0);
      setHasLinkedAccounts(false);
    } finally {
      setCheckingAccounts(false);
    }
  }, []);

  const handleAuthSynced = useCallback(() => {
    setAuthSynced(true);
    void loadLinkedAccounts();
  }, [loadLinkedAccounts]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setHasLinkedAccounts(null);
      setWalletCount(0);
      setExchangeCount(0);
      setAuthSynced(false);
    }
  }, [isLoaded, isSignedIn]);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: '/' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }

    if (user?.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }

    if (user?.emailAddresses?.[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress.slice(0, 2).toUpperCase();
    }

    return 'CX';
  };

  const displayName =
    user?.firstName ||
    user?.username ||
    user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
    'Trader';

  const totalLinkedAccounts = walletCount + exchangeCount;

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-[#08070E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ─── Signed-in states ───────────────────────────────────────────────────────
  const isLoading = isSignedIn && (!authSynced || checkingAccounts);
  const showConnectWallet = isSignedIn && authSynced && !checkingAccounts && hasLinkedAccounts === false;
  const showDashboard = isSignedIn && authSynced && !checkingAccounts && hasLinkedAccounts === true;
  const primaryActionPath = showDashboard ? '/dashboard/portfolio' : '/dashboard/wallets';
  const getFeatureTarget = (path: string) => {
    if (!isSignedIn) {
      return null;
    }

    if (showConnectWallet && path !== '/dashboard/wallets') {
      return '/dashboard/wallets';
    }

    return path;
  };

  return (
    <main className="min-h-screen bg-[#08070E] text-[#F5F5F5] overflow-x-hidden font-[DM_Sans,sans-serif]">
      {isSignedIn && <ClerkAuthSync onAuthSynced={handleAuthSynced} />}

      {/* ── Glass Navbar ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-nav h-[72px] flex items-center justify-center">
        <nav className="max-w-[1184px] w-full px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00FFB2]/10 border border-[#00FFB2]/30 flex items-center justify-center">
              <span className="text-[#00FFB2] font-bold text-sm">C</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">CryptX</span>
          </div>

          {isSignedIn && (
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2 py-2">
              {signedInNavItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-[#D5D5D5] transition hover:bg-white/[0.05] hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Right */}
          <div className="flex items-center gap-3">
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="rounded-lg border border-[#00FFB2]/25 bg-[#00FFB2] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_24px_0_rgba(42,240,124,0.22)] ring-1 ring-[#00FFB2]/20 transition-all duration-200 hover:scale-105 hover:shadow-[0_0_30px_0_rgba(42,240,124,0.28)]">
                  Sign In
                </button>
              </SignInButton>
            ) : (
              <>
                <div className="hidden xl:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00FFB2]/15 text-sm font-semibold text-[#00FFB2]">
                    {getInitials()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                    <div className="truncate text-xs text-[#D5D5D5]/70">
                      {totalLinkedAccounts > 0
                        ? `${walletCount} wallet${walletCount === 1 ? '' : 's'} • ${exchangeCount} exchange${exchangeCount === 1 ? '' : 's'}`
                        : 'No linked accounts yet'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigate(primaryActionPath)}
                  disabled={isLoading}
                  className="rounded-lg border border-[#00FFB2]/25 bg-[#00FFB2] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_24px_0_rgba(42,240,124,0.22)] ring-1 ring-[#00FFB2]/20 transition-all duration-200 hover:scale-105 hover:shadow-[0_0_30px_0_rgba(42,240,124,0.28)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isLoading ? 'Preparing...' : showDashboard ? 'Open Dashboard' : 'Link Account'}
                </button>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-lg border border-white/14 bg-[#10131D]/88 px-4 py-2 text-sm font-medium text-[#E8EDF5] shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/24 hover:bg-[#151A26]/94 hover:text-white"
                >
                  Log out
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative isolate flex flex-col items-center justify-center min-h-screen pt-[72px] pb-24 px-6">
        <CryptoMotionBackground />

        <div className="relative z-10 flex w-full max-w-[1080px] flex-col items-center">
          {/* Badge */}
          <div className="mb-6 px-4 py-1.5 rounded-full border border-[#00FFB2]/30 bg-[#00FFB2]/5 text-[#00FFB2] text-xs font-medium tracking-widest uppercase flex items-center gap-2 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFB2] animate-pulse" />
            {isSignedIn
              ? showDashboard
                ? 'Workspace ready'
                : isLoading
                  ? 'Preparing your workspace'
                  : 'Link your first account'
              : 'Institutional-grade crypto tools'}
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-bold text-center leading-[1.05] tracking-tight max-w-[800px] mb-6">
            {isSignedIn ? (
              <>
                Welcome back, <span className="text-[#00FFB2]">{displayName}</span>
                <br />
                Run your crypto workspace
              </>
            ) : (
              <>
                Master Your{' '}
                <span className="text-[#00FFB2]">Digital</span>
                <br />
                Wealth Health
              </>
            )}
          </h1>

          <p className="text-[#D5D5D5] text-lg text-center max-w-[560px] leading-relaxed mb-10">
            {isSignedIn
              ? 'Jump straight into portfolio monitoring, linked accounts, live market tracking, and tax-ready reporting from one clean workspace.'
              : 'The high-performance dashboard for elite traders and asset managers. Track, analyse, and grow your crypto portfolio with AI-powered insights.'}
          </p>

          {/* CTA area */}
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Step 1: Not signed in */}
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button className="flex items-center gap-3 rounded-xl border border-[#00FFB2]/25 bg-[#00FFB2] px-8 py-4 text-base font-semibold text-black shadow-[0_0_34px_0_rgba(42,240,124,0.24)] ring-1 ring-[#00FFB2]/20 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_42px_0_rgba(42,240,124,0.3)]">
                  Start Your Journey
                  <div className="w-5 h-5 bg-black/20 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </SignInButton>
            )}

            {/* Step 2: Loading */}
            {isLoading && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
                <p className="text-[#D5D5D5] text-sm">
                  {!authSynced ? 'Setting up your session...' : 'Loading your linked accounts...'}
                </p>
              </div>
            )}

            {/* Step 3: No wallets - connect */}
            {showConnectWallet && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-[#D5D5D5] text-base max-w-sm text-center">
                  Link a wallet or exchange account to unlock portfolio tracking, live markets, and P&L analysis.
                </p>
                <ConnectWallet
                  showConnectButton={true}
                  onWalletConnected={() => {
                    void loadLinkedAccounts();
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleNavigate('/dashboard/wallets')}
                  className="rounded-lg border border-white/14 bg-[#10131D]/88 px-5 py-3 text-sm font-medium text-[#E8EDF5] shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/24 hover:bg-[#151A26]/94 hover:text-white"
                >
                  Open account manager
                </button>
              </div>
            )}

            {/* Step 4: Has wallets - go to dashboard */}
            {showDashboard && (
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleNavigate('/dashboard/portfolio')}
                    className="flex items-center gap-3 rounded-xl border border-[#00FFB2]/25 bg-[#00FFB2] px-8 py-4 text-base font-semibold text-black shadow-[0_0_34px_0_rgba(42,240,124,0.24)] ring-1 ring-[#00FFB2]/20 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_42px_0_rgba(42,240,124,0.3)]"
                  >
                    Open Portfolio
                    <div className="w-5 h-5 bg-black/20 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigate('/dashboard/wallets')}
                    className="rounded-xl border border-white/14 bg-[#10131D]/88 px-6 py-4 text-sm font-medium text-[#E8EDF5] shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/24 hover:bg-[#151A26]/94 hover:text-white"
                  >
                    Manage Accounts
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigate('/dashboard/tracking')}
                    className="rounded-xl border border-white/14 bg-[#10131D]/88 px-6 py-4 text-sm font-medium text-[#E8EDF5] shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/24 hover:bg-[#151A26]/94 hover:text-white"
                  >
                    View Live Tracking
                  </button>
                </div>

                <div className="grid w-full max-w-[960px] gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left backdrop-blur-sm">
                    <div className="text-xs uppercase tracking-[0.2em] text-[#D5D5D5]/60">Linked wallets</div>
                    <div className="mt-3 text-3xl font-bold text-white">{walletCount}</div>
                    <p className="mt-2 text-sm text-[#D5D5D5]/70">Keep every on-chain address in one portfolio view.</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left backdrop-blur-sm">
                    <div className="text-xs uppercase tracking-[0.2em] text-[#D5D5D5]/60">Connected exchanges</div>
                    <div className="mt-3 text-3xl font-bold text-white">{exchangeCount}</div>
                    <p className="mt-2 text-sm text-[#D5D5D5]/70">Monitor exchange balances alongside your wallets.</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left backdrop-blur-sm">
                    <div className="text-xs uppercase tracking-[0.2em] text-[#D5D5D5]/60">Next best step</div>
                    <div className="mt-3 text-xl font-semibold text-white">Review your latest positions</div>
                    <p className="mt-2 text-sm text-[#D5D5D5]/70">Open the dashboard to sync, analyze, and act faster.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Social proof */}
            {!isSignedIn && (
              <div className="flex flex-col items-center gap-1 mt-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-[#F5F5F5]" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                  <span className="text-sm text-[#F5F5F5] ml-2 font-medium">4.9</span>
                </div>
                <p className="text-xs text-[#D5D5D5]">Trusted by thousands of traders</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24 max-w-[1184px] mx-auto">
        {/* Divider line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-20" />

        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#F5F5F5] mb-3">
            {isSignedIn ? 'Quick navigation' : 'Everything you need'}
          </h2>
          <p className="text-[#D5D5D5] text-base">
            {isSignedIn
              ? 'Clear shortcuts to the actions you use most often.'
              : 'A complete toolkit for professional crypto portfolio management.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <button
              key={i}
              type="button"
              className="group text-left bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300"
              onClick={() => {
                const target = getFeatureTarget(f.path);
                if (target) {
                  handleNavigate(target);
                }
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FFB2]/10 border border-[#00FFB2]/20 flex items-center justify-center text-[#00FFB2] mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-[#F5F5F5] mb-2">{f.title}</h3>
              <p className="text-sm text-[#D5D5D5] leading-relaxed">{f.desc}</p>
              {isSignedIn && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#00FFB2]">{f.cta}</span>
                  <span className="text-[#D5D5D5]/60">
                    {showConnectWallet && f.path !== '/dashboard/wallets' ? 'Link an account first' : 'Open'}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
