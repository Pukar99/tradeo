// === DbCountsTable.jsx ===
// Visual pass 2026-08-08. Was 22 right-aligned numbers with nothing to
// compare them against. Each row now carries a proportional bar scaled to the
// largest table, so relative size reads at a glance, and empty tables recede
// to grey instead of looking equal in weight to populated ones.
//
// Scale is LOGARITHMIC, and that's deliberate. Counts here span four orders
// of magnitude — stock_ohlcv holds tens of thousands of candles while most
// app tables hold tens of rows — so a linear scale pins stock_ohlcv at 100%
// and collapses every other table onto the same 2px stub. Verified against
// the real dev database: 20 of 22 rows rendered identically that way, which
// makes the bar decoration rather than information.
//
// The exact count sits next to every bar, so the bar's job is grouping and
// scanning ("which tables are big, which are empty"), not reading magnitude
// off its length. The header labels the scale so it isn't mistaken for
// proportional.
export default function DbCountsTable({ tables, loading }) {
  const rows = tables || []
  const max = rows.reduce((m, r) => (typeof r.count === 'number' && r.count > m ? r.count : m), 0)
  const logMax = Math.log10(max + 1)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Table row counts
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">Log scale</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-1.5">
                <div className="h-2.5 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-2.5 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            ))
          : rows.map((row) => {
              const known = typeof row.count === 'number'
              const empty = known && row.count === 0
              const pct =
                known && row.count > 0 && logMax > 0
                  ? Math.max((Math.log10(row.count + 1) / logMax) * 100, 4)
                  : 0
              return (
                <div
                  key={row.table}
                  className="flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span
                    className={`w-[150px] flex-shrink-0 truncate font-mono text-[11px] ${
                      empty
                        ? 'text-gray-400 dark:text-gray-600'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {row.table}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
                  >
                    {pct > 0 && (
                      <span
                        className="block h-full rounded-full bg-gray-400 dark:bg-gray-600"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </span>
                  <span
                    className={`w-14 flex-shrink-0 text-right text-[11px] tabular-nums ${
                      empty
                        ? 'text-gray-400 dark:text-gray-600'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {known ? row.count.toLocaleString() : '—'}
                  </span>
                </div>
              )
            })}
      </div>
    </div>
  )
}
