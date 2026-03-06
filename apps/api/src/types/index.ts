// Shared TypeScript types and interfaces

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  contractAddress?: string;
  valueUsd?: number;
}

export interface ChainBalance {
  chain: string;
  chainId: number;
  nativeBalance: TokenBalance;
  tokens: TokenBalance[];
  totalValueUsd: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  verified: boolean;
}

export interface TokenPrice {
  symbol: string;
  priceUsd: number;
  priceChange24h?: number;
  lastUpdated: Date;
  source: string;
}

export interface AssetSummary {
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

export interface PortfolioData {
  totalValueUsd: number;
  wallets: {
    id: string;
    address: string;
    nickname?: string;
    valueUsd: number;
    chains: ChainBalance[];
  }[];
  assets: AssetSummary[];
  lastUpdated: Date;
}

export interface JWTPayload {
  userId: string;
  address: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}

export interface PriceProvider {
  name: string;
  fetchPrice: (symbol: string) => Promise<number | null>;
  fetchBulkPrices?: (symbols: string[]) => Promise<Record<string, number>>;
  priority: number;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface Transaction {
  id: string;
  walletId: string;
  txHash: string;
  type: 'receive' | 'send' | 'swap' | 'contract';
  asset: string;
  amount: number;
  priceUsd?: number;
  timestamp: Date;
  blockNumber?: number;
  fromAddress?: string;
  toAddress?: string;
  chain: string;
}

export interface AIAnalysis {
  diversificationScore: number;
  riskScore: 'Low' | 'Medium' | 'High';
  volatility: number;
  concentratedPositions: {
    symbol: string;
    percentage: number;
  }[];
  forecasts: {
    days: number;
    predictedValue: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  }[];
  recommendations: {
    action: string;
    rationale: string;
    priority: 'High' | 'Medium' | 'Low';
  }[];
}

export interface PerformanceMetrics {
  change24h: {
    percentage: number;
    absolute: number;
  };
  change7d: {
    percentage: number;
    absolute: number;
  };
  change30d: {
    percentage: number;
    absolute: number;
  };
  bestPerformers: {
    symbol: string;
    change: number;
  }[];
  worstPerformers: {
    symbol: string;
    change: number;
  }[];
}

export interface AllocationData {
  assets: {
    symbol: string;
    percentage: number;
    valueUsd: number;
  }[];
  chains: {
    chain: string;
    percentage: number;
    valueUsd: number;
  }[];
}
