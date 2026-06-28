import { QueryClient } from '@tanstack/react-query';
import { TokenManager } from '@/services/TokenManager';
import { isAppError } from '@/models/AppError';

/**
 * Query client configuration for TanStack Query
 *
 * Principles for server state management in banking apps:
 * - Aggressive caching for better perceived performance
 * - Background refetch to ensure data freshness
 * - Smart retry logic (don't retry 4xx errors)
 * - Stale-while-revalidate for instant UI updates
 * - Request deduplication for efficiency
 *
 * SERVER STATE (managed by TanStack Query):
 * - Transactions list
 * - Transaction details
 * - User profile
 * - Account balances
 * - Any data fetched from API
 *
 * CLIENT STATE (managed by Zustand):
 * - Auth status (authenticated/locked/etc)
 * - UI preferences (theme, language)
 * - Form state (filters, search)
 * - Session info
 */

/**
 * Create configured query client
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Stale time: How long data is considered fresh
         * Banking data should be relatively fresh
         */
        staleTime: 30 * 1000, // 30 seconds

        /**
         * Cache time: How long to keep unused data in cache
         * Keep for 5 minutes after component unmounts
         */
        gcTime: 5 * 60 * 1000, // 5 minutes (renamed from cacheTime in v5)

        /**
         * Refetch on window focus
         * Important for banking apps to show latest data
         */
        refetchOnWindowFocus: true,

        /**
         * Refetch on reconnect
         * Sync data after network recovery
         */
        refetchOnReconnect: true,

        /**
         * Refetch on mount
         * Always fetch fresh data when component mounts
         */
        refetchOnMount: true,

        /**
         * Retry configuration
         * Smart retry: don't retry client errors (4xx)
         */
        retry: (failureCount, error) => {
          // Don't retry if max attempts reached
          if (failureCount >= 3) return false;

          // Don't retry client errors (4xx) except 401 (handled by TokenManager)
          if (isAppError(error)) {
            const statusCode = error.statusCode;
            if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 401) {
              return false;
            }
          }

          // Retry other errors
          return true;
        },

        /**
         * Retry delay with exponential backoff
         */
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        /**
         * Network mode
         * 'online' - only fetch when online
         * 'always' - fetch regardless of network state
         * 'offlineFirst' - use cache first, then fetch
         */
        networkMode: 'online',
      },

      mutations: {
        /**
         * Mutation retry configuration
         * Be more conservative with mutations
         */
        retry: 1,
        retryDelay: 1000,

        /**
         * Network mode for mutations
         * Only attempt mutations when online
         */
        networkMode: 'online',
      },
    },
  });
}

/**
 * Global query client instance
 */
export const queryClient = createQueryClient();

/**
 * Query keys factory for type-safe query keys
 * Prevents key collisions and makes invalidation easier
 */
export const queryKeys = {
  all: ['api'] as const,

  transactions: {
    all: ['api', 'transactions'] as const,
    lists: () => ['api', 'transactions', 'list'] as const,
    list: (filters?: Record<string, any>) =>
      ['api', 'transactions', 'list', filters] as const,
    details: () => ['api', 'transactions', 'detail'] as const,
    detail: (id: string) => ['api', 'transactions', 'detail', id] as const,
  },

  user: {
    all: ['api', 'user'] as const,
    profile: () => ['api', 'user', 'profile'] as const,
    settings: () => ['api', 'user', 'settings'] as const,
  },

  account: {
    all: ['api', 'account'] as const,
    balance: () => ['api', 'account', 'balance'] as const,
    details: () => ['api', 'account', 'details'] as const,
  },
} as const;

/**
 * Invalidation helpers
 */
export const invalidateQueries = {
  /**
   * Invalidate all queries
   */
  all: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),

  /**
   * Invalidate all transaction queries
   */
  transactions: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),

  /**
   * Invalidate specific transaction
   */
  transaction: (id: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.detail(id) }),

  /**
   * Invalidate user queries
   */
  user: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.all }),
};

/**
 * Prefetching helpers for optimistic loading
 */
export const prefetchQueries = {
  /**
   * Prefetch transaction details
   */
  transactionDetail: async (id: string, fetchFn: () => Promise<any>) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.detail(id),
      queryFn: fetchFn,
      staleTime: 30 * 1000,
    });
  },

  /**
   * Prefetch user profile
   */
  userProfile: async (fetchFn: () => Promise<any>) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.user.profile(),
      queryFn: fetchFn,
      staleTime: 60 * 1000, // User profile changes less frequently
    });
  },
};

/**
 * Optimistic update helpers
 */
export const optimisticUpdates = {
  /**
   * Update transaction in cache optimistically
   */
  updateTransaction: (id: string, updater: (old: any) => any) => {
    queryClient.setQueryData(queryKeys.transactions.detail(id), updater);

    // Also update in the list
    queryClient.setQueriesData(
      { queryKey: queryKeys.transactions.lists() },
      (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.map((txn: any) =>
            txn.id === id || txn.refId === id ? updater(txn) : txn
          ),
        };
      }
    );
  },
};