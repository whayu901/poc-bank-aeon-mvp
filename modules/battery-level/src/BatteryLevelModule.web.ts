import { NativeModule, registerWebModule } from 'expo';

import { BatteryInfo, BatteryLevelModuleEvents, BatteryState } from './BatteryLevel.types';

/**
 * The Battery Status API is only implemented in Chromium-based browsers.
 * Elsewhere the module resolves to level -1 / state 'unknown', matching what
 * native returns when the value is unavailable.
 */
type WebBatteryManager = EventTarget & {
  level: number;
  charging: boolean;
};

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<WebBatteryManager>;
};

const UNAVAILABLE: BatteryInfo = { level: -1, state: 'unknown' };

function getManager(): Promise<WebBatteryManager | null> {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithBattery);

  if (!nav?.getBattery) {
    return Promise.resolve(null);
  }
  return nav.getBattery().catch(() => null);
}

function toInfo(manager: WebBatteryManager | null): BatteryInfo {
  if (!manager) {
    return UNAVAILABLE;
  }
  return {
    level: manager.level,
    state: manager.charging ? (manager.level >= 1 ? 'full' : 'charging') : 'unplugged',
  };
}

class BatteryLevelModule extends NativeModule<BatteryLevelModuleEvents> {
  private manager: WebBatteryManager | null = null;
  private listener = () => {
    this.emit('onBatteryLevelChange', toInfo(this.manager));
  };

  async getBatteryInfoAsync(): Promise<BatteryInfo> {
    return toInfo(await getManager());
  }

  async getBatteryLevelAsync(): Promise<number> {
    return (await this.getBatteryInfoAsync()).level;
  }

  async getBatteryStateAsync(): Promise<BatteryState> {
    return (await this.getBatteryInfoAsync()).state;
  }

  async startObserving() {
    if (this.manager) {
      return;
    }
    const manager = await getManager();
    if (!manager) {
      return;
    }
    this.manager = manager;
    manager.addEventListener('levelchange', this.listener);
    manager.addEventListener('chargingchange', this.listener);
  }

  stopObserving() {
    this.manager?.removeEventListener('levelchange', this.listener);
    this.manager?.removeEventListener('chargingchange', this.listener);
    this.manager = null;
  }
}

export default registerWebModule(BatteryLevelModule, 'BatteryLevelModule');
