import { CoinDCXClient, CoinDCXBalance, CoinDCXTrade } from './coindcxClient';
import { encryptCredential, decryptCredential } from '../utils/exchangeEncryption';
import prisma from '../utils/prisma';
import redisClient from '../utils/redis';

/**
 * Exchange Service
 * 
 * Manages exchange account connections, balance synchronization, and trade history.
 * Implements caching layer for performance optimization.
 * 
 * Requirements: Phase 2.1 - Exchange Service
 */
export class ExchangeService {
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly CACHE_PREFIX = 'exchange:';

  /**
   * Generate cache key for exchange balances
   */
  private getCacheKey(accountId: string): string {
    return `${this.CACHE_PREFIX}balances:${accountId}`;
  }

  /**
   * Connect new exchange account
   * 
   * Validates credentials with the exchange API, encrypts them, saves to database,
   * and fetches initial balances.
   * 
   * @param userId - User ID
   * @param provider - Exchange provider (currently only 'coindcx')
   * @param apiKey - Exchange API key
   * @param apiSecret - Exchange API secret
   * @param nickname - Optional nickname for the account
   * @returns Created exchange account (without sensitive data)
   * @throws Error if credentials are invalid or connection fails
   */
  async connectExchange(
    userId: string,
    provider: 'coindcx',
    apiKey: string,
    apiSecret: string,
    nickname?: string
  ) {
    console.log(`🔗 Connecting ${provider} exchange for user ${userId}...`);

    // Validate credentials with the exchange
    const client = new CoinDCXClient({ apiKey, apiSecret });
    const isValid = await client.validateCredentials();

    if (!isValid) {
      throw new Error('Invalid API credentials');
    }

    // Encrypt credentials before storage
    const encryptedKey = encryptCredential(apiKey);
    const encryptedSecret = encryptCredential(apiSecret);

    // Save to database
    const account = await prisma.exchangeAccount.create({
      data: {
        userId,
        provider,
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
        nickname,
      },
    });

    console.log(`✅ Exchange account created: ${account.id}`);

    // Fetch initial balances
    try {
      await this.syncBalances(account.id);
    } catch (error) {
      console.error('⚠️  Failed to fetch initial balances:', error);
      // Don't fail the connection if balance sync fails
    }

    return {
      id: account.id,
      provider: account.provider,
      nickname: account.nickname,
      isActive: account.isActive,
      lastSyncedAt: account.lastSyncedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Sync balances for an exchange account
   * 
   * Fetches current balances from the exchange API and updates the database.
   * Implements caching to reduce API calls.
   * Creates initial PnL transactions for new balances to establish cost basis.
   * 
   * @param accountId - Exchange account ID
   * @throws Error if account not found or API call fails
   */
  async syncBalances(accountId: string): Promise<void> {
    console.log(`🔄 Syncing balances for account ${accountId}...`);

    // Fetch account with credentials
    const account = await prisma.exchangeAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Exchange account not found');
    }

    if (!account.isActive) {
      throw new Error('Exchange account is inactive');
    }

    // Decrypt credentials
    const apiKey = decryptCredential(account.apiKey);
    const apiSecret = decryptCredential(account.apiSecret);

    // Fetch balances from exchange
    const client = new CoinDCXClient({ apiKey, apiSecret });
    const balances = await client.getBalances();

    console.log(`📊 Fetched ${balances.length} balances from ${account.provider}`);

    // Update database with new balances
    const updatePromises = balances.map(async (balance: CoinDCXBalance) => {
      if (balance.balance > 0 || balance.locked_balance > 0) {
        const availableBalance = balance.balance - balance.locked_balance;

        return prisma.exchangeBalance.upsert({
          where: {
            exchangeAccountId_symbol: {
              exchangeAccountId: accountId,
              symbol: balance.currency,
            },
          },
          create: {
            exchangeAccountId: accountId,
            symbol: balance.currency,
            balance: balance.balance.toString(),
            lockedBalance: balance.locked_balance.toString(),
            availableBalance: availableBalance.toString(),
            lastUpdated: new Date(),
          },
          update: {
            balance: balance.balance.toString(),
            lockedBalance: balance.locked_balance.toString(),
            availableBalance: availableBalance.toString(),
            lastUpdated: new Date(),
          },
        });
      }
    });

    await Promise.all(updatePromises);

    // Update last synced timestamp
    await prisma.exchangeAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    // Create initial PnL transactions for balances without existing transactions
    await this.createInitialTransactionsForBalances(accountId, account.userId, balances);

    // Invalidate cache
    const cacheKey = this.getCacheKey(accountId);
    await redisClient.del(cacheKey);

    console.log(`✅ Balances synced successfully for account ${accountId}`);
  }

  /**
   * Create initial PnL transactions for exchange balances
   * 
   * For balances that don't have corresponding transactions, create synthetic "buy" transactions
   * at current market price to establish cost basis for P&L calculations.
   * 
   * @param accountId - Exchange account ID
   * @param userId - User ID
   * @param balances - Current balances from exchange
   */
  private async createInitialTransactionsForBalances(
    accountId: string,
    userId: string,
    balances: CoinDCXBalance[]
  ): Promise<void> {
    const { getTokenPrice } = await import('./price.service');
    
    for (const balance of balances) {
      const quantity = balance.balance;
      
      if (quantity <= 0) continue;
      
      // Check if we already have transactions for this token
      // @ts-ignore - Prisma types will be available after regeneration
      const existingTxCount = await prisma.pnLTransaction.count({
        where: {
          userId,
          walletAddress: `exchange:${accountId}`,
          tokenSymbol: balance.currency,
        }
      });
      
      if (existingTxCount > 0) {
        // Already have transactions for this token, skip
        continue;
      }
      
      // Get current price for the token
      const priceData = await getTokenPrice(balance.currency);
      const priceUsd = priceData ? priceData.priceUsd : 0;
      
      if (priceUsd === 0) {
        console.log(`⚠️  Skipping initial transaction for ${balance.currency} - no price data`);
        continue;
      }
      
      // Create a synthetic "buy" transaction for the current balance
      const txHash = `initial_${accountId}_${balance.currency}_${Date.now()}`;
      
      try {
        await prisma.pnLTransaction.create({
          data: {
            userId,
            walletAddress: `exchange:${accountId}`,
            chain: 'exchange',
            tokenSymbol: balance.currency,
            txType: 'buy',
            quantity: quantity.toString(),
            priceUsd: priceUsd.toString(),
            feeAmount: '0',
            feeToken: balance.currency,
            timestamp: new Date(),
            txHash,
            source: `coindcx:initial_balance`,
          }
        });
        
        console.log(`✅ Created initial transaction for ${quantity} ${balance.currency} @ $${priceUsd}`);
        
      } catch (error: any) {
        if (error.code !== 'P2002') {
          console.error(`⚠️  Error creating initial transaction for ${balance.currency}:`, error.message);
        }
      }
    }
  }

  /**
   * Get aggregated balances for all user's exchange accounts
   * 
   * Returns all active exchange accounts with their balances.
   * Implements caching layer with 5-minute TTL.
   * 
   * @param userId - User ID
   * @returns Array of exchange accounts with balances
   */
  async getUserExchangeBalances(userId: string) {
    console.log(`📊 Fetching exchange balances for user ${userId}...`);

    // Try to get from cache first
    const cacheKey = `${this.CACHE_PREFIX}user:${userId}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      console.log(`✅ Returning cached balances for user ${userId}`);
      return JSON.parse(cached);
    }

    // Fetch from database
    const accounts = await prisma.exchangeAccount.findMany({
      where: { 
        userId, 
        isActive: true 
      },
      include: {
        balances: {
          where: {
            OR: [
              { balance: { not: '0' } },
              { lockedBalance: { not: '0' } },
            ],
          },
          orderBy: {
            valueUsd: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Cache the result
    await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(accounts));

    console.log(`✅ Fetched ${accounts.length} exchange accounts for user ${userId}`);
    return accounts;
  }

  /**
   * Sync trade history for an exchange account
   * 
   * Fetches ALL historical trades from the exchange API and stores them in the database.
   * Fetches trades in batches going back in time to get complete history.
   * Only stores trades that don't already exist.
   * 
   * @param accountId - Exchange account ID
   * @param options - Optional parameters
   * @param options.symbol - Filter by trading pair symbol
   * @param options.limit - Maximum number of trades per batch (default: 500)
   * @param options.maxBatches - Maximum number of batches to fetch (default: 10, max 50)
   * @throws Error if account not found or API call fails
   */
  async syncTradeHistory(
    accountId: string,
    options: { symbol?: string; limit?: number; maxBatches?: number } = {}
  ): Promise<void> {
    console.log(`🔄 Syncing trade history for account ${accountId}...`);

    // Fetch account with credentials
    const account = await prisma.exchangeAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Exchange account not found');
    }

    if (!account.isActive) {
      throw new Error('Exchange account is inactive');
    }

    // Decrypt credentials
    const apiKey = decryptCredential(account.apiKey);
    const apiSecret = decryptCredential(account.apiSecret);

    // Fetch trades from exchange in batches
    const client = new CoinDCXClient({ apiKey, apiSecret });
    const batchSize = options.limit || 500;
    const maxBatches = Math.min(options.maxBatches || 10, 50); // Cap at 50 batches
    
    let allTrades: any[] = [];
    let oldestTimestamp: number | undefined;
    let batchCount = 0;

    console.log(`📊 Fetching trades in batches (max ${maxBatches} batches of ${batchSize} trades each)...`);

    // Fetch trades in batches going back in time
    while (batchCount < maxBatches) {
      try {
        const batchParams: any = {
          symbol: options.symbol,
          limit: batchSize,
        };

        // If we have an oldest timestamp, fetch trades before that
        if (oldestTimestamp) {
          batchParams.to = oldestTimestamp - 1; // Fetch trades before the oldest we've seen
        }

        const trades = await client.getTradeHistory(batchParams);
        
        if (trades.length === 0) {
          console.log(`✅ No more trades to fetch (batch ${batchCount + 1})`);
          break; // No more trades available
        }

        allTrades = allTrades.concat(trades);
        batchCount++;

        // Update oldest timestamp for next batch
        const timestamps = trades.map(t => t.timestamp);
        oldestTimestamp = Math.min(...timestamps);

        console.log(`📥 Batch ${batchCount}: Fetched ${trades.length} trades (oldest: ${new Date(oldestTimestamp).toISOString()})`);

        // If we got fewer trades than requested, we've reached the end
        if (trades.length < batchSize) {
          console.log(`✅ Reached end of trade history (batch ${batchCount})`);
          break;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`❌ Error fetching batch ${batchCount + 1}:`, error.message);
        break; // Stop on error
      }
    }

    console.log(`📈 Fetched total of ${allTrades.length} trades from ${account.provider} across ${batchCount} batches`);

    // Store trades in database (skip duplicates)
    let newTradesCount = 0;
    const insertPromises = allTrades.map(async (trade: CoinDCXTrade) => {
      try {
        await prisma.exchangeTrade.create({
          data: {
            exchangeAccountId: accountId,
            orderId: trade.order_id,
            symbol: trade.symbol,
            side: trade.side,
            price: trade.price.toString(),
            quantity: trade.quantity.toString(),
            fee: trade.fee_amount,
            feeAsset: trade.ecode,
            timestamp: new Date(trade.timestamp),
          },
        });
        newTradesCount++;
      } catch (error: any) {
        // Skip if trade already exists (unique constraint violation)
        if (!error.code || error.code !== 'P2002') {
          console.error(`⚠️  Error storing trade ${trade.order_id}:`, error.message);
        }
      }
    });

    await Promise.all(insertPromises);

    console.log(`✅ Stored ${newTradesCount} new trades for account ${accountId}`);
    
    // Convert exchange trades to transactions for P&L calculation
    await this.convertTradesToTransactions(accountId, account.userId);
  }

  /**
   * Convert exchange trades to PnLTransaction records for P&L calculation
   * 
   * Takes trades from ExchangeTrade table and creates corresponding PnLTransaction records
   * that the P&L engine can process.
   * 
   * @param accountId - Exchange account ID
   * @param userId - User ID
   */
  private async convertTradesToTransactions(accountId: string, userId: string): Promise<void> {
    console.log(`🔄 Converting exchange trades to PnL transactions for account ${accountId}...`);

    // Get all trades for this account
    const trades = await prisma.exchangeTrade.findMany({
      where: { exchangeAccountId: accountId },
      orderBy: { timestamp: 'asc' },
    });

    console.log(`📊 Found ${trades.length} trades to convert`);

    let convertedCount = 0;
    for (const trade of trades) {
      try {
        // Parse symbol to get base and quote currencies
        // Example: BTCUSDT -> BTC (base), USDT (quote)
        const symbolMatch = trade.symbol.match(/^([A-Z]+)(USDT|INR|BTC|ETH)$/);
        if (!symbolMatch) {
          console.warn(`⚠️  Could not parse symbol: ${trade.symbol}`);
          continue;
        }

        const baseCurrency = symbolMatch[1];
        const quoteCurrency = symbolMatch[2];

        // Create transaction record
        // For buy: you receive baseCurrency, spend quoteCurrency
        // For sell: you spend baseCurrency, receive quoteCurrency
        const isBuy = trade.side === 'buy';
        const quantity = parseFloat(trade.quantity);
        const price = parseFloat(trade.price);
        const totalValue = quantity * price;
        const fee = parseFloat(trade.fee || '0');

        // Create a unique transaction hash from trade data
        const txHash = `exchange_${accountId}_${trade.orderId}`;

        await prisma.pnLTransaction.upsert({
          where: { 
            userId_txHash_walletAddress: {
              userId,
              txHash,
              walletAddress: `exchange:${accountId}`,
            }
          },
          create: {
            userId,
            walletAddress: `exchange:${accountId}`,
            chain: 'exchange',
            tokenSymbol: baseCurrency,
            txType: isBuy ? 'buy' : 'sell',
            quantity: quantity.toString(),
            priceUsd: price.toString(),
            feeAmount: fee.toString(),
            feeToken: trade.feeAsset || baseCurrency,
            timestamp: trade.timestamp,
            txHash,
            source: `coindcx:${trade.symbol}`,
          },
          update: {
            // Update if exists (in case trade data changed)
            quantity: quantity.toString(),
            priceUsd: price.toString(),
            feeAmount: fee.toString(),
          },
        });

        convertedCount++;
      } catch (error: any) {
        console.error(`⚠️  Error converting trade ${trade.orderId}:`, error.message);
      }
    }

    console.log(`✅ Converted ${convertedCount} trades to PnL transactions`);
  }

  /**
   * Get balances for a specific exchange account
   * 
   * Returns balances with caching support.
   * 
   * @param accountId - Exchange account ID
   * @param userId - User ID (for authorization)
   * @returns Exchange account with balances
   * @throws Error if account not found or user doesn't own the account
   */
  async getExchangeBalances(accountId: string, userId: string) {
    console.log(`📊 Fetching balances for account ${accountId}...`);

    // Try cache first
    const cacheKey = this.getCacheKey(accountId);
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      console.log(`✅ Returning cached balances for account ${accountId}`);
      return JSON.parse(cached);
    }

    // Verify ownership and fetch from database
    const account = await prisma.exchangeAccount.findFirst({
      where: { 
        id: accountId, 
        userId,
        isActive: true,
      },
      include: {
        balances: {
          where: {
            OR: [
              { balance: { not: '0' } },
              { lockedBalance: { not: '0' } },
            ],
          },
          orderBy: {
            valueUsd: 'desc',
          },
        },
      },
    });

    if (!account) {
      throw new Error('Exchange account not found or access denied');
    }

    // Cache the result
    await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(account));

    console.log(`✅ Fetched balances for account ${accountId}`);
    return account;
  }

  /**
   * Delete (deactivate) an exchange account
   * 
   * Performs soft delete by setting isActive to false.
   * 
   * @param accountId - Exchange account ID
   * @param userId - User ID (for authorization)
   * @throws Error if account not found or user doesn't own the account
   */
  async deleteExchangeAccount(accountId: string, userId: string): Promise<void> {
    console.log(`🗑️  Deleting exchange account ${accountId}...`);

    // Verify ownership
    const account = await prisma.exchangeAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new Error('Exchange account not found or access denied');
    }

    // Soft delete
    await prisma.exchangeAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    // Invalidate caches
    const accountCacheKey = this.getCacheKey(accountId);
    const userCacheKey = `${this.CACHE_PREFIX}user:${userId}`;
    await Promise.all([
      redisClient.del(accountCacheKey),
      redisClient.del(userCacheKey),
    ]);

    console.log(`✅ Exchange account ${accountId} deactivated`);
  }

  /**
   * Get list of user's exchange accounts
   * 
   * Returns basic account information without sensitive data.
   * 
   * @param userId - User ID
   * @returns Array of exchange accounts
   */
  async getUserExchangeAccounts(userId: string) {
    console.log(`📋 Fetching exchange accounts for user ${userId}...`);

    const accounts = await prisma.exchangeAccount.findMany({
      where: { 
        userId, 
        isActive: true 
      },
      select: {
        id: true,
        provider: true,
        nickname: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`✅ Found ${accounts.length} exchange accounts for user ${userId}`);
    return accounts;
  }

  /**
   * Update exchange account nickname
   * 
   * @param accountId - Exchange account ID
   * @param userId - User ID (for authorization)
   * @param nickname - New nickname
   * @throws Error if account not found or user doesn't own the account
   */
  async updateAccountNickname(
    accountId: string,
    userId: string,
    nickname: string
  ): Promise<void> {
    console.log(`✏️  Updating nickname for account ${accountId}...`);

    // Verify ownership
    const account = await prisma.exchangeAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new Error('Exchange account not found or access denied');
    }

    await prisma.exchangeAccount.update({
      where: { id: accountId },
      data: { nickname },
    });

    // Invalidate user cache
    const userCacheKey = `${this.CACHE_PREFIX}user:${userId}`;
    await redisClient.del(userCacheKey);

    console.log(`✅ Nickname updated for account ${accountId}`);
  }
}
