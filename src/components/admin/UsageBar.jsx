// Reusable usage/quota progress bar. Amber ≥80%, red ≥100%. Divide-by-zero safe.
export default function UsageBar({ value, max }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  const tone =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
    >
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
