// === AuditLogTab.jsx ===
// Visual pass 2026-08-09. Real bug fixed here, found by tracing every
// logAdminAudit() call site in routes/admin.js and utils/tierExpiry.js: 15
// distinct action names actually get logged, but this filter list only had
// 13 — post_pin and post_unpin were missing entirely, even though they're
// logged constantly (every post pin/unpin in Content) and already render
// with a badge in this very table. Same class of gap a past session caught
// once for flag_delete/tier_auto_revert; it crept back in when pin/unpin
// shipped later without this list being updated too.
import { useState, useEffect, useCallback } from 'react'
import { getAdminAuditLog } from '../../utils/adminCache'
import AuditLogRow from './AuditLogRow'
import AdminPagination from './AdminPagination'
import AdminEmptyState from './AdminEmptyState'

const PAGE_SIZE = 50

// Grouped by the same 4 categories AuditLogRow.jsx's actionCategory()
// computes, in the same order, so the filter pills and the row badges they
// filter for are organized identically.
const ACTION_GROUPS = [
  {
    category: 'user',
    dot: 'bg-blue-600 dark:bg-blue-400',
    on: 'bg-blue-600 text-white',
    actions: ['tier_change', 'tier_auto_revert', 'suspend', 'unsuspend', 'force_logout'],
  },
  {
    category: 'content',
    dot: 'bg-purple-600 dark:bg-purple-400',
    on: 'bg-purple-600 text-white',
    actions: ['post_pin', 'post_unpin', 'post_delete'],
  },
  {
    category: 'system',
    dot: 'bg-amber-600 dark:bg-amber-400',
    on: 'bg-amber-600 text-white',
    actions: ['flag_toggle', 'flag_delete', 'config_update', 'scraper_trigger'],
  },
  {
    category: 'broadcast',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    on: 'bg-emerald-600 text-white',
    actions: ['announcement_create', 'announcement_update', 'announcement_delete'],
  },
]

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-32 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse flex-shrink-0" />
      <div className="w-32 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse flex-shrink-0" />
      <div className="hidden sm:block w-28 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse flex-shrink-0" />
      <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      <div className="hidden lg:block w-28 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse flex-shrink-0" />
    </div>
  )
}

const AUDIT_EMPTY_ICON = (
  <>
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.5L17 7.5V19a2 2 0 0 1-2 2Z" />
    <path d="M12 3v5h5" />
  </>
)

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
      const params = { page, limit: PAGE_SIZE }
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

  const dateCls =
    'h-8 px-2.5 text-[11px] bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg text-gray-700 dark:text-gray-300 transition-colors focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-gray-200 dark:focus:border-gray-700'

  return (
    <div className="flex flex-col gap-0">
      {/* Filters */}
      <div className="flex flex-col gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-36">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-gray-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              inputMode="numeric"
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
              placeholder="Target user ID…"
              className="w-full h-8 pl-8 pr-3 text-[11.5px] bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-gray-200 dark:focus:border-gray-700"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateChange(setDateFrom, e.target.value)}
            className={dateCls}
          />
          <span className="text-[11px] text-gray-400 dark:text-gray-500">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateChange(setDateTo, e.target.value)}
            className={dateCls}
          />
          <span className="ml-auto text-[11px] tabular-nums text-gray-400 dark:text-gray-500 whitespace-nowrap">
            <b className="text-xs font-bold text-gray-900 dark:text-white">{total}</b> entries
          </span>
        </div>

        {/* Action filter pills — grouped and coloured by the same category
            AuditLogRow's badges use, so a clicked pill and the badge it
            filters for always share a colour. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {ACTION_GROUPS.map((group) => (
            <span key={group.category} className="inline-flex items-center gap-1 flex-wrap">
              <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${group.dot}`} />
              {group.actions.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAction(a)}
                  className={`px-2 py-0.5 text-[9.5px] font-mono font-semibold rounded-full transition-colors ${
                    selectedActions.includes(a)
                      ? group.on
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {a}
                </button>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-32 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Admin
        </div>
        <div className="w-32 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Action
        </div>
        <div className="hidden sm:block w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Target
        </div>
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Detail
        </div>
        <div className="hidden lg:block w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0 text-right">
          When
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
        ) : logs.length === 0 ? (
          <AdminEmptyState
            title="No audit log entries found"
            icon={AUDIT_EMPTY_ICON}
            hint={
              selectedActions.length || targetId || dateFrom || dateTo
                ? 'Nothing matches these filters. Try clearing one.'
                : 'Admin actions will show up here as they happen.'
            }
          />
        ) : (
          logs.map((log) => <AuditLogRow key={log.id} log={log} />)
        )}
      </div>

      <AdminPagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        onChange={setPage}
      />
    </div>
  )
}
