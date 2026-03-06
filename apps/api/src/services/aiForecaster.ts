/**
 * AI Forecaster using Hugging Face Inference API
 * Simple API wrapper - no local model installation required
 */

interface ForecastResult {
  horizon: '24h' | '7d' | '30d';
  predictedPrice: {
    low: number;
    mid: number;
    high: number;
  };
  confidence: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number;
  momentum: number;
}

export class AIForecaster {
  private apiKey: string;
  private apiUrl = 'https://api-inference.huggingface.co/models/amazon/chronos-t5-small';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.HUGGINGFACE_API_KEY || '';
  }

  /**
   * Generate AI-powered price forecasts
   */
  async generateForecasts(
    historicalPrices: number[],
    currentPrice: number,
    volatility: number
  ): Promise<ForecastResult[]> {
    // If no API key, use fallback
    if (!this.apiKey) {
      console.warn('No Hugging Face API key - using fallback forecasts');
      return this.generateFallbackForecasts(historicalPrices, currentPrice, volatility);
    }

    try {
      const forecasts: ForecastResult[] = [];

      // Generate forecasts for each horizon
      const horizons = [
        { key: '24h' as const, steps: 1 },
        { key: '7d' as const, steps: 7 },
        { key: '30d' as const, steps: 30 },
      ];

      for (const { key, steps } of horizons) {
        const prediction = await this.callHuggingFaceAPI(historicalPrices, steps);
        forecasts.push(this.formatForecast(prediction, currentPrice, volatility, key));
      }

      return forecasts;
    } catch (error) {
      console.error('AI forecasting error:', error);
      return this.generateFallbackForecasts(historicalPrices, currentPrice, volatility);
    }
  }

  /**
   * Call Hugging Face Inference API
   */
  private async callHuggingFaceAPI(timeSeries: number[], steps: number): Promise<number[]> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: timeSeries.slice(-90), // Last 90 days
        parameters: {
          prediction_length: steps,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HF API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.forecast || data[0]?.generated_text || [];
  }

  /**
   * Format forecast result with dynamic confidence calculation
   */
  private formatForecast(
    predictions: number[],
    currentPrice: number,
    volatility: number,
    horizon: '24h' | '7d' | '30d'
  ): ForecastResult {
    const lastPrediction = predictions[predictions.length - 1] || currentPrice;
    
    // Calculate price change percentage
    const priceChange = ((lastPrediction - currentPrice) / currentPrice) * 100;
    
    // Base confidence starts at 75%
    let confidence = 75;
    
    // Reduce confidence based on volatility
    if (volatility > 80) {
      confidence -= 30; // Very high volatility
    } else if (volatility > 60) {
      confidence -= 20; // High volatility
    } else if (volatility > 40) {
      confidence -= 10; // Moderate volatility
    }
    
    // Reduce confidence for longer time horizons
    if (horizon === '30d') {
      confidence -= 15;
    } else if (horizon === '7d') {
      confidence -= 8;
    }
    
    // Adjust confidence based on trend strength
    const trendStrength = Math.abs(priceChange);
    if (trendStrength > 10) {
      confidence -= 10; // Very strong trend (less predictable)
    } else if (trendStrength < 2) {
      confidence += 5; // Weak trend (more stable)
    }
    
    // Ensure confidence is between 0 and 100
    confidence = Math.max(30, Math.min(95, confidence));

    // Calculate momentum
    const momentum = Math.min(100, Math.max(-100, priceChange * 10));
    
    // Determine trend
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (priceChange > 2) trend = 'bullish';
    else if (priceChange < -2) trend = 'bearish';

    const trendStrengthValue = Math.min(100, Math.abs(priceChange) * 5);

    // Calculate price range based on volatility
    const volatilityFactor = volatility / 100;
    const mid = lastPrediction;
    const range = mid * volatilityFactor * 0.5;

    return {
      horizon,
      predictedPrice: {
        low: mid - range,
        mid,
        high: mid + range,
      },
      confidence,
      trend,
      trendStrength: trendStrengthValue,
      momentum,
    };
  }

  /**
   * Fallback forecasts using simple trend analysis with dynamic confidence
   */
  private generateFallbackForecasts(
    historicalPrices: number[],
    currentPrice: number,
    volatility: number
  ): ForecastResult[] {
    const recentPrices = historicalPrices.slice(-30);
    const avgChange = recentPrices.reduce((sum, price, i) => {
      if (i === 0) return 0;
      return sum + ((price - recentPrices[i - 1]) / recentPrices[i - 1]);
    }, 0) / (recentPrices.length - 1);

    const forecasts: ForecastResult[] = [];
    const horizons = [
      { key: '24h' as const, days: 1 },
      { key: '7d' as const, days: 7 },
      { key: '30d' as const, days: 30 },
    ];

    for (const { key, days } of horizons) {
      const projectedChange = avgChange * days;
      const mid = currentPrice * (1 + projectedChange);
      
      const volatilityFactor = volatility / 100;
      const range = mid * volatilityFactor * 0.5;

      // Dynamic confidence calculation
      let confidence = 70; // Base confidence for fallback
      
      // Reduce confidence based on volatility
      if (volatility > 80) {
        confidence -= 30;
      } else if (volatility > 60) {
        confidence -= 20;
      } else if (volatility > 40) {
        confidence -= 10;
      }
      
      // Reduce confidence for longer horizons
      if (key === '30d') {
        confidence -= 15;
      } else if (key === '7d') {
        confidence -= 8;
      }
      
      // Adjust based on trend strength
      const priceChange = ((mid - currentPrice) / currentPrice) * 100;
      const trendStrength = Math.abs(priceChange);
      if (trendStrength > 10) {
        confidence -= 10;
      } else if (trendStrength < 2) {
        confidence += 5;
      }
      
      confidence = Math.max(25, Math.min(90, confidence));

      const momentum = Math.min(100, Math.max(-100, priceChange * 10));
      
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (priceChange > 2) trend = 'bullish';
      else if (priceChange < -2) trend = 'bearish';

      const trendStrengthValue = Math.min(100, Math.abs(priceChange) * 5);

      forecasts.push({
        horizon: key,
        predictedPrice: {
          low: mid - range,
          mid,
          high: mid + range,
        },
        confidence,
        trend,
        trendStrength: trendStrengthValue,
        momentum,
      });
    }

    return forecasts;
  }
}
