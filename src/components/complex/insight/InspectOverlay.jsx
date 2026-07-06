// === insight/InspectOverlay.jsx — full-page 3-column inspect (Chart · Sectors · Stocks) ===
import { useState, useEffect, useMemo } from 'react'
import { MONTHS as MONTHS_EN, MONTHS_FULL } from '../../../utils/constants'
import { isCanceled } from '../../../utils/format'
import { useNavbarState } from '../../../App'
import { LABEL, SVAL, cellBg, cellFg, fmtPct, scopeSectors } from './helpers'
import { useMonthDetail, sectorStocksCache, fetchSectorStocks } from './useMonthDetail'
import { MonthChart, StockMiniChartPopover } from './charts'
import { SectorRow, StockRow, HistoricalRank } from './rows'

// ─── Sectors column — middle column of inspect overlay ───────────────────────
function SectorsColumn({ sectors, sectorHistory, activeSector, onSectorClick, year, month }) {
  const maxAbs = sectors?.length
    ? Math.max(...sectors.map((s) => Math.abs(s.return_pct ?? 0)), 0.1)
    : 1
  // Top/Bottom comparison only when there's something to compare (scoped
  // sub-index views show a single sector)
  const best = sectors?.length > 1 ? sectors[0] : null
  const worst = sectors?.length > 1 ? sectors[sectors.length - 1] : null

  if (!sectors?.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] text-gray-400">
        No sector data for {MONTHS_FULL[month - 1]} {year}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: best/worst chips */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-gray-100 dark:border-gray-800 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={LABEL}>
            {sectors.length > 1 ? `Sectors · ${sectors.length}` : 'Sector'}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-500">click for stocks</span>
        </div>

        {best && worst && (
          <div className="flex gap-1.5">
            <button
              onClick={() => best.name && onSectorClick({ name: best.name, label: best.label })}
              className="flex-1 flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
            >
              <div className="min-w-0 text-left">
                <div className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest leading-none">
                  Top
                </div>
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 truncate leading-tight">
                  {(best.label || best.name || '').replace(' Sub-Index', '').replace(' Index', '')}
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-500 tabular-nums shrink-0">
                {fmtPct(best.return_pct)}
              </span>
            </button>
            <button
              onClick={() => worst.name && onSectorClick({ name: worst.name, label: worst.label })}
              className="flex-1 flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <div className="min-w-0 text-left">
                <div className="text-[9px] text-red-400 font-bold uppercase tracking-widest leading-none">
                  Bottom
                </div>
                <div className="text-[10px] font-bold text-red-700 dark:text-red-400 truncate leading-tight">
                  {(worst.label || worst.name || '')
                    .replace(' Sub-Index', '')
                    .replace(' Index', '')}
                </div>
              </div>
              <span className="text-[10px] font-black text-red-500 tabular-nums shrink-0">
                {fmtPct(worst.return_pct)}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Sector list — all sectors, scrolls */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain bg-white dark:bg-gray-900">
        {sectors.map((s, i) => (
          <SectorRow
            key={s.index_id}
            s={s}
            index={i}
            isActive={activeSector?.name === s.name}
            isBest={best && s.name === best.name}
            isWorst={worst && s.name === worst.name}
            history={sectorHistory?.[s.name] || []}
            maxAbs={maxAbs}
            onClick={onSectorClick}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Stocks column — right column of inspect overlay ─────────────────────────
function StocksColumn({ sector, year, month, onStockClick, activeStockSymbol }) {
  const [stocks, setStocks] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('return')

  useEffect(() => {
    if (!sector?.name || !year || !month) {
      setStocks(null)
      return
    }
    setQuery('')
    setSort('return')
    // Shared cache with InlineSectorStocks — maximizing after inline browsing is free
    const c = sectorStocksCache.get(`${sector.name}:${year}:${month}`)
    if (c) {
      setStocks(c)
      setLoading(false)
      setError(null)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setStocks(null)
    setError(null)
    fetchSectorStocks(sector.name, year, month, ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setStocks(data)
      })
      .catch((err) => {
        if (!ctrl.signal.aborted && !isCanceled(err)) setError('Failed to load stocks')
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [sector?.name, year, month])

  const filtered = useMemo(() => {
    let list = stocks || []
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) || (s.company_name || '').toLowerCase().includes(q)
      )
    }
    if (sort === 'symbol') list = [...list].sort((a, b) => a.symbol.localeCompare(b.symbol))
    return list
  }, [stocks, query, sort])

  const winners = (stocks || []).filter((s) => (s.return_pct ?? 0) > 0).length
  const losers = (stocks || []).filter((s) => (s.return_pct ?? 0) < 0).length
  const maxAbs = stocks?.length
    ? Math.max(...stocks.map((s) => Math.abs(s.return_pct ?? 0)), 0.1)
    : 1
  const shortName = sector
    ? sector.label ||
      (sector.name ? sector.name.replace(' Sub-Index', '').replace(' Index', '') : '')
    : ''

  if (!sector) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
        <svg
          className="w-10 h-10 text-gray-200 dark:text-gray-800"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <div className="text-[11px] text-gray-400 dark:text-gray-600">
          Click a sector to see
          <br />
          its stocks here
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
          Then click any stock for a<br />
          3-month price chart
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-gray-100 dark:border-gray-800 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className={LABEL}>Stocks · {shortName}</div>
            {stocks && (
              <div className="text-[10px] text-gray-400">
                {stocks.length} symbol{stocks.length !== 1 ? 's' : ''} · {MONTHS_FULL[month - 1]}{' '}
                {year}
              </div>
            )}
          </div>
          {stocks?.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                ▲ {winners}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-500">
                ▼ {losers}
              </span>
            </div>
          )}
        </div>

        {stocks?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <svg
                className="w-2.5 h-2.5 text-gray-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="flex-1 bg-transparent text-[10px] font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-gray-300 hover:text-gray-500 text-[12px] leading-none"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded p-0.5">
              {[
                ['return', '%'],
                ['symbol', 'A-Z'],
              ].map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setSort(v)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    sort === v
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stock rows */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain bg-white dark:bg-gray-900">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <div className="px-3 py-3 text-[10px] text-red-400">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-[10px] text-gray-400">
            {query ? `No stocks match "${query}"` : 'No stock data for this period'}
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div>
            {filtered.map((s, i) => (
              <StockRow
                key={s.symbol}
                s={s}
                index={i}
                maxAbs={maxAbs}
                isActive={activeStockSymbol === s.symbol}
                onClick={onStockClick}
              />
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 px-3 py-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[10px] text-gray-500 dark:text-gray-500">
          Click any stock → 3-month chart
        </span>
      </div>
    </div>
  )
}

// ─── Chart column — left column of inspect overlay ───────────────────────────
function ChartStatsColumn({ cell, candles, stats, available, dark, allYears, loading, dataError }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (dataError) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <div className="text-[11px] text-red-400 font-medium">{dataError}</div>
      </div>
    )
  }
  if (!available) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <div className="text-3xl">📂</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
          Daily chart data is available from 2021 onward.
          <br />
          Heatmap value above is from historical records.
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Chart — generous height since it has full column width */}
      <div className="shrink-0 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 dark:border-gray-800/60">
          <span className={LABEL}>Daily Candles</span>
          {stats?.trading_days && (
            <span className="text-[10px] text-gray-400">{stats.trading_days} days</span>
          )}
        </div>
        <div style={{ height: 360 }}>
          {candles?.length ? (
            <MonthChart candles={candles} dark={dark} />
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] text-gray-400">
              No candle data
            </div>
          )}
        </div>
      </div>

      {/* OHLC 2×2 */}
      {stats && (
        <div className="shrink-0 p-3 border-b border-gray-100 dark:border-gray-800">
          <div className={`${LABEL} mb-1.5`}>OHLC</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['Open', stats.month_open?.toFixed(1), null],
              [
                'Close',
                stats.month_close?.toFixed(1),
                (stats.month_return ?? 0) >= 0 ? '#22c55e' : '#ef4444',
              ],
              ['High', stats.month_high?.toFixed(1), '#22c55e'],
              ['Low', stats.month_low?.toFixed(1), '#ef4444'],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1.5">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">{l}</div>
                <div
                  className="text-[13px] font-black tabular-nums"
                  style={{ color: c || (dark ? '#e2e8f0' : '#1e293b') }}
                >
                  {v ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary 3-tile */}
      {stats && (
        <div className="shrink-0 px-3 pt-2 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              [
                'Return',
                fmtPct(stats.month_return, 2),
                (stats.month_return ?? 0) >= 0 ? '#22c55e' : '#ef4444',
              ],
              ['Range', stats.range_pct != null ? fmtPct(stats.range_pct) : '—', null],
              ['Days', stats.trading_days ?? '—', null],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                <div className={LABEL}>{l}</div>
                <div className={SVAL} style={{ color: c || (dark ? '#e2e8f0' : '#1e293b') }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best/Worst day */}
      {stats && (stats.best_day || stats.worst_day) && (
        <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className={`${LABEL} mb-1.5`}>Day extremes</div>
          <div className="space-y-1">
            {stats.best_day && (
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500">Best</span>
                <span className="font-bold text-green-500 tabular-nums">
                  {stats.best_day.date.slice(5)} · {fmtPct(stats.best_day.pct)}
                </span>
              </div>
            )}
            {stats.worst_day && (
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500">Worst</span>
                <span className="font-bold text-red-400 tabular-nums">
                  {stats.worst_day.date.slice(5)} · {fmtPct(stats.worst_day.pct)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical Rank */}
      {cell.value != null && (
        <div className="shrink-0 px-3 py-2">
          <HistoricalRank value={cell.value} allYears={allYears} month={cell.month} />
        </div>
      )}
    </div>
  )
}

// ─── Inspect Overlay — full-page 3-column view (Chart · Sectors · Stocks) ────
export default function InspectOverlay({
  cell,
  onClose,
  onNavigate,
  onJump,
  dark,
  allYears,
  indexId,
  onMinimize,
  activeSector,
  setActiveSector,
}) {
  const { loading, candles, stats, sectors, available, dataError, sectorHistory } = useMonthDetail(
    cell,
    indexId
  )
  const [stockPop, setStockPop] = useState(null) // { symbol, rect }
  // Track navbar visibility — a hard top-[56px] left a gap once the navbar auto-hid
  const { active: navAutoHide, hidden: navHidden } = useNavbarState()

  // Close the stock popover when the viewed month or index changes
  useEffect(() => {
    setStockPop(null)
  }, [cell?.year, cell?.month, indexId])

  // Keyboard: Esc closes, ← → navigate months
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onNavigate(-1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNavigate(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNavigate])

  if (!cell) return null

  const bg = cellBg(cell.value, dark)
  const fg = cellFg(cell.value, dark)
  const scoped = scopeSectors(sectors, indexId)

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-white dark:bg-gray-950 flex flex-col"
      style={{ top: navAutoHide && !navHidden ? 56 : 0 }}
    >
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="w-3 h-3 rounded shrink-0" style={{ background: bg }} />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
            {MONTHS_FULL[cell.month - 1]} {cell.year}
          </div>
          <div className="text-2xl font-black leading-tight" style={{ color: fg }}>
            {fmtPct(cell.value, 2)}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => onNavigate(-1)}
          title="Previous month (←)"
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={() => onNavigate(1)}
          title="Next month (→)"
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Next →
        </button>
        <button
          onClick={onMinimize}
          title="Minimize back to side panel"
          className="ml-1 flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          Minimize
        </button>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-lg leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {/* ── Year + Month jumper strip ── */}
      {onJump && allYears?.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40 overflow-x-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">
            Year
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {[...allYears]
              .sort((a, b) => b.year - a.year)
              .map((y) => (
                <button
                  key={y.year}
                  onClick={() => {
                    // Try same month in the target year, fallback to latest with data
                    const target =
                      y.months[cell.month - 1] != null
                        ? cell.month
                        : [...y.months].reverse().findIndex((v) => v != null) >= 0
                          ? 12 - [...y.months].reverse().findIndex((v) => v != null)
                          : 1
                    onJump(y.year, target)
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                    cell.year === y.year
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                  }`}
                >
                  {y.year}
                </button>
              ))}
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">
            Month
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            {MONTHS_EN.map((m, i) => {
              const yr = allYears.find((y) => y.year === cell.year)
              const val = yr?.months?.[i]
              const disabled = val == null
              return (
                <button
                  key={i}
                  onClick={() => !disabled && onJump(cell.year, i + 1)}
                  disabled={disabled}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                    cell.month === i + 1
                      ? 'bg-blue-600 text-white'
                      : disabled
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 3-column body ── */}
      <div className="flex-1 flex min-h-0">
        {/* Column 1 — Chart + stats (35%) */}
        <div className="w-[35%] min-w-[340px] border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-0">
          <ChartStatsColumn
            cell={cell}
            candles={candles}
            stats={stats}
            available={available}
            dark={dark}
            allYears={allYears}
            loading={loading}
            dataError={dataError}
          />
        </div>

        {/* Column 2 — Sectors (35%) */}
        <div className="w-[35%] min-w-[300px] border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-0">
          {!loading && !dataError && available && (
            <SectorsColumn
              sectors={scoped}
              sectorHistory={sectorHistory}
              activeSector={activeSector}
              onSectorClick={(s) => {
                setActiveSector(s)
                setStockPop(null)
              }}
              year={cell.year}
              month={cell.month}
            />
          )}
        </div>

        {/* Column 3 — Stocks (30%) */}
        <div className="flex-1 min-w-[280px] bg-white dark:bg-gray-900 flex flex-col min-h-0">
          {!loading && !dataError && available && (
            <StocksColumn
              sector={activeSector}
              year={cell.year}
              month={cell.month}
              dark={dark}
              activeStockSymbol={stockPop?.symbol}
              onStockClick={(symbol, rect) => setStockPop({ symbol, rect })}
            />
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="text-[10px] text-gray-500 dark:text-gray-500">
          ← → navigate months · Esc close · click sector → stocks · click stock → 3-mo chart
        </span>
      </div>

      {/* Stock mini-chart popover */}
      {stockPop && (
        <StockMiniChartPopover
          symbol={stockPop.symbol}
          anchorRect={stockPop.rect}
          onClose={() => setStockPop(null)}
          dark={dark}
        />
      )}
    </div>
  )
}
