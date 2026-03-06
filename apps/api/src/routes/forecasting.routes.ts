import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getForecast, getSupportedSymbols } from '../controllers/forecasting.controller';

const router = Router();

router.use(authenticate);

router.get('/supported-symbols', getSupportedSymbols);
router.get('/:symbol', getForecast);

export default router;
