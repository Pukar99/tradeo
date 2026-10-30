// =============================================================================
// RangeResults.jsx — Breakdown "Date range" mode (redesign Wave 2, owner
// 2026-10-31): pick From/To dates → how NEPSE, every sector and every stock
// moved over exactly those dates. No bull/bear cycles involved.
// Data reuses existing routes (no new backend): the range is sent as ONE
// window — `cycle-movers` (full) for per-stock returns + vs index, and
// `drop-analysis` (peak_date/trough_date = from/to) for sector returns.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { getCycleMovers, runDropAnalysis } from '../../../api'
import { apiError, isCanceled } from '../../../utils/format'
import { CARD, LABEL, STITLE, Skeleton, fmtPct } from '../../datalab/shared'
import { stripIndexName, pctTextCls } from './helpers'

// The range as a one-window "cycle" payload. `type` is required by the shared
// cycle-set schema; it only labels the window, the math ignores it.
function rangeWindow(from, to, pct) {
  return { start_date: from, end_date: to, type: pct >= 0 ? 'bull' : 'bear' }
}

// ── Center: every stock over the range ────────────────────────────────────────
export function RangeStocks({ from, to, pct, indexId, indexLbl, sector, onClearSector }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('avg_ret')
  const [desc, setDesc] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!from || !to || from >= to) return
    const ctrl = new AbortController()
    setData(null)
    setError('')
    getCycleMovers(
      {
        cycles: [rangeWindow(from, to, pct)],
        full: true,
        index_id: indexId,
        ...(sector ? { sector_index: sector } : {}),
      },
      { signal: ctrl.signal }
    )
      .then((r) => {
        if (!ctrl.signal.aborted) setData(r.data)
      })
      .catch((e) => {
        if (ctrl.signal.aborted || isCanceled(e)) return
        setError(apiError(e, 'Failed to load stocks'))
      })
    return () => ctrl.abort()
    // pct only flips the label `type` — refetching on it would be wasted work
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, indexId, sector])

  const stocks = useMemo(() => data?.stocks || [], [data])
  const rows = useMemo(() => {
    const term = q.trim().toUpperCase()
    const list = term
      ? stocks.filter(
          (s) => s.symbol.includes(term) || (s.company_name || '').toUpperCase().includes(term)
        )
      : stocks
    return [...list].sort((a, b) => {
      const d = (a[sortBy] ?? -1e9) - (b[sortBy] ?? -1e9)
      return desc ? -d : d
    })
  }, [stocks, q, sortBy, desc])

  const up = stocks.filter((s) => s.avg_ret > 0).length
  const beat = stocks.filter((s) => s.vs_index != null && s.vs_index > 0).length
  const max = Math.max(1, ...stocks.map((s) => Math.abs(s.avg_ret || 0)))

  function sortCol(col) {
    if (sortBy === col) setDesc((d) => !d)
    else {
      setSortBy(col)
      setDesc(true)
    }
  }
  const arrow = (col) => (sortBy === col ? (desc ? ' ↓' : ' ↑') : '')

  return (
    <div className={`${CARD} flex-1 min-h-0 flex flex-col overflow-hidden`}>
      <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <span className={STITLE}>Stocks in your dates</span>
        {data && (
          <>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
              <b className="text-gray-800 dark:text-gray-100">{up}</b> of {stocks.length} went up
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
              <b className="text-gray-800 dark:text-gray-100">{beat}</b> beat {indexLbl}
            </span>
          </>
        )}
        {sector && (
          <span className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
            {stripIndexName(sector)} only
            <button
              onClick={onClearSector}
              aria-label="Show all sectors"
              className="px-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              ×
            </button>
          </span>
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a stock…"
          aria-label="Find a stock"
          className="ml-auto w-36 text-[10px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      </div>

      {error ? (
        <div className="px-3 py-2 text-[10px] text-red-500">{error}</div>
      ) : !data ? (
        <Skeleton variant="rows" rows={10} minH={240} />
      ) : (
        <>
          <div
            className={`shrink-0 grid grid-cols-[minmax(0,1fr)_9rem_5rem] gap-3 px-3 py-1.5 ${LABEL} border-b border-gray-50 dark:border-gray-800/60`}
          >
            <span>Stock</span>
            <button className="text-right" onClick={() => sortCol('avg_ret')}>
              Return{arrow('avg_ret')}
            </button>
            <button className="text-right" onClick={() => sortCol('vs_index')}>
              vs {indexLbl}
              {arrow('vs_index')}
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {rows.length === 0 && (
              <p className="text-[11px] text-gray-400 py-6 text-center">No stocks match.</p>
            )}
            {rows.map((s) => (
              <div
                key={s.symbol}
                className="grid grid-cols-[minmax(0,1fr)_9rem_5rem] gap-3 items-center px-3 py-1 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              >
                <span className="min-w-0">
                  <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">
                    {s.symbol}
                  </span>
                  <span className="ml-2 text-[10px] text-gray-400 truncate">{s.company_name}</span>
                </span>
                <span className="flex items-center justify-end gap-2">
                  <span className="w-14 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <span
                      className={`block h-full rounded-full ${s.avg_ret >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${(Math.abs(s.avg_ret) / max) * 100}%` }}
                    />
                  </span>
                  <span
                    className={`w-14 text-right text-[11px] font-bold tabular-nums ${pctTextCls(s.avg_ret)}`}
                  >
                    {fmtPct(s.avg_ret)}
                  </span>
                </span>
                <span
                  className={`text-right text-[10px] font-semibold tabular-nums ${
                    s.vs_index == null
                      ? 'text-gray-400'
                      : s.vs_index >= 0
                        ? 'text-emerald-500'
                        : 'text-red-500'
                  }`}
                >
                  {fmtPct(s.vs_index)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p
        className={`shrink-0 ${LABEL} normal-case px-3 py-1.5 border-t border-gray-50 dark:border-gray-800/60`}
      >
        Return = price change from {from} to {to} · history, not a promise
      </p>
    </div>
  )
}

// ── Right panel: index + sectors over the range ───────────────────────────────
export function RangeSectors({ from, to, pct, days, indexId, indexLbl, sector, onSector }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!from || !to || from >= to) return
    const ctrl = new AbortController()
    setData(null)
    setError('')
    runDropAnalysis(
      { peak_date: from, trough_date: to, index_id: indexId },
      { signal: ctrl.signal }
    )
      .then((r) => {
        if (!ctrl.signal.aborted) setData(r.data)
      })
      .catch((e) => {
        if (ctrl.signal.aborted || isCanceled(e)) return
        setError(apiError(e, 'Failed to load sectors'))
      })
    return () => ctrl.abort()
  }, [from, to, indexId])

  const sectors = useMemo(
    () => [...(data?.sectors || [])].sort((a, b) => (b.drop_pct ?? 0) - (a.drop_pct ?? 0)),
    [data]
  )
  const max = Math.max(1, ...sectors.map((s) => Math.abs(s.drop_pct || 0)))

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white/40 dark:bg-gray-950/40 p-3 space-y-3">
      <div className={`${CARD} p-3`}>
        <p className={`${LABEL} mb-1`}>{indexLbl} in your dates</p>
        <p className={`text-[26px] font-black tabular-nums leading-none ${pctTextCls(pct)}`}>
          {fmtPct(pct)}
        </p>
        <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
          {from} → {to} · {days} trading days
        </p>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
          <span className={STITLE}>Sectors in your dates</span>
        </div>
        {error ? (
          <div className="px-3 py-2 text-[10px] text-red-500">{error}</div>
        ) : !data ? (
          <Skeleton variant="rows" rows={8} minH={200} />
        ) : (
          <div className="py-1">
            {sectors.map((s) => {
              const v = s.drop_pct ?? 0
              const w = (Math.abs(v) / max) * 50
              const on = sector === s.index_name
              return (
                <button
                  key={s.index_name}
                  onClick={() => onSector(on ? null : s.index_name)}
                  title="Show only this sector's stocks"
                  className={`w-full grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 px-3 py-1 text-left transition-colors ${
                    on
                      ? 'bg-blue-50 dark:bg-blue-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                  }`}
                >
                  <span className="text-[11px] text-gray-700 dark:text-gray-200 truncate">
                    {stripIndexName(s.index_name)}
                  </span>
                  <span className="relative h-1.5">
                    <span className="absolute left-1/2 -top-1 -bottom-1 w-px bg-gray-200 dark:bg-gray-700" />
                    <span
                      className={`absolute top-0 bottom-0 rounded-full ${v >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ left: `${v >= 0 ? 50 : 50 - w}%`, width: `${w}%` }}
                    />
                  </span>
                  <span
                    className={`text-right text-[11px] font-bold tabular-nums ${pctTextCls(v)}`}
                  >
                    {fmtPct(v)}
                  </span>
                </button>
              )
            })}
            <p className={`${LABEL} normal-case px-3 pt-1.5 pb-1`}>
              Click a sector to filter the stock list.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
