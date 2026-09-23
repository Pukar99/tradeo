// === StatsCards.jsx ===
// Visual pass 2026-08-08 (owner picked option B). This used to render five
// tiles; four of them (posts / trades / messages) were a second rendering of
// rows already visible in the Table Row Counts panel further down the same
// screen. Only the account figures are unique here — `suspended` is a filter
// over users, not a table, so the counts panel can't show it.
//
// Tiles are fixed-width rather than 1fr columns: with two of them, stretched
// halves would inflate each to ~500px of mostly empty card.
const CARDS = [
  { key: 'users', label: 'Total users' },
  { key: 'suspended', label: 'Suspended', alertWhenPositive: true },
]

export default function StatsCards({ stats, loading }) {
  return (
    <div className="px-4 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
        Accounts
      </p>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
        {CARDS.map((c) => {
          const value = stats?.[c.key] ?? 0
          // Suspended reads as a problem only when there is one — a zero here
          // is the healthy case and shouldn't wear an alert colour.
          const alert = c.alertWhenPositive && value > 0
          return (
            <div
              key={c.key}
              className="sm:w-[190px] bg-white dark:bg-gray-900 rounded-xl px-3.5 py-3 border border-gray-100 dark:border-gray-800"
            >
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                {c.label}
              </p>
              {loading ? (
                <div className="h-6 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              ) : (
                <p
                  className={`text-xl font-bold tabular-nums tracking-tight ${
                    alert ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {value.toLocaleString()}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
