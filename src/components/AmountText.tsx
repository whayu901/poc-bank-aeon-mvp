import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/useAppTheme';
import { formatCurrency } from '@/utils/currency';

interface AmountTextProps {
  amount: number;
  size?: 'regular' | 'large';
  style?: TextStyle;
  testID?: string;
}

export function AmountText({ amount, size = 'regular', style, testID }: AmountTextProps) {
  const isOutgoing = amount < 0;
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  return (
    <Text
      accessibilityLabel={`${t.common.amount} ${formatCurrency(amount)}`}
      testID={testID}
      style={[
        styles.amount,
        size === 'large' && styles.large,
        isOutgoing ? styles.outgoing : styles.incoming,
        style,
      ]}>
      {formatCurrency(amount)}
    </Text>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
  amount: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '700',
  },
  large: {
    fontSize: 32,
    lineHeight: 40,
  },
  incoming: {
    color: colors.success,
  },
  outgoing: {
    color: colors.danger,
  },
});
