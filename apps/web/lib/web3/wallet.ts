import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import {
    connectWalletConnect,
    signMessageWithWalletConnect,
    disconnectWalletConnect,
    WalletConnectConnection,
    isWalletConnectAvailable
} from './walletconnect';
import {
    connectCoinbaseWallet,
    signMessageWithCoinbase,
    disconnectCoinbaseWallet,
    CoinbaseConnection,
    isCoinbaseWalletAvailable
} from './coinbase';
import { MetaMaskProvider, WalletProvider } from '../../types/web3';

export type WalletProviderType = 'metamask' | 'walletconnect' | 'coinbase';

export interface WalletConnection {
    provider: ethers.BrowserProvider | ethers.JsonRpcProvider;
    signer?: ethers.JsonRpcSigner;
    address: string;
    chainId: number;
    providerType: WalletProviderType;
    walletConnectData?: {
        signClient: any;
        session: any;
    };
    coinbaseProvider?: any;
}

type WalletError = Error & {
    code?: number | string;
    cause?: unknown;
};

function toWalletError(error: unknown, prefix: string): WalletError {
    if (error instanceof Error) {
        const walletError = error as WalletError;
        if (!walletError.message.startsWith(prefix)) {
            walletError.message = `${prefix}: ${walletError.message}`;
        }
        return walletError;
    }

    const message = typeof error === 'string' && error ? error : 'Unknown error';
    const wrappedError = new Error(`${prefix}: ${message}`) as WalletError;
    wrappedError.cause = error;

    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = (error as { code?: unknown }).code;
        if (typeof code === 'number' || typeof code === 'string') {
            wrappedError.code = code;
        }
    }

    return wrappedError;
}

/**
 * Connect to Coinbase Wallet
 */
export async function connectCoinbase(): Promise<WalletConnection> {
    if (!isCoinbaseWalletAvailable()) {
        throw new Error('Coinbase Wallet is not available');
    }

    try {
        const cbConnection = await connectCoinbaseWallet();

        return {
            provider: cbConnection.provider,
            address: cbConnection.address,
            chainId: cbConnection.chainId,
            providerType: 'coinbase',
            coinbaseProvider: cbConnection.coinbaseProvider,
        };
    } catch (error: unknown) {
        throw toWalletError(error, 'Coinbase Wallet connection failed');
    }
}

/**
 * Connect to WalletConnect
 */
export async function connectWalletConnectProvider(): Promise<WalletConnection> {
    if (!isWalletConnectAvailable()) {
        throw new Error('WalletConnect is not available');
    }

    try {
        const wcConnection = await connectWalletConnect();

        return {
            provider: wcConnection.provider,
            address: wcConnection.address,
            chainId: wcConnection.chainId,
            providerType: 'walletconnect',
            walletConnectData: {
                signClient: wcConnection.signClient,
                session: wcConnection.session,
            },
        };
    } catch (error: unknown) {
        throw toWalletError(error, 'WalletConnect connection failed');
    }
}

/**
 * Auto-detect and connect to available wallet
 */
export async function connectWallet(): Promise<WalletConnection> {
    let metaMaskError: any = null;

    // Try MetaMask first (desktop)
    if (typeof window !== 'undefined') {
        try {
            // Check specifically for the presence of the provider before even trying
            if (!window.ethereum) {
                const error = new Error('MetaMask is not installed');
                (error as any).code = 'METAMASK_NOT_INSTALLED';
                throw error;
            }
            return await connectMetaMask();
        } catch (error: any) {
            console.warn('MetaMask connection failed, trying WalletConnect:', error);
            metaMaskError = error;
        }
    }

    // Fallback to WalletConnect (mobile)
    if (isWalletConnectAvailable()) {
        try {
            return await connectWalletConnectProvider();
        } catch (wcError: any) {
            // If WalletConnect fails and we had a MetaMask error (installation missing),
            // prefer the MetaMask error so the UI shows the download link.
            if (metaMaskError && metaMaskError.code === 'METAMASK_NOT_INSTALLED') {
                throw metaMaskError;
            }
            // Both providers failed for non-installation reasons — surface both messages
            // so developers and users can see exactly what went wrong on each side.
            if (metaMaskError) {
                throw new Error(
                    `All wallet providers failed. MetaMask: ${metaMaskError.message}. ` +
                    `WalletConnect: ${wcError.message}`
                );
            }
            throw wcError;
        }
    }

    // If no WalletConnect and we had a MetaMask error, throw that one.
    if (metaMaskError) {
        throw metaMaskError;
    }

    throw new Error('No wallet provider available. Please install MetaMask or use WalletConnect.');
}
/**
 * Connect to MetaMask
 */
