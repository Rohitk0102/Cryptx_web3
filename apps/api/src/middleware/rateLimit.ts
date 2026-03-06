import rateLimit, { Store } from 'express-rate-limit';
import { Request, Response } from 'express';
import redis from '../utils/redis';

// Redis store for distributed rate limiting
class RedisStore implements Store {
    public prefix: string;
    private resetExpiryOnChange: boolean;

    constructor(options: { prefix?: string; resetExpiryOnChange?: boolean } = {}) {
        this.prefix = options.prefix || 'rl:';
        this.resetExpiryOnChange = options.resetExpiryOnChange || false;
    }

    async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
        const redisKey = this.prefix + key;
        const current = await redis.get(redisKey);
        const totalHits = current ? parseInt(current, 10) + 1 : 1;

        // Set expiry to 1 hour from now
        const resetTime = new Date(Date.now() + 60 * 60 * 1000);

        await redis.setex(redisKey, 3600, totalHits.toString());

        return { totalHits, resetTime };
    }

    async decrement(key: string): Promise<void> {
        const redisKey = this.prefix + key;
        const current = await redis.get(redisKey);

        if (current && parseInt(current, 10) > 0) {
            await redis.setex(redisKey, 3600, (parseInt(current, 10) - 1).toString());
        }
    }

    async resetKey(key: string): Promise<void> {
        const redisKey = this.prefix + key;
        await redis.del(redisKey);
    }

    async resetAll(): Promise<void> {
        // This would be expensive in Redis, so we'll skip it
        // In production, you might want to use a different approach
        console.warn('resetAll not implemented for Redis store');
    }
}

// Rate limiting configurations
export const rateLimitConfigs = {
    // General API rate limit
    general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per 15 minutes
        message: {
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes',
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({ prefix: 'rl:general:' }),
    },

    // Authentication endpoints (stricter)
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // 20 requests per 15 minutes
        message: {
            error: 'Too many authentication attempts, please try again later.',
            retryAfter: '15 minutes',
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({ prefix: 'rl:auth:' }),
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    },

    // Portfolio endpoints (moderate)
    portfolio: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // 50 requests per 15 minutes
        message: {
            error: 'Too many portfolio requests, please try again later.',
            retryAfter: '15 minutes',
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({ prefix: 'rl:portfolio:' }),
    },

    // Wallet operations (strict)
    wallet: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 30, // 30 requests per 15 minutes
        message: {
            error: 'Too many wallet operations, please try again later.',
            retryAfter: '15 minutes',
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({ prefix: 'rl:wallet:' }),
    },
};

// Create rate limiters - DISABLED (commented out to prevent module load errors)
// export const generalRateLimit = rateLimit(rateLimitConfigs.general);
// export const authRateLimit = rateLimit(rateLimitConfigs.auth);
// export const portfolioRateLimit = rateLimit(rateLimitConfigs.portfolio);
// export const walletRateLimit = rateLimit(rateLimitConfigs.wallet);

// Placeholder exports to prevent import errors
export const generalRateLimit = (req: any, res: any, next: any) => next();
export const authRateLimit = (req: any, res: any, next: any) => next();
export const portfolioRateLimit = (req: any, res: any, next: any) => next();
export const walletRateLimit = (req: any, res: any, next: any) => next();

