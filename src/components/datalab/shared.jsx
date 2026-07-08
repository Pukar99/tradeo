// === datalab/shared.jsx — single source for DataLab design tokens + atoms ===
// Used by all tabs (InsightPage via insight/helpers, BreakdownPage). These
// strings were previously duplicated per-file and drifted.

// ── Design tokens ─────────────────────────────────────────────────────────────
export const CARD =
  'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
export const LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400'
export const STITLE = 'text-[11px] font-semibold text-gray-700 dark:text-gray-200'
export const SVAL = 'text-[13px] font-bold tabular-nums'

// ── Formatting ────────────────────────────────────────────────────────────────
export function fmtPct(n, dec = 1) {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`
}

// ── Skeleton (pass minH to reserve space and avoid layout shift) ──────────────
// variant='lines' (default, unchanged) — a few generic text-line bars, for
//   small/short-lived loads where the loaded content has no strong shape.
// variant='rows' — N list-row bars (icon-ish leading block + a wide bar +
//   a trailing bar), for row lists (movers, consistency, scan, stock lists).
// variant='table' — a header bar + N row bars, for table-shaped content
//   (per-cycle stats, sector matrix).
// variant='card' — a headline bar + a couple of shorter lines + a chip row,
//   for verdict/summary cards (Compare's General section).
// `rows` controls how many bars variant='rows'/'table' renders (default 5).
// Existing `<Skeleton minH={n} />` callers are unaffected (variant defaults
// to 'lines', same markup as before).
export function Skeleton({ minH = 60, variant = 'lines', rows = 5 }) {
  if (variant === 'rows') {
    return (
      <div className="space-y-2.5 px-3 py-3 animate-pulse" style={{ minHeight: minH }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-10 bg-gray-100 dark:bg-gray-800 rounded shrink-0" />
            <div className="h-2.5 flex-1 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-2.5 w-10 bg-gray-100 dark:bg-gray-800 rounded shrink-0" />
          </div>
        ))}
      </div>
    )
  }
  if (variant === 'table') {
    return (
      <div className="animate-pulse" style={{ minHeight: minH }}>
        <div className="h-6 px-3 py-2 bg-gray-50/60 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800" />
        <div className="px-3 py-2 space-y-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: `${85 - (i % 3) * 12}%` }} />
          ))}
        </div>
      </div>
    )
  }
  if (variant === 'card') {
    return (
      <div className="space-y-2.5 p-3 animate-pulse" style={{ minHeight: minH }}>
        <div className="h-3 w-5/6 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
          <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2 px-4 py-4 animate-pulse" style={{ minHeight: minH }}>
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}
