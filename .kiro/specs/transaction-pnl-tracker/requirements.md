# Requirements Document: Transaction Tracking and P&L Calculator

## Introduction

This feature adds comprehensive transaction tracking and profit/loss calculation capabilities to the existing Web3 crypto portfolio tracker. It enables users to track all transactions from connected wallets and exchanges, calculate realized and unrealized P&L with multiple cost-basis methods, and generate reports for tax purposes.

## Glossary

- **Transaction**: A blockchain or exchange operation involving cryptocurrency (buy, sell, swap, transfer, fee payment)
- **Realized_P&L**: Profit or loss calculated when a position is closed (sell or swap)
- **Unrealized_P&L**: Profit or loss on current holdings based on current market price
- **Cost_Basis**: The original value of an asset for tax purposes
- **FIFO**: First-In-First-Out cost basis method (earliest purchases sold first)
- **LIFO**: Last-In-First-Out cost basis method (most recent purchases sold first)
- **Weighted_Average**: Cost basis method using average purchase price across all holdings
- **Holding**: Current cryptocurrency position with associated cost basis
- **Sync**: Process of fetching and storing transaction data from wallets and exchanges
- **Transaction_Source**: Origin of transaction data (on-chain wallet or exchange)
- **Price_Service**: Service that provides historical and current cryptocurrency prices
- **Blockchain_Service**: Existing service for interacting with blockchain networks

## Requirements

### Requirement 1: Transaction Data Storage

**User Story:** As a user, I want all my transactions stored with complete details, so that I can track my trading history and calculate accurate P&L.

#### Acceptance Criteria

1. WHEN a transaction is stored, THE System SHALL record wallet/account identifier, blockchain chain, token symbol, transaction type, quantity, execution price, fees, timestamp, and source
2. THE System SHALL support transaction types: buy, sell, swap, transfer, and fee
3. WHEN storing transaction data, THE System SHALL normalize all monetary values to USD
4. THE System SHALL prevent duplicate transactions from being stored for the same transaction hash and wallet combination
5. WHEN a transaction includes fees, THE System SHALL store fee amount and fee token separately from the main transaction

### Requirement 2: Transaction Synchronization

**User Story:** As a user, I want to sync transactions from my connected wallets and exchanges, so that my transaction history stays up-to-date.

#### Acceptance Criteria

1. WHEN a user initiates sync, THE System SHALL fetch transactions from all connected wallets using the Blockchain_Service
2. WHEN a user initiates sync, THE System SHALL fetch transactions from all connected exchanges
3. WHEN syncing transactions, THE System SHALL be idempotent and not create duplicate records
4. IF a sync operation is already in progress for a wallet, THEN THE System SHALL reject concurrent sync requests for that wallet
5. WHEN sync completes, THE System SHALL return the count of new transactions added
6. WHEN sync fails for a specific wallet, THE System SHALL continue syncing other wallets and report the failure

### Requirement 3: Historical Price Fetching

**User Story:** As a user, I want historical prices fetched for my transactions, so that cost basis calculations are accurate.

#### Acceptance Criteria

1. WHEN a transaction is stored without an execution price, THE System SHALL fetch the historical price from the Price_Service using the transaction timestamp
2. WHEN fetching historical prices, THE System SHALL normalize all prices to USD
3. IF historical price data is unavailable for a timestamp, THEN THE System SHALL use the closest available price within 24 hours
4. WHEN a transaction includes a swap, THE System SHALL fetch prices for both tokens involved
5. THE System SHALL cache historical prices to minimize external API calls

### Requirement 4: Current Holdings Calculation

**User Story:** As a user, I want to see my current holdings with cost basis, so that I understand my position in each token.

#### Acceptance Criteria

1. THE System SHALL calculate current holdings by processing all transactions chronologically
2. WHEN calculating holdings, THE System SHALL exclude transfer transactions from cost basis calculations
3. WHEN calculating holdings, THE System SHALL apply the selected cost-basis method (FIFO, LIFO, or Weighted_Average)
4. THE System SHALL track cost basis separately for each token and wallet combination
5. WHEN a holding quantity reaches zero, THE System SHALL maintain the historical cost basis record

### Requirement 5: Realized P&L Calculation

