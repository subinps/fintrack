import type { Account, NetWorthSnapshot, Transaction } from '../hooks/useQueries';

export type { NetWorthSnapshot };

/**
 * All figures in this module are derived from the ledger the API returns.
 * Amounts arrive as strings of paise (INR minor units); helpers return paise too
 * and only the formatters convert to display units.
 */

export type Range = '1M' | '3M' | '6M' | '1Y';

export const RANGE_MONTHS: Record<Range, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };
export const RANGE_LABEL: Record<Range, string> = {
  '1M': 'This month',
  '3M': '3 months',
  '6M': '6 months',
  '1Y': '12 months',
};

const num = (value?: string | number | null) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? n : 0;
};

export const toPaise = num;

export const formatINR = (paise: number, options: { compact?: boolean; signed?: boolean; decimals?: number } = {}) => {
  const { compact = false, signed = false, decimals = 0 } = options;
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = signed ? (rupees > 0 ? '+' : rupees < 0 ? '−' : '') : rupees < 0 ? '−' : '';
  if (compact) {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2).replace(/\.0+$/, '')}Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2).replace(/\.0+$/, '')}L`;
    if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(0)}k`;
  }
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
};

export const formatPct = (value: number, decimals = 1) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(decimals)}%`;

export const changePct = (current: number, previous: number) => {
  if (!previous) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const monthLabel = (date: Date, long = false) =>
  date.toLocaleDateString('en-IN', { month: long ? 'long' : 'short' });
export const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (same(date, today)) return 'Today';
  if (same(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export interface CashflowPoint {
  key: string;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
}

/** Income and expense per calendar month, oldest first, including the current (partial) month. */
export function buildCashflow(transactions: Transaction[], months: number): CashflowPoint[] {
  const buckets = new Map<string, CashflowPoint>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    basketsInit(buckets, date);
  }
  const oldest = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (const tx of transactions) {
    const date = new Date(tx.date);
    if (date < oldest) continue;
    const bucket = buckets.get(monthKey(date));
    if (!bucket) continue;
    for (const split of tx.splits ?? []) {
      const amount = num(split.amount);
      const type = split.account?.type;
      if (type === 'INCOME' && amount < 0) bucket.income += -amount;
      if (type === 'EXPENSE' && amount > 0) bucket.expense += amount;
    }
    bucket.net = bucket.income - bucket.expense;
  }
  return Array.from(buckets.values());
}

function basketsInit(map: Map<string, CashflowPoint>, date: Date) {
  const key = monthKey(date);
  map.set(key, {
    key,
    label: monthLabel(date),
    fullLabel: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    income: 0,
    expense: 0,
    net: 0,
  });
}

/** Totals for the current calendar month and the previous one. */
export function monthPulse(transactions: Transaction[]) {
  const series = buildCashflow(transactions, 2);
  const current = series[series.length - 1] ?? { income: 0, expense: 0, net: 0 };
  const previous = series[series.length - 2] ?? { income: 0, expense: 0, net: 0 };
  return { current, previous };
}

export interface CategorySlice {
  name: string;
  total: number;
  previous: number;
  change: number;
  share: number;
  colorIndex: number;
}

/** Expense totals by category for the current month, with previous-month comparison. */
export function categoryBreakdown(transactions: Transaction[]): { slices: CategorySlice[]; total: number } {
  const now = new Date();
  const currentKey = monthKey(now);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = monthKey(prevDate);
  const map = new Map<string, { current: number; previous: number }>();

  for (const tx of transactions) {
    const key = monthKey(new Date(tx.date));
    if (key !== currentKey && key !== prevKey) continue;
    for (const split of tx.splits ?? []) {
      if (split.account?.type !== 'EXPENSE') continue;
      const amount = num(split.amount);
      if (amount === 0) continue;
      const name = split.account?.name ?? 'Uncategorised';
      const entry = map.get(name) ?? { current: 0, previous: 0 };
      if (key === currentKey) entry.current += amount;
      else entry.previous += amount;
      map.set(name, entry);
    }
  }

  const total = Array.from(map.values()).reduce((sum, entry) => sum + Math.max(0, entry.current), 0);
  const slices = Array.from(map.entries())
    .map(([name, entry]) => ({
      name,
      total: Math.max(0, entry.current),
      previous: Math.max(0, entry.previous),
      change: changePct(Math.max(0, entry.current), Math.max(0, entry.previous)),
      share: total ? (Math.max(0, entry.current) / total) * 100 : 0,
      colorIndex: 0,
    }))
    .filter((slice) => slice.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((slice, index) => ({ ...slice, colorIndex: index % 5 }));
  return { slices, total };
}

export interface RecurringPayment {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  previousAmount: number;
  occurrences: number;
  lastDate: string;
  nextDate: string;
  cadence: 'monthly';
}

/** Detects merchants charged on a monthly rhythm at a stable amount. */
export function detectRecurring(transactions: Transaction[]): RecurringPayment[] {
  const groups = new Map<string, { description: string; category: string; dates: Date[]; amounts: number[] }>();
  for (const tx of transactions) {
    for (const split of tx.splits ?? []) {
      if (split.account?.type !== 'EXPENSE') continue;
      const amount = num(split.amount);
      if (amount <= 0) continue;
      const signature = tx.description.toLowerCase().replace(/\d+/g, '').replace(/[^a-z ]+/g, '').trim();
      if (!signature) continue;
      const entry = groups.get(signature) ?? {
        description: tx.description,
        category: split.account?.name ?? 'Expense',
        dates: [],
        amounts: [],
      };
      entry.dates.push(new Date(tx.date));
      entry.amounts.push(amount);
      groups.set(signature, entry);
    }
  }

  const found: RecurringPayment[] = [];
  for (const [signature, group] of groups) {
    if (group.dates.length < 3) continue;
    const dates = [...group.dates].sort((a, b) => a.getTime() - b.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000);
    }
    const gapSpread = Math.max(...gaps) - Math.min(...gaps);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 24 || avgGap > 36 || gapSpread > 12) continue;
    const median = [...group.amounts].sort((a, b) => a - b)[Math.floor(group.amounts.length / 2)];
    const stable = group.amounts.every((amount) => Math.abs(amount - median) / median <= 0.15);
    if (!stable) continue;
    const last = dates[dates.length - 1];
    const next = new Date(last);
    next.setMonth(next.getMonth() + 1);
    found.push({
      id: signature,
      merchant: group.description,
      category: group.category,
      amount: median,
      previousAmount: group.amounts[group.amounts.length - 2] ?? median,
      occurrences: group.dates.length,
      lastDate: last.toISOString(),
      nextDate: next.toISOString(),
      cadence: 'monthly',
    });
  }
  return found.sort((a, b) => b.amount - a.amount);
}

export interface AccountSummary {
  assets: number;
  liabilities: number;
  netWorth: number;
  liquid: number;
  invested: number;
  monthlyBurn: number;
  bufferMonths: number;
}

const LIQUID_SUBTYPES = ['bank', 'savings', 'current', 'cash', 'wallet'];
const INVESTED_SUBTYPES = ['mutual-fund', 'mutual fund', 'stock', 'investment', 'crypto', 'index'];
const isSubtype = (account: Account, list: string[]) =>
  list.includes((account.subType ?? '').toLowerCase());

export function summarizeAccounts(accounts: Account[], cashflow: CashflowPoint[]): AccountSummary {
  let assets = 0;
  let liabilities = 0;
  let liquid = 0;
  let invested = 0;
  for (const account of accounts) {
    const balance = num(account.balance);
    if (account.type === 'ASSET') {
      assets += Math.max(0, balance);
      if (isSubtype(account, LIQUID_SUBTYPES)) liquid += Math.max(0, balance);
      if (isSubtype(account, INVESTED_SUBTYPES) || account.symbol) invested += Math.max(0, balance);
    } else if (account.type === 'LIABILITY') {
      liabilities += Math.abs(balance);
    }
  }
  const recent = cashflow.slice(-3).filter((month) => month.expense > 0);
  const monthlyBurn = recent.length
    ? recent.reduce((sum, month) => sum + month.expense, 0) / recent.length
    : 0;
  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    liquid,
    invested,
    monthlyBurn,
    bufferMonths: monthlyBurn > 0 ? liquid / monthlyBurn : 0,
  };
}

export interface HealthScore {
  score: number;
  band: 'Building' | 'Steady' | 'Strong';
  savingsRate: number;
  debtRatio: number;
  bufferMonths: number;
  parts: { label: string; value: number; weight: number; detail: string }[];
}

/** 40% savings rate (target 30%), 30% debt-to-asset (target under 40%), 30% cash buffer (target 6 months). */
export function healthScore(summary: AccountSummary, cashflow: CashflowPoint[]): HealthScore {
  const recent = cashflow.slice(-3).filter((month) => month.income > 0);
  const income = recent.reduce((sum, month) => sum + month.income, 0);
  const expense = recent.reduce((sum, month) => sum + month.expense, 0);
  const savingsRate = income ? (income - expense) / income : 0;
  const debtRatio = summary.assets ? summary.liabilities / summary.assets : 0;
  const buffer = summary.bufferMonths;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const savingsPart = 40 * clamp(savingsRate / 0.3);
  const debtPart = 30 * (1 - clamp(debtRatio / 0.6));
  const bufferPart = 30 * clamp(buffer / 6);
  const score = Math.round(savingsPart + debtPart + bufferPart);
  return {
    score,
    band: score >= 70 ? 'Strong' : score >= 45 ? 'Steady' : 'Building',
    savingsRate: savingsRate * 100,
    debtRatio: debtRatio * 100,
    bufferMonths: buffer,
    parts: [
      {
        label: 'Savings rate',
        value: Math.round(savingsPart),
        weight: 40,
        detail: `${(savingsRate * 100).toFixed(0)}% of income kept, target 30%`,
      },
      {
        label: 'Debt load',
        value: Math.round(debtPart),
        weight: 30,
        detail: `${(debtRatio * 100).toFixed(0)}% of assets, target under 40%`,
      },
      {
        label: 'Cash buffer',
        value: Math.round(bufferPart),
        weight: 30,
        detail: `${buffer.toFixed(1)} months covered, target 6`,
      },
    ],
  };
}

export type SignalTone = 'positive' | 'warning' | 'critical' | 'neutral';
export type SignalIcon = 'trend' | 'repeat' | 'calendar' | 'shield' | 'flame' | 'wallet';

export interface Signal {
  id: string;
  tone: SignalTone;
  icon: SignalIcon;
  tag: string;
  title: string;
  detail: string;
  action: { label: string; tab: string };
}

export function buildSignals(input: {
  accounts: Account[];
  transactions: Transaction[];
  cashflow: CashflowPoint[];
  recurring: RecurringPayment[];
  categories: CategorySlice[];
  summary: AccountSummary;
  health: HealthScore;
}): Signal[] {
  const { accounts, cashflow, recurring, categories, summary, health } = input;
  const signals: Signal[] = [];
  const current = cashflow[cashflow.length - 1];
  const previous = cashflow[cashflow.length - 2];

  const movers = categories
    .filter((slice) => slice.previous > 0 && slice.change > 18 && slice.total - slice.previous > 50_000)
    .sort((a, b) => b.total - b.previous - (a.total - a.previous));
  const topMover = movers[0];
  if (topMover) {
    signals.push({
      id: `mover-${topMover.name}`,
      tone: 'warning',
      icon: 'trend',
      tag: 'Spending shift',
      title: `${topMover.name} is up ${formatPct(topMover.change, 0)} this month`,
      detail: `${formatINR(topMover.total)} so far versus ${formatINR(topMover.previous)} last month.`,
      action: { label: 'Review transactions', tab: 'transactions' },
    });
  }

  if (previous?.income && current.income) {
    const rate = ((current.income - current.expense) / current.income) * 100;
    if (rate < 20) {
      signals.push({
        id: 'savings-rate',
        tone: rate < 0 ? 'critical' : 'warning',
        icon: 'shield',
        tag: 'Savings rate',
        title:
          rate < 0
            ? `Spending is ahead of income by ${formatINR(current.expense - current.income)}`
            : `You kept ${rate.toFixed(0)}% of income this month`,
        detail: `Target is 30%. ${formatINR(current.expense)} spent against ${formatINR(current.income)} received.`,
        action: { label: 'Open income and expense', tab: 'income-expense' },
      });
    }
  }

  if (recurring.length) {
    const commitment = recurring.reduce((sum, item) => sum + item.amount, 0);
    signals.push({
      id: 'recurring',
      tone: 'neutral',
      icon: 'repeat',
      tag: 'Recurring',
      title: `${recurring.length} recurring charges cost ${formatINR(commitment)} a month`,
      detail: `Largest is ${recurring[0].merchant} at ${formatINR(recurring[0].amount)}. Detected from three or more steady charges.`,
      action: { label: 'See recurring payments', tab: 'overview' },
    });
  }

  const soon = accounts
    .filter((account) => account.type === 'LIABILITY' && account.dueDate)
    .map((account) => {
      const due = new Date(account.dueDate as string);
      const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
      return { account, due, days };
    })
    .filter((item) => item.days >= -1 && item.days <= 14)
    .sort((a, b) => a.days - b.days)[0];
  if (soon) {
    signals.push({
      id: 'due',
      tone: 'critical',
      icon: 'calendar',
      tag: 'Due soon',
      title: `${soon.account.name} payment is ${soon.days <= 0 ? 'due now' : `in ${soon.days} day${soon.days === 1 ? '' : 's'}`}`,
      detail: `Outstanding ${formatINR(Math.abs(num(soon.account.balance)))}. ${soon.due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${soon.account.interestRate ?? '—'}% interest.`,
      action: { label: 'Open debts', tab: 'debts' },
    });
  }

  if (summary.monthlyBurn > 0) {
    signals.push({
      id: 'buffer',
      tone: health.bufferMonths >= 3 ? 'positive' : 'warning',
      icon: 'wallet',
      tag: 'Cash buffer',
      title:
        health.bufferMonths >= 3
          ? `Liquid cash covers ${health.bufferMonths.toFixed(1)} months of spending`
          : `Cash buffer is ${health.bufferMonths.toFixed(1)} months — a thin margin`,
      detail: `${formatINR(summary.liquid)} across bank and wallet accounts against ${formatINR(summary.monthlyBurn)} average monthly spend.`,
      action: { label: 'Open accounts', tab: 'accounts' },
    });
  }

  const rank: Record<SignalTone, number> = { critical: 0, warning: 1, positive: 2, neutral: 3 };
  return signals.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 5);
}

export interface ActivityItem {
  transaction: Transaction;
  primary: { name: string; amount: number };
  secondary?: string;
}

/** Latest transactions with a readable headline account and signed amount. */
export function recentActivity(transactions: Transaction[], limit = 6): ActivityItem[] {
  return [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .map((transaction) => {
      const splits = transaction.splits ?? [];
      const expense = splits.find((split) => split.account?.type === 'EXPENSE' && num(split.amount) > 0);
      const income = splits.find((split) => split.account?.type === 'INCOME' && num(split.amount) < 0);
      const primarySplit = expense ?? income ?? splits[0];
      const amount = expense ? num(expense.amount) : income ? -num(income.amount) : num(primarySplit?.amount);
      const counterparty = splits.find((split) => split.account?.type !== primarySplit?.account?.type);
      return {
        transaction,
        primary: { name: primarySplit?.account?.name ?? 'Transfer', amount },
        secondary: counterparty?.account?.name,
      };
    });
}

export function netWorthTrend(snapshots: NetWorthSnapshot[]) {
  const points = snapshots.map((snapshot) => ({
    label: new Date(snapshot.date).toLocaleDateString('en-IN', { month: 'short' }),
    fullLabel: new Date(snapshot.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
    netWorth: snapshot.netWorth,
    assets: snapshot.assets,
    liabilities: snapshot.liabilities,
  }));
  const first = points[0]?.netWorth ?? 0;
  const last = points[points.length - 1]?.netWorth ?? 0;
  return { points, first, last, change: changePct(last, first), delta: last - first };
}

export function sparkPoints(values: number[]) {
  if (!values.length) return [];
  return values.map((value, index) => ({ index, value }));
}
