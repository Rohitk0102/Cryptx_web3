import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { PnLCalculationEngine } from '../services/pnlCalculationEngine';
import { CostBasisCalculator } from '../services/costBasisCalculator';
import { PriceFetchingService } from '../services/priceFetching.service';

// Initialize services
const priceService = new PriceFetchingService();
const costBasisCalculator = new CostBasisCalculator(prisma);
const pnlEngine = new PnLCalculationEngine(prisma, costBasisCalculator, priceService);

/**
 * Get realized P&L
 * GET /api/pnl/realized
 * Requirements: 9.1, 9.4, 9.5, 9.6
 */
export const getRealizedPnL = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        
        // Parse query parameters
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const tokenSymbol = req.query.tokenSymbol as string | undefined;

        // Validate dates
        if (startDate && isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'Invalid startDate format' });
        }
        if (endDate && isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid endDate format' });
        }

        // Calculate realized P&L
        const result = await pnlEngine.calculateRealizedPnL(userId, {
            startDate,
            endDate,
            tokenSymbol,
        });

        // Serialize Decimal values
        res.json({
            totalRealizedPnL: result.totalRealizedPnL.toString(),
            byToken: result.byToken.map(token => ({
                tokenSymbol: token.tokenSymbol,
                realizedPnL: token.realizedPnL.toString(),
                transactionCount: token.transactionCount,
            })),
        });
    } catch (error) {
        console.error('Error calculating realized P&L:', error);
        res.status(500).json({ error: 'Failed to calculate realized P&L' });
    }
};

/**
 * Get unrealized P&L
 * GET /api/pnl/unrealized
 * Requirements: 9.2, 9.4, 9.5, 9.6
 */
export const getUnrealizedPnL = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        
        // Parse query parameters
        const tokenSymbol = req.query.tokenSymbol as string | undefined;

        // Calculate unrealized P&L
        const result = await pnlEngine.calculateUnrealizedPnL(userId, {
            tokenSymbol,
        });

        // Serialize Decimal values
        res.json({
            totalUnrealizedPnL: result.totalUnrealizedPnL.toString(),
            holdings: result.holdings.map(holding => ({
                tokenSymbol: holding.tokenSymbol,
                quantity: holding.quantity.toString(),
                costBasis: holding.costBasis.toString(),
                currentValue: holding.currentValue.toString(),
                unrealizedPnL: holding.unrealizedPnL.toString(),
                percentageGain: holding.percentageGain.toString(),
            })),
        });
    } catch (error) {
        console.error('Error calculating unrealized P&L:', error);
        res.status(500).json({ error: 'Failed to calculate unrealized P&L' });
    }
};

/**
 * Get P&L summary (realized + unrealized)
 * GET /api/pnl/summary
 * Requirements: 9.3, 9.4, 9.5, 9.6
 */
export const getPnLSummary = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        
        // Parse query parameters
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const tokenSymbol = req.query.tokenSymbol as string | undefined;

        // Validate dates
        if (startDate && isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'Invalid startDate format' });
        }
        if (endDate && isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid endDate format' });
        }

        // Calculate P&L summary
        const result = await pnlEngine.calculatePnLSummary(userId, {
            startDate,
            endDate,
            tokenSymbol,
        });

        // Serialize Decimal values
        res.json({
            totalRealizedPnL: result.totalRealizedPnL.toString(),
            totalUnrealizedPnL: result.totalUnrealizedPnL.toString(),
            totalPnL: result.totalPnL.toString(),
            costBasisMethod: result.costBasisMethod,
            byToken: result.byToken.map(token => ({
                tokenSymbol: token.tokenSymbol,
                holdings: token.holdings.toString(),
                costBasis: token.costBasis.toString(),
                currentValue: token.currentValue.toString(),
                unrealizedPnL: token.unrealizedPnL.toString(),
                realizedPnL: token.realizedPnL.toString(),
                totalPnL: token.totalPnL.toString(),
                percentageGain: token.percentageGain.toString(),
            })),
        });
    } catch (error) {
        console.error('Error calculating P&L summary:', error);
        res.status(500).json({ error: 'Failed to calculate P&L summary' });
    }
};

/**
 * Update user's cost basis method preference
 * PATCH /api/pnl/cost-basis-method
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */
export const updateCostBasisMethod = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { method } = req.body;

        // Validate method
        const validMethods = ['FIFO', 'LIFO', 'WEIGHTED_AVERAGE'];
        if (!method || !validMethods.includes(method)) {
            return res.status(400).json({
                error: 'Invalid cost basis method',
                details: `Method must be one of: ${validMethods.join(', ')}`,
            });
        }

        // Update user preference
        await prisma.user.update({
            where: { id: userId },
            data: { costBasisMethod: method },
        });

        // Trigger P&L recalculation by updating all holdings
        const transactions = await prisma.pnLTransaction.findMany({
            where: { userId },
            select: { tokenSymbol: true },
            distinct: ['tokenSymbol'],
        });

        for (const tx of transactions) {
            await costBasisCalculator.updateHoldings(userId, tx.tokenSymbol, method);
        }

        res.json({
            success: true,
            costBasisMethod: method,
            message: 'Cost basis method updated and P&L recalculated',
        });
    } catch (error) {
        console.error('Error updating cost basis method:', error);
        res.status(500).json({ error: 'Failed to update cost basis method' });
    }
};
