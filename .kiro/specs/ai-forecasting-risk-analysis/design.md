# Design Document: AI Forecasting & Risk Analysis

## Overview

The AI Forecasting & Risk Analysis feature extends the Web3 Portfolio Tracker application with predictive analytics capabilities. The system integrates the Gate.io API to fetch comprehensive cryptocurrency market data, applies technical analysis algorithms to identify trends and patterns, and generates AI-driven price forecasts with associated risk assessments.

The feature consists of three main components:
1. **Backend Analysis Engine**: Fetches market data, calculates technical indicators, and generates forecasts
2. **Data Layer**: Caches forecast results and manages data persistence
3. **Frontend Dashboard**: Provides an intuitive interface for viewing forecasts, risk metrics, and visualizations

The system is designed to be modular, allowing for future enhancements such as additional technical indicators, machine learning models, or alternative data sources.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Forecasting Dashboard (/dashboard/forecasting)        │ │
│  │  - Cryptocurrency Selector                             │ │
│  │  - Forecast Charts & Visualizations                    │ │
│  │  - Risk Metrics Display                                │ │
│  │  - Technical Indicator Panels                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Express/Node.js)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Forecasting Controller                                │ │
│  │  - Request validation                                  │ │
│  │  - Response formatting                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Forecasting Service                                   │ │
│  │  - Orchestrates analysis workflow                      │ │
│  │  - Manages caching logic                               │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Technical Analysis Engine                             │ │
│  │  - RSI Calculator                                      │ │
│  │  - MACD Calculator                                     │ │
│  │  - Bollinger Bands Calculator                          │ │
│  │  - Moving Average Calculator                           │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Forecast Generator                                    │ │
│  │  - Trend Analysis                                      │ │
│  │  - Price Prediction                                    │ │
│  │  - Confidence Calculation                              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Risk Analyzer                                         │ │
│  │  - Volatility Calculator                               │ │
│  │  - Risk Score Generator                                │ │
│  │  - Sentiment Analyzer                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Gate.io API Client                                    │ │
│  │  - Market data fetching                                │ │
│  │  - Rate limiting & retry logic                         │ │
│  │  - Error handling                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Gate.io API                             │
│  - Candlestick/OHLCV data                                   │
│  - Market statistics                                         │
│  - Trading volume data                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Prisma ORM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  - Forecast cache table                                     │
│  - Market data cache table                                  │
│  - User preferences                                          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Request**: User selects a cryptocurrency on the forecasting dashboard
2. **Cache Check**: Backend checks if valid cached forecast exists (< 1 hour old)
3. **Data Retrieval**: If cache miss, fetch historical market data from Gate.io API
4. **Technical Analysis**: Calculate technical indicators (RSI, MACD, Bollinger Bands, Moving Averages)
5. **Forecast Generation**: Analyze trends and generate price predictions for multiple time horizons
6. **Risk Analysis**: Calculate volatility, risk scores, and sentiment indicators
7. **Cache Storage**: Store results in database with timestamp
8. **Response**: Return formatted forecast and risk data to frontend
9. **Visualization**: Frontend renders charts, metrics, and recommendations

## Components and Interfaces

### Backend Components

#### 1. Gate.io API Client (`gateApiClient.ts`)

Handles all communication with the Gate.io API using the gateapi-nodejs SDK.

```typescript
interface GateApiClientConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketStats {
  symbol: string;
  lastPrice: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

class GateApiClient {
  constructor(config: GateApiClientConfig)
  
  // Fetch historical candlestick data
  async getCandlesticks(
    symbol: string,
    interval: string,
    from: number,
    to: number
  ): Promise<CandlestickData[]>
  
  // Fetch current market statistics
  async getMarketStats(symbol: string): Promise<MarketStats>
  
  // Handle rate limiting with exponential backoff
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T>
}
```

#### 2. Technical Analysis Engine (`technicalAnalysis.ts`)

Calculates technical indicators from historical price data.

