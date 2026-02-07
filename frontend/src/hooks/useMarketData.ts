import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface MarketPrice {
  symbol: string;
  price: number;
  timestamp: number;
  error?: string;
}

interface MarketDataCache {
  [symbol: string]: MarketPrice;
}

// Hook for fetching market data (manual only, no auto-refresh)
export function useMarketData(symbols: string[] = []) {
  return useQuery<MarketDataCache>({
    queryKey: ['marketData', symbols],
    queryFn: async () => {
      return {};
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

// Hook for fetching a single symbol's price manually (now wraps batch)
export function useRefreshSymbolPrice() {
  const queryClient = useQueryClient();
  const refreshAll = useRefreshAllPrices();

  return useMutation({
    mutationFn: async ({ symbol }: { symbol: string; accountId: number }) => {
      // Reuse batch logic for single item
      const results = await refreshAll.mutateAsync([{ symbol, accountId: 0 }]);
      const data = results[symbol.toUpperCase()];
      if (data && !data.error) {
        return data;
      }
      throw new Error(data?.error || 'Failed to fetch price');
    },
    onSuccess: () => {
      // Invalidate accounts to refresh the stored price in the UI
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}

// Hook for fetching all symbols in batch
export function useRefreshAllPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { symbol: string; accountId: number }[]) => {
      const symbols = items.map(i => i.symbol);
      if (symbols.length === 0) return {};

      try {
        const res = await api.post('/price/batch', { symbols });
        const data = res.data; // Array of { symbol, price, lastUpdated, source, error? }

        const results: MarketDataCache = {};
        data.forEach((item: any) => {
          if (item.error) {
            results[item.symbol] = {
              symbol: item.symbol,
              price: 0,
              timestamp: Date.now(),
              error: item.error
            };
          } else {
            results[item.symbol] = {
              symbol: item.symbol,
              price: item.price,
              timestamp: new Date(item.lastUpdated).getTime(),
            };
          }
        });
        return results;
      } catch (error) {
        console.error('Batch refresh failed', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<MarketDataCache>(['marketData'], (old = {}) => ({
        ...old,
        ...data,
      }));
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}

// Hook to get cached market data
export function useCachedMarketData() {
  const queryClient = useQueryClient();
  const data = queryClient.getQueryData<MarketDataCache>(['marketData']) || {};

  return {
    data,
    getPrice: (symbol: string) => {
      const upperSymbol = symbol.toUpperCase();
      const priceData = data[upperSymbol];
      return priceData && !priceData.error ? priceData.price : null;
    },
    getError: (symbol: string) => {
      const upperSymbol = symbol.toUpperCase();
      return data[upperSymbol]?.error;
    },
  };
}
