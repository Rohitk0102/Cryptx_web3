# Implementation Plan: Web3 Portfolio Tracker

## Overview

This implementation plan breaks down the Web3 Portfolio Tracker into discrete, incremental tasks. Each task builds on previous work, ensuring no orphaned code. The plan follows a bottom-up approach: core infrastructure → services → API endpoints → frontend → AI integration → real-time features.

## Tasks

- [-] 1. Setup Project Infrastructure and Core Utilities
  - Fix existing project structure and dependencies
  - Setup testing framework (Jest + fast-check)
  - Create shared TypeScript types and interfaces
  - Configure environment variables properly
  - _Requirements: 13.7, 14.3_

- [x] 1.1 Fix Database Schema and Migrations
  - Review and update Prisma schema for completeness
  - Ensure all indexes are properly defined
  - Run migrations to sync database
  - _Requirements: 2.3, 7.1, 8.3_

- [x] 1.2 Write property test for database schema
  - **Property 4: Wallet Data Persistence**
  - **Validates: Requirements 2.3**

- [x] 1.3 Setup Redis Connection with Error Handling
  - Implement Redis client with connection pooling
  - Add reconnection logic
  - Add health check endpoint
  - _Requirements: 3.6, 5.5_

- [x] 1.4 Create Encryption Utility for API Keys
  - Implement AES-256-GCM encryption/decryption
  - Add key rotation support
  - _Requirements: 14.2_

- [x] 1.5 Write property test for encryption utility
  - **Property 34: API Key Encryption**
  - **Validates: Requirements 14.2**

- [ ] 2. Implement Authentication Service (SIWE)
  - [ ] 2.1 Create nonce generation and storage
    - Generate cryptographically secure nonces
    - Store nonces in Redis with 5-minute TTL
    - _Requirements: 1.4_

  - [ ] 2.2 Implement SIWE signature verification
    - Verify SIWE message format
    - Cryptographically verify signature
    - Extract wallet address from signature
    - _Requirements: 1.6_

  - [ ] 2.3 Write property test for signature verification
    - **Property 1: SIWE Signature Verification**
    - **Validates: Requirements 1.6**

  - [ ] 2.4 Implement JWT token issuance and refresh
    - Generate access tokens (15 min expiry)
    - Generate refresh tokens (7 day expiry)
    - Store refresh tokens in database
    - Implement token refresh endpoint
    - _Requirements: 1.7, 1.8, 1.9_

  - [ ] 2.5 Write property test for token lifecycle
    - **Property 2: Session Token Lifecycle**
    - **Validates: Requirements 1.7, 1.8, 1.9, 1.10**

  - [ ] 2.6 Create authentication middleware
    - Validate JWT signatures
    - Extract user from token
    - Handle expired tokens
    - _Requirements: 14.4_

  - [ ] 2.7 Write property test for JWT validation
    - **Property 35: JWT Signature Validation**
    - **Validates: Requirements 14.4**


- [ ] 3. Implement Wallet Management Service
  - [ ] 3.1 Create wallet address validation
    - Validate Ethereum address format (0x + 40 hex chars)
    - Support ENS name resolution
    - _Requirements: 2.1_

  - [ ] 3.2 Write property test for address validation
    - **Property 3: Wallet Address Validation**
    - **Validates: Requirements 2.1**

  - [ ] 3.3 Implement wallet CRUD operations
    - Add wallet with chain selection
    - Update wallet nickname
    - Delete wallet and associated data
    - List user wallets
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.7_

  - [ ] 3.4 Write property test for wallet deletion
    - **Property 7: Wallet data cleanup on deletion**
    - **Validates: Requirements 2.7**

  - [ ] 3.5 Implement active wallet filtering
    - Filter inactive wallets from queries
    - Ensure inactive wallets excluded from portfolio
    - _Requirements: 2.8_

  - [ ] 3.6 Write property test for active wallet filtering
    - **Property 5: Active Wallet Filtering**
    - **Validates: Requirements 2.8**