**User Story:** As a user, I want realized P&L calculated on my sells and swaps, so that I know my actual profits and losses.

#### Acceptance Criteria

1. WHEN a sell transaction occurs, THE System SHALL calculate realized P&L using the selected cost-basis method
2. WHEN a swap transaction occurs, THE System SHALL calculate realized P&L for the token being sold
3. THE System SHALL calculate realized P&L as: (sell_price * quantity) - (cost_basis * quantity) - fees
4. WHEN using FIFO, THE System SHALL match sells against the earliest purchases first
5. WHEN using LIFO, THE System SHALL match sells against the most recent purchases first
6. WHEN using Weighted_Average, THE System SHALL use the average cost across all holdings
7. THE System SHALL handle partial sells by proportionally reducing the cost basis

### Requirement 6: Unrealized P&L Calculation

**User Story:** As a user, I want unrealized P&L calculated on my current holdings, so that I can see potential profits or losses.

#### Acceptance Criteria

1. THE System SHALL calculate unrealized P&L for all current holdings with non-zero quantity
2. WHEN calculating unrealized P&L, THE System SHALL fetch current market prices from the Price_Service
3. THE System SHALL calculate unrealized P&L as: (current_price * quantity) - (cost_basis * quantity)
4. WHEN current price is unavailable, THE System SHALL return zero unrealized P&L for that holding
5. THE System SHALL aggregate unrealized P&L across all holdings for overall summary

### Requirement 7: Cost-Basis Method Selection

**User Story:** As a user, I want to select different cost-basis methods, so that I can optimize for my tax situation.

#### Acceptance Criteria

1. THE System SHALL support three cost-basis methods: FIFO, LIFO, and Weighted_Average
2. THE System SHALL use FIFO as the default cost-basis method
3. WHEN a user changes the cost-basis method, THE System SHALL recalculate all P&L values using the new method
4. THE System SHALL persist the user's selected cost-basis method preference
5. WHEN displaying P&L data, THE System SHALL indicate which cost-basis method was used

### Requirement 8: Transaction History API

**User Story:** As a developer, I want APIs to retrieve transaction data, so that the frontend can display transaction history.

#### Acceptance Criteria

1. THE System SHALL provide GET /transactions endpoint that returns paginated transaction list
2. WHEN querying transactions, THE System SHALL support filtering by date range, token, transaction type, and wallet
3. WHEN querying transactions, THE System SHALL support sorting by timestamp in ascending or descending order
4. THE System SHALL return transactions with all stored fields including normalized USD values
5. THE System SHALL require authentication for all transaction endpoints

### Requirement 9: P&L Summary APIs

**User Story:** As a developer, I want APIs to retrieve P&L data, so that the frontend can display profit and loss information.

#### Acceptance Criteria

1. THE System SHALL provide GET /pnl/realized endpoint that returns realized P&L summary
2. THE System SHALL provide GET /pnl/unrealized endpoint that returns unrealized P&L summary with current holdings
3. THE System SHALL provide GET /pnl/summary endpoint that returns overall P&L combining realized and unrealized
4. WHEN querying P&L data, THE System SHALL support filtering by date range and token
5. THE System SHALL return token-wise P&L breakdown showing individual token performance
6. THE System SHALL require authentication for all P&L endpoints

### Requirement 10: Transaction Sync API

**User Story:** As a developer, I want an API to trigger transaction synchronization, so that users can refresh their data.

#### Acceptance Criteria

1. THE System SHALL provide POST /transactions/sync endpoint that initiates transaction synchronization
2. WHEN sync is triggered, THE System SHALL accept optional wallet filter to sync specific wallets only
3. WHEN sync completes successfully, THE System SHALL return count of new transactions and updated holdings
4. IF sync is already in progress, THEN THE System SHALL return appropriate status without starting duplicate sync
5. WHEN sync encounters errors, THE System SHALL return detailed error information for each failed wallet

### Requirement 11: Edge Case Handling

**User Story:** As a user, I want the system to handle complex transaction scenarios correctly, so that my P&L calculations are accurate.

#### Acceptance Criteria

