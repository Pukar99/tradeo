// === insight/rows.jsx — shared row/bar primitives (sector, stock, annual, rank) ===
import { MONTHS_FULL } from '../../../utils/constants'
import { LABEL, sectorCol, fmtPct } from './helpers'
import { SectorMomentumSpark } from './charts'

// ─── Sector diverging bar ─────────────────────────────────────────────────────
export function SectorBar({ name, ret, maxAbs }) {
  const color = sectorCol(ret)
  const w = maxAbs > 0 ? (Math.abs(ret ?? 0) / maxAbs) * 48 : 0
  const isPos = (ret ?? 0) >= 0
  const short = name.replace(' Sub-Index', '').replace(' Index', '')
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 dark:text-gray-400 w-20 shrink-0 truncate">
        {short}
      </span>
      <div className="flex flex-1 items-center" style={{ height: 10 }}>
        <div className="flex-1 flex justify-end">
          {!isPos && (
            <div className="h-2 rounded-l-sm" style={{ width: `${w}%`, background: color }} />
          )}
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />
        <div className="flex-1 flex justify-start">
          {isPos && (
            <div className="h-2 rounded-r-sm" style={{ width: `${w}%`, background: color }} />
          )}
        </div>
      </div>
      <span className="text-[10px] font-bold w-11 text-right shrink-0" style={{ color }}>
        {fmtPct(ret)}
      </span>
    </div>
  )
}

// ─── Historical rank bar ──────────────────────────────────────────────────────
export function HistoricalRank({ value, allYears, month }) {
  if (value == null || !allYears?.length) return null
  const hist = allYears
    .map((y) => y.months[month - 1])
    .filter((v) => v != null)
    .sort((a, b) => a - b)
  if (!hist.length) return null
  const rank = hist.filter((v) => v <= value).length
  const pct = Math.round((rank / hist.length) * 100)
  const color = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444'
  const min = hist[0]
  const max = hist[hist.length - 1]
  const pos = max !== min ? ((value - min) / (max - min)) * 100 : 50

  return (
    <div>
      <div className={`${LABEL} mb-1.5`}>Historical Rank ({MONTHS_FULL[month - 1]})</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
        Ranks{' '}
        <span className="font-bold" style={{ color }}>
          {rank}/{hist.length}
        </span>{' '}
        ({pct}th pct) · beats {Math.max(0, rank - 1)} of {hist.length - 1} other years
      </div>
      <div className="relative h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-visible mb-1">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pos}%`, background: color, opacity: 0.3 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm"
          style={{ left: `${pos}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{fmtPct(min)}</span>
        <span className="font-bold" style={{ color }}>
          {fmtPct(value)}
        </span>
        <span>{fmtPct(max)}</span>
      </div>
    </div>
  )
}