- [ ] 4. Checkpoint - Ensure authentication and wallet management tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Blockchain Service with Resilience
  - [ ] 5.1 Create RPC provider with retry logic
    - Implement exponential backoff (1s, 2s, 4s, 8s, 10s)
    - Add request timeout (30 seconds)
    - Support multiple RPC endpoints per chain
    - _Requirements: 3.5_

  - [ ] 5.2 Implement circuit breaker pattern
    - Track failure count per RPC endpoint
    - Open circuit after 5 failures
    - Cooldown period of 60 seconds
    - Half-open state for testing recovery
    - _Requirements: 3.4, 13.1, 13.2_

  - [ ] 5.3 Write property test for circuit breaker
    - **Property 7: RPC Circuit Breaker Resilience**
    - **Validates: Requirements 3.4, 3.5**

  - [ ] 5.4 Write property test for circuit breaker cooldown
    - **Property 31: Circuit Breaker Cooldown**
    - **Validates: Requirements 13.1, 13.2**

  - [ ] 5.5 Implement native balance fetching
    - Fetch ETH, MATIC, BNB balances via RPC
    - Handle different decimal formats
    - Apply circuit breaker to all calls
    - _Requirements: 3.1_

  - [ ] 5.6 Implement ERC-20 token balance fetching
    - Query token contract for balance
    - Fetch token metadata (symbol, name, decimals)
    - Handle contract call failures gracefully
    - _Requirements: 3.2_

  - [ ] 5.7 Implement multi-chain balance aggregation
    - Fetch balances across all selected chains in parallel
    - Combine results into unified structure
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 5.8 Write property test for multi-chain completeness
    - **Property 6: Multi-Chain Balance Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 6. Implement Token Discovery Service
  - [ ] 6.1 Create Covalent API integration
    - Query Covalent for token holdings
    - Parse response and extract token info
    - Handle API errors and rate limits
    - _Requirements: 4.1_

  - [ ] 6.2 Create Moralis API integration
    - Query Moralis for token holdings
    - Parse response and extract token info
    - Handle API errors and rate limits
    - _Requirements: 4.2_

  - [ ] 6.3 Create popular token fallback
    - Define list of popular tokens per chain
    - Check balances for popular tokens
    - Return tokens with non-zero balance
    - _Requirements: 4.3_

  - [ ] 6.4 Implement provider fallback chain
    - Try Covalent first
    - Fallback to Moralis on failure
    - Fallback to popular tokens on failure
    - Combine results from all sources
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 6.5 Write property test for provider fallback
    - **Property 9: Provider Fallback Chain**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ] 6.6 Implement zero balance filtering
    - Filter out tokens with balance = 0
    - Apply filter before returning results
    - _Requirements: 4.4_

  - [ ] 6.7 Write property test for zero balance filtering
    - **Property 10: Zero Balance Filtering**
    - **Validates: Requirements 4.4**

  - [ ] 6.8 Implement verified token prioritization
    - Sort tokens with verified=true first
    - Then sort by symbol alphabetically
    - _Requirements: 4.5_

  - [ ] 6.9 Write property test for token prioritization
    - **Property 11: Verified Token Prioritization**
    - **Validates: Requirements 4.5**

  - [ ] 6.10 Add token discovery caching
    - Cache results in Redis for 5 minutes
    - Use cache key: `discovered_tokens:{chain}:{address}`
    - _Requirements: 4.6_

