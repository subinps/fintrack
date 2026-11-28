import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export type Pace = 'ON_TRACK' | 'WATCH' | 'OVER';
export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
export type BudgetType = 'FIXED' | 'PERCENT_INCOME' | 'ZERO_BASED' | 'ENVELOPE';

export interface BudgetItemStatus {
  id: string;
  name: string;
  accountId: number | null;
  accountName: string | null;
  tag: string | null;
  amountPaise: string;
  percent: number | null;
  limitPaise: string;
  spentPaise: string;
  rolloverPaise: string;
  remainingPaise: string;
  percentUsed: number;
  dailyAllowancePaise: string;
  projectedSpendPaise: string;
  upcomingPaise: string;
  pace: Pace;
  alertAt: number[];
  parentId: string | null;
  children: BudgetItemStatus[];
}

export interface BudgetStatus {
  id: string;
  name: string;
  period: BudgetPeriod;
  type: BudgetType;
  rollover: boolean;
  rolloverCapPaise: string | null;
  startDate: string;
  endDate: string | null;
  periodStart: string;
  periodEnd: string;
  daysLeft: number;
  totalLimitPaise: string;
  totalSpentPaise: string;
  totalRemainingPaise: string;
  percentUsed: number;
  rolloverPaise: string;
  incomePaise: string;
  unallocatedPaise: string | null;
  projectedOverspendPaise: string;
  pace: Pace;
  items: BudgetItemStatus[];
}

export interface SafeToSpend {
  liquidPaise: string;
  reservedBudgetPaise: string;
  upcomingBillsPaise: string;
  debtDuesPaise: string;
  safeToSpendPaise: string;
  horizonDays: number;
}

export interface BudgetSummary {
  month: string;
  incomePaise: string;
  expensePaise: string;
  savingsPaise: string;
  savingsRate: number;
  previousExpensePaise: string;
  expenseChangePercent: number | null;
  topCategories: { name: string; accountId: number; spentPaise: string }[];
  unbudgeted: { name: string; accountId: number; spentPaise: string }[];
}

export interface BudgetAlertEntry {
  id: string;
  itemId: string;
  itemName: string | null;
  budgetName: string;
  threshold: number;
  periodStart: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  linkedAccountId: number | null;
  linkedAccountName: string | null;
  recurringRuleId: string | null;
  savedPaise: string;
  progressPaise: string;
  remainingPaise: string;
  percentComplete: number;
  monthsLeft: number | null;
  requiredMonthlyPaise: string | null;
  status: 'ON_TRACK' | 'BEHIND' | 'DONE';
  notes: string | null;
  createdAt: string;
}

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  type: BudgetType;
  items: { name: string; percent: number }[];
}

export type BudgetItemPayload = {
  name?: string | null;
  accountId?: number | null;
  tag?: string | null;
  amountPaise?: string;
  percent?: number | null;
  parentId?: string | null;
  alertAt?: number[];
};

export type BudgetPayload = {
  name: string;
  period: BudgetPeriod;
  type: BudgetType;
  startDate: string;
  endDate?: string | null;
  rollover?: boolean;
  rolloverCapPaise?: string | null;
  notes?: string | null;
  items?: BudgetItemPayload[];
};

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['budgets'] });
  queryClient.invalidateQueries({ queryKey: ['goals'] });
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['accounts'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
};

export function useBudgets() {
  return useQuery<BudgetStatus[]>({
    queryKey: ['budgets'],
    queryFn: async () => (await api.get('/budgets')).data.data as BudgetStatus[],
  });
}

export function useBudgetSummary() {
  return useQuery<BudgetSummary>({
    queryKey: ['budgets', 'summary'],
    queryFn: async () => (await api.get('/budgets/summary')).data.data as BudgetSummary,
  });
}

export function useSafeToSpend(days = 30) {
  return useQuery<SafeToSpend>({
    queryKey: ['budgets', 'safe-to-spend', days],
    queryFn: async () => (await api.get('/budgets/safe-to-spend', { params: { days } })).data.data as SafeToSpend,
  });
}

export function useBudgetAlerts() {
  return useQuery<BudgetAlertEntry[]>({
    queryKey: ['budgets', 'alerts'],
    queryFn: async () => (await api.get('/budgets/alerts')).data.data as BudgetAlertEntry[],
  });
}

export function useBudgetTemplates() {
  return useQuery<BudgetTemplate[]>({
    queryKey: ['budgets', 'templates'],
    queryFn: async () => (await api.get('/budgets/templates')).data.data as BudgetTemplate[],
    staleTime: 60 * 60 * 1000,
  });
}

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => (await api.get('/goals')).data.data as Goal[],
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BudgetPayload) => (await api.post('/budgets', payload)).data.data as BudgetStatus,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<BudgetPayload> & { id: string }) =>
      (await api.patch(`/budgets/${id}`, payload)).data.data as BudgetStatus,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/budgets/${id}`)).data,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useBudgetItems(budgetId: string) {
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: async (payload: BudgetItemPayload) => (await api.post(`/budgets/${budgetId}/items`, payload)).data.data as BudgetStatus,
    onSuccess: () => invalidate(queryClient),
  });
  const update = useMutation({
    mutationFn: async ({ itemId, ...payload }: BudgetItemPayload & { itemId: string }) =>
      (await api.patch(`/budgets/${budgetId}/items/${itemId}`, payload)).data.data as BudgetStatus,
    onSuccess: () => invalidate(queryClient),
  });
  const remove = useMutation({
    mutationFn: async (itemId: string) => (await api.delete(`/budgets/${budgetId}/items/${itemId}`)).data.data as BudgetStatus,
    onSuccess: () => invalidate(queryClient),
  });
  return { add, update, remove };
}

export function useCopyBudgetItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, fromBudgetId }: { targetId: string; fromBudgetId: string }) =>
      (await api.post(`/budgets/${targetId}/items/copy`, { fromBudgetId })).data.data as BudgetStatus,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useBudgetFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { templateId: string; name?: string; startDate?: string }) =>
      (await api.post('/budgets/from-template', payload)).data.data as BudgetStatus,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      targetAmountPaise: string;
      targetDate?: string | null;
      linkedAccountId?: number | null;
    }) => (await api.post('/goals', payload)).data.data as Goal,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown> & { id: string }) =>
      (await api.patch(`/goals/${id}`, payload)).data.data as Goal,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/goals/${id}`)).data,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useContributeToGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amountPaise, fromAccountId }: { id: string; amountPaise: string; fromAccountId?: number }) =>
      (await api.post(`/goals/${id}/contribute`, { amountPaise, fromAccountId })).data.data as Goal,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useAutoContribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      amountPaise,
      dayOfMonth,
      fromAccountId,
    }: {
      id: string;
      amountPaise: string;
      dayOfMonth: number;
      fromAccountId: number;
    }) => (await api.post(`/goals/${id}/auto-contribute`, { amountPaise, dayOfMonth, fromAccountId })).data.data,
    onSuccess: () => invalidate(queryClient),
  });
}
