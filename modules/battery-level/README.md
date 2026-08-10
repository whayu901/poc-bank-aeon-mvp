# battery-level

Local Expo module that reads the device battery level and charging state natively on iOS (Swift) and Android (Kotlin), with a web fallback.

It is a **local module** — it lives in this app, is autolinked from `modules/`, and needs no `package.json` of its own.

## Usage

```tsx
import { useBattery, getBatteryLevelAsync } from '../../modules/battery-level';

function BatteryBadge() {
  const { level, state } = useBattery();

  if (level < 0) {
    return <Text>Battery unavailable</Text>;
  }
  return <Text>{Math.round(level * 100)}% · {state}</Text>;
}
```

One-shot reads:

```ts
const level = await getBatteryLevelAsync();  // 0..1, or -1 when unavailable
const state = await getBatteryStateAsync();  // 'unknown' | 'unplugged' | 'charging' | 'full'
const info = await getBatteryInfoAsync();    // { level, state }
```

Manual subscription (what `useBattery` wraps):

```ts
const sub = addBatteryLevelListener(({ level, state }) => { /* ... */ });
sub.remove();
```

## API

| Export | Description |
| --- | --- |
| `getBatteryLevelAsync()` | `Promise<number>` — 0..1, `-1` when unavailable |
| `getBatteryStateAsync()` | `Promise<BatteryState>` |
| `getBatteryInfoAsync()` | `Promise<BatteryInfo>` — both values from a single read |
| `addBatteryLevelListener(fn)` | Subscription to `onBatteryLevelChange` |
| `useBattery()` | React hook returning `BatteryInfo` |
| `BatteryGaugeView` | Native view — a battery pill drawn in Core Graphics / Canvas |
| `BatteryLevel` | The raw native module, if you need it |

`level` is `-1` rather than `0` whenever the platform cannot report a value, so "unknown" is distinguishable from "empty".

## The native view

`BatteryGaugeView` is a real `UIView` (iOS) / `View` (Android), not a React Native composition. It's registered inside the same module via the `View(...)` DSL, so `requireNativeView('BatteryLevel')` resolves it by module name.

```tsx
import { BatteryGaugeView, useBattery } from '../../modules/battery-level';

const { level, state } = useBattery();

<BatteryGaugeView
  level={level}
  charging={state === 'charging'}
  color="#7B1FA2"
  trackColor="#E5E7EB"
  boltColor="#FFFFFF"
  style={{ width: 40, height: 18 }}
  onPress={(e) => console.log(e.nativeEvent.level)}
/>
```

| Prop | Type | |
| --- | --- | --- |
| `level` | `number` | 0..1, or -1 for an empty shell |
| `charging` | `boolean` | draws the bolt |
| `color` | `string` | hex fill color |
| `trackColor` | `string` | hex outline/nub color |
| `boltColor` | `string` | hex bolt color |
| `onPress` | `(e) => void` | view event carrying `{ level }` |

**The view holds no battery state.** It takes the level as a prop and the module owns the reading — one source of truth, and the view is drivable from JS with any value you want for testing.

Two implementation details worth copying:

- Colors are **hex strings**, parsed natively. iOS's `UIColor` converter takes them directly; on Android the built-in `android.graphics.Color` converter is `@RequiresApi(26)` and this project's minSdk is 24, so the prop is typed `String` and parsed with `Color.parseColor`. No `processColor` needed on the JS side.
- Props don't redraw individually. Each setter just assigns, and `OnViewDidUpdateProps` triggers one `setNeedsDisplay()` / `invalidate()` per prop batch.

On web, `BatteryGaugeView.web.tsx` draws the same shape in SVG.

## How each platform reads it

**iOS** — `UIDevice.current.batteryLevel` / `.batteryState`, with `isBatteryMonitoringEnabled` turned on in `OnCreate`. Updates come from `batteryLevelDidChangeNotification` and `batteryStateDidChangeNotification`, observed only while JS has a listener attached (`OnStartObserving` / `OnStopObserving`). All `UIDevice` access runs on the main thread.

**Android** — the sticky `ACTION_BATTERY_CHANGED` broadcast. One-shot reads use `registerReceiver(null, filter)` to grab the last sticky intent without subscribing; live updates register a real `BroadcastReceiver` with `RECEIVER_NOT_EXPORTED` (required on Android 14+). Level is `EXTRA_LEVEL / EXTRA_SCALE`. No permission is needed.

**Web** — the Battery Status API (`navigator.getBattery()`), which only Chromium ships. Elsewhere it resolves to `{ level: -1, state: 'unknown' }`.

## Caveats

- The **iOS Simulator does not report a battery** — you get `level: -1`, `state: 'unknown'`. Test on a physical device.
- Android emulators do report a (fake) battery; you can change it from the emulator's extended controls.
- Native code changes are not picked up by Fast Refresh. Rebuild with `npx expo run:ios` / `npx expo run:android`.
