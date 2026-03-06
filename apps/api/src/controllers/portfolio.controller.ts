import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
    aggregatePortfolio,
    generateSnapshot,
    getLatestSnapshot,
} from '../services/portfolio.service';

/**
 * Get aggregated portfolio
 */
export const getPortfolio = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { cached } = req.query;

        // Return cached snapshot if requested and available
        if (cached === 'true') {
            const snapshot = await getLatestSnapshot(userId);
            if (snapshot) {
                // Check if snapshot is recent (less than 2 minutes old)
                const snapshotAge = Date.now() - new Date(snapshot.generatedAt).getTime();
                if (snapshotAge < 120000) { // 2 minutes
                    return res.json({
                        ...(snapshot.breakdown as object),
                        totalValueUsd: snapshot.totalValueUsd,
                        lastUpdated: snapshot.generatedAt,
                        cached: true,
                    });
                }
            }
        }

        // Generate fresh portfolio from blockchain
        const portfolio = await aggregatePortfolio(userId);
        
        // Save snapshot for future cached requests
        await generateSnapshot(userId);
        
        res.json(portfolio);
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
};

/**
 * Force refresh and generate snapshot
 */
export const refreshPortfolio = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;

        // Generate fresh portfolio
        const portfolio = await aggregatePortfolio(userId);

        // Save snapshot
        await generateSnapshot(userId);

        res.json({ ...portfolio, refreshed: true });
    } catch (error) {
        console.error('Error refreshing portfolio:', error);
        res.status(500).json({ error: 'Failed to refresh portfolio' });
    }
};

/**
 * Get portfolio history (snapshots)
 */
export const getPortfolioHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { limit = 30 } = req.query;

        const snapshots = await require('../utils/prisma').default.portfolioSnapshot.findMany({
            where: { userId },
            orderBy: { generatedAt: 'desc' },
            take: parseInt(limit as string),
            select: {
                id: true,
                totalValueUsd: true,
                generatedAt: true,
            },
        });

        res.json(snapshots);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};

/**
 * Get asset allocation breakdown
 */
export const getAssetAllocation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const portfolio = await aggregatePortfolio(userId);

        // Calculate allocation percentages
        const allocation = portfolio.assets.map((asset: any) => ({
            symbol: asset.symbol,
            name: asset.name,
            value: asset.valueUsd,
            percentage: (asset.valueUsd / portfolio.totalValueUsd) * 100,
        }));

        res.json(allocation);
    } catch (error) {
        console.error('Error fetching allocation:', error);
        res.status(500).json({ error: 'Failed to fetch allocation' });
    }
};

/**
 * Get performance metrics
 */
export const getPerformanceMetrics = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const prisma = require('../utils/prisma').default;

        // Get current value
        const current = await getLatestSnapshot(userId);
        if (!current) {
            return res.json({
                change24h: 0,
                change7d: 0,
                change30d: 0,
                changeAll: 0,
            });
        }

        // Get historical snapshots
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [snapshot24h, snapshot7d, snapshot30d, firstSnapshot] = await Promise.all([
            prisma.portfolioSnapshot.findFirst({
                where: { userId, generatedAt: { lte: oneDayAgo } },
                orderBy: { generatedAt: 'desc' },
            }),
            prisma.portfolioSnapshot.findFirst({
                where: { userId, generatedAt: { lte: sevenDaysAgo } },
                orderBy: { generatedAt: 'desc' },
            }),
            prisma.portfolioSnapshot.findFirst({
                where: { userId, generatedAt: { lte: thirtyDaysAgo } },
                orderBy: { generatedAt: 'desc' },
            }),
            prisma.portfolioSnapshot.findFirst({
                where: { userId },
                orderBy: { generatedAt: 'asc' },
            }),
        ]);

        const calculateChange = (oldValue: number | null) => {
            if (!oldValue || oldValue === 0) return 0;
            return ((current.totalValueUsd - oldValue) / oldValue) * 100;
        };

        res.json({
            change24h: calculateChange(snapshot24h?.totalValueUsd),
            change7d: calculateChange(snapshot7d?.totalValueUsd),
            change30d: calculateChange(snapshot30d?.totalValueUsd),
            changeAll: calculateChange(firstSnapshot?.totalValueUsd),
        });
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
};

