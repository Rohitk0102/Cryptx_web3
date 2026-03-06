import apiClient from './api';

export interface ForecastData {
  symbol: string;
  currentPrice: number;
  forecasts: Array<{
    horizon: string;
    predictedPrice: {
      low: number;
      mid: number;
      high: number;
    };
    confidence: number;
    trend: string;
    trendStrength: number;
    momentum: number;
  }>;
  riskAnalysis: {
    riskScore: number;
    riskCategory: string;
    volatility: number;
    sentiment: string;
    recommendations: string[];
  };
  technicalIndicators: any;
  generatedAt: string;
}

export class ForecastingApi {
  async getForecast(symbol: string): Promise<ForecastData> {
    const { data } = await apiClient.get(`/forecasting/${symbol}`);
    return data;
  }

  async getSupportedSymbols(): Promise<string[]> {
    const { data } = await apiClient.get('/forecasting/supported-symbols');
    return data.symbols;
  }
}

export const forecastingApi = new ForecastingApi();
