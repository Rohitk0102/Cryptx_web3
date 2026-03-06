/**
 * Risk Analyzer
 * 
 * Calculates risk metrics and generates risk scores for cryptocurrency investments.
 * Provides volatility analysis, risk scoring, sentiment analysis, and recommendations.
 * 
 * Requirements:
 * - 5.1: Calculate risk score between 0-100
 * - 5.2-5.4: Factor in volatility, volume trends, and price deviation
 * - 5.5-5.7: Classify risk as Low/Medium/High
 * - 6.1-6.5: Calculate volatility metrics
 * - 7.1-7.6: Analyze market sentiment
 */

import { CandlestickData, TechnicalIndicators } from './technicalAnalysis';

/**
 * Volatility metrics for different time periods
 */
export interface VolatilityMetrics {
  daily: number;
  weekly: number;
  monthly: number;
  annualized: number;
}

/**
 * Sentiment signals from technical indicators
 */
export interface SentimentSignals {
  rsi: 'overbought' | 'oversold' | 'neutral';
  macd: 'bullish' | 'bearish' | 'neutral';
  bollingerBands: 'overbought' | 'oversold' | 'neutral';
}

/**
 * Market sentiment analysis
 */
export interface SentimentAnalysis {
  classification: 'Bullish' | 'Bearish' | 'Neutral';
  signals: SentimentSignals;
}

/**
 * Complete risk analysis result
 */
export interface RiskAnalysis {
  riskScore: number; // 0-100
  riskCategory: 'Low Risk' | 'Medium Risk' | 'High Risk';
  volatility: VolatilityMetrics;
  sentiment: SentimentAnalysis;
  maxDrawdown: number; // Maximum peak-to-trough decline as percentage
  recommendations: string[];
}

/**
 * Risk Analyzer
 * 
 * Provides comprehensive risk analysis for cryptocurrency investments.
 * Calculates volatility, risk scores, sentiment, and generates recommendations.
 */
export class RiskAnalyzer {
  /**
   * Calculate comprehensive risk analysis
   * 
   * Orchestrates all risk calculations and returns a complete risk analysis.
   * 
   * @param candlesticks - Historical price data
   * @param indicators - Technical indicators
   * @returns Complete risk analysis
   * 
   * **Validates: Requirements 5.1, 6.1, 7.1**
   */
  analyzeRisk(
    candlesticks: CandlestickData[],
    indicators: TechnicalIndicators
  ): RiskAnalysis {
    // Extract close prices
    const closePrices = candlesticks.map(c => c.close);
    
    // Calculate volatility metrics
    const volatility = this.calculateVolatility(closePrices);
    
    // Calculate volume trend
    const volumeTrend = this.calculateVolumeTrend(candlesticks);
    
    // Calculate price deviation from moving averages
    const priceDeviation = this.calculatePriceDeviation(
      closePrices[closePrices.length - 1],
      indicators.movingAverages
    );
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      volatility.monthly,
      volumeTrend,
      priceDeviation
    );
    
    // Classify risk
    const riskCategory = this.classifyRisk(riskScore, volatility.annualized);
    
    // Analyze sentiment
    const sentiment = this.analyzeSentiment(
      indicators,
      closePrices[closePrices.length - 1]
    );
    
    // Calculate maximum drawdown
    const maxDrawdown = this.calculateMaxDrawdown(closePrices);
    
    // Create risk analysis object
    const riskAnalysis: RiskAnalysis = {
      riskScore,
      riskCategory,
      volatility,
      sentiment,
      maxDrawdown,
      recommendations: []
    };
    
    // Generate recommendations
    riskAnalysis.recommendations = this.generateRecommendations(riskAnalysis);
    