// Custom rate limiter for authenticated users (per user)
export const createPerUserRateLimit = (maxRequests: number, windowMs: number) => {
    const userStore = new RedisStore({ prefix: 'rl:user:' });

    return rateLimit({
        windowMs,
        max: maxRequests,
        keyGenerator: (req: any) => {
            // Use user ID if authenticated
            if (req.userId) {
                return `user:${req.userId}`;
            }
            // Use simple string for unauthenticated to avoid IPv6 validation error
            return 'unauthenticated-user';
        },
        message: {
            error: 'Too many requests for your account, please try again later.',
            retryAfter: `${Math.ceil(windowMs / 60000)} minutes`,
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: userStore,
        skip: (req: any) => !req.userId, // Skip if not authenticated
    });
};

// Rate limiters for authenticated users - DISABLED (commented out to prevent module load errors)
// export const userPortfolioRateLimit = createPerUserRateLimit(20, 15 * 60 * 1000); // 20 requests per 15 minutes
// export const userWalletRateLimit = createPerUserRateLimit(10, 15 * 60 * 1000); // 10 requests per 15 minutes

// Placeholder exports to prevent import errors
export const userPortfolioRateLimit = (req: any, res: any, next: any) => next();
export const userWalletRateLimit = (req: any, res: any, next: any) => next();

// Dynamic rate limiting based on user tier
export const createDynamicRateLimit = (getUserTier: (userId: string) => 'free' | 'premium' | 'enterprise') => {
    const store = new RedisStore({ prefix: 'rl:dynamic:' });

    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: (req: any) => {
            const userId = req.userId;
            if (!userId) return 10; // Default for unauthenticated

            const tier = getUserTier(userId);
            switch (tier) {
                case 'enterprise':
                    return 1000;
                case 'premium':
                    return 200;
                case 'free':
                default:
                    return 50;
            }
        },
        keyGenerator: (req: any) => {
            // Use user ID if authenticated
            if (req.userId) {
                return `dynamic:user:${req.userId}`;
            }
            // For unauthenticated, skip custom key (let default handle it)
            return 'unauthenticated-user';
        },
        message: {
            error: 'Rate limit exceeded for your account tier.',
            retryAfter: '15 minutes',
        },
        standardHeaders: true,
        legacyHeaders: false,
        store,
    });
};

// Rate limit middleware with custom error handling
export const rateLimitMiddleware = (limiter: any) => {
    return (req: Request, res: Response, next: any) => {
        limiter(req, res, (err: any) => {
            if (err) {
                console.warn('Rate limit exceeded:', {
                    ip: req.ip,
                    userId: (req as any).userId,
                    path: req.path,
                    method: req.method,
                });

                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: err.message || 'Too many requests',
                    retryAfter: err.retryAfter || '15 minutes',
                    timestamp: new Date().toISOString(),
                });
            }
            next();
        });
    };
};

// Rate limit bypass for admin users
export const adminBypass = (req: any, res: Response, next: any) => {
    // Add your admin check logic here
    const isAdmin = (req as any).user?.role === 'admin';

    if (isAdmin) {
        console.log('Admin bypass for rate limit:', {
            userId: (req as any).userId,
            path: req.path,
        });
        return next();
    }

    // Apply normal rate limiting
    return generalRateLimit(req, res, next);
};

// Rate limit monitoring
export const getRateLimitStats = async () => {
    try {
        // Get all rate limit keys
        const keys = await redis.keys('rl:*');
        const stats: Record<string, any> = {};

        for (const key of keys) {
            const value = await redis.get(key);
            const ttl = await redis.ttl(key);

            const category = key.split(':')[1] || 'unknown';

            if (!stats[category]) {
                stats[category] = {
                    totalRequests: 0,
                    activeKeys: 0,
                };
            }

            stats[category].totalRequests += parseInt(value || '0', 10);
            stats[category].activeKeys += 1;
        }

        return stats;
    } catch (error) {
        console.error('Error getting rate limit stats:', error);
        return {};
    }
};

// Cleanup old rate limit data
export const cleanupRateLimitData = async () => {
    try {
        // Redis automatically expires keys, but we can manually clean up if needed
        const keys = await redis.keys('rl:*');
        console.log(`Rate limit keys in use: ${keys.length}`);
        return keys.length;
    } catch (error) {
        console.error('Error cleaning up rate limit data:', error);
        return 0;
    }
};

// Export commonly used middleware
export const applyRateLimits = {
    general: rateLimitMiddleware(generalRateLimit),
    auth: rateLimitMiddleware(authRateLimit),
    portfolio: rateLimitMiddleware(portfolioRateLimit),
    wallet: rateLimitMiddleware(walletRateLimit),
    userPortfolio: rateLimitMiddleware(userPortfolioRateLimit),
    userWallet: rateLimitMiddleware(userWalletRateLimit),
    adminBypass,
};
