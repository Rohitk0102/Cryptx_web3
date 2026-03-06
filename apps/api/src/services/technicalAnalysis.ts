/**
 * Technical Analysis Engine
 * 
 * Calculates technical indicators from historical price data for cryptocurrency
 * market analysis. Provides RSI, MACD, Bollinger Bands, and Moving Averages.
 * 
 * Requirements:
 * - 3.1: Calculate RSI (Relative Strength Index) for 14-day periods
 * - 3.2: Calculate MACD (Moving Average Convergence Divergence) with standard parameters (12, 26, 9)
 * - 3.3: Calculate Bollinger Bands with 20-day moving average and 2 standard deviations
 * - 3.4: Calculate Simple Moving Averages for 7, 30, and 90-day periods
 * - 3.5: Return errors for insufficient data
 */

/**
 * Represents a single candlestick data point with OHLCV values
 */
export interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * MACD indicator values
 */
export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

/**
 * Bollinger Bands indicator values
 */
export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

/**
 * Moving averages for multiple periods
 */
export interface MovingAveragesResult {
  sma7: number[];
  sma30: number[];
  sma90: number[];
}

/**
 * Complete set of technical indicators
 */
export interface TechnicalIndicators {
  rsi: number[];
  macd: MACDResult;
  bollingerBands: BollingerBandsResult;
  movingAverages: MovingAveragesResult;
}

/**
 * Error thrown when insufficient data is provided for calculations
 */
export class InsufficientDataError extends Error {
  constructor(
    message: string,
    public required: number,
    public actual: number
  ) {
    super(message);
    this.name = 'InsufficientDataError';
  }
}

/**
 * Technical Analysis Engine
 * 
 * Provides methods to calculate various technical indicators from price data.
 * All calculations follow standard financial formulas and industry best practices.
 */
