import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getTransactions } from '../controllers/transaction.controller';
import { syncTransactions, getSyncStatus } from '../controllers/sync.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/transactions - Get transactions with pagination, filtering, and sorting
router.get('/', getTransactions);

// POST /api/transactions/sync - Sync transactions from wallets
router.post('/sync', syncTransactions);

// GET /api/transactions/sync/status - Get sync status
router.get('/sync/status', getSyncStatus);

export default router;
