import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/useAppTheme';
import { BatteryGaugeView, useBattery } from '../../modules/battery-level';

/**
 * Reads the battery from the native module and hands the value to the native
 * gauge view as a prop. The view stays presentational; the module owns state.
 */
export function BatteryIndicator() {
  const { colors, typography } = useAppTheme();
  const { t } = useTranslation();
  const { level, state } = useBattery();

  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

  const isUnavailable = level < 0;
  const isCharging = state === 'charging' || state === 'full';
  const percentage = Math.round(level * 100);

  const fillColor = isCharging ? colors.success : level <= 0.2 ? colors.danger : colors.primary;

  const accessibilityLabel = isUnavailable
    ? t.battery.unavailable
    : `${t.battery.label}: ${percentage}%${state === 'charging' ? `, ${t.battery.charging}` : ''}`;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={styles.container}
      testID="battery-indicator">
      <BatteryGaugeView
        boltColor={colors.surface}
        charging={isCharging}
        color={fillColor}
        level={level}
        style={styles.gauge}
        trackColor={colors.border}
      />
      <Text style={styles.label} testID="battery-indicator-label">
        {isUnavailable ? '--' : `${percentage}%`}
      </Text>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  typography: ReturnType<typeof useAppTheme>['typography'],
) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    gauge: {
      height: 18,
      width: 40,
    },
    label: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: '600',
    },
  });
