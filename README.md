<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Node.js-20-green.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-18-61DAFB.svg" alt="React" />
  <img src="https://img.shields.io/badge/Expo-52-000020.svg" alt="Expo" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791.svg" alt="PostgreSQL" />
</p>

# FinTrack 💰

**The ultimate open-source personal finance tracker.** Manage investments, track expenses, and visualize your net worth with total privacy and control. Self-hostable, API-first, and built for power users.

## ✨ Features

### Core Functionality

- **Double-Entry Accounting** - Professional accounting logic under the hood. Every transaction has a source and destination, ensuring your books always balance perfectly.
- **Multi-Asset Tracking** - Stocks, Crypto, Mutual Funds, Real Estate, Cash, Bank Accounts. Track your entire net worth in one unified dashboard.
- **Real-Time Market Prices** - Live price updates for your investment portfolio.
- **Net Worth History** - Track your wealth over time with automatic daily snapshots and beautiful charts.

### Web Dashboard

- **Overview Tab** - Dashboard with net worth, asset allocation, and quick stats.
- **Income & Expenses Tab** - Categorized income and expense tracking.
- **Investments Tab** - Portfolio management with real-time valuations, profit/loss tracking, and average buy price calculations.
- **Bank & Cash Tab** - Manage bank accounts, wallets, and cash positions.
- **Chart of Accounts Tab** - Full accounting chart with all account types (Asset, Liability, Income, Expense, Equity).
- **Debts Tab** - Track loans, credit cards, and liabilities with interest rates and due dates.
- **Transactions Tab** - Complete transaction journal with split transaction support.
- **Ledger View** - Per-account ledger with running balance, date filtering, and Excel export.
- **Profile & Settings** - Session management, data export/import, and account security.

### Mobile App

- **Full Feature Parity** - All core functionality available on mobile.
- **🤖 AI-Powered Automation** - Uses Gemini AI to intelligently process bank notifications and auto-draft transactions.
- **Notification Listener** - Automatically captures bank SMS/notifications (Android only).
- **Draft Review System** - AI-drafted transactions go to a review queue for approval.
- **Local Data Mode** - Option to store data locally on device with SQLite (no cloud account required).
- **Biometric Authentication** - Secure access with fingerprint/Face ID.

### Data Management

- **Excel Import** - Bulk import transactions from Excel with smart category matching.
- **Excel Export** - Export ledgers and transaction data to Excel format.
- **JSON Backup** - Full data export/import for backup and migration.
- **Template Download** - Pre-configured Excel templates with dropdowns for easy data entry.

### Security & Privacy

- **Self-Hosted** - Deploy on your own server using Docker.
- **JWT Authentication** - Secure access with refresh token rotation.
- **Session Management** - View and revoke active sessions across devices.
- **Email Verification** - Secure account creation with email verification.
- **Password Reset** - Secure password recovery via email.
- **Rate Limiting** - Protection against brute-force attacks.
- **100% Open Source** - Full transparent.

### Developer Features

- **REST API** - Comprehensive API for automation and integrations.
- **API Documentation** - Built-in interactive API docs at `/api-docs`.
- **n8n/Zapier Ready** - Connect with automation platforms.

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL with Prisma ORM |
| **Frontend** | React, Vite, TailwindCSS, shadcn/ui |
| **Mobile** | React Native, Expo, NativeWind |
| **AI** | Google Gemini (for transaction parsing) |
| **Auth** | JWT with refresh token rotation |
| **Email** | Nodemailer with SMTP |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/subinps/fintrack.git
   cd fintrack
   ```

2. **Setup Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database URL and secrets
   npm install
   npx prisma generate
   npx prisma db push
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your API URL
   npm install
   npm run dev
   ```

4. **Setup Mobile (Optional)**
   ```bash
   cd mobile
   cp .env.example .env
   # Edit .env with your API URL
   npm install
   npm start
   ```

### Environment Variables

#### Backend (.env)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/fintrack"
JWT_SECRET="your-super-secret-key"
APP_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"
SMTP_HOST="smtp.example.com"
SMTP_PORT=465
SMTP_USER="your-email@example.com"
SMTP_PASS="your-email-password"
```

#### Frontend (.env)
```env
VITE_API_URL="http://localhost:3000/api"
```

#### Mobile (.env)
```env
EXPO_PUBLIC_API_URL="http://your-server:3000"
```

---

## 🐳 Docker Deployment

### Using Docker

```bash
docker build -t fintrack .
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  fintrack
```

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://postgres:password@db:5432/fintrack"
      JWT_SECRET: "your-super-secret-key"
      APP_URL: "https://your-domain.com"
      SMTP_HOST: "smtp.example.com"
      SMTP_PORT: 465
      SMTP_USER: "your-email"
      SMTP_PASS: "your-password"
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: fintrack
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run:
```bash
docker-compose up -d
```

---

## 📱 Mobile App Setup

### Building for Android

1. Configure EAS:
   ```bash
   cd mobile
   npx eas build:configure
   ```

2. Build APK:
   ```bash
   npx eas build -p android --profile preview
   ```

### AI Automation Setup (Android Only)

1. Enable Notification Access in system settings.
2. Go to **Automation → Settings** in the app.
3. Add your Gemini API key.
4. Configure which apps to monitor (e.g., bank apps).
5. Select keywords to filter relevant notifications.

---

## 📊 API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Register new user |
| `POST /api/auth/login` | Login and get tokens |
| `POST /api/auth/refresh` | Refresh access token |
| `GET /api/accounts` | List all accounts |
| `POST /api/accounts` | Create account |
| `GET /api/accounts/:id/ledger` | Get account ledger |
| `GET /api/transactions` | List transactions |
| `POST /api/transactions` | Create transaction |
| `GET /api/analytics/net-worth-history` | Net worth over time |
| `GET /api/price/:symbol` | Get market price |
| `GET /api/user-data/export` | Export all data |
| `POST /api/user-data/import` | Import data backup |

Full API documentation available at `/api-docs` when running the application.

---

## 📁 Project Structure

```
fintrack/
├── backend/                # Express.js API server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth middleware
│   │   ├── lib/            # Utilities
│   │   └── index.ts        # Entry point
│   └── prisma/             # Database schema
├── frontend/               # React web dashboard
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # React Query hooks
│   │   └── context/        # Auth context
│   └── public/
├── mobile/                 # Expo React Native app
│   ├── app/                # Screens (Expo Router)
│   │   ├── (tabs)/         # Tab screens
│   │   ├── automation/     # AI automation screens
│   │   └── settings/       # Settings screens
│   └── src/
│       ├── services/       # API & Gemini services
│       └── hooks/          # React Query hooks
├── Dockerfile              # Multi-stage Docker build
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Expo](https://expo.dev/) - React Native framework
---

<p align="center">
  Made with ❤️ by <a href="https://github.com/subinps">SUBIN</a>
</p>
