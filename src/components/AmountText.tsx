import React, { useMemo } from 'react';
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

function AmountTextComponent({ amount, size = 'regular', style, testID }: AmountTextProps) {
  const isOutgoing = amount < 0;
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const formatted = useMemo(() => formatCurrency(amount), [amount]);

  return (
    <Text
      accessibilityLabel={`${t.common.amount} ${formatted}`}
      testID={testID}
      style={[
        styles.amount,
        size === 'large' && styles.large,
        isOutgoing ? styles.outgoing : styles.incoming,
        style,
      ]}>
      {formatted}
    </Text>
  );
}

export const AmountText = React.memo(AmountTextComponent);

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