```typescript
interface TechnicalIndicators {
  rsi: number[];
  macd: {
    macdLine: number[];
    signalLine: number[];
    histogram: number[];
  };
  bollingerBands: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  movingAverages: {
    sma7: number[];
    sma30: number[];
    sma90: number[];
  };
}

class TechnicalAnalysisEngine {
  // Calculate RSI (Relative Strength Index)
  calculateRSI(prices: number[], period: number = 14): number[]
  
  // Calculate MACD (Moving Average Convergence Divergence)
  calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macdLine: number[]; signalLine: number[]; histogram: number[] }
  
  // Calculate Bollinger Bands
  calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number[]; middle: number[]; lower: number[] }
  
  // Calculate Simple Moving Average
  calculateSMA(prices: number[], period: number): number[]
  
  // Calculate Exponential Moving Average
  calculateEMA(prices: number[], period: number): number[]
  
  // Calculate all indicators at once
  calculateAllIndicators(candlesticks: CandlestickData[]): TechnicalIndicators
}
```

#### 3. Forecast Generator (`forecastGenerator.ts`)

Generates price forecasts based on technical analysis and trend identification.

```typescript
interface ForecastResult {
  timeHorizon: '24h' | '7d' | '30d';
  predictedPrice: {
    low: number;
    mid: number;
    high: number;
  };
  confidenceLevel: number; // 0-100
  trend: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number; // 0-100
}

interface ForecastInput {
  currentPrice: number;
  candlesticks: CandlestickData[];
  indicators: TechnicalIndicators;
}

class ForecastGenerator {
  // Generate forecasts for all time horizons
  generateForecasts(input: ForecastInput): ForecastResult[]
  
  // Analyze trend direction and strength
  private analyzeTrend(indicators: TechnicalIndicators): {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
  }
  
  // Calculate price momentum
  private calculateMomentum(prices: number[]): number
  
  // Determine confidence level based on data quality and volatility
  private calculateConfidence(
    volatility: number,
    dataQuality: number,
    trendStrength: number
  ): number
  
  // Generate price prediction for specific time horizon
  private predictPrice(
    currentPrice: number,
    trend: { direction: string; strength: number },
    timeHorizon: string,
    volatility: number
  ): { low: number; mid: number; high: number }
}
```

#### 4. Risk Analyzer (`riskAnalyzer.ts`)

Calculates risk metrics and generates risk scores.

```typescript
interface RiskAnalysis {
  riskScore: number; // 0-100
  riskCategory: 'Low Risk' | 'Medium Risk' | 'High Risk';
  volatility: {
    daily: number;
    weekly: number;
    monthly: number;
    annualized: number;
  };
  sentiment: {
    classification: 'Bullish' | 'Bearish' | 'Neutral';
    signals: {
      rsi: 'overbought' | 'oversold' | 'neutral';
      macd: 'bullish' | 'bearish' | 'neutral';
      bollingerBands: 'overbought' | 'oversold' | 'neutral';
    };
  };
  maxDrawdown: number; // Maximum peak-to-trough decline
  recommendations: string[];
}

class RiskAnalyzer {
  // Calculate comprehensive risk analysis
  analyzeRisk(
    candlesticks: CandlestickData[],
    indicators: TechnicalIndicators
  ): RiskAnalysis
  
  // Calculate volatility metrics
  private calculateVolatility(prices: number[]): {
    daily: number;
    weekly: number;
    monthly: number;
    annualized: number;
  }
  
  // Calculate risk score (0-100)
  private calculateRiskScore(
    volatility: number,
    volumeTrend: number,
    priceDeviation: number
  ): number
  
  // Analyze market sentiment from indicators
  private analyzeSentiment(indicators: TechnicalIndicators): {
    classification: 'Bullish' | 'Bearish' | 'Neutral';
    signals: any;
  }
  
  // Calculate maximum drawdown
  private calculateMaxDrawdown(prices: number[]): number
  
  // Generate risk-based recommendations
  private generateRecommendations(riskAnalysis: RiskAnalysis): string[]
}
```

#### 5. Forecasting Service (`forecasting.service.ts`)

Orchestrates the entire forecasting workflow and manages caching.

