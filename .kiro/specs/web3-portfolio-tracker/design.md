# Design Document: Web3 Portfolio Tracker

## Overview

The Web3 Portfolio Tracker is a full-stack application that enables users to track their cryptocurrency holdings across multiple blockchain networks. The system uses a non-custodial approach, connecting to users' existing wallets via MetaMask and WalletConnect, and aggregating balance data from multiple chains (Ethereum, Polygon, BSC).

The architecture follows a client-server model with:
- **Frontend**: Next.js 15 with React, TypeScript, and TailwindCSS
- **Backend**: Node.js with Express and TypeScript
- **Database**: PostgreSQL for persistent storage
- **Cache**: Redis for high-performance caching
- **Blockchain**: Direct RPC connections via ethers.js v6
- **AI**: Integration with OpenAI/Anthropic for portfolio analysis

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Next.js    │  │  Web3 Wallet │  │   Zustand    │      │
│  │   Pages      │  │  Integration │  │    Store     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Service │  │   Wallet     │  │  Portfolio   │      │
│  │    (SIWE)    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Blockchain  │  │    Price     │  │  AI Engine   │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │ Postgres│         │  Redis  │         │   RPC   │
    │   DB    │         │  Cache  │         │ Nodes   │
    └─────────┘         └─────────┘         └─────────┘
```

### Technology Stack

**Frontend:**
- Next.js 15 (App Router)
- React 18
- TypeScript 5
- TailwindCSS 4
- ethers.js v6
- WalletConnect v2
- Recharts (for visualizations)
- Zustand (state management)

**Backend:**
- Node.js 18+
- Express 5
- TypeScript 5
- Prisma ORM
- ethers.js v6
- SIWE (Sign-In with Ethereum)
- ioredis (Redis client)
- axios (HTTP client)

**Infrastructure:**
- PostgreSQL 14+ (persistent storage)
- Redis 7+ (caching layer)
- Alchemy/Infura (RPC providers)
- CoinGecko/CoinMarketCap (price data)

## Components and Interfaces

### 1. Authentication Service

**Purpose:** Handle wallet-based authentication using SIWE protocol.

**Key Functions:**
- `generateNonce(address: string): Promise<string>` - Generate unique nonce for SIWE
- `verifySignature(message: string, signature: string): Promise<User>` - Verify SIWE signature
- `issueTokens(userId: string): Promise<{accessToken, refreshToken}>` - Issue JWT tokens
- `refreshAccessToken(refreshToken: string): Promise<string>` - Refresh expired access token
- `revokeSession(sessionId: string): Promise<void>` - Invalidate session

**Data Flow:**
1. User connects wallet → Frontend requests nonce
2. Backend generates nonce → Stores in Redis (5 min TTL)
3. User signs SIWE message → Frontend sends signature
4. Backend verifies signature → Creates/retrieves user
5. Backend issues JWT tokens → Stores refresh token in DB
6. Frontend stores tokens → Uses for authenticated requests

### 2. Wallet Service

**Purpose:** Manage user wallet connections and metadata.

**Key Functions:**
- `addWallet(userId, address, provider, chains): Promise<Wallet>` - Add new wallet
- `getWallets(userId): Promise<Wallet[]>` - Get all user wallets
- `updateWallet(walletId, updates): Promise<Wallet>` - Update wallet metadata
- `removeWallet(walletId): Promise<void>` - Remove wallet
- `validateAddress(address, chain): boolean` - Validate wallet address format

**Database Schema:**
```typescript
model Wallet {
  id: string (UUID)
  userId: string (FK to User)
  address: string
  provider: string // "metamask" | "walletconnect"
  chainTypes: string[] // ["ethereum", "polygon", "bsc"]
  nickname: string?
  isActive: boolean
  createdAt: DateTime
}
```

### 3. Blockchain Service

**Purpose:** Interact with blockchain networks to fetch balances and transaction data.

**Key Functions:**
- `getNativeBalance(chain, address): Promise<TokenBalance>` - Get native token balance
- `getTokenBalance(chain, tokenAddress, walletAddress): Promise<TokenBalance>` - Get ERC-20 balance
- `getChainBalances(chain, address): Promise<ChainBalance>` - Get all balances for a chain
- `getMultiChainBalances(address, chains): Promise<ChainBalance[]>` - Get balances across chains
- `getTransactions(chain, address, limit): Promise<Transaction[]>` - Get transaction history

**RPC Resilience:**
- Circuit breaker pattern (5 failures → 60s cooldown)
- Exponential backoff (1s, 2s, 4s, 8s, 10s max)
- Retry wrapper for all RPC calls
- Fallback to alternative RPC endpoints

**Interfaces:**
```typescript
interface TokenBalance {
  symbol: string
  name: string
  balance: string
  decimals: number
  contractAddress?: string
  valueUsd?: number
}

