import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ExchangeService } from '../services/exchange.service';
import prisma from '../utils/prisma';

const exchangeService = new ExchangeService();

/**
 * Exchange Controller
 * 
 * Handles HTTP requests for exchange account management.
 * All endpoints require authentication and validate user ownership.
 * 
 * Requirements: Phase 2.2 - Exchange Controller
 */

/**
 * Connect a new exchange account
 * 
 * POST /api/exchange/connect
 * 
 * Request body:
 * - provider: 'coindcx'
 * - apiKey: string
 * - apiSecret: string
 * - nickname: string (optional)
 * 
 * @param req - Authenticated request with user ID
 * @param res - Response with created account (without credentials)
 */
export const connectExchange = async (req: AuthRequest, res: Response) => {
  try {
    const { provider, apiKey, apiSecret, nickname } = req.body;
    const userId = req.userId!;

    console.log('🔗 Connect exchange request:', {
      userId,
      provider,
      nickname,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
    });

    // Validation
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    if (provider !== 'coindcx') {
      return res.status(400).json({ 
        error: 'Invalid provider',
        details: 'Only "coindcx" is currently supported'
      });
    }

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ 
        error: 'API credentials required',
        details: 'Both apiKey and apiSecret must be provided'
      });
    }

    if (typeof apiKey !== 'string' || typeof apiSecret !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid credentials format',
        details: 'API key and secret must be strings'
      });
    }

    if (apiKey.trim().length === 0 || apiSecret.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Invalid credentials',
        details: 'API key and secret cannot be empty'
      });
    }

    // Connect exchange account
    const account = await exchangeService.connectExchange(
      userId,
      provider,
      apiKey.trim(),
      apiSecret.trim(),
      nickname?.trim()
    );

    console.log('✅ Exchange account connected:', account.id);

    // Return account without encrypted credentials
    res.status(201).json({
      id: account.id,
      provider: account.provider,
      nickname: account.nickname,
      isActive: account.isActive,
      lastSyncedAt: account.lastSyncedAt,
      createdAt: account.createdAt,
    });
  } catch (error: any) {
    console.error('❌ Error connecting exchange:', error);
    
    // Handle specific error cases
    if (error.message === 'Invalid API credentials') {
      return res.status(401).json({ 
        error: 'Invalid API credentials',
        details: 'The provided API key and secret could not be validated with CoinDCX'
      });
    }

    res.status(500).json({ 
      error: 'Failed to connect exchange',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all exchange accounts for the authenticated user
 * 
 * GET /api/exchange/accounts
 * 
 * @param req - Authenticated request with user ID
 * @param res - Response with list of accounts (without credentials)
 */
export const getExchangeAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    console.log('📋 Fetching exchange accounts for user:', userId);

    const accounts = await exchangeService.getUserExchangeAccounts(userId);

    console.log(`✅ Found ${accounts.length} exchange accounts`);

    res.json(accounts);
  } catch (error: any) {
    console.error('❌ Error fetching exchange accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch accounts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Sync balances for a specific exchange account
 * 
 * POST /api/exchange/accounts/:id/sync
 * 
 * @param req - Authenticated request with user ID and account ID in params
 * @param res - Response with success status
 */
export const syncExchangeBalances = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const accountId = id as string;

    console.log('🔄 Sync balances request:', {
      accountId,
      userId,
    });

    // Validation
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Verify ownership before syncing
    // @ts-ignore - exchangeAccount model will be available after database migration
    const account = await prisma.exchangeAccount.findFirst({
      where: { 
        id: accountId, 
        userId,
        isActive: true,
      },
    });

    if (!account) {
      console.log('❌ Account not found or unauthorized');
      return res.status(404).json({ 
        error: 'Account not found',
        details: 'Exchange account not found or you do not have permission to access it'
      });
    }

    // Sync balances
    await exchangeService.syncBalances(accountId);

    console.log('✅ Balances synced successfully');

    res.json({ 
      success: true,
      message: 'Balances synced successfully',
      lastSyncedAt: new Date(),
    });
  } catch (error: any) {
    console.error('❌ Error syncing balances:', error);
    
    // Handle specific error cases
    if (error.message === 'Exchange account is inactive') {
      return res.status(400).json({ 
        error: 'Account inactive',
        details: 'This exchange account has been deactivated'
      });
    }

    res.status(500).json({ 
      error: 'Failed to sync balances',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete (deactivate) an exchange account
 * 
 * DELETE /api/exchange/accounts/:id
 * 
 * @param req - Authenticated request with user ID and account ID in params
 * @param res - Response with success status
 */
export const deleteExchangeAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const accountId = id as string;

    console.log('🗑️  Delete exchange account request:', {
      accountId,
      userId,
    });

    // Validation
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Delete account (service handles ownership verification)
    await exchangeService.deleteExchangeAccount(accountId, userId);

    console.log('✅ Exchange account deleted successfully');

    res.json({
      success: true,
      message: 'Exchange account removed successfully',
    });
  } catch (error: any) {
    console.error('❌ Error deleting exchange account:', error);
    
    // Handle specific error cases
    if (error.message === 'Exchange account not found or access denied') {
      return res.status(404).json({ 
        error: 'Account not found',
        details: 'Exchange account not found or you do not have permission to delete it'
      });
    }

    res.status(500).json({ 
      error: 'Failed to delete account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get balances for a specific exchange account
 * 
 * GET /api/exchange/accounts/:id/balances
 * 
 * @param req - Authenticated request with user ID and account ID in params
 * @param res - Response with account and balances
 */
export const getExchangeBalances = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const accountId = id as string;

    console.log('📊 Get exchange balances request:', {
      accountId,
      userId,
    });

    // Validation
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Get balances (service handles ownership verification)
    const account = await exchangeService.getExchangeBalances(accountId, userId);

    console.log(`✅ Fetched ${account.balances?.length || 0} balances`);

    // Remove sensitive data before sending response
    const response = {
      id: account.id,
      provider: account.provider,
      nickname: account.nickname,
      isActive: account.isActive,
      lastSyncedAt: account.lastSyncedAt,
      balances: account.balances,
    };

    res.json(response);
  } catch (error: any) {
    console.error('❌ Error fetching exchange balances:', error);
    
    // Handle specific error cases
    if (error.message === 'Exchange account not found or access denied') {
      return res.status(404).json({ 
        error: 'Account not found',
        details: 'Exchange account not found or you do not have permission to access it'
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch balances',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Sync trade history for a specific exchange account
 * 
 * POST /api/exchange/accounts/:id/sync-trades
 * 
 * Query parameters:
 * - symbol: Trading pair symbol (optional)
 * - limit: Trades per batch (optional, default: 500)
 * - maxBatches: Maximum batches to fetch (optional, default: 10, max: 50)
 * 
 * @param req - Authenticated request with user ID and account ID in params
 * @param res - Response with sync status and trade count
 */
export const syncTradeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const accountId = id as string;
    const { symbol, limit, maxBatches } = req.query;

    console.log('🔄 Sync trade history request:', {
      accountId,
      userId,
      symbol,
      limit,
      maxBatches,
    });

    // Validation
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Verify ownership before syncing
    // @ts-ignore - Prisma types will be available after regeneration
    const account = await prisma.exchangeAccount.findFirst({
      where: { 
        id: accountId, 
        userId,
        isActive: true,
      },
    });

    if (!account) {
      console.log('❌ Account not found or unauthorized');
      return res.status(404).json({ 
        error: 'Account not found',
        details: 'Exchange account not found or you do not have permission to access it'
      });
    }

    // Parse and validate query parameters
    const options: any = {};
    
    if (symbol) {
      options.symbol = symbol as string;
    }
    
    if (limit) {
      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
        return res.status(400).json({ 
          error: 'Invalid limit',
          details: 'Limit must be between 1 and 500'
        });
      }
      options.limit = limitNum;
    }
    
    if (maxBatches) {
      const maxBatchesNum = parseInt(maxBatches as string);
      if (isNaN(maxBatchesNum) || maxBatchesNum < 1 || maxBatchesNum > 50) {
        return res.status(400).json({ 
          error: 'Invalid maxBatches',
          details: 'maxBatches must be between 1 and 50'
        });
      }
      options.maxBatches = maxBatchesNum;
    }

    // Sync trade history
    await exchangeService.syncTradeHistory(accountId, options);

    // Get trade count for response
    // @ts-ignore - Prisma types will be available after regeneration
    const tradeCount = await prisma.exchangeTrade.count({
      where: { exchangeAccountId: accountId },
    });

    console.log('✅ Trade history synced successfully');

    res.json({ 
      success: true,
      message: 'Trade history synced successfully',
      tradeCount,
      lastSyncedAt: new Date(),
    });
  } catch (error: any) {
    console.error('❌ Error syncing trade history:', error);
    
    // Handle specific error cases
    if (error.message === 'Exchange account is inactive') {
      return res.status(400).json({ 
        error: 'Account inactive',
        details: 'This exchange account has been deactivated'
      });
    }

    res.status(500).json({ 
      error: 'Failed to sync trade history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get trade history for a specific exchange account
 * 
 * GET /api/exchange/accounts/:id/trades
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - symbol: Filter by trading pair (optional)
 * - side: Filter by side (buy/sell) (optional)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 * 
 * @param req - Authenticated request with user ID and account ID in params
 * @param res - Response with paginated trade history
 */
export const getTradeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const accountId = id as string;

    console.log('📊 Get trade history request:', {
      accountId,
      userId,
      query: req.query,
    });

    // Validation
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Verify ownership
    // @ts-ignore - Prisma types will be available after regeneration
    const account = await prisma.exchangeAccount.findFirst({
      where: { 
        id: accountId, 
        userId,
        isActive: true,
      },
    });

    if (!account) {
      console.log('❌ Account not found or unauthorized');
      return res.status(404).json({ 
        error: 'Account not found',
        details: 'Exchange account not found or you do not have permission to access it'
      });
    }

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const symbol = req.query.symbol as string;
    const side = req.query.side as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Validate pagination
    if (page < 1 || limit < 1) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters',
        details: 'Page and limit must be >= 1'
      });
    }

    // Validate side if provided
    if (side && !['buy', 'sell'].includes(side)) {
      return res.status(400).json({ 
        error: 'Invalid side',
        details: 'Side must be "buy" or "sell"'
      });
    }

    // Build where clause
    const where: any = { exchangeAccountId: accountId };

    if (symbol) {
      where.symbol = symbol.toUpperCase();
    }

    if (side) {
      where.side = side;
    }

    // Date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({ 
            error: 'Invalid startDate format',
            details: 'startDate must be a valid ISO 8601 date string'
          });
        }
        where.timestamp.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({ 
            error: 'Invalid endDate format',
            details: 'endDate must be a valid ISO 8601 date string'
          });
        }
        where.timestamp.lte = end;
      }
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Fetch trades with pagination
    // @ts-ignore - Prisma types will be available after regeneration
    const [trades, total] = await Promise.all([
      // @ts-ignore
      prisma.exchangeTrade.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      // @ts-ignore
      prisma.exchangeTrade.count({ where }),
    ]);

    // Serialize trades for JSON response
    const serializedTrades = trades.map((trade: any) => ({
      id: trade.id,
      orderId: trade.orderId,
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      quantity: trade.quantity,
      fee: trade.fee,
      feeAsset: trade.feeAsset,
      timestamp: trade.timestamp.toISOString(),
      createdAt: trade.createdAt.toISOString(),
    }));

    console.log(`✅ Fetched ${trades.length} trades (page ${page}/${Math.ceil(total / limit)})`);

    res.json({
      trades: serializedTrades,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('❌ Error fetching trade history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trade history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Validation middleware for exchange requests
 * 
 * Validates common request parameters and body fields
 */
export const validateExchangeRequest = (req: AuthRequest, res: Response, next: any) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};
