import axios from 'axios';
import apiClient, { getAuthHeaders } from './api';
import { API_BASE_URL } from './apiConfig';

export interface Asset {
    symbol: string;
    name: string;
    totalBalance: string;
    valueUsd: number;
    chains: {
        chain: string;
        balance: string;
        valueUsd: number;
    }[];
}

export interface WalletData {
    id: string;
    address: string;
    nickname?: string;
    provider?: string;
    valueUsd: number;
    chains: Array<{
        chain: string;
        balance?: string;
        valueUsd?: number;
    }>;
}

export interface ExchangePortfolioData {
    id: string;
    provider: string;
    nickname?: string;
    valueUsd: number;
    lastSyncedAt?: string;
    balances: Array<{
        symbol: string;
        balance: string;
        lockedBalance: string;
        availableBalance: string;
        valueUsd: number;
    }>;
}

export interface PortfolioResponse {
    totalValueUsd: number;
    totalInvestedUsd?: number;
    totalRealizedPnL?: number;
    totalUnrealizedPnL?: number;
    totalPnL?: number;
    totalPnLPercentage?: number;
    pnlStatus?: 'complete' | 'incomplete';
    pnlNotice?: string;
    change24h?: number;
    change7d?: number;
    change30d?: number;
    wallets: WalletData[];
    exchanges: ExchangePortfolioData[];
    assets: Asset[];
    lastUpdated: string;
    cached?: boolean;
}

export interface PortfolioLiveEvent {
    portfolio: PortfolioResponse;
    reason?: string;
}

export interface PortfolioHistoryPoint {
    id: string;
    totalValueUsd: number;
    generatedAt: string;
}

export interface PortfolioHistoryQuery {
    limit?: number;
    from?: string;
    to?: string;
}

export interface PortfolioLiveStreamHandlers {
    onPortfolio: (event: PortfolioLiveEvent) => void;
    onError?: (message: string) => void;
    onConnected?: () => void;
    signal?: AbortSignal;
}

const parseSseEvent = (rawEvent: string): { event: string; data: string } | null => {
    const trimmed = rawEvent.trim();
    if (!trimmed) {
        return null;
    }

    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of trimmed.split('\n')) {
        if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
            continue;
        }

        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
        }
    }

    return {
        event: eventName,
        data: dataLines.join('\n'),
    };
};

export const portfolioApi = {
    getPortfolio: async (cached = false): Promise<PortfolioResponse> => {
        const { data } = await apiClient.get(`/portfolio?cached=${cached}`);
        return data;
    },

    refreshPortfolio: async (): Promise<PortfolioResponse> => {
        const { data } = await apiClient.post('/portfolio/refresh');
        return data;
    },

    getHistory: async (query: PortfolioHistoryQuery = {}): Promise<PortfolioHistoryPoint[]> => {
        const params = new URLSearchParams();
        params.set('limit', String(query.limit ?? 30));

        if (query.from) {
            params.set('from', query.from);
        }

        if (query.to) {
            params.set('to', query.to);
        }

        const { data } = await apiClient.get(`/portfolio/history?${params.toString()}`);
        return data;
    },

    getAllocation: async () => {
        const { data } = await apiClient.get('/portfolio/allocation');
        return data;
    },

    getMetrics: async () => {
        const { data } = await apiClient.get('/portfolio/metrics');
        return data;
    },

    subscribeLive: async ({
        onPortfolio,
        onError,
        onConnected,
        signal,
    }: PortfolioLiveStreamHandlers): Promise<() => Promise<void>> => {
        const authHeaders = await getAuthHeaders();

        if (!authHeaders.Authorization) {
            throw new Error('No authentication token available for live portfolio stream');
        }

        const response = await fetch(`${API_BASE_URL}/portfolio/live`, {
            method: 'GET',
            headers: {
                Accept: 'text/event-stream',
                ...authHeaders,
            },
            signal,
            cache: 'no-store',
        });

        if (!response.ok || !response.body) {
            throw new Error(`Live portfolio stream failed with status ${response.status}`);
        }

        onConnected?.();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const readLoop = async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        if (!signal?.aborted) {
                            onError?.('Live portfolio stream closed');
                        }
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop() ?? '';

                    for (const rawEvent of events) {
                        const parsedEvent = parseSseEvent(rawEvent);
                        if (!parsedEvent?.data) {
                            continue;
                        }

                        if (parsedEvent.event === 'heartbeat' || parsedEvent.event === 'ready') {
                            continue;
                        }

                        if (parsedEvent.event === 'error') {
                            const payload = JSON.parse(parsedEvent.data) as { error?: string };
                            onError?.(payload.error || 'Live portfolio stream error');
                            continue;
                        }

                        if (parsedEvent.event === 'portfolio') {
                            const payload = JSON.parse(parsedEvent.data) as PortfolioLiveEvent;
                            onPortfolio(payload);
                        }
                    }
                }
            } catch (error: any) {
                if (signal?.aborted) {
                    return;
                }

                onError?.(error?.message || 'Live portfolio stream disconnected');
            }
        };

        void readLoop();

        return async () => {
            try {
                await reader.cancel();
            } catch {
                // Ignore cancellation failures during teardown.
            }
        };
    },
};

export interface Wallet {
    id: string;
    address: string;
    provider: string;
    chainTypes: string[];
    nickname?: string;
    isActive: boolean;
    createdAt: string;
}

export interface AddWalletResponse extends Wallet {
    alreadyConnected?: boolean;
    reactivated?: boolean;
}

export const walletApi = {
    addWallet: async (walletData: {
        address: string;
        provider: string;
        chainTypes?: string[];
        nickname?: string;
    }): Promise<AddWalletResponse> => {
        const { data } = await apiClient.post('/wallets', walletData);
        return data;
    },

    getWallets: async (): Promise<Wallet[]> => {
        const { data } = await apiClient.get('/wallets');
        return data;
    },

    deleteWallet: async (id: string): Promise<void> => {
        console.log('🌐 API: Deleting wallet:', id);
        console.log('🌐 API: Request URL:', `/wallets/${id}`);
        console.log('🌐 API: Base URL:', apiClient.defaults.baseURL);
        
        try {
            const response = await apiClient.delete(`/wallets/${id}`);
            console.log('🌐 API: Delete successful:', response.data);
            return response.data;
        } catch (error: unknown) {
            console.error('🌐 API: Delete failed:', error);
            if (axios.isAxiosError(error)) {
                console.error('🌐 API: Error response:', error.response);
            }
            throw error;
        }
    },

    getWalletBalances: async (id: string) => {
        const { data } = await apiClient.get(`/wallets/${id}/balances`);
        return data;
    },
};
