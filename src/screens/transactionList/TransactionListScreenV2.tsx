import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { TransactionCard } from '@/components/TransactionCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useAppTheme } from '@/theme/useAppTheme';
import { Transaction } from '@/types/transaction';
import type { RootStackParamList } from '@/types/navigation';

// React Query hooks for server state
import {
  useTransactions,
  useRefreshTransactions,
  usePrefetchTransaction,
} from '@/hooks/useTransactionQueries';

// Zustand hooks for UI state only
import {
  useTransactionFilters,
  useUIActions,
  useIsRefreshing,
} from '@/store/uiStore';

// Utils for filtering (pure functions, no state)
import {
  filterTransactionsBySearch,
  filterTransactionsByType,
  filterTransactionsByDateRange,
  sortTransactions,
} from '@/utils/transaction';

import { styles } from './styles';

/**
 * Transaction List Screen V2
 *
 * CLEAN SEPARATION:
 * - SERVER STATE: Managed by React Query (transactions data)
 * - UI STATE: Managed by Zustand (filters, search)
 * - LOCAL STATE: Component state (UI interactions)
 *
 * This demonstrates the principle: "Server state and client state have different needs"
 */
export const TransactionListScreenV2: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();

  // UI State from Zustand
  const filters = useTransactionFilters();
  const isRefreshing = useIsRefreshing();
  const { setTransactionFilters, setRefreshing } = useUIActions();

  // Server State from React Query
  const {
    data: transactions,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useTransactions();

  // Prefetching hook for performance
  const prefetchTransaction = usePrefetchTransaction();

  // Refresh handler
  const refreshTransactions = useRefreshTransactions();

  /**
   * Handle pull-to-refresh
   * Coordinates between React Query and UI state
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshTransactions();
    setRefreshing(false);
  };

  /**
   * Apply filters to transactions
   * This is computed, not stored (derived state)
   */
  const filteredTransactions = React.useMemo(() => {
    if (!transactions) return [];

    let filtered = [...transactions];

    // Apply search filter
    if (filters.search) {
      filtered = filterTransactionsBySearch(filtered, filters.search);
    }

    // Apply type filter
    if (filters.type !== 'all') {
      filtered = filterTransactionsByType(filtered, filters.type);
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      filtered = filterTransactionsByDateRange(filtered, filters.dateRange);
    }

    // Apply sorting
    filtered = sortTransactions(filtered, filters.sortBy, filters.sortOrder);

    return filtered;
  }, [transactions, filters]);

  /**
   * Handle transaction press
   */
  const handleTransactionPress = (transaction: Transaction) => {
    navigation.navigate('TransactionDetail', {
      transactionId: transaction.refId || transaction.id,
    });
  };

  /**
   * Handle transaction hover (prefetch for performance)
   */
  const handleTransactionHover = (transaction: Transaction) => {
    // Prefetch transaction details on hover
    prefetchTransaction(transaction.refId || transaction.id as string);
  };

  /**
   * Render states
   */
  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <ErrorState
        error={error}
        onRetry={refetch}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search transactions..."
          placeholderTextColor={colors.textSecondary}
          value={filters.search}
          onChangeText={(text) => setTransactionFilters({ search: text })}
        />
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            filters.type === 'all' && styles.filterPillActive,
            { backgroundColor: filters.type === 'all' ? colors.primary : colors.surface },
          ]}
          onPress={() => setTransactionFilters({ type: 'all' })}
        >
          <Text
            style={[
              styles.filterText,
              { color: filters.type === 'all' ? colors.surface : colors.textPrimary },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            filters.type === 'incoming' && styles.filterPillActive,
            { backgroundColor: filters.type === 'incoming' ? colors.primary : colors.surface },
          ]}
          onPress={() => setTransactionFilters({ type: 'incoming' })}
        >
          <Text
            style={[
              styles.filterText,
              { color: filters.type === 'incoming' ? colors.surface : colors.textPrimary },
            ]}
          >
            Incoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            filters.type === 'outgoing' && styles.filterPillActive,
            { backgroundColor: filters.type === 'outgoing' ? colors.primary : colors.surface },
          ]}
          onPress={() => setTransactionFilters({ type: 'outgoing' })}
        >
          <Text
            style={[
              styles.filterText,
              { color: filters.type === 'outgoing' ? colors.surface : colors.textPrimary },
            ]}
          >
            Outgoing
          </Text>
        </TouchableOpacity>
      </View>

      {/* Background refresh indicator */}
      {isFetching && !isRefreshing && (
        <View style={styles.backgroundRefreshIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.refreshText, { color: colors.textSecondary }]}>
            Updating...
          </Text>
        </View>
      )}

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.refId || item.id?.toString() || ''}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleTransactionPress(item)}
            onPressIn={() => handleTransactionHover(item)}
          >
            <TransactionCard transaction={item} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No transactions"
            message={
              filters.search || filters.type !== 'all'
                ? 'Try adjusting your filters'
                : 'Your transactions will appear here'
            }
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Stats Bar (demonstrates cached data access) */}
      <View style={[styles.statsBar, { backgroundColor: colors.surface }]}>
        <Text style={[styles.statsText, { color: colors.textSecondary }]}>
          Showing {filteredTransactions.length} of {transactions?.length || 0} transactions
        </Text>
        <Text style={[styles.statsText, { color: colors.textMuted }]}>
          Last updated: {new Date().toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );
};