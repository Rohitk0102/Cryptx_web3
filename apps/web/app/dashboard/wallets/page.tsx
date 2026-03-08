'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import AddWalletModal from '@/components/wallet/AddWalletModal';
import ExchangeAccountList from '@/components/exchange/ExchangeAccountList';
import WalletList from '@/components/wallet/WalletList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatUSDAsINR } from '@/lib/currency';
import { PortfolioResponse, Wallet, portfolioApi, walletApi } from '@/lib/portfolioApi';
import { WALLET_DATA_CHANGED_EVENT, notifyWalletsChanged } from '@/lib/walletEvents';

type WalletListItem = {
    id: string;
    address: string;
    nickname?: string;
    provider?: string;
    valueUsd: number;
    chains: Array<{ chain: string }>;
};

function getRequestErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError<{ error?: string }>(error)) {
        return error.response?.data?.error || error.message || fallback;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return fallback;
}

function mapWalletsForDisplay(wallets: Wallet[], portfolio: PortfolioResponse | null): WalletListItem[] {
    const portfolioWallets = new Map(
        (portfolio?.wallets || []).map((wallet) => [wallet.id, wallet])
    );

    return wallets.map((wallet) => {
        const portfolioWallet = portfolioWallets.get(wallet.id);

        return {
            id: wallet.id,
            address: wallet.address,
            nickname: wallet.nickname,
            provider: wallet.provider,
            valueUsd: portfolioWallet?.valueUsd ?? 0,
            chains: wallet.chainTypes.map((chain) => ({ chain })),
        };
    });
}

export default function WalletsPage() {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddWallet, setShowAddWallet] = useState(false);
    const [error, setError] = useState('');

    const loadWalletData = useCallback(async (useCachedPortfolio = true) => {
        try {
            setLoading(true);
            setError('');

            const [walletRows, portfolioData] = await Promise.all([
                walletApi.getWallets(),
                portfolioApi.getPortfolio(useCachedPortfolio).catch(() => null),
            ]);

            setWallets(walletRows);
            setPortfolio(portfolioData);
        } catch (error: unknown) {
            setError(getRequestErrorMessage(error, 'Failed to load wallets'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadWalletData();
    }, [loadWalletData]);

    useEffect(() => {
        const handleWalletsChanged = () => {
            void loadWalletData(false);
        };

        const handleAuthCleared = () => {
            setWallets([]);
            setPortfolio(null);
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
    }, [loadWalletData]);

    const handleRemoveWallet = useCallback(async (walletId: string) => {
        try {
            setError('');
            await walletApi.deleteWallet(walletId);
            setWallets((currentWallets) => currentWallets.filter((wallet) => wallet.id !== walletId));
            setPortfolio((currentPortfolio) => {
                if (!currentPortfolio) {
                    return currentPortfolio;
                }

                return {
                    ...currentPortfolio,
                    wallets: currentPortfolio.wallets.filter((wallet) => wallet.id !== walletId),
                };
            });
            notifyWalletsChanged();
        } catch (error: unknown) {
            setError(getRequestErrorMessage(error, 'Failed to remove wallet'));
        }
    }, []);

    const displayWallets = mapWalletsForDisplay(wallets, portfolio);
    const trackedChains = wallets.reduce((count, wallet) => count + wallet.chainTypes.length, 0);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-[#F5F5F5]">Wallets</h2>
                    <p className="mt-1 text-sm text-[#D5D5D5]/60">Loading your connected wallets</p>
                </div>

                <Card className="p-8">
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 rounded-full border-2 border-[#00FFB2] border-t-transparent animate-spin" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#F5F5F5]">Wallets</h2>
                    <p className="mt-1 text-sm text-[#D5D5D5]/60">
                        Manage linked wallets and refresh portfolio tracking from one place.
                    </p>
                </div>

                <Button onClick={() => setShowAddWallet(true)}>
                    Link Wallet or Exchange
                </Button>
            </div>

            {error && (
                <div className="rounded-xl border border-[#FF4C4C]/30 bg-[#FF4C4C]/10 px-4 py-3 text-sm text-[#FF4C4C]">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <div className="text-xs font-medium uppercase tracking-wider text-[#D5D5D5]/50">
                        Linked Wallets
                    </div>
                    <div className="mt-3 text-3xl font-bold text-[#F5F5F5]">
                        {wallets.length}
                    </div>
                </Card>

                <Card>
                    <div className="text-xs font-medium uppercase tracking-wider text-[#D5D5D5]/50">
                        Tracked Chains
                    </div>
                    <div className="mt-3 text-3xl font-bold text-[#F5F5F5]">
                        {trackedChains}
                    </div>
                </Card>

                <Card>
                    <div className="text-xs font-medium uppercase tracking-wider text-[#D5D5D5]/50">
                        Portfolio Value
                    </div>
                    <div className="mt-3 text-3xl font-bold text-[#F5F5F5]">
                        {formatUSDAsINR(portfolio?.totalValueUsd || 0)}
                    </div>
                </Card>
            </div>

            {displayWallets.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto max-w-md">
                        <h3 className="text-xl font-semibold text-[#F5F5F5]">No wallets linked yet</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[#D5D5D5]/60">
                            Link your first wallet to populate portfolio balances, sync transactions,
                            and unlock the rest of the dashboard.
                        </p>
                        <Button className="mt-6" onClick={() => setShowAddWallet(true)}>
                            Link Wallet or Exchange
                        </Button>
                    </div>
                </Card>
            ) : (
                <WalletList
                    wallets={displayWallets}
                    onAddWallet={() => setShowAddWallet(true)}
                    onRemoveWallet={handleRemoveWallet}
                />
            )}

            <AddWalletModal
                isOpen={showAddWallet}
                onClose={() => setShowAddWallet(false)}
                onSuccess={() => {
                    setShowAddWallet(false);
                    void loadWalletData(false);
                }}
            />

            <Card className="p-6">
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#F5F5F5]">Exchange Accounts</h3>
                    <p className="mt-1 text-xs text-[#D5D5D5]/60">
                        Manage supported exchange connections like CoinDCX alongside your wallets.
                    </p>
                </div>

                <ExchangeAccountList
                    onAccountsChange={() => {
                        notifyWalletsChanged();
                        void loadWalletData(false);
                    }}
                />
            </Card>
        </div>
    );
}
