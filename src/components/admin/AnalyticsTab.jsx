// === AnalyticsTab.jsx ===
// App-wide + per-user analytics. Overview: most-visited pages, daily view
// trend, tier distribution, signup growth. Per-user (via selectedUserId,
// set by clicking a user in the Users tab): their top pages + time spent.
//
// Visual pass 2026-08-09: StatCard.jsx and TrendChart.jsx (shared with
// AIUsageTab) were already fixed in round 6 — nothing to do there. This
// round is the tab's own two components: Tier Distribution and the two
// Top Pages lists (site-wide + per-user).
import { useState, useEffect, useCallback } from 'react'
import { getAdminUser } from '@api/admin'
import { getAdminAnalyticsOverview, getAdminUserAnalytics } from '../../utils/adminCache'
import { useTheme } from '../../context/ThemeContext'
import StatCard from './StatCard'
import TierBadge from './TierBadge'
import TrendChart from './TrendChart'

const int = (v) => (Number.isFinite(v) ? v.toLocaleString() : '—')

function formatDuration(ms) {
  if (ms == null) return '—'
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Thin track bar beside the value — the same "name + bar + value" shape
// DbCountsTable's row counts and AI Usage's by-action list already settled
// on, replacing the wash-behind-text pattern this list used to have. Two
// similar view counts were hard to tell apart as washes; easy to tell apart
// as bar lengths.
function TopPagesList({ pages }) {
  const maxViews = Math.max(1, ...pages.map((p) => p.views))
  return (
    <div>
      {pages.length === 0 && (
        <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No views yet.</div>
      )}
      {pages.map((p) => (
        <div
          key={p.path}
          className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span className="w-28 flex-shrink-0 font-mono text-[10.5px] font-semibold text-gray-900 dark:text-white truncate">
            {p.path}
          </span>
          <div className="flex-1 h-[5px] rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{ width: `${(p.views / maxViews) * 100}%` }}
            />
          </div>
          <span className="w-32 flex-shrink-0 text-right text-[10.5px] tabular-nums text-gray-500 dark:text-gray-400">
            {int(p.views)} views · {formatDuration(p.avgDurationMs)}
          </span>
        </div>
      ))}
    </div>
  )
}

// Real tier material — the same gradients TierBadge/TierChangeDropdown/
// FeatureFlagsTab already use, replacing the flat gray-400/blue-500/amber-500
// Tailwind stock colours this bar had. Written as complete literal strings,
// not assembled fragments (Tailwind only compiles literal class matches).
const TIER_FILL = {
  basic: 'bg-gray-400 dark:bg-gray-500',
  pro: 'bg-gradient-to-r from-[#14275c] via-[#2354c9] to-[#5b9dff]',
  premium: 'bg-gradient-to-r from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad]',
}
const TIER_LABEL = { basic: 'Basic', pro: 'Pro', premium: 'Premium' }

function TierDistribution({ dist }) {
  const total = Math.max(1, dist.basic + dist.pro + dist.premium)
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
        Tier distribution
      </p>
      <div className="space-y-2">
        {['basic', 'pro', 'premium'].map((t) => {
          const count = dist[t]
          const share = Math.round((count / total) * 100)
          return (
            <div key={t} className="flex items-center gap-2.5">
              <span className="w-16 flex-shrink-0 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                {TIER_LABEL[t]}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${TIER_FILL[t]}`}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
              <span className="w-16 flex-shrink-0 text-right text-[11px] tabular-nums">
                <b className="font-bold text-gray-900 dark:text-white">{count}</b>
                <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">{share}%</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UserAnalyticsView({ userId, onBack }) {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getAdminUser(userId), getAdminUserAnalytics(userId)])
      .then(([userRes, statsRes]) => {
        if (cancelled) return
        setProfile(userRes.data.user)
        setStats(statsRes.data)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div className="p-4 space-y-4">
      {/* Same quiet grey back-link ResearchViewPage.jsx already uses for
          back-navigation, not an invented one-off green style. */}
      <button
        onClick={onBack}
        className="text-[11px] text-gray-400 dark:text-gray-500 hover:underline"
      >
        ← Back to overview
      </button>

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">Loading…</div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {profile?.name || `User #${userId}`}
            </h3>
            {profile?.tier && (
              <TierBadge tier={profile.tier} expiresAt={profile.tier_expires_at} />
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Page views" value={int(stats?.totalViews ?? 0)} />
            <StatCard label="Sessions" value={int(stats?.totalSessions ?? 0)} />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-3.5 py-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Top pages
              </p>
            </div>
            <TopPagesList pages={stats?.topPages || []} />
          </div>
        </>
      )}
    </div>
  )
}

export default function AnalyticsTab({ selectedUserId, onClearSelectedUser }) {
  const { isDark } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    getAdminAnalyticsOverview()
      .then(({ data }) => setData(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedUserId == null) load()
  }, [selectedUserId, load])

  if (selectedUserId != null) {
    return <UserAnalyticsView userId={selectedUserId} onBack={onClearSelectedUser} />
  }

  if (loading && !data) {
    return (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
        </div>
        <div className="h-24 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-sm text-red-600 dark:text-red-400">Failed to load analytics.</div>
  }
  if (!data) return null

  return (
    <div className="p-4 space-y-3.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Page views" value={int(data.totalViews)} />
        <StatCard label="Unique sessions" value={int(data.uniqueSessions)} />
        <StatCard label="Unique visitors" value={int(data.uniqueVisitors)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <TrendChart
          data={data.dailyViews}
          dataKey="views"
          color="#10b981"
          isDark={isDark}
          label="Daily page views · 30d"
        />
        <TrendChart
          data={data.signupGrowth}
          dataKey="signups"
          color="#3b82f6"
          isDark={isDark}
          label="New signups · 30d"
        />
      </div>

      <TierDistribution dist={data.tierDistribution} />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-3.5 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Most visited pages · 30d
          </p>
        </div>
        <TopPagesList pages={data.topPages} />
      </div>
    </div>
  )
}
