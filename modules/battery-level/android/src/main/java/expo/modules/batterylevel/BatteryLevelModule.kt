package expo.modules.batterylevel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.BatteryManager
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BatteryLevelModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("BatteryLevel")

    Events("onBatteryLevelChange")

    AsyncFunction("getBatteryLevelAsync") {
      readLevel(currentBatteryIntent())
    }

    AsyncFunction("getBatteryStateAsync") {
      readState(currentBatteryIntent())
    }

    AsyncFunction("getBatteryInfoAsync") {
      val intent = currentBatteryIntent()
      mapOf(
        "level" to readLevel(intent),
        "state" to readState(intent)
      )
    }

    // Presentational view. It receives the level as a prop rather than reading
    // the battery itself, so there is exactly one source of truth.
    //
    // Colors arrive as hex strings and are parsed here. The built-in
    // android.graphics.Color converter requires API 26, and this project's
    // minSdk is 24.
    View(BatteryGaugeView::class) {
      Events("onPress")

      Prop("level") { view: BatteryGaugeView, level: Float ->
        view.level = level
      }

      Prop("charging") { view: BatteryGaugeView, charging: Boolean ->
        view.isCharging = charging
      }

      Prop("color") { view: BatteryGaugeView, color: String ->
        view.fillColor = parseColor(color, view.fillColor)
      }

      Prop("trackColor") { view: BatteryGaugeView, color: String ->
        view.trackColor = parseColor(color, view.trackColor)
      }

      Prop("boltColor") { view: BatteryGaugeView, color: String ->
        view.boltColor = parseColor(color, view.boltColor)
      }

      OnViewDidUpdateProps { view: BatteryGaugeView ->
        view.redraw()
      }
    }

    OnStartObserving {
      startObserving()
    }

    OnStopObserving {
      stopObserving()
    }

    OnDestroy {
      stopObserving()
    }
  }

  // MARK: - Observing

  private fun startObserving() {
    if (receiver != null) {
      return
    }

    val batteryReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        sendEvent(
          "onBatteryLevelChange",
          bundleOf(
            "level" to readLevel(intent),
            "state" to readState(intent)
          )
        )
      }
    }

    // ACTION_BATTERY_CHANGED is a protected system broadcast, so the receiver
    // must not be exported (required on Android 14+ / targetSdk 34+).
    ContextCompat.registerReceiver(
      context,
      batteryReceiver,
      IntentFilter(Intent.ACTION_BATTERY_CHANGED),
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
    receiver = batteryReceiver
  }

  private fun stopObserving() {
    receiver?.let {
      runCatching { context.unregisterReceiver(it) }
      receiver = null
    }
  }

  // MARK: - Reading the battery

  /**
   * ACTION_BATTERY_CHANGED is sticky, so registering a `null` receiver returns
   * the last broadcast without subscribing to future ones.
   */
  private fun currentBatteryIntent(): Intent? =
    context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

  /** Returns 0..1, or -1 when the level is unavailable — matching iOS. */
  private fun readLevel(intent: Intent?): Float {
    val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1

    if (level < 0 || scale <= 0) {
      return -1f
    }
    return level.toFloat() / scale.toFloat()
  }

  private fun parseColor(value: String, fallback: Int): Int =
    runCatching { Color.parseColor(value) }.getOrDefault(fallback)

  private fun readState(intent: Intent?): String =
    when (intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)) {
      BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
      BatteryManager.BATTERY_STATUS_FULL -> "full"
      BatteryManager.BATTERY_STATUS_DISCHARGING,
      BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "unplugged"
      else -> "unknown"
    }
}
