import { StyleSheet } from 'react-native';

import type { useAppTheme } from '@/theme/useAppTheme';

export const createTransactionListStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  spacing: ReturnType<typeof useAppTheme>['spacing'],
  typography: ReturnType<typeof useAppTheme>['typography'],
) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    listContent: {
      gap: spacing.lg,
      paddingBottom: spacing.xl,
    },
    header: {
      gap: spacing.sm,
      paddingBottom: spacing.sm,
      paddingTop: spacing.lg,
    },
    headerTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    title: {
      color: colors.textPrimary,
      ...typography.title,
      flex: 1,
    },
    subtitle: {
      color: colors.textSecondary,
      ...typography.subtitle,
    },
    searchPanel: {
      gap: spacing.md,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.textPrimary,
      fontSize: 15,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    searchPlaceholder: {
      color: colors.textMuted,
    },
    filterRow: {
      gap: spacing.sm,
      paddingRight: spacing.lg,
    },
    filterChip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    filterChipTextSelected: {
      color: colors.surface,
    },
    languageToggle: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      padding: 3,
    },
    languageOption: {
      alignItems: 'center',
      borderRadius: 999,
      justifyContent: 'center',
      minWidth: 36,
      overflow: 'hidden',
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    languageOptionSelected: {
      backgroundColor: colors.primary,
    },
    languageOptionText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    languageOptionTextSelected: {
      color: colors.surface,
    },
  });

export type TransactionListStyles = ReturnType<typeof createTransactionListStyles>;
