import ExpoModulesCore
import UIKit

/**
 A presentational battery pill drawn with Core Graphics. It holds no battery
 state of its own — the level is passed in as a prop, so the module stays the
 single source of truth and the view stays trivially testable from JS.
 */
class BatteryGaugeView: ExpoView {
  /// Matched by name to `Events("onPress")` in the view definition.
  let onPress = EventDispatcher()

  var level: Float = -1
  var isCharging = false
  var fillColor: UIColor = .systemGreen
  var trackColor: UIColor = .systemGray3
  var boltColor: UIColor = .white

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
  }

  /// Called once from `OnViewDidUpdateProps`, so a batch of prop changes
  /// results in a single redraw rather than one per prop.
  func redraw() {
    setNeedsDisplay()
  }

  @objc private func handleTap() {
    onPress(["level": level])
  }

  override func draw(_ rect: CGRect) {
    let lineWidth: CGFloat = 2
    let capWidth = max(rect.width * 0.05, 2)
    let shell = CGRect(
      x: rect.minX + lineWidth / 2,
      y: rect.minY + lineWidth / 2,
      width: rect.width - capWidth - 2 - lineWidth,
      height: rect.height - lineWidth
    )
    let radius = shell.height * 0.32

    // Outline
    let outline = UIBezierPath(roundedRect: shell, cornerRadius: radius)
    outline.lineWidth = lineWidth
    trackColor.setStroke()
    outline.stroke()

    // Terminal nub on the right
    let capHeight = shell.height * 0.4
    let cap = UIBezierPath(
      roundedRect: CGRect(
        x: shell.maxX + 2,
        y: shell.midY - capHeight / 2,
        width: capWidth,
        height: capHeight
      ),
      cornerRadius: capWidth / 2
    )
    trackColor.setFill()
    cap.fill()

    // An unknown level (-1) draws the empty shell only.
    guard level >= 0 else { return }

    let track = shell.insetBy(dx: lineWidth + 1, dy: lineWidth + 1)
    let clamped = CGFloat(min(max(level, 0), 1))
    let fillWidth = track.width * clamped

    if fillWidth > 0 {
      let fill = UIBezierPath(
        roundedRect: CGRect(
          x: track.minX,
          y: track.minY,
          // Keep a sliver visible at very low levels.
          width: max(fillWidth, track.height * 0.4),
          height: track.height
        ),
        cornerRadius: radius * 0.6
      )
      fillColor.setFill()
      fill.fill()
    }

    if isCharging {
      drawBolt(in: track)
    }
  }

  private func drawBolt(in rect: CGRect) {
    let height = rect.height * 0.7
    let width = height * 0.5
    let x = rect.midX - width / 2
    let y = rect.midY - height / 2

    let bolt = UIBezierPath()
    bolt.move(to: CGPoint(x: x + width * 0.55, y: y))
    bolt.addLine(to: CGPoint(x: x, y: y + height * 0.58))
    bolt.addLine(to: CGPoint(x: x + width * 0.42, y: y + height * 0.58))
    bolt.addLine(to: CGPoint(x: x + width * 0.30, y: y + height))
    bolt.addLine(to: CGPoint(x: x + width, y: y + height * 0.40))
    bolt.addLine(to: CGPoint(x: x + width * 0.55, y: y + height * 0.40))
    bolt.close()

    boltColor.setFill()
    bolt.fill()
  }
}