```typescript
interface ForecastRequest {
  symbol: string;
  userId: string;
}

interface ForecastResponse {
  symbol: string;
  currentPrice: number;
  forecasts: ForecastResult[];
  riskAnalysis: RiskAnalysis;
  technicalIndicators: TechnicalIndicators;
  historicalData: CandlestickData[];
  generatedAt: Date;
  cachedUntil: Date;
}

class ForecastingService {
  constructor(
    private gateApiClient: GateApiClient,
    private technicalAnalysisEngine: TechnicalAnalysisEngine,
    private forecastGenerator: ForecastGenerator,
    private riskAnalyzer: RiskAnalyzer,
    private prisma: PrismaClient
  )
  
  // Main method to generate or retrieve forecast
  async getForecast(request: ForecastRequest): Promise<ForecastResponse>
  
  // Check if valid cached forecast exists
  private async getCachedForecast(
    symbol: string,
    userId: string
  ): Promise<ForecastResponse | null>
  
  // Generate new forecast
  private async generateNewForecast(
    symbol: string,
    userId: string
  ): Promise<ForecastResponse>
  
  // Store forecast in cache
  private async cacheForecast(
    forecast: ForecastResponse,
    userId: string
  ): Promise<void>
  
  // Fetch and prepare market data
  private async fetchMarketData(symbol: string): Promise<{
    candlesticks: CandlestickData[];
    currentPrice: number;
  }>
}
```

#### 6. Forecasting Controller (`forecasting.controller.ts`)

Handles HTTP requests and responses for the forecasting API.

```typescript
class ForecastingController {
  constructor(private forecastingService: ForecastingService)
  
  // GET /api/forecasting/:symbol
  async getForecast(req: Request, res: Response): Promise<void>
  
  // GET /api/forecasting/supported-symbols
  async getSupportedSymbols(req: Request, res: Response): Promise<void>
  
  // DELETE /api/forecasting/cache/:symbol
  async clearCache(req: Request, res: Response): Promise<void>
}
```

### Frontend Components

#### 1. Forecasting Dashboard Page (`app/dashboard/forecasting/page.tsx`)

Main page component for the forecasting feature.

```typescript
interface ForecastingPageProps {
  searchParams: { symbol?: string };
}

export default function ForecastingPage({ searchParams }: ForecastingPageProps) {
  // Component renders:
  // - Cryptocurrency selector dropdown
  // - Loading states
  // - Forecast charts
  // - Risk metrics cards
  // - Technical indicator panels
  // - Error messages
}
```

#### 2. Cryptocurrency Selector (`components/forecasting/CryptoSelector.tsx`)

Dropdown component for selecting cryptocurrencies to analyze.

```typescript
interface CryptoSelectorProps {
  selectedSymbol: string | null;
  onSymbolChange: (symbol: string) => void;
  supportedSymbols: string[];
}

export function CryptoSelector({
  selectedSymbol,
  onSymbolChange,
  supportedSymbols
}: CryptoSelectorProps) {
  // Renders searchable dropdown with cryptocurrency symbols
}
```

#### 3. Forecast Chart (`components/forecasting/ForecastChart.tsx`)

Chart component displaying historical prices and forecasted prices.

```typescript
interface ForecastChartProps {
  historicalData: CandlestickData[];
  forecasts: ForecastResult[];
  currentPrice: number;
}

export function ForecastChart({
  historicalData,
  forecasts,
  currentPrice
}: ForecastChartProps) {
  // Renders line chart with:
  // - Historical price line
  // - Forecast lines for each time horizon
  // - Confidence interval shading
  // - Interactive tooltips
}
```

#### 4. Risk Metrics Card (`components/forecasting/RiskMetricsCard.tsx`)

Displays risk score and related metrics.

```typescript
interface RiskMetricsCardProps {
  riskAnalysis: RiskAnalysis;
}

export function RiskMetricsCard({ riskAnalysis }: RiskMetricsCardProps) {
  // Renders:
  // - Risk score with color coding
  // - Risk category badge
  // - Volatility metrics
  // - Sentiment indicators
  // - Recommendations list
}
```

#### 5. Technical Indicators Panel (`components/forecasting/TechnicalIndicatorsPanel.tsx`)

Displays technical indicator values and charts.

```typescript
interface TechnicalIndicatorsPanelProps {
  indicators: TechnicalIndicators;
  historicalData: CandlestickData[];
}

export function TechnicalIndicatorsPanel({
  indicators,
  historicalData
}: TechnicalIndicatorsPanelProps) {
  // Renders:
  // - RSI chart with overbought/oversold zones
  // - MACD chart with signal line
  // - Bollinger Bands overlay
  // - Moving averages comparison
}
```

#### 6. Forecast API Client (`lib/forecastingApi.ts`)

Frontend API client for making requests to the backend.

