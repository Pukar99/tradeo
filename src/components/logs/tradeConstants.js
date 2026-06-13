// Shared constants + pure helpers for the Logs feature — emotional states,
// exit reasons, market conditions, pill color maps, direction/status configs,
// broker-message parsing, range filters, and position math.
// Single source of truth: every logs component imports from here instead of
// keeping local copies.

// ── Selectable pill values (kept in sync with backend VALID_* in routes/tradelog.js) ──

export const EMOTIONAL_STATES = [
  'Confident',
  'Calm',
  'Anxious',
  'Fearful',
  'Greedy',
  'FOMO',
  'Neutral',
]

export const EXIT_REASONS = ['Target Hit', 'SL Hit', 'Manual Exit', 'Reversal Signal', 'Time Stop']

export const MARKET_CONDITIONS = ['Bullish', 'Bearish', 'Sideways', 'Volatile', 'Low Vol']

export const DEFAULT_SETUPS = [
  'Breakout',
  'Reversal',
  'Pullback',
  'Range Play',
  'News',
  'SMC',
  'Price Action',
]

// ── Pill color maps (selectable border-2 style, used in modals) ────────────────

export const EMOTION_COLOR = {
  Confident: 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Calm: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Anxious:
    'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Fearful:
    'border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Greedy: 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  FOMO: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  Neutral: 'border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

export const EXIT_REASON_COLOR = {
  'Target Hit':
    'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'SL Hit': 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'Manual Exit': 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'Reversal Signal':
    'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  'Time Stop':
    'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
}

export const MARKET_CONDITION_COLOR = {
  Bullish:
    'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Bearish: 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Sideways:
    'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Volatile:
    'border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'Low Vol': 'border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

// ── Direction / status badge configs (read-only pills on cards/rows) ──────────

export const DIRECTION_CFG = {
  LONG: {
    label: '↑ Long',
    accent: 'bg-emerald-500',
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20',
  },
  SHORT: {
    label: '↓ Short',
    accent: 'bg-red-500',
    pill: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20',
  },
}

export const STATUS_CFG = {
  OPEN: {
    label: 'Open',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
    pulse: true,
  },
  PARTIAL: {
    label: 'Partial',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20',
    pulse: true,
  },
  CLOSED: {
    label: 'Closed',
    dot: 'bg-gray-400',
    pill: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-200 dark:border-gray-600/20',
    pulse: false,
  },
}

// ── Broker SMS parsing ─────────────────────────────────────────────────────────
// Parses: "you bought RHPL-3000.0@290.00 on 2026-04-16 ..."
//         "you sold NABIL-500@1200.50 on 2026-04-16"
// Returns { side: 'Long'|'Short', symbol, quantity, price, date } or null.
// Each modal maps these fields onto its own form shape.
export function parseBrokerMessage(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  const m = t.match(/(bought|sold)\s+([A-Z0-9]+)-?([\d.]+)@([\d.]+)\s+on\s+(\d{4}-\d{2}-\d{2})/i)
  if (!m) return null
  return {
    side: m[1].toLowerCase() === 'bought' ? 'Long' : 'Short',
    symbol: m[2].toUpperCase(),
    quantity: String(parseFloat(m[3])),
    price: String(parseFloat(m[4])),
    date: m[5],
  }
}

// ── Range filters (Performance tab + toolbar chips) ───────────────────────────
// All windows are rolling (calendar-honest labels). 'all' = no lower bound.

export const PERF_RANGES = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'all', label: 'All Time' },
]

const RANGE_MONTHS = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }

// Returns { from, to } as YYYY-MM-DD strings; from is null for 'all'.
export function rangeToFromTo(range) {
  const to = new Date().toISOString().slice(0, 10)
  const months = RANGE_MONTHS[range]
  if (!months) return { from: null, to }
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return { from: d.toISOString().slice(0, 10), to }
}

// ── Position math (shared by PositionRow + TradeGalleryView cards) ────────────
// position is a position_view row; ltp is the latest traded price (or null).
export function computePositionMetrics(position, ltp) {
  const wacc = parseFloat(position.wacc) || 0
  const totalQty = parseFloat(position.total_qty) || 0
  const ltpNum = ltp ? parseFloat(ltp) : null
  const isClosed = position.status === 'CLOSED'
  // Default LONG when direction is missing — matches backend normalizeDir()
  const direction = position.direction?.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG'

  const unrealPnl =
    ltpNum != null && !isClosed
      ? direction === 'LONG'
        ? (ltpNum - wacc) * totalQty
        : (wacc - ltpNum) * totalQty
      : null
  const pnlValue = isClosed ? parseFloat(position.total_realized_pnl) : unrealPnl
  const hasPnl = pnlValue != null && !isNaN(pnlValue)

  const slPct =
    position.sl && wacc > 0
      ? Math.abs(((parseFloat(position.sl) - wacc) / wacc) * 100).toFixed(1)
      : null
  const tpPct =
    position.tp && wacc > 0
      ? Math.abs(((parseFloat(position.tp) - wacc) / wacc) * 100).toFixed(1)
      : null
  const rr =
    position.sl && position.tp && wacc > 0
      ? (
          Math.abs(parseFloat(position.tp) - wacc) / Math.abs(parseFloat(position.sl) - wacc)
        ).toFixed(1)
      : null

  return {
    wacc,
    totalQty,
    ltpNum,
    isClosed,
    direction,
    unrealPnl,
    pnlValue,
    hasPnl,
    slPct,
    tpPct,
    rr,
  }
}

// ── Open/all + symbol search filter (database + gallery views) ────────────────
export function filterPositions(positions, filter, search) {
  let list = positions || []
  if (filter === 'open') list = list.filter((p) => p.status !== 'CLOSED')
  const q = search?.trim().toUpperCase()
  if (q) list = list.filter((p) => p.symbol.includes(q))
  return list
}
