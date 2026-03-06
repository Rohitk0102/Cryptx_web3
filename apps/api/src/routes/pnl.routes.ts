import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    getRealizedPnL,
    getUnrealizedPnL,
    getPnLSummary,
    updateCostBasisMethod,
} from '../controllers/pnl.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/pnl/realized - Get realized P&L
router.get('/realized', getRealizedPnL);

// GET /api/pnl/unrealized - Get unrealized P&L
router.get('/unrealized', getUnrealizedPnL);

// GET /api/pnl/summary - Get complete P&L summary
router.get('/summary', getPnLSummary);

// PATCH /api/pnl/cost-basis-method - Update cost basis method preference
router.patch('/cost-basis-method', updateCostBasisMethod);

export default router;
