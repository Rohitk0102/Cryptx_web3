import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { getTransactions } from '../controllers/transaction.controller';
import { syncTransactions, getSyncStatus } from '../controllers/sync.controller';

const router = Router();
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

// All routes require authentication
router.use(authenticate);

// GET /api/transactions - Get transactions with pagination, filtering, and sorting
router.get('/', getTransactions);

// POST /api/transactions/sync - Sync transactions from wallets
router.post('/sync', syncLimiter, syncTransactions);

// GET /api/transactions/sync/status - Get sync status
router.get('/sync/status', getSyncStatus);

export default router;
