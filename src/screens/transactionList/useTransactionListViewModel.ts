import { useCallback, useMemo } from 'react';

import { useLanguage, useSetLanguage } from '@/store/preferencesStore';
import type { TransactionListScreenProps } from '@/types/navigation';
import { getFilteredTransactions } from '@/utils/transaction';

// React Query hooks for server state
import {
  useTransactions,
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

  // Server State from React Query
  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTransactions();

  // Prefetching hook for performance
  const prefetchTransaction = usePrefetchTransaction();

  // Refresh handler
  const refreshTransactions = useRefreshTransactions();

  // Apply filters to transactions (computed/derived state)
  const filteredTransactions = useMemo(
    () =>
      getFilteredTransactions({
        transactions,
        query: filters.search,
        type: filters.type,
        dateRange: filters.dateRange,
      }),
    [filters.search, filters.type, filters.dateRange, transactions],
  );

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
    }),
    [
      setLanguage,
      setSearchQuery,
      setSelectedType,
      setSelectedDateRange,
      openTransaction,
      retryFetchTransactions,
      handleRefresh,
    ]
  );

  // Memoize the return object as well
  return useMemo(
    () => ({
      transactions,
      filteredTransactions,
      isLoading: isLoading || isRefreshing,
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
