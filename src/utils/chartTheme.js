// =============================================================================
// chartTheme.js — shared lightweight-charts series color helpers
// =============================================================================
// Candle palettes intentionally vary by feature today:
//   #22c55e/#ef4444 — NEPSEChart, BacktestChart, insight charts (the dominant pair → default)
//   #10b981/#ef4444 — TradeGalleryView, MarketJournalTab
//   #16a34a/#dc2626 — chat ChartCard
// Callers pass their feature's exact pair so adoption is pixel-identical; unifying
// every feature onto one pair is an owner design decision (same policy as pnlClass).

export const CANDLE_UP = '#22c55e'
export const CANDLE_DOWN = '#ef4444'

// The 6-property candlestick color block every chart file used to hand-write.
// extra: series options merged on top (e.g. { priceLineVisible: false }).
export const candleSeriesOptions = (up = CANDLE_UP, down = CANDLE_DOWN, extra = {}) => ({
  upColor: up,
  downColor: down,
  borderUpColor: up,
  borderDownColor: down,
  wickUpColor: up,
  wickDownColor: down,
  ...extra,
})
