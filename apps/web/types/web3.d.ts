import { ethers } from 'ethers';

// MetaMask provider interface
export interface MetaMaskProvider extends ethers.Eip1193Provider {
    isMetaMask?: boolean;
    providers?: MetaMaskProvider[];
    request(args: { method: string; params?: any[] }): Promise<any>;
    
    // Events
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    removeListener(event: string, handler: (...args: any[]) => void): void;
    
    // MetaMask specific methods
    enable?(): Promise<string[]>;
    isConnected?(): boolean;
}

// WalletConnect provider interface
export interface WalletConnectProvider {
    session: any;
    request(args: { method: string; params?: any[] }): Promise<any>;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    disconnect(): Promise<void>;
}

// Unified wallet provider interface
export interface WalletProvider {
    address: string;
    chainId: number;
    providerType: 'metamask' | 'walletconnect';
    
    // Common methods
    request(args: { method: string; params?: any[] }): Promise<any>;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    disconnect(): Promise<void>;
}

// Window interface augmentation
declare global {
    interface Window {
        ethereum?: MetaMaskProvider;
        web3?: any;
    }
}

// Provider detection utilities
export interface ProviderInfo {
    name: string;
    id: string;
    icon: string;
    type: 'injected' | 'walletconnect';
    isAvailable: boolean;
}

// Common provider IDs
export const PROVIDER_IDS = {
    METAMASK: 'metamask',
    WALLETCONNECT: 'walletconnect',
    COINBASE: 'coinbase',
    BRAVE: 'brave',
} as const;

// Chain information
export interface ChainInfo {
    chainId: string;
    chainName: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls?: string[];
}

// RPC request/response types
export interface RPCRequest {
    method: string;
    params?: any[];
}

export interface RPCResponse<T = any> {
    id: string | number;
    jsonrpc: string;
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

// Event types
export type ProviderEvent = 
    | 'accountsChanged'
    | 'chainChanged'
    | 'connect'
    | 'disconnect'
    | 'message';

export type EventHandler = (...args: any[]) => void;

// Error types
export interface ProviderError extends Error {
    code: number;
    message: string;
    data?: any;
}

// Common error codes
export const ERROR_CODES = {
    USER_REJECTED: 4001,
    UNAUTHORIZED: 4100,
    UNSUPPORTED_METHOD: 4200,
    DISCONNECTED: 4900,
    CHAIN_DISCONNECTED: 4901,
    NOT_CONNECTED: 4902,
} as const;

// Transaction types
export interface TransactionRequest {
    to?: string;
    from?: string;
    value?: string;
    data?: string;
    gas?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: string;
}

export interface TransactionResponse {
    hash: string;
    blockHash?: string;
    blockNumber?: number;
    transactionIndex?: number;
    from: string;
    to?: string;
    value: string;
    gas?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    input: string;
    nonce: number;
    transactionHash: string;
    confirmations?: number;
}

// Signature types
export interface SignatureData {
    signature: string;
    message: string;
    address: string;
}

// Network types
export interface NetworkInfo {
    chainId: string;
    name: string;
    ensAddress?: string;
}

// Utility types
export type ProviderType = 'metamask' | 'walletconnect' | 'coinbase' | 'brave';
export type ChainId = string | number;
export type Address = string;
