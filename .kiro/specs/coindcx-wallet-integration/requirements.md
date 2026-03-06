# CoinDCX Wallet Integration - Requirements

## Feature Overview
Integrate CoinDCX exchange API to allow users to connect their CoinDCX accounts and track their exchange holdings alongside their existing Web3 wallets (MetaMask, WalletConnect, Coinbase).

## User Stories

### 1. As a user, I want to connect my CoinDCX account
**Acceptance Criteria:**
- User can click "CoinDCX" option in the wallet connection modal
- User is prompted to enter their CoinDCX API credentials (API Key & Secret)
- System validates the credentials with CoinDCX API
- Upon successful validation, the account is linked to the user's profile
- User sees their CoinDCX holdings in the portfolio overview

### 2. As a user, I want to securely store my CoinDCX API credentials
**Acceptance Criteria:**
- API credentials are encrypted before storage in the database
- Credentials are never exposed in API responses
- Only the backend can decrypt and use the credentials
- User can update or remove their API credentials at any time

### 3. As a user, I want to see my CoinDCX holdings in real-time
**Acceptance Criteria:**
- CoinDCX balances are fetched and displayed in the portfolio
- Holdings are updated every 30 seconds (matching existing refresh rate)
- CoinDCX assets are aggregated with Web3 wallet assets
- Each asset shows which source it came from (CoinDCX vs blockchain wallet)

### 4. As a user, I want to manage multiple exchange accounts
**Acceptance Criteria:**
- User can connect multiple CoinDCX accounts (e.g., personal, trading)
- Each account can have a nickname for easy identification
- User can view balances for each account separately
- User can remove individual accounts

### 5. As a user, I want to see my CoinDCX transaction history
**Acceptance Criteria:**
- System fetches and displays recent trades from CoinDCX
- Transactions are categorized (buy, sell, deposit, withdrawal)
- Transaction history is integrated with existing transaction tracking
- P&L calculations include CoinDCX trades

## Technical Requirements

### 1. CoinDCX API Integration
- Implement CoinDCX REST API client
- Support authentication using API Key & Secret
- Implement rate limiting and error handling
- Cache responses to minimize API calls

### 2. Database Schema
- Add `ExchangeAccount` table to store exchange connections
- Fields: id, userId, provider (coindcx), apiKey (encrypted), apiSecret (encrypted), nickname, isActive, createdAt, updatedAt
- Add `ExchangeBalance` table for caching exchange balances
- Add `ExchangeTrade` table for storing trade history

### 3. Security
- Use AES-256 encryption for API credentials
- Store encryption key in environment variables
- Implement secure credential validation
- Add audit logging for credential access

### 4. Backend API Endpoints
- POST `/api/exchange/connect` - Connect exchange account
- GET `/api/exchange/accounts` - List connected accounts
- DELETE `/api/exchange/accounts/:id` - Remove account
- GET `/api/exchange/balances/:id` - Get account balances
- GET `/api/exchange/trades/:id` - Get trade history
- PUT `/api/exchange/accounts/:id` - Update account (nickname, credentials)

### 5. Frontend Components
- Add CoinDCX option to wallet connection modal
- Create CoinDCX credentials input form
- Update portfolio display to show exchange holdings
- Add exchange account management UI
- Display exchange source badges on assets

## CoinDCX API Endpoints to Use

### Authentication
- All requests require `X-AUTH-APIKEY` and `X-AUTH-SIGNATURE` headers

### Balance Endpoints
- `GET /exchange/v1/users/balances` - Get all balances
- `GET /exchange/v1/users/balance_info` - Get detailed balance info

### Trade History
- `GET /exchange/v1/orders/trade_history` - Get trade history
- `GET /exchange/v1/orders/active_orders` - Get active orders

### Market Data
- `GET /exchange/ticker` - Get current prices
- `GET /market_data/candles` - Get historical data

## Non-Functional Requirements

### Performance
- API credential encryption/decryption < 100ms
- Balance fetching < 2 seconds
- Support up to 10 exchange accounts per user

### Security
- All API credentials encrypted at rest
- HTTPS only for all API communications
- Rate limiting: 10 requests per minute per user
- Audit logging for all credential operations

### Reliability
- Graceful handling of CoinDCX API downtime
- Retry logic with exponential backoff
- Fallback to cached data when API unavailable
- Clear error messages for users

## Out of Scope (Future Enhancements)
- Trading functionality (buy/sell through the app)
- Multiple exchange support (Binance, WazirX, etc.)
- Automated tax reporting
- Advanced order types
- Portfolio rebalancing recommendations

## Dependencies
- CoinDCX API access (requires user to have CoinDCX account)
- Encryption library (crypto-js or similar)
- Existing authentication system (Clerk)
- Existing database (PostgreSQL with Prisma)

## Risks & Mitigations

### Risk: API Key Compromise
**Mitigation:** 
- Encrypt all credentials
- Implement read-only API key recommendations
- Add 2FA for credential management
- Regular security audits

### Risk: CoinDCX API Rate Limits
**Mitigation:**
- Implement aggressive caching (5-minute cache)
- Queue requests with rate limiting
- Batch operations where possible
- Show cached data with timestamp

### Risk: API Downtime
**Mitigation:**
- Implement circuit breaker pattern
- Show cached data during outages
- Display clear status indicators
- Graceful degradation

## Success Metrics
- 80% of users successfully connect CoinDCX account on first attempt
- < 5% error rate for balance fetching
- < 2 second average response time for balance queries
- Zero security incidents related to credential storage
