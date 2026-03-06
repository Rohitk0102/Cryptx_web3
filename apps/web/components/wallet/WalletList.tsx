'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatUSDAsINR } from '@/lib/currency';

interface Wallet {
    id: string;
    address: string;
    nickname?: string;
    provider?: string;
    chains: Array<{ chain: string }>;
    valueUsd: number;
}

interface WalletListProps {
    wallets: Wallet[];
    onAddWallet: () => void;
    onRemoveWallet?: (walletId: string) => void;
}

export default function WalletList({ wallets, onAddWallet, onRemoveWallet }: WalletListProps) {
    const [expandedWallet, setExpandedWallet] = useState<string | null>(null);

    const getProviderName = (provider: string) => {
        switch (provider.toLowerCase()) {
            case 'metamask':
                return 'MetaMask';
            case 'walletconnect':
                return 'WalletConnect';
            case 'coinbase':
                return 'Coinbase Wallet';
            default:
                return provider;
        }
    };

    const getProviderLogo = (provider: string) => {
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

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <Card className="h-fit">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-text-primary">Connected Wallets</h2>
                    <p className="text-xs text-text-secondary mt-1">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={onAddWallet}
                >
                    +
                </Button>
            </div>

            <div className="space-y-3">
                {wallets.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-text-secondary text-sm mb-4">No wallets connected</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddWallet}
                        >
                            Connect Wallet
                        </Button>
                    </div>
                ) : (
                    wallets.map((wallet) => (
                        <div
                            key={wallet.id}
                            className="rounded-[2px] bg-background border border-border overflow-hidden hover:border-accent transition"
                        >
                            {/* Wallet Header */}
                            <div
                                className="p-4 cursor-pointer"
                                onClick={() => setExpandedWallet(expandedWallet === wallet.id ? null : wallet.id)}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0">
                                            {getProviderLogo(wallet.provider || 'unknown')}
                                        </div>
                                        <div>
                                            <div className="font-medium text-text-primary">
                                                {wallet.nickname || 'Wallet'}
                                            </div>
                                            <div className="text-xs text-text-secondary">
                                                {getProviderName(wallet.provider || 'unknown')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-success border border-success px-2 py-1 rounded-[2px]">
                                        Active
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-text-secondary font-mono">
                                            {formatAddress(wallet.address)}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(wallet.address);
                                            }}
                                            className="p-1 hover:bg-surface rounded-[2px] transition"
                                            title="Copy address"
                                        >
                                            <svg className="w-3 h-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="font-semibold text-text-primary">
                                        {formatUSDAsINR(wallet.valueUsd)}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedWallet === wallet.id && (
                                <div className="px-4 pb-4 border-t border-border pt-3">
                                    <div className="space-y-3">
                                        {/* Full Address */}
                                        <div>
                                            <div className="text-xs text-text-secondary mb-1">Full Address</div>
                                            <div className="text-xs font-mono text-text-primary bg-surface p-2 rounded-[2px] break-all border border-border">
                                                {wallet.address}
                                            </div>
                                        </div>

                                        {/* Chains */}
                                        <div>
                                            <div className="text-xs text-text-secondary mb-2">Tracked Chains ({wallet.chains.length})</div>
                                            <div className="flex flex-wrap gap-1">
                                                {wallet.chains.map((chain, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 bg-surface text-text-secondary text-xs rounded-[2px] border border-border uppercase font-medium"
                                                    >
                                                        {chain.chain}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        {onRemoveWallet && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    console.log('🔘 Remove button clicked for wallet:', wallet.id, wallet.address);
                                                    if (confirm(`Are you sure you want to remove this wallet (${formatAddress(wallet.address)})?`)) {
                                                        console.log('✅ User confirmed removal');
                                                        onRemoveWallet(wallet.id);
                                                    } else {
                                                        console.log('❌ User cancelled removal');
                                                    }
                                                }}
                                                className="w-full mt-2 px-3 py-2 text-xs text-error hover:bg-surface rounded-[2px] transition border border-error"
                                            >
                                                Remove Wallet
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}

                {wallets.length > 0 && (
                    <Button
                        variant="outline"
                        className="w-full mt-4 border-dashed"
                        onClick={onAddWallet}
                    >
                        + Link Another Wallet
                    </Button>
                )}
            </div>
        </Card>
    );
}
