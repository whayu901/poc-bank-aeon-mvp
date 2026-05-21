import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface PrimaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: PrimaryButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  pressed: {
    backgroundColor: colors.primaryDark,
  },
  label: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
});
