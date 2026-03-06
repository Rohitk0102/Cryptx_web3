/**
 * Cost Basis Method Implementations
 * 
 * Provides different cost basis calculation methods for P&L calculations:
 * - FIFO (First-In-First-Out): Matches sells against earliest purchases
 * - LIFO (Last-In-First-Out): Matches sells against most recent purchases
 * - Weighted Average: Uses average cost across all holdings
 * 
 * Requirements:
 * - 5.4: FIFO method matches sells against earliest purchases first
 * - 5.5: LIFO method matches sells against most recent purchases first
 * - 5.6: Weighted Average method uses average cost across all holdings
 * - 7.1: Support three cost-basis methods
 */

import { Decimal, min } from '../utils/decimal';

/**
 * Represents a purchase transaction for cost basis calculation
 */
export interface Purchase {
  quantity: Decimal;
  priceUsd: Decimal;
  timestamp: Date;
}

/**
 * Result of cost basis calculation
 */
export interface CostBasisResult {
  costBasis: Decimal; // Average cost basis per unit for the sold quantity
  remainingPurchases: Purchase[]; // Purchases remaining after the sell
}

/**
 * Interface for cost basis calculation methods
 * 
 * Each method implements a different strategy for matching sells against purchases
 * to determine the cost basis for realized P&L calculations.
 */
export interface CostBasisMethod {
  /**
   * Calculate cost basis for a sell transaction
   * 
   * @param purchases - Array of purchase transactions (should be sorted by timestamp ascending)
   * @param sellQuantity - Quantity being sold
   * @returns Cost basis result with average cost per unit and remaining purchases
   */
  calculate(purchases: Purchase[], sellQuantity: Decimal): CostBasisResult;
}

/**
 * FIFO (First-In-First-Out) Cost Basis Method
 * 
 * Matches sells against the earliest purchases first.
 * This is the most common method and often required for tax purposes.
 * 
 * Example:
 * - Buy 10 ETH at $1000 on Jan 1
 * - Buy 10 ETH at $1500 on Jan 15
 * - Sell 15 ETH on Feb 1
 * - FIFO uses: 10 ETH at $1000 + 5 ETH at $1500 = $17,500 cost basis
 * 
 * Requirements: 5.4
 */
export class FIFOMethod implements CostBasisMethod {
  calculate(purchases: Purchase[], sellQuantity: Decimal): CostBasisResult {
    let remaining = sellQuantity;
    let totalCost = new Decimal(0);
    const updatedPurchases = [...purchases];
    
    // Process purchases from beginning (earliest first)
    for (let i = 0; i < updatedPurchases.length && remaining.gt(0); i++) {
      const purchase = updatedPurchases[i];
      
      // Use the minimum of what's available and what's needed
      const quantityToUse = min(purchase.quantity, remaining);
      
      // Add cost for this portion
      totalCost = totalCost.plus(purchase.priceUsd.mul(quantityToUse));
      
      // Reduce remaining quantity to sell
      remaining = remaining.minus(quantityToUse);
      
      // Update purchase quantity
      updatedPurchases[i] = {
        ...purchase,
        quantity: purchase.quantity.minus(quantityToUse)
      };
    }
    
    // Remove depleted purchases (quantity = 0)
    const remainingPurchases = updatedPurchases.filter(p => p.quantity.gt(0));
    
    // Calculate average cost basis per unit
    const avgCostBasis = sellQuantity.isZero() 
      ? new Decimal(0)
      : totalCost.div(sellQuantity);
    
    return { 
      costBasis: avgCostBasis, 
      remainingPurchases 
    };
  }
}

/**
 * LIFO (Last-In-First-Out) Cost Basis Method
 * 
 * Matches sells against the most recent purchases first.
 * Can be advantageous in rising markets to minimize taxable gains.
 * 
 * Example:
 * - Buy 10 ETH at $1000 on Jan 1
 * - Buy 10 ETH at $1500 on Jan 15
 * - Sell 15 ETH on Feb 1
 * - LIFO uses: 10 ETH at $1500 + 5 ETH at $1000 = $20,000 cost basis
 * 
 * Requirements: 5.5
 */
