import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/useAppTheme';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  const { colors, spacing } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors, spacing);
  const displayTitle = title ?? t.states.emptyTitle;
  const displayDescription = description ?? t.states.emptyDescription;

  return (
    <View accessibilityLabel={displayTitle} style={styles.container} testID="empty-state">
      <Text style={styles.icon}>•</Text>
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.description}>{displayDescription}</Text>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  spacing: ReturnType<typeof useAppTheme>['spacing'],
) =>
  StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  icon: {
    color: colors.primary,
    fontSize: 32,
    lineHeight: 34,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
