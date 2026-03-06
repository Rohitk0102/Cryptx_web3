'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, SignInButton } from '@clerk/nextjs';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import ClerkAuthSync from '@/components/auth/ClerkAuthSync';
import { walletApi } from '@/lib/portfolioApi';
import { Button } from '@/components/ui/Button';

// Feature items for the home grid
const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Portfolio Tracking',
    desc: 'Monitor all your assets across multiple chains in one unified dashboard.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Live Price Feeds',
    desc: 'Real-time market data with institutional-grade accuracy and refresh rates.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI Forecasting',
    desc: 'Machine-learning powered price predictions with risk analysis for smarter decisions.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'P&L Calculator',
    desc: 'FIFO, LIFO, and weighted average cost basis methods for tax reporting.',
  },
];

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [hasWallets, setHasWallets] = useState<boolean | null>(null);
  const [checkingWallets, setCheckingWallets] = useState(false);
  const [authSynced, setAuthSynced] = useState(false);

  const checkWallets = useCallback(async () => {
    setCheckingWallets(true);
    try {
      const wallets = await walletApi.getWallets();
      setHasWallets(wallets.length > 0);
    } catch (error) {
      console.error('Error checking wallets:', error);
      setHasWallets(false);
    } finally {
      setCheckingWallets(false);
    }
  }, []);

  const handleAuthSynced = useCallback(() => {
    setAuthSynced(true);
    checkWallets();
  }, [checkWallets]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setHasWallets(null);
      setAuthSynced(false);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-[#08070E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ─── Signed-in states ───────────────────────────────────────────────────────
  const isLoading = isSignedIn && (!authSynced || checkingWallets);
  const showConnectWallet = isSignedIn && authSynced && !checkingWallets && hasWallets === false;
  const showDashboard = isSignedIn && authSynced && !checkingWallets && hasWallets === true;

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

          {/* Right */}
          <div className="flex items-center gap-4">
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="bg-[#00FFB2] text-black font-semibold px-5 py-2 rounded-lg text-sm shadow-[0_0_24px_0_rgba(42,240,124,0.3)] hover:scale-105 transition-all duration-200">
                  Sign In
                </button>
              </SignInButton>
            ) : showDashboard ? (
              <button
                onClick={() => router.push('/dashboard/portfolio')}
                className="bg-[#00FFB2] text-black font-semibold px-5 py-2 rounded-lg text-sm shadow-[0_0_24px_0_rgba(42,240,124,0.3)] hover:scale-105 transition-all duration-200"
              >
                Open Dashboard
              </button>
            ) : null}
          </div>
        </nav>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen pt-[72px] pb-24 px-6">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="w-[600px] h-[600px] rounded-full bg-[#00FFB2] opacity-[0.04] blur-[120px]" />
          <div className="absolute w-[300px] h-[300px] rounded-full bg-[#00FFB2] opacity-[0.06] blur-[80px]" />
        </div>

        {/* Badge */}
        <div className="relative mb-6 px-4 py-1.5 rounded-full border border-[#00FFB2]/30 bg-[#00FFB2]/5 text-[#00FFB2] text-xs font-medium tracking-widest uppercase flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00FFB2] animate-pulse" />
          Institutional-grade crypto tools
        </div>

        {/* Title */}
        <h1 className="relative text-5xl md:text-7xl font-bold text-center leading-[1.05] tracking-tight max-w-[800px] mb-6">
          Master Your{' '}
          <span className="text-[#00FFB2]">Digital</span>
          <br />
          Wealth Health
        </h1>

        <p className="relative text-[#D5D5D5] text-lg text-center max-w-[560px] leading-relaxed mb-10">
          The high-performance dashboard for elite traders and asset managers.
          Track, analyse, and grow your crypto portfolio with AI-powered insights.
        </p>

        {/* CTA area */}
        <div className="relative flex flex-col items-center gap-6">
          {/* Step 1: Not signed in */}
          {!isSignedIn && (
            <SignInButton mode="modal">
              <button className="flex items-center gap-3 bg-[#00FFB2] text-black font-semibold px-8 py-4 rounded-xl text-base shadow-[0_0_34px_0_rgba(42,240,124,0.35)] hover:scale-105 transition-all duration-300">
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
                {!authSynced ? 'Setting up your session…' : 'Loading your wallets…'}
              </p>
            </div>
          )}

          {/* Step 3: No wallets - connect */}
          {showConnectWallet && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-[#D5D5D5] text-base max-w-sm text-center">
                Connect your wallet to start tracking your portfolio.
              </p>
              <ConnectWallet showConnectButton={true} onWalletConnected={() => setHasWallets(true)} />
            </div>
          )}

          {/* Step 4: Has wallets - go to dashboard */}
          {showDashboard && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/portfolio')}
                className="flex items-center gap-3 bg-[#00FFB2] text-black font-semibold px-8 py-4 rounded-xl text-base shadow-[0_0_34px_0_rgba(42,240,124,0.35)] hover:scale-105 transition-all duration-300"
              >
                Open Dashboard
                <div className="w-5 h-5 bg-black/20 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              <ConnectWallet />
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
      </section>

      {/* ── Feature Grid ─────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24 max-w-[1184px] mx-auto">
        {/* Divider line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-20" />

        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#F5F5F5] mb-3">Everything you need</h2>
          <p className="text-[#D5D5D5] text-base">A complete toolkit for professional crypto portfolio management.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="group bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 cursor-default"
              onClick={() => isSignedIn && showDashboard && router.push('/dashboard/portfolio')}
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FFB2]/10 border border-[#00FFB2]/20 flex items-center justify-center text-[#00FFB2] mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-[#F5F5F5] mb-2">{f.title}</h3>
              <p className="text-sm text-[#D5D5D5] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
