'use client';

import { useState } from 'react';

interface ConnectWalletProps {
  showConnectButton?: boolean;
  onWalletConnected?: () => void;
}

export default function ConnectWallet({ 
  showConnectButton = false, 
  onWalletConnected 
}: ConnectWalletProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      // TODO: Implement wallet connection logic
      console.log('Connecting wallet...');
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Call the callback when wallet is connected
      onWalletConnected?.();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (!showConnectButton) {
    return null;
  }

  return (
    <button
      onClick={handleConnectWallet}
      disabled={isConnecting}
      className="flex items-center gap-3 bg-[#00FFB2] text-black font-semibold px-8 py-4 rounded-xl text-base shadow-[0_0_34px_0_rgba(42,240,124,0.35)] hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      {isConnecting ? (
        <>
          <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          Connect Wallet
          <div className="w-5 h-5 bg-black/20 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </>
      )}
    </button>
  );
}