export class LIFOMethod implements CostBasisMethod {
  calculate(purchases: Purchase[], sellQuantity: Decimal): CostBasisResult {
    let remaining = sellQuantity;
    let totalCost = new Decimal(0);
    const updatedPurchases = [...purchases];
    
    // Process purchases from end (most recent first)
    for (let i = updatedPurchases.length - 1; i >= 0 && remaining.gt(0); i--) {
      const purchase = updatedPurchases[i];
      
      // Use the minimum of what's available and what's needed
      const quantityToUse = min(purchase.quantity, remaining);
      
      // Add cost for this portion
      totalCost = totalCost.plus(purchase.priceUsd.mul(quantityToUse));
      
      // Reduce remaining quantity to sell
      remaining = remaining.minus(quantityToUse);
      
      // Update purchase quantity
      updatedPurchases[i] = {
        ...purchase,
        quantity: purchase.quantity.minus(quantityToUse)
      };
    }
    
    // Remove depleted purchases (quantity = 0)
    const remainingPurchases = updatedPurchases.filter(p => p.quantity.gt(0));
    
    // Calculate average cost basis per unit
    const avgCostBasis = sellQuantity.isZero()
      ? new Decimal(0)
      : totalCost.div(sellQuantity);
    
    return { 
      costBasis: avgCostBasis, 
      remainingPurchases 
    };
  }
}

/**
 * Weighted Average Cost Basis Method
 * 
 * Uses the average cost across all holdings.
 * Simplifies tracking by treating all purchases as a single pool.
 * 
 * Example:
 * - Buy 10 ETH at $1000 on Jan 1 (cost: $10,000)
 * - Buy 10 ETH at $1500 on Jan 15 (cost: $15,000)
 * - Total: 20 ETH for $25,000 = $1,250 average
 * - Sell 15 ETH on Feb 1
 * - Weighted Average uses: 15 ETH at $1,250 = $18,750 cost basis
 * 
 * Requirements: 5.6
 */
export class WeightedAverageMethod implements CostBasisMethod {
  calculate(purchases: Purchase[], sellQuantity: Decimal): CostBasisResult {
    // Calculate total quantity and total cost across all purchases
    let totalQuantity = new Decimal(0);
    let totalCost = new Decimal(0);
    
    for (const purchase of purchases) {
      totalQuantity = totalQuantity.plus(purchase.quantity);
      totalCost = totalCost.plus(purchase.priceUsd.mul(purchase.quantity));
    }
    
    // Handle edge case: no purchases
    if (totalQuantity.isZero()) {
      return { 
        costBasis: new Decimal(0), 
        remainingPurchases: [] 
      };
    }
    
    // Calculate weighted average price per unit
    const avgPrice = totalCost.div(totalQuantity);
    
    // Calculate remaining quantity after the sell
    const remainingQuantity = totalQuantity.minus(sellQuantity);
    
    // For weighted average, we reduce all purchases proportionally
    // and update their price to the weighted average
    const remainingPurchases = purchases
      .map(p => ({
        ...p,
        // Reduce quantity proportionally
        quantity: p.quantity.mul(remainingQuantity).div(totalQuantity),
        // Update price to weighted average
        priceUsd: avgPrice
      }))
      .filter(p => p.quantity.gt(0));
    
    return { 
      costBasis: avgPrice, 
      remainingPurchases 
    };
  }
}

/**
 * Factory function to get a cost basis method by name
 * 
 * @param methodName - Name of the method: "FIFO", "LIFO", or "WEIGHTED_AVERAGE"
 * @returns Instance of the requested cost basis method
 * @throws Error if method name is not recognized
 */
export function getCostBasisMethod(methodName: string): CostBasisMethod {
  switch (methodName) {
    case 'FIFO':
      return new FIFOMethod();
    case 'LIFO':
      return new LIFOMethod();
    case 'WEIGHTED_AVERAGE':
      return new WeightedAverageMethod();
    default:
      throw new Error(`Unknown cost basis method: ${methodName}`);
  }
}

/**
 * List of all supported cost basis method names
 */
export const SUPPORTED_METHODS = ['FIFO', 'LIFO', 'WEIGHTED_AVERAGE'] as const;

/**
 * Type for cost basis method names
 */
export type CostBasisMethodName = typeof SUPPORTED_METHODS[number];
