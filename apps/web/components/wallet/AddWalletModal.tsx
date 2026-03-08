'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import ConnectCoinDCX from '@/components/exchange/ConnectCoinDCX';
import { connectWallet, connectMetaMask, connectWalletConnectProvider, connectCoinbase } from '@/lib/web3/wallet';
import { isCoinbaseWalletAvailable } from '@/lib/web3/coinbase';
import { isWalletConnectAvailable } from '@/lib/web3/walletconnect';
import { walletApi } from '@/lib/portfolioApi';
import { notifyWalletsChanged } from '@/lib/walletEvents';

interface AddWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type WalletProviderOption = 'metamask' | 'walletconnect' | 'coinbase';
type ExchangeProviderOption = 'coindcx';
type ModalView = 'connections' | ExchangeProviderOption;

interface WalletOption {
    id: WalletProviderOption;
    name: string;
    description: string;
    icon: ReactNode;
    color: string;
    installUrl: string;
    highlight?: boolean;
}

interface ExchangeOption {
    id: ExchangeProviderOption;
    name: string;
    description: string;
    icon: ReactNode;
    color: string;
}

function getWalletError(error: unknown) {
    if (axios.isAxiosError<{ error?: string; code?: string; details?: string[] }>(error)) {
        return {
            code: error.code,
            message: error.message,
            response: error.response?.data,
        };
    }

    if (error instanceof Error) {
        return {
            code: undefined as number | string | undefined,
            message: error.message,
            response: undefined,
        };
    }

    return {
        code: undefined as number | string | undefined,
        message: 'Failed to connect wallet. Please try again.',
        response: undefined,
    };
}

