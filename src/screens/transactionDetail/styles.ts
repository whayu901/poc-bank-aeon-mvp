import { StyleSheet } from 'react-native';

import type { useAppTheme } from '@/theme/useAppTheme';

export const createTransactionDetailStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  spacing: ReturnType<typeof useAppTheme>['spacing'],
) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      padding: spacing.lg,
    },
    receiptCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing.xl,
    },
    amountBlock: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },
    receiptLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    transferName: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      textAlign: 'center',
    },
    divider: {
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderTopWidth: 1,
      marginVertical: spacing.lg,
    },
    footer: {
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      padding: spacing.lg,
    },
    notFoundCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      gap: spacing.sm,
      margin: spacing.lg,
      padding: spacing.xl,
    },
    notFoundTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    notFoundText: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
  });
