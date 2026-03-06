'use client';

import { useState } from 'react';
import { connectWallet, connectMetaMask, connectWalletConnectProvider, connectCoinbase } from '@/lib/web3/wallet';
import apiClient from '@/lib/api';
import Image from 'next/image';

interface AddWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddWalletModal({ isOpen, onClose, onSuccess }: AddWalletModalProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [nickname, setNickname] = useState('');
    const [selectedChains, setSelectedChains] = useState<string[]>(['ethereum', 'polygon', 'bsc']);

    if (!isOpen) return null;

    const chains = [
        { id: 'ethereum', name: 'ETH' },
        { id: 'polygon', name: 'MATIC' },
        { id: 'bsc', name: 'BSC' },
    ];

    const toggleChain = (chainId: string) => {
        setSelectedChains(prev =>
            prev.includes(chainId)
                ? prev.filter(c => c !== chainId)
                : [...prev, chainId]
        );
    };

    const handleConnect = async (providerType: 'auto' | 'metamask' | 'walletconnect' | 'coinbase') => {
        setIsConnecting(true);
        setError('');

        try {
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
            const response = await apiClient.post('/wallets', walletData);

            console.log('✅ Wallet added to backend:', response.data);

            // Success!
            setSuccess('Wallet connected successfully!');
            setTimeout(() => {
                onSuccess();
                onClose();
                setNickname('');
                setSelectedChains(['ethereum', 'polygon', 'bsc']);
                setSuccess('');
            }, 1500);
        } catch (err: any) {
            console.error('❌ Error adding wallet:', err);

            if (err.response?.data?.error) {
                const errorMsg = err.response.data.error;
                const errorCode = err.response.data.code;

                // Handle specific error codes
                if (errorCode === 'WALLET_ALREADY_EXISTS') {
                    setError('This wallet is already connected to your account. Please use a different wallet.');
                } else {
                    setError(errorMsg);
                }
            } else if (err.response?.data?.details) {
                // Show validation details
                const details = err.response.data.details;
                setError(`Validation error: ${details.join(', ')}`);
            } else if (err.code === 'METAMASK_NOT_INSTALLED') {
                setError('MetaMask not detected. Please install MetaMask extension.');
            } else if (err.message?.includes('User rejected')) {
                setError('Connection rejected. Please approve the connection in your wallet.');
            } else if (err.message?.includes('timeout')) {
                setError('Connection timeout. Please try again.');
            } else {
                setError(err.message || 'Failed to connect wallet. Please try again.');
            }
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90">
            <div className="relative w-full max-w-md bg-surface border border-border rounded-[2px]">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-[2px] hover:bg-surface-elevated transition text-text-secondary hover:text-text-primary"
                    aria-label="Close modal"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6">
                    <h2 className="text-2xl font-semibold text-text-primary mb-2">Link New Wallet</h2>
                    <p className="text-sm text-text-secondary mb-6">
                        Connect an additional wallet to track your complete portfolio
                    </p>

                    {success && (
                        <div className="mb-4 p-4 rounded-[2px] bg-surface border border-success">
                            <div className="flex items-center gap-3">
                                <div className="text-success text-sm font-medium">{success}</div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-4 rounded-[2px] bg-surface border border-error">
                            <div className="flex items-start gap-3">
                                <div className="flex-1">
                                    <div className="text-error text-sm font-medium mb-1">Connection Error</div>
                                    <div className="text-error text-xs opacity-80">{error}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Nickname */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Wallet Nickname (Optional)
                        </label>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="e.g., Trading Wallet"
                            className="w-full px-4 py-2 bg-background border border-border rounded-[2px] text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition"
                        />
                    </div>

                    {/* Chain Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-text-primary mb-3">
                            Select Chains to Track
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {chains.map((chain) => (
                                <button
                                    key={chain.id}
                                    onClick={() => toggleChain(chain.id)}
                                    className={`p-3 rounded-[2px] border transition ${selectedChains.includes(chain.id)
                                            ? 'bg-accent text-white border-accent'
                                            : 'bg-surface border-border text-text-primary hover:border-accent'
                                        }`}
                                >
                                    <div className="text-sm font-medium uppercase">{chain.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Wallet Options */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleConnect('metamask')}
                            disabled={isConnecting}
                            className="w-full p-4 rounded-[2px] bg-surface hover:bg-surface-elevated border border-border hover:border-accent transition flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🦊</span>
                                <div className="text-left">
                                    <div className="text-text-primary font-medium">MetaMask</div>
                                    <div className="text-xs text-text-secondary">Browser Extension</div>
                                </div>
                            </div>
                            <svg className="w-5 h-5 text-text-secondary group-hover:text-accent transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        <button
                            onClick={() => handleConnect('coinbase')}
                            disabled={isConnecting}
                            className="w-full p-4 rounded-[2px] bg-surface hover:bg-surface-elevated border border-border hover:border-accent transition flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-3">
                                <Image src="/coinbase-logo.png" alt="Coinbase" width={32} height={32} className="rounded" />
                                <div className="text-left">
                                    <div className="text-text-primary font-medium">Coinbase Wallet</div>
                                    <div className="text-xs text-text-secondary">Browser Extension</div>
                                </div>
                            </div>
                            <svg className="w-5 h-5 text-text-secondary group-hover:text-accent transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        <button
                            onClick={() => handleConnect('walletconnect')}
                            disabled={isConnecting}
                            className="w-full p-4 rounded-[2px] bg-surface hover:bg-surface-elevated border border-border hover:border-accent transition flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-3">
                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                    <path d="M9.58 11.8C13.62 7.76 20.38 7.76 24.42 11.8L24.94 12.32C25.14 12.52 25.14 12.84 24.94 13.04L23.36 14.62C23.26 14.72 23.1 14.72 23 14.62L22.26 13.88C19.46 11.08 14.54 11.08 11.74 13.88L10.94 14.68C10.84 14.78 10.68 14.78 10.58 14.68L9 13.1C8.8 12.9 8.8 12.58 9 12.38L9.58 11.8ZM27.76 15.32L29.14 16.7C29.34 16.9 29.34 17.22 29.14 17.42L22.26 24.3C22.06 24.5 21.74 24.5 21.54 24.3L16.06 18.82C16.01 18.77 15.93 18.77 15.88 18.82L10.4 24.3C10.2 24.5 9.88 24.5 9.68 24.3L2.8 17.42C2.6 17.22 2.6 16.9 2.8 16.7L4.18 15.32C4.38 15.12 4.7 15.12 4.9 15.32L10.38 20.8C10.43 20.85 10.51 20.85 10.56 20.8L16.04 15.32C16.24 15.12 16.56 15.12 16.76 15.32L22.24 20.8C22.29 20.85 22.37 20.85 22.42 20.8L27.9 15.32C28.1 15.12 28.42 15.12 28.62 15.32H27.76Z" fill="#3B99FC" />
                                </svg>
                                <div className="text-left">
                                    <div className="text-text-primary font-medium">WalletConnect</div>
                                    <div className="text-xs text-text-secondary">
                                        {isConnecting ? 'Scan QR code in your wallet...' : 'Mobile Wallets'}
                                    </div>
                                </div>
                            </div>
                            {isConnecting ? (
                                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5 text-text-secondary group-hover:text-accent transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-2 bg-surface text-text-secondary">OR</span>
                            </div>
                        </div>

                        <button
                            onClick={() => handleConnect('auto')}
                            disabled={isConnecting}
                            className="w-full p-4 rounded-[2px] bg-accent hover:opacity-90 border border-accent transition text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConnecting ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Connecting...</span>
                                </div>
                            ) : (
                                'Auto-Detect Wallet'
                            )}
                        </button>
                    </div>

                    <p className="text-xs text-text-secondary mt-4 text-center">
                        Connect multiple wallets to see your complete portfolio
                    </p>
                </div>
            </div>
        </div>
    );
}
