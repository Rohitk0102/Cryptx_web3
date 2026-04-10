import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import prisma from './utils/prisma';
import redis from './utils/redis';
import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';
import coindcxPortfolioRoutes from './routes/coindcxPortfolio.routes';
import portfolioRoutes from './routes/portfolio.routes';
import transactionRoutes from './routes/transaction.routes';
import pnlRoutes from './routes/pnl.routes';
import forecastingRoutes from './routes/forecasting.routes';
import exchangeRoutes from './routes/exchange.routes';
import { authenticate } from './middleware/auth';
import { syncTransactions } from './controllers/sync.controller';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { startSnapshotScheduler, stopSnapshotScheduler } from './services/snapshot.service';
import { portfolioLiveService } from './services/portfolioLive.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server / non-browser requests (origin is undefined)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));
app.use(express.json());

// ── Rate limiters ────────────────────────────────────────────────────────────

const getRateLimitKey = (req: Request): string => {
    const clerkUserId = req.header('X-Clerk-User-Id')?.trim();
    if (clerkUserId) {
        return `user:${clerkUserId}`;
    }

    // Use ipKeyGenerator helper for proper IPv6 handling
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `ip:${ipKeyGenerator(ip)}`;
};

const isWalletDeleteRequest = (req: Request): boolean =>
    req.method === 'DELETE' && /^\/api\/wallets\/[^/]+$/.test(req.path);

// 1. Global limiter: 200 req / 15 min per authenticated user or IP
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRateLimitKey,
    skip: isWalletDeleteRequest,
    handler: (_req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(15 * 60),
        });
    },
});

// 2. Auth limiter: 20 req / 15 min per IP (login / register brute-force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(15 * 60),
        });
    },
});

// 3. Sync limiter: 5 req / 5 min per IP (expensive on-chain sync calls)
const syncLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(5 * 60),
        });
    },
});

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

// Apply global limiter to all API routes after health check
app.use(globalLimiter);

// Rate limit stats endpoint disabled
// app.get('/admin/rate-limits', async (req: Request, res: Response) => {
//     try {
//         const stats = await getRateLimitStats();
//         res.json({ stats, timestamp: new Date().toISOString() });
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to get rate limit stats' });
//     }
// });

// Routes
app.use('/api/auth', authLimiter, authRoutes);          // auth limiter (20 req/15 min)
app.use('/api/wallets', walletRoutes);
app.use('/api', coindcxPortfolioRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/transactions', transactionRoutes);
app.post('/api/sync/transactions', syncLimiter, authenticate, syncTransactions);
app.use('/api/pnl', pnlRoutes);
app.use('/api/forecasting', forecastingRoutes);
app.use('/api/exchange', exchangeRoutes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);

    // Preserve 4xx status codes thrown by route handlers; default everything else to 500
    const status = (err as any).status;
    const httpStatus = typeof status === 'number' && status >= 400 && status < 500
        ? status
        : 500;

    // Expose error details only in development — never leak stack traces in production
    const message = process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error';

    res.status(httpStatus).json({ error: message });
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
    portfolioLiveService.stop();
    await prisma.$disconnect();
    await redis.disconnect();
    process.exit(0);
});
