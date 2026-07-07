// =============================================================================
// CycleAnalyticsCards.jsx — Top Movers + Consistency for the SELECTED cycles
// (spec §5.3 center-bottom, S2b). Data: S2a POST endpoints. Debounced 400ms,
// abortable (Rule 45). Copy rule: NEVER the word "probability" — footer says
// `history, not a promise`.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { getCycleMovers, getCycleConsistency } from '../../../api'
import { cycleKey } from './useCycleSelection'

const CARD = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
const LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'
const STITLE = 'text-[11px] font-semibold text-gray-700 dark:text-gray-200'

function Skeleton({ minH = 80 }) {
  return (
    <div className="animate-pulse space-y-2 p-3" style={{ minHeight: minH }}>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-5/6" />
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-4/6" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center py-6 text-[11px] text-gray-400">
      Select a cycle on the chart
    </div>
  )
}

function MoverRow({ s, max, up }) {
  const w = max > 0 ? Math.round((Math.abs(s.avg_ret) / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[11px] font-bold w-14 truncate text-gray-800 dark:text-gray-100">
        {s.symbol}
      </span>
      <span className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <span
          className={`block h-full rounded-full ${up ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${w}%` }}
        />
      </span>
      <span
        className={`text-[11px] font-bold tabular-nums w-14 text-right ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
      >
        {s.avg_ret >= 0 ? '+' : ''}
        {s.avg_ret?.toFixed(1)}%
      </span>
    </div>
  )
}

export default function CycleAnalyticsCards({ selectedCycles }) {
  const [movers, setMovers] = useState(null)
  const [consistency, setConsistency] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ctrlRef = useRef(null)

  const sig = selectedCycles.map(cycleKey).join(',')

  useEffect(() => {
    if (ctrlRef.current) ctrlRef.current.abort()
    if (!selectedCycles.length) {
      setMovers(null)
      setConsistency(null)
      setLoading(false)
      setError('')
      return
    }
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true)
    setError('')
    const t = setTimeout(async () => {
      const payload = {
        cycles: selectedCycles.map(({ start_date, end_date, type }) => ({
          start_date,
          end_date,
          type,
        })),
      }
      try {
        const [m, c] = await Promise.all([
          getCycleMovers({ ...payload, n: 5 }, { signal: ctrl.signal }),
          getCycleConsistency(payload, { signal: ctrl.signal }),
        ])
        if (ctrl.signal.aborted) return
        setMovers(m.data)
        setConsistency(c.data)
      } catch (e) {
        if (ctrl.signal.aborted) return
        setError('Failed to load cycle analytics')
      }
      if (!ctrl.signal.aborted) setLoading(false)
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  const maxAbs = movers
    ? Math.max(...[...movers.gainers, ...movers.losers].map((s) => Math.abs(s.avg_ret || 0)), 1)
    : 1

  return (
    <div className="flex gap-3 flex-1 min-h-0">
      {/* Top movers */}
      <div className={`${CARD} flex-1 min-w-0 flex flex-col overflow-hidden`}>
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
          <span className={STITLE}>Top movers</span>
          <span className={`${LABEL} normal-case ml-auto`}>
            {selectedCycles.length} cycle{selectedCycles.length === 1 ? '' : 's'} · avg return
          </span>
        </div>
        {error && (
          <div className="px-3 py-1.5 text-[10px] text-red-500 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold">×</button>
          </div>
        )}
        {!selectedCycles.length ? (
          <EmptyState />
        ) : loading || !movers ? (
          <Skeleton />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex gap-4">
            <div className="flex-1 min-w-0">
              <p className={`${LABEL} mb-1`}>Gainers</p>
              {movers.gainers.map((s) => (
                <MoverRow key={s.symbol} s={s} max={maxAbs} up />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`${LABEL} mb-1`}>Losers</p>
              {movers.losers.map((s) => (
                <MoverRow key={s.symbol} s={s} max={maxAbs} up={false} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Consistency */}
      <div className={`${CARD} flex-1 min-w-0 flex flex-col overflow-hidden`}>
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
          <span className={STITLE}>Consistency</span>
          <span className={`${LABEL} normal-case ml-auto`}>history, not a promise</span>
        </div>
        {!selectedCycles.length ? (
          <EmptyState />
        ) : loading || !consistency ? (
          <Skeleton />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1">
            {consistency.stocks.map((s) => (
              <div key={s.symbol} className="flex items-center gap-2 py-0.5 tabular-nums">
                <span className="text-[11px] font-bold w-14 truncate text-gray-800 dark:text-gray-100">
                  {s.symbol}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  up {s.up_count}/{s.n_covered}
                </span>
                <span
                  className={`text-[11px] font-bold ml-auto ${s.avg_ret >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {s.avg_ret >= 0 ? '+' : ''}
                  {s.avg_ret?.toFixed(1)}%
                </span>
                <span className="text-[10px] text-gray-400 w-14 text-right">
                  corr {s.corr != null ? s.corr.toFixed(2) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