```typescript
class ForecastingApi {
  private baseUrl: string;
  
  async getForecast(symbol: string): Promise<ForecastResponse>
  
  async getSupportedSymbols(): Promise<string[]>
  
  async clearCache(symbol: string): Promise<void>
  
  private async handleResponse<T>(response: Response): Promise<T>
}

export const forecastingApi = new ForecastingApi();
```

## Data Models

### Database Schema (Prisma)

```prisma
model ForecastCache {
  id            String   @id @default(cuid())
  userId        String
  symbol        String
  currentPrice  Float
  forecasts     Json     // Array of ForecastResult
  riskAnalysis  Json     // RiskAnalysis object
  indicators    Json     // TechnicalIndicators object
  historicalData Json    // Array of CandlestickData
  generatedAt   DateTime @default(now())
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, symbol])
  @@index([symbol])
  @@index([expiresAt])
}

model MarketDataCache {
  id            String   @id @default(cuid())
  symbol        String   @unique
  candlesticks  Json     // Array of CandlestickData
  fetchedAt     DateTime @default(now())
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([symbol])
  @@index([expiresAt])
}
```

### Data Transfer Objects

```typescript
// API Request DTOs
interface GetForecastRequestDto {
  symbol: string;
}

// API Response DTOs
interface GetForecastResponseDto {
  success: boolean;
  data?: ForecastResponse;
  error?: {
    code: string;
    message: string;
  };
}

interface GetSupportedSymbolsResponseDto {
  success: boolean;
  data?: string[];
  error?: {
    code: string;
    message: string;
  };
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: API Response Parsing Consistency

*For any* valid Gate.io API response containing market data, parsing the response should produce a structured object with all required OHLCV fields (open, high, low, close, volume) present and valid.

**Validates: Requirements 1.3, 2.2**

### Property 2: Error Response Handling

*For any* error response from the Gate.io API, the system should return a descriptive error message and log the error details without throwing an unhandled exception.

**Validates: Requirements 1.4**

### Property 3: Exponential Backoff Retry Pattern

*For any* sequence of retry attempts, the delay between consecutive retries should follow an exponential backoff pattern where each delay is at least double the previous delay.

**Validates: Requirements 1.5**

### Property 4: Historical Data Completeness

*For any* cryptocurrency symbol request, the system should fetch exactly 90 days of historical candlestick data, and each candlestick should contain all OHLCV fields in a structured format.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: Incomplete Data Error Handling

*For any* historical data request that returns fewer than the minimum required data points for analysis, the system should return an error indicating insufficient data.

**Validates: Requirements 2.4**

### Property 6: Cache Hit Within Time Window

*For any* cryptocurrency symbol, if a forecast request is made within 5 minutes of a previous request for the same symbol by the same user, the system should return cached data without making a new API call.

**Validates: Requirements 2.5**

### Property 7: RSI Calculation Correctness

*For any* valid price series with at least 15 data points, the calculated RSI values should be between 0 and 100, and the RSI calculation should follow the standard formula: RSI = 100 - (100 / (1 + RS)) where RS is the average gain divided by average loss over the period.

**Validates: Requirements 3.1**

### Property 8: MACD Calculation Correctness

*For any* valid price series with at least 26 data points, the calculated MACD should consist of a MACD line (12-period EMA minus 26-period EMA), a signal line (9-period EMA of MACD line), and a histogram (MACD line minus signal line).

**Validates: Requirements 3.2**

### Property 9: Bollinger Bands Calculation Correctness

*For any* valid price series with at least 20 data points, the calculated Bollinger Bands should have an upper band, middle band (20-day SMA), and lower band, where the upper and lower bands are exactly 2 standard deviations away from the middle band.

**Validates: Requirements 3.3**

### Property 10: Moving Average Calculation Correctness

*For any* valid price series with at least 90 data points, the calculated simple moving averages for 7, 30, and 90-day periods should each equal the arithmetic mean of prices over their respective periods.

**Validates: Requirements 3.4**

### Property 11: Insufficient Data Error for Calculations

*For any* technical indicator calculation request with insufficient data points, the system should return an error specifying the minimum required data points for that indicator.

**Validates: Requirements 3.5**

### Property 12: Forecast Completeness

*For any* forecast request, the generated forecast should include predictions for all three time horizons (24h, 7d, 30d), each with low/mid/high price estimates, a confidence level between 0-100, and trend information.

**Validates: Requirements 4.1, 4.4, 4.6**

### Property 13: Momentum and Trend Strength Bounds

*For any* generated forecast, the trend strength value should be between 0 and 100, representing the strength of the identified trend.

**Validates: Requirements 4.3**

### Property 14: High Volatility Confidence Reduction

*For any* forecast where market volatility exceeds 50% over the analysis period, the confidence level should be at least 20 percentage points lower than it would be with normal volatility.

**Validates: Requirements 4.5**

### Property 15: Risk Score Bounds

*For any* risk analysis, the calculated risk score should be between 0 (lowest risk) and 100 (highest risk), inclusive.

**Validates: Requirements 5.1**

### Property 16: Risk Classification Correctness

*For any* risk score, the system should classify it as "High Risk" when score > 70, "Medium Risk" when 40 ≤ score ≤ 70, and "Low Risk" when score < 40.

**Validates: Requirements 5.5, 5.6, 5.7**

### Property 17: Volatility Calculation Correctness

*For any* price series with at least 30 data points, the calculated standard deviation of daily returns should equal the square root of the average squared deviation from the mean return.

**Validates: Requirements 6.1**

### Property 18: Coefficient of Variation Calculation

*For any* price series, the coefficient of variation should equal the standard deviation divided by the mean, expressed as a percentage.

**Validates: Requirements 6.2**

### Property 19: Maximum Drawdown Identification

*For any* price series, the maximum drawdown should equal the largest peak-to-trough decline, calculated as (trough - peak) / peak, and should be expressed as a negative percentage.

**Validates: Requirements 6.3**

### Property 20: Volatility Percentage Expression

*For any* calculated volatility metric, the value should be expressed as a percentage (multiplied by 100).

**Validates: Requirements 6.4**

### Property 21: Extreme Volatility Flagging

*For any* asset where annualized volatility exceeds 100%, the system should flag the asset as "Extremely Volatile".

**Validates: Requirements 6.5**

### Property 22: RSI Sentiment Classification

*For any* RSI value, the system should classify it as "overbought" when RSI > 70, "oversold" when RSI < 30, and "neutral" otherwise.

**Validates: Requirements 7.1**

### Property 23: MACD Crossover Signal Detection

*For any* MACD calculation, when the MACD line crosses above the signal line, the system should identify a bullish signal, and when it crosses below, the system should identify a bearish signal.

**Validates: Requirements 7.2**

### Property 24: Bollinger Band Position Evaluation

*For any* current price and Bollinger Bands, when price is above the upper band, the system should classify it as "overbought", when below the lower band as "oversold", and when between bands as "neutral".

**Validates: Requirements 7.3**

### Property 25: Overall Sentiment Classification

*For any* set of technical indicator signals, when the majority of signals are bullish, the system should classify overall sentiment as "Bullish"; when the majority are bearish, classify as "Bearish"; and when signals are evenly mixed, classify as "Neutral".

**Validates: Requirements 7.4, 7.5, 7.6**

### Property 26: Forecast Display Performance

*For any* completed analysis, the dashboard should display forecast results within 5 seconds of analysis completion.

**Validates: Requirements 8.5**

### Property 27: Chart Data Completeness

*For any* forecast visualization, the displayed chart should contain both historical price data and predicted price data for all requested time horizons.

**Validates: Requirements 9.1**

### Property 28: Confidence Interval Rendering

*For any* forecast with confidence levels, the chart should render confidence intervals as visual elements (shaded regions or error bars).

**Validates: Requirements 9.3**

### Property 29: Technical Indicator Panel Separation

*For any* set of technical indicators, each indicator type (RSI, MACD, Bollinger Bands) should be rendered in a separate chart panel.

**Validates: Requirements 9.4**

### Property 30: Risk Metrics Display Completeness

*For any* completed risk analysis, the dashboard should display all required metrics: risk score with color coding, volatility percentage, market sentiment classification, and risk category.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 31: High Risk Warning Display

*For any* risk analysis where the risk score is classified as "High Risk", the dashboard should display warning messages and recommendations.

**Validates: Requirements 10.5**

### Property 32: Forecast Persistence with Timestamp

*For any* generated forecast, when stored in the database, it should include a timestamp indicating when it was generated.

**Validates: Requirements 11.1**

### Property 33: Cache Validity and Usage

*For any* forecast request, if cached data exists and is less than 1 hour old, the system should return the cached data; if cached data is older than 1 hour or doesn't exist, the system should generate a new forecast and update the cache.

**Validates: Requirements 11.2, 11.3, 11.4**

### Property 34: Graceful Storage Failure Handling

*For any* forecast generation where database storage fails, the system should log the error but still return the forecast to the user without throwing an exception.

**Validates: Requirements 11.5**

### Property 35: Error Logging Completeness

*For any* error that occurs during forecast generation or risk analysis, the system should log detailed error information including error type, message, stack trace, and relevant context.

**Validates: Requirements 12.4**

### Property 36: Authentication Verification

*For any* request to access the forecasting dashboard or API endpoints, the system should verify that the user is authenticated via Clerk before allowing access.

**Validates: Requirements 13.1, 13.3**

### Property 37: Authentication Token Inclusion

*For any* API request made from the frontend to the backend forecasting endpoints, the request should include the user's authentication token in the headers.

**Validates: Requirements 13.4**

### Property 38: Invalid Token Error Response

*For any* API request with an invalid or expired authentication token, the system should return a 401 Unauthorized HTTP status code.

**Validates: Requirements 13.5**

### Property 39: Forecast Generation Performance

*For any* standard forecast request (cryptocurrency with sufficient historical data and normal API response times), the system should complete the analysis and return results within 5 seconds.

**Validates: Requirements 14.1**

## Error Handling

### Error Categories

The system handles four main categories of errors:

1. **External API Errors**: Gate.io API unavailability, rate limiting, invalid responses
2. **Data Errors**: Insufficient historical data, invalid data formats, missing required fields
3. **Calculation Errors**: Mathematical errors, division by zero, invalid input ranges
4. **System Errors**: Database failures, network errors, authentication failures

### Error Handling Strategy

#### 1. External API Errors

```typescript
class GateApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiResponse?: any
  ) {
    super(message);
    this.name = 'GateApiError';
  }
}

