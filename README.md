<div align="center">

# ₿ CryptX — Crypto Portfolio Tracker

**A full-stack Web3 portfolio tracker with real-time analytics, AI forecasting, CEX integration, and on-chain wallet support.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-green?style=flat-square&logo=express)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## 📌 Overview

**CryptX** is a production-grade cryptocurrency portfolio tracker that unifies your on-chain wallets and centralized exchange (CEX) accounts into a single, real-time dashboard. It features Sign-In with Ethereum (SIWE) authentication, Clerk user management, live P&L tracking, AI-powered price forecasting, and transaction history — all wrapped in a premium dark-themed UI.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Web3 Authentication** | Sign-In with Ethereum (SIWE) + Clerk auth integration |
| 👛 **Multi-Wallet Support** | Connect MetaMask, WalletConnect, and Coinbase Wallet |
| 🏦 **CEX Integration** | Link exchange accounts (API key-based, encrypted at rest) |
| 📊 **Portfolio Dashboard** | Real-time aggregated portfolio across wallets & exchanges |
| 💰 **P&L Tracking** | Realized & unrealized profit/loss with trade history |
| 📈 **Token Tracking** | Live token prices powered by CoinGecko API |
| 🔮 **AI Forecasting** | Price trend predictions using ML-based forecasting service |
| 🔄 **Transaction History** | Full on-chain and CEX transaction records |
| 🔒 **Secure Key Storage** | AES-256-GCM encryption for all exchange API credentials |
| ⚡ **Redis Caching** | Fast responses with intelligent price & portfolio caching |

---

## 🏗️ Architecture

```
CryptX_web3/
├── apps/
│   ├── web/                    # Next.js 16 Frontend
│   │   ├── app/                # App Router pages
│   │   │   └── dashboard/      # Protected dashboard routes
│   │   │       ├── portfolio/  # Portfolio overview
│   │   │       ├── tracking/   # Token tracking
│   │   │       ├── transactions/ # Transaction history
│   │   │       ├── pnl/        # P&L analysis
│   │   │       └── forecasting/ # AI price forecasting
│   │   ├── components/         # Reusable UI components
│   │   │   ├── dashboard/      # Dashboard widgets
│   │   │   ├── charts/         # Recharts-based visualizations
│   │   │   ├── wallet/         # Wallet connection UI
│   │   │   └── exchange/       # CEX connection UI
│   │   ├── lib/                # API client & utilities
│   │   ├── hooks/              # React custom hooks
│   │   └── store/              # Zustand state management
│   │
│   └── api/                    # Express 5 Backend
│       ├── src/
│       │   ├── controllers/    # Route controllers
│       │   ├── routes/         # API route definitions
│       │   ├── services/       # Business logic & integrations
│       │   ├── middleware/      # Auth & validation middleware
│       │   └── utils/          # Helpers & encryption utilities
│       └── prisma/             # Database schema & migrations
│
├── docker-compose.yml          # Local PostgreSQL & Redis setup
├── start.sh                    # One-command startup script (macOS/Linux)
├── start.bat                   # One-command startup script (Windows)
└── package.json                # npm workspace root
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16 | React framework with App Router |
| TypeScript | 5 | Type safety |
| TailwindCSS | 4 | Utility-first styling |
| Recharts | 3 | Chart visualizations |
| Zustand | 5 | Lightweight state management |
| Clerk | 6 | User authentication & session |
| ethers.js | 6 | Ethereum wallet interactions |
| SIWE | 3 | Sign-In with Ethereum |
| WalletConnect | 2 | Multi-wallet modal |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Express | 5 | REST API server |
| TypeScript | 5 | Type safety |
| Prisma | 5 | ORM & database migrations |
| PostgreSQL | — | Primary database |
| Redis (ioredis) | 5 | Caching layer |
| Clerk Backend SDK | 2 | Server-side auth verification |
| CoinGecko API | — | Live token prices |
| AES-256-GCM | — | Exchange API key encryption |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** database (local or cloud: [Supabase](https://supabase.com), [Neon](https://neon.tech), [Railway](https://railway.app))
- **Redis** instance (local or cloud: [Upstash](https://upstash.com), [Redis Cloud](https://redis.com/redis-enterprise-cloud/overview/))
- **MetaMask** browser extension
- **Clerk** account → [clerk.com](https://clerk.com)
- **WalletConnect** Project ID → [cloud.walletconnect.com](https://cloud.walletconnect.com)

---

### 1. Clone & Install

```bash
git clone https://github.com/Rohitk0102/Cryptx-Crypto_Portfolio_Tracker.git
cd Cryptx_web3