export class TechnicalAnalysisEngine {
  /**
   * Calculate RSI (Relative Strength Index)
   * 
   * RSI measures the magnitude of recent price changes to evaluate overbought
   * or oversold conditions. Values range from 0 to 100.
   * 
   * Formula: RSI = 100 - (100 / (1 + RS))
   * where RS = Average Gain / Average Loss over the period
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods for RSI calculation (default: 14)
   * @returns Array of RSI values
   * @throws InsufficientDataError if prices.length < period + 1
   * 
   * **Validates: Requirements 3.1, 3.5**
   */
  calculateRSI(prices: number[], period: number = 14): number[] {
    // Validate input data has at least period + 1 points (need period + 1 for period changes)
    if (prices.length < period + 1) {
      throw new InsufficientDataError(
        `Insufficient data for RSI calculation. Requires at least ${period + 1} data points.`,
        period + 1,
        prices.length
      );
    }

    const rsi: number[] = [];
    const changes: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Calculate initial average gain and loss for the first RSI value
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else if (changes[i] < 0) {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    // Calculate first RSI value
    if (avgLoss === 0 && avgGain === 0) {
      // If there are no changes at all, RSI is 50 (neutral)
      rsi.push(50);
    } else if (avgLoss === 0) {
      // If there are no losses, RSI is 100
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    // Calculate subsequent RSI values using smoothed averages
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      // Smoothed average calculation (Wilder's smoothing method)
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0 && avgGain === 0) {
        // If there are no changes at all, RSI is 50 (neutral)
        rsi.push(50);
      } else if (avgLoss === 0) {
        // If there are no losses, RSI is 100
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * 
   * MACD shows the relationship between two moving averages of prices.
   * It consists of the MACD line, signal line, and histogram.
   * 
   * @param prices - Array of closing prices
   * @param fastPeriod - Fast EMA period (default: 12)
   * @param slowPeriod - Slow EMA period (default: 26)
   * @param signalPeriod - Signal line EMA period (default: 9)
   * @returns MACD indicator values
   * @throws InsufficientDataError if insufficient data for calculation
   * 
   * **Validates: Requirements 3.2, 3.5**
   */
  calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): MACDResult {
    // Validate input data - need at least slowPeriod + signalPeriod - 1 for complete calculation
    const minRequired = slowPeriod + signalPeriod - 1;
    if (prices.length < minRequired) {
      throw new InsufficientDataError(
        `Insufficient data for MACD calculation. Requires at least ${minRequired} data points.`,
        minRequired,
        prices.length
      );
    }

    // Calculate 12-period and 26-period EMAs
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);

    // Calculate MACD line (fast EMA - slow EMA)
    // Need to align the arrays since they have different starting points
    const macdLine: number[] = [];
    const offset = slowPeriod - fastPeriod; // slowEMA starts later than fastEMA
    
    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(fastEMA[i + offset] - slowEMA[i]);
    }

    // Calculate signal line (9-period EMA of MACD line)
    const signalLine = this.calculateEMA(macdLine, signalPeriod);

    // Calculate histogram (MACD line - signal line)
    // Need to align since signal line is shorter
    const histogram: number[] = [];
    const signalOffset = signalPeriod - 1;
    
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[i + signalOffset] - signalLine[i]);
    }

    // Return aligned arrays (all same length as histogram)
    const alignedMacdLine = macdLine.slice(signalOffset);
    
    return {
      macdLine: alignedMacdLine,
      signalLine: signalLine,
      histogram: histogram
    };
  }

  /**
   * Calculate Bollinger Bands
   * 
   * Bollinger Bands consist of a middle band (SMA) and upper/lower bands
   * that are standard deviations away from the middle band.
   * 
   * @param prices - Array of closing prices
   * @param period - Period for SMA calculation (default: 20)
   * @param stdDev - Number of standard deviations (default: 2)
   * @returns Bollinger Bands values
   * @throws InsufficientDataError if prices.length < period
   * 
   * **Validates: Requirements 3.3, 3.5**
   */
  calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): BollingerBandsResult {
    // Validate input data
    if (prices.length < period) {
      throw new InsufficientDataError(
        `Insufficient data for Bollinger Bands calculation. Requires at least ${period} data points.`,
        period,
        prices.length
      );
    }

    // Calculate 20-day SMA as middle band
    const middle = this.calculateSMA(prices, period);

    const upper: number[] = [];
    const lower: number[] = [];

    // Calculate upper and lower bands for each SMA value
    for (let i = 0; i < middle.length; i++) {
      // Get the window of prices for this SMA
      const windowStart = i;
      const windowEnd = i + period;
      const window = prices.slice(windowStart, windowEnd);

      // Calculate standard deviation of prices in this window
      const mean = middle[i];
      const squaredDiffs = window.map(price => Math.pow(price - mean, 2));
      const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
      const standardDeviation = Math.sqrt(variance);

      // Calculate upper band (SMA + 2 * stddev)
      upper.push(mean + stdDev * standardDeviation);

      // Calculate lower band (SMA - 2 * stddev)
      lower.push(mean - stdDev * standardDeviation);
    }

    return {
      upper,
      middle,
      lower
    };
  }

  /**
   * Calculate Simple Moving Average (SMA)
   * 
   * SMA is the arithmetic mean of prices over a specified period.
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods for average
   * @returns Array of SMA values
   * @throws InsufficientDataError if prices.length < period
   * 
   * **Validates: Requirements 3.4, 3.5**
   */
  calculateSMA(prices: number[], period: number): number[] {
    // Validate input data
    if (prices.length < period) {
      throw new InsufficientDataError(
        `Insufficient data for SMA calculation. Requires at least ${period} data points.`,
        period,
        prices.length
      );
    }

    const sma: number[] = [];

    // Calculate SMA for each window
    for (let i = period - 1; i < prices.length; i++) {
      const window = prices.slice(i - period + 1, i + 1);
      const sum = window.reduce((acc, price) => acc + price, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * 
   * EMA gives more weight to recent prices, making it more responsive
   * to new information than SMA.
   * 
   * Formula: EMA = (Price - Previous EMA) * Multiplier + Previous EMA
   * where Multiplier = 2 / (period + 1)
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods for average
   * @returns Array of EMA values
   * @throws InsufficientDataError if prices.length < period
   * 
   * **Validates: Requirements 3.4, 3.5**
   */
  calculateEMA(prices: number[], period: number): number[] {
    // Validate input data
    if (prices.length < period) {
      throw new InsufficientDataError(
        `Insufficient data for EMA calculation. Requires at least ${period} data points.`,
        period,
        prices.length
      );
    }

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA value is the SMA of the first 'period' prices
    const firstWindow = prices.slice(0, period);
    const firstSMA = firstWindow.reduce((acc, price) => acc + price, 0) / period;
    ema.push(firstSMA);

    // Calculate subsequent EMA values
    for (let i = period; i < prices.length; i++) {
      const currentPrice = prices[i];
      const previousEMA = ema[ema.length - 1];
      const currentEMA = (currentPrice - previousEMA) * multiplier + previousEMA;
      ema.push(currentEMA);
    }

    return ema;
  }

  /**
   * Calculate all technical indicators at once
   * 
   * Orchestrates calculation of all indicators from candlestick data.
   * This is the main entry point for getting a complete technical analysis.
   * 
   * @param candlesticks - Array of candlestick data
   * @returns Complete set of technical indicators
   * @throws InsufficientDataError if insufficient data for any calculation
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
   */
  calculateAllIndicators(candlesticks: CandlestickData[]): TechnicalIndicators {
    // Validate we have enough data for all indicators
    // Need at least 90 days for SMA90
    const minRequired = 90;
    if (candlesticks.length < minRequired) {
      throw new InsufficientDataError(
        `Insufficient data for complete technical analysis. Requires at least ${minRequired} candlesticks.`,
        minRequired,
        candlesticks.length
      );
    }

    // Extract close prices from candlesticks
    const closePrices = candlesticks.map(candle => candle.close);

    // Calculate RSI (14-period)
    const rsi = this.calculateRSI(closePrices, 14);

    // Calculate MACD (12, 26, 9)
    const macd = this.calculateMACD(closePrices, 12, 26, 9);

    // Calculate Bollinger Bands (20-day, 2 std dev)
    const bollingerBands = this.calculateBollingerBands(closePrices, 20, 2);

    // Calculate moving averages (7, 30, 90-day periods)
    const sma7 = this.calculateSMA(closePrices, 7);
    const sma30 = this.calculateSMA(closePrices, 30);
    const sma90 = this.calculateSMA(closePrices, 90);

    return {
      rsi,
      macd,
      bollingerBands,
      movingAverages: {
        sma7,
        sma30,
        sma90
      }
    };
  }
}