export async function connectMetaMask(): Promise<WalletConnection> {
    if (typeof window === 'undefined') {
        throw new Error('Window is undefined');
    }

    if (!window.ethereum) {
        const error = new Error('MetaMask is not installed');
        (error as any).code = 'METAMASK_NOT_INSTALLED';
        throw error;
    }

    try {
        // Handle multiple wallet providers (e.g., MetaMask + Coinbase)
        let metaMaskProvider: any;

        if ((window.ethereum as any).providers?.length) {
            // Multiple providers detected - find MetaMask specifically
            metaMaskProvider = (window.ethereum as any).providers.find((p: any) => p.isMetaMask);

            if (!metaMaskProvider) {
                throw new Error('MetaMask provider not found. Please ensure MetaMask extension is installed.');
            }
        } else if ((window.ethereum as any).isMetaMask) {
            // Single provider and it's MetaMask
            metaMaskProvider = window.ethereum;
        } else {
            throw new Error('MetaMask is not available. Please install MetaMask extension.');
        }

        // Request account access from the specific MetaMask provider
        await metaMaskProvider.request({
            method: 'eth_requestAccounts'
        });

        const provider = new ethers.BrowserProvider(metaMaskProvider);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();

        return {
            provider,
            signer,
            address, // Keep checksummed address (EIP-55 compliant)
            chainId: Number(network.chainId),
            providerType: 'metamask',
        };
    } catch (error: any) {
        if (error.code === 4001) {
            throw new Error('User rejected connection');
        }
        if (error.code === -32002) {
            throw new Error('MetaMask request already pending. Please check MetaMask extension and approve/reject the pending request.');
        }
        throw new Error(`MetaMask connection failed: ${error.message}`);
    }
}

/**
 * Switch chain in MetaMask
 */
export async function switchChain(chainId: number): Promise<void> {
    if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
    }

    const chainIdHex = `0x${chainId.toString(16)}`;

    try {
        await (window.ethereum as MetaMaskProvider).request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
        });
    } catch (error: any) {
        // Chain not added to MetaMask
        if (error.code === 4902) {
            throw new Error(`Chain ${chainId} not configured in wallet`);
        }
        throw error;
    }
}

/**
 * Sign message with SIWE format (supports MetaMask, WalletConnect, and Coinbase Wallet)
 */
export async function signInWithEthereum(
    connection: WalletConnection,
    address: string,
    nonce: string
): Promise<{ message: string; signature: string }> {
    const domain = window.location.host;
    const origin = window.location.origin;

    const siweMessage = new SiweMessage({
        domain,
        address,
        statement: 'Sign in to CryptX Portfolio Tracker',
        uri: origin,
        version: '1',
        chainId: 1, // Ethereum mainnet for auth
        nonce,
        issuedAt: new Date().toISOString(),
    });

    const message = siweMessage.prepareMessage();
    let signature: string;

    if (connection.providerType === 'metamask' && connection.signer) {
        // MetaMask signing
        signature = await connection.signer.signMessage(message);
    } else if (connection.providerType === 'walletconnect' && connection.walletConnectData) {
        // WalletConnect signing
        signature = await signMessageWithWalletConnect(
            connection.walletConnectData.signClient,
            connection.walletConnectData.session,
            message,
            address
        );
    } else if (connection.providerType === 'coinbase' && connection.coinbaseProvider) {
        // Coinbase Wallet signing
        signature = await signMessageWithCoinbase(
            connection.coinbaseProvider,
            message,
            address
        );
    } else {
        throw new Error('Invalid wallet connection for signing');
    }

    return { message, signature };
}

/**
 * Get token balance (ERC-20)
 */
export async function getTokenBalance(
    provider: ethers.BrowserProvider,
    tokenAddress: string,
    walletAddress: string
): Promise<string> {
    const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
    ];
    const contract = new ethers.Contract(tokenAddress, abi, provider);

    const balance = await contract.balanceOf(walletAddress);

    // Fetch decimals dynamically — USDC=6, WBTC=8, most tokens=18
    // Fallback to 18 if the contract doesn't expose decimals() (non-standard ERC-20)
    let decimals = 18;
    try {
        decimals = await contract.decimals();
    } catch {
        decimals = 18;
    }

    return ethers.formatUnits(balance, decimals);
}

/**
 * Disconnect wallet (supports MetaMask, WalletConnect, and Coinbase Wallet)
 */
export async function disconnectWallet(connection: WalletConnection): Promise<void> {
    if (connection.providerType === 'walletconnect' && connection.walletConnectData) {
        await disconnectWalletConnect(
            connection.walletConnectData.signClient,
            connection.walletConnectData.session
        );
    } else if (connection.providerType === 'coinbase' && connection.coinbaseProvider) {
        await disconnectCoinbaseWallet(connection.coinbaseProvider);
    }
    // MetaMask doesn't require explicit disconnection
}

/**
 * Get native ETH balance
 */
export async function getNativeBalance(
    provider: ethers.BrowserProvider | ethers.JsonRpcProvider,
    address: string
): Promise<string> {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
}
