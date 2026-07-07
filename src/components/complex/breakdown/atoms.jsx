// === atoms — extracted verbatim from BreakdownPage.jsx (S2b Task 1, zero behavior change) ===
import { memo } from 'react'
import { CARD, LABEL, SVAL } from '../../datalab/shared'
import { stripIndexName, phaseCls } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// RESILIENT TILE — compact, in right panel
// ─────────────────────────────────────────────────────────────────────────────
export function ResilientTile({ sectors }) {
  const recovered = sectors
    .filter((s) => s.fully_recovered && s.recovery_days != null)
    .sort((a, b) => a.recovery_days - b.recovery_days)
    .slice(0, 3)
  const hardest = sectors
    .filter((s) => s.drop_pct != null)
    .sort((a, b) => a.drop_pct - b.drop_pct)
    .slice(0, 3)
  if (!recovered.length && !hardest.length) return null

  return (
    <div className={`${CARD} p-3`}>
      {recovered.length > 0 && (
        <div className="mb-2">
          <p className={`${LABEL} mb-1`}>Fastest recovery</p>
          <div className="flex flex-wrap gap-1.5">
            {recovered.map((s) => (
              <span
                key={s.index_name}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {stripIndexName(s.index_name)} · {s.recovery_days}d
              </span>
            ))}
          </div>
        </div>
      )}
      {hardest.length > 0 && (
        <div>
          <p className={`${LABEL} mb-1`}>Hardest hit</p>
          <div className="flex flex-wrap gap-1.5">
            {hardest.map((s) => (
              <span
                key={s.index_name}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-[10px] font-semibold text-red-500 dark:text-red-400"
              >
                {stripIndexName(s.index_name)} · {s.drop_pct?.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE STATS TILE — fills right panel when no cycle is selected
// ─────────────────────────────────────────────────────────────────────────────
export function AggregateStats({ bearCycles, bullCycles }) {
  const bear =
    bearCycles.length > 0 &&
    (() => {
      const drops = bearCycles.map((c) => c.pct)
      const avgDrop = drops.reduce((s, v) => s + v, 0) / drops.length
      const worst = Math.min(...drops)
      const avgDur = bearCycles.reduce((s, c) => s + c.duration_days, 0) / bearCycles.length
      const withRecov = bearCycles.filter((c) => c.recovery_days)
      const avgRecov = withRecov.length
        ? Math.round(withRecov.reduce((s, c) => s + c.recovery_days, 0) / withRecov.length)
        : null
      return [
        { l: 'Avg drop', v: `${avgDrop.toFixed(1)}%`, red: true },
        { l: 'Worst', v: `${worst.toFixed(1)}%`, red: true },
        { l: 'Avg duration', v: `${Math.round(avgDur)}d` },
        { l: 'Avg recovery', v: avgRecov ? `${avgRecov}d` : '—', green: true },
        {
          l: 'Recovery rate',
          v: `${Math.round((withRecov.length / bearCycles.length) * 100)}%`,
          green: true,
        },
      ]
    })()

  const bull =
    bullCycles.length > 0 &&
    (() => {
      const gains = bullCycles.map((c) => c.pct)
      const avgGain = gains.reduce((s, v) => s + v, 0) / gains.length
      const best = Math.max(...gains)
      const avgDur = bullCycles.reduce((s, c) => s + c.duration_days, 0) / bullCycles.length
      return [
        { l: 'Avg gain', v: `+${avgGain.toFixed(1)}%`, green: true },
        { l: 'Best', v: `+${best.toFixed(1)}%`, green: true },
        { l: 'Avg duration', v: `${Math.round(avgDur)}d` },
      ]
    })()

  const bullPhases =
    bullCycles.length > 0
      ? {
          rally: bullCycles.filter((c) => c.phase === 'Rally').length,
          run: bullCycles.filter((c) => c.phase === 'Bull Run').length,
          major: bullCycles.filter((c) => c.phase === 'Major Bull').length,
        }
      : null

  const bearPhases =
    bearCycles.length > 0
      ? {
          correction: bearCycles.filter((c) => c.phase === 'Correction').length,
          bear: bearCycles.filter((c) => c.phase === 'Bear Market').length,
          crash: bearCycles.filter((c) => c.phase === 'Crash').length,
        }
      : null

  return (
    <div className="space-y-3">
      <div className={`${CARD} p-3`}>
        <p className={`${LABEL} text-gray-400 mb-1.5`}>Select a cycle</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          Click a pill on the left or a shaded band on the overview chart to see sector-level
          breakdown.
        </p>
      </div>

      {bear && (
        <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className={`${LABEL} text-red-400`}>Bear Cycles</p>
            <p className="text-xl font-black text-red-500 tabular-nums leading-none">
              {bearCycles.length}
            </p>
          </div>
          <div className="space-y-1 mb-2">
            {bear.map(({ l, v, red, green }) => (
              <div key={l} className="flex justify-between text-[10px]">
                <span className="text-gray-400">{l}</span>
                <span
                  className={`font-semibold ${red ? 'text-red-500' : green ? 'text-emerald-500' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
          {bearPhases && (
            <div className="flex gap-1 pt-2 border-t border-red-200/50 dark:border-red-900/40">
              <PhaseChip
                label="Correction"
                n={bearPhases.correction}
                cls="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
              />
              <PhaseChip
                label="Bear"
                n={bearPhases.bear}
                cls="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
              />
              <PhaseChip
                label="Crash"
                n={bearPhases.crash}
                cls="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
              />
            </div>
          )}
        </div>
      )}

      {bull && (
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className={`${LABEL} text-emerald-400`}>Bull Cycles</p>
            <p className="text-xl font-black text-emerald-500 tabular-nums leading-none">
              {bullCycles.length}
            </p>
          </div>
          <div className="space-y-1 mb-2">
            {bull.map(({ l, v, green }) => (
              <div key={l} className="flex justify-between text-[10px]">
                <span className="text-gray-400">{l}</span>
                <span
                  className={`font-semibold ${green ? 'text-emerald-500' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
          {bullPhases && (
            <div className="flex gap-1 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/40">
              <PhaseChip
                label="Rally"
                n={bullPhases.rally}
                cls="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
              />
              <PhaseChip
                label="Bull"
                n={bullPhases.run}
                cls="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              />
              <PhaseChip
                label="Major"
                n={bullPhases.major}
                cls="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE RAIL — compact 2-line pills
// ─────────────────────────────────────────────────────────────────────────────
export function CyclePill({ cycle, active, onClick, selected }) {
  const isBear = cycle.type === 'bear'
  const phaseTone = phaseCls(cycle.phase)
  // Optional leading select-mark (multi-select checklist, S2b). When `selected`
  // is undefined the mark is omitted — the pill looks exactly as before.
  const mark = selected === undefined ? null : selected ? '✓' : '○'
  return (
    <button
      onClick={onClick}
      title={`${cycle.phase} · ${cycle.start_date} → ${cycle.end_date} · ${cycle.duration_days}d`}
      className={`w-full text-left px-3 py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 transition-colors
        ${
          active
            ? isBear
              ? 'bg-red-50 dark:bg-red-950/30'
              : 'bg-emerald-50 dark:bg-emerald-950/30'
            : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
        }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[10px] font-bold ${isBear ? 'text-red-500' : 'text-emerald-500'}`}>
          {mark && (
            <span
              className={`mr-1 ${selected ? (isBear ? 'text-red-500' : 'text-emerald-500') : 'text-gray-300 dark:text-gray-600'}`}
            >
              {mark}
            </span>
          )}
          {isBear ? '▼' : '▲'} {cycle.name || (isBear ? 'Bear' : 'Bull')}
        </span>
        <span
          className={`text-[10px] font-black tabular-nums ${isBear ? 'text-red-500' : 'text-emerald-500'}`}
        >
          {cycle.pct >= 0 ? '+' : ''}
          {cycle.pct?.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-500 dark:text-gray-400">
          <span className="font-mono text-gray-400">{cycle.start_date?.slice(0, 4)}</span> ·{' '}
          {cycle.duration_days}d
          {isBear &&
            (cycle.recovery_date ? (
              <span className="text-emerald-500"> · Rec {cycle.recovery_days}d</span>
            ) : (
              <span className="text-amber-500"> · Open</span>
            ))}
        </span>
        <span className={`px-1 rounded-sm text-[10px] font-semibold ${phaseTone}`}>
          {cycle.phase}
        </span>
      </div>
    </button>
  )
}

// Memoized index selector
export const IndexSelector = memo(function IndexSelector({ options, activeId, onSelect }) {
  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
            opt.id === activeId
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {opt.short}
        </button>
      ))}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Small phase-count chip used by AggregateStats
// ─────────────────────────────────────────────────────────────────────────────
export function PhaseChip({ label, n, cls }) {
  return (
    <span
      className={`flex-1 inline-flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{n}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small stat cell
// ─────────────────────────────────────────────────────────────────────────────
export function Stat({ l, v, tone = 'gray' }) {
  const toneCls =
    tone === 'green'
      ? 'text-emerald-500'
      : tone === 'red'
        ? 'text-red-500'
        : tone === 'amber'
          ? 'text-amber-500'
          : 'text-gray-700 dark:text-gray-200'
  return (
    <div className="flex-1 px-2 first:pl-0 last:pr-0">
      <p className={`${LABEL} mb-0.5`}>{l}</p>
      <p className={`${SVAL} ${toneCls}`}>{v}</p>
    </div>
  )
}