// Error handling in API client
async getCandlesticks(symbol: string, interval: string, from: number, to: number) {
  try {
    const response = await this.retryWithBackoff(
      () => this.api.getCandlesticks(symbol, interval, from, to),
      3 // max retries
    );
    return this.parseCandlestickResponse(response);
  } catch (error) {
    if (error.statusCode === 429) {
      throw new GateApiError('Rate limit exceeded. Please try again later.', 429);
    } else if (error.statusCode >= 500) {
      throw new GateApiError('Market data service temporarily unavailable.', 503);
    } else {
      throw new GateApiError('Failed to fetch market data.', error.statusCode);
    }
  }
}
```

#### 2. Data Validation Errors

```typescript
class InsufficientDataError extends Error {
  constructor(
    message: string,
    public required: number,
    public actual: number
  ) {
    super(message);
    this.name = 'InsufficientDataError';
  }
}

// Validation before calculations
function validateDataForRSI(prices: number[]): void {
  if (prices.length < 15) {
    throw new InsufficientDataError(
      'Insufficient data for RSI calculation. Requires at least 15 data points.',
      15,
      prices.length
    );
  }
}
```

#### 3. Calculation Errors

```typescript
class CalculationError extends Error {
  constructor(
    message: string,
    public indicator: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'CalculationError';
  }
}

