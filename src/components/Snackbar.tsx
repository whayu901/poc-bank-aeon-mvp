import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface SnackbarProps {
  message: string;
  visible: boolean;
  testID?: string;
}

export function Snackbar({ message, visible, testID }: SnackbarProps) {
  const { colors, spacing } = useAppTheme();
  const styles = createStyles(colors, spacing);

  if (!visible) {
    return null;
  }

  return (
    <View accessibilityRole="alert" style={styles.container} testID={testID}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  spacing: ReturnType<typeof useAppTheme>['spacing'],
) =>
  StyleSheet.create({
    container: {
      alignSelf: 'center',
      backgroundColor: colors.textPrimary,
      borderRadius: 12,
      bottom: 86,
      maxWidth: '92%',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      position: 'absolute',
    },
    message: {
      color: colors.surface,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
