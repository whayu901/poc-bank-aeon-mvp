import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/useAppTheme';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors, spacing } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors, spacing);

  return (
    <View
      accessibilityLabel={t.states.errorAccessibility}
      style={styles.container}
      testID="error-state">
      <Text style={styles.title}>{t.states.errorTitle}</Text>
      <Text style={styles.message}>{message}</Text>
      <PrimaryButton label={t.common.tryAgain} onPress={onRetry} testID="retry-button" />
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  spacing: ReturnType<typeof useAppTheme>['spacing'],
) =>
  StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: spacing.md,
    padding: spacing.xl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