- [ ] 7. Checkpoint - Ensure blockchain and token discovery tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 8. Implement Price Service with Multi-Provider Fallback
  - [ ] 8.1 Create CoinGecko price provider
    - Implement single price fetch
    - Implement bulk price fetch
    - Handle rate limits and errors
    - _Requirements: 5.1_

  - [ ] 8.2 Create CoinMarketCap price provider
    - Implement single price fetch
    - Handle API key authentication
    - Handle rate limits and errors
    - _Requirements: 5.2_

  - [ ] 8.3 Create CryptoCompare price provider
    - Implement single price fetch
    - Handle rate limits and errors
    - _Requirements: 5.3_

  - [ ] 8.4 Create Binance price provider
    - Implement single price fetch for major pairs
    - Map symbols to trading pairs
    - Handle rate limits and errors
    - _Requirements: 5.4_

  - [ ] 8.5 Implement price provider fallback chain
    - Try providers in priority order (CoinGecko → CMC → CryptoCompare → Binance)
    - Return first successful result
    - Log provider health status
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 8.6 Write property test for price provider fallback
    - **Property 9: Provider Fallback Chain** (already tested with token discovery)
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ] 8.7 Implement dual-layer price caching
    - Cache in Redis with 5-minute TTL
    - Store in PostgreSQL as backup
    - Check Redis first, then PostgreSQL, then fetch
    - _Requirements: 5.5, 5.6_

  - [ ] 8.8 Write property test for price caching
    - **Property 12: Price Cache Dual-Layer**
    - **Validates: Requirements 5.5, 5.6, 5.8**

  - [ ] 8.9 Implement bulk price optimization
    - Detect when multiple prices needed (>3)
    - Use bulk endpoints when available
    - Fallback to individual requests if bulk fails
    - _Requirements: 5.7_

  - [ ] 8.10 Write property test for bulk optimization
    - **Property 13: Bulk Price Optimization**
    - **Validates: Requirements 5.7**

  - [ ] 8.11 Implement cache fallback on API failure
    - If all providers fail, check for stale cache
    - Serve stale cache rather than error
    - Log when serving stale data
    - _Requirements: 5.8, 13.3_

  - [ ] 8.12 Write property test for cache fallback
    - **Property 32: Cache Fallback on API Failure**
    - **Validates: Requirements 13.3**

- [ ] 9. Implement Portfolio Aggregation Service
  - [ ] 9.1 Create portfolio aggregation logic
    - Fetch all active wallets for user
    - Get balances for each wallet across chains
    - Discover tokens for each wallet
    - Fetch prices for all unique assets
    - Calculate USD values
    - _Requirements: 6.1, 6.3_

  - [ ] 9.2 Implement asset grouping across chains
    - Group assets by symbol
    - Combine balances from multiple chains
    - Track which chains each asset appears on
    - _Requirements: 6.2_

  - [ ] 9.3 Write property test for asset grouping
    - **Property 14: Asset Grouping Across Chains**
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 9.4 Implement portfolio value calculation
    - Calculate value for each asset (balance * price)
    - Sum all asset values for total
    - Ensure arithmetic correctness
    - _Requirements: 6.4_

  - [ ] 9.5 Write property test for value calculation
    - **Property 15: Portfolio Value Calculation**
    - **Validates: Requirements 6.3, 6.4**

  - [ ] 9.6 Implement asset sorting by value
    - Sort assets in descending order by USD value
    - Apply to all asset lists
    - _Requirements: 6.6_

  - [ ] 9.7 Write property test for asset sorting
    - **Property 16: Asset Sorting by Value**
    - **Validates: Requirements 6.6**

  - [ ] 9.8 Add portfolio caching
    - Cache aggregated portfolio in Redis (5 min)
    - Use cache key: `portfolio:{userId}`
    - Support force refresh flag
    - _Requirements: 3.6, 3.7, 3.8_

  - [ ] 9.9 Write property test for cache strategy
    - **Property 8: Cache-First Strategy**
    - **Validates: Requirements 3.6, 3.7, 3.8**

- [ ] 10. Implement Portfolio Snapshot Service
  - [ ] 10.1 Create snapshot generation
    - Save portfolio data to database
    - Include total value and full breakdown
    - Add timestamp
    - _Requirements: 7.1, 7.2_

  - [ ] 10.2 Write property test for snapshot completeness
    - **Property 17: Snapshot Data Completeness**
    - **Validates: Requirements 7.1, 7.2**

  - [ ] 10.3 Implement historical snapshot queries
    - Query snapshots by time range
    - Filter by user ID
    - Sort by timestamp descending
    - _Requirements: 7.3_

  - [ ] 10.4 Write property test for snapshot filtering
    - **Property 18: Historical Snapshot Filtering**
    - **Validates: Requirements 7.3**

  - [ ] 10.5 Implement automatic snapshot scheduler
    - Create cron job for 6-hour intervals
    - Generate snapshots for all users
    - Handle errors gracefully
    - _Requirements: 7.6_

  - [ ] 10.6 Write property test for snapshot scheduling
    - **Property 19: Automatic Snapshot Scheduling**
    - **Validates: Requirements 7.6**