// Safe calculation with error handling
function calculateRSI(prices: number[], period: number): number[] {
  try {
    validateDataForRSI(prices);
    // Perform calculation
    return rsiValues;
  } catch (error) {
    if (error instanceof InsufficientDataError) {
      throw error;
    }
    throw new CalculationError(
      'Failed to calculate RSI',
      'RSI',
      error
    );
  }
}
```

#### 4. System Errors

```typescript
class SystemError extends Error {
  constructor(
    message: string,
    public component: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'SystemError';
  }
}

// Database error handling
async cacheForecast(forecast: ForecastResponse, userId: string): Promise<void> {
  try {
    await this.prisma.forecastCache.upsert({
      where: { userId_symbol: { userId, symbol: forecast.symbol } },
      update: { ...forecast, updatedAt: new Date() },
      create: { ...forecast, userId }
    });
  } catch (error) {
    logger.error('Failed to cache forecast', { error, userId, symbol: forecast.symbol });
    // Don't throw - caching failure shouldn't prevent forecast delivery
  }
}
```

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Example error responses
{
  success: false,
  error: {
    code: 'INSUFFICIENT_DATA',
    message: 'Insufficient data for analysis. This cryptocurrency requires more trading history.',
    details: { required: 90, actual: 45 }
  }
}

{
  success: false,
  error: {
    code: 'API_UNAVAILABLE',
    message: 'Market data service temporarily unavailable. Please try again later.'
  }
}

{
  success: false,
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required. Please log in.'
  }
}
```

