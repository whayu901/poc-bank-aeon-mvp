import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/useAppTheme';
import type { TransactionType } from '@/types/transaction';

interface TransactionBadgeProps {
  type: TransactionType;
}

export function TransactionBadge({ type }: TransactionBadgeProps) {
  const isIncoming = type === 'incoming';
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const label = t.transactionType[type];

  return (
    <View
      accessibilityLabel={`${t.transactionType.accessibility} ${label}`}
      testID={`transaction-badge-${type}`}
      style={[styles.badge, isIncoming ? styles.incoming : styles.outgoing]}>
      <Text style={[styles.icon, isIncoming ? styles.incomingText : styles.outgoingText]}>
        {isIncoming ? '↓' : '↑'}
      </Text>
      <Text style={[styles.label, isIncoming ? styles.incomingText : styles.outgoingText]}>
        {label}
      </Text>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  incoming: {
    backgroundColor: colors.successBg,
  },
  outgoing: {
    backgroundColor: colors.dangerBg,
  },
  icon: {
    fontSize: 13,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  incomingText: {
    color: colors.success,
  },
  outgoingText: {
    color: colors.danger,
  },
});
