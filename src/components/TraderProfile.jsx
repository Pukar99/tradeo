import { useState, useEffect, useCallback } from 'react'
import { getTraderProfile } from '../api'

function BulletList({ text }) {
  if (!text) return null
  const lines = text.split('\n').map(l => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean)
  return (
    <ul className="space-y-1.5 mt-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />
          {line}
        </li>
      ))}
    </ul>
  )
}

function StatPill({ label, value, color = 'text-gray-700 dark:text-gray-200' }) {
  return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800">
      <span className={`text-[13px] font-bold ${color}`}>{value}</span>
      <span className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  )
}

export default function TraderProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [open, setOpen]       = useState(false)
  const [reason, setReason]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getTraderProfile()
      if (res.data.reason) { setReason(res.data.reason); setProfile(null) }
      else                  { setProfile(res.data.profile); setReason(null) }
    } catch {
      setError('Failed to generate profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const s = profile?.stats

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-[11px] font-semibold text-gray-800 dark:text-white">Trader Profile</p>
            <p className="text-[9px] text-gray-400">
              {loading ? 'Analyzing your trades…' : profile ? `${s?.totalTrades} trades · ${s?.winRate}% WR · updated` : 'AI behavioral analysis'}
            </p>
          </div>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body — collapsible */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-[11px] text-gray-400 py-4 justify-center">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Generating your profile…
            </div>
          )}

          {error && (
            <div className="text-[11px] text-red-500 text-center py-2">
              {error} —{' '}
              <button onClick={fetch} className="underline hover:text-red-600">retry</button>
            </div>
          )}

          {reason && (
            <p className="text-[11px] text-gray-400 text-center py-4">{reason}</p>
          )}

          {profile && !loading && (
            <>
              {/* Stats strip */}
              <div className="grid grid-cols-4 gap-2">
                <StatPill label="Win Rate"  value={`${s.winRate}%`}  color={parseFloat(s.winRate) >= 50 ? 'text-emerald-500' : 'text-red-500'} />
                <StatPill label="Avg Win"   value={`Rs.${Number(s.avgWinPnl).toLocaleString()}`}  color="text-emerald-500" />
                <StatPill label="Avg Loss"  value={`Rs.${Math.abs(Number(s.avgLossPnl)).toLocaleString()}`} color="text-red-500" />
                <StatPill label="Avg Hold"  value={`${s.avgHold}d`}  color="text-blue-500" />
              </div>

              {/* Violations strip */}
              {(s.noSLCount > 0 || s.noReasonCount > 0) && (
                <div className="flex gap-2">
                  {s.noSLCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg px-2.5 py-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {s.noSLCount} trades without SL
                    </div>
                  )}
                  {s.noReasonCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 rounded-lg px-2.5 py-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {s.noReasonCount} trades without reason
                    </div>
                  )}
                </div>
              )}

              {/* Profile sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Strengths */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Strengths</p>
                  <div className="text-emerald-700 dark:text-emerald-300">
                    <BulletList text={profile.strengths} />
                  </div>
                </div>

                {/* Weaknesses */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Weaknesses</p>
                  <div className="text-red-700 dark:text-red-300">
                    <BulletList text={profile.weaknesses} />
                  </div>
                </div>
              </div>

              {/* Best conditions */}
              {profile.bestConditions && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1.5">Best Conditions</p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">{profile.bestConditions}</p>
                </div>
              )}

              {/* Key habit */}
              {profile.keyHabit && (
                <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-1.5">Key Habit to Build</p>
                  <p className="text-[11px] text-violet-700 dark:text-violet-300 leading-relaxed">
                    {profile.keyHabit.replace(/^[•\-*]\s*/, '')}
                  </p>
                </div>
              )}

              {/* Symbol performance */}
              {(profile.bestSymbols?.length > 0 || profile.worstSymbols?.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Best Symbols</p>
                    <div className="space-y-1">
                      {profile.bestSymbols.map(s => (
                        <div key={s.symbol} className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-gray-700 dark:text-gray-200">{s.symbol}</span>
                          <span className="text-emerald-500 font-semibold">+Rs.{s.pnl.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Worst Symbols</p>
                    <div className="space-y-1">
                      {profile.worstSymbols.map(s => (
                        <div key={s.symbol} className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-gray-700 dark:text-gray-200">{s.symbol}</span>
                          <span className="text-red-500 font-semibold">Rs.{s.pnl.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tag breakdown */}
              {profile.tagStats && Object.keys(profile.tagStats).length > 0 && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Setup Performance</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(profile.tagStats).map(([tag, s]) => {
                      const wr = Math.round((s.wins / s.total) * 100)
                      return (
                        <div key={tag} className="flex items-center gap-1.5 text-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-2.5 py-1.5">
                          <span className="font-semibold text-gray-700 dark:text-gray-200">{tag}</span>
                          <span className={`font-bold ${wr >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>{wr}%</span>
                          <span className="text-gray-400">{s.total}T</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[9px] text-gray-300 dark:text-gray-600">
                  Generated {profile.generatedAt ? new Date(profile.generatedAt).toLocaleTimeString() : ''} · cached 1hr
                </p>
                <button onClick={fetch} className="text-[9px] text-gray-400 hover:text-violet-500 transition-colors">
                  Refresh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
