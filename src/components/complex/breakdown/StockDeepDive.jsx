// =============================================================================
// StockDeepDive.jsx — right-panel deep dive for one stock across the selected
// cycles (redesign 2026-10-31). Replaces the old Compare tab + right-panel
// "2 lines / Who's ahead" charts: verdict in plain words, each run vs the
// index (or another stock), and ₹100 held through every run.
// Reads the same /cycle-analytics payload as CycleInsights — no extra fetch.
// =============================================================================

import { useMemo, useState } from 'react'
import { CARD, LABEL, fmtPct } from '../../datalab/shared'
import { KINDS, avgOf, classify, growth } from './insightsMath'

function Ladder({ a, b, names, dark }) {
  const pa = growth(a),
    pb = growth(b)
  const W = 300,
    H = 96
  const all = [...pa, ...pb]
  const mn = Math.min(...all),
    mx = Math.max(...all)
  const X = (i) => 8 + (i / (pa.length - 1 || 1)) * (W - 16)
  const Y = (v) => 6 + (1 - (v - mn) / (mx - mn || 1)) * (H - 20)
  const path = (p) => p.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(v)}`).join('')
  const faint = dark ? '#64748b' : '#94a3b8'
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-24 block"
      preserveAspectRatio="none"
      aria-label="₹100 growth"
    >
      <path
        d={path(pb)}
        fill="none"
        stroke={faint}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path(pa)}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
      {pa.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r="2.5" fill="#3b82f6" />
      ))}
      {['start', ...names].map((n, i) => (
        <text
          key={i}
          x={X(i)}
          y={H - 2}
          fontSize="8"
          fill={faint}
          textAnchor={i === 0 ? 'start' : i === names.length ? 'end' : 'middle'}
        >
          {n}
        </text>
      ))}
    </svg>
  )
}

export default function StockDeepDive({ symbol, data, selectedCycles, indexLbl, onClose, dark }) {
  const [vs, setVs] = useState(null) // null = the index
  const stocks = useMemo(() => data?.insights?.stocks || [], [data])
  const s = stocks.find((x) => x.symbol === symbol)
  const idxRets = data?.index_rets || []
  const indexAvg = avgOf(idxRets)
  const names = selectedCycles.map((c) => c.name || (c.type === 'bull' ? 'Bull' : 'Bear'))

  if (!s) {
    return (
      <div className="flex-1 p-4 text-[11px] text-gray-400">
        {symbol} has no data in the selected cycles.{' '}
        <button onClick={onClose} className="underline">
          Back
        </button>
      </div>
    )
  }

  const kind = classify(s, indexAvg)
  const other = vs ? stocks.find((x) => x.symbol === vs) : null
  const vsLbl = other ? other.symbol : indexLbl
  const vsRets = other ? other.per_wave : idxRets
  const pairs = s.per_wave.map((r, i) => ({ a: r, b: vsRets[i] ?? null, name: names[i] }))
  const scored = pairs.filter((p) => p.a != null && p.b != null)
  const wins = scored.filter((p) => p.a > p.b).length
  const max = Math.max(1, ...pairs.flatMap((p) => [Math.abs(p.a ?? 0), Math.abs(p.b ?? 0)]))
  const ga = growth(s.per_wave),
    gb = growth(vsRets)
  const covered = s.per_wave.filter((r) => r != null)
  const bestRun = Math.max(...covered)
  const withoutBest =
    covered.length > 1
      ? (covered.reduce((a, b) => a + b, 0) - bestRun) / (covered.length - 1)
      : null

  const verdict =
    kind === 'lead' ? (
      <>
        rose in{' '}
        <b>
          {s.up_count} of {s.n_covered}
        </b>{' '}
        runs and beat {vsLbl} in{' '}
        <b>
          {wins} of {scored.length}
        </b>
        . A dependable performer in these runs.
      </>
    ) : kind === 'spike' ? (
      <>
        has a big average, but it comes mostly from <b>one run ({fmtPct(bestRun)})</b>. Without it,
        it averages <b>{fmtPct(withoutBest)}</b>.
      </>
    ) : kind === 'steady' ? (
      <>
        usually goes up (
        <b>
          {s.up_count} of {s.n_covered}
        </b>
        ), but by less than {indexLbl} on average. Beat {vsLbl} in{' '}
        <b>
          {wins} of {scored.length}
        </b>
        .
      </>
    ) : (
      <>
        lagged: up in only{' '}
        <b>
          {s.up_count} of {s.n_covered}
        </b>{' '}
        runs, beat {vsLbl} in{' '}
        <b>
          {wins} of {scored.length}
        </b>
        .
      </>
    )

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white/40 dark:bg-gray-950/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {s.symbol}
            <span
              className={`px-1.5 py-px rounded-full text-[9px] font-semibold ${KINDS[kind].cls}`}
            >
              {KINDS[kind].label}
            </span>
          </p>
          <p className="text-[10px] text-gray-400 truncate">{s.company_name}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close stock deep dive"
          className="px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Close
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2 [&_b]:text-gray-800 dark:[&_b]:text-gray-100">
        <b>{s.symbol}</b> {verdict}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {[
          [
            'Average',
            fmtPct(s.avg_ret),
            s.avg_ret >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400',
          ],
          [
            'Worst run',
            fmtPct(s.floor),
            s.floor < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100',
          ],
          [`Beat ${vsLbl}`, `${wins}/${scored.length}`, 'text-gray-800 dark:text-gray-100'],
        ].map(([l, v, c]) => (
          <div key={l} className={`${CARD} px-2.5 py-2`}>
            <p className="text-[9px] text-gray-400 font-semibold truncate">{l}</p>
            <p className={`text-[13px] font-bold tabular-nums ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3`}>
        <div className="flex items-center justify-between mb-2">
          <p className={LABEL}>Each run</p>
          <label className="flex items-center gap-1 text-[10px] text-gray-500">
            vs
            <select
              value={vs || ''}
              onChange={(e) => setVs(e.target.value || null)}
              className="text-[10px] font-semibold border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-transparent dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">{indexLbl}</option>
              {stocks
                .filter((x) => x.symbol !== s.symbol)
                .map((x) => (
                  <option key={x.symbol} value={x.symbol}>
                    {x.symbol}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="flex gap-3 text-[9px] text-gray-400 mb-1.5">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded bg-blue-500" />
            {s.symbol}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded bg-gray-400" />
            {vsLbl}
          </span>
        </div>
        {pairs.map((p) => (
          <div
            key={p.name}
            className="grid grid-cols-[3.5rem_1fr_4.2rem] items-center gap-2 py-0.5"
          >
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{p.name}</span>
            <span
              className="flex flex-col gap-0.5"
              title={`${s.symbol} ${fmtPct(p.a)} · ${vsLbl} ${fmtPct(p.b)}`}
            >
              <span
                className={`block h-1.5 rounded-full ${p.a == null ? '' : p.a >= 0 ? 'bg-blue-500' : 'bg-blue-500/40'}`}
                style={{ width: `${p.a == null ? 0 : Math.max(2, (Math.abs(p.a) / max) * 100)}%` }}
              />
              <span
                className={`block h-1.5 rounded-full ${p.b == null ? '' : p.b >= 0 ? 'bg-gray-400' : 'bg-gray-400/40'}`}
                style={{ width: `${p.b == null ? 0 : Math.max(2, (Math.abs(p.b) / max) * 100)}%` }}
              />
            </span>
            <span
              className={`text-right text-[10px] font-bold tabular-nums ${
                p.a == null || p.b == null
                  ? 'text-gray-400'
                  : p.a > p.b
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {p.a == null || p.b == null
                ? 'no data'
                : `${p.a > p.b ? 'won' : 'lost'} ${Math.abs(p.a - p.b).toFixed(1)}`}
            </span>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3`}>
        <p className={`${LABEL} mb-1`}>₹100 held through every run</p>
        <Ladder a={s.per_wave} b={vsRets} names={names} dark={dark} />
        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
          <span>
            <span className="inline-block w-2.5 h-1 rounded bg-blue-500 mr-1 align-middle" />
            {s.symbol} →{' '}
            <b className="text-gray-800 dark:text-gray-100">
              ₹{Math.round(ga[ga.length - 1]).toLocaleString()}
            </b>
          </span>
          <span>
            <span className="inline-block w-2.5 h-1 rounded bg-gray-400 mr-1 align-middle" />
            {vsLbl} →{' '}
            <b className="text-gray-800 dark:text-gray-100">
              ₹{Math.round(gb[gb.length - 1]).toLocaleString()}
            </b>
          </span>
        </div>
        <p className={`${LABEL} normal-case mt-1.5`}>
          Only the runs themselves, not the time between them · history, not a promise
        </p>
      </div>
    </div>
  )
}
