// === AnalyticsTab.jsx ===
// App-wide + per-user analytics. Overview: most-visited pages, daily view
// trend, tier distribution, signup growth. Per-user (via selectedUserId,
// set by clicking a user in the Users tab): their top pages + time spent.
import { useState, useEffect, useCallback } from 'react'
import { getAdminAnalyticsOverview, getAdminUserAnalytics, getAdminUser } from '@api/admin'
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

function TopPagesList({ pages }) {
  const maxViews = Math.max(1, ...pages.map((p) => p.views))
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
      {pages.length === 0 && (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No views yet.</div>
      )}
      {pages.map((p) => (
        <div key={p.path} className="relative px-4 py-2.5 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-emerald-50 dark:bg-emerald-900/10"
            style={{ width: `${(p.views / maxViews) * 100}%` }}
          />
          <div className="relative flex items-center justify-between text-sm">
            <span className="text-gray-800 dark:text-gray-200 font-mono text-xs">{p.path}</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400 text-xs flex-shrink-0 ml-3">
              {int(p.views)} views · avg {formatDuration(p.avgDurationMs)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

const TIER_COLORS = { basic: 'bg-gray-400', pro: 'bg-blue-500', premium: 'bg-amber-500' }

function TierDistribution({ dist }) {
  const total = Math.max(1, dist.basic + dist.pro + dist.premium)
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
        Tier Distribution
      </div>
      <div className="space-y-2">
        {['basic', 'pro', 'premium'].map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="w-16 text-xs capitalize text-gray-600 dark:text-gray-300">{t}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full ${TIER_COLORS[t]}`}
                style={{ width: `${(dist[t] / total) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {dist[t]}
            </span>
          </div>
        ))}
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
      <button
        onClick={onBack}
        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
      >
        ← Back to overview
      </button>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading…</div>
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
            <StatCard label="Page views (30d)" value={int(stats?.totalViews ?? 0)} />
            <StatCard label="Sessions (30d)" value={int(stats?.totalSessions ?? 0)} />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Top pages
            </h4>
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
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
        Loading analytics…
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-sm text-red-500">Failed to load analytics.</div>
  }
  if (!data) return null

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Page views (30d)" value={int(data.totalViews)} />
        <StatCard label="Unique sessions (30d)" value={int(data.uniqueSessions)} />
        <StatCard label="Unique visitors (30d)" value={int(data.uniqueVisitors)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrendChart
          data={data.dailyViews}
          dataKey="views"
          color="#10b981"
          isDark={isDark}
          label="Daily page views (30d)"
        />
        <TrendChart
          data={data.signupGrowth}
          dataKey="signups"
          color="#3b82f6"
          isDark={isDark}
          label="New signups (30d)"
        />
      </div>

      <TierDistribution dist={data.tierDistribution} />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Most visited pages (30d)
        </h3>
        <TopPagesList pages={data.topPages} />
      </div>
    </div>
  )
}
