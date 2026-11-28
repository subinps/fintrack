import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import api from '../lib/api';

// New Types
export interface Account {
  id: number;
  name: string;
  type: string; // ASSET, LIABILITY, INCOME, EXPENSE, EQUITY
  subType?: string;
  balance: string;
  // Extended fields
  interestRate?: number;
  dueDate?: string;
  symbol?: string | null;
  units?: number;
  averageBuyPrice?: number;
  lastMarketPrice?: string | number; // Decimal in DB, string/number in JSON
  lastMarketUpdate?: string;
}

export interface TransactionSplit {
  id: number;
  amount: string;
  accountId: number;
  account?: Account;
  units?: number;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  splits: TransactionSplit[];
  tags?: string[];
  status?: string;
}

// Account Queries
export function useGetAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get('/accounts');
      return res.data;
    },
  });
}

export function useAddAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Account> & { openingBalance?: string }) => {
      const res = await api.post('/accounts', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useEditAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Account> & { id: number }) => {
      const res = await api.put(`/accounts/${data.id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: number) => {
      const res = await api.delete(`/accounts/${accountId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

// Helper hooks to maintain compatibility or ease of use
export function useGetBankAccounts() {
  const { data: accounts, ...rest } = useGetAccounts();
  const bankAccounts = accounts?.filter(a => {
    const subType = (a.subType || '').toLowerCase();
    const investmentTypes = ['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'];
    return (a.type === 'ASSET' && !investmentTypes.includes(subType)) || (a.type === 'LIABILITY' && subType === 'credit-card');
  }) || [];
  return { data: bankAccounts, ...rest };
}

export function useGetDebts() {
  const { data: accounts, ...rest } = useGetAccounts();
  const debts = accounts?.filter(a => a.type === 'LIABILITY') || [];
  return { data: debts, ...rest };
}

export function useGetReceivables() {
  const { data: accounts, ...rest } = useGetAccounts();
  // Receivables are Assets (money owed to us). 
  // We need a way to distinguish them. Maybe subType 'receivable'?
  const receivables = accounts?.filter(a => a.type === 'ASSET' && (a.subType || '').toLowerCase() === 'receivable') || [];
  return { data: receivables, ...rest };
}

export function useGetInvestments() {
  const { data: accounts, ...rest } = useGetAccounts();
  const investments = accounts?.filter(a =>
    a.type === 'ASSET' && ['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'].includes((a.subType || '').toLowerCase())
  ) || [];
  return { data: investments, ...rest };
}

export interface BalanceHistoryPoint {
  date: string;
  balance: number;
}

export function useGetAccountBalanceHistory(accountId: number, period: 'day' | 'month' = 'day') {
  return useQuery<BalanceHistoryPoint[]>({
    queryKey: ['balanceHistory', accountId, period],
    queryFn: async () => {
      const res = await api.get(`/analytics/balance-history/${accountId}?period=${period}`);
      return res.data;
    },
    enabled: !!accountId,
  });
}

// Transaction Queries
export function useGetTransactions(params?: { limit?: number; page?: number }, options?: { enabled?: boolean }) {
  return useQuery<Transaction[]>({
    queryKey: ['transactions', params],
    queryFn: async () => {
      const limit = params?.limit ?? -1;
      const page = params?.page ?? 1;
      const res = await api.get(`/transactions?limit=${limit}&page=${page}`);
      // Handle new response format { data: [], pagination: {} }
      return res.data.data || res.data;
    },
    enabled: options?.enabled,
  });
}

export function useTransactionTags() {
  return useQuery<{ name: string; count: number }[]>({
    queryKey: ['transactions', 'tags'],
    queryFn: async () => {
      const res = await api.get('/transactions/tags');
      return res.data.data || [];
    },
    staleTime: 60_000,
  });
}

export function useGetTransactionsInfinite(limit = 50, options?: { enabled?: boolean }) {  return useInfiniteQuery({
    queryKey: ['transactions', 'infinite', limit],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get(`/transactions?limit=${limit}&page=${pageParam}`);
      return res.data;
    },
    getNextPageParam: (lastPage: any) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: options?.enabled,
  });
}

export function useAddTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { description: string; date: Date; splits: { accountId: number; amount: number; units?: number }[]; tags?: string[] }) => {
      const payload = {
        description: data.description,
        date: data.date.toISOString(),
        splits: data.splits.map(s => ({
          accountId: s.accountId,
          amount: s.amount.toString(), // Backend expects BigInt string
          units: s.units,
        })),
        tags: data.tags ?? [],
      };
      const res = await api.post('/transactions', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useEditTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: number; description: string; date: Date; splits: { accountId: number; amount: number; units?: number }[]; tags?: string[] }) => {
      const payload = {
        description: data.description,
        date: data.date.toISOString(),
        splits: data.splits.map(s => ({
          accountId: s.accountId,
          amount: s.amount.toString(),
          units: s.units,
        })),
        tags: data.tags ?? [],
      };
      const res = await api.put(`/transactions/${data.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/transactions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useRestoreTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/transactions/${id}/restore`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useGetTrash() {
  return useQuery<{ data: Transaction[]; pagination: { total: number } }>({
    queryKey: ['trash'],
    queryFn: async () => {
      const res = await api.get('/transactions', { params: { status: 'VOIDED', limit: 50 } });
      return res.data;
    },
  });
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useGetNotifications() {
  return useQuery<{ items: AppNotification[]; unread: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications', { params: { limit: 20 } });
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post('/notifications/read');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useImportTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { accountId: string; file: File }) => {
      const formData = new FormData();
      formData.append('accountId', data.accountId);
      formData.append('file', data.file);

      const res = await api.post('/transactions/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useResetData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/reset');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

// Investment Queries (Placeholder/Legacy support if needed, or remove if Investments are just Accounts)
// If Investments are separate in schema (I removed them), then this will fail. 
// Assuming Investments are now ASSET accounts.

// Export data
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      return {};
    },
  });
}

// Legacy hooks placeholders (to prevent errors in other files until updated)
export function useAddInvestment() { return useAddAccount(); }
export function useEditInvestment() { return useEditAccount(); }
export function useDeleteInvestment() { return useDeleteAccount(); }

export function useAddDebt() { return useAddAccount(); }
export function useEditDebt() { return useEditAccount(); }
export function useDeleteDebt() { return useDeleteAccount(); }

export interface Category {
  id: number;
  name: string;
  type: string;
}

export function useGetCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data;
    },
  });
}

export function useAddCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await api.post('/categories', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useEditCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; type?: string }) => {
      const res = await api.patch(`/categories/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/categories/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useGetPaymentModes() {
  // Payment modes are now Asset accounts
  return useGetBankAccounts();
}

export interface NetWorthSnapshot {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export function useGetNetWorthHistory() {
  return useQuery<NetWorthSnapshot[]>({
    queryKey: ['netWorthHistory'],
    queryFn: async () => {
      const res = await api.get('/analytics/net-worth-history');
      return res.data;
    },
  });
}
export interface LedgerRow {
  id: string; // Changed to string because we use composite IDs now
  transactionId: number;
  date: string;
  description: string;
  accountInvolved: string;
  accountInvolvedId?: number | null;
  debit: string;
  credit: string;
  balance: string;
  isOpening?: boolean;
}

export function useGetLedger(accountId: number | null, startDate?: Date, endDate?: Date) {
  return useQuery<LedgerRow[]>({
    queryKey: ['ledger', accountId, startDate, endDate],
    queryFn: async () => {
      if (!accountId) return [];
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const res = await api.get(`/accounts/${accountId}/ledger?${params.toString()}`);
      return res.data;
    },
    enabled: !!accountId,
  });
}
