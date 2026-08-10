package expo.modules.batterylevel

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * Canvas counterpart of the iOS BatteryGaugeView. It holds no battery state of
 * its own — the level arrives as a prop, so the module stays the single source
 * of truth.
 */
class BatteryGaugeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  /** Matched by name to `Events("onPress")` in the view definition. */
  private val onPress by EventDispatcher()

  var level: Float = -1f
  var isCharging: Boolean = false
  var fillColor: Int = Color.GREEN
  var trackColor: Int = Color.GRAY
  var boltColor: Int = Color.WHITE

  private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
  }
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
  }
  private val boltPath = Path()

  init {
    // ExpoView is a ViewGroup, which skips onDraw unless this is cleared.
    setWillNotDraw(false)
    isClickable = true
    setOnClickListener {
      onPress(mapOf("level" to level))
    }
  }

  /**
   * Called once from `OnViewDidUpdateProps`, so a batch of prop changes results
   * in a single redraw rather than one per prop.
   */
  fun redraw() {
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)

    val strokeWidth = 2f * resources.displayMetrics.density
    val capWidth = (width * 0.05f).coerceAtLeast(strokeWidth)

    val shell = RectF(
      strokeWidth / 2f,
      strokeWidth / 2f,
      width - capWidth - strokeWidth * 1.5f,
      height - strokeWidth / 2f
    )
    val radius = shell.height() * 0.32f

    strokePaint.color = trackColor
    strokePaint.strokeWidth = strokeWidth
    canvas.drawRoundRect(shell, radius, radius, strokePaint)

    // Terminal nub on the right
    val capHeight = shell.height() * 0.4f
    val cap = RectF(
      shell.right + strokeWidth,
      shell.centerY() - capHeight / 2f,
      shell.right + strokeWidth + capWidth,
      shell.centerY() + capHeight / 2f
    )
    fillPaint.color = trackColor
    canvas.drawRoundRect(cap, capWidth / 2f, capWidth / 2f, fillPaint)

    // An unknown level (-1) draws the empty shell only.
    if (level < 0f) {
      return
    }

    val inset = strokeWidth + 1f
    val track = RectF(
      shell.left + inset,
      shell.top + inset,
      shell.right - inset,
      shell.bottom - inset
    )
    val clamped = level.coerceIn(0f, 1f)
    val fillWidth = track.width() * clamped

    if (fillWidth > 0f) {
      val fill = RectF(
        track.left,
        track.top,
        // Keep a sliver visible at very low levels.
        track.left + fillWidth.coerceAtLeast(track.height() * 0.4f),
        track.bottom
      )
      fillPaint.color = fillColor
      canvas.drawRoundRect(fill, radius * 0.6f, radius * 0.6f, fillPaint)
    }

    if (isCharging) {
      drawBolt(canvas, track)
    }
  }

  private fun drawBolt(canvas: Canvas, rect: RectF) {
    val h = rect.height() * 0.7f
    val w = h * 0.5f
    val x = rect.centerX() - w / 2f
    val y = rect.centerY() - h / 2f

    boltPath.reset()
    boltPath.moveTo(x + w * 0.55f, y)
    boltPath.lineTo(x, y + h * 0.58f)
    boltPath.lineTo(x + w * 0.42f, y + h * 0.58f)
    boltPath.lineTo(x + w * 0.30f, y + h)
    boltPath.lineTo(x + w, y + h * 0.40f)
    boltPath.lineTo(x + w * 0.55f, y + h * 0.40f)
    boltPath.close()

    fillPaint.color = boltColor
    canvas.drawPath(boltPath, fillPaint)
  }
}
