import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export interface RecurringLine {
  accountId: number;
  amountPaise: string;
  units?: string | null;
}

export interface RecurringTemplate {
  description: string;
  lines: RecurringLine[];
}

export interface RecurringRule {
  id: string;
  name: string;
  template: RecurringTemplate;
  rrule: string;
  timezone: string;
  startDate: string;
  endDate: string | null;
  maxRuns: number | null;
  mode: 'AUTO_POST' | 'CONFIRM';
  catchUp: 'ALL' | 'LATEST' | 'SKIP';
  weekendPolicy: 'SAME' | 'PREV_BUSINESS' | 'NEXT_BUSINESS';
  amountMode: 'FIXED' | 'ASK' | 'FORMULA';
  formula: { kind: 'PERCENT_OF_BALANCE'; accountId: number; percent: number } | null;
  nextRunAt: string;
  isActive: boolean;
  remindDaysBefore: number;
  runCount: number;
  lastRunAt: string | null;
}

export interface RecurringOccurrence {
  id: string;
  dueDate: string;
  status: 'POSTED' | 'PENDING' | 'SKIPPED' | 'FAILED';
  transactionId: number | null;
  amountPaise: string | null;
  note: string | null;
  error: string | null;
  postedAt: string | null;
}

export interface ForecastPoint {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
}

export interface RecurringSuggestion {
  id: string;
  description: string;
  lines: RecurringLine[];
  rrule: string;
  startDate: string;
  nextRunAt: string;
  occurrences: number;
  averageIntervalDays: number;
  confidence: number;
  sampleDates: string[];
}

export type RulePayload = {
  name: string;
  template: RecurringTemplate;
  rrule: string;
  startDate: string;
  endDate?: string | null;
  maxRuns?: number | null;
  mode: 'AUTO_POST' | 'CONFIRM';
  catchUp: 'ALL' | 'LATEST' | 'SKIP';
  weekendPolicy: 'SAME' | 'PREV_BUSINESS' | 'NEXT_BUSINESS';
  amountMode: 'FIXED' | 'ASK' | 'FORMULA';
  formula?: { kind: 'PERCENT_OF_BALANCE'; accountId: number; percent: number } | null;
  remindDaysBefore: number;
};

export function useRecurringRules() {
  return useQuery<{ data: RecurringRule[]; upcoming: Record<string, { dueDate: string; status: string }[]> }>({
    queryKey: ['recurring'],
    queryFn: async () => (await api.get('/recurring')).data,
  });
}

export function useRecurringForecast(days: number) {
  return useQuery<ForecastPoint[]>({
    queryKey: ['recurring', 'forecast', days],
    queryFn: async () => (await api.get('/recurring/forecast', { params: { days } })).data.data,
  });
}

export function useRecurringSuggestions() {
  return useQuery<RecurringSuggestion[]>({
    queryKey: ['recurring', 'suggestions'],
    queryFn: async () => (await api.get('/recurring/suggestions')).data.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecurringOccurrences(ruleId: string | null) {
  return useQuery<RecurringOccurrence[]>({
    queryKey: ['recurring', 'occurrences', ruleId],
    enabled: Boolean(ruleId),
    queryFn: async () => (await api.get(`/recurring/${ruleId}/occurrences`)).data.data,
  });
}

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['recurring'] });
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['accounts'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
};

export function useCreateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RulePayload) => (await api.post('/recurring', payload)).data.data as RecurringRule,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<RulePayload> & { id: string }) =>
      (await api.patch(`/recurring/${id}`, payload)).data.data as RecurringRule,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/recurring/${id}`)).data,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useRecurringAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'pause' | 'resume' | 'skip-next' | 'run-now' }) =>
      (await api.post(`/recurring/${id}/${action}`)).data,
    onSuccess: () => invalidate(queryClient),
  });
}

export function usePreviewRecurringDates() {
  return useMutation({
    mutationFn: async (payload: { rrule: string; startDate: string; endDate?: string | null; weekendPolicy?: string }) =>
      (await api.post('/recurring/preview', payload)).data.data as string[],
  });
}

export function useCreateRuleFromTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      ...payload
    }: { transactionId: number; name: string; rrule?: string; mode?: 'AUTO_POST' | 'CONFIRM' }) =>
      (await api.post(`/recurring/from-transaction/${transactionId}`, payload)).data.data,
    onSuccess: () => invalidate(queryClient),
  });
}
