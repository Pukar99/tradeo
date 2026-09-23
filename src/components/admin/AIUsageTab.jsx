// === AIUsageTab.jsx ===
// Admin AI Usage dashboard. Read-only over ai_usage_log via GET /api/admin/ai-usage.
// Today/left cap + total calls (30d) + top users + filterable recent calls.
//
// Visual pass 2026-08-09: this was the one tab rounds 1-5 never touched — the
// plain rounded-lg/border-gray-200 style the whole panel used to share.
// Mostly a re-skin onto the house tokens; StatCard.jsx and TrendChart.jsx are
// shared with AnalyticsTab, so fixing them here carries forward to round 7
// automatically, the same way AdminPagination/AdminEmptyState did for Users
// in round 2.
//
// Deliberately NOT adding a fallback-rate warning threshold: success rate
// already has a real one in the code (<95% flags unhealthy), but fallback
// rate has none to copy, and a high fallback rate might be healthy graceful
// degradation rather than a problem. Inventing a number here would be a
// guess dressed up as a design decision, so fallback rate stays neutral —
// restyled, not newly judged.
import { useState, useEffect, useCallback } from 'react'
import { getAiUsage } from '../../utils/adminCache'
import { pnlClass, apiError } from '../../utils/format'
import { useTheme } from '../../context/ThemeContext'
import StatCard from './StatCard'
import UsageBar from './UsageBar'
import TrendChart from './TrendChart'

// Grouped-integer display for counts (calls/tokens) — matches the existing admin
// convention (DbCountsTable.jsx, StatsCards.jsx use plain toLocaleString() for counts).
// `fmt` from utils/format.js is a 2dp *decimal* formatter (documented as such) and is
// not appropriate for integer counts, so it isn't reused here — reserved for money/ratio
// displays elsewhere. `pnlClass`/`apiError` ARE reused below per the contract.
const int = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? '—' : Math.round(n).toLocaleString()
}

function pct(v) {
  return v == null ? '—' : `${v}%`
}

function timeAgo(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Today's quota as a health tile — same state-edge + icon grammar
// SystemHealth.jsx established in round 3, reusing UsageBar's own existing
// amber>=80%/red>=100% thresholds for the tone rather than inventing new ones.
function QuotaHealth({ today }) {
  const pctUsed = today.capCalls > 0 ? (today.calls / today.capCalls) * 100 : 0
  const tone = pctUsed >= 100 ? 'crit' : pctUsed >= 80 ? 'warn' : 'ok'
  const EDGE = { ok: 'bg-emerald-500', warn: 'bg-amber-500', crit: 'bg-red-500' }
  const ICON = {
    ok: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    crit: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3.5 py-3">
      <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-[3px] ${EDGE[tone]}`} />
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center ${ICON[tone]}`}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9" />
          </svg>
        </span>
        <span className="text-[12px] font-bold tracking-[-0.005em] text-gray-900 dark:text-white">
          Today's quota
        </span>
        <span className="ml-auto text-right">
          <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">
            {int(today.calls)} / {int(today.capCalls)}
          </span>
          <span className="text-[9.5px] text-gray-400 dark:text-gray-500">
            {' '}
            · {int(today.capLeft)} left · {int(today.tokens)} tok
          </span>
        </span>
      </div>
      <UsageBar value={today.calls} max={today.capCalls} />
    </div>
  )
}

export default function AIUsageTab() {
  const { isDark } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userFilter, setUserFilter] = useState(null) // user_id | null
  const [filterName, setFilterName] = useState('')

  const load = useCallback(async (uid) => {
    setLoading(true)
    setError('')
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

  useEffect(() => {
    load(userFilter)
  }, [load, userFilter])

  function selectUser(u) {
    setUserFilter(u.user_id)
    setFilterName(u.username)
  }

  if (loading && !data) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
  }
  if (!data) return null

  const { today, last30, topUsers, recentCalls, dailyVolume = [], byAction = [] } = data
  const maxAction = Math.max(1, ...byAction.map((a) => a.calls))

  return (
    <div className="p-4 space-y-3.5">
      <QuotaHealth today={today} />

      {/* Success/fallback rate are the "is this healthy right now" signal
          that used to require scanning the recent-calls table row by row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total calls" value={int(last30.totalCalls)} sub={null} />
        <StatCard
          label="Success rate"
          value={pct(last30.successRate)}
          sub={last30.successRate != null && last30.successRate < 95 ? 'Below 95%' : null}
        />
        <StatCard label="Fallback rate" value={pct(last30.fallbackRate)} sub={null} />
      </div>

      <TrendChart
        data={dailyVolume}
        dataKey="ai-calls"
        color="#8b5cf6"
        isDark={isDark}
        label="Daily calls · 30d"
      />

      {/* By action — which AI features actually get used */}
      {byAction.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
            By action · 30d
          </p>
          <div className="space-y-2">
            {byAction.map((a) => (
              <div key={a.action} className="flex items-center gap-2.5">
                <span className="w-28 flex-shrink-0 font-mono text-[10.5px] font-semibold lowercase text-gray-600 dark:text-gray-300 truncate">
                  {a.action}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                    style={{ width: `${(a.calls / maxAction) * 100}%` }}
                  />
                </div>
                <span className="w-8 flex-shrink-0 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                  {a.calls}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top users */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Top users · 30d
          </p>
        </div>
        {topUsers.length === 0 ? (
          <div className="px-3.5 pb-3.5 text-xs text-gray-400 dark:text-gray-500">No usage yet.</div>
        ) : (
          <div className="pb-1">
            {topUsers.map((u) => {
              const active = userFilter === u.user_id
              return (
                <button
                  key={u.user_id}
                  onClick={() => selectUser(u)}
                  className={`w-full flex items-center gap-2 px-3.5 py-2 text-left border-t border-gray-50 dark:border-gray-800/60 first:border-t-0 transition-colors ${
                    active
                      ? 'bg-blue-50/60 dark:bg-blue-500/[0.08]'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span
                    className={`flex-1 text-[12px] font-semibold truncate ${
                      active ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {u.username}
                  </span>
                  <span className="text-[10.5px] tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {int(u.calls)} calls · {int(u.tokens)} tok
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent calls — stays a real <table>: genuinely tabular data across
          6 columns, the right semantic fit unlike the flex-row pattern used
          in the list tabs. */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Recent calls · 30d
          </p>
          {userFilter != null && (
            <button
              onClick={() => {
                setUserFilter(null)
                setFilterName('')
              }}
              className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Filtered by {filterName} · Clear
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11.5px]">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Time
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  User
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Action
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Model
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Result
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Tokens
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {recentCalls.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                    No calls.
                  </td>
                </tr>
              )}
              {recentCalls.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-400 dark:text-gray-500">
                    {timeAgo(r.created_at)}
                  </td>
                  <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                    {r.username}
                  </td>
                  <td className="px-3 py-2 font-mono lowercase text-gray-500 dark:text-gray-400">
                    {r.action}
                  </td>
                  <td className="px-3 py-2 text-gray-400 dark:text-gray-500">
                    {r.model}
                    {r.fallback_used && (
                      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        Fallback
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.success ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-gray-500 dark:text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        OK
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${pnlClass(-1)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {r.error_code || 'Failed'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                    {r.total_tokens != null ? int(r.total_tokens) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
