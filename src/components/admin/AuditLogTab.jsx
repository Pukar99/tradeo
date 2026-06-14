// === AuditLogTab.jsx ===
import { useState, useEffect, useCallback } from 'react'
import { getAdminAuditLog } from '@api/admin'
import AuditLogRow from './AuditLogRow'

const ACTIONS = [
  'tier_change',
  'suspend',
  'unsuspend',
  'force_logout',
  'post_delete',
  'flag_toggle',
  'config_update',
  'scraper_trigger',
  'announcement_create',
  'announcement_update',
  'announcement_delete',
]

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="w-36 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="hidden sm:block w-28 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="hidden lg:block w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>
  )
}

export default function AuditLogTab() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [selectedActions, setSelectedActions] = useState([])
  const [targetSearch, setTargetSearch] = useState('')
  const [targetId, setTargetId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Debounce target-ID search → reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setTargetId(targetSearch.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [targetSearch])

  function toggleAction(action) {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    )
    setPage(1)
  }

  function handleDateChange(setter, value) {
    setter(value)
    setPage(1)
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 50 }
      if (selectedActions.length) params.action = selectedActions.join(',')
      if (targetId && /^\d+$/.test(targetId)) params.target_id = targetId
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo

      const { data } = await getAdminAuditLog(params)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, selectedActions, targetId, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="flex flex-col gap-0">
      {/* Filters */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={targetSearch}
            onChange={(e) => setTargetSearch(e.target.value)}
            placeholder="Target user ID…"
            className="w-36 h-8 px-3 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateChange(setDateFrom, e.target.value)}
            className="h-8 px-2 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateChange(setDateTo, e.target.value)}
            className="h-8 px-2 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {total} entries
          </span>
        </div>

        {/* Action filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => toggleAction(a)}
              className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full border transition-colors ${
                selectedActions.includes(a)
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <div className="w-32 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Admin
        </div>
        <div className="w-36 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Action
        </div>
        <div className="hidden sm:block w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Target
        </div>
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Detail
        </div>
        <div className="hidden lg:block w-32 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0 text-right">
          When
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
        ) : logs.length === 0 ? (
          <div className="min-h-[420px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No audit log entries found
          </div>
        ) : (
          logs.map((log) => <AuditLogRow key={log.id} log={log} />)
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, pages))}
            disabled={page === pages}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
