// === ScraperPanel.jsx ===
// Visual pass 2026-08-08. Presentational now — status fetching and the
// 3s-while-running poll moved up to SystemTab so this panel and the Scraper
// health tile above it read one poll instead of two.
//
// The status pill is gone: the health tile upstairs already owns "what state
// is the scraper in", and repeating it here was the same duplication problem
// as the stat tiles. Run now moves into the header, where an action belongs,
// and drops from a flat green-600 slab to the app's emerald.
export default function ScraperPanel({ status, loading, triggering, onRun }) {
  const running = Boolean(status?.running)
  const busy = triggering || running

  const lastRun = status?.lastRun
    ? new Date(status.lastRun).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never'

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Scraper
        </p>
        <button
          onClick={onRun}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4l14 8-14 8V4z" />
          </svg>
          {running ? 'Running…' : 'Run now'}
        </button>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-28 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        ) : (
          <dl className="space-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-[11px] text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="text-[11px] font-medium text-gray-900 dark:text-white">
                {running ? 'Running' : 'Idle'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[11px] text-gray-500 dark:text-gray-400">Last run</dt>
              <dd className="text-[11px] tabular-nums font-medium text-gray-900 dark:text-white">
                {lastRun}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[11px] text-gray-500 dark:text-gray-400">Rows saved</dt>
              <dd className="text-[11px] tabular-nums font-medium text-gray-900 dark:text-white">
                {(status?.rowsInserted ?? 0).toLocaleString()}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  )
}
