import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import prisma from './utils/prisma';
import redis from './utils/redis';
import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';
import portfolioRoutes from './routes/portfolio.routes';
import transactionRoutes from './routes/transaction.routes';
import pnlRoutes from './routes/pnl.routes';
import forecastingRoutes from './routes/forecasting.routes';
import exchangeRoutes from './routes/exchange.routes';
// Rate limiting disabled - imports commented out
// import {
//     applyRateLimits,
//     getRateLimitStats,
//     cleanupRateLimitData
// } from './middleware/rateLimit';
import { startSnapshotScheduler, stopSnapshotScheduler } from './services/snapshot.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());

// Apply general rate limiting - DISABLED
console.log('⚠️  Rate limiting disabled (all environments)');

// Health check (excluded from rate limiting)
app.get('/health', async (req: Request, res: Response) => {
    // Add timeout helper
    const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
        ]);
    };

    const dbHealthy = await withTimeout(
        prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
        5000,
        false
    );

    let redisHealthy = false;
    try {
        redisHealthy = await withTimeout(redis.healthCheck(), 3000, false);
    } catch (err) {
        // Redis is optional, so we don't fail the health check
        redisHealthy = false;
    }

    // Server is healthy if database is working (Redis is optional)
    const status = dbHealthy ? 'ok' : 'degraded';
    const statusCode = status === 'ok' ? 200 : 503;

    res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
            database: dbHealthy ? 'healthy' : 'unhealthy',
            redis: redisHealthy ? 'healthy' : 'unavailable',
        },
    });
});

// Rate limit stats endpoint disabled
// app.get('/admin/rate-limits', async (req: Request, res: Response) => {
//     try {
//         const stats = await getRateLimitStats();
//         res.json({ stats, timestamp: new Date().toISOString() });
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to get rate limit stats' });
//     }
// });

// Routes - NO RATE LIMITING
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/pnl', pnlRoutes);
app.use('/api/forecasting', forecastingRoutes);
app.use('/api/exchange', exchangeRoutes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: any) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected');

        // Connect to Redis (optional - server will work without it)
        try {
            await redis.connect();
            const isHealthy = await redis.healthCheck();
            if (isHealthy) {
                console.log('✅ Redis connected');
            } else {
                console.warn('⚠️  Redis connection unstable - continuing without Redis');
            }
        } catch (redisError: any) {
            console.warn('⚠️  Redis unavailable - continuing without Redis');
            console.log('   To enable Redis: Start Redis server or set DISABLE_REDIS=true in .env');
        }

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);

            // Start snapshot scheduler if enabled
            if (process.env.ENABLE_SNAPSHOT_SCHEDULER === 'true') {
                startSnapshotScheduler();
            } else {
                console.log('📸 Snapshot scheduler disabled (set ENABLE_SNAPSHOT_SCHEDULER=true to enable)');
            }
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    stopSnapshotScheduler();
    await prisma.$disconnect();
    await redis.disconnect();
    process.exit(0);
});
