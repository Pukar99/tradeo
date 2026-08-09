// Small reusable stat tile for admin dashboards. One label + one value (+ optional sub).
// Visual pass 2026-08-09: moved off the raw border-gray-200/700 box onto the
// house CARD token (border-gray-100/800, rounded-xl) and the LABEL token
// (tracking-widest), matching round 3's StatsCards rebuild. Shared with
// AnalyticsTab — this fix carries forward automatically when that tab's
// round comes.
export default function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
        {value}
      </div>
      {sub != null && (
        <div className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">{sub}</div>
      )}
    </div>
  )
}