- [ ] 11. Checkpoint - Ensure portfolio services tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 12. Implement Transaction Tracking Service
  - [ ] 12.1 Create transaction fetching from blockchain
    - Query blockchain explorers (Etherscan, Polygonscan, BSCScan)
    - Parse transaction data
    - Handle pagination
    - _Requirements: 8.1_

  - [ ] 12.2 Implement transaction categorization
    - Categorize as receive, send, swap, or contract
    - Use heuristics based on from/to addresses
    - _Requirements: 8.2_

  - [ ] 12.3 Write property test for transaction categorization
    - **Property 20: Transaction Categorization**
    - **Validates: Requirements 8.2**

  - [ ] 12.4 Implement transaction storage
    - Store with all required fields (hash, amount, asset, timestamp, addresses)
    - Prevent duplicate storage (unique on txHash)
    - _Requirements: 8.3, 8.6_

  - [ ] 12.5 Write property test for transaction data completeness
    - **Property 21: Transaction Data Completeness**
    - **Validates: Requirements 8.3, 8.6**

  - [ ] 12.6 Implement transaction queries
    - Query by wallet ID
    - Sort by timestamp descending
    - Support filtering by type, asset, date range
    - _Requirements: 8.4, 8.7_

  - [ ] 12.7 Write property test for transaction ordering
    - **Property 22: Transaction Chronological Ordering**
    - **Validates: Requirements 8.4**

  - [ ] 12.8 Add historical USD value calculation
    - Fetch historical prices for transaction timestamp
    - Calculate USD value at transaction time
    - Store with transaction
    - _Requirements: 8.5_

- [ ] 13. Implement AI Analysis Service
  - [ ] 13.1 Setup OpenAI/Anthropic API integration
    - Configure API client
    - Implement prompt templates
    - Handle API errors and rate limits
    - _Requirements: 9.1, 9.3, 9.5, 9.7_

  - [ ] 13.2 Implement diversification analysis
    - Calculate Herfindahl-Hirschman Index (HHI)
    - Identify over-concentrated positions (>30%)
    - Generate diversification score
    - _Requirements: 9.1, 9.2_

  - [ ] 13.3 Write property test for concentration detection
    - **Property 24: Concentration Risk Detection**
    - **Validates: Requirements 9.2**

  - [ ] 13.4 Implement risk analysis
    - Fetch 30-day historical price data
    - Calculate portfolio volatility (standard deviation)
    - Calculate Value at Risk (VaR)
    - Generate risk score (Low/Medium/High)
    - _Requirements: 9.3, 9.4_

  - [ ] 13.5 Write property test for volatility calculation window
    - **Property 25: Volatility Calculation Window**
    - **Validates: Requirements 9.4**

  - [ ] 13.6 Implement portfolio forecasting
    - Use time series analysis (ARIMA or AI model)
    - Generate 7-day, 30-day, 90-day forecasts
    - Provide confidence intervals
    - _Requirements: 9.5_

  - [ ] 13.7 Implement recommendation generation
    - Analyze portfolio composition
    - Suggest rebalancing actions
    - Provide rationale for recommendations
    - _Requirements: 9.7_

  - [ ] 13.8 Create unified analysis endpoint
    - Combine diversification, risk, forecast, recommendations
    - Return all insights in single response
    - Cache results for 1 hour
    - _Requirements: 9.8_

  - [ ] 13.9 Write property test for analysis completeness
    - **Property 23: AI Analysis Completeness**
    - **Validates: Requirements 9.1, 9.3, 9.5, 9.7, 9.8**

