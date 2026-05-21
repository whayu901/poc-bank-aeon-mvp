import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { TransactionBadge } from '@/components/TransactionBadge';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Transaction } from '@/types/transaction';
import { formatDate } from '@/utils/date';
import { getTransactionType } from '@/utils/transaction';

interface TransactionCardProps {
  transaction: Transaction;
  onPress: () => void;
}

export function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const transactionType = getTransactionType(transaction.amount);
  const { colors, spacing } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors, spacing);

  return (
    <Pressable
      accessibilityLabel={`${transaction.transferName} to ${transaction.recipientName}, ${transaction.refId}`}
      accessibilityRole="button"
      onPress={onPress}
      testID={`transaction-card-${transaction.refId}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.transferName}>{transaction.transferName}</Text>
          <Text style={styles.recipient}>{transaction.recipientName}</Text>
        </View>
        <AmountText amount={transaction.amount} testID={`transaction-amount-${transaction.refId}`} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.date}>{formatDate(transaction.transferDate)}</Text>
        <Text style={styles.refId}>{t.common.referencePrefix} {transaction.refId}</Text>
      </View>

      <TransactionBadge type={transactionType} />
    </Pressable>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  spacing: ReturnType<typeof useAppTheme>['spacing'],
) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardPressed: {
    borderColor: colors.primary,
    transform: [{ scale: 0.995 }],
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  transferName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  recipient: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  date: {
    color: colors.textMuted,
    fontSize: 13,
  },
  refId: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
