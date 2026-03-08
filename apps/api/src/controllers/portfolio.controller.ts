import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import {
    aggregatePortfolio,
    generateSnapshot,
    getLatestSnapshot,
} from '../services/portfolio.service';
import { portfolioLiveService } from '../services/portfolioLive.service';

function writeSseEvent(res: Response, event: string, payload: unknown): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

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
        await generateSnapshot(userId, portfolio);
        
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
        await generateSnapshot(userId, portfolio);

        res.json({ ...portfolio, refreshed: true });
    } catch (error) {
        console.error('Error refreshing portfolio:', error);
        res.status(500).json({ error: 'Failed to refresh portfolio' });
    }
};

/**
 * Stream live portfolio updates over SSE.
 */
export const streamPortfolioLive = async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    writeSseEvent(res, 'ready', {
        connectedAt: new Date().toISOString(),
    });

    const heartbeat = setInterval(() => {
        writeSseEvent(res, 'heartbeat', {
            timestamp: new Date().toISOString(),
        });
    }, 20000);

    const unsubscribe = portfolioLiveService.subscribe(userId, ({ portfolio, reason }) => {
        writeSseEvent(res, 'portfolio', {
            portfolio,
            reason,
        });
    });

    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
    });
};

/**
 * Get portfolio history (snapshots)
 */
export const getPortfolioHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { limit = 30, from, to } = req.query;
        const parsedLimit = Number.parseInt(limit as string, 10);
        const safeLimit = Number.isNaN(parsedLimit)
            ? 30
            : Math.min(Math.max(parsedLimit, 1), 3650);

        const fromDate = typeof from === 'string' && from.length > 0
            ? new Date(from)
            : null;
        const toDate = typeof to === 'string' && to.length > 0
            ? new Date(to)
            : null;

        if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
            return res.status(400).json({ error: 'Invalid from/to date. Use ISO date values like 2026-03-08.' });
        }

        if (fromDate && toDate && fromDate > toDate) {
            return res.status(400).json({ error: '`from` date must be earlier than or equal to `to` date.' });
        }

        const generatedAtFilter: { gte?: Date; lte?: Date } = {};
        if (fromDate) {
            generatedAtFilter.gte = fromDate;
        }
        if (toDate) {
            const isDateOnly = typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to);
            if (isDateOnly) {
                const inclusiveToDate = new Date(toDate);
                inclusiveToDate.setHours(23, 59, 59, 999);
                generatedAtFilter.lte = inclusiveToDate;
            } else {
                generatedAtFilter.lte = toDate;
            }
        }

        const where = {
            userId,
            ...(Object.keys(generatedAtFilter).length > 0
                ? { generatedAt: generatedAtFilter }
                : {}),
        };

        let snapshots = await prisma.portfolioSnapshot.findMany({
            where,
            orderBy: { generatedAt: fromDate || toDate ? 'asc' : 'desc' },
            take: safeLimit,
            select: {
                id: true,
                totalValueUsd: true,
                generatedAt: true,
            },
        });

        if (!fromDate && !toDate) {
            snapshots = snapshots.reverse();
        }

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
        const totalValueUsd = portfolio.totalValueUsd;

        // Calculate allocation percentages
        const allocation = portfolio.assets.map((asset: any) => ({
            symbol: asset.symbol,
            name: asset.name,
            value: asset.valueUsd,
            percentage: totalValueUsd > 0 ? (asset.valueUsd / totalValueUsd) * 100 : 0,
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
