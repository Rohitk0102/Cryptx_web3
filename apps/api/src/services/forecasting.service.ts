import { PrismaClient } from '@prisma/client';
import { MarketDataClient } from './gateApiClient';
import { TechnicalAnalysisEngine } from './technicalAnalysis';
import { RiskAnalyzer } from './riskAnalyzer';
import { AIForecaster } from './aiForecaster';

interface ForecastResponse {
  symbol: string;
  currentPrice: number;
  forecasts: any[];
  riskAnalysis: any;
  technicalIndicators: any;
  generatedAt: Date;
}

export class ForecastingService {
  private prisma: PrismaClient;
  private marketDataClient: MarketDataClient;
  private technicalEngine: TechnicalAnalysisEngine;
  private riskAnalyzer: RiskAnalyzer;
  private aiForecaster: AIForecaster;

  constructor(prisma: PrismaClient, huggingFaceApiKey?: string) {
    this.prisma = prisma;
    this.marketDataClient = new MarketDataClient();
    this.technicalEngine = new TechnicalAnalysisEngine();
    this.riskAnalyzer = new RiskAnalyzer();
    this.aiForecaster = new AIForecaster(huggingFaceApiKey);
  }

  async getForecast(symbol: string, userId: string): Promise<ForecastResponse> {
    const cached = await this.getCachedForecast(symbol, userId);
    if (cached) return cached;
    const forecast = await this.generateNewForecast(symbol);
    await this.cacheForecast(symbol, userId, forecast);
    return forecast;
  }

  private async getCachedForecast(symbol: string, userId: string): Promise<ForecastResponse | null> {
    try {
      const cached = await this.prisma.forecastCache.findFirst({
        where: { symbol, userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (!cached) return null;
      return {
        symbol: cached.symbol,
        currentPrice: cached.currentPrice,
        forecasts: cached.forecasts as any[],
        riskAnalysis: cached.riskAnalysis as any,
        technicalIndicators: cached.indicators as any,
        generatedAt: cached.generatedAt,
      };
    } catch {
      return null;
    }
  }

  private async generateNewForecast(symbol: string): Promise<ForecastResponse> {
    const now = Math.floor(Date.now() / 1000);
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60);
    
    console.log(`📊 Generating forecast for ${symbol}...`);
    console.log(`📅 Fetching data from ${new Date(ninetyDaysAgo * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);
    
    // Fetch candlesticks first
    const candlesticks = await this.marketDataClient.getCandlesticks(symbol, '1d', ninetyDaysAgo, now);
    console.log(`📈 Received ${candlesticks.length} candlesticks for ${symbol}`);
    
    if (candlesticks.length < 30) {
      console.error(`❌ Insufficient data: only ${candlesticks.length} candlesticks (need at least 30)`);
      throw new Error(`Insufficient historical data: only ${candlesticks.length} data points available (need at least 30)`);
    }
    
    const prices = candlesticks.map(c => c.close);
    let currentPrice = prices[prices.length - 1];

    try {
      // Add a small delay before fetching market stats to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      const marketStats = await this.marketDataClient.getMarketStats(symbol);
      currentPrice = marketStats.lastPrice;
    } catch (error: any) {
      console.warn(
        `⚠️ Falling back to latest closing price for ${symbol} because market stats fetch failed: ${error.message}`
      );
    }

    const indicators = this.technicalEngine.calculateAllIndicators(candlesticks);
    const riskAnalysis = this.riskAnalyzer.analyzeRisk(candlesticks, indicators);
    const forecasts = await this.aiForecaster.generateForecasts(prices, currentPrice, riskAnalysis.volatility.annualized);
    
    console.log(`✅ Forecast generated successfully for ${symbol}`);
    
    return {
      symbol,
      currentPrice,
      forecasts,
      riskAnalysis: {
        riskScore: riskAnalysis.riskScore,
        riskCategory: riskAnalysis.riskCategory,
        volatility: riskAnalysis.volatility.annualized,
        sentiment: riskAnalysis.sentiment.classification,
        recommendations: riskAnalysis.recommendations,
      },
      technicalIndicators: indicators,
      generatedAt: new Date(),
    };
  }

  private async cacheForecast(symbol: string, userId: string, forecast: ForecastResponse): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await this.prisma.forecastCache.upsert({
        where: { userId_symbol: { userId, symbol } },
        create: { userId, symbol, currentPrice: forecast.currentPrice, forecasts: forecast.forecasts as any, riskAnalysis: forecast.riskAnalysis as any, indicators: forecast.technicalIndicators as any, historicalData: [] as any, expiresAt },
        update: { currentPrice: forecast.currentPrice, forecasts: forecast.forecasts as any, riskAnalysis: forecast.riskAnalysis as any, indicators: forecast.technicalIndicators as any, expiresAt },
      });
    } catch (error) {
      console.error('Cache error:', error);
    }
  }

  getSupportedSymbols(): string[] {
    return ['BTC_USDT', 'ETH_USDT', 'BNB_USDT', 'SOL_USDT', 'ADA_USDT', 'XRP_USDT', 'DOT_USDT', 'MATIC_USDT', 'LINK_USDT', 'UNI_USDT', 'AVAX_USDT', 'TRX_USDT'];
  }
}
