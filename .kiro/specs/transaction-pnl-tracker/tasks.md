# Implementation Plan: Transaction Tracking and P&L Calculator

## Overview

This implementation plan breaks down the Transaction Tracking and P&L Calculator feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: starting with database schema and core services, then building the API layer, and finally implementing the frontend components. Each task builds on previous work, with testing integrated throughout to catch errors early.

## Implementation Status Summary

**Completed:**
- ✅ Database schema with Transaction, Holding, and RealizedPnL models
- ✅ Decimal utility module with precision-safe arithmetic
- ✅ Price Fetching Service with caching and fallback logic
- ✅ Cost Basis Calculator with FIFO, LIFO, and Weighted Average methods

**In Progress:**
- Transaction Sync Service (not started)
- P&L Calculation Engine (not started)
- API endpoints and controllers (not started)
- Frontend components (not started)

## Tasks

- [x] 1. Set up database schema and migrations
  - Create Prisma schema for Transaction, Holding, and RealizedPnL models
  - Add costBasisMethod field to User model
  - Create database migration files
  - Run migrations to update database
  - _Requirements: 16.1, 16.2, 16.3, 16.5_

- [x] 2. Implement precision-safe decimal utilities
  - [x] 2.1 Create decimal utility module with Decimal.js
    - Install decimal.js-light package
    - Create utility functions for safe arithmetic operations
    - Implement banker's rounding function
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [ ]* 2.2 Write property tests for decimal precision
    - **Property 30: Decimal Precision Maintenance**
    - **Validates: Requirements 12.2, 12.3**
  
  - [ ]* 2.3 Write property tests for banker's rounding
    - **Property 31: Banker's Rounding Application**
    - **Validates: Requirements 12.4**

- [x] 3. Implement Price Fetching Service
  - [ ] 3.1 Create PriceFetchingService class
    - Implement getHistoricalPrice method with caching
    - Implement getCurrentPrice method
    - Implement fallback logic for missing prices (24-hour window)
    - Integrate with existing Price Service
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 3.2 Write property tests for price caching
    - **Property 9: Price Caching Efficiency**
    - **Validates: Requirements 3.5**
  
  - [ ]* 3.3 Write unit tests for price fetching
    - Test historical price fetching with mocked service
    - Test current price fetching
    - Test fallback to closest price
    - Test cache hit/miss scenarios
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Implement Cost Basis Calculator
  - [x] 4.1 Create cost basis method interfaces and implementations
    - Create CostBasisMethod interface
    - Implement FIFOMethod class
    - Implement LIFOMethod class
    - Implement WeightedAverageMethod class
    - _Requirements: 5.4, 5.5, 5.6, 7.1_
  
  - [ ]* 4.2 Write property tests for FIFO method
    - **Property 15: FIFO Ordering Correctness**
    - **Validates: Requirements 5.4**
  
  - [ ]* 4.3 Write property tests for LIFO method
    - **Property 16: LIFO Ordering Correctness**
    - **Validates: Requirements 5.5**
  
  - [ ]* 4.4 Write property tests for Weighted Average method
    - **Property 17: Weighted Average Calculation**
    - **Validates: Requirements 5.6**
  
  - [x] 4.5 Create CostBasisCalculator class
    - Implement getCostBasis method
    - Implement updateHoldings method
    - Integrate with Prisma for transaction queries
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 4.6 Write property tests for cost basis calculation
    - **Property 11: Transfer Cost Basis Exclusion**
    - **Property 12: Token-Wallet Holdings Isolation**
    - **Property 18: Partial Sell Proportional Reduction**
    - **Validates: Requirements 4.2, 4.4, 5.7**
  
  - [ ]* 4.7 Write unit tests for cost basis calculator
    - Test getCostBasis with various transaction sequences
    - Test updateHoldings with buys, sells, and transfers
    - Test edge cases: zero holdings, no purchases
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Implement Transaction Sync Service
  - [x] 5.1 Create TransactionSyncService class
    - Implement syncWalletTransactions method
    - Implement performSync private method with duplicate detection
    - Implement classifyTransaction helper method
    - Implement recalculateHoldings method
    - Add concurrent sync prevention with Map tracking
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ]* 5.2 Write property tests for transaction sync
    - **Property 3: Transaction Idempotency**
    - **Property 5: Concurrent Sync Prevention**
    - **Property 6: Sync Transaction Count Accuracy**
    - **Validates: Requirements 1.4, 2.3, 2.4, 2.5**
  
  - [ ]* 5.3 Write unit tests for transaction sync
    - Test sync with mocked blockchain service
    - Test duplicate transaction prevention
    - Test concurrent sync rejection
    - Test error handling for failed wallets
    - Test transaction classification logic
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

