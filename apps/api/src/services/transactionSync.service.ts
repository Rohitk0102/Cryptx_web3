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
import redis from '../utils/redis';

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
  getTransactions(
    walletAddress: string,
    chain: string,
    options?: { startBlock?: number }
  ): Promise<RawTransaction[]>;
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
    if (!this.blockchainService) {
      throw new Error('Blockchain service not configured');
    }

    // Read last synced block from Redis to enable incremental sync.
    // Falls back to block 0 (full sync) if Redis is unavailable.
    const lastBlockKey = `lastblock:${walletAddress}:${chain}`;
    let startBlock = 0;
    try {
      const lastBlock = await redis.get(lastBlockKey);
      if (lastBlock) {
        startBlock = parseInt(lastBlock, 10) + 1;
      }
    } catch (redisReadError) {
      console.warn(
        `[Sync] Redis unavailable reading lastBlock for ${walletAddress}:${chain}, syncing from block 0:`,
        redisReadError
      );
    }

    const rawTransactions = await this.blockchainService.getTransactions(
      walletAddress,
      chain,
      { startBlock }
    );

    if (rawTransactions.length === 0) {
      return { newTransactionsCount: 0 };
    }

    // STEP 1 — Bulk deduplication: one DB round-trip instead of N
    const existingHashes = await this.prisma.pnLTransaction.findMany({
      where: {
        userId,
        walletAddress,
        txHash: { in: rawTransactions.map((t) => t.hash) },
      },
      select: { txHash: true },
    });
    const existingHashSet = new Set(existingHashes.map((t) => t.txHash));
    const newTransactions = rawTransactions.filter(
      (tx) => !existingHashSet.has(tx.hash)
    );

    if (newTransactions.length === 0) {
      return { newTransactionsCount: 0 };
    }

    // STEP 2 — Fetch all user wallets for own-transfer detection (once, before loop)
    const userWallets = await this.prisma.wallet.findMany({
      where: { userId, isActive: true },
      select: { address: true },
    });
    const ownWalletAddresses = new Set(
      userWallets.map((w) => w.address.toLowerCase())
    );

    // STEP 3 — Batch price fetch: one Promise.allSettled for all unique symbol+timestamp pairs
    const uniquePairs = [
      ...new Set(
        newTransactions.map(
          (tx) => `${tx.tokenSymbol}:${tx.timestamp.toISOString()}`
        )
      ),
    ];
    const priceResults = await Promise.allSettled(
      uniquePairs.map(async (pair) => {
        const colonIdx = pair.indexOf(':');
        const symbol = pair.slice(0, colonIdx);
        const ts = pair.slice(colonIdx + 1);
        const price = await this.priceService.getHistoricalPrice(
          symbol,
          new Date(ts)
        );
        return { key: pair, price };
      })
    );
    const priceMap = new Map<string, Decimal>();
    priceResults.forEach((r) => {
      if (r.status === 'fulfilled' && r.value.price) {
        priceMap.set(r.value.key, r.value.price);
      }
    });

    // STEP 4 — Build records and bulk insert: one DB round-trip instead of N
    const records = newTransactions.map((rawTx) => {
      const priceKey = `${rawTx.tokenSymbol}:${rawTx.timestamp.toISOString()}`;
      const priceUsd = priceMap.get(priceKey) ?? new Decimal(0);
      const txType = this.classifyTransaction(rawTx, walletAddress, ownWalletAddresses);
      const quantity = new Decimal(rawTx.value);
      const feeAmount = rawTx.fee ? new Decimal(rawTx.fee).toString() : null;

      return {
        userId,
        walletAddress,
        chain,
        tokenSymbol: rawTx.tokenSymbol || 'UNKNOWN',
        txType,
        quantity: quantity.toString(),
        priceUsd: priceUsd.toString(),
        feeAmount,
        feeToken: rawTx.feeToken ?? null,
        timestamp: rawTx.timestamp,
        txHash: rawTx.hash,
        source: 'wallet',
      };
    });

    const { count: newCount } = await this.prisma.pnLTransaction.createMany({
      data: records,
      skipDuplicates: true, // safety net — dedup already done above
    });

    // Persist the highest block number seen so the next sync starts from there.
    // Falls through silently if Redis is unavailable — worst case is a redundant full sync.
    const maxBlock = rawTransactions.reduce(
      (max, tx) =>
        tx.blockNumber && tx.blockNumber > max ? tx.blockNumber : max,
      startBlock
    );
    if (maxBlock > 0) {
      try {
        await redis.set(lastBlockKey, maxBlock.toString());
      } catch (redisWriteError) {
        console.warn(
          `[Sync] Redis unavailable writing lastBlock for ${walletAddress}:${chain}:`,
          redisWriteError
        );
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
    walletAddress: string,
    ownWalletAddresses: Set<string>
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

    // Receiving tokens — own-wallet transfer ('receive') vs external purchase ('buy')
    if (to === normalizedWallet) {
      return ownWalletAddresses.has(from) ? 'receive' : 'buy';
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
