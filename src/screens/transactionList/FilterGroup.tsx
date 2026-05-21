import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import type { TransactionListStyles } from '@/screens/transactionList/styles';

interface FilterGroupProps<TValue extends string> {
  accessibilityLabel: string;
  options: Array<{ label: string; value: TValue }>;
  selectedValue: TValue;
  onSelect: (value: TValue) => void;
  styles: TransactionListStyles;
  testIDPrefix: string;
}

export function FilterGroup<TValue extends string>({
  accessibilityLabel,
  options,
  selectedValue,
  onSelect,
  styles,
  testIDPrefix,
}: FilterGroupProps<TValue>) {
  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.filterRow}
      horizontal
      showsHorizontalScrollIndicator={false}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;

        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            testID={`${testIDPrefix}-${option.value}`}>
            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
