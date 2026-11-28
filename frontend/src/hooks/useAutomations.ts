import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export type TriggerType = 'MANUAL' | 'SCHEDULE' | 'EVENT' | 'WEBHOOK';
export type RunStatus = 'OK' | 'FAILED' | 'DRY_RUN' | 'SKIPPED';

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerConfig: { cron?: string; events?: string[] };
  script: string;
  variables: Record<string, string | number>;
  secretKeys: string[];
  isActive: boolean;
  failCount: number;
  lastRunAt: string | null;
  lastRunStatus: RunStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedPost {
  description: string;
  date: string;
  lines: { account: string; amountPaise: number }[];
}

export interface AutomationRun {
  id: string;
  trigger: string;
  status: RunStatus;
  logs: string[];
  error: string | null;
  transactionIds: number[];
  durationMs: number;
  isDryRun: boolean;
  createdAt: string;
  planned?: PlannedPost[];
}

export interface AutomationVersion {
  id: string;
  version: number;
  script: string;
  variables: Record<string, string | number>;
  triggerConfig: { cron?: string; events?: string[] };
  createdBy: 'USER' | 'RESTORE';
  createdAt: string;
}

export interface AutomationDetail {
  automation: Automation;
  versions: AutomationVersion[];
  runs: AutomationRun[];
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerConfig: { cron?: string; events?: string[] };
  variables: Record<string, string | number>;
  script: string;
  limits: { maxPosts: number; timeoutMs: number; memoryBytes: number };
}

export interface AutomationInput {
  name: string;
  description?: string | null;
  triggerType: TriggerType;
  triggerConfig: { cron?: string; events?: string[] };
  script: string;
  variables: Record<string, string | number>;
  secrets?: Record<string, string>;
  isActive: boolean;
}

const listKey = ['automations', 'list'] as const;
const detailKey = (id: string) => ['automations', 'detail', id] as const;

export function useAutomations() {
  return useQuery<{ paused: boolean; automations: Automation[] }>({
    queryKey: listKey,
    queryFn: async () => (await api.get('/automations')).data.data,
  });
}

export function useAutomationDetail(id: string | null) {
  return useQuery<AutomationDetail>({
    queryKey: detailKey(id ?? 'none'),
    enabled: Boolean(id),
    queryFn: async () => (await api.get(`/automations/${id}`)).data.data,
  });
}

export function useAutomationTemplates() {
  return useQuery<AutomationTemplate[]>({
    queryKey: ['automations', 'templates'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => (await api.get('/automations/templates')).data.data,
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AutomationInput) =>
      (await api.post('/automations', input)).data.data as Automation & { webhookSecret: string | null },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AutomationInput> & { id: string }) =>
      (await api.patch(`/automations/${id}`, patch)).data.data as Automation,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
      void queryClient.invalidateQueries({ queryKey: detailKey(variables.id) });
    },
  });
}

export function useArchiveAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/automations/${id}`)).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useRunAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dryRun }: { id: string; dryRun: boolean }) =>
      (await api.post(`/automations/${id}/run`, { dryRun })).data.data as AutomationRun,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
      void queryClient.invalidateQueries({ queryKey: detailKey(variables.id) });
    },
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, versionId }: { id: string; versionId: string }) =>
      (await api.post(`/automations/${id}/versions/${versionId}/restore`)).data.data as Automation,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
      void queryClient.invalidateQueries({ queryKey: detailKey(variables.id) });
    },
  });
}

export function useKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paused: boolean) => (await api.patch('/automations/settings', { paused })).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function describeTrigger(triggerType: TriggerType, config: { cron?: string; events?: string[] }): string {
  if (triggerType === 'SCHEDULE') return `Cron ${config.cron ?? '—'}`;
  if (triggerType === 'EVENT') return `After ${(config.events ?? []).map((event) => event.replace('transaction.', '')).join(', ') || 'ledger events'}`;
  if (triggerType === 'WEBHOOK') return 'On webhook call';
  return 'Manual only';
}