- [x] 6. Implement P&L Calculation Engine
  - [x] 6.1 Create PnLCalculationEngine class
    - Implement calculateRealizedPnL method
    - Implement calculateUnrealizedPnL method
    - Integrate with CostBasisCalculator
    - Integrate with PriceFetchingService
    - Store realized P&L records in database
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 6.2 Write property tests for realized P&L
    - **Property 13: Realized P&L Formula Correctness**
    - **Property 14: Cost Basis Method Application**
    - **Property 29: Fee Deduction from Realized P&L**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 11.5**
  
  - [ ]* 6.3 Write property tests for unrealized P&L
    - **Property 19: Unrealized P&L Formula Correctness**
    - **Property 20: Unrealized P&L Aggregation**
    - **Validates: Requirements 6.3, 6.5**
  
  - [ ]* 6.4 Write unit tests for P&L calculation
    - Test realized P&L with simple buy-sell sequences
    - Test unrealized P&L with current holdings
    - Test P&L with different cost basis methods
    - Test fee deduction from realized P&L
    - Test handling of missing current prices
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.4_

- [x] 7. Checkpoint - Ensure all services work together
  - Run integration tests with all services
  - Test complete flow: sync → calculate holdings → calculate P&L
  - Verify database records are created correctly
  - Ask the user if questions arise

- [ ] 8. Implement Transaction API endpoints
  - [x] 8.1 Create transaction controller and routes
    - Implement GET /api/transactions endpoint with pagination
    - Implement filtering by date range, token, type, wallet
    - Implement sorting by timestamp
    - Add authentication middleware to all routes
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 8.2 Write property tests for transaction API
    - **Property 22: Transaction Query Filtering**
    - **Property 23: Transaction Query Sorting**
    - **Property 24: Transaction Response Completeness**
    - **Property 25: Endpoint Authentication Requirement**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
  
  - [ ]* 8.3 Write unit tests for transaction endpoints
    - Test GET /transactions with various filters
    - Test pagination with different page sizes
    - Test sorting in both directions
    - Test authentication requirement
    - Test error handling for invalid parameters
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ] 9. Implement P&L API endpoints
  - [ ] 9.1 Create P&L controller and routes
    - Implement GET /api/pnl/realized endpoint
    - Implement GET /api/pnl/unrealized endpoint
    - Implement GET /api/pnl/summary endpoint
    - Add filtering by date range and token
    - Add authentication middleware to all routes
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ]* 9.2 Write property tests for P&L API
    - **Property 26: P&L Query Filtering**
    - **Property 27: Token-Wise P&L Breakdown**
    - **Validates: Requirements 9.4, 9.5**
  
  - [ ]* 9.3 Write unit tests for P&L endpoints
    - Test GET /pnl/realized with filters
    - Test GET /pnl/unrealized
    - Test GET /pnl/summary
    - Test token-wise breakdown accuracy
    - Test authentication requirement
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

- [ ] 10. Implement Sync API endpoint
  - [ ] 10.1 Create sync controller and route
    - Implement POST /api/transactions/sync endpoint
    - Add optional wallet filter parameter
    - Return sync results with transaction count
    - Handle concurrent sync attempts
    - Return detailed error information for failed wallets
    - Add authentication middleware
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 10.2 Write property tests for sync API
    - **Property 28: Selective Wallet Sync**
    - **Validates: Requirements 10.2**
  
  - [ ]* 10.3 Write unit tests for sync endpoint
    - Test POST /transactions/sync without filters
    - Test POST /transactions/sync with wallet filter
    - Test concurrent sync rejection
    - Test error reporting for failed wallets
    - Test authentication requirement
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 11. Checkpoint - Ensure all API endpoints work
  - Test all endpoints with Postman or similar tool
  - Verify authentication is enforced
  - Verify error responses are properly formatted
  - Ask the user if questions arise