export default function AddWalletModal({ isOpen, onClose, onSuccess }: AddWalletModalProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isExchangeConnecting, setIsExchangeConnecting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [nickname, setNickname] = useState('');
    const [selectedChains, setSelectedChains] = useState<string[]>(['ethereum', 'polygon', 'bsc']);
    const [availableWallets, setAvailableWallets] = useState<string[]>([]);
    const [view, setView] = useState<ModalView>('connections');
    const isBusy = isConnecting || isExchangeConnecting;

    const resetForm = useCallback(() => {
        setIsConnecting(false);
        setIsExchangeConnecting(false);
        setError('');
        setSuccess('');
        setNickname('');
        setSelectedChains(['ethereum', 'polygon', 'bsc']);
        setView('connections');
    }, []);

    const handleClose = () => {
        if (isBusy) {
            return;
        }

        resetForm();
        onClose();
    };

    useEffect(() => {
        // Check which wallets are available
        const checkAvailability = () => {
            const available: string[] = [];
            
            // MetaMask check
            if (typeof window !== 'undefined' && window.ethereum) {
                available.push('metamask');
            }
            
            // Coinbase Wallet check
            if (isCoinbaseWalletAvailable()) {
                available.push('coinbase');
            }
            
            // WalletConnect check
            if (isWalletConnectAvailable()) {
                available.push('walletconnect');
            }
            
            setAvailableWallets(available);
        };

        if (isOpen) {
            checkAvailability();
        } else {
            resetForm();
        }
    }, [isOpen, resetForm]);

    if (!isOpen) return null;

    const chains = [
        { id: 'ethereum', name: 'ETH' },
        { id: 'polygon', name: 'MATIC' },
        { id: 'bsc', name: 'BSC' },
    ];

    const allWalletOptions: WalletOption[] = [
        {
            id: 'metamask',
            name: 'MetaMask',
            description: 'Browser Extension',
            icon: (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M30.04 1.63L17.91 10.67L20.42 4.17L30.04 1.63Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1.96 1.63L13.99 10.76L11.58 4.17L1.96 1.63Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M25.56 23.29L22.38 28.26L29.4 30.17L31.37 23.42L25.56 23.29Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M0.65 23.42L2.6 30.17L9.62 28.26L6.44 23.29L0.65 23.42Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9.22 14.17L7.06 17.42L14.02 17.76L13.76 10.22L9.22 14.17Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22.78 14.17L18.16 10.13L18.02 17.76L24.94 17.42L22.78 14.17Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9.62 28.26L13.67 26.31L10.18 23.47L9.62 28.26Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18.33 26.31L22.38 28.26L21.82 23.47L18.33 26.31Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            ),
            color: 'hover:border-orange-500/50',
            installUrl: 'https://metamask.io/download/',
        },
        {
            id: 'coinbase',
            name: 'Coinbase Wallet',
            description: 'Browser Extension',
            icon: (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="16" fill="#0052FF"/>
                    <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4zm0 18.4c-3.536 0-6.4-2.864-6.4-6.4s2.864-6.4 6.4-6.4 6.4 2.864 6.4 6.4-2.864 6.4-6.4 6.4z" fill="white"/>
                    <rect x="13" y="13" width="6" height="6" rx="1" fill="#0052FF"/>
                </svg>
            ),
            color: 'hover:border-blue-500/50',
            installUrl: 'https://www.coinbase.com/wallet',
        },
        {
            id: 'walletconnect',
            name: 'WalletConnect',
            description: 'Mobile Wallets',
            icon: (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M9.58 11.8C13.62 7.76 20.38 7.76 24.42 11.8L24.94 12.32C25.14 12.52 25.14 12.84 24.94 13.04L23.36 14.62C23.26 14.72 23.1 14.72 23 14.62L22.26 13.88C19.46 11.08 14.54 11.08 11.74 13.88L10.94 14.68C10.84 14.78 10.68 14.78 10.58 14.68L9 13.1C8.8 12.9 8.8 12.58 9 12.38L9.58 11.8ZM27.76 15.32L29.14 16.7C29.34 16.9 29.34 17.22 29.14 17.42L22.26 24.3C22.06 24.5 21.74 24.5 21.54 24.3L16.06 18.82C16.01 18.77 15.93 18.77 15.88 18.82L10.4 24.3C10.2 24.5 9.88 24.5 9.68 24.3L2.8 17.42C2.6 17.22 2.6 16.9 2.8 16.7L4.18 15.32C4.38 15.12 4.7 15.12 4.9 15.32L10.38 20.8C10.43 20.85 10.51 20.85 10.56 20.8L16.04 15.32C16.24 15.12 16.56 15.12 16.76 15.32L22.24 20.8C22.29 20.85 22.37 20.85 22.42 20.8L27.9 15.32C28.1 15.12 28.42 15.12 28.62 15.32H27.76Z" fill="#3B99FC"/>
                </svg>
            ),
            color: 'hover:border-[#00FFB2]/50',
            installUrl: 'https://walletconnect.network/wallets',
            highlight: true,
        },
    ];

    const exchangeOptions: ExchangeOption[] = [
        {
            id: 'coindcx',
            name: 'CoinDCX',
            description: 'Exchange Account',
            icon: (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-400/30 bg-blue-900 text-[8px] font-bold">
                    <span className="text-white">Coin</span>
                    <span className="text-orange-400">DCX</span>
                </div>
            ),
            color: 'hover:border-orange-500/50',
        },
    ];

    const walletOptions = allWalletOptions.filter(wallet =>
        availableWallets.includes(wallet.id)
    );

    const unavailableWallets = allWalletOptions.filter(wallet => 
        !availableWallets.includes(wallet.id)
    );

    const toggleChain = (chainId: string) => {
        setSelectedChains(prev =>
            prev.includes(chainId)
                ? prev.filter(c => c !== chainId)
                : [...prev, chainId]
        );
    };

    const handleConnect = async (providerType: 'auto' | WalletProviderOption) => {
        setIsConnecting(true);
        setError('');

        try {
            if (selectedChains.length === 0) {
                throw new Error('Select at least one chain to track.');
            }

            let walletConnection;

            // Connect based on provider type
            if (providerType === 'metamask') {
                walletConnection = await connectMetaMask();
            } else if (providerType === 'walletconnect') {
                walletConnection = await connectWalletConnectProvider();
            } else if (providerType === 'coinbase') {
                walletConnection = await connectCoinbase();
            } else {
                walletConnection = await connectWallet(); // Auto-detect
            }

            console.log('✅ Wallet connected:', walletConnection.address);
            console.log('Provider type:', walletConnection.providerType);
            console.log('Selected chains:', selectedChains);
            console.log('Nickname:', nickname);

            // Prepare wallet data
            const walletData = {
                address: walletConnection.address,
                provider: walletConnection.providerType,
                chainTypes: selectedChains,
                nickname: nickname || undefined,
            };

            console.log('📤 Sending to API:', walletData);

            // Add wallet to backend
            const wallet = await walletApi.addWallet(walletData);

            console.log('✅ Wallet added to backend:', wallet);

            // Success!
            if (wallet.reactivated) {
                setSuccess('Wallet reconnected successfully!');
            } else if (wallet.alreadyConnected) {
                setSuccess('Wallet already linked. Tracking settings were refreshed.');
            } else {
                setSuccess('Wallet connected successfully!');
            }
            setTimeout(() => {
                notifyWalletsChanged();
                onSuccess();
                handleClose();
            }, 1500);
        } catch (error: unknown) {
            const err = getWalletError(error);
            const responseData = err.response;
            const isUserRejected =
                err.code === 4001 ||
                err.message.includes('User rejected') ||
                err.message.includes('Connection rejected');

            if (isUserRejected) {
                console.info('Wallet connection cancelled by user');
            } else {
                console.error('❌ Error adding wallet:', error);
            }

            if (responseData?.error) {
                const errorMsg = responseData.error;
                const errorCode = responseData.code;

                // Handle specific error codes
                if (errorCode === 'WALLET_ALREADY_EXISTS') {
                    setError('This wallet is already linked. Try switching to a different MetaMask account.');
                } else {
                    setError(errorMsg);
                }
            } else if (responseData?.details) {
                // Show validation details
                const details = responseData.details;
                setError(`Validation error: ${details.join(', ')}`);
            } else if (err.code === 'METAMASK_NOT_INSTALLED') {
                setError('MetaMask not detected. Please install MetaMask extension.');
            } else if (err.message.includes('User rejected')) {
                setError('Connection rejected. Please approve the connection in your wallet.');
            } else if (err.message.includes('timeout')) {
                setError('Connection timeout. Please try again.');
            } else {
                setError(err.message || 'Failed to connect wallet. Please try again.');
            }
        } finally {
            setIsConnecting(false);
        }
    };

    const modalWidthClass = view === 'connections'
        ? 'max-w-[24rem] sm:max-w-[25rem]'
        : 'max-w-[25rem] sm:max-w-[26rem]';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <button
                type="button"
                onClick={handleClose}
                disabled={isBusy}
                className="absolute inset-0 h-full w-full bg-black/80 backdrop-blur-sm disabled:cursor-default"
                aria-label="Close modal backdrop"
            />

            <div
                className={`relative w-full ${modalWidthClass} overflow-hidden rounded-2xl border border-white/10 bg-[#08070E] shadow-2xl`}
                onClick={(event) => event.stopPropagation()}
            >
                {/* Close button */}
                <button
                    type="button"
                    onClick={handleClose}
                    disabled={isBusy}
                    className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-[#D5D5D5] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Close modal"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="max-h-[84vh] overflow-y-auto px-4 pb-4 pt-5 sm:px-5 sm:pb-5 sm:pt-5">
                    {view === 'connections' ? (
                        <>
                            <h2 className="mb-2 pr-7 text-xl font-bold text-white">Link New Wallet or Exchange</h2>
                            <p className="mb-5 text-sm text-[#D5D5D5]">
                                Connect an additional wallet or exchange account to track your complete portfolio
                            </p>

                            {success && (
                                <div className="mb-4 rounded-xl border border-[#00FFB2]/30 bg-[#00FFB2]/10 p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="text-[#00FFB2] text-sm font-medium">{success}</div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1">
                                            <div className="text-red-400 text-sm font-medium mb-1">Connection Error</div>
                                            <div className="text-red-400/80 text-xs">{error}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Nickname */}
                            <div className="mb-5">
                                <label className="block text-sm font-medium text-white mb-2">
                                    Wallet Nickname (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="e.g., Trading Wallet"
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-white transition placeholder-[#D5D5D5]/60 focus:border-[#00FFB2]/50 focus:outline-none focus:ring-2 focus:ring-[#00FFB2]/50"
                                />
                            </div>

                            {/* Chain Selection */}
                            <div className="mb-5">
                                <label className="block text-sm font-medium text-white mb-3">
                                    Select Chains to Track
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {chains.map((chain) => (
                                        <button
                                            key={chain.id}
                                            type="button"
                                            onClick={() => toggleChain(chain.id)}
                                            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${selectedChains.includes(chain.id)
                                                    ? 'border-[#00FFB2]/40 bg-[#00FFB2]/14 text-[#D8FFF2] shadow-[0_0_18px_rgba(0,255,178,0.12)]'
                                                    : 'bg-white/5 border-white/10 text-white hover:border-[#00FFB2]/50 hover:bg-white/10'
                                                }`}
                                        >
                                            {chain.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Available Wallet Options */}
                            {walletOptions.length > 0 && (
                                <div className="mb-5 space-y-2.5">
                                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#D5D5D5]/50">
                                        Wallets
                                    </div>
                                    {walletOptions.map((wallet) => (
                                        <button
                                            key={wallet.id}
                                            type="button"
                                            onClick={() => handleConnect(wallet.id)}
                                            disabled={isConnecting}
                                            className={`group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 ${wallet.color} ${wallet.highlight ? 'border-[#00FFB2]/30 bg-[#00FFB2]/5' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center">
                                                    {wallet.icon}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-white font-medium">{wallet.name}</div>
                                                    <div className="text-xs text-[#D5D5D5]/80">{wallet.description}</div>
                                                </div>
                                            </div>
                                            <svg className="w-5 h-5 text-[#D5D5D5]/60 group-hover:text-[#00FFB2] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Exchange Options */}
                            <div className="mb-5 space-y-2.5">
                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#D5D5D5]/50">
                                    Exchanges
                                </div>
                                {exchangeOptions.map((exchange) => (
                                    <button
                                        type="button"
                                        key={exchange.id}
                                        onClick={() => {
                                            setError('');
                                            setSuccess('');
                                            setView(exchange.id);
                                        }}
                                        disabled={isBusy}
                                        className={`group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 ${exchange.color}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center">
                                                {exchange.icon}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-white font-medium">{exchange.name}</div>
                                                <div className="text-xs text-[#D5D5D5]/80">{exchange.description}</div>
                                            </div>
                                        </div>
                                        <svg className="w-5 h-5 text-[#D5D5D5]/60 group-hover:text-[#00FFB2] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                ))}
                            </div>

                            {/* Unavailable Wallets - Show install links */}
                            {unavailableWallets.length > 0 && (
                                <div className="mb-5">
                                    <h3 className="text-sm font-medium text-[#D5D5D5]/80 mb-3">Install to Connect</h3>
                                    <div className="space-y-2">
                                        {unavailableWallets.map((wallet) => (
                                            <a
                                                key={wallet.id}
                                                href={wallet.installUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center justify-center opacity-50">
                                                        {wallet.icon}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-[#D5D5D5]/60 font-medium text-sm">{wallet.name}</div>
                                                        <div className="text-xs text-[#D5D5D5]/40">Not installed</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-[#00FFB2]/60 group-hover:text-[#00FFB2]">Install</div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {walletOptions.length > 0 && (
                                <>
                                    <div className="relative my-5">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-white/10"></div>
                                        </div>
                                        <div className="relative flex justify-center text-xs">
                                            <span className="px-3 bg-[#08070E] text-[#D5D5D5]/60 font-medium">OR</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleConnect('auto')}
                                        disabled={isConnecting}
                                        className="btn-brand-solid w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isConnecting ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                <span>Connecting...</span>
                                            </div>
                                        ) : (
                                            'Auto-Detect Wallet'
                                        )}
                                    </button>
                                </>
                            )}

                            {walletOptions.length === 0 && (
                                <div className="text-center py-8">
                                    <div className="text-[#D5D5D5]/60 mb-4">No wallets detected</div>
                                    <div className="text-xs text-[#D5D5D5]/40">
                                        Install a supported wallet or connect an exchange account to continue
                                    </div>
                                </div>
                            )}

                            <p className="mt-4 text-center text-xs text-[#D5D5D5]/60">
                                Connect multiple wallets and exchanges to see your complete portfolio
                            </p>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    if (isBusy) {
                                        return;
                                    }

                                    setError('');
                                    setSuccess('');
                                    setView('connections');
                                }}
                                disabled={isBusy}
                                className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#00FFB2] transition-colors hover:text-[#00FFB2]/80 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to connection options
                            </button>

                            <ConnectCoinDCX
                                onClose={() => {
                                    if (isBusy) {
                                        return;
                                    }

                                    setView('connections');
                                }}
                                onConnectingChange={setIsExchangeConnecting}
                                onSuccess={() => {
                                    setSuccess('CoinDCX account connected successfully!');
                                    notifyWalletsChanged();
                                    onSuccess();
                                }}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
