// =============================================================================
// DisciplineScore.jsx — circular ring + dimension bars for trading discipline
// =============================================================================
import { useState, useEffect } from 'react'
import { getDiscipline } from '../../utils/globalCache'
import { IconFlame } from '../common/icons'
import { useAuth } from '../../context/AuthContext'
import { TIER_ACCENT, TierAccentOverlay, tierRingClass, getDisplayTier } from '../common/TierMaterial'

const GRADE = (s) => {
  if (s >= 85) return { letter: 'A+', color: 'text-emerald-500', ring: '#10b981' }
  if (s >= 70) return { letter: 'A', color: 'text-green-500', ring: '#22c55e' }
  if (s >= 55) return { letter: 'B', color: 'text-blue-500', ring: '#3b82f6' }
  if (s >= 40) return { letter: 'C', color: 'text-yellow-500', ring: '#eab308' }
  if (s >= 25) return { letter: 'D', color: 'text-orange-500', ring: '#f97316' }
  return { letter: 'F', color: 'text-red-400', ring: '#f87171' }
}

const BAR_COLOR = (s) => {
  if (s >= 70) return 'bg-emerald-400'
  if (s >= 50) return 'bg-blue-400'
  if (s >= 30) return 'bg-yellow-400'
  return 'bg-red-400'
}

function Ring({ score, size = 88 }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const grade = GRADE(score)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 88 88" className="-rotate-90">
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-gray-100 dark:text-gray-800"
          strokeWidth="7"
        />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={grade.ring}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold leading-none ${grade.color}`}>{score}</span>
        <span className={`text-[10px] font-semibold ${grade.color}`}>{grade.letter}</span>
      </div>
    </div>
  )
}

function DimBar({ label, score, extra, noData }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none">{label}</span>
          {extra && <span className="text-[9px] text-gray-400 dark:text-gray-600">({extra})</span>}
        </div>
        {noData ? (
          <span className="text-[9px] text-gray-400 dark:text-gray-600 italic">No data</span>
        ) : (
          <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
            {score}%
          </span>
        )}
      </div>
      <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${noData ? 'bg-gray-300 dark:bg-gray-600' : BAR_COLOR(score)}`}
          style={{ width: noData ? '0%' : `${score}%` }}
        />
      </div>
    </div>
  )
}

function DisciplineScore({ initData }) {
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
  const [data, setData] = useState(initData || null)
  const [loading, setLoading] = useState(!initData)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getDiscipline()
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (initData) {
      setData(initData)
      setLoading(false)
      return
    }
    load()
  }, [initData]) // re-sync when parent passes fresh data

  if (error)
    return (
      <div className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/10 shadow-sm p-4 flex flex-col items-center justify-center gap-3">
        <p className="text-[11px] text-red-400">{error}</p>
        <button
          onClick={load}
          className="text-[11px] px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )

  if (loading)
    return (
      <div className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/10 shadow-sm p-4 space-y-3 animate-pulse">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
        <div className="flex gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-2 bg-gray-100 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    )

  const score = data?.finalScore ?? data?.monthlyScore ?? 0
  const bd = data?.breakdown || {}
  // DELIBERATE (owner decision, discipline cleanup 8711f44; reaffirmed 2026-07-18):
  // only these 3 dims render. slUsage + rrConsistency exist in the payload but are
  // intentionally NOT shown — do not "complete" this list. See landmines.md.
  const dims = [
    { key: 'taskCompletion', extra: null, noData: false },
    { key: 'journalConsistency', extra: null, noData: false },
    {
      key: 'winRate',
      extra: bd.winRate?.raw != null ? `${bd.winRate.raw}% WR` : null,
      noData: bd.winRate?.raw == null && bd.winRate?.score === 0,
    },
  ]

  return (
    <div
      className={`hp-card group relative bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-2xl ${accent ? '' : 'border'} border-white/60 dark:border-white/10 p-4 pb-3 flex flex-col gap-3 ${accent ? tierRingClass(displayTier) : 'shadow-sm'}`}
    >
      <TierAccentOverlay accent={accent} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Discipline Score
        </h3>
        {data?.streak > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-400 dark:text-orange-300 font-medium">
            <IconFlame className="w-3 h-3" /> {data.streak}d streak
          </span>
        )}
      </div>

      {/* Ring + bars side by side — gap-3 to match TaskBoard's ring spacing so the
          two stacked left/right cards line up. */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <Ring score={score} />
        </div>

        <div className="flex-1 space-y-2.5 pt-1">
          {dims.map(({ key, extra, noData }) => {
            const dim = bd[key]
            if (!dim) return null
            return (
              <DimBar key={key} label={dim.label} score={dim.score} extra={extra} noData={noData} />
            )
          })}
        </div>
      </div>

      {/* Streak bonus chip */}
      {data?.streakBonus > 0 && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl mt-auto">
          <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium">
            Streak bonus
          </span>
          <span className="text-[10px] text-orange-500 dark:text-orange-400 font-semibold">
            +{data.streakBonus} pts
          </span>
        </div>
      )}
    </div>
  )
}

export default DisciplineScore
