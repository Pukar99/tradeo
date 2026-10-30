// =============================================================================
// CycleInsights.jsx — Bull / Bear mode center card (redesign 2026-10-31).
// Replaces the four tabs Top movers / Consistency / Scan / Compare, which all
// showed the same stocks from different angles, with ONE list in two looks:
//   Map   — every stock as a dot: how often it rose (x) × average return (y)
//   Table — every number the old tabs showed, in one row
// Lenses (Top gainers / Most reliable / Best worst-case / Top losers) are just
// sort orders. Clicking a stock opens the deep dive in the right panel.
// Copy rule: NEVER the word "probability" — footer says `history, not a promise`.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { CARD, LABEL, Skeleton, fmtPct } from '../../datalab/shared'
import ViewSwitcher from '../../shared/ViewSwitcher'
import { KINDS, LENSES, avgOf, barPct, classify, corrBlocks } from './insightsMath'

const LOOKS = [
  { id: 'map', label: 'Map' },
  { id: 'table', label: 'Table' },
]

function KindBadge({ kind }) {
  const k = KINDS[kind]
  return (
    <span
      title={k.hint}
      className={`ml-2 px-1.5 py-px rounded-full text-[9px] font-semibold ${k.cls}`}
    >
      {k.label}
    </span>
  )
}

// Per-cycle bars around a zero line — up bars above, down bars below.
function RunBars({ rets, max, names }) {
  return (
    <span className="relative inline-flex gap-[3px] h-6 align-middle">
      <span className="absolute -left-0.5 -right-0.5 top-1/2 h-px bg-gray-200 dark:bg-gray-700" />
      {rets.map((r, i) => (
        <span
          key={i}
          className="relative w-1.5"
          title={`${names[i]}: ${r == null ? 'no data' : fmtPct(r)}`}
        >
          {r != null && (
            <span
              className={`absolute left-0 w-1.5 rounded-sm ${r >= 0 ? 'bg-emerald-500 bottom-1/2' : 'bg-red-500 top-1/2'}`}
              style={{ height: `${Math.max(2, (Math.abs(r) / max) * 11)}px` }}
            />
          )}
        </span>
      ))}
    </span>
  )
}

