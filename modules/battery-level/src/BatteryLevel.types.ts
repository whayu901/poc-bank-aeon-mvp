export type BatteryState = 'unknown' | 'unplugged' | 'charging' | 'full';

export type BatteryInfo = {
  /** 0..1, or -1 when the level is unavailable (simulators, web without support). */
  level: number;
  state: BatteryState;
};

export type BatteryLevelModuleEvents = {
  onBatteryLevelChange: (event: BatteryInfo) => void;
};
