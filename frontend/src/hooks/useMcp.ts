import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Transaction } from './useQueries';

export type McpScope = 'read' | 'write:transactions';
export type McpWriteMode = 'DRAFT' | 'DIRECT';

export interface McpToken {
  id: string;
  name: string;
  prefix: string;
  scopes: McpScope[];
  writeMode: McpWriteMode;
  accountAllowList: number[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface McpTokenCreated extends McpToken {
  token: string;
  setup: {
    url: string;
    claudeDesktop: { mcpServers: Record<string, { url: string; headers: Record<string, string> }> } | string;
    claudeCode: string;
    generic: { transport: string; headers: Record<string, string> };
  };
}

export interface McpAuditEntry {
  id: string;
  tool: string;
  status: 'OK' | 'ERROR' | 'DENIED';
  summary: string | null;
  error: string | null;
  durationMs: number | null;
  tokenName: string | null;
  createdAt: string;
}

export interface McpSetup {
  url: string;
  transport: string;
  auth: string;
  tools: { name: string; access: McpScope }[];
}

export interface CreateTokenPayload {
  name: string;
  scopes: McpScope[];
  writeMode: McpWriteMode;
  expiresInDays?: number | null;
  accountAllowList?: number[];
}

export function useMcpTokens() {
  return useQuery<McpToken[]>({
    queryKey: ['mcp', 'tokens'],
    queryFn: async () => (await api.get('/mcp/tokens')).data.data as McpToken[],
  });
}

export function useMcpSetup() {
  return useQuery<McpSetup>({
    queryKey: ['mcp', 'setup'],
    queryFn: async () => (await api.get('/mcp/setup')).data.data as McpSetup,
  });
}

export function useMcpAudit(limit = 50) {
  return useQuery<McpAuditEntry[]>({
    queryKey: ['mcp', 'audit', limit],
    queryFn: async () => (await api.get('/mcp/audit', { params: { limit } })).data.data as McpAuditEntry[],
  });
}

export function useCreateMcpToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTokenPayload) =>
      (await api.post('/mcp/tokens', payload)).data.data as McpTokenCreated,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mcp', 'tokens'] }),
  });
}

export function useRevokeMcpToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/mcp/tokens/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mcp', 'tokens'] }),
  });
}

export function useDraftTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ['mcp', 'drafts'],
    queryFn: async () => {
      const res = await api.get('/transactions', { params: { status: 'DRAFT', limit: 100 } });
      return (res.data.data || res.data) as Transaction[];
    },
  });
}

export function useBulkTransactionAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, action }: { ids: number[]; action: 'approve' | 'void' }) =>
      (await api.post('/transactions/bulk', { ids, action })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp', 'drafts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}
