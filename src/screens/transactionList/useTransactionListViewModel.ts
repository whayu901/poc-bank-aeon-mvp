import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTransactionStore } from '@/store/transactionStore';
import type { TransactionListScreenProps } from '@/types/navigation';
import type {
  TransactionDateRangeFilter,
  TransactionTypeFilter,
} from '@/utils/transaction';
import { getFilteredTransactions } from '@/utils/transaction';

const SEARCH_DEBOUNCE_MS = 300;

export function useTransactionListViewModel({
  navigation,
}: TransactionListScreenProps) {
  const transactions = useTransactionStore((state) => state.transactions);
  const isLoading = useTransactionStore((state) => state.isLoading);
  const error = useTransactionStore((state) => state.error);
  const fetchTransactions = useTransactionStore((state) => state.fetchTransactions);
  const language = usePreferencesStore((state) => state.language);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionTypeFilter>('all');
  const [selectedDateRange, setSelectedDateRange] =
    useState<TransactionDateRangeFilter>('all');
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const filteredTransactions = useMemo(
    () =>
      getFilteredTransactions({
        transactions,
        query: debouncedSearchQuery,
        type: selectedType,
        dateRange: selectedDateRange,
      }),
    [debouncedSearchQuery, selectedDateRange, selectedType, transactions],
  );

  const hasActiveSearchOrFilters =
    debouncedSearchQuery.trim().length > 0 ||
    selectedType !== 'all' ||
    selectedDateRange !== 'all';

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const openTransaction = useCallback(
    (refId: string) => {
      navigation.navigate('TransactionDetail', { refId });
    },
    [navigation],
  );

  const retryFetchTransactions = useCallback(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const refreshTransactions = useCallback(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    filteredTransactions,
    isLoading,
    error,
    language,
    searchQuery,
    selectedType,
    selectedDateRange,
    hasActiveSearchOrFilters,
    actions: {
      setLanguage,
      setSearchQuery,
      setSelectedType,
      setSelectedDateRange,
      openTransaction,
      retryFetchTransactions,
      refreshTransactions,
    },
  };
}
