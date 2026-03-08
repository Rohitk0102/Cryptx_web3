import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    getPortfolio,
    refreshPortfolio,
    getPortfolioHistory,
    getAssetAllocation,
    getPerformanceMetrics,
    streamPortfolioLive,
} from '../controllers/portfolio.controller';

const router = Router();

router.use(authenticate);

router.get('/', getPortfolio);
router.get('/live', streamPortfolioLive);
router.post('/refresh', refreshPortfolio);
router.get('/history', getPortfolioHistory);
router.get('/allocation', getAssetAllocation);
router.get('/metrics', getPerformanceMetrics);

export default router;
