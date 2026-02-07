import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  symbol?: string;
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
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  splits: TransactionSplit[];
  status: 'COMPLETED' | 'DRAFT';
}

// Account Queries


export function useGetLedger(accountId: number, filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['ledger', accountId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const res = await api.get(`/accounts/${accountId}/ledger?${params.toString()}`);
      return res.data;
    },
    enabled: !!accountId,
  });
}

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
  const bankAccounts = accounts?.filter(a =>
    (a.type === 'ASSET' && ['savings', 'current', 'wallet', 'other'].includes((a.subType || '').toLowerCase())) ||
    (a.type === 'LIABILITY' && (a.subType || '').toLowerCase() === 'credit-card')
  ) || [];
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

// Transaction Queries
export function useGetTransactions(status: 'COMPLETED' | 'DRAFT' = 'COMPLETED') {
  return useQuery<Transaction[]>({
    queryKey: ['transactions', status],
    queryFn: async () => {
      const res = await api.get(`/transactions?status=${status}&limit=-1`);

      // Handle different response formats
      if (Array.isArray(res.data)) return res.data;
      if (res.data.data && Array.isArray(res.data.data)) return res.data.data;
      if (res.data.transactions && Array.isArray(res.data.transactions)) return res.data.transactions;

      return [];
    },
  });
}

export function useGetTransaction(id: number) {
  return useQuery<Transaction>({
    queryKey: ['transaction', id],
    queryFn: async () => {
      const res = await api.get(`/transactions/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useAddTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { description: string; date: Date; splits: { accountId: number; amount: number }[]; status?: 'COMPLETED' | 'DRAFT'; type?: string; category?: string; notes?: string }) => {
      // Pass all data to API (Mock API will handle it)
      const payload = {
        description: data.description,
        date: data.date.toISOString(),
        splits: data.splits.map(s => ({
          accountId: s.accountId,
          amount: s.amount.toString(),
        })),
        status: data.status || 'COMPLETED',
        type: data.type,
        category: data.category,
        notes: data.notes
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
    mutationFn: async (data: { id: number; description: string; date: Date; splits: { accountId: number; amount: number }[]; status?: 'COMPLETED' | 'DRAFT' }) => {
      const payload = {
        description: data.description,
        date: data.date.toISOString(),
        splits: data.splits.map(s => ({
          accountId: s.accountId,
          amount: s.amount.toString(),
        })),
        status: data.status,
      };
      const res = await api.put(`/transactions/${data.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
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
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useApproveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put(`/transactions/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useImportTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { accountId: string; file: any }) => {
      const formData = new FormData();
      formData.append('accountId', data.accountId);

      // React Native FormData expects an object with uri, name, type
      formData.append('file', {
        uri: data.file.uri,
        name: data.file.name || 'import.xlsx',
        type: data.file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any);

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

export const useGetUser = () => {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data;
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const { data: response } = await api.post('/auth/change-password', data);
      return response;
    },
  });
};

export const useResetData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/reset-data');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
};

export const useDeleteUser = () => {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/auth/delete-account');
      return data;
    },
  });
};

export interface Session {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

export const useGetSessions = () => {
  return useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await api.get('/auth/sessions');
      return data;
    },
  });
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.delete(`/auth/sessions/${sessionId}`);
      return data;
    },
    onSuccess: (_, sessionId) => {
      queryClient.setQueryData(['sessions'], (old: Session[] | undefined) =>
        old ? old.filter(s => s.id !== sessionId) : []
      );
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
};

export const useRevokeOtherSessions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) => {
      const { data } = await api.delete('/auth/sessions/others', { data: { password } });
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(['sessions'], (old: Session[] | undefined) =>
        old ? old.filter(s => s.isCurrent) : []
      );
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
};

// Legacy hooks placeholders (to prevent errors in other files until updated)
export function useAddInvestment() { return useAddAccount(); }
export function useEditInvestment() { return useEditAccount(); }
export function useDeleteInvestment() { return useDeleteAccount(); }

export function useAddDebt() { return useAddAccount(); }
export function useEditDebt() { return useEditAccount(); }
export function useDeleteDebt() { return useDeleteAccount(); }



export function useGetPaymentModes() {
  // Payment modes are now Asset accounts
  return useGetBankAccounts();
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
export interface NetWorthSnapshot {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
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
