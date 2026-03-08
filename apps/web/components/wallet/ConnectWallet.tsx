'use client';

import { useState } from 'react';
import AddWalletModal from '@/components/wallet/AddWalletModal';

interface ConnectWalletProps {
  showConnectButton?: boolean;
  onWalletConnected?: () => void;
}

export default function ConnectWallet({
  showConnectButton = true,
  onWalletConnected,
}: ConnectWalletProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!showConnectButton) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="btn-brand-solid flex items-center gap-3 rounded-xl px-8 py-4 text-base font-semibold"
        >
          Connect Wallet or Exchange
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/15 ring-1 ring-black/10">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </button>
        <p className="text-xs text-[#D5D5D5]/70">
          Supports MetaMask, Coinbase Wallet, WalletConnect, and CoinDCX.
        </p>
      </div>

      <AddWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          onWalletConnected?.();
        }}
      />
    </>
  );
}
