// =============================================================================
// CycleAnalyticsCards.jsx — Top Movers + Consistency for the SELECTED cycles
// (spec §5.3 center-bottom, S2b). Data: S2a POST endpoints. Debounced 400ms,
// abortable (Rule 45). Copy rule: NEVER the word "probability" — footer says
// `history, not a promise`.
//
// One CARD with a ViewSwitcher toggle (movers/consistency) instead of two
// side-by-side cards (S2b owner eyeball F3) — both endpoints are still
// fetched together on cycle-selection change; switching the view is local
// state only and never refetches.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { getCycleMovers, getCycleConsistency, getCycleScan } from '../../../api'
import { cycleKey } from './useCycleSelection'
import { CARD, LABEL, Skeleton, fmtPct } from '../../datalab/shared'
import ViewSwitcher from '../../shared/ViewSwitcher'
import ComparePanel from './ComparePanel'

// Small chrome icon — dismiss glyph, matches DataLabPage's 24x24 stroke style.
function IconX({ className = 'w-3 h-3' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const VIEWS = [
  { id: 'movers', label: 'Top movers' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'scan', label: 'Scan' },
  { id: 'compare', label: 'Compare' },
]

const CONSISTENCY_GRID = 'grid grid-cols-[3.5rem_1fr_4rem_6.5rem] gap-2'

function corrWord(corr) {
  if (corr == null) return null
  if (corr >= 0.7) return 'high'
  if (corr >= 0.4) return 'medium'
  if (corr > -0.4) return 'low'
  return 'opposite'
}

// corrWord → 0..5 filled blocks for the "Moves with NEPSE" strength bar.
// high=5, medium=4, low=2, opposite=1, null (insufficient overlap)=0.
export function corrBlocks(corr) {
  const w = corrWord(corr)
  if (w === 'high') return 5
  if (w === 'medium') return 4
  if (w === 'low') return 2
  if (w === 'opposite') return 1
  return 0
}

// Bar width % from a value's magnitude against a max (guards max<=0).
export function barPct(val, max) {
  if (!(max > 0)) return 0
  return Math.min(100, Math.round((Math.abs(val) / max) * 100))
}

function ConsistencyRow({ s, onOpen }) {
  const dotted = s.n_covered <= 8
  const allUp = s.up_count === s.n_covered && s.n_covered > 0
  const allDown = s.up_count === 0
  const roseColor = allUp
    ? 'text-emerald-600 dark:text-emerald-400'
    : allDown
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-700 dark:text-gray-300'
  const word = corrWord(s.corr)

  return (
    <button
      type="button"
      onClick={() => onOpen({ symbol: s.symbol, drop_pct: s.avg_ret })}
      className={`${CONSISTENCY_GRID} w-full text-left items-center py-0.5 tabular-nums hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors`}
    >
      <span className="text-[11px] font-bold truncate text-gray-800 dark:text-gray-100">
        {s.symbol}
      </span>
      <span className={`text-[10px] ${roseColor}`}>
        {dotted ? (
          <>
            <span className="tracking-tight">
              {'●'.repeat(s.up_count)}
              <span className="text-gray-300 dark:text-gray-600">
                {'○'.repeat(s.n_covered - s.up_count)}
              </span>
            </span>{' '}
            Up in {s.up_count} of {s.n_covered}
          </>
        ) : (
          `Up in ${s.up_count} of ${s.n_covered}`
        )}
      </span>
      <span
        className={`text-[11px] font-bold text-right ${s.avg_ret >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
      >
        {fmtPct(s.avg_ret)}
      </span>
      <span className="flex flex-col items-end gap-0.5" title={s.corr == null ? 'needs 30+ trading days of overlap' : `day-to-day correlation with NEPSE: ${s.corr.toFixed(2)} — history, not a promise`}>
        {word ? (
          <>
            <span className="flex gap-px">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`inline-block w-1 h-2.5 rounded-sm ${i < corrBlocks(s.corr) ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`}
                />
              ))}
            </span>
            <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-none">{word}</span>
          </>
        ) : (
          <span className="text-[10px] text-gray-400">—</span>
        )}
      </span>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center py-6 text-[11px] text-gray-400">
      Select a cycle on the chart
    </div>
  )
}

function MoverRow({ s, max, up, onOpen }) {
  const w = max > 0 ? Math.round((Math.abs(s.avg_ret) / max) * 100) : 0
  return (
    <button
      type="button"
      onClick={() => onOpen({ symbol: s.symbol, drop_pct: s.avg_ret })}
      className="w-full text-left flex items-center gap-2 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
    >
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
        {fmtPct(s.avg_ret)}
      </span>
    </button>
  )
}

// Scan row: floor (weakest selected-cycle return) is the headline; a per-wave
// strip shows evenness; avg is muted. Own-sign hue per bar. Click → Compare.
function ScanRow({ s, maxAbs, cycleNames, onOpen }) {
  const floorUp = s.floor >= 0
  return (
    <button
      type="button"
      onClick={() => onOpen({ symbol: s.symbol, drop_pct: s.avg })}
      className="w-full text-left grid grid-cols-[3.5rem_4rem_1fr_3.5rem] gap-2 items-center py-0.5 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
    >
      <span className="text-[11px] font-bold truncate text-gray-800 dark:text-gray-100">{s.symbol}</span>
      <span className={`text-[11px] font-bold tabular-nums text-right ${floorUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {fmtPct(s.floor)}
      </span>
      <span className="flex items-end gap-0.5 h-4">
        {s.per_wave.map((r, i) => (
          <span
            key={i}
            title={`${cycleNames[i] || `Cycle ${i + 1}`}: ${fmtPct(r)}`}
            className={`flex-1 min-w-[3px] rounded-sm ${r >= 0 ? 'bg-emerald-400/70' : 'bg-red-400/70'}`}
            style={{ height: `${Math.max(12, barPct(r, maxAbs))}%` }}
          />
        ))}
      </span>
      <span className="text-[10px] text-gray-400 tabular-nums text-right">avg {fmtPct(s.avg)}</span>
    </button>
  )
}

export default function CycleAnalyticsCards({
  selectedCycles,
  view,
  onViewChange,
  indexId,
  sectorIndex,
  indexLbl,
  onStockOpen,
  compare,
}) {
  const [movers, setMovers] = useState(null)
  const [consistency, setConsistency] = useState(null)
  const [scan, setScan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [consSort, setConsSort] = useState(null)
  const ctrlRef = useRef(null)

  const sig = `${selectedCycles.map(cycleKey).join(',')}|${indexId}|${sectorIndex || ''}`

  useEffect(() => {
    if (ctrlRef.current) ctrlRef.current.abort()
    if (!selectedCycles.length) {
      setMovers(null)
      setConsistency(null)
      setScan(null)
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
        index_id: indexId,
        ...(sectorIndex ? { sector_index: sectorIndex } : {}),
      }
      try {
        const [m, c, sc] = await Promise.all([
          getCycleMovers({ ...payload, n: 15 }, { signal: ctrl.signal }),
          getCycleConsistency(payload, { signal: ctrl.signal }),
          getCycleScan({ ...payload, n: 15 }, { signal: ctrl.signal }),
        ])
        if (ctrl.signal.aborted) return
        setMovers(m.data)
        setConsistency(c.data)
        setScan(sc.data)
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

  const toggleConsSort = (col) =>
    setConsSort((s) => (s && s.col === col ? { col, asc: !s.asc } : { col, asc: false }))
  const consRows = useMemo(() => {
    const rows = consistency?.stocks || []
    if (!consSort) return rows
    const dir = consSort.asc ? 1 : -1
    // nulls (corr insufficient overlap) always sort last regardless of dir
    return [...rows].sort((a, b) => {
      const av = a[consSort.col], bv = b[consSort.col]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return (av - bv) * dir
    })
  }, [consistency, consSort])

  const meta =
    view === 'movers'
      ? `${selectedCycles.length} cycle${selectedCycles.length === 1 ? '' : 's'} · avg return · ${sectorIndex ? indexLbl : 'market-wide'}`
      : view === 'compare'
        ? 'over selected cycles · history, not a promise'
        : 'history, not a promise'

  const cycleNames = selectedCycles.map((c) => c.name || (c.type === 'bull' ? 'Bull' : 'Bear'))
  const nSel = selectedCycles.length
  const caption =
    view === 'movers'
      ? `Across your ${nSel} selected cycle${nSel === 1 ? '' : 's'}: which stocks gained the most on average.`
      : view === 'consistency'
        ? `Across your ${nSel} cycle${nSel === 1 ? '' : 's'}: how often each stock rose, and how closely it moves with ${indexLbl} day-to-day.`
        : view === 'scan'
          ? `Stocks that stayed strong across every selected cycle — ranked by their weakest cycle, so one lucky spike doesn't win. History, not a promise.`
          : 'over selected cycles · history, not a promise'

  return (
    <div className={`${CARD} flex-1 min-h-[260px] lg:min-h-0 flex flex-col overflow-hidden`}>
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <ViewSwitcher views={VIEWS} active={view} onChange={onViewChange} ariaLabel="Cycle analytics view" />
        <span className={`${LABEL} normal-case ml-auto`}>{meta}</span>
      </div>
      {view !== 'compare' && selectedCycles.length > 0 && (
        <p className={`${LABEL} normal-case px-3 pt-1.5 leading-snug`}>{caption}</p>
      )}
      {error && (
        <div className="px-3 py-1.5 text-[10px] text-red-500 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error" className="font-bold transition-colors">
            <IconX className="w-3 h-3" />
          </button>
        </div>
      )}
      {view === 'compare' ? (
        <ComparePanel
          cycles={selectedCycles}
          a={compare.a}
          b={compare.b}
          onChangeA={compare.onChangeA}
          onChangeB={compare.onChangeB}
          onFocusRow={compare.onFocusRow}
        />
      ) : !selectedCycles.length ? (
        <EmptyState />
      ) : loading || !movers || !consistency || !scan ? (
        <Skeleton minH={80} />
      ) : view === 'movers' ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex gap-4">
          <div className="flex-1 min-w-0">
            <p className={`${LABEL} mb-1`}>Gainers</p>
            {movers.gainers.map((s) => (
              <MoverRow key={s.symbol} s={s} max={maxAbs} up onOpen={onStockOpen} />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`${LABEL} mb-1`}>Losers</p>
            {movers.losers.map((s) => (
              <MoverRow key={s.symbol} s={s} max={maxAbs} up={false} onOpen={onStockOpen} />
            ))}
          </div>
        </div>
      ) : view === 'scan' ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <div className="grid grid-cols-[3.5rem_4rem_1fr_3.5rem] gap-2 mb-1">
            <span className={LABEL}>Stock</span>
            <span className={`${LABEL} text-right`}>Weakest</span>
            <span className={`${LABEL}`}>Per cycle</span>
            <span className={`${LABEL} text-right`}>Avg</span>
          </div>
          {scan && scan.stocks.length ? (
            scan.stocks.map((s) => {
              const maxAbs = Math.max(...s.per_wave.map((r) => Math.abs(r)), 1)
              return <ScanRow key={s.symbol} s={s} maxAbs={maxAbs} cycleNames={cycleNames} onOpen={onStockOpen} />
            })
          ) : (
            <p className="text-[11px] text-gray-400 py-4 text-center">No stock traded in every selected cycle.</p>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1">
          <div className={`${CONSISTENCY_GRID} ${LABEL} mb-1`}>
            <span>Stock</span>
            <span>Rose in</span>
            <button type="button" onClick={() => toggleConsSort('avg_ret')} className="text-right hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center justify-end gap-0.5">
              Avg move{consSort?.col === 'avg_ret' && <span>{consSort.asc ? '▲' : '▼'}</span>}
            </button>
            <button type="button" onClick={() => toggleConsSort('corr')} className="text-right hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center justify-end gap-0.5">
              Tracks {indexLbl}{consSort?.col === 'corr' && <span>{consSort.asc ? '▲' : '▼'}</span>}
            </button>
          </div>
          {consRows.map((s) => (
            <ConsistencyRow key={s.symbol} s={s} onOpen={onStockOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
