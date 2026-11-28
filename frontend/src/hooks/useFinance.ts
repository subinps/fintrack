import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

/**
 * Phase 5-10 data hooks: reconciliation, file import, reports, tax,
 * portfolio analytics, loans/cards and insights. Report money values arrive as
 * rupee decimal strings, while ledger ids stay numbers.
 */

export type ReconLine = {
  splitId: number;
  transactionId: number;
  date: string;
  description: string;
  amount: string;
  status: string;
  source: string;
  tags: string[];
  reconciledAt: string | null;
  statementRunId: string | null;
};

export type ReconSummary = {
  accountId: number;
  accountName: string;
  ledgerBalance: string;
  clearedBalance: string;
  unclearedBalance: string;
  unclearedCount: number;
  clearedCount: number;
  lastReconciledAt: string | null;
};

export type PreviewRow = {
  index: number;
  date: string;
  description: string;
  amount: string;
  balance?: string | null;
  externalId?: string | null;
  error?: string;
  duplicate: { transactionId: number; description: string } | null;
  match: { splitId: number; transactionId: number; description: string; score: number } | null;
  rule: { ruleId: string; name: string; accountId: number; accountName: string } | null;
};

export type ImportPreview = {
  source: 'CSV' | 'OFX' | 'XLSX';
  headers: string[];
  mapping: Record<string, string | undefined>;
  rows: PreviewRow[];
  summary: { count: number; sum: string; duplicates: number; matched: number; invalid: number };
};

export type ImportRule = {
  id: string;
  name: string;
  matchType: 'CONTAINS' | 'EQUALS' | 'REGEX';
  pattern: string;
  accountId: number;
  priority: number;
  active: boolean;
  account: { id: number; name: string; type: string };
};

export type PnlLine = { accountId: number; name: string; type: string; amount: string };

export type ProfitAndLoss = {
  from: string;
  to: string;
  income: PnlLine[];
  expenses: PnlLine[];
  totalIncome: string;
  totalExpenses: string;
  netProfit: string;
  marginPercent: number | null;
  prior: { totalIncome: string; totalExpenses: string; netProfit: string } | null;
};

export type BalanceSheet = {
  asOf: string;
  assets: PnlLine[];
  liabilities: PnlLine[];
  equity: PnlLine[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  retainedEarnings: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
};

export type CashFlowSection = { inflow: string; outflow: string; net: string; items: { name: string; amount: string }[] };

export type CashFlow = {
  from: string;
  to: string;
  opening: string;
  closing: string;
  net: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
};

export type TrialBalance = {
  asOf: string;
  rows: { accountId: number; name: string; type: string; debit: string; credit: string }[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
};

export type TaxSummary = {
  fiscalYear: { label: string; from: string; to: string };
  profile: {
    regime: string;
    fiscalYearStartMonth: number;
    deductions: { label: string; tag: string; limitPaise: string }[];
    notes: string | null;
  };
  income: { name: string; amount: string }[];
  totalIncome: string;
  totalExpenses: string;
  deductions: { label: string; tag: string; limit: string; used: string; remaining: string; over: boolean }[];
  capitalGains: { proceeds: string; estimatedCost: string; estimatedGain: string; note: string };
  standardDeduction: string;
  estimatedTaxableIncome: string;
  estimatedTax: string;
  effectiveRatePercent: number | null;
  advanceTax: { due: string; label: string; cumulativePercent: number; amount: string; paidSoFar: string }[];
  disclaimer: string;
};

export type Holding = {
  accountId: number;
  name: string;
  symbol: string | null;
  units: number;
  averageCost: string;
  invested: string;
  lastPrice: string;
  marketValue: string;
  unrealised: string;
  unrealisedPercent: number | null;
  realised: string;
  weightPercent: number;
  firstBuy: string | null;
  xirrPercent: number | null;
};

export type PortfolioAnalytics = {
  generatedAt: string;
  holdings: Holding[];
  totals: { invested: string; marketValue: string; unrealised: string; realised: string; xirrPercent: number | null };
  allocation: { name: string; value: string; weightPercent: number }[];
  concentration: { name: string; weightPercent: number }[];
  empty: boolean;
};

export type LoanSummary = {
  accountId: number;
  name: string;
  subType: string | null;
  outstanding: string;
  principal: string;
  interestRate: number | null;
  tenureMonths: number | null;
  emi: string;
  monthsPaid: number | null;
  monthsRemaining: number | null;
  interestRemaining: string | null;
  payoffDate: string | null;
  nextDue: string | null;
  daysToDue: number | null;
  progressPercent: number;
  schedule: { month: number; dueDate: string; emi: string; interest: string; principal: string; balance: string }[];
};

export type CardSummary = {
  accountId: number;
  name: string;
  outstanding: string;
  creditLimit: string | null;
  utilisationPercent: number | null;
  available: string | null;
  dueDay: number | null;
  statementDay: number | null;
  nextDue: string | null;
  daysToDue: number | null;
  minimumDue: string | null;
  health: 'low' | 'medium' | 'high' | 'unknown';
};

export type Insight = {
  id: string;
  tone: 'positive' | 'neutral' | 'warning';
  title: string;
  detail: string;
  action?: { label: string; tab: string };
  amount?: string;
};

export type Digest = {
  month: string;
  income: string;
  expense: string;
  net: string;
  previousExpense: string;
  changePercent: number | null;
  topCategories: { name: string; amount: string }[];
};

const buildQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
};

export const useReconLines = (accountId: number | null, status: 'all' | 'cleared' | 'uncleared') =>
  useQuery({
    queryKey: ['recon-lines', accountId, status],
    queryFn: async () => (await api.get<ReconLine[]>(`/reconciliation/${accountId}/lines?${buildQuery({ status })}`)).data,
    enabled: accountId !== null,
  });

export const useReconSummary = (accountId: number | null) =>
  useQuery({
    queryKey: ['recon-summary', accountId],
    queryFn: async () => (await api.get<ReconSummary>(`/reconciliation/${accountId}/summary`)).data,
    enabled: accountId !== null,
  });

export const useCompleteRecon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { accountId: number; splitIds: number[]; statementBalance?: string }) =>
      (await api.post(`/reconciliation/${input.accountId}/complete`, { splitIds: input.splitIds, statementBalance: input.statementBalance })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recon-lines'] });
      queryClient.invalidateQueries({ queryKey: ['recon-summary'] });
    },
  });
};

