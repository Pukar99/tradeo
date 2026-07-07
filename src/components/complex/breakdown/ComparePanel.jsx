// =============================================================================
// ComparePanel.jsx — A vs B over the SELECTED cycles (S3 §8.4.3). Each side =
// NEPSE / a stock / a sector index. Scorecard line + per-cycle returns table
// (Performance style) + Compound Ladder (Rs.100 anchor). Data: POST cycle-compare,
// debounced 400ms + abortable like the sibling movers/consistency fetches.
// =============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { getCycleCompare } from '../../../api'
import { pnlClass } from '../../../utils/format'
import { CARD, LABEL, STITLE, Skeleton, fmtPct } from '../../datalab/shared'
import SymbolSearch from '../../common/SymbolSearch'
import ViewSwitcher from '../../shared/ViewSwitcher'
import { cycleKey } from './useCycleSelection'
import { buildLadder, compareSummary, rowKey, sideLabel } from './compareMath'

// Small chrome icons — dismiss glyph, matches DataLabPage's 24x24 stroke style.
function IconX({ className = 'w-3 h-3' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function IconLadder({ className = 'w-3 h-3' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="21" x2="6" y2="3" />
      <line x1="18" y1="21" x2="18" y2="3" />
      <line x1="6" y1="6" x2="18" y2="6" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="6" y1="18" x2="18" y2="18" />
    </svg>
  )
}
function IconTable({ className = 'w-3 h-3' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="9" y1="10" x2="9" y2="20" />
    </svg>
  )
}

// Owner addition 2026-07-07: one section at a time inside Compare — a toggle
// ahead of the side pickers switches between the two tables.
const SECTIONS = [
  { id: 'returns', label: 'Cycle returns' },
  { id: 'ladder', label: 'Compound ladder' },
]

// Compact cycle chip — "▲/▼ + start year" — this table's rows are API rows
// (start_date/end_date/type), not named cycles.
function rowChip(r) {
  return `${r.type === 'bull' ? '▲' : '▼'} ${r.start_date?.slice(0, 4) || ''}`
}

// One COMBINED box per side (owner eyeball 2026-07-07 — the earlier select+search
// pair read as two duplicated controls). stocksOnly={false} makes SymbolSearch's
// dropdown list indices (NEPSE + sector sub-indices) alongside stocks; its
// onSelect passes indexId for index rows and null for stocks.
function SidePicker({ tag, side, onChange }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className={`${LABEL} shrink-0`}>{tag}</span>
      <SymbolSearch
        value={side ? sideLabel(side) : ''}
        stocksOnly={false}
        inputClassName="w-[72px]"
        onSelect={(label, indexId) =>
          onChange(indexId ? { index_id: indexId } : { symbol: label })
        }
      />
    </div>
  )
}

// Dual diverging bars per cycle — transplant of the retired Performance tab's
// CycleRow, generalized for A/B labels instead of NEPSE/stock. Clicking a
// row anchors the Compound Ladder (amber left border = investment start).
function CompareRow({ r, aLbl, bLbl, max, isStart, onClick }) {
  const isBull = r.type === 'bull'
  const barFor = (v) => {
    if (v == null) return { w: 0, color: '#9ca3af', left: 50 }
    const w = Math.min((Math.abs(v) / max) * 50, 50)
    const color = pnlClass(v, '#10b981', '#ef4444')
    return { w, color, left: v >= 0 ? 50 : 50 - w }
  }
  const aBar = barFor(r.a_ret)
  const bBar = barFor(r.b_ret)

  return (
    <button
      onClick={onClick}
      title={`${r.start_date} → ${r.end_date}`}
      className={`w-full text-left px-2 py-1.5 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors border-l-2
        ${isStart ? 'border-l-amber-500' : 'border-l-transparent'}
        hover:bg-gray-50 dark:hover:bg-gray-900/50`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 inline-flex items-center justify-center px-1 h-5 min-w-[36px] rounded text-[10px] font-black tabular-nums relative
          ${
            isBull
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-100   dark:bg-red-900/40   text-red-500   dark:text-red-400'
          }`}
        >
          {rowChip(r)}
          {isStart && (
            <span
              className="absolute -top-1 -right-1 text-[9px] font-black px-1 rounded-sm bg-amber-500 text-white leading-tight"
              title="Investment start"
            >
              ▶
            </span>
          )}
        </span>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-[10px] font-bold uppercase tracking-widest text-blue-400 truncate">
              {aLbl.slice(0, 4)}
            </span>
            <div className="relative flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
              <div
                className="absolute top-0 h-full rounded-sm"
                style={{ width: `${aBar.w}%`, left: `${aBar.left}%`, background: aBar.color }}
              />
            </div>
            <span
              className={`w-12 shrink-0 text-right text-[10px] font-bold tabular-nums ${pnlClass(r.a_ret ?? 0, 'text-emerald-500', 'text-red-500')}`}
            >
              {fmtPct(r.a_ret)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-[10px] font-bold uppercase tracking-widest text-amber-500 truncate">
              {bLbl.slice(0, 4)}
            </span>
            <div className="relative flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
              <div
                className="absolute top-0 h-full rounded-sm"
                style={{ width: `${bBar.w}%`, left: `${bBar.left}%`, background: bBar.color }}
              />
            </div>
            <span
              className={`w-12 shrink-0 text-right text-[10px] font-bold tabular-nums ${pnlClass(r.b_ret ?? 0, 'text-emerald-500', 'text-red-500')}`}
            >
              {fmtPct(r.b_ret)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

const fmtRs = (v) => (v == null ? '—' : `Rs.${v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1)}`)

export default function ComparePanel({ cycles, a, b, onChangeA, onChangeB }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState(100)
  const [startKey, setStartKey] = useState(null)
  const [section, setSection] = useState('returns')
  const ctrlRef = useRef(null)

  const sig = `${cycles.map(cycleKey).join(',')}|${JSON.stringify(a)}|${JSON.stringify(b)}`
  useEffect(() => {
    if (ctrlRef.current) ctrlRef.current.abort()
    setStartKey(null)
    if (!cycles.length || !a || !b) {
      setData(null)
      setLoading(false)
      setError('')
      return
    }
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true)
    setError('')
    const t = setTimeout(async () => {
      try {
        const res = await getCycleCompare(
          { cycles: cycles.map(({ start_date, end_date, type }) => ({ start_date, end_date, type })), a, b },
          { signal: ctrl.signal }
        )
        if (!ctrl.signal.aborted) setData(res.data)
      } catch (e) {
        if (!ctrl.signal.aborted) setError('Failed to compare')
      }
      if (!ctrl.signal.aborted) setLoading(false)
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  const rows = useMemo(() => data?.rows || [], [data])
  const sum = useMemo(() => compareSummary(rows), [rows])
  const { ladder, final } = useMemo(() => buildLadder(rows, amount, startKey), [rows, amount, startKey])
  const aLbl = sideLabel(a)
  const bLbl = sideLabel(b)
  const maxAbs = Math.max(...rows.flatMap((r) => [Math.abs(r.a_ret ?? 0), Math.abs(r.b_ret ?? 0)]), 1)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
      {/* 1. Section toggle FIRST, then the two side pickers (owner 2026-07-07) */}
      <div className="flex items-center gap-2 flex-wrap">
        <ViewSwitcher
          views={SECTIONS}
          active={section}
          onChange={setSection}
          ariaLabel="Compare section"
        />
        <SidePicker tag="A" side={a} onChange={onChangeA} />
        <span className="text-[10px] text-gray-400 shrink-0">vs</span>
        <SidePicker tag="B" side={b} onChange={onChangeB} />
      </div>

      {error && (
        <div className="text-[10px] text-red-500 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error" className="font-bold transition-colors">
            <IconX className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 2. Empty states */}
      {!a || !b ? (
        <div className="flex items-center justify-center py-6 text-[11px] text-gray-400">
          Pick both sides — search a stock or choose an index.
        </div>
      ) : !cycles.length ? (
        <div className="flex items-center justify-center py-6 text-[11px] text-gray-400">
          Select a cycle on the chart
        </div>
      ) : loading || !data ? (
        /* 3. Loading */
        <Skeleton minH={120} />
      ) : (
        <>
          {/* 4. Scorecard line */}
          <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
            {aLbl} beat {bLbl} in {sum.aWins}/{sum.compared} cycles · avg {fmtPct(sum.avgA)} vs{' '}
            {fmtPct(sum.avgB)} ·{' '}
            <span className={`font-bold ${pnlClass(sum.avgDiff ?? 0, 'text-emerald-500', 'text-red-500')}`}>
              edge {fmtPct(sum.avgDiff)}
            </span>
          </p>

          {/* 5. Per-cycle returns table (section-toggled) */}
          {section === 'returns' && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
              <p className={`${STITLE} flex items-center gap-1.5`}>
                <IconTable className="w-3 h-3 shrink-0" />
                Cycle Returns
              </p>
            </div>
            <div className="max-h-[280px] overflow-y-auto bg-white dark:bg-gray-900">
              {rows.map((r) => (
                <CompareRow
                  key={rowKey(r)}
                  r={r}
                  aLbl={aLbl}
                  bLbl={bLbl}
                  max={maxAbs}
                  isStart={startKey === rowKey(r)}
                  onClick={() => setStartKey((prev) => (prev === rowKey(r) ? null : rowKey(r)))}
                />
              ))}
            </div>
          </div>
          )}

          {/* 6. Compound Ladder (section-toggled) */}
          {section === 'ladder' && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
              <div className="flex items-center justify-between mb-1.5">
                <p className={`${STITLE} flex items-center gap-1.5`}>
                  <IconLadder className="w-3 h-3 shrink-0" />
                  Compound Ladder
                </p>
                {startKey != null && (
                  <button
                    onClick={() => setStartKey(null)}
                    className="text-[10px] text-blue-500 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Invest</span>
                <span className="text-[10px] text-gray-400">Rs.</span>
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={amount}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setAmount(isNaN(v) || v < 0 ? 0 : v)
                  }}
                  className="w-20 text-[11px] font-semibold tabular-nums text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Cycle
              </span>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 truncate">
                  {aLbl}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 truncate">
                  {bLbl}
                </p>
              </div>
            </div>

            <div className="max-h-[240px] overflow-y-auto bg-white dark:bg-gray-900">
              {ladder.map((row) => {
                const isBull = row.type === 'bull'
                const isStart = startKey === row.key
                return (
                  <button
                    key={row.key}
                    onClick={() => setStartKey((prev) => (prev === row.key ? null : row.key))}
                    title={
                      isStart
                        ? 'Investment starts here. Click to unset.'
                        : 'Anchor investment start at this cycle'
                    }
                    className={`w-full grid grid-cols-[40px_1fr_1fr] items-center gap-1 px-2 py-1 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors relative
                      ${
                        isStart
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border-l-2 border-l-amber-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-900/50 border-l-2 border-l-transparent'
                      }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center px-1 h-5 min-w-[36px] rounded text-[10px] font-black tabular-nums relative
                      ${
                        isBull
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-100   dark:bg-red-900/40   text-red-500   dark:text-red-400'
                      }`}
                    >
                      {row.type === 'bull' ? '▲' : '▼'}
                      {isStart && (
                        <span
                          className="absolute -top-1 -right-1 text-[9px] font-black px-1 rounded-sm bg-amber-500 text-white leading-tight"
                          title="Investment start"
                        >
                          ▶
                        </span>
                      )}
                    </span>
                    <div className="text-right tabular-nums">
                      <span
                        className={`text-[10px] block ${pnlClass(row.a_ret ?? 0, 'text-emerald-500', 'text-red-500')}`}
                      >
                        {fmtPct(row.a_ret)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">
                        {fmtRs(row.aBal)}
                      </span>
                    </div>
                    <div className="text-right tabular-nums">
                      <span
                        className={`text-[10px] block ${pnlClass(row.b_ret ?? 0, 'text-emerald-500', 'text-red-500')}`}
                      >
                        {fmtPct(row.b_ret)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">
                        {fmtRs(row.bBal)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {final && (
              <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    End
                  </span>
                  <div className="text-right">
                    <p
                      className={`text-[11px] font-black tabular-nums ${pnlClass(final.aPct, 'text-emerald-500', 'text-red-500')}`}
                    >
                      {fmtPct(final.aPct)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-[11px] font-black tabular-nums ${pnlClass(final.bPct, 'text-emerald-500', 'text-red-500')}`}
                    >
                      {fmtPct(final.bPct)}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 text-center text-[10px] text-gray-500 dark:text-gray-400">
                  {aLbl} edge vs {bLbl}:{' '}
                  <span
                    className={`font-bold tabular-nums ${pnlClass(final.aPct - final.bPct, 'text-emerald-500', 'text-red-500')}`}
                  >
                    {fmtPct(final.aPct - final.bPct)}pp
                  </span>
                </div>
              </div>
            )}
          </div>
          )}

          <p className="text-[10px] text-gray-400 text-center">history, not a promise</p>
        </>
      )}
    </div>
  )
}
