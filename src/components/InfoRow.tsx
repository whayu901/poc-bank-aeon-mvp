import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface InfoRowProps {
  label: string;
  value: string;
  testID?: string;
  actionAccessibilityLabel?: string;
  actionIcon?: ReactNode;
  actionTestID?: string;
  onActionPress?: () => void;
}

export function InfoRow({
  label,
  value,
  testID,
  actionAccessibilityLabel,
  actionIcon,
  actionTestID,
  onActionPress,
}: InfoRowProps) {
  const { colors, spacing } = useAppTheme();
  const styles = createStyles(colors, spacing);

  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text accessibilityLabel={`${label} ${value}`} style={styles.value}>
          {value}
        </Text>
        {onActionPress && actionIcon ? (
          <Pressable
            accessibilityLabel={actionAccessibilityLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onActionPress}
            style={styles.actionButton}
            testID={actionTestID}>
            {actionIcon}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  spacing: ReturnType<typeof useAppTheme>['spacing'],
) =>
  StyleSheet.create({
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  value: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  valueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
  },
});
