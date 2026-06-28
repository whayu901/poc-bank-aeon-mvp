import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiTransactionRepository } from '@/repositories/ApiTransactionRepository';
import { Transaction } from '@/types/transaction';
import { queryKeys, invalidateQueries, prefetchQueries } from '@/lib/queryClient';
import { TokenManager } from '@/services/TokenManager';

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
      const listData = queryClient.getQueryData<Transaction[]>(
        queryKeys.transactions.lists()
      );
      return listData?.find((t) => t.refId === id || t.id === id);
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKeys.transactions.lists())?.dataUpdatedAt,

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