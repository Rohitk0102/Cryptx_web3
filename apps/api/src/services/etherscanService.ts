import { BlockchainServiceInterface, RawTransaction } from './transactionSync.service';
import { ethers } from 'ethers';

interface EtherscanTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timeStamp: string;
  blockNumber: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimal?: string;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanTransaction[];
}

export class EtherscanService implements BlockchainServiceInterface {
  private readonly chainConfigs = {
    ethereum: {
      baseUrl: 'https://api.etherscan.io/api',
      nativeCurrency: 'ETH',
      apiKeyEnv: 'ETHERSCAN_API_KEY',
    },
    polygon: {
      baseUrl: 'https://api.polygonscan.com/api',
      nativeCurrency: 'MATIC',
      apiKeyEnv: 'POLYGONSCAN_API_KEY',
    },
    bsc: {
      baseUrl: 'https://api.bscscan.com/api',
      nativeCurrency: 'BNB',
      apiKeyEnv: 'BSCSCAN_API_KEY',
    },
  };

  async getTransactions(
    walletAddress: string,
    chain: string,
    options?: { startBlock?: number }
  ): Promise<RawTransaction[]> {
    const config = this.chainConfigs[chain as keyof typeof this.chainConfigs];
    if (!config) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const apiKey = this.getApiKey(config.apiKeyEnv);
    const startBlock = options?.startBlock || 0;

    try {
      // Fetch both normal transactions and ERC-20 token transfers
      const [normalTxs, tokenTxs] = await Promise.all([
        this.fetchNormalTransactions(config.baseUrl, walletAddress, apiKey, startBlock),
        this.fetchTokenTransactions(config.baseUrl, walletAddress, apiKey, startBlock),
      ]);

      // Merge and deduplicate by hash
      const allTransactions = [...normalTxs, ...tokenTxs];
      const uniqueTransactions = this.deduplicateByHash(allTransactions);

      // Convert to RawTransaction format
      return uniqueTransactions.map(tx => this.mapToRawTransaction(tx, chain, config.nativeCurrency));
    } catch (error: any) {
      console.error(`Error fetching transactions for ${chain}:`, error);
      throw new Error(`Failed to fetch transactions from ${chain}: ${error.message}`);
    }
  }

  private getApiKey(envVar: string): string {
    const apiKey = process.env[envVar] || process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      throw new Error(`API key not found. Set ${envVar} or ETHERSCAN_API_KEY environment variable`);
    }
    return apiKey;
  }

  private async fetchNormalTransactions(
    baseUrl: string,
    address: string,
    apiKey: string,
    startBlock: number
  ): Promise<EtherscanTransaction[]> {
    const url = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=latest&sort=desc&apikey=${apiKey}`;
    
    return this.fetchWithTimeout(url);
  }

  private async fetchTokenTransactions(
    baseUrl: string,
    address: string,
    apiKey: string,
    startBlock: number
  ): Promise<EtherscanTransaction[]> {
    const url = `${baseUrl}?module=account&action=tokentx&address=${address}&startblock=${startBlock}&endblock=latest&sort=desc&apikey=${apiKey}`;
    
    return this.fetchWithTimeout(url);
  }

  private async fetchWithTimeout(url: string): Promise<EtherscanTransaction[]> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
    });

    try {
      const response = await Promise.race([
        fetch(url),
        timeoutPromise,
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as EtherscanResponse;

      // Handle Etherscan API responses
      if (data.status === '0') {
        if (data.message === 'No transactions found') {
          return [];
        }
        throw new Error(`Etherscan API error: ${data.message}`);
      }

      return data.result || [];
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        throw error;
      }
      throw new Error(`Network request failed: ${error.message}`);
    }
  }

  private deduplicateByHash(transactions: EtherscanTransaction[]): EtherscanTransaction[] {
    const seen = new Set<string>();
    return transactions.filter(tx => {
      if (seen.has(tx.hash)) {
        return false;
      }
      seen.add(tx.hash);
      return true;
    });
  }

  private mapToRawTransaction(
    tx: EtherscanTransaction,
    chain: string,
    nativeCurrency: string
  ): RawTransaction {
    // Determine if this is a token transfer or native currency transfer
    const isTokenTransfer = !!tx.contractAddress && !!tx.tokenSymbol;
    
    let value: string;
    let tokenSymbol: string;
    let tokenAddress: string | undefined;

    if (isTokenTransfer) {
      // ERC-20 token transfer
      const decimals = parseInt(tx.tokenDecimal || '18');
      value = ethers.formatUnits(tx.value, decimals);
      tokenSymbol = tx.tokenSymbol!;
      tokenAddress = tx.contractAddress;
    } else {
      // Native currency transfer
      value = ethers.formatEther(tx.value);
      tokenSymbol = nativeCurrency;
      tokenAddress = undefined;
    }

    // Calculate transaction fee (gas used * gas price)
    const gasUsed = BigInt(tx.gasUsed || '0');
    const gasPrice = BigInt(tx.gasPrice || '0');
    const feeWei = gasUsed * gasPrice;
    const fee = ethers.formatEther(feeWei);

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value,
      tokenSymbol,
      tokenAddress,
      timestamp: new Date(parseInt(tx.timeStamp) * 1000),
      chain,
      fee,
      feeToken: nativeCurrency,
      blockNumber: parseInt(tx.blockNumber),
    };
  }
}