1. WHEN a transaction fails on-chain, THE System SHALL exclude it from P&L calculations
2. WHEN processing wrapped tokens (e.g., WETH/ETH), THE System SHALL treat them as separate tokens for P&L purposes
3. WHEN an airdrop transaction is detected, THE System SHALL record it with zero cost basis
4. WHEN a transaction has partial fills, THE System SHALL process each fill as a separate transaction
5. WHEN fee transactions are processed, THE System SHALL deduct fees from realized P&L calculations

### Requirement 12: Precision-Safe Mathematics

**User Story:** As a user, I want all financial calculations to be precise, so that I can trust the P&L numbers for tax reporting.

#### Acceptance Criteria

1. THE System SHALL use fixed-point decimal arithmetic for all monetary calculations
2. THE System SHALL maintain at least 18 decimal places of precision for token quantities
3. THE System SHALL maintain at least 8 decimal places of precision for USD values
4. WHEN performing division operations, THE System SHALL round using banker's rounding (round half to even)
5. THE System SHALL never use floating-point arithmetic for financial calculations

### Requirement 13: Transaction History Display

**User Story:** As a user, I want to view my transaction history in a table, so that I can review all my trading activity.

#### Acceptance Criteria

1. THE System SHALL display transactions in a paginated table with columns: date, token, type, quantity, price, fees, and total value
2. WHEN displaying the transaction table, THE System SHALL support filtering by date range, token, transaction type, and wallet
3. WHEN displaying the transaction table, THE System SHALL support sorting by any column
4. THE System SHALL display transaction timestamps in the user's local timezone
5. WHEN a user clicks a transaction row, THE System SHALL show detailed transaction information including transaction hash and blockchain explorer link

### Requirement 14: P&L Dashboard Display

**User Story:** As a user, I want to see my P&L summary on a dashboard, so that I can quickly understand my portfolio performance.

#### Acceptance Criteria

1. THE System SHALL display overall P&L summary cards showing total realized P&L, total unrealized P&L, and combined total
2. THE System SHALL display token-wise P&L breakdown table with columns: token, holdings, cost basis, current value, unrealized P&L, realized P&L
3. WHEN displaying P&L values, THE System SHALL use color coding (green for profit, red for loss)
4. THE System SHALL display percentage gains/losses alongside absolute values
5. THE System SHALL provide a cost-basis method selector dropdown with options: FIFO, LIFO, Weighted Average

### Requirement 15: Data Export

**User Story:** As a user, I want to export my transaction and P&L data, so that I can use it for tax reporting.

#### Acceptance Criteria

1. THE System SHALL provide an export button that downloads transaction data as CSV
2. WHEN exporting transactions, THE System SHALL include all transaction fields in the CSV
3. THE System SHALL provide an export button that downloads P&L summary as CSV
4. WHEN exporting P&L data, THE System SHALL include token-wise breakdown with realized and unrealized P&L
5. THE System SHALL name exported files with timestamp: transactions_YYYY-MM-DD.csv

### Requirement 16: Database Schema

**User Story:** As a developer, I want a well-designed database schema, so that transaction and P&L data is stored efficiently.

#### Acceptance Criteria

1. THE System SHALL create a transactions table with fields: id, user_id, wallet_address, chain, token_symbol, tx_type, quantity, price_usd, fee_amount, fee_token, timestamp, tx_hash, source, created_at
2. THE System SHALL create a holdings table with fields: id, user_id, wallet_address, token_symbol, quantity, cost_basis_usd, cost_basis_method, last_updated
3. THE System SHALL create a realized_pnl table with fields: id, user_id, token_symbol, realized_amount_usd, transaction_id, calculated_at
4. THE System SHALL create indexes on user_id, wallet_address, token_symbol, and timestamp for query performance
5. THE System SHALL enforce foreign key constraints between transactions and users

### Requirement 17: Integration with Existing Systems

**User Story:** As a developer, I want the feature to integrate seamlessly with existing systems, so that no existing functionality breaks.

#### Acceptance Criteria

1. THE System SHALL use the existing authentication middleware for all new endpoints
2. THE System SHALL use the existing Blockchain_Service for fetching on-chain transactions
3. THE System SHALL use the existing Price_Service for fetching cryptocurrency prices
4. THE System SHALL use the existing Prisma database client for all database operations
5. THE System SHALL NOT modify existing wallet connection, authentication, or portfolio APIs
