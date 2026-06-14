// === insight/InlineRightPanel.jsx — compact cell-detail panel + inline sector→stocks ===
import { useState, useEffect, useRef, useMemo } from 'react'
import { MONTHS_FULL } from '../../../utils/constants'
import { isCanceled } from '../../../utils/format'
import { LABEL, cellBg, cellFg, fmtPct, sectorCol, scopeSectors } from './helpers'
import { useMonthDetail, sectorStocksCache, fetchSectorStocks } from './useMonthDetail'
import { MonthChart, StockMiniChartPopover, SectorMomentumSpark } from './charts'
import { SectorRow, StockRow, HistoricalRank } from './rows'

// ─── Inline Right Panel — compact, always open beside heatmap ────────────────
// Single scroll; sections stack vertically: header → chart → stats → day extremes →
// sectors → historical rank. Click a sector → its stocks expand inline directly
// below (no separate drill view). Click stock → mini-chart popover.
export default function InlineRightPanel({
  cell,
  onClose,
  onNavigate,
  dark,
  allYears,
  indexId,
  // null in stock mode — the 3-column overlay is sector-centric, so Maximize is hidden
  onMaximize,
  // set → stock mode: month detail comes from stock-month-detail, sectors are skipped
  symbol = null,
  // shared with InspectOverlay so the selection sticks across maximize / minimize:
  activeSector,
  setActiveSector,
}) {
  const { loading, candles, stats, sectors, available, dataError, sectorHistory } = useMonthDetail(
    cell,
    indexId,
    symbol
  )
  const [stockPop, setStockPop] = useState(null) // { symbol, rect }

  // Close the stock popover when the viewed month or index changes
  useEffect(() => {
    setStockPop(null)
  }, [cell?.year, cell?.month, indexId])

  // Drill-in sectors card: bring it into view ONLY on a user click — never on
  // auto-focus (sub-index default sector), which would yank the panel away
  // from the chart on every cell selection.
  const sectorsCardRef = useRef(null)
  const drillScrollRef = useRef(false)
  useEffect(() => {
    if (drillScrollRef.current) {
      sectorsCardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      drillScrollRef.current = false
    }
  }, [activeSector])

  if (!cell) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
        <svg
          className="w-10 h-10 text-gray-200 dark:text-gray-800"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.5} />
          <line x1="3" y1="9" x2="21" y2="9" strokeWidth={1.5} />
          <line x1="9" y1="21" x2="9" y2="9" strokeWidth={1.5} />
        </svg>
        <div className="text-[11px] text-gray-400 dark:text-gray-600">
          Click a heatmap cell to see
          <br />
          chart, sectors, and stocks
        </div>
      </div>
    )
  }

  const bg = cellBg(cell.value, dark)
  const fg = cellFg(cell.value, dark)
  // Sub-index selected → only its own sector; NEPSE/Sensitive/N20 → all sectors.
  // TOP/BOT only make sense when comparing more than one sector.
  const scoped = scopeSectors(sectors, indexId)
  const sectorMaxAbs = scoped?.length
    ? Math.max(...scoped.map((s) => Math.abs(s.return_pct ?? 0)), 0.1)
    : 1
  const best = scoped?.length > 1 ? scoped[0] : null
  const worst = scoped?.length > 1 ? scoped[scoped.length - 1] : null

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div
          className="w-4 h-4 rounded-sm shrink-0 border border-gray-200 dark:border-gray-700"
          style={{ background: bg }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none truncate">
            {symbol && <span className="text-blue-500">{symbol} · </span>}
            {MONTHS_FULL[cell.month - 1]} {cell.year}
          </div>
          <div className="text-lg font-black leading-tight" style={{ color: fg }}>
            {fmtPct(cell.value, 2)}
          </div>
        </div>
        {/* Tap targets: 28px on lg+ where the panel is fixed-width (space-constrained);
            44px below lg (mobile full-page detail) per WCAG 2.5.5. */}
        <button
          onClick={() => onNavigate(-1)}
          title="Previous month (←)"
          aria-label="Previous month"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-[14px] lg:text-[12px]"
        >
          ‹
        </button>
        <button
          onClick={() => onNavigate(1)}
          title="Next month (→)"
          aria-label="Next month"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-[14px] lg:text-[12px]"
        >
          ›
        </button>
        <div className="hidden lg:block w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />
        {/* Maximize hidden below lg — the 3-column InspectOverlay needs ≥920px */}
        {onMaximize && (
          <button
            onClick={onMaximize}
            title="Maximize — full inspect view"
            aria-label="Maximize view"
            className="shrink-0 w-7 h-7 hidden lg:flex items-center justify-center rounded-md border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
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
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        )}
        <button
          onClick={onClose}
          title="Clear (Esc)"
          aria-label="Close detail panel"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-[20px] lg:text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* ── Body — single scroll on a subdued surface so cards pop.
          overscroll-contain prevents wheel-scroll leaks. Thin styled scrollbar
          makes the affordance visible (default browser hides until scroll). */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-950/70 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
        {loading && (
          <div className="flex h-32 items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && dataError && (
          <div className="p-4 text-center text-[11px] text-red-400 font-medium">{dataError}</div>
        )}
        {!loading && !dataError && !available && (
          <div className="p-4 text-center">
            <div className="text-2xl mb-2">📂</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
              {symbol ? (
                <>
                  No daily data for {symbol} in {MONTHS_FULL[cell.month - 1]} {cell.year}.
                </>
              ) : (
                <>
                  Daily chart data available from 2021 onward.
                  <br />
                  Heatmap value above is from historical records.
                </>
              )}
            </div>
          </div>
        )}

        {!loading && !dataError && available && (
          <div className="p-3 space-y-2.5">
            {/* Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800/80 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className={LABEL}>Daily Candles</span>
                {stats?.trading_days && (
                  <span className="text-[10px] text-gray-400">{stats.trading_days} days</span>
                )}
              </div>
              <div style={{ height: 220 }}>
                {candles?.length ? (
                  <MonthChart candles={candles} dark={dark} />
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] text-gray-400">
                    No candle data
                  </div>
                )}
              </div>
            </div>

            {/* Stat strip: O H L C Range Days */}
            {stats && (
              <div className="grid grid-cols-6 bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800/80 shadow-sm divide-x divide-gray-100 dark:divide-gray-800">
                {[
                  ['Open', stats.month_open?.toFixed(1), null],
                  ['High', stats.month_high?.toFixed(1), '#22c55e'],
                  ['Low', stats.month_low?.toFixed(1), '#ef4444'],
                  ['Close', stats.month_close?.toFixed(1), null],
                  ['Range', stats.range_pct != null ? fmtPct(stats.range_pct) : '—', null],
                  ['Days', stats.trading_days ?? '—', null],
                ].map(([l, v, c]) => (
                  <div key={l} className="px-1.5 py-1.5 flex flex-col items-center justify-center">
                    <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest leading-none">
                      {l}
                    </div>
                    <div
                      className="text-[10px] font-black tabular-nums leading-tight mt-0.5"
                      style={{ color: c || (dark ? '#e2e8f0' : '#1e293b') }}
                    >
                      {v ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Return tile + Best/Worst day */}
            {stats && (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                  <div className={LABEL}>Return</div>
                  <div
                    className="text-[15px] font-black tabular-nums leading-tight mt-0.5"
                    style={{ color: (stats.month_return ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {fmtPct(stats.month_return, 2)}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                  <div className={LABEL}>Day extremes</div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {stats.best_day && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">▲</span>
                        <span className="font-bold text-green-500 tabular-nums">
                          {stats.best_day.date.slice(5)} {fmtPct(stats.best_day.pct)}
                        </span>
                      </div>
                    )}
                    {stats.worst_day && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">▼</span>
                        <span className="font-bold text-red-400 tabular-nums">
                          {stats.worst_day.date.slice(5)} {fmtPct(stats.worst_day.pct)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* vs NEPSE — stock mode only: same-month index return + relative strength */}
            {symbol && stats?.nepse_return != null && (
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                <div className={LABEL}>vs NEPSE · same month</div>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <div className="text-[10px] text-gray-400">NEPSE</div>
                    <div
                      className="text-[12px] font-black tabular-nums"
                      style={{ color: stats.nepse_return >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                      {fmtPct(stats.nepse_return, 2)}
                    </div>
                  </div>
                  {stats.relative_strength != null && (
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400">Relative strength</div>
                      <div
                        className="text-[12px] font-black tabular-nums"
                        style={{ color: stats.relative_strength >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {fmtPct(stats.relative_strength, 2)}
                        <span className="text-[10px] font-bold text-gray-400">
                          {' '}
                          {stats.relative_strength >= 0 ? 'beat' : 'lagged'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sectors — drill-in card. Sits ABOVE Historical Rank so the page's
                main drill-down isn't below the panel fold. The list swaps in
                place to the clicked sector's stocks (back button returns). */}
            {scoped?.length > 0 &&
              (() => {
                const activeS = activeSector
                  ? scoped.find((s) => s.name === activeSector.name)
                  : null
                return (
                  <div
                    ref={sectorsCardRef}
                    style={{ scrollMarginTop: 8 }}
                    className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 overflow-hidden shadow-sm"
                  >
                    {!activeS ? (
                      <>
                        {/* List view */}
                        <div className="flex items-center justify-between px-2.5 pt-2 pb-1.5">
                          <span className={LABEL}>
                            {scoped.length > 1 ? `Sectors · ${scoped.length}` : 'Sector'}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            tap a sector → its stocks
                          </span>
                        </div>
                        <div>
                          {scoped.map((s, i) => (
                            <SectorRow
                              key={s.index_id}
                              s={s}
                              index={i}
                              isActive={false}
                              isBest={best && s.name === best.name}
                              isWorst={worst && s.name === worst.name}
                              history={sectorHistory[s.name] || []}
                              maxAbs={sectorMaxAbs}
                              pad="px-2.5 py-1.5"
                              onClick={(sec) => {
                                drillScrollRef.current = true
                                setActiveSector(sec)
                              }}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Stocks view — one sector's header + its full stock list */}
                        <div className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                          {scoped.length > 1 && (
                            <button
                              onClick={() => setActiveSector(null)}
                              aria-label="Back to sectors"
                              title="Back to sectors"
                              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-white dark:hover:bg-gray-800 text-[12px]"
                            >
                              ←
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-gray-800 dark:text-gray-100 truncate leading-tight">
                              {(activeS.label || activeS.name)
                                .replace(' Sub-Index', '')
                                .replace(' Index', '')}
                            </div>
                            <div className="text-[10px] text-gray-400 leading-tight">
                              {MONTHS_FULL[cell.month - 1]} {cell.year}
                            </div>
                          </div>
                          <SectorMomentumSpark values={sectorHistory[activeS.name] || []} />
                          <span
                            className="text-[12px] font-black tabular-nums shrink-0"
                            style={{ color: sectorCol(activeS.return_pct) }}
                          >
                            {fmtPct(activeS.return_pct)}
                          </span>
                        </div>
                        <InlineSectorStocks
                          sectorIndex={activeS.name}
                          year={cell.year}
                          month={cell.month}
                          onStockClick={(symbol, rect) => setStockPop({ symbol, rect })}
                          activeStockSymbol={stockPop?.symbol}
                        />
                      </>
                    )}
                  </div>
                )
              })()}

            {/* Historical Rank */}
            {cell.value != null && (
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2.5 shadow-sm">
                <HistoricalRank value={cell.value} allYears={allYears} month={cell.month} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — keyboard hints, desktop only */}
      <div className="shrink-0 hidden lg:block px-3 py-1 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="text-[10px] text-gray-500 dark:text-gray-500">
          ← → navigate{onMaximize ? ' · ⤢ maximize' : ''} · Esc clear
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

// ─── Inline sector→stocks (used inside InlineRightPanel) ─────────────────────
// Backed by the module-level sectorStocksCache so collapsing + re-expanding a
// sector (or maximizing) doesn't refetch. Sync cache seed avoids a spinner flash.
function InlineSectorStocks({ sectorIndex, year, month, onStockClick, activeStockSymbol }) {
  const cached = sectorStocksCache.get(`${sectorIndex}:${year}:${month}`)

  const [stocks, setStocks] = useState(cached || null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('return')

  useEffect(() => {
    if (!sectorIndex) return
    setQuery('')
    setSort('return')
    const c = sectorStocksCache.get(`${sectorIndex}:${year}:${month}`)
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
    fetchSectorStocks(sectorIndex, year, month, ctrl.signal)
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
  }, [sectorIndex, year, month])

  const maxAbs = stocks?.length
    ? Math.max(...stocks.map((s) => Math.abs(s.return_pct ?? 0)), 0.1)
    : 1
  const winners = (stocks || []).filter((s) => (s.return_pct ?? 0) > 0).length
  const losers = (stocks || []).filter((s) => (s.return_pct ?? 0) < 0).length

  // Same filter/sort the maximized overlay offers — big sectors (Hydro ~90
  // symbols) were unsearchable inline.
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

  // Plain list, no inner scrollbox — the right panel owns the single scroll.
  return (
    <div>
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && <div className="px-2.5 py-2 text-[10px] text-red-400">{error}</div>}
      {!loading && !error && stocks !== null && stocks.length === 0 && (
        <div className="px-2.5 py-3 text-[10px] text-gray-400">No stock data for this period</div>
      )}
      {!loading && !error && stocks?.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-50 dark:border-gray-800/60">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              ▲ {winners}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-500">
              ▼ {losers}
            </span>
            <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
              {stocks.length} stocks · tap → chart
            </span>
          </div>
          {/* Filter + sort — only worth the row when the list is long */}
          {stocks.length > 8 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-50 dark:border-gray-800/60">
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
                  className="flex-1 min-w-0 bg-transparent text-[10px] font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none"
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
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded p-0.5 shrink-0">
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
          {filtered.length === 0 && (
            <div className="px-2.5 py-3 text-center text-[10px] text-gray-400">
              No stocks match "{query}"
            </div>
          )}
          <div>
            {filtered.map((s, i) => (
              <StockRow
                key={s.symbol}
                s={s}
                index={i}
                maxAbs={maxAbs}
                isActive={activeStockSymbol === s.symbol}
                onClick={onStockClick}
                dense
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