### Logging Strategy

All errors are logged with appropriate context:

```typescript
// Error logging utility
function logError(error: Error, context: Record<string, any>): void {
  logger.error({
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
}

// Usage in service
try {
  const forecast = await this.generateNewForecast(symbol, userId);
  return forecast;
} catch (error) {
  logError(error, {
    component: 'ForecastingService',
    method: 'getForecast',
    symbol,
    userId
  });
  throw error;
}
```

## Testing Strategy

The testing strategy employs a dual approach combining unit tests for specific examples and edge cases with property-based tests for universal correctness properties.

### Unit Testing

Unit tests focus on:
- **Specific examples**: Concrete test cases with known inputs and expected outputs
- **Edge cases**: Boundary conditions, empty inputs, extreme values
- **Error conditions**: Invalid inputs, API failures, data validation failures
- **Integration points**: Component interactions, API client behavior, database operations

**Testing Framework**: Jest with TypeScript support

**Example Unit Tests**:

```typescript
describe('TechnicalAnalysisEngine', () => {
  describe('calculateRSI', () => {
    it('should calculate RSI correctly for known price series', () => {
      const prices = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
      const rsi = engine.calculateRSI(prices, 14);
      expect(rsi[rsi.length - 1]).toBeCloseTo(70.46, 1);
    });

    it('should throw error for insufficient data', () => {
      const prices = [44, 44.34, 44.09];
      expect(() => engine.calculateRSI(prices, 14)).toThrow(InsufficientDataError);
    });

    it('should handle all identical prices', () => {
      const prices = new Array(20).fill(100);
      const rsi = engine.calculateRSI(prices, 14);
      expect(rsi[rsi.length - 1]).toBe(50); // No change = neutral RSI
    });
  });
});

describe('ForecastingService', () => {
  it('should return cached forecast when cache is valid', async () => {
    const cachedForecast = createMockForecast();
    mockPrisma.forecastCache.findFirst.mockResolvedValue(cachedForecast);
    
    const result = await service.getForecast({ symbol: 'BTC_USDT', userId: 'user123' });
    
    expect(result).toEqual(cachedForecast);
    expect(mockGateApiClient.getCandlesticks).not.toHaveBeenCalled();
  });

  it('should generate new forecast when cache is expired', async () => {
    const expiredCache = createMockForecast({ expiresAt: new Date(Date.now() - 1000) });
    mockPrisma.forecastCache.findFirst.mockResolvedValue(expiredCache);
    
    const result = await service.getForecast({ symbol: 'BTC_USDT', userId: 'user123' });
    
    expect(mockGateApiClient.getCandlesticks).toHaveBeenCalled();
  });
});
```

### Property-Based Testing

Property-based tests verify universal properties across many randomly generated inputs. Each test runs a minimum of 100 iterations to ensure comprehensive coverage.

**Testing Framework**: fast-check (property-based testing library for TypeScript)

**Property Test Configuration**:
- Minimum 100 iterations per test
- Each test tagged with feature name and property number
- Tests reference design document properties

**Example Property Tests**:

```typescript
import fc from 'fast-check';

describe('Property Tests: Technical Analysis', () => {
  /**
   * Feature: ai-forecasting-risk-analysis, Property 7: RSI Calculation Correctness
   * For any valid price series with at least 15 data points, the calculated RSI values
   * should be between 0 and 100.
   */
  it('RSI values should always be between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 1, max: 100000 }), { minLength: 15, maxLength: 100 }),
        (prices) => {
          const rsi = engine.calculateRSI(prices, 14);
          return rsi.every(value => value >= 0 && value <= 100);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: ai-forecasting-risk-analysis, Property 10: Moving Average Calculation Correctness
   * For any valid price series, the calculated SMA should equal the arithmetic mean
   * of prices over the period.
   */
  it('SMA should equal arithmetic mean over period', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 1, max: 100000 }), { minLength: 30, maxLength: 100 }),
        fc.integer({ min: 5, max: 20 }),
        (prices, period) => {
          const sma = engine.calculateSMA(prices, period);
          const lastSMA = sma[sma.length - 1];
          const lastPrices = prices.slice(-period);
          const expectedMean = lastPrices.reduce((a, b) => a + b, 0) / period;
          return Math.abs(lastSMA - expectedMean) < 0.0001;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property Tests: Risk Analysis', () => {
  /**
   * Feature: ai-forecasting-risk-analysis, Property 15: Risk Score Bounds
   * For any risk analysis, the calculated risk score should be between 0 and 100.
   */
  it('risk score should always be between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 1, max: 100000 }), { minLength: 30, maxLength: 100 }),
        (prices) => {
          const candlesticks = prices.map((price, i) => ({
            timestamp: Date.now() - (prices.length - i) * 86400000,
            open: price,
            high: price * 1.02,
            low: price * 0.98,
            close: price,
            volume: 1000000
          }));
          const indicators = engine.calculateAllIndicators(candlesticks);
          const riskAnalysis = riskAnalyzer.analyzeRisk(candlesticks, indicators);
          return riskAnalysis.riskScore >= 0 && riskAnalysis.riskScore <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: ai-forecasting-risk-analysis, Property 16: Risk Classification Correctness
   * For any risk score, the classification should match the defined thresholds.
   */
  it('risk classification should match score thresholds', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100 }),
        (riskScore) => {
          const classification = classifyRisk(riskScore);
          if (riskScore > 70) {
            return classification === 'High Risk';
          } else if (riskScore >= 40) {
            return classification === 'Medium Risk';
          } else {
            return classification === 'Low Risk';
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property Tests: Forecasting', () => {
  /**
   * Feature: ai-forecasting-risk-analysis, Property 12: Forecast Completeness
   * For any forecast request, the generated forecast should include all required fields.
   */
  it('forecast should include all required time horizons and fields', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 1, max: 100000 }), { minLength: 90, maxLength: 100 }),
        (prices) => {
          const candlesticks = prices.map((price, i) => ({
            timestamp: Date.now() - (prices.length - i) * 86400000,
            open: price,
            high: price * 1.02,
            low: price * 0.98,
            close: price,
            volume: 1000000
          }));
          const indicators = engine.calculateAllIndicators(candlesticks);
          const forecasts = forecastGenerator.generateForecasts({
            currentPrice: prices[prices.length - 1],
            candlesticks,
            indicators
          });
          
          const hasAllHorizons = forecasts.length === 3 &&
            forecasts.some(f => f.timeHorizon === '24h') &&
            forecasts.some(f => f.timeHorizon === '7d') &&
            forecasts.some(f => f.timeHorizon === '30d');
          
          const allHaveRequiredFields = forecasts.every(f =>
            f.predictedPrice.low !== undefined &&
            f.predictedPrice.mid !== undefined &&
            f.predictedPrice.high !== undefined &&
            f.confidenceLevel >= 0 && f.confidenceLevel <= 100 &&
            ['bullish', 'bearish', 'neutral'].includes(f.trend)
          );
          
          return hasAllHorizons && allHaveRequiredFields;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests verify that components work together correctly:

```typescript
describe('Integration: Forecasting Workflow', () => {
  it('should complete full forecasting workflow from API to response', async () => {
    // Setup: Mock Gate.io API responses
    mockGateApi.getCandlesticks.mockResolvedValue(mockCandlestickData);
    mockGateApi.getMarketStats.mockResolvedValue(mockMarketStats);
    
    // Execute: Request forecast
    const response = await request(app)
      .get('/api/forecasting/BTC_USDT')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
    
    // Verify: Response structure and data
    expect(response.body.success).toBe(true);
    expect(response.body.data.forecasts).toHaveLength(3);
    expect(response.body.data.riskAnalysis).toBeDefined();
    expect(response.body.data.technicalIndicators).toBeDefined();
    
    // Verify: Data was cached
    const cached = await prisma.forecastCache.findFirst({
      where: { symbol: 'BTC_USDT' }
    });
    expect(cached).toBeDefined();
  });
});
```

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 80% code coverage
- **Property Test Coverage**: All correctness properties from design document
- **Integration Test Coverage**: All major user workflows
- **Edge Case Coverage**: All identified edge cases and error conditions

### Continuous Testing

- Tests run automatically on every commit via CI/CD pipeline
- Property tests run with increased iterations (1000+) in nightly builds
- Performance tests run weekly to ensure forecast generation stays under 5 seconds
- Integration tests run against staging environment before production deployment