- [ ] 14. Implement Performance Metrics Service
  - [ ] 14.1 Create performance calculation logic
    - Calculate 24-hour change (current vs 24h ago)
    - Calculate 7-day change
    - Calculate 30-day change
    - Show both percentage and absolute change
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 14.2 Write property test for performance metrics
    - **Property 28: Performance Metrics Calculation**
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [ ] 14.3 Write property test for performance format
    - **Property 29: Performance Format Completeness**
    - **Validates: Requirements 11.4**

  - [ ] 14.4 Implement best/worst asset identification
    - Rank assets by performance
    - Identify top 3 gainers and losers
    - Calculate individual asset returns
    - _Requirements: 11.5, 11.6_

- [ ] 15. Implement Asset Allocation Service
  - [ ] 15.1 Create allocation calculation
    - Calculate percentage for each asset
    - Calculate percentage for each chain
    - Ensure percentages sum to 100%
    - _Requirements: 12.2, 12.3, 12.4_

  - [ ] 15.2 Write property test for allocation percentages
    - **Property 30: Allocation Percentage Sum**
    - **Validates: Requirements 12.2**

- [ ] 16. Checkpoint - Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 17. Implement Backend API Endpoints
  - [ ] 17.1 Create authentication endpoints
    - POST /api/auth/nonce - Generate nonce
    - POST /api/auth/verify - Verify signature and login
    - POST /api/auth/refresh - Refresh access token
    - POST /api/auth/logout - Logout and invalidate session
    - _Requirements: 1.4, 1.6, 1.7, 1.9, 1.10_

  - [ ] 17.2 Create wallet management endpoints
    - GET /api/wallets - List user wallets
    - POST /api/wallets - Add new wallet
    - PATCH /api/wallets/:id - Update wallet
    - DELETE /api/wallets/:id - Remove wallet
    - GET /api/wallets/:id/balances - Get wallet balances
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [ ] 17.3 Create portfolio endpoints
    - GET /api/portfolio - Get aggregated portfolio
    - POST /api/portfolio/refresh - Force refresh portfolio
    - GET /api/portfolio/history - Get historical snapshots
    - GET /api/portfolio/allocation - Get asset allocation
    - GET /api/portfolio/metrics - Get performance metrics
    - _Requirements: 6.1, 6.8, 7.3, 12.2, 11.1_

  - [ ] 17.4 Create transaction endpoints
    - GET /api/transactions - Get transaction history
    - GET /api/transactions/:id - Get transaction details
    - _Requirements: 8.4, 8.7_

  - [ ] 17.5 Create AI analysis endpoints
    - GET /api/analysis - Get AI portfolio analysis
    - POST /api/analysis/refresh - Force refresh analysis
    - _Requirements: 9.8_

  - [ ] 17.6 Add rate limiting middleware
    - General: 100 req/min per IP
    - Auth: 10 req/min per IP
    - Wallet: 30 req/min per user
    - Portfolio: 20 req/min per user
    - _Requirements: 14.6_

  - [ ] 17.7 Write property test for rate limiting
    - **Property 36: Rate Limit Enforcement**
    - **Validates: Requirements 14.6**

  - [ ] 17.8 Add error handling middleware
    - Catch all errors
    - Return user-friendly messages
    - Log errors with context
    - Filter sensitive data from logs
    - _Requirements: 13.4, 13.5, 14.7_

  - [ ] 17.9 Write property test for sensitive data filtering
    - **Property 37: Sensitive Data Filtering in Logs**
    - **Validates: Requirements 14.7**

  - [ ] 17.10 Add security middleware
    - Helmet for security headers
    - CORS with origin validation
    - Request validation
    - _Requirements: 14.3, 14.5_

- [ ] 18. Implement WebSocket Service for Real-Time Updates
  - [ ] 18.1 Setup WebSocket server
    - Initialize Socket.IO server
    - Handle connection/disconnection
    - Authenticate connections via JWT
    - _Requirements: 10.1, 10.5_

  - [ ] 18.2 Write property test for WebSocket lifecycle
    - **Property 26: WebSocket Connection Lifecycle**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**

  - [ ] 18.3 Implement price update broadcasting
    - Subscribe to price feeds for user's assets
    - Broadcast when prices change >0.5%
    - Throttle to max 1 update/second per user
    - _Requirements: 10.2_

  - [ ] 18.4 Implement portfolio update broadcasting
    - Broadcast when portfolio data changes
    - Include updated values and assets
    - _Requirements: 10.3_

  - [ ] 18.5 Implement polling fallback
    - Detect WebSocket failures
    - Automatically switch to polling (30s interval)
    - Resume WebSocket when available
    - _Requirements: 10.4_

  - [ ] 18.6 Write property test for WebSocket fallback
    - **Property 27: WebSocket Fallback to Polling**
    - **Validates: Requirements 10.4**

  - [ ] 18.7 Implement state resumption on reconnect
    - Track last known state per connection
    - Send delta updates on reconnect
    - _Requirements: 10.6_

