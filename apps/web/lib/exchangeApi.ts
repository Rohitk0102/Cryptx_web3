import apiClient from './api';

export interface ExchangeAccount {
  id: string;
  provider: string;
  nickname?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface ConnectExchangeParams {
  provider: 'coindcx';
  apiKey: string;
  apiSecret: string;
  nickname?: string;
}

export interface ExchangeBalance {
  symbol: string;
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  valueUsd: number;
}

export interface ExchangeTrade {
  id: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  fee: string;
  feeAsset: string;
  timestamp: string;
  createdAt: string;
}

export interface TradeHistoryResponse {
  trades: ExchangeTrade[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SyncTradeHistoryParams {
  symbol?: string;
  limit?: number;
  maxBatches?: number;
}

export interface TradeHistoryDiagnostics {
  emptyTradeHistory: boolean;
  userInfo?: {
    coindcxId?: string;
    email?: string;
  };
  probes: Array<{
    label: string;
    count?: number;
    error?: string;
  }>;
  likelyCause: string;
  recommendation: string;
  docHint: string;
}

export interface GetTradeHistoryParams {
  page?: number;
  limit?: number;
  symbol?: string;
  side?: 'buy' | 'sell';
  startDate?: string;
  endDate?: string;
}

export const exchangeApi = {
  /**
   * Connect a new exchange account
   */
  connect: async (params: ConnectExchangeParams): Promise<ExchangeAccount> => {
    const { data } = await apiClient.post('/exchange/connect', params);
    return data;
  },

  /**
   * Get all connected exchange accounts
   */
  getAccounts: async (): Promise<ExchangeAccount[]> => {
    const { data } = await apiClient.get('/exchange/accounts');
    return data;
  },

  /**
   * Sync balances for a specific exchange account
   */
  syncBalances: async (accountId: string): Promise<void> => {
    await apiClient.post(`/exchange/accounts/${accountId}/sync`);
  },

  /**
   * Sync trade history for a specific exchange account
   */
  syncTradeHistory: async (
    accountId: string,
    params?: SyncTradeHistoryParams
  ): Promise<{
    success: boolean;
    tradeCount: number;
    newTradesCount?: number;
    warning?: string;
    diagnostics?: TradeHistoryDiagnostics;
    lastSyncedAt: string;
  }> => {
    const { data } = await apiClient.post(
      `/exchange/accounts/${accountId}/sync-trades`,
      null,
      { params }
    );
    return data;
  },

  /**
   * Get trade history for a specific exchange account
   */
  getTradeHistory: async (
    accountId: string,
    params?: GetTradeHistoryParams
  ): Promise<TradeHistoryResponse> => {
    const { data } = await apiClient.get(
      `/exchange/accounts/${accountId}/trades`,
      { params }
    );
    return data;
  },

  /**
   * Delete an exchange account
   */
  deleteAccount: async (accountId: string): Promise<void> => {
    await apiClient.delete(`/exchange/accounts/${accountId}`);
  },

  /**
   * Get balances for a specific exchange account
   */
  getBalances: async (accountId: string): Promise<ExchangeBalance[]> => {
    const { data } = await apiClient.get(`/exchange/accounts/${accountId}/balances`);
    return data;
  },
};
