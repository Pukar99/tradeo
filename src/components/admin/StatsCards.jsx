// === StatsCards.jsx ===
const CARDS = [
  { key: 'users', label: 'Total Users' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'posts', label: 'Research Posts' },
  { key: 'trades', label: 'Trade Actions' },
  { key: 'messages', label: 'Journal Entries' },
]

export default function StatsCards({ stats, loading }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-4 py-4">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700/50"
        >
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            {c.label}
          </p>
          {loading ? (
            <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              {(stats?.[c.key] ?? 0).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
