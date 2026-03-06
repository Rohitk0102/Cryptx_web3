/**
 * @deprecated This hook uses the legacy SIWE/JWT auth system.
 * Use Clerk authentication with ConnectWallet component instead.
 * This file is kept for reference but should not be used in new code.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectMetaMask, connectWalletConnectProvider, connectCoinbase, signInWithEthereum, disconnectWallet } from '@/lib/web3/wallet';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * @deprecated Use Clerk auth + ConnectWallet component instead
 */
export const useWalletConnect = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string>('');
    const [connection, setConnection] = useState<any>(null);
    const { setAuth, clearAuth } = useAuthStore();
    const router = useRouter();

    const connect = async (providerType: 'metamask' | 'walletconnect' | 'coinbase' = 'metamask') => {
        setIsConnecting(true);
        setError('');

        try {
            console.log(`🔌 Starting connection with ${providerType}...`);

            // Step 1: Connect to specific wallet provider
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

            setConnection(walletConnection);
            console.log('✅ Wallet connected:', walletConnection.address, 'via', walletConnection.providerType);

            // Step 2: Get nonce from backend
            console.log('📝 Requesting nonce from backend...');
            const { nonce } = await authApi.getNonce();
            console.log('✅ Nonce received');

            // Step 3: Sign SIWE message
            console.log('✍️  Requesting signature...');
            const { message, signature } = await signInWithEthereum(
                walletConnection,
                walletConnection.address,
                nonce
            );
            console.log('✅ Message signed');

            // Step 4: Verify signature with backend
            console.log('🔐 Verifying signature with backend...');
            const authResponse = await authApi.verifySignature(
                message,
                signature,
                walletConnection.providerType
            );
            console.log('✅ Signature verified, authentication successful');

            // Step 5: Store tokens and user info
            setAuth(
                {
                    accessToken: authResponse.accessToken,
                    refreshToken: authResponse.refreshToken,
                },
                authResponse.user
            );

            console.log('💾 Auth data stored in state');
            console.log('✅ Authentication complete! Redirecting to dashboard...');

            // Navigate to dashboard
            router.push('/dashboard');
            return true;
        } catch (err: any) {
            console.error('❌ Connection error:', err);

            if (err.code === 'METAMASK_NOT_INSTALLED' || err.message?.includes('MetaMask is not installed')) {
                setError('MetaMask not detected. Please install the MetaMask extension to continue.');
            } else if (err.message?.includes('User rejected')) {
                setError('Connection request was rejected. Please try again.');
            } else if (err.message?.includes('nonce')) {
                setError('Session expired. Please refresh the page and try again.');
            } else if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError(err.message || 'Failed to connect wallet');
            }

            return false;
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = async () => {
        try {
            // Disconnect from wallet if applicable
            if (connection) {
                await disconnectWallet(connection);
                setConnection(null);
            }

            // Logout from backend
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                await authApi.logout(refreshToken);
            }

            clearAuth();
            router.push('/');
        } catch (error) {
            console.error('Logout error:', error);
            clearAuth();
            router.push('/');
        }
    };

    return {
        isConnecting,
        error,
        connect,
        disconnect
    };
};
