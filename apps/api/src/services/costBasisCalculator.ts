/**
 * Cost Basis Calculator
 * 
 * Calculates cost basis for tokens using different methods (FIFO, LIFO, Weighted Average)
 * and manages holdings updates based on transaction history.
 * 
 * Requirements:
 * - 4.1: Calculate current holdings by processing all transactions chronologically
 * - 4.2: Exclude transfer transactions from cost basis calculations
 * - 4.3: Apply the selected cost-basis method (FIFO, LIFO, or Weighted_Average)
 * - 4.4: Track cost basis separately for each token and wallet combination
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '../utils/decimal';
import { 
  getCostBasisMethod, 
  Purchase, 
  CostBasisMethodName 
} from './costBasisMethods';

export class CostBasisCalculator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get cost basis for a sell transaction
   * 
   * Retrieves all buy transactions before the sell timestamp and applies
   * the selected cost basis method to calculate the average cost per unit.
   * 
   * @param userId - User ID
   * @param tokenSymbol - Token symbol (e.g., "ETH", "USDC")
   * @param sellQuantity - Quantity being sold
   * @param sellTimestamp - Timestamp of the sell transaction
   * @param method - Cost basis method to use ("FIFO", "LIFO", "WEIGHTED_AVERAGE")
   * @returns Average cost basis per unit for the sold quantity
   * 
   * Requirements: 4.1, 4.2, 4.3
   */
  async getCostBasis(
    userId: string,
    tokenSymbol: string,
    sellQuantity: Decimal,
    sellTimestamp: Date,
    method: CostBasisMethodName
  ): Promise<Decimal> {
    // Get all buy and swap transactions before this sell
    // Exclude transfers as they don't affect cost basis (Requirement 4.2)
    const transactions = await this.prisma.pnLTransaction.findMany({
      where: {
        userId,
        tokenSymbol,
        txType: { in: ['buy', 'swap'] },
        timestamp: { lt: sellTimestamp }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Convert to Purchase objects
    // Convert Prisma Decimal to decimal.js-light Decimal
    const purchases: Purchase[] = transactions.map(tx => ({
      quantity: new Decimal(tx.quantity.toString()),
      priceUsd: new Decimal(tx.priceUsd.toString()),
      timestamp: tx.timestamp
    }));

    // Handle edge case: no purchases found
    if (purchases.length === 0) {
      console.warn(
        `No purchase history found for ${tokenSymbol} before ${sellTimestamp.toISOString()}. ` +
        `Using zero cost basis.`
      );
      return new Decimal(0);
    }

    // Apply cost basis method (Requirement 4.3)
    const calculator = getCostBasisMethod(method);
    const result = calculator.calculate(purchases, sellQuantity);

    return result.costBasis;
  }

  /**
   * Update holdings for a specific token and user
   * 
   * Processes all transactions chronologically to calculate current holdings
   * and total cost basis. This method is called after syncing new transactions
   * or when the user changes their cost basis method preference.
   * 
   * @param userId - User ID
   * @param tokenSymbol - Token symbol (e.g., "ETH", "USDC")
   * @param method - Cost basis method to use ("FIFO", "LIFO", "WEIGHTED_AVERAGE")
   * 
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  async updateHoldings(
    userId: string,
    tokenSymbol: string,
    method: CostBasisMethodName
  ): Promise<void> {
    // Get all transactions for this token, ordered chronologically (Requirement 4.1)
    const transactions = await this.prisma.pnLTransaction.findMany({
      where: { userId, tokenSymbol },
      orderBy: { timestamp: 'asc' }
    });

    let purchases: Purchase[] = [];
    let totalQuantity = new Decimal(0);

    // Process transactions chronologically
    for (const tx of transactions) {
      // Convert Prisma Decimal to decimal.js-light Decimal
      const txQuantity = new Decimal(tx.quantity.toString());
      const txPriceUsd = new Decimal(tx.priceUsd.toString());
      
      if (tx.txType === 'buy') {
        // Add to purchases
        purchases.push({
          quantity: txQuantity,
          priceUsd: txPriceUsd,
          timestamp: tx.timestamp
        });
        totalQuantity = totalQuantity.plus(txQuantity);
      } else if (tx.txType === 'sell' || tx.txType === 'swap') {
        // Apply cost basis method to reduce purchases
        const calculator = getCostBasisMethod(method);
        const result = calculator.calculate(purchases, txQuantity);
        purchases = result.remainingPurchases;
        totalQuantity = totalQuantity.minus(txQuantity);
      }
      // Transfers don't affect cost basis (Requirement 4.2)
      // Fees are handled separately in P&L calculations
    }

    // Calculate total cost basis from remaining purchases
    let totalCostBasis = new Decimal(0);
    for (const purchase of purchases) {
      totalCostBasis = totalCostBasis.plus(
        purchase.priceUsd.mul(purchase.quantity)
      );
    }

    // Ensure quantity doesn't go negative due to rounding
    if (totalQuantity.lt(0)) {
      console.warn(
        `Negative quantity detected for ${tokenSymbol}: ${totalQuantity.toString()}. ` +
        `Setting to zero.`
      );
      totalQuantity = new Decimal(0);
      totalCostBasis = new Decimal(0);
    }

    // Update or create holding (Requirement 4.4: separate tracking per token-wallet-method)
    // Note: We're using "aggregated" as walletAddress to aggregate across all wallets
    // In a future enhancement, this could be made wallet-specific
    // Convert decimal.js-light Decimal to string for Prisma
    await this.prisma.holding.upsert({
      where: {
        userId_walletAddress_tokenSymbol_costBasisMethod: {
          userId,
          walletAddress: 'aggregated',
          tokenSymbol,
          costBasisMethod: method
        }
      },
      update: {
        quantity: totalQuantity.toString(),
        costBasisUsd: totalCostBasis.toString(),
        lastUpdated: new Date()
      },
      create: {
        userId,
        walletAddress: 'aggregated',
        tokenSymbol,
        quantity: totalQuantity.toString(),
        costBasisUsd: totalCostBasis.toString(),
        costBasisMethod: method
      }
    });
  }

  /**
   * Update holdings for all tokens for a user
   * 
   * This is typically called after a sync operation to recalculate
   * holdings for all tokens that have new transactions.
   * 
   * @param userId - User ID
   * @param method - Cost basis method to use
   */
  async updateAllHoldings(
    userId: string,
    method: CostBasisMethodName
  ): Promise<void> {
    // Get all unique token symbols for this user
    const tokens = await this.prisma.pnLTransaction.findMany({
      where: { userId },
      select: { tokenSymbol: true },
      distinct: ['tokenSymbol']
    });

    // Update holdings for each token
    for (const { tokenSymbol } of tokens) {
      await this.updateHoldings(userId, tokenSymbol, method);
    }
  }

  /**
   * Get current holdings for a user
   * 
   * Retrieves all holdings with non-zero quantity for the specified cost basis method.
   * 
   * @param userId - User ID
   * @param method - Cost basis method
   * @param tokenSymbol - Optional: filter by specific token
   * @returns Array of holdings
   */
  async getHoldings(
    userId: string,
    method: CostBasisMethodName,
    tokenSymbol?: string
  ) {
    return this.prisma.holding.findMany({
      where: {
        userId,
        costBasisMethod: method,
        tokenSymbol: tokenSymbol,
        quantity: { gt: 0 }
      }
    });
  }

  /**
   * Get holding for a specific token
   * 
   * @param userId - User ID
   * @param tokenSymbol - Token symbol
   * @param method - Cost basis method
   * @returns Holding or null if not found
   */
  async getHolding(
    userId: string,
    tokenSymbol: string,
    method: CostBasisMethodName
  ) {
    return this.prisma.holding.findUnique({
      where: {
        userId_walletAddress_tokenSymbol_costBasisMethod: {
          userId,
          walletAddress: 'aggregated',
          tokenSymbol,
          costBasisMethod: method
        }
      }
    });
  }
}

// Export a factory function to create instances
export function createCostBasisCalculator(prisma: PrismaClient): CostBasisCalculator {
  return new CostBasisCalculator(prisma);
}
