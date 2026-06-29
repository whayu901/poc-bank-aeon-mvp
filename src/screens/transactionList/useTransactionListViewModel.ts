import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLanguage, useSetLanguage } from '@/store/preferencesStore';
import type { TransactionListScreenProps } from '@/types/navigation';

// React Query hooks for server state
import {
  useInfiniteTransactions,
  useRefreshTransactions,
  usePrefetchTransaction
} from '@/hooks/useTransactionQueries';

// Zustand hooks for UI state only
import {
  useTransactionFilters,
  useUIActions,
  useIsRefreshing,
} from '@/store/uiStore';

/**
 * Transaction List View Model
 *
 * SEPARATION OF CONCERNS:
 * - Server State: Managed by React Query (transactions data)
 * - UI State: Managed by Zustand (filters, search, preferences)
 *
 * This demonstrates proper state management architecture for banking apps
 */
export function useTransactionListViewModel({
  navigation,
}: TransactionListScreenProps) {
  // UI State from Zustand
  const filters = useTransactionFilters();
  const isRefreshing = useIsRefreshing();
  const { setTransactionFilters, setRefreshing } = useUIActions();

  // Preferences (persisted UI state) - using stable selectors
  const language = useLanguage();
  const setLanguage = useSetLanguage();

  // Debounce the search term so typing fires one paginated query after the
  // user pauses, not one per keystroke. The input still reflects filters.search
  // immediately (see `searchQuery` below) — only the network query is delayed.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Server State from React Query — infinite/paginated list. Filtering is now
  // done server-side, keyed by the (debounced) filter values.
  const queryFilters = useMemo(
    () => ({
      search: debouncedSearch,
      type: filters.type,
      dateRange: filters.dateRange,
    }),
    [debouncedSearch, filters.type, filters.dateRange],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTransactions(queryFilters);

  // Flatten all loaded pages into a single list for the FlatList.
  const transactions = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  // The server already filtered + sorted, so the "filtered" list is the list.
  // (Kept as a separate name so the screen's API stays unchanged.)
  const filteredTransactions = transactions;

  // Prefetching hook for performance
  const prefetchTransaction = usePrefetchTransaction();

  // Refresh handler
  const refreshTransactions = useRefreshTransactions();

  // Load the next page when the user scrolls near the bottom.
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const hasActiveSearchOrFilters =
    filters.search.trim().length > 0 ||
    filters.type !== 'all' ||
    filters.dateRange !== 'all';

  // Actions
  const openTransaction = useCallback(
    (refId: string) => {
      // Prefetch transaction details for better UX
      prefetchTransaction(refId);
      navigation.navigate('TransactionDetail', { refId });
    },
    [navigation, prefetchTransaction],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTransactions();
    setRefreshing(false);
  }, [refreshTransactions, setRefreshing]);

  const retryFetchTransactions = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Map UI state setters to expected interface
  const setSearchQuery = useCallback((search: string) => {
    setTransactionFilters({ search });
  }, [setTransactionFilters]);

  const setSelectedType = useCallback((type: 'all' | 'incoming' | 'outgoing') => {
    setTransactionFilters({ type });
  }, [setTransactionFilters]);

  const setSelectedDateRange = useCallback((dateRange: 'week' | 'month' | 'all') => {
    setTransactionFilters({ dateRange });
  }, [setTransactionFilters]);

  // Memoize actions object to prevent re-creating on every render
  const actions = useMemo(
    () => ({
      setLanguage,
      setSearchQuery,
      setSelectedType,
      setSelectedDateRange,
      openTransaction,
      retryFetchTransactions,
      refreshTransactions: handleRefresh,
      loadMore,
    }),
    [
      setLanguage,
      setSearchQuery,
      setSelectedType,
      setSelectedDateRange,
      openTransaction,
      retryFetchTransactions,
      handleRefresh,
      loadMore,
    ]
  );

  // Memoize the return object as well
  return useMemo(
    () => ({
      transactions,
      filteredTransactions,
      isLoading: isLoading || isRefreshing,
      isFetchingNextPage,
      hasNextPage: !!hasNextPage,
      error: isError ? error : null,
      language,
      searchQuery: filters.search,
      selectedType: filters.type,
      selectedDateRange: filters.dateRange,
      hasActiveSearchOrFilters,
      actions,
    }),
    [
      transactions,
      filteredTransactions,
      isLoading,
      isRefreshing,
      isFetchingNextPage,
      hasNextPage,
      isError,
      error,
      language,
      filters.search,
      filters.type,
      filters.dateRange,
      hasActiveSearchOrFilters,
      actions,
    ]
  );
}
