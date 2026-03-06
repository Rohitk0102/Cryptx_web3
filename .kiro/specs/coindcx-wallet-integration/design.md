# CoinDCX Wallet Integration - Design Document

## Architecture Overview

### System Components

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│   Backend API   │
│  (Express.js)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│ Prisma│ │ CoinDCX │
│   DB  │ │   API   │
└───────┘ └─────────┘
```

## Database Schema

### New Tables

#### ExchangeAccount
```prisma
model ExchangeAccount {
  id            String   @id @default(cuid())
  userId        String
  provider      String   // 'coindcx'
  apiKey        String   // Encrypted
  apiSecret     String   // Encrypted
  nickname      String?
  isActive      Boolean  @default(true)
  lastSyncedAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  balances      ExchangeBalance[]
  trades        ExchangeTrade[]
  
  @@unique([userId, provider, apiKey])
  @@index([userId, isActive])
}
```

#### ExchangeBalance
```prisma
model ExchangeBalance {
  id                String          @id @default(cuid())
  exchangeAccountId String
  symbol            String          // 'BTC', 'ETH', etc.
  balance           String          // Total balance
  lockedBalance     String          // Locked in orders
  availableBalance  String          // Available for trading
  valueUsd          Float           @default(0)
  lastUpdated       DateTime        @default(now())
  
  exchangeAccount   ExchangeAccount @relation(fields: [exchangeAccountId], references: [id], onDelete: Cascade)
  
  @@unique([exchangeAccountId, symbol])
  @@index([exchangeAccountId])
}
```

#### ExchangeTrade
```prisma
model ExchangeTrade {
  id                String          @id @default(cuid())
  exchangeAccountId String
  orderId           String
  symbol            String          // 'BTCUSDT'
  side              String          // 'buy' or 'sell'
  price             String
  quantity          String
  fee               String
  feeAsset          String
  timestamp         DateTime
  createdAt         DateTime        @default(now())
  
  exchangeAccount   ExchangeAccount @relation(fields: [exchangeAccountId], references: [id], onDelete: Cascade)
  
  @@unique([exchangeAccountId, orderId])
  @@index([exchangeAccountId, timestamp])
}
```

## Backend Implementation

### 1. CoinDCX API Client (`coindcxClient.ts`)

```typescript
interface CoinDCXConfig {
  apiKey: string;
  apiSecret: string;
}

interface CoinDCXBalance {
  currency: string;
  balance: number;
  locked_balance: number;
}

class CoinDCXClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string = 'https://api.coindcx.com';
  
  constructor(config: CoinDCXConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }
  
  // Generate authentication signature
  private generateSignature(body: string, timestamp: number): string {
    const payload = `${timestamp}${body}`;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
  }
  
  // Get all balances
  async getBalances(): Promise<CoinDCXBalance[]> {
    const timestamp = Date.now();
    const body = JSON.stringify({ timestamp });
    const signature = this.generateSignature(body, timestamp);
    
    const response = await fetch(`${this.baseUrl}/exchange/v1/users/balances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': this.apiKey,
        'X-AUTH-SIGNATURE': signature,
      },
      body,
    });
    
    if (!response.ok) {
      throw new Error(`CoinDCX API error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Get trade history
  async getTradeHistory(params: {
    symbol?: string;
    limit?: number;
  }): Promise<any[]> {
    const timestamp = Date.now();
    const body = JSON.stringify({ ...params, timestamp });
    const signature = this.generateSignature(body, timestamp);
    
    const response = await fetch(`${this.baseUrl}/exchange/v1/orders/trade_history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': this.apiKey,
        'X-AUTH-SIGNATURE': signature,
      },
      body,
    });
    
    if (!response.ok) {
      throw new Error(`CoinDCX API error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Validate API credentials
  async validateCredentials(): Promise<boolean> {
    try {
      await this.getBalances();
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### 2. Encryption Service (`exchangeEncryption.ts`)

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.EXCHANGE_ENCRYPTION_KEY!; // 32 bytes

export function encryptCredential(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptCredential(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 3. Exchange Service (`exchange.service.ts`)

```typescript
import { CoinDCXClient } from './coindcxClient';
import { encryptCredential, decryptCredential } from './exchangeEncryption';
import prisma from '../utils/prisma';

export class ExchangeService {
  // Connect new exchange account
  async connectExchange(
    userId: string,
    provider: 'coindcx',
    apiKey: string,
    apiSecret: string,
    nickname?: string
  ) {
    // Validate credentials
    const client = new CoinDCXClient({ apiKey, apiSecret });
    const isValid = await client.validateCredentials();
    
    if (!isValid) {
      throw new Error('Invalid API credentials');
    }
    
    // Encrypt credentials
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
    
    // Fetch initial balances
    await this.syncBalances(account.id);
    
    return account;
  }
  
  // Sync balances for an exchange account
  async syncBalances(accountId: string) {
    const account = await prisma.exchangeAccount.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      throw new Error('Exchange account not found');
    }
    
    // Decrypt credentials
    const apiKey = decryptCredential(account.apiKey);
    const apiSecret = decryptCredential(account.apiSecret);
    
    // Fetch balances from CoinDCX
    const client = new CoinDCXClient({ apiKey, apiSecret });
    const balances = await client.getBalances();
    
    // Update database
    for (const balance of balances) {
      if (parseFloat(balance.balance) > 0) {
        await prisma.exchangeBalance.upsert({
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
            availableBalance: (balance.balance - balance.locked_balance).toString(),
          },
          update: {
            balance: balance.balance.toString(),
            lockedBalance: balance.locked_balance.toString(),
            availableBalance: (balance.balance - balance.locked_balance).toString(),
            lastUpdated: new Date(),
          },
        });
      }
    }
    
    // Update last synced timestamp
    await prisma.exchangeAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });
  }
  
  // Get aggregated balances for user
  async getUserExchangeBalances(userId: string) {
    const accounts = await prisma.exchangeAccount.findMany({
      where: { userId, isActive: true },
      include: {
        balances: {
          where: {
            balance: { not: '0' },
          },
        },
      },
    });
    
    return accounts;
  }
}
```

### 4. Exchange Controller (`exchange.controller.ts`)

```typescript
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ExchangeService } from '../services/exchange.service';

const exchangeService = new ExchangeService();

export const connectExchange = async (req: AuthRequest, res: Response) => {
  try {
    const { provider, apiKey, apiSecret, nickname } = req.body;
    const userId = req.userId!;
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'API credentials required' });
    }
    
    const account = await exchangeService.connectExchange(
      userId,
      provider,
      apiKey,
      apiSecret,
      nickname
    );
    
    // Don't return encrypted credentials
    res.json({
      id: account.id,
      provider: account.provider,
      nickname: account.nickname,
      createdAt: account.createdAt,
    });
  } catch (error: any) {
    console.error('Error connecting exchange:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getExchangeAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    const accounts = await prisma.exchangeAccount.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        provider: true,
        nickname: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    });
    
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching exchange accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

export const syncExchangeBalances = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    // Verify ownership
    const account = await prisma.exchangeAccount.findFirst({
      where: { id, userId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await exchangeService.syncBalances(id);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error syncing balances:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteExchangeAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    // Verify ownership
    const account = await prisma.exchangeAccount.findFirst({
      where: { id, userId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Soft delete
    await prisma.exchangeAccount.update({
      where: { id },
      data: { isActive: false },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting exchange account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
```

## Frontend Implementation

### 1. CoinDCX Connection Component

```typescript
// apps/web/components/exchange/ConnectCoinDCX.tsx

interface ConnectCoinDCXProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function ConnectCoinDCX({ onSuccess, onClose }: ConnectCoinDCXProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleConnect = async () => {
    setLoading(true);
    setError('');
    
    try {
      await exchangeApi.connect({
        provider: 'coindcx',
        apiKey,
        apiSecret,
        nickname,
      });
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6">
      <h3>Connect CoinDCX Account</h3>
      
      <div className="space-y-4 mt-4">
        <input
          type="text"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        
        <input
          type="password"
          placeholder="API Secret"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
        />
        
        <input
          type="text"
          placeholder="Nickname (optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        
        {error && <div className="text-error">{error}</div>}
        
        <button onClick={handleConnect} disabled={loading}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  );
}
```

### 2. Update Wallet Connection Modal

Add CoinDCX option to existing wallet options:

```typescript
const walletOptions = [
  // ... existing options
  {
    name: 'CoinDCX',
    description: 'Connect your CoinDCX exchange account',
    logo: <CoinDCXLogo />,
    providerType: 'coindcx' as const,
  }
];
```

### 3. Portfolio Integration

Update portfolio service to include exchange balances:

```typescript
// Aggregate both wallet and exchange balances
const [walletBalances, exchangeBalances] = await Promise.all([
  getWalletBalances(userId),
  getExchangeBalances(userId),
]);

// Merge and display
const allAssets = mergeAssets(walletBalances, exchangeBalances);
```

## API Routes

```typescript
// apps/api/src/routes/exchange.routes.ts

router.post('/exchange/connect', auth, connectExchange);
router.get('/exchange/accounts', auth, getExchangeAccounts);
router.post('/exchange/accounts/:id/sync', auth, syncExchangeBalances);
router.delete('/exchange/accounts/:id', auth, deleteExchangeAccount);
router.get('/exchange/accounts/:id/balances', auth, getExchangeBalances);
router.get('/exchange/accounts/:id/trades', auth, getExchangeTrades);
```

## Security Considerations

1. **Encryption Key Management**
   - Store in environment variable
   - Rotate periodically
   - Never commit to version control

2. **API Key Permissions**
   - Recommend read-only API keys
   - Display warning about permissions
   - Validate key permissions on connection

3. **Rate Limiting**
   - Implement per-user rate limits
   - Cache aggressively
   - Queue requests

4. **Audit Logging**
   - Log all credential access
   - Log all API calls
   - Monitor for suspicious activity

## Testing Strategy

1. **Unit Tests**
   - Encryption/decryption functions
   - CoinDCX client methods
   - Service layer logic

2. **Integration Tests**
   - API endpoint testing
   - Database operations
   - CoinDCX API mocking

3. **Security Tests**
   - Credential encryption
   - Authorization checks
   - SQL injection prevention

## Deployment Checklist

- [ ] Generate and set EXCHANGE_ENCRYPTION_KEY
- [ ] Run database migrations
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test with real CoinDCX account
- [ ] Monitor error rates
- [ ] Set up alerts for API failures

## Future Enhancements

1. Support for multiple exchanges (Binance, WazirX, Kraken)
2. Trading functionality
3. Automated portfolio rebalancing
4. Tax reporting
5. Price alerts
6. Advanced analytics
