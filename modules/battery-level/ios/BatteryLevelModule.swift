import ExpoModulesCore
import UIKit

public class BatteryLevelModule: Module {
  /// Block-based notification observers. `Module` is not an `NSObject`, so
  /// `#selector`-based observation is not available here.
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("BatteryLevel")

    Events("onBatteryLevelChange")

    OnCreate {
      Self.onMain { UIDevice.current.isBatteryMonitoringEnabled = true }
    }

    AsyncFunction("getBatteryLevelAsync") { () -> Float in
      return Self.currentLevel()
    }.runOnQueue(.main)

    AsyncFunction("getBatteryStateAsync") { () -> String in
      return Self.currentState()
    }.runOnQueue(.main)

    AsyncFunction("getBatteryInfoAsync") { () -> [String: Any] in
      return Self.currentInfo()
    }.runOnQueue(.main)

    // Presentational view. It receives the level as a prop rather than reading
    // the battery itself, so there is exactly one source of truth.
    View(BatteryGaugeView.self) {
      Events("onPress")

      Prop("level") { (view: BatteryGaugeView, level: Float) in
        view.level = level
      }

      Prop("charging") { (view: BatteryGaugeView, charging: Bool) in
        view.isCharging = charging
      }

      Prop("color") { (view: BatteryGaugeView, color: UIColor) in
        view.fillColor = color
      }

      Prop("trackColor") { (view: BatteryGaugeView, color: UIColor) in
        view.trackColor = color
      }

      Prop("boltColor") { (view: BatteryGaugeView, color: UIColor) in
        view.boltColor = color
      }

      OnViewDidUpdateProps { (view: BatteryGaugeView) in
        view.redraw()
      }
    }

    OnStartObserving {
      self.startObserving()
    }

    OnStopObserving {
      self.stopObserving()
    }

    OnDestroy {
      self.stopObserving()
      Self.onMain { UIDevice.current.isBatteryMonitoringEnabled = false }
    }
  }

  // MARK: - Observing

  private func startObserving() {
    guard observers.isEmpty else { return }

    Self.onMain {
      UIDevice.current.isBatteryMonitoringEnabled = true
    }

    let names: [Notification.Name] = [
      UIDevice.batteryLevelDidChangeNotification,
      UIDevice.batteryStateDidChangeNotification
    ]

    observers = names.map { name in
      NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        guard let self else { return }
        self.sendEvent("onBatteryLevelChange", Self.currentInfo())
      }
    }
  }

  private func stopObserving() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
  }

  // MARK: - Reading the battery

  /// `UIDevice.batteryLevel` reports `-1` when monitoring is disabled or the
  /// value is unavailable (notably on the iOS Simulator). That is passed
  /// through as-is so JS can tell "unknown" apart from "empty".
  private static func currentLevel() -> Float {
    let level = UIDevice.current.batteryLevel
    return level < 0 ? -1 : level
  }

  private static func currentState() -> String {
    switch UIDevice.current.batteryState {
    case .charging:
      return "charging"
    case .full:
      return "full"
    case .unplugged:
      return "unplugged"
    default:
      return "unknown"
    }
  }

  private static func currentInfo() -> [String: Any] {
    return [
      "level": currentLevel(),
      "state": currentState()
    ]
  }

  /// Battery monitoring and `UIDevice` reads must happen on the main thread.
  private static func onMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread {
      block()
    } else {
      DispatchQueue.main.async(execute: block)
    }
  }
}