export const useUndoRecon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { accountId: number; splitIds: number[] }) =>
      (await api.post(`/reconciliation/${input.accountId}/undo`, { splitIds: input.splitIds })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recon-lines'] });
      queryClient.invalidateQueries({ queryKey: ['recon-summary'] });
    },
  });
};

export const useImportPreview = () =>
  useMutation({
    mutationFn: async (input: { file: File; accountId: number; mode: 'ledger' | 'statement' }) => {
      const form = new FormData();
      form.append('file', input.file);
      form.append('accountId', String(input.accountId));
      form.append('mode', input.mode);
      return (await api.post<ImportPreview>('/import/preview', form)).data;
    },
  });

export const useImportCommit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      accountId: number;
      mode: 'ledger' | 'statement';
      skipDuplicates: boolean;
      rows: { date: string; description: string; amount: string; categoryAccountId?: number | null; matchSplitId?: number | null; externalId?: string | null }[];
    }) => (await api.post('/import/commit', input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recon-lines'] });
      queryClient.invalidateQueries({ queryKey: ['recon-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};

export const useImportRules = () =>
  useQuery({
    queryKey: ['import-rules'],
    queryFn: async () => (await api.get<ImportRule[]>('/import/rules')).data,
  });

export const useCreateImportRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; matchType: string; pattern: string; accountId: number; priority: number }) =>
      (await api.post('/import/rules', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-rules'] }),
  });
};

export const useDeleteImportRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/import/rules/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-rules'] }),
  });
};

export const useProfitAndLoss = (from: string, to: string, compare: boolean) =>
  useQuery({
    queryKey: ['report-pnl', from, to, compare],
    queryFn: async () => (await api.get<ProfitAndLoss>(`/reports/pnl?${buildQuery({ from, to, compare })}`)).data,
  });

export const useBalanceSheet = (asOf: string) =>
  useQuery({
    queryKey: ['report-balance', asOf],
    queryFn: async () => (await api.get<BalanceSheet>(`/reports/balance-sheet?${buildQuery({ asOf })}`)).data,
  });

export const useCashFlow = (from: string, to: string) =>
  useQuery({
    queryKey: ['report-cashflow', from, to],
    queryFn: async () => (await api.get<CashFlow>(`/reports/cash-flow?${buildQuery({ from, to })}`)).data,
  });

export const useTrialBalance = (asOf: string) =>
  useQuery({
    queryKey: ['report-trial', asOf],
    queryFn: async () => (await api.get<TrialBalance>(`/reports/trial-balance?${buildQuery({ asOf })}`)).data,
  });

export const useTaxSummary = () =>
  useQuery({ queryKey: ['tax-summary'], queryFn: async () => (await api.get<TaxSummary>('/tax/summary')).data });

export const useUpdateTaxProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { regime?: string; fiscalYearStartMonth?: number; deductions?: { label: string; tag: string; limitPaise: string }[]; notes?: string | null }) =>
      (await api.put('/tax/profile', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-summary'] }),
  });
};

export const usePortfolioAnalytics = () =>
  useQuery({ queryKey: ['portfolio-analytics'], queryFn: async () => (await api.get<PortfolioAnalytics>('/investments/analytics')).data });

export const useLoans = () =>
  useQuery({ queryKey: ['loans'], queryFn: async () => (await api.get<LoanSummary[]>('/loans')).data });

export const useCards = () =>
  useQuery({ queryKey: ['cards'], queryFn: async () => (await api.get<CardSummary[]>('/loans/cards')).data });

export const useUpdateLoanTerms = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { accountId: number; body: Record<string, string | number | null> }) =>
      (await api.patch(`/loans/${input.accountId}`, input.body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};

export const useInsights = () =>
  useQuery({ queryKey: ['insights'], queryFn: async () => (await api.get<{ insights: Insight[]; generatedAt: string }>('/insights')).data });

export const useDigest = () =>
  useQuery({ queryKey: ['digest'], queryFn: async () => (await api.get<Digest>('/insights/digest')).data });

export const useGlobalSearch = (query: string) =>
  useQuery({
    queryKey: ['global-search', query],
    queryFn: async () =>
      (
        await api.get<{
          query: string;
          transactions: { id: number; date: string; description: string; amount: string; accountName: string | null; tags: string[] }[];
          accounts: { id: number; name: string; type: string; balance: string }[];
          totals: { transactions: number; accounts: number };
        }>(`/search?${buildQuery({ q: query })}`)
      ).data,
    enabled: query.trim().length >= 2,
  });