// ── Map ──────────────────────────────────────────────────────────────────────
function StockMap({ rows, indexAvg, nCycles, picked, onPick, dark, topSet, find }) {
  const wrapRef = useRef(null)
  const [w, setW] = useState(700)
  const [tip, setTip] = useState(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setW(el.clientWidth || 700)
    const ro = new ResizeObserver(() => setW(el.clientWidth || 700))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 300
  const P = { l: 46, r: 14, t: 12, b: 32 }
  const ys = rows.map((s) => s.avg_ret)
  const ymin = Math.min(0, indexAvg ?? 0, ...ys)
  const ymax = Math.max(0, indexAvg ?? 0, ...ys)
  const pad = (ymax - ymin) * 0.06 || 5
  const lo = ymin - pad,
    hi = ymax + pad
  const X = (ratio) => P.l + ratio * (w - P.l - P.r)
  const Y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  // Spread dots sideways inside their column so a full column doesn't stack
  // into one line — deterministic per symbol so dots never jump on re-render.
  const colW = (w - P.l - P.r) / Math.max(4, nCycles * 2)
  const jitter = (sym) => {
    let h = 0
    for (const c of sym) h = (h * 31 + c.charCodeAt(0)) % 997
    return ((h % 100) / 100 - 0.5) * colW * 0.8
  }
  const step = Math.pow(10, Math.floor(Math.log10(hi - lo || 1)))
  const yt = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yt.push(v)
  const grid = dark ? '#1e293b' : '#f1f5f9'
  const faint = dark ? '#64748b' : '#94a3b8'
  const midX = X(0.75)

  return (
    <div ref={wrapRef} className="relative px-2 pt-1">
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="block"
        role="img"
        aria-label="Stock map"
      >
        {indexAvg != null && (
          <>
            <rect
              x={midX}
              y={P.t}
              width={w - P.r - midX}
              height={Math.max(0, Y(indexAvg) - P.t)}
              fill={dark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)'}
            />
            <rect
              x={P.l}
              y={Y(indexAvg)}
              width={midX - P.l}
              height={Math.max(0, H - P.b - Y(indexAvg))}
              fill={dark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)'}
            />
          </>
        )}
        {yt.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={w - P.r} y1={Y(v)} y2={Y(v)} stroke={grid} />
            <text
              x={P.l - 6}
              y={Y(v) + 3}
              textAnchor="end"
              fontSize="9"
              fontFamily="monospace"
              fill={faint}
            >
              {v > 0 ? '+' : ''}
              {Math.round(v)}%
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <text key={r} x={X(r)} y={H - P.b + 13} textAnchor="middle" fontSize="9" fill={faint}>
            {Math.round(r * 100)}%
          </text>
        ))}
        <text
          x={(P.l + w - P.r) / 2}
          y={H - 3}
          textAnchor="middle"
          fontSize="9"
          fontWeight="600"
          fill={faint}
        >
          Share of runs it rose in →
        </text>
        {indexAvg != null && (
          <>
            <line
              x1={P.l}
              x2={w - P.r}
              y1={Y(indexAvg)}
              y2={Y(indexAvg)}
              stroke={faint}
              strokeDasharray="3,3"
            />
            <text x={w - P.r - 4} y={Y(indexAvg) - 4} textAnchor="end" fontSize="9" fill={faint}>
              index avg {fmtPct(indexAvg)}
            </text>
          </>
        )}
        {rows.map((s) => {
          const on = picked === s.symbol
          const hit = !find || s.symbol.includes(find)
          return (
            <circle
              key={s.symbol}
              cx={X(s.up_count / s.n_covered) + jitter(s.symbol)}
              cy={Y(s.avg_ret)}
              r={on ? 6.5 : 4.5}
              fill={KINDS[s.kind].dot}
              opacity={(picked || find) && !on && !(find && hit) ? 0.22 : 1}
              stroke={on ? (dark ? '#f1f5f9' : '#0f172a') : dark ? '#0b1220' : '#fff'}
              strokeWidth={on ? 2 : 1}
              className="cursor-pointer"
              onClick={() => onPick(s.symbol)}
              onMouseEnter={(e) =>
                setTip({ s, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
              }
              onMouseLeave={() => setTip(null)}
            />
          )
        })}
        {rows
          .filter((s) => topSet.has(s.symbol) || s.symbol === picked)
          .map((s) => (
            <text
              key={s.symbol}
              x={X(s.up_count / s.n_covered) + jitter(s.symbol) + 7}
              y={Y(s.avg_ret) + 3}
              fontSize="9"
              fontWeight="700"
              fill={dark ? '#e2e8f0' : '#1e293b'}
              pointerEvents="none"
            >
              {s.symbol}
            </text>
          ))}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute z-20 text-[10px] rounded-lg px-2 py-1 shadow border whitespace-nowrap bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          style={{ left: Math.min(tip.x + 14, w - 220), top: tip.y + 8 }}
        >
          <b className="text-gray-800 dark:text-gray-100">{tip.s.symbol}</b>{' '}
          <span className={tip.s.avg_ret >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {fmtPct(tip.s.avg_ret)}
          </span>
          <span className="text-gray-400">
            {' '}
            avg · rose in {tip.s.up_count}/{tip.s.n_covered} · {KINDS[tip.s.kind].label}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-2 pb-2 pt-1">
        {Object.entries(KINDS).map(([id, k]) => (
          <span
            key={id}
            className="flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 leading-snug"
          >
            <span className="mt-0.5 w-2 h-2 rounded-sm shrink-0" style={{ background: k.dot }} />
            <span>
              <b className="text-gray-700 dark:text-gray-200">{k.label}</b> — {k.hint}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main card ────────────────────────────────────────────────────────────────
export default function CycleInsights({
  selectedCycles,
  data,
  loading,
  error,
  onDismissError,
  indexLbl,
  picked,
  onPick,
  dark,
}) {
  const [look, setLook] = useState('map')
  const [lens, setLens] = useState('gainers')
  const [find, setFind] = useState('')

  const names = selectedCycles.map((c) => c.name || (c.type === 'bull' ? 'Bull' : 'Bear'))
  const nSel = selectedCycles.length
  const indexAvg = avgOf(data?.index_rets || [])

  // Only stocks with a comparable return in EVERY selected run — a stock that
  // listed during run 3 would otherwise top "Top gainers" on its listing pop
  // (logic test 2026-10-31: SWASTIK +601% from 1 of 3 runs). Same rule the old
  // Top movers / Scan used (full coverage).
  const allStocks = useMemo(() => data?.insights?.stocks || [], [data])
  const stocks = useMemo(
    () =>
      allStocks
        .filter((s) => s.n_covered === nSel)
        .map((s) => ({ ...s, kind: classify(s, indexAvg) })),
    [allStocks, nSel, indexAvg]
  )
  const leftOut = allStocks.length - stocks.length
  const rows = useMemo(() => {
    const f = find.trim().toUpperCase()
    const sort = LENSES.find((l) => l.id === lens).sort
    return stocks
      .filter((s) => !f || s.symbol.includes(f) || (s.company_name || '').toUpperCase().includes(f))
      .sort(sort)
  }, [stocks, find, lens])
  const topSet = useMemo(() => new Set(rows.slice(0, 8).map((s) => s.symbol)), [rows])

  // One-line summary (replaces the four per-tab captions)
  const every = stocks.filter((s) => s.n_covered === nSel && s.up_count === nSel).length
  const leads = stocks.filter((s) => s.kind === 'lead')
  const best = leads[0] // stocks arrive sorted by avg desc
  const medianAvg = useMemo(() => {
    const v = stocks.map((s) => s.avg_ret).sort((a, b) => a - b)
    if (!v.length) return null
    const m = v.length >> 1
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
  }, [stocks])
  const runMax = Math.max(
    1,
    ...stocks.flatMap((s) => (s.per_wave || []).map((r) => Math.abs(r ?? 0)))
  )
  const avgMax = Math.max(1, ...stocks.map((s) => Math.abs(s.avg_ret)))
  const kindWord = selectedCycles.every((c) => c.type === 'bull')
    ? 'bull run'
    : selectedCycles.every((c) => c.type === 'bear')
      ? 'bear run'
      : 'cycle'

  return (
    <div className={`${CARD} flex-1 min-h-[300px] lg:min-h-0 flex flex-col overflow-hidden`}>
      {error && (
        <div className="shrink-0 px-3 py-1.5 text-[10px] text-red-500 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={onDismissError} aria-label="Dismiss error" className="font-bold">
            ×
          </button>
        </div>
      )}

      {!nSel ? (
        <div className="flex-1 flex items-center justify-center py-6 text-[11px] text-gray-400">
          Select a cycle on the chart
        </div>
      ) : loading || !data ? (
        <Skeleton variant="rows" rows={8} minH={240} />
      ) : (
        <>
          {/* Summary */}
          <div className="shrink-0 flex flex-wrap items-end gap-x-6 gap-y-2 px-3 pt-2.5 pb-2 border-b border-gray-100 dark:border-gray-800">
            <p className="flex-1 min-w-[260px] text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              Across your{' '}
              <b className="text-gray-800 dark:text-gray-100">
                {nSel} {kindWord}
                {nSel === 1 ? '' : 's'}
              </b>
              {', '}
              <b className="text-gray-800 dark:text-gray-100">{leads.length}</b> stocks were
              reliable winners
              {best && (
                <>
                  {'. Best: '}
                  <b className="text-gray-800 dark:text-gray-100">{best.symbol}</b>, avg{' '}
                  <b className="text-emerald-600 dark:text-emerald-400">{fmtPct(best.avg_ret)}</b>,
                  rose in{' '}
                  {best.up_count === best.n_covered
                    ? 'every run'
                    : `${best.up_count} of ${best.n_covered}`}
                </>
              )}
              .
            </p>
            {[
              ['Rose every time', `${every} of ${stocks.length}`, ''],
              [
                'Median stock',
                fmtPct(medianAvg),
                medianAvg >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              ],
              [
                `${indexLbl} avg`,
                fmtPct(indexAvg),
                indexAvg >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              ],
            ].map(([l, v, c]) => (
              <span key={l}>
                <span className={`${LABEL} block`}>{l}</span>
                <span
                  className={`text-[14px] font-bold tabular-nums ${c || 'text-gray-800 dark:text-gray-100'}`}
                >
                  {v}
                </span>
              </span>
            ))}
          </div>

          {/* Controls */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
            <ViewSwitcher
              views={LOOKS}
              active={look}
              onChange={setLook}
              ariaLabel="Insights look"
            />
            <div className="flex flex-wrap gap-1">
              {LENSES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLens(l.id)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                    lens === l.id
                      ? 'border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <input
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Find a stock…"
              aria-label="Find a stock"
              className="ml-auto w-32 text-[10px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          {/* Map | Table */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {stocks.length === 0 ? (
              <p className="text-[11px] text-gray-400 py-6 text-center">
                No stock data for these cycles.
              </p>
            ) : look === 'map' ? (
              <StockMap
                rows={rows}
                indexAvg={indexAvg}
                nCycles={nSel}
                picked={picked}
                onPick={onPick}
                dark={dark}
                topSet={topSet}
                find={find.trim().toUpperCase()}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[11px] tabular-nums">
                  <thead>
                    <tr className={`${LABEL} text-right`}>
                      <th className="text-left font-semibold px-3 py-1.5">Stock</th>
                      <th className="font-semibold px-2 py-1.5">Each run</th>
                      <th className="font-semibold px-2 py-1.5">Average</th>
                      <th className="font-semibold px-2 py-1.5">Worst</th>
                      <th className="font-semibold px-2 py-1.5">Rose in</th>
                      <th className="font-semibold px-3 py-1.5">Moves with {indexLbl}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr
                        key={s.symbol}
                        onClick={() => onPick(s.symbol)}
                        className={`cursor-pointer border-t border-gray-50 dark:border-gray-800/60 ${
                          picked === s.symbol
                            ? 'bg-blue-50 dark:bg-blue-950/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                        }`}
                      >
                        <td className="px-3 py-1 whitespace-nowrap">
                          <b className="text-gray-800 dark:text-gray-100">{s.symbol}</b>
                          <KindBadge kind={s.kind} />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <RunBars rets={s.per_wave} max={runMax} names={names} />
                        </td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <span className="inline-block w-12 h-1 mr-2 align-middle rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <span
                              className={`block h-full rounded-full ${s.avg_ret >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                              style={{ width: `${barPct(s.avg_ret, avgMax)}%` }}
                            />
                          </span>
                          <b
                            className={
                              s.avg_ret >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {fmtPct(s.avg_ret)}
                          </b>
                        </td>
                        <td
                          className={`px-2 py-1 text-right ${s.floor < 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                          {fmtPct(s.floor)}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600 dark:text-gray-300">
                          {s.up_count} of {s.n_covered}
                        </td>
                        <td className="px-3 py-1 text-right">
                          <span
                            className="inline-flex gap-px"
                            title={
                              s.corr == null
                                ? 'not enough overlapping days'
                                : `day-to-day correlation ${s.corr.toFixed(2)}`
                            }
                          >
                            {[0, 1, 2, 3, 4].map((i) => (
                              <span
                                key={i}
                                className={`inline-block w-1 h-2.5 rounded-sm ${i < corrBlocks(s.corr) ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`}
                              />
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p
            className={`shrink-0 ${LABEL} normal-case px-3 py-1.5 border-t border-gray-50 dark:border-gray-800/60 flex justify-between gap-2`}
          >
            <span>
              {look === 'map' ? 'Top 8 for the lens are labelled · click a dot' : 'Click a row'} for
              the stock deep dive
              {leftOut > 0 &&
                ` · ${leftOut} stock${leftOut === 1 ? '' : 's'} left out (not trading through every run, e.g. new listings)`}
            </span>
            <span>history, not a promise</span>
          </p>
        </>
      )}
    </div>
  )
}
