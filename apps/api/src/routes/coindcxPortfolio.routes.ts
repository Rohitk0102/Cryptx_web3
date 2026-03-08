import { Router } from 'express';
import {
    getCoinDCXBalances,
    getCoinDCXTrades,
    maybeGetCoinDCXPortfolio,
} from '../controllers/coindcxPortfolio.controller';

const router = Router();

router.get('/balances', getCoinDCXBalances);
router.get('/trades', getCoinDCXTrades);
router.get('/portfolio', maybeGetCoinDCXPortfolio);

export default router;