- [ ] 19. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 20. Implement Frontend Wallet Connection
  - [ ] 20.1 Create MetaMask integration
    - Detect MetaMask extension
    - Request account connection
    - Handle account changes
    - Handle network changes
    - _Requirements: 1.2_

  - [ ] 20.2 Create WalletConnect integration
    - Initialize WalletConnect client
    - Display QR code modal
    - Handle mobile wallet connection
    - Handle disconnection
    - _Requirements: 1.3_

  - [ ] 20.3 Create wallet connection UI component
    - Show connection options (MetaMask, WalletConnect)
    - Display connection status
    - Show connected address
    - Provide disconnect button
    - _Requirements: 1.1_

  - [ ] 20.4 Implement SIWE authentication flow
    - Request nonce from backend
    - Prompt user to sign message
    - Send signature to backend
    - Store JWT tokens
    - Handle authentication errors
    - _Requirements: 1.4, 1.5, 1.6, 1.7_

  - [ ] 20.5 Create authentication state management
    - Store user and tokens in Zustand
    - Implement token refresh logic
    - Handle logout
    - Persist auth state
    - _Requirements: 1.8, 1.9, 1.10_

- [ ] 21. Implement Frontend Wallet Management
  - [ ] 21.1 Create wallet list component
    - Display all user wallets
    - Show wallet nickname and address
    - Show wallet value
    - Show active/inactive status
    - _Requirements: 2.5, 2.6_

  - [ ] 21.2 Create add wallet form
    - Input for wallet address
    - Chain selection checkboxes
    - Nickname input (optional)
    - Validation and error handling
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 21.3 Create wallet management actions
    - Edit wallet nickname
    - Toggle wallet active/inactive
    - Delete wallet with confirmation
    - _Requirements: 2.7_

- [ ] 22. Implement Frontend Portfolio Dashboard
  - [ ] 22.1 Create portfolio summary component
    - Display total portfolio value
    - Show 24h change (% and $)
    - Display last updated timestamp
    - Add refresh button
    - _Requirements: 6.5, 6.8, 11.1, 11.4_

  - [ ] 22.2 Create asset list component
    - Display all assets with balances
    - Show USD values
    - Show which chains each asset is on
    - Sort by value descending
    - _Requirements: 6.6, 6.7_

  - [ ] 22.3 Create portfolio value chart
    - Line chart showing value over time
    - Use historical snapshot data
    - Support 7-day, 30-day, 90-day views
    - _Requirements: 7.4_

  - [ ] 22.4 Create asset allocation pie chart
    - Show asset allocation by value
    - Use distinct colors per asset
    - Show percentages
    - Hover for detailed breakdown
    - _Requirements: 12.1, 12.2, 12.5, 12.6_

  - [ ] 22.5 Create performance metrics component
    - Show 24h, 7d, 30d performance
    - Display best/worst performing assets
    - Show percentage and absolute changes
    - _Requirements: 11.3, 11.4, 11.5_

  - [ ] 22.6 Create chain allocation component
    - Show allocation by chain
    - Display percentages per chain
    - _Requirements: 12.3, 12.4_

- [ ] 23. Implement Frontend Transaction History
  - [ ] 23.1 Create transaction list component
    - Display transactions in chronological order
    - Show transaction type, asset, amount
    - Show USD value at transaction time
    - Show from/to addresses (truncated)
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ] 23.2 Create transaction filters
    - Filter by type (receive, send, swap, contract)
    - Filter by asset
    - Filter by date range
    - _Requirements: 8.7_

  - [ ] 23.3 Create transaction detail modal
    - Show full transaction details
    - Link to blockchain explorer
    - Show full addresses
    - _Requirements: 8.6_

