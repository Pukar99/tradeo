// Pure helpers for Scenario 2 (entry/SL/TP markers) and Scenario 3 (SMC order-block markers) on
// the chat ChartCard. Kept dependency-free (no lightweight-charts import) so this stays testable
// under the project's node-environment Vitest config (tests/unit/**, no jsdom — see vite.config.js).
// LineStyle.Dashed is lightweight-charts' own enum value (2); inlined here to avoid pulling
// in the library just for a constant.
const LINE_STYLE_DASHED = 2

export const MARKER_COLORS = {
  entry: '#3b82f6',     // blue — matches the existing long/position-card blue accent
  sl: '#dc2626',        // red — matches the existing loss-color convention
  tp: '#16a34a',        // green — matches the existing gain/candle-up-color convention
  smc_entry: '#22c55e', // matches the existing SMC Order-Block color (SMCChartPage.jsx)
  smc_sl: '#22c55e',    // same — entry+SL share the OB color, distinct from a real position's blue/red
  default: '#9ca3af',   // neutral gray fallback for any future/unknown marker type
}

// Maps card.markers (from the SHOW_CHART backend envelope) into the option objects
// lightweight-charts' series.createPriceLine() expects, one per marker, in order.
export function buildPriceLines(markers) {
  if (!markers?.length) return []
  return markers.map((m) => ({
    price: m.price,
    color: MARKER_COLORS[m.type] || MARKER_COLORS.default,
    lineWidth: 1,
    lineStyle: LINE_STYLE_DASHED,
    axisLabelVisible: true,
    title: m.label,
  }))
}
