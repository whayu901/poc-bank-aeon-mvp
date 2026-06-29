import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ApiTransactionRepository,
  type TransactionPageFilters,
} from '@/repositories/ApiTransactionRepository';
import { Transaction } from '@/types/transaction';
import { queryKeys, invalidateQueries, prefetchQueries } from '@/lib/queryClient';
import { TokenManager } from '@/services/TokenManager';

/** How many rows to request per page. The backend can serve far more at once,
 *  but we deliberately fetch a screenful-plus so memory stays bounded and the
 *  first paint is fast regardless of how many months of history exist. */
export const TRANSACTIONS_PAGE_SIZE = 20;

/**
 * Transaction query hooks using TanStack Query
 *
 * These hooks manage SERVER STATE (transactions from API)
 * UI state (filters, search) remains in Zustand or local component state
 *
 * Benefits over storing in Zustand:
 * - Automatic background refetch
 * - Request deduplication
 * - Optimistic updates
 * - Built-in loading/error states
 * - Cache management
 * - Stale-while-revalidate
 */

// Initialize repository
const repository = new ApiTransactionRepository();
const tokenManager = TokenManager.getInstance();

/**
 * Hook to fetch all transactions
 *
 * Features:
 * - Automatic refetch on focus/reconnect
 * - Stale-while-revalidate for instant UI
 * - Background updates every 30 seconds
 * - Deduplicates concurrent requests
 */
export function useTransactions(filters?: {
  search?: string;
  type?: 'incoming' | 'outgoing';
  dateRange?: 'week' | 'month' | 'all';
}) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: async () => {
      // Use TokenManager to handle 401 retries
      return tokenManager.makeAuthenticatedRequest(async () => {
        const transactions = await repository.getAllTransactions();

        // Apply filters here or in the repository
        // For now, return all and filter in the UI
        return transactions;
      });
    },
    // Enable stale-while-revalidate
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes

    // Refetch in background
    refetchInterval: 60 * 1000, // Refetch every minute
    refetchIntervalInBackground: false, // Don't refetch when tab is hidden

    // Keep previous data while fetching
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to fetch transactions as an INFINITE (paginated) list.
 *
 * This is the screen's primary data source. Instead of loading every
 * transaction up front, it pulls one page at a time and appends more as the
 * user scrolls (via `fetchNextPage`). Filtering happens server-side, and each
 * filter combination gets its own cache entry — change the search/type/date
 * and TanStack Query tracks a separate paginated list, with the previous one
 * still warm in cache if the user switches back.
 *
 * Returned shape (TanStack infinite query):
 * - data.pages: Array<{ data: Transaction[]; nextCursor }>
 * - fetchNextPage(), hasNextPage, isFetchingNextPage
 */
export function useInfiniteTransactions(filters?: TransactionPageFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.infinite(filters),
    queryFn: ({ pageParam }) => {
      // TokenManager still wraps every page fetch, so the refresh/401 handling
      // (and the thundering-herd defenses) apply to pagination too.
      return tokenManager.makeAuthenticatedRequest(() =>
        repository.getTransactionsPage({
          cursor: pageParam,
          limit: TRANSACTIONS_PAGE_SIZE,
          filters,
        }),
      );
    },
    initialPageParam: 0,
    // Returning undefined tells TanStack there are no more pages → hasNextPage=false.
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    // Keep showing the current list while a new filter's first page loads.
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to fetch a single transaction
 *
 * Features:
 * - Automatic cache hit if already in list
 * - Prefetch on hover for instant navigation
 * - Separate cache entry for details
 */
export function useTransaction(id: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.transactions.detail(id!),
    queryFn: async () => {
      return tokenManager.makeAuthenticatedRequest(async () => {
        const transaction = await repository.getTransactionById(id!);
        if (!transaction) {
          throw new Error('Transaction not found');
        }
        return transaction;
      });
    },
    enabled: !!id, // Only fetch if ID is provided

    // Try to use data from list query first
    initialData: () => {
      // Look for data in any list query (with or without filters)
      const cache = queryClient.getQueryCache();
      const queries = cache.findAll({
        queryKey: ['api', 'transactions', 'list'],
        type: 'active'
      });

      for (const query of queries) {
        const data = query.state.data as { data: Transaction[] } | Transaction[] | undefined;
        if (data) {
          // Handle both response wrapper and direct array
          const transactions = Array.isArray(data) ? data : data.data;
          const found = transactions?.find((t) => t.refId === id || t.id === id);
          if (found) return found;
        }
      }

      return undefined;
    },
    initialDataUpdatedAt: () => {
      // Get the most recent update time from any list query
      const cache = queryClient.getQueryCache();
      const queries = cache.findAll({
        queryKey: ['api', 'transactions', 'list'],
        type: 'active'
      });

      let latestUpdate = 0;
      for (const query of queries) {
        if (query.state.dataUpdatedAt && query.state.dataUpdatedAt > latestUpdate) {
          latestUpdate = query.state.dataUpdatedAt;
        }
      }

      return latestUpdate || undefined;
    },

    staleTime: 60 * 1000, // Details are less likely to change
  });
}

/**
 * Hook to prefetch transaction on hover
 *
 * Improves perceived performance by loading data before navigation
 */
export function usePrefetchTransaction() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.detail(id),
      queryFn: async () => {
        return tokenManager.makeAuthenticatedRequest(async () => {
          const transaction = await repository.getTransactionById(id);
          if (!transaction) {
            throw new Error('Transaction not found');
          }
          return transaction;
        });
      },
      staleTime: 60 * 1000,
    });
  };
}

/**
 * Hook to create a new transaction (example mutation)
 *
 * Features:
 * - Optimistic updates
 * - Automatic cache invalidation
 * - Rollback on error
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTransaction: Partial<Transaction>) => {
      return tokenManager.makeAuthenticatedRequest(async () => {
        // This would call a create endpoint
        // For now, just simulate
        return {
          ...newTransaction,
          refId: `TXN${Date.now()}`,
          id: `TXN${Date.now()}`,
        } as Transaction;
      });
    },

    // Optimistic update
    onMutate: async (newTransaction) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions.lists() });

      // Snapshot previous value
      const previousTransactions = queryClient.getQueryData<Transaction[]>(
        queryKeys.transactions.lists()
      );

      // Optimistically update
      if (previousTransactions) {
        queryClient.setQueryData<Transaction[]>(
          queryKeys.transactions.lists(),
          [...previousTransactions, newTransaction as Transaction]
        );
      }

      return { previousTransactions };
    },

    // Rollback on error
    onError: (err, newTransaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(
          queryKeys.transactions.lists(),
          context.previousTransactions
        );
      }
    },

    // Refetch after success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

/**
 * Hook to handle pull-to-refresh
 */
export function useRefreshTransactions() {
  const queryClient = useQueryClient();

  return async () => {
    // Invalidate and refetch all transaction queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.transactions.all,
      refetchType: 'all', // Force refetch even if not stale
    });
  };
}

/**
 * Hook to get cached transaction count
 * Useful for showing badges without refetch
 */
export function useCachedTransactionCount() {
  const queryClient = useQueryClient();

  const transactions = queryClient.getQueryData<Transaction[]>(
    queryKeys.transactions.lists()
  );

  return transactions?.length ?? 0;
}

/**
 * Hook for transaction search with debounce
 *
 * Separates UI state (search input) from server state (results)
 */
export function useTransactionSearch(searchTerm: string, debounceMs: number = 300) {
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchTerm);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  return useTransactions({ search: debouncedSearch });
}

// Import React for hooks
import React from 'react';