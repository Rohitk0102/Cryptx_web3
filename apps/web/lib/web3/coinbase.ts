import CoinbaseWalletSDK from '@coinbase/wallet-sdk';
import { ethers } from 'ethers';

export interface CoinbaseConnection {
    provider: ethers.BrowserProvider;
    address: string;
    chainId: number;
    coinbaseProvider: any;
}

let coinbaseWallet: any = null;
let coinbaseProvider: any = null;

/**
 * Initialize Coinbase Wallet SDK
 */
function initializeCoinbaseWallet() {
    if (coinbaseWallet) {
        return coinbaseWallet;
    }

    coinbaseWallet = new CoinbaseWalletSDK({
        appName: 'CryptX Portfolio Tracker',
        appLogoUrl: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : undefined,
    });

    coinbaseProvider = coinbaseWallet.makeWeb3Provider();
    return coinbaseWallet;
}

/**
 * Connect to Coinbase Wallet
 */
export async function connectCoinbaseWallet(): Promise<CoinbaseConnection> {
    if (typeof window === 'undefined') {
        throw new Error('Window is undefined');
    }

    try {
        // Check if Coinbase Wallet extension is available
        let coinbaseExtensionProvider: any = null;

        if ((window as any).ethereum?.providers?.length) {
            // Multiple providers - find Coinbase specifically
            coinbaseExtensionProvider = (window as any).ethereum.providers.find(
                (p: any) => p.isCoinbaseWallet || p.isCoinbaseBrowser
            );
        } else if ((window as any).ethereum?.isCoinbaseWallet) {
            // Single provider and it's Coinbase
            coinbaseExtensionProvider = (window as any).ethereum;
        }

        // If Coinbase extension is available, use it directly
        if (coinbaseExtensionProvider) {
            const accounts = await coinbaseExtensionProvider.request({
                method: 'eth_requestAccounts',
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }

            const address = ethers.getAddress(accounts[0]);

            const chainIdHex = await coinbaseExtensionProvider.request({
                method: 'eth_chainId',
            });
            const chainId = parseInt(chainIdHex, 16);

            const provider = new ethers.BrowserProvider(coinbaseExtensionProvider);

            return {
                provider,
                address,
                chainId,
                coinbaseProvider: coinbaseExtensionProvider,
            };
        }

        // Fallback to Coinbase Wallet SDK (for mobile or if extension not found)
        initializeCoinbaseWallet();

        const accounts = await coinbaseProvider.request({
            method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found');
        }

        const address = ethers.getAddress(accounts[0]); // Ensure EIP-55 checksum

        // Get chain ID
        const chainIdHex = await coinbaseProvider.request({
            method: 'eth_chainId',
        });
        const chainId = parseInt(chainIdHex, 16);

        // Create ethers provider
        const provider = new ethers.BrowserProvider(coinbaseProvider);

        return {
            provider,
            address,
            chainId,
            coinbaseProvider,
        };
    } catch (error: any) {
        console.error('Coinbase Wallet connection error:', error);

        if (error.code === 4001) {
            throw new Error('User rejected connection');
        }

        throw new Error(`Coinbase Wallet connection failed: ${error.message || error}`);
    }
}

/**
 * Sign message with Coinbase Wallet
 */
export async function signMessageWithCoinbase(
    coinbaseProvider: any,
    message: string,
    address: string
): Promise<string> {
    try {
        const signature = await coinbaseProvider.request({
            method: 'personal_sign',
            params: [message, address],
        });

        return signature;
    } catch (error) {
        console.error('Coinbase Wallet sign error:', error);
        throw new Error('Failed to sign message with Coinbase Wallet');
    }
}

/**
 * Disconnect Coinbase Wallet
 */
export async function disconnectCoinbaseWallet(coinbaseProvider: any): Promise<void> {
    try {
        await coinbaseProvider.disconnect();
    } catch (error) {
        console.error('Coinbase Wallet disconnect error:', error);
    }
}

/**
 * Check if Coinbase Wallet is available
 */
export function isCoinbaseWalletAvailable(): boolean {
    return typeof window !== 'undefined';
}
