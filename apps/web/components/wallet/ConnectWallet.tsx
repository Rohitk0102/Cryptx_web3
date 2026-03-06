'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import apiClient from '@/lib/api';
import { connectMetaMask, connectWalletConnectProvider, connectCoinbase } from '@/lib/web3/wallet';
import { walletApi } from '@/lib/portfolioApi';
import { setClerkAuth } from '@/lib/api';
import ConnectCoinDCX from '@/components/exchange/ConnectCoinDCX';

interface Wallet {
    id: string;
    address: string;
    provider: string;
    nickname?: string;
    chainTypes: string[];
}

interface ConnectWalletProps {
    onWalletConnected?: () => void;
    /** Force showing the connect button instead of the dropdown when signed in */
    showConnectButton?: boolean;
}

export default function ConnectWallet({ onWalletConnected, showConnectButton = false }: ConnectWalletProps = {}) {
    const { isSignedIn, user } = useUser();
    const { getToken } = useAuth();
    const [showWalletOptions, setShowWalletOptions] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [loadingWallets, setLoadingWallets] = useState(false);
    const [error, setError] = useState<string>('');
    const [showCoinDCXForm, setShowCoinDCXForm] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                // Don't close if wallet options modal is about to open
                if (!showWalletOptions) {
                    setShowDropdown(false);
                }
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown, showWalletOptions]);

    // Fetch wallets when authenticated (on mount and when dropdown opens)
    useEffect(() => {
        if (isSignedIn) {
            fetchWallets();
        }
    }, [isSignedIn]);
    
    // Also refresh when dropdown opens
    useEffect(() => {
        if (isSignedIn && showDropdown) {
            fetchWallets();
        }
    }, [showDropdown]);

    const fetchWallets = async () => {
        // Don't fetch if user is not properly authenticated
        if (!user || !user.id) {
            console.log('⚠️ Cannot fetch wallets - user not authenticated');
            setWallets([]);
            return;
        }

        setLoadingWallets(true);
        try {
            // Get Clerk session token for API authorization
            const token = await getToken();
            console.log('📡 Fetching wallets for Clerk user:', user.id);

            const response = await apiClient.get('/wallets', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Clerk-User-Id': user.id
                }
            });
            console.log('✅ Fetched wallets:', response.data);
            // API returns array directly, not wrapped in wallets property
            setWallets(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            console.error('❌ Error fetching wallets:', err);
            // Don't show error to user if it's just an auth issue
            if (err.message !== 'No authentication token') {
                console.error('Wallet fetch error details:', err.response?.data);
            }
            setWallets([]);
        } finally {
            setLoadingWallets(false);
        }
    };

    const handleDisconnectWallet = async (walletId: string, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent dropdown from closing

        try {
            await apiClient.delete(`/wallets/${walletId}`);
            // Refresh wallet list
            await fetchWallets();
        } catch (err) {
            console.error('Error disconnecting wallet:', err);
        }
    };

    const getWalletLogo = (provider: string) => {
        switch (provider.toLowerCase()) {
            case 'metamask':
                return <span className="text-2xl">🦊</span>;
            case 'coinbase':
                return <Image src="/coinbase-logo.png" alt="Coinbase" width={24} height={24} className="rounded" />;
            case 'walletconnect':
                return (
                    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                        <path d="M9.58 11.8C13.62 7.76 20.38 7.76 24.42 11.8L24.94 12.32C25.14 12.52 25.14 12.84 24.94 13.04L23.36 14.62C23.26 14.72 23.1 14.72 23 14.62L22.26 13.88C19.46 11.08 14.54 11.08 11.74 13.88L10.94 14.68C10.84 14.78 10.68 14.78 10.58 14.68L9 13.1C8.8 12.9 8.8 12.58 9 12.38L9.58 11.8ZM27.76 15.32L29.14 16.7C29.34 16.9 29.34 17.22 29.14 17.42L22.26 24.3C22.06 24.5 21.74 24.5 21.54 24.3L16.06 18.82C16.01 18.77 15.93 18.77 15.88 18.82L10.4 24.3C10.2 24.5 9.88 24.5 9.68 24.3L2.8 17.42C2.6 17.22 2.6 16.9 2.8 16.7L4.18 15.32C4.38 15.12 4.7 15.12 4.9 15.32L10.38 20.8C10.43 20.85 10.51 20.85 10.56 20.8L16.04 15.32C16.24 15.12 16.56 15.12 16.76 15.32L22.24 20.8C22.29 20.85 22.37 20.85 22.42 20.8L27.9 15.32C28.1 15.12 28.42 15.12 28.62 15.32H27.76Z" fill="#3B99FC" />
                    </svg>
                );
            default:
                return <span className="text-2xl">💼</span>;
        }
    };

    const walletOptions = [
        {
            name: 'MetaMask',
            description: 'Connect with MetaMask browser extension',
            logo: <span className="text-3xl">🦊</span>,
            providerType: 'metamask' as const,
        },
        {
            name: 'WalletConnect',
            description: 'Scan with WalletConnect to connect',
            logo: (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M9.58 11.8C13.62 7.76 20.38 7.76 24.42 11.8L24.94 12.32C25.14 12.52 25.14 12.84 24.94 13.04L23.36 14.62C23.26 14.72 23.1 14.72 23 14.62L22.26 13.88C19.46 11.08 14.54 11.08 11.74 13.88L10.94 14.68C10.84 14.78 10.68 14.78 10.58 14.68L9 13.1C8.8 12.9 8.8 12.58 9 12.38L9.58 11.8ZM27.76 15.32L29.14 16.7C29.34 16.9 29.34 17.22 29.14 17.42L22.26 24.3C22.06 24.5 21.74 24.5 21.54 24.3L16.06 18.82C16.01 18.77 15.93 18.77 15.88 18.82L10.4 24.3C10.2 24.5 9.88 24.5 9.68 24.3L2.8 17.42C2.6 17.22 2.6 16.9 2.8 16.7L4.18 15.32C4.38 15.12 4.7 15.12 4.9 15.32L10.38 20.8C10.43 20.85 10.51 20.85 10.56 20.8L16.04 15.32C16.24 15.12 16.56 15.12 16.76 15.32L22.24 20.8C22.29 20.85 22.37 20.85 22.42 20.8L27.9 15.32C28.1 15.12 28.42 15.12 28.62 15.32H27.76Z" fill="#3B99FC" />
                </svg>
            ),
            providerType: 'walletconnect' as const,
        },
        {
            name: 'Coinbase Wallet',
            description: 'Connect with Coinbase Wallet',
            logo: <Image src="/coinbase-logo.png" alt="Coinbase" width={32} height={32} className="rounded" />,
            providerType: 'coinbase' as const,
        },
        {
            name: 'CoinDCX',
            description: 'Connect your CoinDCX exchange account',
            logo: <span className="text-3xl">🪙</span>,
            providerType: 'coindcx' as const,
        }
    ];

    const handleWalletConnect = async (providerType: 'metamask' | 'walletconnect' | 'coinbase' | 'coindcx') => {
        // Handle CoinDCX separately - show form instead of connecting
        if (providerType === 'coindcx') {
            setShowCoinDCXForm(true);
            return;
        }

        setConnectingWallet(providerType);
        setError('');

        try {
            console.log(`🔌 Connecting ${providerType} wallet for Clerk user...`);

            // Step 1: Connect to wallet provider
            let walletConnection;
            if (providerType === 'metamask') {
                walletConnection = await connectMetaMask();
            } else if (providerType === 'walletconnect') {
                walletConnection = await connectWalletConnectProvider();
            } else if (providerType === 'coinbase') {
                walletConnection = await connectCoinbase();
            } else {
                throw new Error('Invalid provider type');
            }

            console.log('✅ Wallet connected:', walletConnection.address);

            // Step 2: Ensure Clerk auth is synced
            const token = await getToken();
            if (token && user) {
                setClerkAuth(token, user.id);
            }

            // Step 3: Save wallet to backend
            console.log('💾 Saving wallet to backend...');
            await walletApi.addWallet({
                address: walletConnection.address,
                provider: providerType,
                chainTypes: ['ethereum', 'polygon', 'bsc'],
            });

            console.log('✅ Wallet saved successfully');

            // Step 4: Refresh wallet list
            await fetchWallets();

            // Only close modal on success
            setShowWalletOptions(false);
            setConnectingWallet(null);
            setError('');
            
            // Notify parent that wallet was connected
            if (onWalletConnected) {
                onWalletConnected();
            }
        } catch (err: any) {
            console.error('❌ Wallet connection error:', err);
            
            // Keep modal open on error
            setShowWalletOptions(true);
            setConnectingWallet(null);
            
            if (err.code === 'METAMASK_NOT_INSTALLED' || err.message?.includes('MetaMask is not installed')) {
                setError('MetaMask not detected. Please install the MetaMask extension.');
            } else if (err.message?.includes('User rejected') || err.message?.includes('rejected') || err.message?.includes('cancelled')) {
                setError('Connection request was rejected. Please try again.');
            } else if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (err.message) {
                setError(err.message);
            } else {
                setError('Failed to connect wallet');
            }
        }
    };

    const handleCloseModal = () => {
        setShowWalletOptions(false);
        setShowCoinDCXForm(false);
        setConnectingWallet(null);
        setError('');
    };

    const handleCoinDCXSuccess = async () => {
        // Refresh wallet list to include exchange accounts
        await fetchWallets();
        
        // Close modal
        handleCloseModal();
        
        // Notify parent
        if (onWalletConnected) {
            onWalletConnected();
        }
    };

    const handleCoinDCXBack = () => {
        setShowCoinDCXForm(false);
        setError('');
    };

    const handleDisconnect = async () => {
        // Clear local wallet list state only
        // Note: This does NOT remove wallets from the database
        // Use the "Remove" button on individual wallets to delete them
        // For Clerk users, signing out should be done via Clerk's sign-out
        setWallets([]);
        setShowDropdown(false);
    };

    // Show dropdown only if signed in and not forcing the connect button
    if (isSignedIn && user && !showConnectButton) {
        // Get primary wallet address from first wallet or fallback to email
        const displayAddress = wallets.length > 0 
            ? `${wallets[0].address.slice(0, 6)}...${wallets[0].address.slice(-4)}`
            : user.primaryEmailAddress?.emailAddress || 'Connected';
        
        return (
            <>
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-3 border border-border bg-surface px-4 py-2 rounded-[2px] hover:border-accent transition"
                    >
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-text-primary">
                                {displayAddress}
                            </span>
                            <span className="text-xs text-success uppercase tracking-wide">
                                Connected
                            </span>
                        </div>
                        <svg
                            className={`w-4 h-4 text-text-secondary transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Dropdown */}
                    {showDropdown && (
                        <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-[2px] shadow-lg z-50">
                            <div className="p-4 border-b border-border">
                                <div className="text-sm font-semibold text-text-primary mb-1">Connected Wallets</div>
                                <div className="text-xs text-text-secondary">Manage your linked wallets</div>
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {loadingWallets ? (
                                    <div className="p-4 text-center">
                                        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                                    </div>
                                ) : wallets.length > 0 ? (
                                    <div className="py-2">
                                        {wallets.map((wallet) => (
                                            <div
                                                key={wallet.id}
                                                className="px-4 py-3 hover:bg-surface-elevated transition flex items-center gap-3"
                                            >
                                                <div className="flex-shrink-0">
                                                    {getWalletLogo(wallet.provider)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-text-primary truncate">
                                                        {wallet.nickname || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                                                    </div>
                                                    <div className="text-xs text-text-secondary font-mono">
                                                        {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                                                    </div>
                                                    <div className="flex gap-1 mt-1">
                                                        {wallet.chainTypes.map((chain) => (
                                                            <span
                                                                key={chain}
                                                                className="text-xs px-1.5 py-0.5 bg-background rounded-[2px] text-text-secondary uppercase"
                                                            >
                                                                {chain === 'ethereum' ? 'ETH' : chain === 'polygon' ? 'MATIC' : chain === 'bsc' ? 'BSC' : chain}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                                    <span className="text-xs px-2 py-1 bg-success/10 text-success rounded-[2px] uppercase font-medium">
                                                        {wallet.provider}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDisconnectWallet(wallet.id, e)}
                                                        className="text-xs px-2 py-1 text-error hover:bg-error/10 rounded-[2px] transition"
                                                        title="Disconnect this wallet"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-sm text-text-secondary">
                                        No wallets found
                                    </div>
                                )}
                            </div>

                            <div className="p-3 border-t border-border space-y-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('🔗 Link New Wallet clicked');
                                        // Clear any previous errors before opening modal
                                        setError('');
                                        setConnectingWallet(null);
                                        // Open modal first, then close dropdown
                                        setShowWalletOptions(true);
                                        setTimeout(() => {
                                            setShowDropdown(false);
                                        }, 50);
                                    }}
                                    className="w-full px-3 py-2 text-sm font-medium border border-border text-text-primary hover:bg-surface bg-transparent rounded-[2px] transition-colors"
                                >
                                    + Link New Wallet
                                </button>
                                <Button
                                    onClick={handleDisconnect}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full hover:text-error hover:bg-error/10"
                                >
                                    Disconnect All
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Wallet Selection Modal - Hide when WalletConnect is connecting */}
                {showWalletOptions && connectingWallet !== 'walletconnect' && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60" onClick={handleCloseModal}>
                        <div className="relative w-full max-w-md bg-background border-2 border-border rounded-[2px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            {showCoinDCXForm ? (
                                /* CoinDCX Connection Form */
                                <>
                                    <div className="px-6 py-4 border-b border-border">
                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={handleCoinDCXBack}
                                                className="p-2 hover:bg-surface rounded-[2px] transition-colors"
                                                aria-label="Back"
                                            >
                                                <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={handleCloseModal}
                                                className="p-2 hover:bg-surface rounded-[2px] transition-colors"
                                                aria-label="Close"
                                            >
                                                <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <ConnectCoinDCX onSuccess={handleCoinDCXSuccess} onClose={handleCoinDCXBack} />
                                </>
                            ) : (
                                /* Wallet Options */
                                <>
                                    {/* Header */}
                                    <div className="px-6 py-4 border-b border-border">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-semibold text-text-primary">Connect Wallet</h2>
                                            <button
                                                onClick={handleCloseModal}
                                                className="p-2 hover:bg-surface rounded-[2px] transition-colors"
                                                aria-label="Close"
                                            >
                                                <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <p className="text-sm text-text-secondary mt-1">Choose your preferred wallet provider</p>
                                    </div>

                                    {/* Wallet Options */}
                                    <div className="p-6 space-y-3">
                                        {walletOptions.map((wallet) => {
                                            const isThisWalletConnecting = connectingWallet === wallet.providerType;

                                            return (
                                                <button
                                                    key={wallet.name}
                                                    onClick={() => handleWalletConnect(wallet.providerType)}
                                                    disabled={connectingWallet !== null}
                                                    className="w-full p-4 flex items-center gap-4 border border-border hover:border-accent hover:bg-surface rounded-[2px] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="flex-shrink-0">
                                                        {wallet.logo}
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <div className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                                                            {wallet.name}
                                                        </div>
                                                        <div className="text-xs text-text-secondary mt-0.5">
                                                            {wallet.description}
                                                        </div>
                                                    </div>
                                                    {isThisWalletConnecting ? (
                                                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <svg className="w-5 h-5 text-text-secondary group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Error Display */}
                                    {error && (
                                        <div className="mx-6 mb-6 p-4 rounded-[2px] bg-surface border border-error">
                                            <h4 className="font-semibold text-text-primary text-sm mb-1">Connection Failed</h4>
                                            <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
                                            {error.includes('MetaMask') && error.includes('not') && (
                                                <a
                                                    href="https://metamask.io/download/"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                                                >
                                                    Download MetaMask ↗
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <Button
                onClick={() => setShowWalletOptions(true)}
                size="md"
            >
                Connect
            </Button>

            {/* Wallet Selection Modal */}
            {showWalletOptions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={handleCloseModal}>
                    <div className="relative w-full max-w-md bg-background border-2 border-border rounded-[2px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {showCoinDCXForm ? (
                            /* CoinDCX Connection Form */
                            <>
                                <div className="px-6 py-4 border-b border-border">
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={handleCoinDCXBack}
                                            className="p-2 hover:bg-surface rounded-[2px] transition-colors"
                                            aria-label="Back"
                                        >
                                            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleCloseModal}
                                            className="p-2 hover:bg-surface rounded-[2px] transition-colors"
                                            aria-label="Close"
                                        >
                                            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <ConnectCoinDCX onSuccess={handleCoinDCXSuccess} onClose={handleCoinDCXBack} />
                            </>
                        ) : (
                            /* Wallet Options */
                            <>
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-border">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-semibold text-text-primary">Connect Wallet</h2>
                                        <button
                                            onClick={handleCloseModal}
                                            className="p-2 hover:bg-surface rounded-[2px] transition-colors"
                                            aria-label="Close"
                                        >
                                            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <p className="text-sm text-text-secondary mt-1">Choose your preferred wallet provider</p>
                                </div>

                                {/* Wallet Options */}
                                <div className="p-6 space-y-3">
                                    {walletOptions.map((wallet) => {
                                        const isThisWalletConnecting = connectingWallet === wallet.providerType;

                                        return (
                                            <button
                                                key={wallet.name}
                                                onClick={() => handleWalletConnect(wallet.providerType)}
                                                disabled={connectingWallet !== null}
                                                className="w-full p-4 flex items-center gap-4 border border-border hover:border-accent hover:bg-surface rounded-[2px] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="flex-shrink-0">
                                                    {wallet.logo}
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                                                        {wallet.name}
                                                    </div>
                                                    <div className="text-xs text-text-secondary mt-0.5">
                                                        {wallet.description}
                                                    </div>
                                                </div>
                                                {isThisWalletConnecting ? (
                                                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <svg className="w-5 h-5 text-text-secondary group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Error Display */}
                                {error && (
                                    <div className="mx-6 mb-6 p-4 rounded-[2px] bg-surface border border-error">
                                        <h4 className="font-semibold text-text-primary text-sm mb-1">Connection Failed</h4>
                                        <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
                                        {error.includes('MetaMask') && error.includes('not') && (
                                            <a
                                                href="https://metamask.io/download/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                                            >
                                                Download MetaMask ↗
                                            </a>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

                        {/* Error Display */}
                        {error && (
                            <div className="mx-6 mb-6 p-4 rounded-[2px] bg-surface border border-error">
                                <h4 className="font-semibold text-text-primary text-sm mb-1">Connection Failed</h4>
                                <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
                                {error.includes('MetaMask') && error.includes('not') && (
                                    <a
                                        href="https://metamask.io/download/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                                    >
                                        Download MetaMask ↗
                                    </a>
                                )}
                            </div>
                        )}
        </>
    );
}
