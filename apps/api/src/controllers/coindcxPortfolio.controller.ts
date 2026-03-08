import { NextFunction, Request, Response } from 'express';
import { CoinDCXEnvConfigError } from '../services/coindcxEnv.service';
import { CoinDCXPortfolioApiService } from '../services/coindcxPortfolioApi.service';

const coindcxPortfolioApiService = new CoinDCXPortfolioApiService();

function handleCoinDCXError(error: unknown, res: Response): void {
    console.error('❌ CoinDCX portfolio API error:', error);

    if (error instanceof CoinDCXEnvConfigError) {
        res.status(500).json({
            error: error.message,
        });
        return;
    }

    if (error instanceof Error) {
        const message = error.message;
        if (message.includes('Invalid API credentials')) {
            res.status(401).json({ error: message });
            return;
        }

        if (message.includes('Rate limit exceeded')) {
            res.status(429).json({ error: message });
            return;
        }

        if (message.includes('trade history window')) {
            res.status(400).json({ error: message });
            return;
        }

        if (message.includes('Network error') || message.includes('CoinDCX service temporarily unavailable')) {
            res.status(502).json({ error: message });
            return;
        }

        res.status(500).json({ error: message });
        return;
    }

    res.status(500).json({ error: 'Unknown CoinDCX error' });
}

export const getCoinDCXBalances = async (_req: Request, res: Response) => {
    try {
        const data = await coindcxPortfolioApiService.getBalances();
        res.json(data);
    } catch (error) {
        handleCoinDCXError(error, res);
    }
};

export const getCoinDCXTrades = async (req: Request, res: Response) => {
    try {
        const data = await coindcxPortfolioApiService.getTrades({
            from_timestamp: req.query.from_timestamp ? Number(req.query.from_timestamp) : undefined,
            to_timestamp: req.query.to_timestamp ? Number(req.query.to_timestamp) : undefined,
            symbol: req.query.symbol ? String(req.query.symbol).toUpperCase() : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            page: req.query.page ? Number(req.query.page) : undefined,
            sort: req.query.sort === 'asc' ? 'asc' : 'desc',
        });
        res.json(data);
    } catch (error) {
        handleCoinDCXError(error, res);
    }
};

export const maybeGetCoinDCXPortfolio = async (req: Request, res: Response, next: NextFunction) => {
    const hasAuthHeader = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
    const hasClerkUser = typeof req.headers['x-clerk-user-id'] === 'string' && req.headers['x-clerk-user-id'].length > 0;

    if (hasAuthHeader || hasClerkUser) {
        return next();
    }

    try {
        const data = await coindcxPortfolioApiService.getPortfolioSummary();
        return res.json(data);
    } catch (error) {
        return handleCoinDCXError(error, res);
    }
};
