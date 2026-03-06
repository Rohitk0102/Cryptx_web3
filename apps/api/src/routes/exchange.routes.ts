import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    connectExchange,
    getExchangeAccounts,
    syncExchangeBalances,
    deleteExchangeAccount,
    getExchangeBalances,
    syncTradeHistory,
    getTradeHistory,
} from '../controllers/exchange.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/exchange/connect - Connect new exchange account
router.post('/connect', connectExchange);

// GET /api/exchange/accounts - List all exchange accounts
router.get('/accounts', getExchangeAccounts);

// POST /api/exchange/accounts/:id/sync - Sync balances for specific account
router.post('/accounts/:id/sync', syncExchangeBalances);

// POST /api/exchange/accounts/:id/sync-trades - Sync trade history for specific account
router.post('/accounts/:id/sync-trades', syncTradeHistory);

// GET /api/exchange/accounts/:id/trades - Get trade history for specific account
router.get('/accounts/:id/trades', getTradeHistory);

// DELETE /api/exchange/accounts/:id - Remove exchange account
router.delete('/accounts/:id', deleteExchangeAccount);

// GET /api/exchange/accounts/:id/balances - Get balances for specific account
router.get('/accounts/:id/balances', getExchangeBalances);

export default router;
