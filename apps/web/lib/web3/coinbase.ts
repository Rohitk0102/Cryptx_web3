import { createCoinbaseWalletSDK, type ProviderInterface } from '@coinbase/wallet-sdk';
import { ethers } from 'ethers';

type CoinbaseProvider = ProviderInterface & {
    isCoinbaseWallet?: boolean;
    isCoinbaseBrowser?: boolean;
    disconnect?: () => Promise<void>;
};

type WalletError = Error & {
    code?: number | string;
    data?: unknown;
    docUrl?: string;
    cause?: unknown;
};

interface ErrorShape {
    message?: unknown;
    code?: unknown;
    data?: unknown;
    docUrl?: unknown;
    error?: ErrorShape;
    cause?: ErrorShape;
    shortMessage?: unknown;
    reason?: unknown;
}

export interface CoinbaseConnection {
    provider: ethers.BrowserProvider;
    address: string;
    chainId: number;
    coinbaseProvider: CoinbaseProvider;
}

const SUPPORTED_CHAIN_IDS = [1, 137, 56];
let coinbaseProvider: CoinbaseProvider | null = null;

function initializeCoinbaseWallet(): CoinbaseProvider {
    if (coinbaseProvider) {
        return coinbaseProvider;
    }

    const sdk = createCoinbaseWalletSDK({
        appName: 'CryptX Portfolio Tracker',
        appLogoUrl: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : null,
        appChainIds: SUPPORTED_CHAIN_IDS,
        preference: {
            options: 'all',
        },
    });

    coinbaseProvider = sdk.getProvider() as CoinbaseProvider;
    return coinbaseProvider;
}

function getNestedErrorMessage(error: ErrorShape | undefined): string | undefined {
    if (!error) {
        return undefined;
    }

    const messageCandidates = [
        error.message,
        error.shortMessage,
        error.reason,
        error.error?.message,
        error.cause?.message,
    ];

    for (const candidate of messageCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate;
        }
    }

    return undefined;
}

function getErrorCode(error: ErrorShape | undefined): number | string | undefined {
    const candidates = [error?.code, error?.error?.code, error?.cause?.code];

    for (const candidate of candidates) {
        if (typeof candidate === 'number' || typeof candidate === 'string') {
            return candidate;
        }
    }

    return undefined;
}

function safeSerializeError(error: unknown): string {
    if (typeof error === 'string') {
        return error;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return Object.prototype.toString.call(error);
    }
}

function normalizeCoinbaseError(error: unknown): WalletError {
    const errorShape = (typeof error === 'object' && error !== null ? error : undefined) as ErrorShape | undefined;
    const code = getErrorCode(errorShape);
    const originalMessage = getNestedErrorMessage(errorShape) ||
        (error instanceof Error ? error.message : undefined) ||
        safeSerializeError(error);

    let message = originalMessage && originalMessage !== '{}' ? originalMessage : 'Unknown Coinbase Wallet error';

    if (code === 4001 || /denied|rejected/i.test(message)) {
        message = 'User rejected connection';
    } else if (code === -32002 || /already pending|request already pending/i.test(message)) {
        message = 'Coinbase Wallet request already pending. Please check Coinbase Wallet and finish the existing request.';
    } else if (code === 4100 || /unauthorized/i.test(message)) {
        message = 'Coinbase Wallet authorization failed. Please reconnect and approve the request.';
    } else if (code === 4900 || code === 4901 || /disconnected/i.test(message)) {
        message = 'Coinbase Wallet is disconnected. Please reopen Coinbase Wallet and try again.';
    }

    const normalized = new Error(message) as WalletError;
    normalized.name = 'CoinbaseWalletError';
    normalized.code = code;
    normalized.data = errorShape?.data ?? errorShape?.error?.data;

    const docUrl = errorShape?.docUrl;
    if (typeof docUrl === 'string') {
        normalized.docUrl = docUrl;
    }

    normalized.cause = error;
    return normalized;
}

function isUserRejectionError(error: WalletError): boolean {
    return error.code === 4001 || /user rejected/i.test(error.message);
}

/**
 * Connect to Coinbase Wallet
 */
export async function connectCoinbaseWallet(): Promise<CoinbaseConnection> {
    if (typeof window === 'undefined') {
        throw new Error('Window is undefined');
    }

    try {
        const providerAdapter = initializeCoinbaseWallet();

        await providerAdapter.request({
            method: 'eth_requestAccounts',
        });

        const provider = new ethers.BrowserProvider(providerAdapter as ethers.Eip1193Provider);
        const signer = await provider.getSigner();
        const address = ethers.getAddress(await signer.getAddress());

        let chainId: number;
        try {
            const network = await provider.getNetwork();
            chainId = Number(network.chainId);
        } catch {
            const chainIdHex = await providerAdapter.request({
                method: 'eth_chainId',
            });
            chainId = parseInt(String(chainIdHex), 16);
        }

        return {
            provider,
            address,
            chainId,
            coinbaseProvider: providerAdapter,
        };
    } catch (error: unknown) {
        const normalizedError = normalizeCoinbaseError(error);
        const logPayload = {
            message: normalizedError.message,
            code: normalizedError.code,
            docUrl: normalizedError.docUrl,
            data: normalizedError.data,
        };

        if (isUserRejectionError(normalizedError)) {
            console.info('Coinbase Wallet connection cancelled:', logPayload);
        } else {
            console.error('Coinbase Wallet connection error:', logPayload);
        }

        throw normalizedError;
    }
}

/**
 * Sign message with Coinbase Wallet
 */
export async function signMessageWithCoinbase(
    providerAdapter: CoinbaseProvider,
    message: string,
    address: string
): Promise<string> {
    try {
        const signature = await providerAdapter.request({
            method: 'personal_sign',
            params: [message, address],
        });

        return String(signature);
    } catch (error: unknown) {
        const normalizedError = normalizeCoinbaseError(error);
        const logPayload = {
            message: normalizedError.message,
            code: normalizedError.code,
            docUrl: normalizedError.docUrl,
        };

        if (isUserRejectionError(normalizedError)) {
            console.info('Coinbase Wallet signing cancelled:', logPayload);
        } else {
            console.error('Coinbase Wallet sign error:', logPayload);
        }
        throw normalizedError;
    }
}

/**
 * Disconnect Coinbase Wallet
 */
export async function disconnectCoinbaseWallet(providerAdapter: CoinbaseProvider): Promise<void> {
    try {
        if (typeof providerAdapter.disconnect === 'function') {
            await providerAdapter.disconnect();
        }
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