interface ChainBalance {
  chain: string
  chainId: number
  nativeBalance: TokenBalance
  tokens: TokenBalance[]
  totalValueUsd: number
}
```

### 4. Token Discovery Service

**Purpose:** Automatically detect tokens held by a wallet.

**Key Functions:**
- `discoverTokens(chain, address): Promise<TokenInfo[]>` - Discover all tokens
- `discoverWithCovalent(chainId, address): Promise<TokenInfo[]>` - Use Covalent API
- `discoverWithMoralis(chain, address): Promise<TokenInfo[]>` - Use Moralis API
- `discoverPopularTokens(chain, address): Promise<TokenInfo[]>` - Check popular tokens

**Discovery Strategy:**
1. Try Covalent API (comprehensive, verified tokens)
2. Fallback to Moralis API (good coverage)
3. Fallback to popular token list (USDT, USDC, DAI, etc.)
4. Cache results for 5 minutes
5. Filter out zero balances

### 5. Price Service

**Purpose:** Fetch and cache cryptocurrency prices from multiple providers.

**Key Functions:**
- `getTokenPrice(symbol): Promise<TokenPrice>` - Get single token price
- `getBulkPrices(symbols): Promise<Record<symbol, price>>` - Get multiple prices
- `calculateUsdValue(balance, price): number` - Calculate USD value
- `getProviderHealth(): Promise<Record<provider, boolean>>` - Check provider status

**Provider Fallback Chain:**
1. CoinGecko (free tier, good coverage)
2. CoinMarketCap (requires API key, comprehensive)
3. CryptoCompare (free tier, decent coverage)
4. Binance (for major pairs, real-time)

**Caching Strategy:**
- Redis cache: 5 minutes TTL
- PostgreSQL cache: Backup for Redis misses
- Stale-while-revalidate: Serve cached while fetching fresh

### 6. Portfolio Service

**Purpose:** Aggregate and calculate portfolio data.

**Key Functions:**
- `aggregatePortfolio(userId): Promise<PortfolioData>` - Calculate full portfolio
- `generateSnapshot(userId): Promise<void>` - Save portfolio snapshot
- `getLatestSnapshot(userId): Promise<Snapshot>` - Get most recent snapshot
- `getHistoricalSnapshots(userId, days): Promise<Snapshot[]>` - Get historical data

**Aggregation Logic:**
1. Fetch all active wallets for user
2. For each wallet, get balances across selected chains
3. Discover tokens for each wallet/chain combination
4. Fetch prices for all unique assets
5. Calculate USD values for each asset
6. Group assets by symbol across chains
7. Calculate total portfolio value
8. Sort assets by value descending

**Interfaces:**
```typescript
interface PortfolioData {
  totalValueUsd: number
  wallets: WalletData[]
  assets: AssetSummary[]
  lastUpdated: Date
}

