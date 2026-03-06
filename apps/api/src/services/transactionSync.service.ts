/**
 * Transaction Sync Service
 * 
 * Handles synchronization of transactions from blockchain wallets.
 * 
 * Requirements:
 * - 2.1: Fetch transactions from all connected wallets using Blockchain Service
 * - 2.2: Fetch transactions from all connected exchanges
 * - 2.3: Ensure idempotency - no duplicate records
 * - 2.4: Prevent concurrent sync operations for the same wallet
 * - 2.5: Return count of new transactions added
 * - 2.6: Continue syncing other wallets if one fails
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '../utils/decimal';
import { PriceFetchingService } from './priceFetching.service';
import { CostBasisCalculator } from './costBasisCalculator';

export interface RawTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenAddress?: string;
  timestamp: Date;
  chain: string;
  fee?: string;
  feeToken?: string;
  blockNumber?: number;
}

export interface SyncResult {
  newTransactionsCount: number;
  updatedHoldings?: number;
  errors?: {
    walletAddress: string;
    error: string;
  }[];
}

export interface BlockchainServiceInterface {
  getTransactions(walletAddress: string, chain: string): Promise<RawTransaction[]>;
}

export class TransactionSyncService {
  private prisma: PrismaClient;
  private priceService: PriceFetchingService;
  private costBasisCalculator: CostBasisCalculator;
  private activeSyncs: Map<string, Promise<SyncResult>>;
  private blockchainService?: BlockchainServiceInterface;

  constructor(
    prisma: PrismaClient,
    priceService: PriceFetchingService,
    costBasisCalculator: CostBasisCalculator,
    blockchainService?: BlockchainServiceInterface
  ) {
    this.prisma = prisma;
    this.priceService = priceService;
    this.costBasisCalculator = costBasisCalculator;
    this.blockchainService = blockchainService;
    this.activeSyncs = new Map();
  }

  /**
   * Sync transactions for a specific wallet
   * Implements concurrent sync prevention (Requirement 2.4)
   * 
   * @param userId - User ID
   * @param walletAddress - Wallet address to sync
   * @param chain - Blockchain chain (e.g., "ethereum", "polygon")
   * @returns Sync result with count of new transactions
   */
  async syncWalletTransactions(
    userId: string,
    walletAddress: string,
    chain: string
  ): Promise<SyncResult> {
    const syncKey = `${walletAddress}:${chain}`;

    // Check for concurrent sync (Requirement 2.4)
    if (this.activeSyncs.has(syncKey)) {
      throw new Error(
        `Sync already in progress for wallet ${walletAddress} on ${chain}`
      );
    }

    try {
      // Mark sync as active
      const syncPromise = this.performSync(userId, walletAddress, chain);
      this.activeSyncs.set(syncKey, syncPromise);

      return await syncPromise;
    } finally {
      // Remove from active syncs
      this.activeSyncs.delete(syncKey);
    }
  }

  /**
   * Sync transactions for all user's wallets
   * Implements error handling for individual wallet failures (Requirement 2.6)
   * 
   * @param userId - User ID
   * @param walletAddresses - Optional array of specific wallet addresses to sync
   * @returns Aggregated sync result
   */
  async syncAllWallets(
    userId: string,
    walletAddresses?: string[]
  ): Promise<SyncResult> {
    // Get user's wallets
    const wallets = await this.prisma.wallet.findMany({
      where: {
        userId,
        isActive: true,
        ...(walletAddresses && { address: { in: walletAddresses } }),
      },
    });

    if (wallets.length === 0) {
      return {
        newTransactionsCount: 0,
        updatedHoldings: 0,
        errors: [],
      };
    }

    let totalNewTransactions = 0;
    const errors: { walletAddress: string; error: string }[] = [];

    // Sync each wallet, continuing on failures (Requirement 2.6)
    for (const wallet of wallets) {
      for (const chain of wallet.chainTypes) {
        try {
          const result = await this.syncWalletTransactions(
            userId,
            wallet.address,
            chain
          );
          totalNewTransactions += result.newTransactionsCount;
        } catch (error: any) {
          console.error(
            `Failed to sync wallet ${wallet.address} on ${chain}:`,
            error
          );
          errors.push({
            walletAddress: `${wallet.address}:${chain}`,
            error: error.message || 'Unknown error',
          });
        }
      }
    }

    return {
      newTransactionsCount: totalNewTransactions,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Perform the actual sync operation
   * Implements duplicate detection and transaction storage (Requirements 2.1, 2.3)
   * 
   * @param userId - User ID
   * @param walletAddress - Wallet address
   * @param chain - Blockchain chain
   * @returns Sync result
   */
  private async performSync(
    userId: string,
    walletAddress: string,
    chain: string
  ): Promise<SyncResult> {
    // Fetch transactions from blockchain (Requirement 2.1)
    if (!this.blockchainService) {
      throw new Error('Blockchain service not configured');
    }

    const rawTransactions = await this.blockchainService.getTransactions(
      walletAddress,
      chain
    );

    let newCount = 0;

    // Process each transaction
    for (const rawTx of rawTransactions) {
      try {
        // Check for duplicate (Requirement 2.3)
        const exists = await this.prisma.pnLTransaction.findUnique({
          where: {
            userId_txHash_walletAddress: {
              userId,
              txHash: rawTx.hash,
              walletAddress,
            },
          },
        });

        if (exists) {
          continue; // Skip duplicate
        }

        // Fetch historical price if not provided
        let priceUsd = new Decimal(0);
        if (rawTx.tokenSymbol) {
          const price = await this.priceService.getHistoricalPrice(
            rawTx.tokenSymbol,
            rawTx.timestamp
          );
          if (price) {
            priceUsd = price;
          }
        }

        // Classify transaction type
        const txType = this.classifyTransaction(rawTx, walletAddress);

        // Calculate quantity (convert from wei/smallest unit if needed)
        const quantity = new Decimal(rawTx.value);

        // Calculate fee amount
        let feeAmount: Decimal | null = null;
        if (rawTx.fee) {
          feeAmount = new Decimal(rawTx.fee);
        }

        // Store transaction
        // Convert Decimal to string for Prisma (Prisma will handle the conversion)
        await this.prisma.pnLTransaction.create({
          data: {
            userId,
            walletAddress,
            chain,
            tokenSymbol: rawTx.tokenSymbol || 'UNKNOWN',
            txType,
            quantity: quantity.toString(),
            priceUsd: priceUsd.toString(),
            feeAmount: feeAmount ? feeAmount.toString() : null,
            feeToken: rawTx.feeToken || null,
            timestamp: rawTx.timestamp,
            txHash: rawTx.hash,
            source: 'wallet',
          },
        });

        newCount++;
      } catch (error) {
        console.error(`Failed to process transaction ${rawTx.hash}:`, error);
        // Continue with next transaction
      }
    }

    // Recalculate holdings after sync (Requirement 2.5)
    if (newCount > 0) {
      await this.recalculateHoldings(userId);
    }

    return { newTransactionsCount: newCount };
  }

  /**
   * Classify transaction type based on transaction data
   * Determines if transaction is buy, sell, swap, transfer, or fee
   * 
   * @param rawTx - Raw transaction data
   * @param walletAddress - User's wallet address
   * @returns Transaction type
   */
  private classifyTransaction(
    rawTx: RawTransaction,
    walletAddress: string
  ): string {
    const normalizedWallet = walletAddress.toLowerCase();
    const from = rawTx.from.toLowerCase();
    const to = rawTx.to.toLowerCase();

    // Transfer to self
    if (from === normalizedWallet && to === normalizedWallet) {
      return 'transfer';
    }

    // Fee transaction (zero value)
    if (rawTx.value === '0' || parseFloat(rawTx.value) === 0) {
      return 'fee';
    }

    // Receiving tokens (buy or receive)
    if (to === normalizedWallet) {
      return 'buy';
    }

    // Sending tokens (sell or send)
    if (from === normalizedWallet) {
      return 'sell';
    }

    // Default to transfer
    return 'transfer';
  }

  /**
   * Recalculate holdings for all tokens after sync
   * Uses the cost basis calculator to update holdings
   * 
   * @param userId - User ID
   */
  private async recalculateHoldings(userId: string): Promise<void> {
    // Get user's cost basis method
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { costBasisMethod: true },
    });

    const method = (user?.costBasisMethod || 'FIFO') as 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE';

    // Get all unique token symbols for this user
    const transactions = await this.prisma.pnLTransaction.findMany({
      where: { userId },
      select: { tokenSymbol: true },
      distinct: ['tokenSymbol'],
    });

    // Update holdings for each token
    for (const tx of transactions) {
      try {
        await this.costBasisCalculator.updateHoldings(
          userId,
          tx.tokenSymbol,
          method
        );
      } catch (error) {
        console.error(
          `Failed to update holdings for ${tx.tokenSymbol}:`,
          error
        );
        // Continue with other tokens
      }
    }
  }

  /**
   * Check if a sync is currently in progress for a wallet
   * 
   * @param walletAddress - Wallet address
   * @param chain - Blockchain chain
   * @returns True if sync is in progress
   */
  isSyncInProgress(walletAddress: string, chain: string): boolean {
    const syncKey = `${walletAddress}:${chain}`;
    return this.activeSyncs.has(syncKey);
  }

  /**
   * Get list of wallets currently being synced
   * 
   * @returns Array of wallet:chain keys
   */
  getActiveSyncs(): string[] {
    return Array.from(this.activeSyncs.keys());
  }
}

/**
 * Factory function to create TransactionSyncService instance
 * 
 * @param prisma - Prisma client
 * @param priceService - Price fetching service
 * @param costBasisCalculator - Cost basis calculator
 * @param blockchainService - Optional blockchain service
 * @returns TransactionSyncService instance
 */
export function createTransactionSyncService(
  prisma: PrismaClient,
  priceService: PriceFetchingService,
  costBasisCalculator: CostBasisCalculator,
  blockchainService?: BlockchainServiceInterface
): TransactionSyncService {
  return new TransactionSyncService(
    prisma,
    priceService,
    costBasisCalculator,
    blockchainService
  );
}
