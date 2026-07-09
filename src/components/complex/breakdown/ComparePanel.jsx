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
  { id: 'general', label: 'General' },
  { id: 'returns', label: 'Cycle returns' },
  { id: 'ladder', label: 'Compound ladder' },
]

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
// row FOCUSES the cycle (drives the right-panel mini charts); the amber
// left border is a passive indicator of the Compound Ladder's anchor only.
function CompareRow({ r, aLbl, bLbl, max, isStart, chipLabel, chipTitle, onClick }) {
  const isBull = r.type === 'bull'
  // Bar colors (owner idea 2026-07-08, refined): hue = that side's OWN sign
  // (a bearish NEPSE inside a bull cycle must be red), shade = the SIDE —
  // index (A) dark, symbol (B) light. Emerald/red 600↔400 Tailwind hexes.
  const barFor = (v, dark) => {
    if (v == null) return { w: 0, color: '#9ca3af', left: 50 }
    const w = Math.min((Math.abs(v) / max) * 50, 50)
    const color = v >= 0 ? (dark ? '#059669' : '#34d399') : dark ? '#dc2626' : '#f87171'
    return { w, color, left: v >= 0 ? 50 : 50 - w }
  }
  const aBar = barFor(r.a_ret, true)
  const bBar = barFor(r.b_ret, false)

  return (
    <button
      onClick={onClick}
      title={chipTitle}
      className={`w-full text-left px-2 py-1.5 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors border-l-2
        ${isStart ? 'border-l-amber-500' : 'border-l-transparent'}
        ${!isBull ? 'bg-red-50/50 dark:bg-red-950/10' : ''}
        hover:bg-gray-50 dark:hover:bg-gray-900/50`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 inline-flex items-center justify-center px-1 h-5 min-w-[36px] rounded text-[10px] font-black tabular-nums
          ${
            isBull
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-100   dark:bg-red-900/40   text-red-500   dark:text-red-400'
          }`}
        >
          {chipLabel}
        </span>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-widest text-blue-400 truncate" title={aLbl}>
              {aLbl}
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
            <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-widest text-amber-500 truncate" title={bLbl}>
              {bLbl}
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

export default function ComparePanel({ cycles, a, b, onChangeA, onChangeB, onFocusRow }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState(100)
  const [startKey, setStartKey] = useState(null)
  const [section, setSection] = useState('general')
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
  // Real Bull/Bear names for the Cycle Returns rows (owner eyeball) — cycles
  // prop carries the injected `name` (e.g. 'Bull 3'); compacted to fit the chip.
  const nameByKey = useMemo(() => new Map(cycles.map((c) => [cycleKey(c), c.name])), [cycles])
  // Cycle duration (days) for the General range table's Days column.
  const durByKey = useMemo(() => new Map(cycles.map((c) => [cycleKey(c), c.duration_days])), [cycles])

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
        /* 3. Loading — mirror the section that's about to render so the
            card chrome + shape don't jump when data arrives. */
        <div className="space-y-3">
          {section === 'general' && (
            <>
              <div className={CARD}>
                <Skeleton variant="card" minH={140} />
              </div>
              <div className={`${CARD} overflow-hidden`}>
                <Skeleton variant="table" rows={4} />
              </div>
            </>
          )}
          {section === 'returns' && (
            <div className={`${CARD} overflow-hidden`}>
              <Skeleton variant="rows" rows={6} minH={220} />
            </div>
          )}
          {section === 'ladder' && (
            <div className={`${CARD} overflow-hidden`}>
              <Skeleton variant="table" rows={6} />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* General section — full A-vs-B verdict (owner 2026-07-08) */}
          {section === 'general' && (() => {
            const winLbl = sum.winner === 'a' ? aLbl : sum.winner === 'b' ? bLbl : null
            const loseLbl = sum.winner === 'a' ? bLbl : sum.winner === 'b' ? aLbl : null
            const bestName = sum.bestRow ? nameByKey.get(rowKey(sum.bestRow)) : null
            const closeName = sum.closestRow ? nameByKey.get(rowKey(sum.closestRow)) : null
            return (
              <div className={`${CARD} p-3 space-y-2`}>
                {/* Headline verdict */}
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                  {sum.compared === 0 ? (
                    'Not enough overlapping data to compare these two.'
                  ) : sum.winner === 'tie' ? (
                    <>Neck and neck — {aLbl} and {bLbl} averaged about the same across your {sum.compared} cycle{sum.compared === 1 ? '' : 's'}.</>
                  ) : (
                    <>
                      <span className={sum.winner === 'a' ? 'text-blue-500' : 'text-amber-500'}>{winLbl}</span>{' '}
                      was the stronger pick over your {sum.compared} cycle{sum.compared === 1 ? '' : 's'} — averaging{' '}
                      <span className="font-bold">{fmtPct(sum.winnerLead)}</span> more per cycle than {loseLbl}.
                    </>
                  )}
                </p>

                {sum.compared > 0 && (
                  <>
                    {/* Scoreline + win/loss strip (from A's perspective) */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {aLbl} won {sum.aWins} of {sum.compared}
                      </span>
                      <span className="flex gap-0.5">
                        {rows.filter((r) => r.diff != null).map((r) => (
                          <span
                            key={rowKey(r)}
                            title={`${nameByKey.get(rowKey(r)) || r.start_date}: ${aLbl} ${r.diff > 0 ? 'won' : 'lost'} by ${fmtPct(Math.abs(r.diff))}`}
                            className={`inline-block w-2 h-2 rounded-sm ${r.diff > 0 ? 'bg-blue-400' : 'bg-amber-400'}`}
                          />
                        ))}
                      </span>
                    </div>

                    {/* Labeled averages */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center justify-between rounded bg-gray-50 dark:bg-gray-800/40 px-2 py-1">
                        <span className="uppercase tracking-widest text-blue-400 font-bold truncate">{aLbl}</span>
                        <span className={`font-bold tabular-nums ${pnlClass(sum.avgA ?? 0, 'text-emerald-500', 'text-red-500')}`}>{fmtPct(sum.avgA)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded bg-gray-50 dark:bg-gray-800/40 px-2 py-1">
                        <span className="uppercase tracking-widest text-amber-500 font-bold truncate">{bLbl}</span>
                        <span className={`font-bold tabular-nums ${pnlClass(sum.avgB ?? 0, 'text-emerald-500', 'text-red-500')}`}>{fmtPct(sum.avgB)}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Average return per cycle</p>

                    {/* Where it mattered */}
                    {sum.bestRow && sum.compared > 1 && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug pt-1.5 border-t border-gray-100 dark:border-gray-800">
                        Biggest gap in <span className="font-semibold text-gray-600 dark:text-gray-300">{bestName || 'a cycle'}</span>
                        {' '}({fmtPct(sum.bestRow.a_ret)} vs {fmtPct(sum.bestRow.b_ret)}).
                        {closeName && closeName !== bestName && <> Closest in <span className="font-semibold text-gray-600 dark:text-gray-300">{closeName}</span>.</>}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400">History, not a promise.</p>
                  </>
                )}
              </div>
            )
          })()}

          {/* General section — per-cycle range table (owner 2026-07-08) */}
          {section === 'general' && rows.length > 0 && (
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                <span className={STITLE}>Per-cycle stats</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] tabular-nums">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left font-semibold px-2 py-1">Cycle</th>
                      <th className="text-left font-semibold px-2 py-1">Start</th>
                      <th className="text-left font-semibold px-2 py-1">End</th>
                      <th className="text-right font-semibold px-2 py-1">Days</th>
                      <th className="text-right font-semibold px-2 py-1" title={aLbl}>{aLbl} range·hi·lo</th>
                      <th className="text-right font-semibold px-2 py-1" title={bLbl}>{bLbl} range·hi·lo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const nm = nameByKey.get(rowKey(r)) || (r.type === 'bull' ? 'Bull' : 'Bear')
                      const days = durByKey.get(rowKey(r))
                      const cell = (rng, hi, lo) =>
                        rng == null ? <span className="text-gray-300">—</span> : (
                          <>
                            <span className="font-bold text-gray-700 dark:text-gray-200">{rng.toFixed(1)}%</span>
                            <span className="block text-gray-400">{hi.toFixed(0)} / {lo.toFixed(0)}</span>
                          </>
                        )
                      return (
                        <tr key={rowKey(r)} className={`border-b border-gray-50 dark:border-gray-800/60 last:border-0 ${r.type === 'bear' ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                          <td className="px-2 py-1 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {r.type === 'bull' ? '▲' : '▼'} {nm}
                          </td>
                          <td className="px-2 py-1 text-gray-500 whitespace-nowrap">{r.start_date}</td>
                          <td className="px-2 py-1 text-gray-500 whitespace-nowrap">{r.end_date}</td>
                          <td className="px-2 py-1 text-right text-gray-500 whitespace-nowrap">{days != null ? `${days}d` : '—'}</td>
                          <td className="px-2 py-1 text-right">{cell(r.a_range, r.a_high, r.a_low)}</td>
                          <td className="px-2 py-1 text-right">{cell(r.b_range, r.b_high, r.b_low)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className={`${LABEL} normal-case px-2 py-1 text-gray-400`}>Range = (high − low) ÷ low over the cycle. History, not a promise.</p>
            </div>
          )}

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
              {rows.map((r) => {
                // Full "Bull 1 / Bear 1" names — the compacted B1/Br1 read as
                // noise (owner 2026-07-08).
                const fullName = nameByKey.get(rowKey(r))
                const chipLabel = `${r.type === 'bull' ? '▲' : '▼'} ${fullName || r.start_date?.slice(0, 4)}`
                const chipTitle = `${fullName || (r.type === 'bull' ? 'Bull' : 'Bear')} · ${r.start_date} → ${r.end_date}`
                return (
                  <CompareRow
                    key={rowKey(r)}
                    r={r}
                    aLbl={aLbl}
                    bLbl={bLbl}
                    max={maxAbs}
                    isStart={startKey === rowKey(r)}
                    chipLabel={chipLabel}
                    chipTitle={chipTitle}
                    onClick={() => onFocusRow?.(r)}
                  />
                )
              })}
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

            <div className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
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
                // Full "Bull 1 / Bear 1" naming, matching the Cycle Returns
                // rows (owner 2026-07-08 — compacted B1/Br1 read as noise).
                const fullName = nameByKey.get(row.key)
                return (
                  <button
                    key={row.key}
                    onClick={() => setStartKey((prev) => (prev === row.key ? null : row.key))}
                    title={
                      isStart
                        ? `Investment starts at ${fullName || 'this cycle'}. Click to unset.`
                        : `Start the investment at ${fullName || 'this cycle'}`
                    }
                    className={`w-full grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1 px-2 py-1 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors relative
                      ${
                        isStart
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border-l-2 border-l-amber-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-900/50 border-l-2 border-l-transparent'
                      }`}
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span
                        className={`inline-flex items-center justify-center px-1 h-5 min-w-[36px] rounded text-[10px] font-black tabular-nums
                        ${
                          isBull
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-100   dark:bg-red-900/40   text-red-500   dark:text-red-400'
                        }`}
                      >
                        {row.type === 'bull' ? '▲' : '▼'} {fullName || ''}
                      </span>
                      {isStart && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 leading-none">
                          start
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
                <div className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1">
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
          {/* No footer line — the card's meta already says
              "over selected cycles · history, not a promise" (owner 2026-07-08). */}
        </>
      )}
    </div>
  )
}
