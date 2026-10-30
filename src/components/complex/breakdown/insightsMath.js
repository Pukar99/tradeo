// =============================================================================
// insightsMath.js — pure helpers for Breakdown's cycle insights view (redesign
// 2026-10-31). One stock list (backend `insights.stocks`) is sorted by "lenses"
// and each stock gets a plain-English kind — all from the numbers the table
// shows, so the label can always be explained by the row next to it.
// =============================================================================

// corr → 0..5 filled blocks for the "Moves with NEPSE" bar.
// high=5, medium=4, low=2, opposite=1, null (insufficient overlap)=0.
export function corrBlocks(corr) {
  if (corr == null) return 0
  if (corr >= 0.7) return 5
  if (corr >= 0.4) return 4
  if (corr > -0.4) return 2
  return 1
}

// Bar width % from a value's magnitude against a max (guards max<=0).
export function barPct(val, max) {
  if (!(max > 0)) return 0
  return Math.min(100, Math.round((Math.abs(val) / max) * 100))
}

export function avgOf(vals) {
  const v = vals.filter((x) => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

// Kind of stock across the selected cycles.
//   spike — one run carries the average (best run minus the average of the
//           others ≥ max(60pp, 2× that average)); needs ≥ 2 covered runs
//   lead  — rose in ≥ 75% of its runs AND beat the index average
//   steady— rose in ≥ 75% of its runs, at or below the index average
//   lag   — everything else
export function classify(s, indexAvg) {
  const rets = (s.per_wave || []).filter((r) => r != null)
  if (rets.length >= 2) {
    const best = Math.max(...rets)
    const rest = (rets.reduce((a, b) => a + b, 0) - best) / (rets.length - 1)
    if (best - rest >= Math.max(60, 2 * Math.abs(rest))) return 'spike'
  }
  const ratio = s.n_covered ? s.up_count / s.n_covered : 0
  if (ratio >= 0.75) return indexAvg == null || s.avg_ret > indexAvg ? 'lead' : 'steady'
  return 'lag'
}

export const KINDS = {
  lead: {
    label: 'Reliable winner',
    hint: 'Rose in most runs and beat the index',
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    dot: 'rgba(16,185,129,0.8)',
  },
  spike: {
    label: 'Lucky spike',
    hint: 'Big average, mostly from one run',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    dot: 'rgba(245,158,11,0.85)',
  },
  steady: {
    label: 'Steady, small',
    hint: 'Usually up, but less than the index',
    cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    dot: 'rgba(59,130,246,0.75)',
  },
  lag: {
    label: 'Laggard',
    hint: 'Often down, small or negative average',
    cls: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
    dot: 'rgba(239,68,68,0.75)',
  },
}

// Lenses replace the old Top movers / Consistency / Scan tabs: same list,
// different order. nulls always sort last.
const num = (v) => (v == null ? -Infinity : v)
export const LENSES = [
  { id: 'gainers', label: 'Top gainers', sort: (a, b) => num(b.avg_ret) - num(a.avg_ret) },
  {
    id: 'reliable',
    label: 'Most reliable',
    sort: (a, b) =>
      b.up_count / b.n_covered - a.up_count / a.n_covered || num(b.avg_ret) - num(a.avg_ret),
  },
  { id: 'floor', label: 'Best worst-case', sort: (a, b) => num(b.floor) - num(a.floor) },
  { id: 'losers', label: 'Top losers', sort: (a, b) => num(-b.avg_ret) - num(-a.avg_ret) },
]

// "Held ₹100 through every run" — compounded, skipping runs with no data.
export function growth(rets, start = 100) {
  const path = [start]
  for (const r of rets)
    path.push(r == null ? path[path.length - 1] : path[path.length - 1] * (1 + r / 100))
  return path
}