- [ ] 24. Implement Frontend AI Analysis Dashboard
  - [ ] 24.1 Create AI insights component
    - Display risk score with visual indicator
    - Show diversification score
    - Display concentration warnings
    - _Requirements: 9.8_

  - [ ] 24.2 Create forecast visualization
    - Show 7-day, 30-day, 90-day forecasts
    - Display confidence intervals
    - Use line chart with projections
    - _Requirements: 9.5_

  - [ ] 24.3 Create recommendations component
    - Display rebalancing suggestions
    - Show rationale for each recommendation
    - Provide actionable steps
    - _Requirements: 9.7_

- [ ] 25. Implement Frontend Real-Time Updates
  - [ ] 25.1 Setup WebSocket client
    - Connect to WebSocket server
    - Authenticate with JWT
    - Handle connection/disconnection
    - _Requirements: 10.1, 10.5_

  - [ ] 25.2 Implement price update handling
    - Listen for price updates
    - Update portfolio values in real-time
    - Update charts and displays
    - _Requirements: 10.2_

  - [ ] 25.3 Implement portfolio update handling
    - Listen for portfolio updates
    - Refresh portfolio data
    - Update all components
    - _Requirements: 10.3_

  - [ ] 25.4 Implement polling fallback
    - Detect WebSocket failures
    - Switch to polling (30s interval)
    - Resume WebSocket when available
    - _Requirements: 10.4_

  - [ ] 25.5 Implement state resumption
    - Track last update timestamp
    - Request delta on reconnect
    - Merge updates with local state
    - _Requirements: 10.6_

- [ ] 26. Checkpoint - Ensure all frontend components render correctly
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 27. Implement Frontend UI Polish and Responsiveness
  - [ ] 27.1 Implement dark theme with glassmorphism
    - Apply dark color scheme
    - Add glassmorphism effects to cards
    - Add gradient backgrounds
    - _Requirements: 15.1_

  - [ ] 27.2 Implement responsive layouts
    - Mobile-first design
    - Breakpoints for tablet and desktop
    - Collapsible navigation on mobile
    - _Requirements: 15.2_

  - [ ] 27.3 Write property test for responsive behavior
    - **Property 38: Responsive layout adaptation**
    - **Validates: Requirements 15.2**

  - [ ] 27.4 Add loading indicators
    - Skeleton loaders for data
    - Spinners for actions
    - Progress bars for long operations
    - _Requirements: 15.3_

  - [ ] 27.5 Implement responsive charts
    - Charts adapt to container size
    - Touch-friendly on mobile
    - Proper legends and labels
    - _Requirements: 15.4_

  - [ ] 27.6 Implement number formatting
    - Add thousand separators
    - Format decimals appropriately
    - Handle large numbers (K, M, B)
    - _Requirements: 15.5_

  - [ ] 27.7 Write property test for number formatting
    - **Property 38: Number Formatting with Separators**
    - **Validates: Requirements 15.5**

  - [ ] 27.8 Implement address truncation
    - Truncate to 0x1234...5678 format
    - Show full address on hover
    - Copy to clipboard functionality
    - _Requirements: 15.6_

  - [ ] 27.9 Write property test for address truncation
    - **Property 39: Address Truncation**
    - **Validates: Requirements 15.6**

  - [ ] 27.10 Add interaction feedback
    - Hover effects on buttons and cards
    - Click animations
    - Toast notifications for actions
    - _Requirements: 15.7_

- [ ] 28. Implement Security Hardening
  - [ ] 28.1 Add private key prohibition checks
    - Scan all storage operations
    - Prevent storage of private keys
    - Add validation in wallet service
    - _Requirements: 14.1_

  - [ ] 28.2 Write property test for private key prohibition
    - **Property 33: Private Key Prohibition**
    - **Validates: Requirements 14.1**

  - [ ] 28.3 Verify HTTPS enforcement
    - Ensure all API calls use HTTPS
    - Redirect HTTP to HTTPS
    - Set secure cookie flags
    - _Requirements: 14.3_

  - [ ] 28.4 Implement CORS validation
    - Restrict origins to configured domains
    - Validate origin on each request
    - Block unauthorized origins
    - _Requirements: 14.5_

  - [ ] 28.5 Add input validation and sanitization
    - Validate all user inputs
    - Sanitize addresses and symbols
    - Prevent injection attacks
    - _Requirements: 2.1_

