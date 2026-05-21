import React from 'react';
import { TextInput, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { FilterGroup } from '@/screens/transactionList/FilterGroup';
import type { TransactionListStyles } from '@/screens/transactionList/styles';
import type {
  TransactionDateRangeFilter,
  TransactionTypeFilter,
} from '@/utils/transaction';

interface SearchAndFiltersProps {
  query: string;
  selectedType: TransactionTypeFilter;
  selectedDateRange: TransactionDateRangeFilter;
  onChangeQuery: (query: string) => void;
  onChangeType: (type: TransactionTypeFilter) => void;
  onChangeDateRange: (dateRange: TransactionDateRangeFilter) => void;
  styles: TransactionListStyles;
}

export function SearchAndFilters({
  query,
  selectedType,
  selectedDateRange,
  onChangeQuery,
  onChangeType,
  onChangeDateRange,
  styles,
}: SearchAndFiltersProps) {
  const { t } = useTranslation();
  const typeOptions: Array<{ label: string; value: TransactionTypeFilter }> = [
    { label: t.list.all, value: 'all' },
    { label: t.transactionType.incoming, value: 'incoming' },
    { label: t.transactionType.outgoing, value: 'outgoing' },
  ];
  const dateOptions: Array<{ label: string; value: TransactionDateRangeFilter }> = [
    { label: t.list.allDates, value: 'all' },
    { label: t.list.oneWeek, value: 'week' },
    { label: t.list.oneMonth, value: 'month' },
  ];

  return (
    <View style={styles.searchPanel}>
      <TextInput
        accessibilityLabel={t.list.searchPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={onChangeQuery}
        placeholder={t.list.searchPlaceholder}
        placeholderTextColor={styles.searchPlaceholder.color}
        returnKeyType="search"
        style={styles.searchInput}
        testID="transaction-search-input"
        value={query}
      />

      <FilterGroup
        accessibilityLabel={t.list.typeFilterLabel}
        options={typeOptions}
        selectedValue={selectedType}
        onSelect={onChangeType}
        styles={styles}
        testIDPrefix="transaction-type-filter"
      />

      <FilterGroup
        accessibilityLabel={t.list.monthFilterLabel}
        options={dateOptions}
        selectedValue={selectedDateRange}
        onSelect={onChangeDateRange}
        styles={styles}
        testIDPrefix="transaction-date-filter"
      />
    </View>
  );
}
