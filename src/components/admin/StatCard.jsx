// Small reusable stat tile for admin dashboards. One label + one value (+ optional sub).
export default function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
}
