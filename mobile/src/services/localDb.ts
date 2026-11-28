import { Platform } from 'react-native';

// expo-sqlite has no web build: the offline cache is native-only, and web
// users are served by the API, so the helpers degrade to no-ops there.
const isWeb = Platform.OS === 'web';
const db: any = isWeb ? null : require('expo-sqlite').openDatabaseSync('fintrack.db');

export const initDb = () => {
  if (isWeb) return;
  // Create tables
  db.execSync(`
    PRAGMA journal_mode = WAL;

    -- Accounts Table (Matches Backend Account Model)
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
      sub_type TEXT,
      balance REAL NOT NULL DEFAULT 0, -- Cached balance (sum of splits)
      currency TEXT NOT NULL DEFAULT 'INR',
      is_archived INTEGER DEFAULT 0,
      
      -- Extended Fields
      interest_rate REAL,
      due_date TEXT,
      symbol TEXT,
      units REAL,
      last_market_price REAL,
      last_market_update TEXT
    );

    -- Categories Table (Matches Backend Category Model)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL
    );

    -- Transactions Table (Header only)
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'COMPLETED'
    );

    -- Transaction Splits Table (Double-Entry)
    CREATE TABLE IF NOT EXISTS transaction_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      amount REAL NOT NULL, -- Stored as REAL for simplicity in SQLite, but represents BigInt cents in logic
      units REAL, -- For investment transactions
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts (id)
    );

    -- Market Prices Table
    CREATE TABLE IF NOT EXISTS market_prices (
      symbol TEXT PRIMARY KEY,
      price REAL NOT NULL,
      last_updated TEXT NOT NULL
    );

    -- Net Worth Snapshots Table
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      net_worth REAL NOT NULL,
      assets REAL NOT NULL,
      liabilities REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
};

// Helper to run queries
export const runQuery = async (query: string, params: any[] = []) => {
  return isWeb ? [] : await db.getAllAsync(query, params);
};

export const runRun = async (query: string, params: any[] = []) => {
  return isWeb ? null : await db.runAsync(query, params);
};

export const getFirst = async (query: string, params: any[] = []) => {
  return isWeb ? null : await db.getFirstAsync(query, params);
};

export default db;
