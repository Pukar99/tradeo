// === AIUsageTab.jsx ===
// Admin AI Usage dashboard. Read-only over ai_usage_log via GET /api/admin/ai-usage.
// Today/left cap + total calls (30d) + top users + filterable recent calls.
import { useState, useEffect, useCallback } from 'react'
import { getAiUsage } from '@api/admin'
import { pnlClass, apiError } from '../../utils/format'
import StatCard from './StatCard'
import UsageBar from './UsageBar'

// Grouped-integer display for counts (calls/tokens) — matches the existing admin
// convention (DbCountsTable.jsx, StatsCards.jsx use plain toLocaleString() for counts).
// `fmt` from utils/format.js is a 2dp *decimal* formatter (documented as such) and is
// not appropriate for integer counts, so it isn't reused here — reserved for money/ratio
// displays elsewhere. `pnlClass`/`apiError` ARE reused below per the contract.
const int = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? '—' : Math.round(n).toLocaleString()
}

export default function AIUsageTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userFilter, setUserFilter] = useState(null) // user_id | null

  const load = useCallback(async (uid) => {
    setLoading(true); setError('')
    try {
      const params = uid ? { user_id: uid } : {}
      const res = await getAiUsage(params)
      setData(res.data)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(userFilter) }, [load, userFilter])

  if (loading && !data) {
    return <div className="p-6 text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading AI usage…</div>
  }
  if (error) {
    return <div className="p-6 text-sm text-red-500">{error}</div>
  }
  if (!data) return null

  const { today, last30, topUsers, recentCalls } = data

  return (
    <div className="p-4 space-y-6">
      {/* Today / left strip */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Today: {int(today.calls)} / {int(today.capCalls)} calls used
          </div>
          <div className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
            {int(today.capLeft)} left · {int(today.tokens)} tokens
          </div>
        </div>
        <UsageBar value={today.calls} max={today.capCalls} />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total calls (30d)" value={int(last30.totalCalls)} />
      </div>

      {/* Top users */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top users (30d)</h3>
          {userFilter != null && (
            <button onClick={() => setUserFilter(null)} className="text-xs text-emerald-600 hover:underline">
              Clear filter
            </button>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {topUsers.length === 0 && <div className="px-4 py-3 text-sm text-gray-500">No usage yet.</div>}
          {topUsers.map((u) => (
            <button
              key={u.user_id}
              onClick={() => setUserFilter(u.user_id)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
            >
              <span className="text-gray-800 dark:text-gray-200">{u.username}</span>
              <span className="tabular-nums text-gray-500 dark:text-gray-400">
                {int(u.calls)} calls · {int(u.tokens)} tok
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent calls */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Recent calls (30d){userFilter != null ? ' — filtered' : ''}
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Model</th>
                <th className="px-3 py-2 text-left">Fallback</th>
                <th className="px-3 py-2 text-left">Result</th>
                <th className="px-3 py-2 text-right">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentCalls.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">No calls.</td></tr>
              )}
              {recentCalls.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">@{r.username}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.model}</td>
                  <td className="px-3 py-2">{r.fallback_used ? 'yes' : '—'}</td>
                  <td className={`px-3 py-2 font-medium ${pnlClass(r.success ? 1 : -1)}`}>
                    {r.success ? '✓' : `✗ ${r.error_code || ''}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.total_tokens != null ? int(r.total_tokens) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
