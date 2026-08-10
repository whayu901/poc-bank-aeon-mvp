import { requireNativeView } from 'expo';
import * as React from 'react';
import { ViewProps } from 'react-native';

export type BatteryGaugePressEvent = {
  nativeEvent: { level: number };
};

export type BatteryGaugeViewProps = {
  /** 0..1, or -1 to draw an empty shell for an unknown level. */
  level?: number;
  charging?: boolean;
  /** Hex strings — parsed natively on both platforms. */
  color?: string;
  trackColor?: string;
  /** Charging bolt, drawn on top of the fill. */
  boltColor?: string;
  onPress?: (event: BatteryGaugePressEvent) => void;
} & ViewProps;

// Resolved by module name — the view is registered inside BatteryLevelModule.
const NativeView = requireNativeView<BatteryGaugeViewProps>('BatteryLevel');

export function BatteryGaugeView(props: BatteryGaugeViewProps) {
  return <NativeView {...props} />;
}
