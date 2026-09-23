// === AdminPagination.jsx — shared pager for the admin list tabs ===
//
// Visual pass 2026-08-08. Every admin list had the same two grey slab buttons
// with "Page 1 of 3" wedged between them. This replaces that with a range
// readout ("Showing 1–20 of 47") plus chevron buttons, and lives in one place
// because Users, Content and the remaining list tabs all need it identically —
// only `limit` differs.
export default function AdminPagination({ page, pages, total, limit, onChange }) {
  if (pages <= 1) return null

  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const btn =
    'w-7 h-7 flex items-center justify-center rounded-lg border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-35 enabled:hover:text-gray-900 dark:enabled:hover:text-white enabled:hover:border-gray-200 dark:enabled:hover:border-gray-700 transition-colors'

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
      <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
        Showing{' '}
        <b className="font-semibold text-gray-700 dark:text-gray-200">
          {from}–{to}
        </b>{' '}
        of <b className="font-semibold text-gray-700 dark:text-gray-200">{total}</b>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(page - 1, 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className={btn}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
        <span className="px-2 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
          {page} / {pages}
        </span>
        <button
          onClick={() => onChange(Math.min(page + 1, pages))}
          disabled={page === pages}
          aria-label="Next page"
          className={btn}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
