// === datalab/shared.jsx — single source for DataLab design tokens + atoms ===
// Used by all three tabs (PerformanceChart, InsightPage via insight/helpers,
// BreakdownPage). These strings were previously duplicated per-file and drifted.

// ── Design tokens ─────────────────────────────────────────────────────────────
export const CARD =
  'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
export const LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400'
export const STITLE = 'text-[11px] font-semibold text-gray-700 dark:text-gray-200'
export const SVAL = 'text-[13px] font-bold tabular-nums'

// Thin styled scrollbars (vertical / horizontal variants)
export const SCROLL_Y =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full'
export const SCROLL_X =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full'

// ── Formatting ────────────────────────────────────────────────────────────────
export function fmtPct(n, dec = 1) {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`
}

// ── Skeleton (pass minH to reserve space and avoid layout shift) ──────────────
export function Skeleton({ minH = 60 }) {
  return (
    <div className="space-y-2 px-4 py-4 animate-pulse" style={{ minHeight: minH }}>
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}
