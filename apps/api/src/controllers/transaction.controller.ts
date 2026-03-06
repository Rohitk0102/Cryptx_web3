import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

/**
 * Get transactions with pagination, filtering, and sorting
 * GET /api/transactions
 */
export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;

        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const tokenSymbol = req.query.tokenSymbol as string;
        const txType = req.query.txType as string;
        const walletAddress = req.query.walletAddress as string;
        const sortBy = (req.query.sortBy as string) || 'timestamp';
        const sortOrder = (req.query.sortOrder as string) || 'desc';

        // Validate pagination parameters
        if (page < 1 || limit < 1 || limit > 100) {
            return res.status(400).json({ 
                error: 'Invalid pagination parameters',
                details: 'Page must be >= 1, limit must be between 1 and 100'
            });
        }

        // Validate sort parameters
        const validSortFields = ['timestamp', 'priceUsd', 'quantity'];
        if (!validSortFields.includes(sortBy)) {
            return res.status(400).json({ 
                error: 'Invalid sort field',
                details: `sortBy must be one of: ${validSortFields.join(', ')}`
            });
        }

        if (!['asc', 'desc'].includes(sortOrder)) {
            return res.status(400).json({ 
                error: 'Invalid sort order',
                details: 'sortOrder must be "asc" or "desc"'
            });
        }

        // Validate transaction type if provided
        const validTxTypes = ['buy', 'sell', 'swap', 'transfer', 'fee'];
        if (txType && !validTxTypes.includes(txType)) {
            return res.status(400).json({ 
                error: 'Invalid transaction type',
                details: `txType must be one of: ${validTxTypes.join(', ')}`
            });
        }

        // Build where clause
        const where: any = { userId };

        // Date range filter
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) {
                const start = new Date(startDate);
                if (isNaN(start.getTime())) {
                    return res.status(400).json({ 
                        error: 'Invalid startDate format',
                        details: 'startDate must be a valid ISO 8601 date string'
                    });
                }
                where.timestamp.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                if (isNaN(end.getTime())) {
                    return res.status(400).json({ 
                        error: 'Invalid endDate format',
                        details: 'endDate must be a valid ISO 8601 date string'
                    });
                }
                where.timestamp.lte = end;
            }
        }

        // Token filter
        if (tokenSymbol) {
            where.tokenSymbol = tokenSymbol.toUpperCase();
        }

        // Transaction type filter
        if (txType) {
            where.txType = txType;
        }

        // Wallet address filter
        if (walletAddress) {
            where.walletAddress = walletAddress.toLowerCase();
        }

        // Calculate skip for pagination
        const skip = (page - 1) * limit;

        // Build order by clause
        const orderBy: any = {};
        orderBy[sortBy] = sortOrder;

        // Fetch transactions with pagination
        const [transactions, total] = await Promise.all([
            prisma.pnLTransaction.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
            prisma.pnLTransaction.count({ where }),
        ]);

        // Convert Decimal fields to strings for JSON serialization
        const serializedTransactions = transactions.map(tx => ({
            id: tx.id,
            userId: tx.userId,
            walletAddress: tx.walletAddress,
            chain: tx.chain,
            tokenSymbol: tx.tokenSymbol,
            txType: tx.txType,
            quantity: tx.quantity.toString(),
            priceUsd: tx.priceUsd.toString(),
            feeAmount: tx.feeAmount?.toString() || null,
            feeToken: tx.feeToken,
            timestamp: tx.timestamp.toISOString(),
            txHash: tx.txHash,
            source: tx.source,
            createdAt: tx.createdAt.toISOString(),
        }));

        res.json({
            transactions: serializedTransactions,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};