- [ ] 29. Implement Error Handling and Logging
  - [ ] 29.1 Create error response formatter
    - User-friendly error messages
    - Error codes for client handling
    - Detailed context in dev mode
    - _Requirements: 13.4_

  - [ ] 29.2 Implement comprehensive logging
    - Log all errors with context
    - Log API calls and responses
    - Log user actions
    - Filter sensitive data
    - _Requirements: 13.5, 14.7_

  - [ ] 29.3 Add monitoring and alerting
    - Track API response times
    - Monitor RPC success rates
    - Track cache hit rates
    - Alert on anomalies
    - _Requirements: 13.1, 13.2_

- [ ] 30. Integration Testing and Bug Fixes
  - [ ] 30.1 Write integration tests for authentication flow
    - Test complete SIWE flow
    - Test token refresh
    - Test logout

  - [ ] 30.2 Write integration tests for portfolio flow
    - Test wallet addition
    - Test balance fetching
    - Test portfolio aggregation
    - Test snapshot creation

  - [ ] 30.3 Write integration tests for real-time updates
    - Test WebSocket connection
    - Test price updates
    - Test fallback to polling

  - [ ] 30.4 Fix any bugs discovered during testing
    - Address test failures
    - Fix edge cases
    - Improve error handling

- [ ] 31. Performance Optimization
  - [ ] 31.1 Optimize database queries
    - Add missing indexes
    - Optimize N+1 queries
    - Implement query batching
    - _Requirements: 13.7_

  - [ ] 31.2 Optimize caching strategy
    - Tune cache TTLs
    - Implement cache warming
    - Add cache invalidation logic
    - _Requirements: 3.6, 5.5_

  - [ ] 31.3 Optimize frontend bundle size
    - Code splitting by route
    - Lazy load heavy components
    - Optimize images
    - Tree shake unused code
    - _Requirements: 15.2_

  - [ ] 31.4 Optimize API response times
    - Implement response compression
    - Optimize JSON serialization
    - Add request batching
    - _Requirements: 13.4_

- [ ] 32. Final Checkpoint - End-to-End Testing
  - [ ] 32.1 Test complete user journey
    - Connect wallet → Add wallets → View portfolio → Analyze → Refresh
    - Test on multiple browsers
    - Test on mobile devices

  - [ ] 32.2 Load testing
    - Test with multiple concurrent users
    - Test RPC resilience under load
    - Test cache performance under load

  - [ ] 32.3 Security audit
    - Review authentication flow
    - Review data encryption
    - Review input validation
    - Review logging for sensitive data

  - [ ] 32.4 Documentation
    - Update README with setup instructions
    - Document API endpoints
    - Document environment variables
    - Create deployment guide

- [ ] 33. Deployment Preparation
  - [ ] 33.1 Setup production environment variables
    - Configure production database
    - Configure production Redis
    - Configure RPC endpoints
    - Configure API keys
    - _Requirements: 14.2, 14.3_

  - [ ] 33.2 Setup CI/CD pipeline
    - Automated testing on PR
    - Automated deployment to staging
    - Manual approval for production
    - _Requirements: 13.5_

  - [ ] 33.3 Setup monitoring and logging
    - Configure error tracking (Sentry)
    - Configure performance monitoring
    - Configure log aggregation
    - Setup alerts
    - _Requirements: 13.5_

  - [ ] 33.4 Deploy to production
    - Deploy backend to Railway/Heroku
    - Deploy frontend to Vercel
    - Verify all services running
    - Test production deployment

## Notes

- All tasks including property-based tests are required for comprehensive quality
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- All tests should clean up after themselves (no test data pollution)
- Use mocks for external services (RPC, price APIs) in tests
- Use test database for integration tests
