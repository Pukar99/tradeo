// === SectorMatrix — extracted verbatim from BreakdownPage.jsx (S2b Task 1, zero behavior change) ===
import { useState } from 'react'
import { pnlClass } from '../../../utils/format'
import { CARD, LABEL, STITLE, Skeleton } from '../../datalab/shared'
import { stripIndexName, pctTextCls, gradColor } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR MATRIX — visual replacement of the old sector table
// ─────────────────────────────────────────────────────────────────────────────
export function SectorMatrix({
  rows,
  activeSectorName,
  onRowClick,
  cycleType,
  sortBy,
  sortAsc,
  onSort,
  maxMoveAbs,
}) {
  const isBull = cycleType === 'bull'

  const Glyph = ({ col, label, w }) => (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 ${LABEL} normal-case hover:text-gray-600 dark:hover:text-gray-300`}
      style={{ width: w }}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-60">{sortBy === col ? (sortAsc ? '▲' : '▼') : '·'}</span>
    </button>
  )

  return (
    <div className={`${CARD} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
        <Glyph col="index_name" label="Sector" w={150} />
        <Glyph col="drop_pct" label={isBull ? 'Gain' : 'Drop'} w={170} />
        <Glyph col="vs_nepse" label="vs Index" w={70} />
        {!isBull && <Glyph col="recovery_progress" label="Recovery" w={120} />}
        {!isBull && <Glyph col="recovery_days" label="Days" w={50} />}
        <Glyph col="stock_count" label="#" w={36} />
      </div>

      {/* Rows */}
      <div>
        {rows.map((s, i) => {
          const isActive = activeSectorName === s.index_name
          const isNepse = s.index_name === 'NEPSE'
          const moveAbs = Math.abs(s.drop_pct || 0)
          const barW = maxMoveAbs > 0 ? (moveAbs / maxMoveAbs) * 100 : 0
          // x in [-1,1] for continuous gradient: clip at ±50% magnitude
          const x = Math.max(-1, Math.min(1, (s.drop_pct || 0) / 50))
          const barColor = gradColor(x)
          return (
            <div
              key={s.index_name}
              onClick={() => onRowClick(s)}
              className={`flex items-center px-3 py-2 border-b border-gray-50 dark:border-gray-800/60 cursor-pointer transition-colors last:border-b-0
                ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/30'
                    : i % 2 === 1
                      ? 'bg-gray-50/60 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/40'
                      : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                }`}
            >
              {/* Sector */}
              <div className="flex items-center gap-2" style={{ width: 150 }}>
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: barColor }}
                />
                <span
                  className={`text-[11px] ${isNepse ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-100'} truncate`}
                >
                  {isNepse ? 'NEPSE' : stripIndexName(s.index_name)}
                </span>
              </div>

              {/* Move bar */}
              <div className="flex items-center gap-2" style={{ width: 170 }}>
                <div
                  className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0"
                  style={{ width: 90 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barW}%`, background: barColor }}
                  />
                </div>
                <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(s.drop_pct)}`}>
                  {s.drop_pct != null
                    ? `${s.drop_pct >= 0 ? '+' : ''}${s.drop_pct.toFixed(1)}%`
                    : '—'}
                </span>
              </div>

              {/* vs Index */}
              <div style={{ width: 70 }}>
                {s.vs_nepse != null ? (
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums
                    ${pnlClass(
                      s.vs_nepse,
                      'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
                      'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400'
                    )}`}
                  >
                    {s.vs_nepse >= 0 ? '+' : ''}
                    {s.vs_nepse.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                )}
              </div>

              {/* Recovery (bear only): horizontal progress bar — matches the move-bar style above
                  for visual consistency. Fully recovered = emerald solid; partial = amber. */}
              {!isBull && (
                <div className="flex items-center gap-2" style={{ width: 120 }}>
                  {s.recovery_progress != null ? (
                    <>
                      <div
                        className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0"
                        style={{ width: 70 }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, s.recovery_progress)}%`,
                            background: s.fully_recovered ? '#10b981' : '#f59e0b',
                          }}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-semibold tabular-nums ${s.fully_recovered ? 'text-emerald-500' : 'text-amber-500'}`}
                      >
                        {(s.recovery_progress || 0).toFixed(0)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                  )}
                </div>
              )}

              {/* Recovery days */}
              {!isBull && (
                <div style={{ width: 50 }}>
                  {s.fully_recovered && s.recovery_days != null ? (
                    <span className="text-[10px] text-emerald-500 font-semibold tabular-nums">
                      {s.recovery_days}d
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                  )}
                </div>
              )}

              {/* Stock count */}
              <div style={{ width: 36 }}>
                {s.stock_count == null ? null : (
                  <span className="text-[10px] text-gray-400 tabular-nums">{s.stock_count}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK LIST — used inline inside the right panel (sector zoom)
// ─────────────────────────────────────────────────────────────────────────────
export function StockList({ stocks, loading, onSelect, selected }) {
  const [sortBy, setSortBy] = useState('drop_pct')
  const [sortAsc, setSortAsc] = useState(true)

  // New column starts descending — same convention as the sector matrix sort
  const toggleSort = (col) => {
    if (sortBy === col) setSortAsc((a) => !a)
    else {
      setSortBy(col)
      setSortAsc(false)
    }
  }

  if (loading) return <Skeleton minH={140} />
  if (stocks === undefined) return null
  const valid = (stocks || []).filter((s) => s.drop_pct != null)
  if (!stocks?.length)
    return (
      <div className="flex flex-col items-center justify-center py-5 gap-1 text-center px-4">
        <span className="text-[11px] text-gray-400">No stocks found for this sector.</span>
      </div>
    )
  if (!valid.length)
    return (
      <div className="flex items-center justify-center py-5 text-[11px] text-gray-400">
        {stocks.length} stocks · no price data for this period
      </div>
    )

  const sorted = [...valid].sort((a, b) => {
    const av = a[sortBy] ?? 0,
      bv = b[sortBy] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const SortTh = ({ col, label, right }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {label}
      {sortBy === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-10">
          <tr>
            <SortTh col="symbol" label="Symbol" />
            <SortTh col="drop_pct" label="Move" right />
            <SortTh col="recovery_progress" label="Rec" right />
            <SortTh col="recovery_days" label="Days" right />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr
              key={s.symbol}
              onClick={() => onSelect(selected?.symbol === s.symbol ? null : s)}
              className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors
                ${
                  selected?.symbol === s.symbol
                    ? 'bg-blue-50 dark:bg-blue-950/30'
                    : i % 2 === 1
                      ? 'bg-gray-50/80 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                      : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/60'
                }`}
            >
              <td className="px-2 py-1.5">
                <span className={STITLE}>{s.symbol}</span>
                <div className="text-[10px] text-gray-400 truncate max-w-[120px]">
                  {s.company_name}
                </div>
              </td>
              <td className="px-2 py-1.5 text-right">
                <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(s.drop_pct)}`}>
                  {s.drop_pct >= 0 ? '+' : ''}
                  {s.drop_pct?.toFixed(1)}%
                </span>
              </td>
              <td className="px-2 py-1.5 text-right">
                <span className="text-[10px] text-gray-500 tabular-nums">
                  {(s.recovery_progress || 0).toFixed(0)}%
                </span>
              </td>
              <td className="px-2 py-1.5 text-right">
                {s.fully_recovered ? (
                  <span className="text-[10px] text-emerald-500 font-semibold tabular-nums">
                    {s.recovery_days}d
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