    return riskAnalysis;
  }

  /**
   * Calculate volatility metrics
   * 
   * Calculates standard deviation of daily returns and derives volatility
   * for different time periods.
   * 
   * @param prices - Array of closing prices
   * @returns Volatility metrics for different periods
   * 
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   */
  private calculateVolatility(prices: number[]): VolatilityMetrics {
    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(dailyReturn);
    }
    
    // Calculate mean return
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // Calculate standard deviation of returns
    const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
    const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / returns.length;
    const dailyStdDev = Math.sqrt(variance);
    
    // Calculate volatility for different periods (expressed as percentages)
    const daily = dailyStdDev * 100; // Daily volatility as percentage
    const weekly = dailyStdDev * Math.sqrt(7) * 100; // Weekly volatility
    const monthly = dailyStdDev * Math.sqrt(30) * 100; // Monthly volatility
    const annualized = dailyStdDev * Math.sqrt(365) * 100; // Annualized volatility
    
    return {
      daily,
      weekly,
      monthly,
      annualized
    };
  }

  /**
   * Calculate coefficient of variation
   * 
   * Coefficient of variation is the ratio of standard deviation to mean,
   * expressed as a percentage.
   * 
   * @param prices - Array of closing prices
   * @returns Coefficient of variation as percentage
   * 
   * **Validates: Requirements 6.2**
   */
  private calculateCoefficientOfVariation(prices: number[]): number {
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Coefficient of variation as percentage
    return (stdDev / mean) * 100;
  }

  /**
   * Calculate maximum drawdown
   * 
   * Maximum drawdown is the largest peak-to-trough decline in the price series.
   * 
   * @param prices - Array of closing prices
   * @returns Maximum drawdown as negative percentage
   * 
   * **Validates: Requirements 6.3**
   */
  private calculateMaxDrawdown(prices: number[]): number {
    let maxDrawdown = 0;
    let peak = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      // Update peak if current price is higher
      if (prices[i] > peak) {
        peak = prices[i];
      }
      
      // Calculate drawdown from peak
      const drawdown = ((prices[i] - peak) / peak) * 100;
      
      // Update max drawdown if current drawdown is larger
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  /**
   * Calculate volume trend
   * 
   * Analyzes volume trends over the recent period to assess market activity.
   * Returns a score from -1 (declining volume) to 1 (increasing volume).
   * 
   * @param candlesticks - Historical candlestick data
   * @returns Volume trend score (-1 to 1)
   * 
   * **Validates: Requirements 5.3**
   */
  private calculateVolumeTrend(candlesticks: CandlestickData[]): number {
    // Use last 30 days for volume trend
    const recentPeriod = Math.min(30, candlesticks.length);
    const recentCandles = candlesticks.slice(-recentPeriod);
    
    // Calculate average volume for first half vs second half
    const midpoint = Math.floor(recentCandles.length / 2);
    const firstHalf = recentCandles.slice(0, midpoint);
    const secondHalf = recentCandles.slice(midpoint);
    
    const avgVolumeFirst = firstHalf.reduce((sum, c) => sum + c.volume, 0) / firstHalf.length;
    const avgVolumeSecond = secondHalf.reduce((sum, c) => sum + c.volume, 0) / secondHalf.length;
    
    // Calculate trend as percentage change, normalized to -1 to 1 range
    if (avgVolumeFirst === 0) return 0;
    
    const percentChange = (avgVolumeSecond - avgVolumeFirst) / avgVolumeFirst;
    
    // Clamp to -1 to 1 range
    return Math.max(-1, Math.min(1, percentChange));
  }

  /**
   * Calculate price deviation from moving averages
   * 
   * Measures how far the current price deviates from its moving averages.
   * Returns a score representing the average deviation.
   * 
   * @param currentPrice - Current closing price
   * @param movingAverages - Calculated moving averages
   * @returns Average deviation as percentage
   * 
   * **Validates: Requirements 5.4**
   */
  private calculatePriceDeviation(
    currentPrice: number,
    movingAverages: { sma7: number[]; sma30: number[]; sma90: number[] }
  ): number {
    // Get the most recent values from each moving average
    const sma7 = movingAverages.sma7[movingAverages.sma7.length - 1];
    const sma30 = movingAverages.sma30[movingAverages.sma30.length - 1];
    const sma90 = movingAverages.sma90[movingAverages.sma90.length - 1];
    
    // Calculate deviation from each MA as percentage
    const dev7 = Math.abs((currentPrice - sma7) / sma7) * 100;
    const dev30 = Math.abs((currentPrice - sma30) / sma30) * 100;
    const dev90 = Math.abs((currentPrice - sma90) / sma90) * 100;
    
    // Return average deviation
    return (dev7 + dev30 + dev90) / 3;
  }

  /**
   * Calculate risk score
   * 
   * Combines volatility, volume trends, and price deviation to generate
   * a risk score from 0 (lowest risk) to 100 (highest risk).
   * 
   * @param volatility - Monthly volatility percentage
   * @param volumeTrend - Volume trend score (-1 to 1)
   * @param priceDeviation - Price deviation from MAs as percentage
   * @returns Risk score (0-100)
   * 
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   */
  private calculateRiskScore(
    volatility: number,
    volumeTrend: number,
    priceDeviation: number
  ): number {
    // Volatility component (0-50 points)
    // Higher volatility = higher risk
    // Scale: 0% volatility = 0 points, 50%+ volatility = 50 points
    const volatilityScore = Math.min(50, (volatility / 50) * 50);
    
    // Volume trend component (0-25 points)
    // Declining volume can indicate risk
    // Scale: -1 (declining) = 25 points, 0 (stable) = 12.5 points, 1 (increasing) = 0 points
    const volumeScore = (1 - volumeTrend) * 12.5;
    
    // Price deviation component (0-25 points)
    // Large deviation from MAs indicates instability
    // Scale: 0% deviation = 0 points, 20%+ deviation = 25 points
    const deviationScore = Math.min(25, (priceDeviation / 20) * 25);
    
    // Combine scores
    const totalScore = volatilityScore + volumeScore + deviationScore;
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, totalScore));
  }

  /**
   * Classify risk based on score and volatility
   * 
   * Classifies risk as Low, Medium, or High based on the risk score.
   * Also flags extremely volatile assets.
   * 
   * @param riskScore - Calculated risk score (0-100)
   * @param annualizedVolatility - Annualized volatility percentage
   * @returns Risk category
   * 
   * **Validates: Requirements 5.5, 5.6, 5.7, 6.5**
   */
  private classifyRisk(
    riskScore: number,
    annualizedVolatility: number
  ): 'Low Risk' | 'Medium Risk' | 'High Risk' {
    // Check for extreme volatility first
    if (annualizedVolatility > 100) {
      // Extremely volatile assets are always high risk
      return 'High Risk';
    }
    
    // Classify based on risk score thresholds
    if (riskScore > 70) {
      return 'High Risk';
    } else if (riskScore >= 40) {
      return 'Medium Risk';
    } else {
      return 'Low Risk';
    }
  }

  /**
   * Analyze market sentiment
   * 
   * Evaluates technical indicators to determine overall market sentiment.
   * Analyzes RSI, MACD, and Bollinger Bands to classify sentiment as
   * Bullish, Bearish, or Neutral.
   * 
   * @param indicators - Technical indicators
   * @param currentPrice - Current closing price
   * @returns Sentiment analysis
   * 
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
   */
  private analyzeSentiment(
    indicators: TechnicalIndicators,
    currentPrice: number
  ): SentimentAnalysis {
    // Evaluate RSI for overbought/oversold conditions
    const latestRSI = indicators.rsi[indicators.rsi.length - 1];
    const rsiSignal: 'overbought' | 'oversold' | 'neutral' =
      latestRSI > 70 ? 'overbought' :
      latestRSI < 30 ? 'oversold' :
      'neutral';
    
    // Evaluate MACD crossovers for bullish/bearish signals
    const macdLine = indicators.macd.macdLine;
    const signalLine = indicators.macd.signalLine;
    const latestMACD = macdLine[macdLine.length - 1];
    const latestSignal = signalLine[signalLine.length - 1];
    const previousMACD = macdLine[macdLine.length - 2];
    const previousSignal = signalLine[signalLine.length - 2];
    
    let macdSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    
    // Check for crossovers
    if (previousMACD <= previousSignal && latestMACD > latestSignal) {
      // MACD crossed above signal line - bullish
      macdSignal = 'bullish';
    } else if (previousMACD >= previousSignal && latestMACD < latestSignal) {
      // MACD crossed below signal line - bearish
      macdSignal = 'bearish';
    } else if (latestMACD > latestSignal) {
      // MACD above signal line - bullish
      macdSignal = 'bullish';
    } else if (latestMACD < latestSignal) {
      // MACD below signal line - bearish
      macdSignal = 'bearish';
    }
    
    // Evaluate price position relative to Bollinger Bands
    const upperBand = indicators.bollingerBands.upper;
    const lowerBand = indicators.bollingerBands.lower;
    const latestUpper = upperBand[upperBand.length - 1];
    const latestLower = lowerBand[lowerBand.length - 1];
    
    const bbSignal: 'overbought' | 'oversold' | 'neutral' =
      currentPrice > latestUpper ? 'overbought' :
      currentPrice < latestLower ? 'oversold' :
      'neutral';
    
    // Classify overall sentiment based on signals
    const signals: SentimentSignals = {
      rsi: rsiSignal,
      macd: macdSignal,
      bollingerBands: bbSignal
    };
    
    // Count bullish and bearish signals
    let bullishCount = 0;
    let bearishCount = 0;
    
    // RSI signals
    if (rsiSignal === 'oversold') bullishCount++; // Oversold can be bullish (potential reversal)
    if (rsiSignal === 'overbought') bearishCount++; // Overbought can be bearish (potential reversal)
    
    // MACD signals
    if (macdSignal === 'bullish') bullishCount++;
    if (macdSignal === 'bearish') bearishCount++;
    
    // Bollinger Bands signals
    if (bbSignal === 'oversold') bullishCount++; // Below lower band - potential reversal up
    if (bbSignal === 'overbought') bearishCount++; // Above upper band - potential reversal down
    
    // Determine overall classification
    const classification: 'Bullish' | 'Bearish' | 'Neutral' =
      bullishCount > bearishCount ? 'Bullish' :
      bearishCount > bullishCount ? 'Bearish' :
      'Neutral';
    
    return {
      classification,
      signals
    };
  }

  /**
   * Generate risk-based recommendations
   * 
   * Generates actionable recommendations based on risk analysis and sentiment.
   * Includes warnings for high-risk assets and advice based on market conditions.
   * 
   * @param riskAnalysis - Complete risk analysis
   * @returns Array of recommendation strings
   * 
   * **Validates: Requirements 10.5**
   */
  private generateRecommendations(riskAnalysis: RiskAnalysis): string[] {
    const recommendations: string[] = [];
    
    // Risk-based recommendations
    if (riskAnalysis.riskCategory === 'High Risk') {
      recommendations.push('⚠️ HIGH RISK: This asset shows high volatility and risk indicators. Consider reducing position size or using stop-loss orders.');
      
      if (riskAnalysis.volatility.annualized > 100) {
        recommendations.push('⚠️ EXTREME VOLATILITY: Annualized volatility exceeds 100%. Expect significant price swings.');
      }
      
      if (riskAnalysis.maxDrawdown < -30) {
        recommendations.push(`⚠️ LARGE DRAWDOWN: Maximum drawdown of ${riskAnalysis.maxDrawdown.toFixed(1)}% observed. Price has experienced significant declines from peaks.`);
      }
    } else if (riskAnalysis.riskCategory === 'Medium Risk') {
      recommendations.push('⚡ MODERATE RISK: This asset shows moderate risk levels. Maintain appropriate position sizing and risk management.');
    } else {
      recommendations.push('✓ LOW RISK: This asset shows relatively low risk indicators compared to typical crypto volatility.');
    }
    
    // Sentiment-based recommendations
    if (riskAnalysis.sentiment.classification === 'Bullish') {
      recommendations.push('📈 BULLISH SENTIMENT: Technical indicators suggest positive momentum. Consider this for potential upside.');
      
      if (riskAnalysis.sentiment.signals.rsi === 'oversold') {
        recommendations.push('💡 RSI OVERSOLD: Price may be undervalued. Potential buying opportunity if other factors align.');
      }
      
      if (riskAnalysis.sentiment.signals.macd === 'bullish') {
        recommendations.push('💡 MACD BULLISH: MACD shows bullish crossover or positive momentum.');
      }
    } else if (riskAnalysis.sentiment.classification === 'Bearish') {
      recommendations.push('📉 BEARISH SENTIMENT: Technical indicators suggest negative momentum. Exercise caution or consider waiting.');
      
      if (riskAnalysis.sentiment.signals.rsi === 'overbought') {
        recommendations.push('⚠️ RSI OVERBOUGHT: Price may be overextended. Potential for pullback or consolidation.');
      }
      
      if (riskAnalysis.sentiment.signals.macd === 'bearish') {
        recommendations.push('⚠️ MACD BEARISH: MACD shows bearish crossover or negative momentum.');
      }
    } else {
      recommendations.push('➡️ NEUTRAL SENTIMENT: Mixed technical signals. Wait for clearer direction before taking positions.');
    }
    
    // Bollinger Bands specific recommendations
    if (riskAnalysis.sentiment.signals.bollingerBands === 'overbought') {
      recommendations.push('📊 BOLLINGER BANDS: Price is above upper band, indicating potential overbought conditions.');
    } else if (riskAnalysis.sentiment.signals.bollingerBands === 'oversold') {
      recommendations.push('📊 BOLLINGER BANDS: Price is below lower band, indicating potential oversold conditions.');
    }
    
    // Volatility-specific recommendations
    if (riskAnalysis.volatility.daily > 5) {
      recommendations.push(`📊 HIGH DAILY VOLATILITY: Daily volatility of ${riskAnalysis.volatility.daily.toFixed(1)}%. Expect significant intraday price movements.`);
    }
    
    // General risk management advice
    recommendations.push('💼 RISK MANAGEMENT: Always use proper position sizing, set stop-losses, and never invest more than you can afford to lose.');
    
    return recommendations;
  }
}
