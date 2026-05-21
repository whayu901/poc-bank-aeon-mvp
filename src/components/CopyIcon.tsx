import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export function CopyIcon() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.container}>
      <View style={[styles.square, styles.backSquare]} />
      <View style={[styles.square, styles.frontSquare]} />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      height: 20,
      width: 20,
    },
    square: {
      borderColor: colors.primary,
      borderRadius: 3,
      borderWidth: 1.5,
      height: 13,
      position: 'absolute',
      width: 13,
    },
    backSquare: {
      left: 2,
      top: 2,
    },
    frontSquare: {
      backgroundColor: colors.surface,
      left: 6,
      top: 6,
    },
  });
