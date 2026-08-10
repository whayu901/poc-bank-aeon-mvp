import * as React from 'react';

import { BatteryGaugeViewProps } from './BatteryGaugeView';

/**
 * SVG mirror of the native gauge so the same JSX renders on web.
 * Geometry is kept in sync with the Swift and Kotlin implementations.
 */
export function BatteryGaugeView({
  level = -1,
  charging = false,
  color = '#22C55E',
  trackColor = '#9CA3AF',
  boltColor = '#FFFFFF',
  onPress,
  style,
}: BatteryGaugeViewProps) {
  const clamped = Math.min(Math.max(level, 0), 1);
  const fillWidth = level < 0 ? 0 : Math.max(clamped * 36, clamped > 0 ? 6 : 0);

  return (
    <svg
      onClick={() => onPress?.({ nativeEvent: { level } })}
      role={onPress ? 'button' : undefined}
      style={style as React.CSSProperties}
      viewBox="0 0 48 20">
      <rect
        fill="none"
        height="18"
        rx="6"
        stroke={trackColor}
        strokeWidth="2"
        width="42"
        x="1"
        y="1"
      />
      <rect fill={trackColor} height="8" rx="2" width="3" x="44" y="6" />
      {fillWidth > 0 && <rect fill={color} height="12" rx="4" width={fillWidth} x="4" y="4" />}
      {charging && (
        <path d="M25 5 L19 12 L23 12 L21.5 16 L27 10 L23.5 10 Z" fill={boltColor} />
      )}
    </svg>
  );
}