interface AssetSummary {
  symbol: string
  name: string
  totalBalance: string
  valueUsd: number
  chains: ChainAsset[]
}
```

### 7. AI Analysis Service

**Purpose:** Provide AI-powered portfolio insights and recommendations.

**Key Functions:**
- `analyzeDiversification(portfolio): Promise<DiversificationAnalysis>` - Analyze concentration risk
- `calculateRiskScore(portfolio, historicalData): Promise<RiskAnalysis>` - Calculate portfolio risk
- `forecastValue(portfolio, historicalData, days): Promise<Forecast>` - Predict future value
- `generateRecommendations(portfolio, analysis): Promise<Recommendation[]>` - Suggest actions

**AI Integration:**
- Use OpenAI GPT-4 or Anthropic Claude for analysis
- Provide portfolio data as structured context
- Request specific analysis types (diversification, risk, forecast)
- Parse and validate AI responses
- Cache analysis results for 1 hour

**Analysis Types:**

**Diversification Analysis:**
- Calculate Herfindahl-Hirschman Index (HHI) for concentration
- Identify over-concentrated positions (>30% of portfolio)
- Suggest rebalancing to target allocation
- Consider correlation between assets

**Risk Analysis:**
- Calculate portfolio volatility (standard deviation of returns)
- Use 30-day historical price data
- Calculate Value at Risk (VaR) at 95% confidence
- Classify risk level (Low, Medium, High)

**Forecasting:**
- Use time series analysis (ARIMA or similar)
- Generate 7-day, 30-day, 90-day forecasts
- Provide confidence intervals
- Consider market trends and correlations

### 8. WebSocket Service

**Purpose:** Enable real-time portfolio updates.

**Key Functions:**
- `handleConnection(socket, userId): void` - Handle new WebSocket connection
- `broadcastPriceUpdate(symbol, price): void` - Broadcast price changes
- `broadcastPortfolioUpdate(userId, portfolio): void` - Send portfolio updates
- `handleDisconnection(socket): void` - Clean up on disconnect

**Update Strategy:**
- Subscribe to price feeds for user's assets
- Push updates when prices change >0.5%
- Throttle updates to max 1 per second per user
- Fallback to polling if WebSocket unavailable

### 9. Transaction Service

**Purpose:** Track and categorize blockchain transactions.

**Key Functions:**
- `fetchTransactions(chain, address, fromBlock): Promise<Transaction[]>` - Fetch from blockchain
- `categorizeTransaction(tx): TransactionType` - Categorize transaction type
- `storeTransactions(transactions): Promise<void>` - Store in database
- `getTransactionHistory(walletId, filters): Promise<Transaction[]>` - Query transactions

**Transaction Categories:**
- **Receive**: Incoming transfers
- **Send**: Outgoing transfers
- **Swap**: DEX trades
- **Contract**: Smart contract interactions

## Data Models

### User Model
```typescript
model User {
  id: string (UUID)
  mainAddress: string (unique)
  createdAt: DateTime
  updatedAt: DateTime
  
  wallets: Wallet[]
  sessions: Session[]
  snapshots: PortfolioSnapshot[]
}
```

### Session Model
```typescript
model Session {
  id: string (UUID)
  userId: string (FK)
  refreshToken: string (unique)
  deviceInfo: string?
  ipAddress: string?
  expiresAt: DateTime
  createdAt: DateTime
}
```

### Wallet Model
```typescript
model Wallet {
  id: string (UUID)
  userId: string (FK)
  address: string
  provider: string
  chainTypes: string[]
  nickname: string?
  isActive: boolean
  createdAt: DateTime
  
  transactions: Transaction[]
}
```

### Transaction Model
```typescript
model Transaction {
  id: string (UUID)
  walletId: string (FK)
  txHash: string (unique)
  type: string
  asset: string
  amount: number
  priceUsd: number?
  timestamp: DateTime
  blockNumber: number?
  fromAddress: string?
  toAddress: string?
  chain: string
  createdAt: DateTime
}
```

### PortfolioSnapshot Model
```typescript
model PortfolioSnapshot {
  id: string (UUID)
  userId: string (FK)
  totalValueUsd: number
  breakdown: JSON
  generatedAt: DateTime
}
```

### PriceCache Model
```typescript
model PriceCache {
  id: string (UUID)
  symbol: string (unique)
  priceUsd: number
  updatedAt: DateTime
}
```

### TokenPrice Model
```typescript
model TokenPrice {
  id: string (UUID)
  tokenId: string (unique)
  symbol: string
  name: string
  priceUsd: number
  change24h: number?
  marketCap: number?
  volume24h: number?
  updatedAt: DateTime
  createdAt: DateTime
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I've identified several areas where properties can be consolidated:

**Fallback Chain Properties:** Requirements 4.1-4.3 (token discovery fallback) and 5.1-5.4 (price provider fallback) follow the same pattern. These can be combined into general fallback chain properties.

**Caching Properties:** Requirements 3.6, 4.6, 5.5 all specify 5-minute caching. These can be combined into a general caching property.

**Data Completeness Properties:** Multiple requirements (2.5, 4.7, 6.7, 8.3, 8.6) specify that certain fields must be present. These can be combined into properties about data completeness for specific entities.

**Filtering Properties:** Requirements 2.8, 4.4, 7.3, 8.7 all involve filtering data. These can be combined into properties about correct filtering behavior.

**Calculation Properties:** Requirements 6.3, 6.4, 11.1, 11.6, 12.2 involve calculations. These should remain separate as they test different calculation types.

### Core Properties

Property 1: SIWE Signature Verification
*For any* SIWE message and signature pair, the system should verify the signature cryptographically and accept valid signatures while rejecting invalid ones
**Validates: Requirements 1.6**

Property 2: Session Token Lifecycle
*For any* valid authentication, the system should issue JWT tokens, store the refresh token in the database, allow token refresh when expired, and invalidate all tokens on logout
**Validates: Requirements 1.7, 1.8, 1.9, 1.10**

Property 3: Wallet Address Validation
*For any* wallet address input, the system should correctly identify valid Ethereum-compatible addresses (0x followed by 40 hex characters) and reject invalid formats
**Validates: Requirements 2.1**

Property 4: Wallet Data Persistence
*For any* wallet addition with selected chains, the system should store the wallet with all chain associations preserved, and retrieval should return the exact same associations
**Validates: Requirements 2.3**

Property 5: Active Wallet Filtering
*For any* portfolio calculation, only wallets marked as active should be included, and inactive wallets should be completely excluded from all calculations
**Validates: Requirements 2.8**

Property 6: Multi-Chain Balance Completeness
*For any* wallet with multiple selected chains, the system should fetch native balances and discover tokens for all selected chains without omission
**Validates: Requirements 3.1, 3.2, 3.3**

Property 7: RPC Circuit Breaker Resilience
*For any* RPC call, if it fails, the system should apply circuit breaker logic and retry with exponential backoff (1s, 2s, 4s, 8s, 10s max)
**Validates: Requirements 3.4, 3.5**

Property 8: Cache-First Strategy
*For any* balance request, if cached data exists and is less than 5 minutes old, the system should serve cached data unless refresh is explicitly requested
**Validates: Requirements 3.6, 3.7, 3.8**

Property 9: Provider Fallback Chain
*For any* external API request (token discovery or price fetching), if the primary provider fails, the system should try each fallback provider in priority order until one succeeds or all fail
**Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4**

Property 10: Zero Balance Filtering
*For any* token discovery result, tokens with zero balance should be filtered out before returning the list to the user
**Validates: Requirements 4.4**

Property 11: Verified Token Prioritization
*For any* token list, verified tokens should appear before unverified tokens when sorted
**Validates: Requirements 4.5**

Property 12: Price Cache Dual-Layer
*For any* price fetch, the result should be cached in both Redis (5 min TTL) and PostgreSQL (backup), and cache should be checked before making external API calls
**Validates: Requirements 5.5, 5.6, 5.8**

Property 13: Bulk Price Optimization
*For any* request requiring multiple prices, if more than 3 prices are needed, the system should use bulk API endpoints instead of individual requests
**Validates: Requirements 5.7**

Property 14: Asset Grouping Across Chains
*For any* portfolio aggregation, assets with the same symbol appearing on different chains should be grouped together with combined balance and value
**Validates: Requirements 6.1, 6.2**

Property 15: Portfolio Value Calculation
*For any* portfolio, the total value should equal the sum of all individual asset values, and each asset value should equal balance multiplied by current price
**Validates: Requirements 6.3, 6.4**

Property 16: Asset Sorting by Value
*For any* asset list display, assets should be sorted in descending order by USD value
**Validates: Requirements 6.6**

Property 17: Snapshot Data Completeness
*For any* portfolio snapshot saved to the database, it should include total value, complete asset breakdown, wallet details, and generation timestamp
**Validates: Requirements 7.1, 7.2**

Property 18: Historical Snapshot Filtering
*For any* time period query, the system should return only snapshots with timestamps within the requested range
**Validates: Requirements 7.3**

Property 19: Automatic Snapshot Scheduling
*For any* 6-hour period when the scheduler is enabled, the system should create exactly one portfolio snapshot
**Validates: Requirements 7.6**

Property 20: Transaction Categorization
*For any* blockchain transaction, the system should assign exactly one category (receive, send, swap, or contract) based on transaction characteristics
**Validates: Requirements 8.2**

Property 21: Transaction Data Completeness
*For any* stored transaction, it should include transaction hash, amount, asset, timestamp, and addresses (from/to)
**Validates: Requirements 8.3, 8.6**

Property 22: Transaction Chronological Ordering
*For any* transaction list display, transactions should be sorted by timestamp in descending order (most recent first)
**Validates: Requirements 8.4**

Property 23: AI Analysis Completeness
*For any* portfolio analysis request, the AI engine should provide diversification analysis, risk score, volatility calculation, and forecasts for 7, 30, and 90 days
**Validates: Requirements 9.1, 9.3, 9.5, 9.7, 9.8**

Property 24: Concentration Risk Detection
*For any* portfolio where a single asset represents more than 30% of total value, the system should identify it as over-concentrated
**Validates: Requirements 9.2**

Property 25: Volatility Calculation Window
*For any* volatility calculation, the system should use exactly 30 days of historical price data
**Validates: Requirements 9.4**

Property 26: WebSocket Connection Lifecycle
*For any* dashboard view, the system should establish a WebSocket connection, push updates when data changes, and close the connection when the user navigates away
**Validates: Requirements 10.1, 10.2, 10.3, 10.5**

Property 27: WebSocket Fallback to Polling
*For any* WebSocket connection failure, the system should automatically fallback to polling every 30 seconds
**Validates: Requirements 10.4**

Property 28: Performance Metrics Calculation
*For any* metrics display, the system should calculate 24-hour, 7-day, and 30-day performance by comparing current portfolio value to historical values at those time points
**Validates: Requirements 11.1, 11.2, 11.3**

Property 29: Performance Format Completeness
*For any* performance metric, the system should display both percentage change and absolute dollar change
**Validates: Requirements 11.4**

Property 30: Allocation Percentage Sum
*For any* asset allocation calculation, the sum of all asset percentages should equal 100% (within 0.01% tolerance for rounding)
**Validates: Requirements 12.2**

Property 31: Circuit Breaker Cooldown
*For any* circuit breaker that opens due to failures, the system should wait at least 60 seconds before attempting to close the circuit
**Validates: Requirements 13.1, 13.2**

Property 32: Cache Fallback on API Failure
*For any* external API failure, if cached data exists (even if stale), the system should serve the cached data rather than returning an error
**Validates: Requirements 13.3**

Property 33: Private Key Prohibition
*For any* data storage operation, the system should never store private keys, seed phrases, or any data that could be used to sign transactions
**Validates: Requirements 14.1**

Property 34: API Key Encryption
*For any* API key or secret stored in the database, it should be encrypted using AES-256-GCM before storage and decrypted only when needed
**Validates: Requirements 14.2**

Property 35: JWT Signature Validation
*For any* authenticated API request, the system should validate the JWT signature and reject requests with invalid or expired tokens
**Validates: Requirements 14.4**

Property 36: Rate Limit Enforcement
*For any* API endpoint, the system should enforce rate limits and reject requests that exceed the configured threshold with a 429 status code
**Validates: Requirements 14.6**

Property 37: Sensitive Data Filtering in Logs
*For any* log entry, the system should filter out sensitive data including private keys, passwords, API keys, and full JWT tokens
**Validates: Requirements 14.7**

Property 38: Number Formatting with Separators
*For any* number display greater than 999, the system should format it with thousand separators (commas or locale-appropriate)
**Validates: Requirements 15.5**

Property 39: Address Truncation
*For any* Ethereum address display, addresses longer than 20 characters should be truncated to show first 6 and last 4 characters with ellipsis (e.g., 0x1234...5678)
**Validates: Requirements 15.6**



## Error Handling

### Error Categories

**1. Blockchain RPC Errors**
- Network timeouts
- Rate limiting
- Invalid responses
- Node unavailability

**Handling Strategy:**
- Circuit breaker pattern (5 failures → 60s cooldown → 5min max)
- Exponential backoff retry (1s, 2s, 4s, 8s, 10s max)
- Fallback to alternative RPC endpoints
- Cache stale data as last resort

**2. External API Errors**
- Price provider failures
- Token discovery service failures
- Rate limit exceeded

**Handling Strategy:**
- Provider fallback chain (try all providers in order)
- Serve cached data if available (even if stale)
- Log provider health status
- Alert on sustained failures

**3. Authentication Errors**
- Invalid signatures
- Expired tokens
- Missing tokens
- Invalid nonce

**Handling Strategy:**
- Return 401 Unauthorized with clear error message
- Prompt user to reconnect wallet
- Clear invalid tokens from storage
- Generate new nonce for retry

**4. Database Errors**
- Connection failures
- Query timeouts
- Constraint violations
- Transaction deadlocks

**Handling Strategy:**
- Connection pooling with retry
- Query timeout of 30 seconds
- Graceful degradation (serve cached data)
- Log errors for monitoring

**5. Validation Errors**
- Invalid wallet addresses
- Invalid chain selections
- Invalid input formats

**Handling Strategy:**
- Return 400 Bad Request with validation details
- Client-side validation to prevent submission
- Clear error messages for users
- Log validation failures for analysis

### Error Response Format

```typescript
interface ErrorResponse {
  error: string // User-friendly message
  code: string // Error code for client handling
  details?: any // Additional context (dev mode only)
  timestamp: string
}
```

### Logging Strategy

**Log Levels:**
- **ERROR**: Critical failures requiring immediate attention
- **WARN**: Recoverable errors, fallback activations
- **INFO**: Normal operations, API calls, user actions
- **DEBUG**: Detailed execution flow (dev only)

**Logged Information:**
- Timestamp
- Request ID (for tracing)
- User ID (if authenticated)
- Error message and stack trace
- Request context (endpoint, params)
- Never log: private keys, passwords, full JWT tokens, API secrets

## Testing Strategy

### Dual Testing Approach

The system will use both **unit tests** and **property-based tests** to ensure comprehensive coverage:

**Unit Tests:**
- Test specific examples and edge cases
- Verify integration points between components
- Test error conditions and boundary values
- Mock external dependencies (RPC, APIs)
- Fast execution for rapid feedback

**Property-Based Tests:**
- Verify universal properties across all inputs
- Generate random test data (addresses, balances, prices)
- Test with 100+ iterations per property
- Catch edge cases not considered in unit tests
- Validate correctness properties from design

### Testing Framework

**Backend:**
- **Jest** for unit testing
- **fast-check** for property-based testing
- **Supertest** for API endpoint testing
- **Prisma** test database for integration tests

**Frontend:**
- **Jest** for unit testing
- **React Testing Library** for component testing
- **fast-check** for property-based testing
- **MSW** (Mock Service Worker) for API mocking

### Property Test Configuration

Each property test must:
- Run minimum 100 iterations (due to randomization)
- Reference its design document property number
- Use tag format: `Feature: web3-portfolio-tracker, Property {N}: {property_text}`
- Generate realistic test data (valid addresses, reasonable balances)
- Clean up test data after execution

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 80% code coverage
- **Property Test Coverage**: All 39 correctness properties implemented
- **Integration Test Coverage**: All API endpoints tested
- **E2E Test Coverage**: Critical user flows (connect wallet, view portfolio, refresh data)

### Test Data Generation

**For Property Tests:**
```typescript
// Example generators
const arbitraryEthAddress = fc.hexaString({ minLength: 40, maxLength: 40 })
  .map(hex => `0x${hex}`)

const arbitraryBalance = fc.double({ min: 0, max: 1000000 })

const arbitraryTokenSymbol = fc.constantFrom('ETH', 'USDT', 'USDC', 'DAI', 'WBTC')

const arbitraryChain = fc.constantFrom('ethereum', 'polygon', 'bsc')
```

### Mocking Strategy

**Mock External Services:**
- RPC endpoints (use local test responses)
- Price APIs (return fixed test prices)
- Token discovery APIs (return predefined token lists)
- AI services (return mock analysis results)

**Do Not Mock:**
- Database operations (use test database)
- Internal service calls
- Business logic
- Validation functions

### Continuous Integration

**CI Pipeline:**
1. Lint code (ESLint, Prettier)
2. Type check (TypeScript)
3. Run unit tests
4. Run property tests
5. Run integration tests
6. Check coverage thresholds
7. Build application
8. Deploy to staging (on main branch)

**Test Execution Time:**
- Unit tests: < 30 seconds
- Property tests: < 2 minutes
- Integration tests: < 1 minute
- Total CI time: < 5 minutes

## Implementation Notes

### Performance Considerations

**1. Caching Strategy**
- Redis for hot data (5 min TTL)
- PostgreSQL for cold data (backup cache)
- Stale-while-revalidate pattern
- Cache invalidation on user-triggered refresh

**2. Database Optimization**
- Indexes on frequently queried fields (userId, address, symbol, timestamp)
- Connection pooling (max 20 connections)
- Query timeout of 30 seconds
- Batch inserts for snapshots and transactions

**3. API Rate Limiting**
- General: 100 requests/minute per IP
- Auth endpoints: 10 requests/minute per IP
- Wallet endpoints: 30 requests/minute per user
- Portfolio endpoints: 20 requests/minute per user

**4. Frontend Optimization**
- Code splitting by route
- Lazy loading for charts and heavy components
- Debounce user inputs (300ms)
- Virtualized lists for large datasets
- Image optimization for token logos

### Security Considerations

**1. Authentication**
- SIWE for wallet-based auth
- JWT with short expiry (15 min access, 7 day refresh)
- Secure token storage (httpOnly cookies or secure localStorage)
- CSRF protection for state-changing operations

**2. Data Protection**
- AES-256-GCM for API key encryption
- HTTPS only (no HTTP fallback)
- Secure headers (Helmet.js)
- CORS restricted to frontend domain

**3. Input Validation**
- Validate all user inputs
- Sanitize addresses and symbols
- Prevent SQL injection (use Prisma parameterized queries)
- Prevent XSS (React auto-escaping + DOMPurify for rich content)

**4. Rate Limiting**
- Per-IP rate limiting
- Per-user rate limiting (authenticated)
- Exponential backoff on repeated failures
- Temporary bans for abuse

### Deployment Architecture

**Production Setup:**
```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                           │
│                     (HTTPS/WSS)                              │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼───────┐
│   Frontend     │                    │   Backend API  │
│   (Vercel)     │                    │   (Railway)    │
│   Next.js      │                    │   Express      │
└────────────────┘                    └────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼────────┐        ┌──────▼──────┐        ┌────────▼────────┐
            │   PostgreSQL   │        │    Redis    │        │   RPC Nodes     │
            │   (Neon)       │        │  (Upstash)  │        │  (Alchemy)      │
            └────────────────┘        └─────────────┘        └─────────────────┘
```

**Environment Variables:**
```bash
# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
REFRESH_TOKEN_SECRET=...
ENCRYPTION_KEY=... (32 bytes)
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/...
BSC_RPC_URL=https://bsc-dataseed.binance.org/
COINGECKO_API_KEY=...
COINMARKETCAP_API_KEY=...
OPENAI_API_KEY=... (for AI analysis)
FRONTEND_URL=https://...

# Frontend
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

### Monitoring and Observability

**Metrics to Track:**
- API response times (p50, p95, p99)
- RPC call success/failure rates
- Cache hit/miss rates
- Active WebSocket connections
- Database query performance
- External API health status
- User authentication success rate

**Alerting Thresholds:**
- API response time > 2 seconds (p95)
- RPC failure rate > 20%
- Cache miss rate > 50%
- Database connection pool exhaustion
- External API downtime > 5 minutes
- Error rate > 5% of requests

**Logging:**
- Structured JSON logs
- Request/response logging (sanitized)
- Error tracking (Sentry or similar)
- Performance monitoring (New Relic or similar)
- User action tracking (analytics)

## Future Enhancements

**Phase 2 Features:**
- NFT portfolio tracking
- DeFi protocol integration (Aave, Compound, Uniswap)
- Cross-chain bridge tracking
- Tax reporting and CSV export
- Mobile app (React Native)
- Push notifications for price alerts
- Social features (share portfolio, leaderboards)

**Phase 3 Features:**
- Advanced AI trading signals
- Automated portfolio rebalancing
- Integration with hardware wallets (Ledger, Trezor)
- Support for additional chains (Avalanche, Arbitrum, Optimism)
- Institutional features (multi-user accounts, permissions)
- API for third-party integrations
