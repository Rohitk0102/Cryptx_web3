'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import AddWalletModal from '@/components/wallet/AddWalletModal';

export default function FeatureGrid() {
    const router = useRouter();
    const [showAddWallet, setShowAddWallet] = useState(false);

    // This component is only rendered when the user is signed in (checked in parent page.tsx)
    // So we can directly navigate without auth checks
    const features = [
        {
            title: "Portfolio",
            desc: "View wallet balances and assets across multiple chains",
            action: () => {
                router.push('/dashboard/portfolio');
            }
        },
        {
            title: "Live Tracking",
            desc: "Real-time token prices and market data",
            action: () => {
                router.push('/dashboard/tracking');
            }
        },
        {
            title: "AI Forecasting",
            desc: "AI-powered price predictions and risk analysis for cryptocurrencies",
            action: () => {
                router.push('/dashboard/forecasting');
            }
        },
        {
            title: "Transaction & P&L",
            desc: "Track transactions and calculate profit/loss with FIFO, LIFO, or weighted average",
            action: () => {
                router.push('/dashboard/pnl');
            }
        },
        {
            title: "Link Another Wallet",
            desc: "Add additional wallets to your portfolio",
            action: () => {
                setShowAddWallet(true);
            }
        }
    ];

    return (
        <>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {features.map((feature, idx) => (
                    <Card
                        key={idx}
                        hover={true}
                        onClick={feature.action}
                        className="p-8"
                    >
                        <CardTitle className="mb-3">
                            {feature.title}
                        </CardTitle>
                        <CardDescription>
                            {feature.desc}
                        </CardDescription>
                    </Card>
                ))}
            </div>

            {showAddWallet && (
                <AddWalletModal
                    isOpen={showAddWallet}
                    onClose={() => setShowAddWallet(false)}
                    onSuccess={() => {
                        setShowAddWallet(false);
                        router.push('/dashboard/portfolio');
                    }}
                />
            )}
        </>
    );
}