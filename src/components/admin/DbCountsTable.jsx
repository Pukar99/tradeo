// === DbCountsTable.jsx ===

export default function DbCountsTable({ tables, loading }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700/50">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Table Row Counts
        </p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 max-h-80 overflow-y-auto">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <div className="h-2.5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-2.5 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))
          : (tables || []).map((row) => (
              <div
                key={row.table}
                className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                  {row.table}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {row.count === null ? '—' : row.count.toLocaleString()}
                </span>
              </div>
            ))}
      </div>
    </div>
  )
}
