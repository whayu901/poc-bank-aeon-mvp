import { useEffect, useState } from 'react';

import { BatteryInfo, BatteryState } from './src/BatteryLevel.types';
import BatteryLevel from './src/BatteryLevelModule';

export { BatteryGaugeView } from './src/BatteryGaugeView';
export type { BatteryGaugePressEvent, BatteryGaugeViewProps } from './src/BatteryGaugeView';
export { BatteryLevel };
export type { BatteryInfo, BatteryState };

/** Battery charge as a 0..1 fraction, or -1 when unavailable. */
export function getBatteryLevelAsync(): Promise<number> {
  return BatteryLevel.getBatteryLevelAsync();
}

export function getBatteryStateAsync(): Promise<BatteryState> {
  return BatteryLevel.getBatteryStateAsync();
}

export function getBatteryInfoAsync(): Promise<BatteryInfo> {
  return BatteryLevel.getBatteryInfoAsync();
}

export function addBatteryLevelListener(listener: (event: BatteryInfo) => void) {
  return BatteryLevel.addListener('onBatteryLevelChange', listener);
}

const UNKNOWN: BatteryInfo = { level: -1, state: 'unknown' };

/**
 * Reads the battery once on mount and then follows native change events.
 * `level` is -1 until the first successful read, and stays -1 on platforms
 * that cannot report it (iOS Simulator, most non-Chromium browsers).
 */
export function useBattery(): BatteryInfo {
  const [info, setInfo] = useState<BatteryInfo>(UNKNOWN);

  useEffect(() => {
    let mounted = true;

    getBatteryInfoAsync()
      .then((next) => {
        if (mounted) {
          setInfo(next);
        }
      })
      .catch(() => {
        if (mounted) {
          setInfo(UNKNOWN);
        }
      });

    const subscription = addBatteryLevelListener((next) => {
      if (mounted) {
        setInfo(next);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return info;
}
