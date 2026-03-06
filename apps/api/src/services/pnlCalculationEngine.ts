/**
 * P&L Calculation Engine
 * 
 * Calculates realized and unrealized profit/loss for cryptocurrency holdings.
 * Integrates with CostBasisCalculator for cost basis determination and
 * PriceFetchingService for current market prices.
 * 
 * Requirements:
 * - 5.1: Calculate realized P&L on sell transactions
 * - 5.2: Calculate realized P&L on swap transactions
 * - 5.3: Apply formula: (sell_price * quantity) - (cost_basis * quantity) - fees
 * - 6.1: Calculate unrealized P&L for all current holdings
 * - 6.2: Fetch current market prices
 * - 6.3: Apply formula: (current_price * quantity) - (cost_basis * quantity)
 * - 6.4: Handle missing current prices gracefully
 * - 6.5: Aggregate unrealized P&L across all holdings
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '../utils/decimal';
import { CostBasisCalculator } from './costBasisCalculator';
import { PriceFetchingService } from './priceFetching.service';
import { CostBasisMethodName } from './costBasisMethods';

export interface RealizedPnLResult {
  totalRealizedPnL: Decimal;
  byToken: {
    tokenSymbol: string;
    realizedPnL: Decimal;
    transactionCount: number;
  }[];
}

export interface UnrealizedPnLResult {
  totalUnrealizedPnL: Decimal;
  holdings: {
    tokenSymbol: string;
    quantity: Decimal;
    costBasis: Decimal;
    currentValue: Decimal;
    unrealizedPnL: Decimal;
    percentageGain: Decimal;
  }[];
}

export interface PnLSummaryResult {
  totalRealizedPnL: Decimal;
  totalUnrealizedPnL: Decimal;
  totalPnL: Decimal;
  costBasisMethod: string;
  byToken: {
    tokenSymbol: string;
    holdings: Decimal;
    costBasis: Decimal;
    currentValue: Decimal;
    unrealizedPnL: Decimal;
    realizedPnL: Decimal;
    totalPnL: Decimal;
    percentageGain: Decimal;
  }[];
}

export class PnLCalculationEngine {
  private prisma: PrismaClient;
  private costBasisCalculator: CostBasisCalculator;
  private priceService: PriceFetchingService;

  constructor(
    prisma: PrismaClient,
    costBasisCalculator: CostBasisCalculator,
    priceService: PriceFetchingService
  ) {
    this.prisma = prisma;
    this.costBasisCalculator = costBasisCalculator;
    this.priceService = priceService;
  }

  /**
   * Calculate realized P&L for sell and swap transactions
   * 
   * Processes all sell and swap transactions, calculates the realized profit/loss
   * using the selected cost basis method, and stores the results in the database.
   * 
   * Formula: (sell_price * quantity) - (cost_basis * quantity) - fees
   * 
   * @param userId - User ID
   * @param options - Optional filters for date range and token
   * @returns Realized P&L summary with total and per-token breakdown
   * 
   * Requirements: 5.1, 5.2, 5.3
   */
  async calculateRealizedPnL(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      tokenSymbol?: string;
    }
  ): Promise<RealizedPnLResult> {
    // Get user's cost basis method preference
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { costBasisMethod: true }
    });

    const method = (user?.costBasisMethod || 'FIFO') as CostBasisMethodName;

    // Build query filters
    const whereClause: any = {
      userId,
      txType: { in: ['sell', 'swap'] }
    };

    if (options?.startDate || options?.endDate) {
      whereClause.timestamp = {};
      if (options.startDate) {
        whereClause.timestamp.gte = options.startDate;
      }
      if (options.endDate) {
        whereClause.timestamp.lte = options.endDate;
      }
    }

    if (options?.tokenSymbol) {
      whereClause.tokenSymbol = options.tokenSymbol;
    }

    // Get all sell and swap transactions
    const transactions = await this.prisma.pnLTransaction.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' }
    });

    const pnlByToken = new Map<string, { pnl: Decimal; count: number }>();

    for (const tx of transactions) {
      // Convert Prisma Decimal to decimal.js-light Decimal
      const quantity = new Decimal(tx.quantity.toString());
      const priceUsd = new Decimal(tx.priceUsd.toString());

      // Get cost basis for this transaction
      const costBasisPerUnit = await this.costBasisCalculator.getCostBasis(
        userId,
        tx.tokenSymbol,
        quantity,
        tx.timestamp,
        method
      );

      // Calculate realized P&L using the formula:
      // (sell_price * quantity) - (cost_basis * quantity) - fees
      const proceeds = priceUsd.mul(quantity);
      const cost = costBasisPerUnit.mul(quantity);
      
      // Calculate fees in USD
      let feesUsd = new Decimal(0);
      if (tx.feeAmount && tx.feeToken) {
        const feeAmount = new Decimal(tx.feeAmount.toString());
        
        // If fee is in the same token, use the transaction price
        if (tx.feeToken === tx.tokenSymbol) {
          feesUsd = priceUsd.mul(feeAmount);
        } else {
          // Fetch price for the fee token at the transaction timestamp
          const feeTokenPrice = await this.priceService.getHistoricalPrice(
            tx.feeToken,
            tx.timestamp
          );
          if (feeTokenPrice) {
            feesUsd = feeTokenPrice.mul(feeAmount);
          }
        }
      }

      const realizedPnL = proceeds.minus(cost).minus(feesUsd);

      // Accumulate by token
      const current = pnlByToken.get(tx.tokenSymbol) || { pnl: new Decimal(0), count: 0 };
      pnlByToken.set(tx.tokenSymbol, {
        pnl: current.pnl.plus(realizedPnL),
        count: current.count + 1
      });

      // Store in database
      await this.prisma.realizedPnL.create({
        data: {
          userId,
          tokenSymbol: tx.tokenSymbol,
          realizedAmountUsd: realizedPnL.toString(),
          transactionId: tx.id
        }
      });
    }

    // Calculate total realized P&L
    let totalRealizedPnL = new Decimal(0);
    const tokenValues = Array.from(pnlByToken.values());
    for (const { pnl } of tokenValues) {
      totalRealizedPnL = totalRealizedPnL.plus(pnl);
    }

    // Build result
    const byToken = Array.from(pnlByToken.entries()).map(([symbol, { pnl, count }]) => ({
      tokenSymbol: symbol,
      realizedPnL: pnl,
      transactionCount: count
    }));

    return {
      totalRealizedPnL,
      byToken
    };
  }

  /**
   * Calculate unrealized P&L for current holdings
   * 
   * Retrieves all current holdings, fetches current market prices, and calculates
   * the unrealized profit/loss based on the difference between current value and cost basis.
   * 
   * Formula: (current_price * quantity) - (cost_basis * quantity)
   * 
   * @param userId - User ID
   * @param options - Optional filter for specific token
   * @returns Unrealized P&L summary with total and per-holding breakdown
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async calculateUnrealizedPnL(
    userId: string,
    options?: {
      tokenSymbol?: string;
    }
  ): Promise<UnrealizedPnLResult> {
    // Get user's cost basis method preference
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { costBasisMethod: true }
    });

    const method = (user?.costBasisMethod || 'FIFO') as CostBasisMethodName;

    // Get current holdings with non-zero quantity
    const holdings = await this.costBasisCalculator.getHoldings(
      userId,
      method,
      options?.tokenSymbol
    );

    const results = [];
    let totalUnrealizedPnL = new Decimal(0);

    for (const holding of holdings) {
      // Convert Prisma Decimal to decimal.js-light Decimal
      const quantity = new Decimal(holding.quantity.toString());
      const costBasisUsd = new Decimal(holding.costBasisUsd.toString());

      // Skip if quantity is zero or negative
      if (quantity.lte(0)) {
        continue;
      }

      // Fetch current price (Requirement 6.2)
      const currentPrice = await this.priceService.getCurrentPrice(holding.tokenSymbol);

      // Handle missing current price gracefully (Requirement 6.4)
      if (!currentPrice) {
        console.warn(
          `Current price unavailable for ${holding.tokenSymbol}. ` +
          `Skipping unrealized P&L calculation for this holding.`
        );
        continue;
      }

      // Calculate unrealized P&L using the formula (Requirement 6.3):
      // (current_price * quantity) - (cost_basis * quantity)
      const currentValue = currentPrice.mul(quantity);
      const unrealizedPnL = currentValue.minus(costBasisUsd);

      // Calculate percentage gain
      const percentageGain = costBasisUsd.isZero()
        ? new Decimal(0)
        : unrealizedPnL.div(costBasisUsd).mul(100);

      // Aggregate total (Requirement 6.5)
      totalUnrealizedPnL = totalUnrealizedPnL.plus(unrealizedPnL);

      results.push({
        tokenSymbol: holding.tokenSymbol,
        quantity,
        costBasis: costBasisUsd,
        currentValue,
        unrealizedPnL,
        percentageGain
      });
    }

    return {
      totalUnrealizedPnL,
      holdings: results
    };
  }

  /**
   * Calculate complete P&L summary combining realized and unrealized P&L
   * 
   * Provides a comprehensive view of the user's profit/loss including both
   * realized gains/losses from past transactions and unrealized gains/losses
   * from current holdings.
   * 
   * @param userId - User ID
   * @param options - Optional filters for date range and token
   * @returns Complete P&L summary with realized, unrealized, and total P&L
   */
  async calculatePnLSummary(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      tokenSymbol?: string;
    }
  ): Promise<PnLSummaryResult> {
    // Get user's cost basis method
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { costBasisMethod: true }
    });

    const costBasisMethod = user?.costBasisMethod || 'FIFO';

    // Calculate realized and unrealized P&L
    const [realizedResult, unrealizedResult] = await Promise.all([
      this.calculateRealizedPnL(userId, options),
      this.calculateUnrealizedPnL(userId, { tokenSymbol: options?.tokenSymbol })
    ]);

    // Combine results by token
    const tokenMap = new Map<string, {
      holdings: Decimal;
      costBasis: Decimal;
      currentValue: Decimal;
      unrealizedPnL: Decimal;
      realizedPnL: Decimal;
      percentageGain: Decimal;
    }>();

    // Add unrealized P&L data
    for (const holding of unrealizedResult.holdings) {
      tokenMap.set(holding.tokenSymbol, {
        holdings: holding.quantity,
        costBasis: holding.costBasis,
        currentValue: holding.currentValue,
        unrealizedPnL: holding.unrealizedPnL,
        realizedPnL: new Decimal(0),
        percentageGain: holding.percentageGain
      });
    }

    // Add realized P&L data
    for (const token of realizedResult.byToken) {
      const existing = tokenMap.get(token.tokenSymbol);
      if (existing) {
        existing.realizedPnL = token.realizedPnL;
      } else {
        // Token has realized P&L but no current holdings
        tokenMap.set(token.tokenSymbol, {
          holdings: new Decimal(0),
          costBasis: new Decimal(0),
          currentValue: new Decimal(0),
          unrealizedPnL: new Decimal(0),
          realizedPnL: token.realizedPnL,
          percentageGain: new Decimal(0)
        });
      }
    }

    // Build final result
    const byToken = Array.from(tokenMap.entries()).map(([symbol, data]) => ({
      tokenSymbol: symbol,
      holdings: data.holdings,
      costBasis: data.costBasis,
      currentValue: data.currentValue,
      unrealizedPnL: data.unrealizedPnL,
      realizedPnL: data.realizedPnL,
      totalPnL: data.unrealizedPnL.plus(data.realizedPnL),
      percentageGain: data.percentageGain
    }));

    const totalPnL = realizedResult.totalRealizedPnL.plus(unrealizedResult.totalUnrealizedPnL);

    return {
      totalRealizedPnL: realizedResult.totalRealizedPnL,
      totalUnrealizedPnL: unrealizedResult.totalUnrealizedPnL,
      totalPnL,
      costBasisMethod,
      byToken
    };
  }

  /**
   * Get realized P&L records from database
   * 
   * Retrieves stored realized P&L records for reporting and analysis.
   * 
   * @param userId - User ID
   * @param options - Optional filters for date range and token
   * @returns Array of realized P&L records
   */
  async getRealizedPnLRecords(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      tokenSymbol?: string;
    }
  ) {
    const whereClause: any = { userId };

    if (options?.tokenSymbol) {
      whereClause.tokenSymbol = options.tokenSymbol;
    }

    if (options?.startDate || options?.endDate) {
      whereClause.calculatedAt = {};
      if (options.startDate) {
        whereClause.calculatedAt.gte = options.startDate;
      }
      if (options.endDate) {
        whereClause.calculatedAt.lte = options.endDate;
      }
    }

    return this.prisma.realizedPnL.findMany({
      where: whereClause,
      include: {
        transaction: true
      },
      orderBy: { calculatedAt: 'desc' }
    });
  }
}

// Export a factory function to create instances
export function createPnLCalculationEngine(
  prisma: PrismaClient,
  costBasisCalculator: CostBasisCalculator,
  priceService: PriceFetchingService
): PnLCalculationEngine {
  return new PnLCalculationEngine(prisma, costBasisCalculator, priceService);
}
