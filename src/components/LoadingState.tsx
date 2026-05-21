import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/useAppTheme';

export function LoadingState() {
  const { colors, spacing } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors, spacing);

  return (
    <View
      accessibilityLabel={t.states.loadingAccessibility}
      style={styles.container}
      testID="loading-state">
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.text}>{t.states.loading}</Text>
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
    gap: spacing.md,
    padding: spacing.xxl,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});