# Install all workspace dependencies
npm install
npm run install:all
```

---

### 2. Configure Backend (`apps/api/.env`)

Copy the example and fill in your values:

```bash
cp apps/api/.env.example apps/api/.env
```

```env
# ── Database ──────────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# ── Redis ──────────────────────────────────────────────────────
REDIS_URL="redis://default:password@host:6379"

# ── Authentication ─────────────────────────────────────────────
JWT_SECRET="your-secure-32-character-secret"
REFRESH_TOKEN_SECRET="your-secure-32-character-refresh-secret"
CLERK_SECRET_KEY="sk_test_..."         # From clerk.com dashboard

# ── Encryption (MUST be exactly 32 characters) ─────────────────
ENCRYPTION_KEY="your-exactly-32-character-key!!"

# ── Blockchain RPC ─────────────────────────────────────────────
ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"
BSC_RPC_URL="https://bsc-dataseed.binance.org/"

# ── Server ─────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development
```

---

### 3. Configure Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...    # From clerk.com dashboard
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

---

### 4. Run Database Migrations

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
```

---

### 5. Start Development Servers

**Option A — One command (recommended):**
```bash
# macOS / Linux
./start.sh

# Windows
start.bat
```

**Option B — Manual:**
```bash
# From root
npm run dev
```

This starts:
- 🌐 **Frontend**: http://localhost:3000
- ⚙️ **Backend API**: http://localhost:5000

---

## 🔐 Authentication Flow

```
User visits app
  └─> Clerk handles sign-in (email / social / Web3)
        └─> User connects crypto wallet (MetaMask / WalletConnect)
              └─> Backend generates SIWE nonce
                    └─> User signs message in wallet
                          └─> Backend verifies signature
                                └─> JWT access + refresh tokens issued
                                      └─> Wallet linked to Clerk user ID
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/nonce` | Generate SIWE nonce |
| `POST` | `/api/auth/verify` | Verify wallet signature |
| `POST` | `/api/auth/refresh` | Refresh JWT token |
| `POST` | `/api/auth/logout` | Logout user |
| `GET` | `/api/wallet` | List connected wallets |
| `POST` | `/api/wallet` | Add new wallet |
| `DELETE` | `/api/wallet/:id` | Remove wallet |
| `GET` | `/api/portfolio` | Get aggregated portfolio |
| `GET` | `/api/portfolio/sync` | Trigger portfolio sync |
| `GET` | `/api/exchange` | List exchange connections |
| `POST` | `/api/exchange` | Add exchange connection |
| `GET` | `/api/transactions` | Get transaction history |
| `GET` | `/api/pnl` | Get P&L report |
| `GET` | `/api/forecasting/:symbol` | Get AI price forecast |

---

## 🗄️ Database Schema

```
User ──────────┬── Wallet (on-chain wallets)
               ├── ExchangeConnection (CEX API keys, encrypted)
               ├── Session (JWT refresh tokens)
               ├── PortfolioSnapshot (cached portfolio state)
               └── PriceCache (token prices from CoinGecko)
```

---

## 🔒 Security

- ✅ **Non-custodial** — no private keys ever stored
- ✅ **SIWE** — cryptographic wallet authentication
- ✅ **AES-256-GCM** — exchange API keys encrypted at rest
- ✅ **JWT + refresh tokens** — secure session management
- ✅ **Nonce invalidation** — prevents replay attacks
- ✅ **Helmet.js** — HTTP security headers
- ✅ **Rate limiting** — API abuse prevention
- ✅ **CORS** — origin whitelist protection

---

## 🌐 Supported Networks

| Chain | Symbol | RPC Provider |
|---|---|---|
| Ethereum | ETH | Alchemy / Infura |
| Polygon | MATIC | Alchemy / Infura |
| BNB Smart Chain | BNB | Binance Public RPC |

---

## 📦 Available Scripts

```bash
# Development
npm run dev              # Start frontend + backend together
npm run dev:web          # Start frontend only (port 3000)
npm run dev:api          # Start backend only (port 5000)

# Build
npm run build            # Build all workspaces for production

# Database
cd apps/api
npx prisma studio        # Open Prisma Studio GUI
npx prisma migrate dev   # Run pending migrations
npx prisma generate      # Regenerate Prisma client
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ using Next.js, Express, and Web3 technologies.

</div>
