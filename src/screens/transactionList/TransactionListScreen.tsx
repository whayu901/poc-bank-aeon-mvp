import React, { useCallback } from "react";
import { FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { TransactionCard } from "@/components/TransactionCard";
import { useTranslation } from "@/i18n";
import { SearchAndFilters } from "@/screens/transactionList/SearchAndFilters";
import { createTransactionListStyles } from "@/screens/transactionList/styles";
import { TransactionListHeader } from "@/screens/transactionList/TransactionListHeader";
import { useTransactionListViewModel } from "@/screens/transactionList/useTransactionListViewModel";
import { useAppTheme } from "@/theme/useAppTheme";
import type { TransactionListScreenProps } from "@/types/navigation";
import type { Transaction } from "@/types/transaction";

export function TransactionListScreen(props: TransactionListScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { t } = useTranslation();
  const styles = createTransactionListStyles(colors, spacing, typography);
  const viewModel = useTransactionListViewModel(props);
  const { actions } = viewModel;

  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onPress={() => actions.openTransaction(item.refId)}
      />
    ),
    [actions],
  );

  const header = (
    <>
      <TransactionListHeader
        language={viewModel.language}
        onChangeLanguage={actions.setLanguage}
        styles={styles}
      />
      <SearchAndFilters
        onChangeDateRange={actions.setSelectedDateRange}
        onChangeQuery={actions.setSearchQuery}
        onChangeType={actions.setSelectedType}
        query={viewModel.searchQuery}
        selectedDateRange={viewModel.selectedDateRange}
        selectedType={viewModel.selectedType}
        styles={styles}
      />
    </>
  );

  if (viewModel.isLoading && viewModel.transactions.length === 0) {
    return (
      <SafeAreaView edges={["left", "right"]} style={styles.container}>
        <TransactionListHeader
          language={viewModel.language}
          onChangeLanguage={actions.setLanguage}
          styles={styles}
        />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (viewModel.error && viewModel.transactions.length === 0) {
    return (
      <SafeAreaView edges={["left", "right"]} style={styles.container}>
        <TransactionListHeader
          language={viewModel.language}
          onChangeLanguage={actions.setLanguage}
          styles={styles}
        />
        <ErrorState
          message={t.states.loadError}
          onRetry={actions.retryFetchTransactions}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.container}>
      <FlatList
        accessibilityLabel={t.list.accessibilityLabel}
        contentContainerStyle={styles.listContent}
        data={viewModel.filteredTransactions}
        keyExtractor={(item) => item.refId}
        ListHeaderComponent={header}
        ListEmptyComponent={
          viewModel.transactions.length > 0 &&
          viewModel.hasActiveSearchOrFilters ? (
            <EmptyState
              title={t.states.noMatchingTitle}
              description={t.states.noMatchingDescription}
            />
          ) : (
            <EmptyState />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isLoading}
            onRefresh={actions.refreshTransactions}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={renderTransaction}
        testID="transaction-list"
      />
    </SafeAreaView>
  );
}