- [ ] 12. Implement cost basis method preference management
  - [ ] 12.1 Add cost basis method update endpoint
    - Implement PATCH /api/user/cost-basis-method endpoint
    - Validate method is one of: FIFO, LIFO, WEIGHTED_AVERAGE
    - Update user preference in database
    - Trigger P&L recalculation
    - _Requirements: 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 12.2 Write property tests for method switching
    - **Property 21: Cost Basis Method Recalculation**
    - **Validates: Requirements 7.3**
  
  - [ ]* 12.3 Write unit tests for cost basis preference
    - Test updating cost basis method
    - Test validation of method values
    - Test P&L recalculation after method change
    - Test default method is FIFO
    - _Requirements: 7.2, 7.3, 7.4_

- [ ] 13. Implement frontend Transaction History page
  - [ ] 13.1 Create TransactionHistory component
    - Create page at /dashboard/transactions
    - Implement transaction table with columns: date, token, type, quantity, price, fees, total
    - Add pagination controls
    - Add filter controls for date range, token, type, wallet
    - Add sorting by clicking column headers
    - Display timestamps in local timezone
    - Add transaction detail modal with hash and explorer link
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ]* 13.2 Write unit tests for transaction history UI
    - Test table rendering with mock data
    - Test filtering functionality
    - Test sorting functionality
    - Test pagination
    - Test transaction detail modal
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

- [ ] 14. Implement frontend P&L Dashboard page
  - [ ] 14.1 Create PnLDashboard component
    - Create page at /dashboard/pnl
    - Implement summary cards for realized, unrealized, and total P&L
    - Implement token-wise breakdown table
    - Add color coding for profit (green) and loss (red)
    - Display percentage gains alongside absolute values
    - Add cost basis method selector dropdown
    - Add sync button to refresh transactions
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ]* 14.2 Write unit tests for P&L dashboard UI
    - Test summary cards rendering
    - Test token breakdown table
    - Test color coding logic
    - Test cost basis method selector
    - Test sync button functionality
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

- [ ] 15. Implement data export functionality
  - [ ] 15.1 Create export utilities
    - Create CSV export utility function
    - Implement transaction export with all fields
    - Implement P&L export with token breakdown
    - Generate filenames with timestamp format
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 15.2 Add export buttons to frontend
    - Add "Export Transactions" button to transaction history page
    - Add "Export P&L" button to P&L dashboard page
    - Trigger CSV download on button click
    - _Requirements: 15.1, 15.3_
  
  - [ ]* 15.3 Write property tests for export functionality
    - **Property 32: CSV Export Completeness**
    - **Property 33: Export Filename Timestamp**
    - **Validates: Requirements 15.2, 15.4, 15.5**
  
  - [ ]* 15.4 Write unit tests for export
    - Test CSV generation with mock data
    - Test filename format
    - Test all fields are included in export
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 16. Add navigation to new pages
  - [ ] 16.1 Update dashboard navigation
    - Add "Transactions & P&L" tab to dashboard
    - Add links to transaction history and P&L dashboard
    - Update routing configuration
    - _Requirements: 13.1, 14.1_

- [ ] 17. Implement edge case handling
  - [ ] 17.1 Add edge case handling logic
    - Filter out failed transactions from P&L calculations
    - Handle wrapped tokens as separate tokens
    - Detect and handle airdrops with zero cost basis
    - Process partial fills as separate transactions
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 17.2 Write unit tests for edge cases
    - Test failed transaction exclusion
    - Test wrapped token handling
    - Test airdrop zero cost basis
    - Test partial fill processing
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 18. Final checkpoint - End-to-end testing
  - Test complete user flow: connect wallet → sync → view transactions → view P&L → export
  - Test cost basis method switching and recalculation
  - Test with multiple wallets and tokens
  - Verify all property tests pass with 100+ iterations
  - Ensure all tests pass, ask the user if questions arise

- [ ] 19. Integration and documentation
  - [ ] 19.1 Verify integration with existing systems
    - Confirm authentication middleware is used
    - Confirm Blockchain Service integration works
    - Confirm Price Service integration works
    - Confirm Prisma client is used for all DB operations
    - Verify no existing APIs are modified
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [ ] 19.2 Add API documentation
    - Document all new endpoints with request/response examples
    - Document error codes and messages
    - Add inline code comments for complex logic
  
  - [ ] 19.3 Update README with feature documentation
    - Document transaction tracking feature
    - Document P&L calculation methods
    - Document export functionality
    - Add usage examples

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify component interactions
- All financial calculations use Decimal.js for precision safety

## Next Steps

To begin implementation:
1. Start with Task 5: Implement Transaction Sync Service
2. Follow the task order for incremental development
3. Run tests after each major component is complete
4. Use checkpoints to validate integration between components