// ─── Shared sector row — used by SectorsColumn (overlay) + InlineRightPanel ──
export function SectorRow({
  s,
  index,
  isActive,
  isBest,
  isWorst,
  history,
  maxAbs,
  onClick,
  pad = 'px-3 py-2',
}) {
  return (
    <button
      onClick={() => s.name && onClick({ name: s.name, label: s.label })}
      disabled={!s.name}
      className={`w-full text-left flex items-center gap-2 ${pad} border-b border-gray-50 dark:border-gray-800/40 transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500'
          : index % 2 === 1
            ? 'bg-gray-50/60 dark:bg-gray-800/30 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
            : 'bg-white dark:bg-gray-900 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
      } ${s.name ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
    >
      <div className="flex-1 min-w-0">
        <SectorBar name={s.label || s.name} ret={s.return_pct} maxAbs={maxAbs} />
      </div>
      <SectorMomentumSpark values={history} />
      {(isBest || isWorst) && (
        <span
          className={`text-[9px] font-black px-1 py-px rounded shrink-0 ${
            isBest
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-900/40 text-red-500'
          }`}
        >
          {isBest ? 'TOP' : 'BOT'}
        </span>
      )}
    </button>
  )
}

// ─── Shared stock row — used by StocksColumn (overlay) + InlineSectorStocks ──
// `dense` renders the compact inline variant (no company name, thinner bars).
export function StockRow({ s, index, maxAbs, isActive, onClick, dense = false }) {
  const color = sectorCol(s.return_pct)
  const barW = maxAbs > 0 ? (Math.abs(s.return_pct ?? 0) / maxAbs) * 100 : 0
  const isPos = (s.return_pct ?? 0) >= 0
  const barH = dense ? 'h-1.5' : 'h-2'
  return (
    <button
      onClick={(e) => onClick(s.symbol, e.currentTarget.getBoundingClientRect())}
      className={
        dense
          ? `w-full text-left flex items-center gap-1.5 px-2 py-1 transition-colors ${
              isActive
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'hover:bg-blue-100/60 dark:hover:bg-blue-900/20'
            }`
          : `w-full text-left flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 dark:border-gray-800/40 transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500'
                : index % 2 === 1
                  ? 'bg-gray-50/60 dark:bg-gray-800/30 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                  : 'bg-white dark:bg-gray-900 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
            }`
      }
    >
      <span
        className={`text-[10px] text-gray-400 ${dense ? 'w-4' : 'dark:text-gray-600 w-5'} shrink-0 tabular-nums`}
      >
        {index + 1}
      </span>
      {dense ? (
        <span className="text-[10px] font-bold dark:text-gray-100 w-14 shrink-0 truncate">
          {s.symbol}
        </span>
      ) : (
        <div className="min-w-0 w-20 shrink-0">
          <div className="text-[10px] font-black text-gray-800 dark:text-gray-100 leading-tight truncate">
            {s.symbol}
          </div>
          {s.company_name && (
            <div className="text-[10px] text-gray-400 truncate leading-tight">{s.company_name}</div>
          )}
        </div>
      )}
      <div className="flex flex-1 items-center min-w-0" style={{ height: dense ? 8 : 10 }}>
        <div className="flex-1 flex justify-end">
          {!isPos && (
            <div
              className={`${barH} rounded-l-sm`}
              style={{ width: `${barW}%`, background: color }}
            />
          )}
        </div>
        <div
          className={`w-px ${dense ? 'h-2' : 'h-3'} bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5`}
        />
        <div className="flex-1 flex justify-start">
          {isPos && (
            <div
              className={`${barH} rounded-r-sm`}
              style={{ width: `${barW}%`, background: color }}
            />
          )}
        </div>
      </div>
      <span
        className={`text-[10px] font-bold tabular-nums ${dense ? 'w-11' : 'w-14'} text-right shrink-0`}
        style={{ color }}
      >
        {fmtPct(s.return_pct)}
      </span>
    </button>
  )
}

// ─── Annual bar ────────────────────────────────────────────────────────────────
export function AnnualBar({ year, annual, isRecent, isLatest }) {
  const maxVal = 80
  const clamped = Math.min(Math.max(annual ?? 0, -maxVal), maxVal)
  const w = (Math.abs(clamped) / maxVal) * 100
  const isPos = (annual ?? 0) >= 0
  const color = isPos
    ? isLatest
      ? '#22c55e'
      : isRecent
        ? '#4ade80'
        : '#86efac'
    : isLatest
      ? '#ef4444'
      : isRecent
        ? '#f87171'
        : '#fca5a5'
  const opacity = isLatest ? 1 : isRecent ? 0.9 : 0.65
  return (
    <div className="flex items-center gap-1.5" style={{ opacity }}>
      <span
        className={`text-[10px] font-bold w-8 shrink-0 text-right ${
          isLatest
            ? 'text-blue-500'
            : isRecent
              ? 'text-gray-700 dark:text-gray-300'
              : 'text-gray-400 dark:text-gray-600'
        }`}
      >
        {year}
      </span>
      <div className="flex-1 flex items-center h-3.5 relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
        {isPos ? (
          <div
            className="absolute left-1/2 h-2 rounded-r-sm"
            style={{ width: `${w / 2}%`, background: color }}
          />
        ) : (
          <div
            className="absolute right-1/2 h-2 rounded-l-sm"
            style={{ width: `${w / 2}%`, background: color }}
          />
        )}
      </div>
      <span className="text-[10px] font-bold w-11 text-right shrink-0" style={{ color }}>
        {fmtPct(annual)}
      </span>
    </div>
  )
}
