import { NativeModule, requireNativeModule } from 'expo';

import { BatteryInfo, BatteryLevelModuleEvents, BatteryState } from './BatteryLevel.types';

declare class BatteryLevelModule extends NativeModule<BatteryLevelModuleEvents> {
  getBatteryLevelAsync(): Promise<number>;
  getBatteryStateAsync(): Promise<BatteryState>;
  getBatteryInfoAsync(): Promise<BatteryInfo>;
}

export default requireNativeModule<BatteryLevelModule>('BatteryLevel');
