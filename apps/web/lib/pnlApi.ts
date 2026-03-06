import apiClient from './api';

export interface Transaction {
  id: string;
  userId: string;
  walletAddress: string;
  chain: string;
  tokenSymbol: string;
  txType: 'buy' | 'sell' | 'swap' | 'transfer' | 'fee';
  quantity: string;
  priceUsd: string;
  feeAmount: string | null;
  feeToken: string | null;
  timestamp: string;
  txHash: string;
  source: string;
  createdAt: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TokenPnL {
  tokenSymbol: string;
  realizedPnL: string;
  transactionCount?: number;
  holdings?: string;
  costBasis?: string;
  currentValue?: string;
  unrealizedPnL?: string;
  totalPnL?: string;
  percentageGain?: string;
}

export interface RealizedPnLResponse {
  totalRealizedPnL: string;
  byToken: TokenPnL[];
}

export interface UnrealizedHolding {
  tokenSymbol: string;
  quantity: string;
  costBasis: string;
  currentValue: string;
  unrealizedPnL: string;
  percentageGain: string;
}

export interface UnrealizedPnLResponse {
  totalUnrealizedPnL: string;
  holdings: UnrealizedHolding[];
}

export interface PnLSummaryResponse {
  totalRealizedPnL: string;
  totalUnrealizedPnL: string;
  totalPnL: string;
  costBasisMethod: string;
  byToken: TokenPnL[];
}

export interface SyncResult {
  success: boolean;
  newTransactionsCount: number;
  updatedHoldings?: number;
  errors?: {
    walletAddress: string;
    error: string;
  }[];
}

export interface SyncStatusResponse {
  activeSyncs: string[];
  walletStatus: {
    walletAddress: string;
    chain: string;
    syncing: boolean;
  }[];
}

/**
 * Get transactions with pagination and filtering
 */
export async function getTransactions(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  tokenSymbol?: string;
  txType?: string;
  walletAddress?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<TransactionsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);
  if (params?.tokenSymbol) queryParams.append('tokenSymbol', params.tokenSymbol);
  if (params?.txType) queryParams.append('txType', params.txType);
  if (params?.walletAddress) queryParams.append('walletAddress', params.walletAddress);
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const response = await apiClient.get(`/transactions?${queryParams.toString()}`);
  return response.data;
}

/**
 * Get realized P&L
 */
export async function getRealizedPnL(params?: {
  startDate?: string;
  endDate?: string;
  tokenSymbol?: string;
}): Promise<RealizedPnLResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);
  if (params?.tokenSymbol) queryParams.append('tokenSymbol', params.tokenSymbol);

  const response = await apiClient.get(`/pnl/realized?${queryParams.toString()}`);
  return response.data;
}

/**
 * Get unrealized P&L
 */
export async function getUnrealizedPnL(params?: {
  tokenSymbol?: string;
}): Promise<UnrealizedPnLResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.tokenSymbol) queryParams.append('tokenSymbol', params.tokenSymbol);

  const response = await apiClient.get(`/pnl/unrealized?${queryParams.toString()}`);
  return response.data;
}

/**
 * Get P&L summary (realized + unrealized)
 */
export async function getPnLSummary(params?: {
  startDate?: string;
  endDate?: string;
  tokenSymbol?: string;
}): Promise<PnLSummaryResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);
  if (params?.tokenSymbol) queryParams.append('tokenSymbol', params.tokenSymbol);

  const response = await apiClient.get(`/pnl/summary?${queryParams.toString()}`);
  return response.data;
}

/**
 * Update cost basis method preference
 */
export async function updateCostBasisMethod(method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'): Promise<{
  success: boolean;
  costBasisMethod: string;
  message: string;
}> {
  const response = await apiClient.patch('/pnl/cost-basis-method', { method });
  return response.data;
}

/**
 * Sync transactions from wallets
 */
export async function syncTransactions(walletAddresses?: string[]): Promise<SyncResult> {
  const response = await apiClient.post('/transactions/sync', { walletAddresses });
  return response.data;
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const response = await apiClient.get('/transactions/sync/status');
  return response.data;
}

/**
 * Export transactions to CSV
 */
export function exportTransactionsCSV(transactions: Transaction[]): void {
  const headers = [
    'Date',
    'Token',
    'Type',
    'Quantity',
    'Price (USD)',
    'Fee Amount',
    'Fee Token',
    'Total Value (USD)',
    'Wallet',
    'Chain',
    'Transaction Hash',
  ];

  const rows = transactions.map(tx => [
    new Date(tx.timestamp).toLocaleString(),
    tx.tokenSymbol,
    tx.txType,
    tx.quantity,
    tx.priceUsd,
    tx.feeAmount || '',
    tx.feeToken || '',
    (parseFloat(tx.quantity) * parseFloat(tx.priceUsd)).toFixed(2),
    tx.walletAddress,
    tx.chain,
    tx.txHash,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Export P&L summary to CSV
 */
export function exportPnLCSV(summary: PnLSummaryResponse): void {
  const headers = [
    'Token',
    'Holdings',
    'Cost Basis (USD)',
    'Current Value (USD)',
    'Unrealized P&L (USD)',
    'Realized P&L (USD)',
    'Total P&L (USD)',
    'Percentage Gain (%)',
  ];

  const rows = summary.byToken.map(token => [
    token.tokenSymbol,
    token.holdings || '0',
    token.costBasis || '0',
    token.currentValue || '0',
    token.unrealizedPnL || '0',
    token.realizedPnL || '0',
    token.totalPnL || '0',
    token.percentageGain || '0',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    '',
    `Total Realized P&L,"${summary.totalRealizedPnL}"`,
    `Total Unrealized P&L,"${summary.totalUnrealizedPnL}"`,
    `Total P&L,"${summary.totalPnL}"`,
    `Cost Basis Method,"${summary.costBasisMethod}"`,
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pnl_summary_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}
