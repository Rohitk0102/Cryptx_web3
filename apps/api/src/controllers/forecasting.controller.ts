import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { ForecastingService } from '../services/forecasting.service';

let forecastingService: ForecastingService;

try {
  forecastingService = new ForecastingService(prisma, process.env.HUGGINGFACE_API_KEY);
  console.log('✅ ForecastingService initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize ForecastingService:', error);
  throw error;
}

export const getForecast = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const symbol = req.params.symbol as string;

    console.log('📊 Forecast request:', { userId, symbol });

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const supportedSymbols = forecastingService.getSupportedSymbols();
    if (!supportedSymbols.includes(symbol)) {
      return res.status(400).json({ error: 'Unsupported symbol', supportedSymbols });
    }

    const forecast = await forecastingService.getForecast(symbol, userId);
    res.json(forecast);
  } catch (error: any) {
    console.error('❌ Forecast error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate forecast', message: error.message });
  }
};

export const getSupportedSymbols = async (_req: AuthRequest, res: Response) => {
  try {
    console.log('📋 Getting supported symbols...');
    const symbols = forecastingService.getSupportedSymbols();
    console.log('✅ Supported symbols:', symbols);
    res.json({ symbols });
  } catch (error: any) {
    console.error('❌ Error getting supported symbols:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to get supported symbols', message: error.message });
  }
};
