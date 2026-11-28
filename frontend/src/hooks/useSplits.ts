import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { toast } from 'sonner';

export interface SplitMemberBalance {
  id: string;
  name: string;
  email: string | null;
  isMe: boolean;
  paidPaise: string;
  owedPaise: string;
  settledPaise: string;
  netPaise: string;
}

export interface SplitTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountPaise: string;
}

export interface SplitGroupSummary {
  id: string;
  name: string;
  emoji: string | null;
  memberCount: number;
  expenseCount: number;
  totalPaise: string;
  myNetPaise: string;
  updatedAt: string;
}

export interface SplitExpense {
  id: string;
  description: string;
  amountPaise: string;
  date: string;
  category: string | null;
  paidById: string;
  paidByName: string;
  transactionId: number | null;
  shares: { memberId: string; amountPaise: string }[];
}

export interface SplitGroupDetail {
  id: string;
  name: string;
  emoji: string | null;
  members: SplitMemberBalance[];
  transfers: SplitTransfer[];
  totalPaise: string;
  expenses: SplitExpense[];
  settlements: { id: string; fromId: string; toId: string; amountPaise: string; date: string; note: string | null }[];
}

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['splits'] });
};

export function useSplitGroups() {
  return useQuery<SplitGroupSummary[]>({
    queryKey: ['splits', 'groups'],
    queryFn: async () => {
      const res = await api.get('/splits/groups');
      return res.data.data ?? [];
    },
  });
}

export function useSplitGroup(id: string | null) {
  return useQuery<SplitGroupDetail>({
    queryKey: ['splits', 'group', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/splits/groups/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateSplitGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; emoji?: string; members: { name: string }[] }) => {
      const res = await api.post('/splits/groups', payload);
      return res.data.data as SplitGroupDetail;
    },
    onSuccess: () => invalidate(queryClient),
    onError: () => toast.error('Could not create that group'),
  });
}

export function useAddSplitMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, name }: { groupId: string; name: string }) => {
      const res = await api.post(`/splits/groups/${groupId}/members`, { name });
      return res.data.data as SplitGroupDetail;
    },
    onSuccess: () => invalidate(queryClient),
    onError: (error: any) =>
      toast.error(error?.response?.data?.error ?? 'Could not add that person'),
  });
}

export function useRemoveSplitMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, memberId }: { groupId: string; memberId: string }) => {
      const res = await api.delete(`/splits/groups/${groupId}/members/${memberId}`);
      return res.data.data as SplitGroupDetail;
    },
    onSuccess: () => invalidate(queryClient),
    onError: (error: any) =>
      toast.error(error?.response?.data?.error ?? 'Could not remove that person'),
  });
}

export function useAddSplitExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      ...payload
    }: {
      groupId: string;
      description: string;
      amountPaise: string;
      paidById: string;
      memberIds: string[];
      date?: string;
    }) => {
      const res = await api.post(`/splits/groups/${groupId}/expenses`, payload);
      return res.data.data as SplitGroupDetail;
    },
    onSuccess: () => invalidate(queryClient),
    onError: (error: any) => toast.error(error?.response?.data?.error ?? 'Could not add that expense'),
  });
}

export function useDeleteSplitExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, expenseId }: { groupId: string; expenseId: string }) => {
      const res = await api.delete(`/splits/groups/${groupId}/expenses/${expenseId}`);
      return res.data.data as SplitGroupDetail;
    },
    onSuccess: () => invalidate(queryClient),
    onError: (error: any) => toast.error(error?.response?.data?.error ?? 'Could not delete that expense'),
  });
}

export function useAddSplitSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      ...payload
    }: { groupId: string; fromId: string; toId: string; amountPaise: string; note?: string }) => {
      const res = await api.post(`/splits/groups/${groupId}/settlements`, payload);
      return res.data.data as SplitGroupDetail;
    },
    onSuccess: () => invalidate(queryClient),
    onError: (error: any) => toast.error(error?.response?.data?.error ?? 'Could not record that payment'),
  });
}

export function usePostSplitShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      expenseId,
      accountId,
    }: {
      groupId: string;
      expenseId: string;
      accountId: number;
    }) => {
      const res = await api.post(`/splits/groups/${groupId}/expenses/${expenseId}/post`, { accountId });
      return res.data.data as { transactionId: number; amountPaise: string };
    },
    onSuccess: () => {
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? 'Could not post that share'),
  });
}

export function useDeleteSplitGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      await api.delete(`/splits/groups/${groupId}`);
    },
    onSuccess: () => invalidate(queryClient),
    onError: () => toast.error('Could not delete that group'),
  });
}
