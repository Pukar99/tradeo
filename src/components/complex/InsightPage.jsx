// === InsightPage.jsx — NEPSE monthly-returns heatmap (DataLab · Insight tab) ===
// Page state + heatmap table live here; everything else is in ./insight/:
//   helpers.js          — pure helpers, colour scale, design tokens, useIsLg
//   useMonthDetail.js   — LRU caches + shared month-detail data layer
//   charts.jsx          — MonthChart, StockMiniChartPopover, SectorMomentumSpark
//   rows.jsx            — SectorBar, SectorRow, StockRow, AnnualBar, HistoricalRank
//   LeftInsightPanel    — index picker + Seasonal Edge + Top/Bottom years
//   InlineRightPanel    — cell-detail side panel (+ inline sector→stocks)
//   InspectOverlay      — maximized 3-column inspect view
//   MonthProfilePanel   — month-column seasonal profile
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getMonthlyReturns, getStockReturns } from '../../api/index'
import { apiError, isCanceled } from '../../utils/format'
import { INDEX_OPTIONS, RECENT_N, MONTHS as MONTHS_EN, MONTHS_FULL } from '../../utils/constants'
import { useToolbarSlot, safeSessionGet, safeSessionSet } from '../../pages/DataLabPage'
import {
  defaultSectorFor,
  useIsLg,
  LABEL,
  Skeleton,
  cellBg,
  cellFg,
  fmtPct,
  weightedAvg,
  weightedWinRate,
  monthStdDev,
} from './insight/helpers'
import { AnnualBar } from './insight/rows'
import LeftInsightPanel from './insight/LeftInsightPanel'
import InlineRightPanel from './insight/InlineRightPanel'
import InspectOverlay from './insight/InspectOverlay'
import MonthProfilePanel from './insight/MonthProfilePanel'
import StockSearch from './insight/StockSearch'

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InsightPage() {
  const { isDark: dark } = useTheme()
  const isLg = useIsLg()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  // Index + year filter survive refresh via sessionStorage (same pattern as the tab id)
  const [selectedIndexId, setSelectedIndexId] = useState(() => {
    const v = parseInt(safeSessionGet('tradeo_insight_index', '12'))
    return INDEX_OPTIONS.some((o) => o.id === v) ? v : 12
  })
  // Stock mode — { symbol, name } replaces the index as the heatmap's data source.
  // null = normal index view.
  const [stock, setStock] = useState(null)
  const [yearFilter, setYearFilter] = useState(() => {
    const v = safeSessionGet('tradeo_insight_years', '5')
    return ['all', '10', '5'].includes(v) ? v : '5'
  })
  useEffect(() => {
    safeSessionSet('tradeo_insight_index', String(selectedIndexId))
  }, [selectedIndexId])
  useEffect(() => {
    safeSessionSet('tradeo_insight_years', yearFilter)
  }, [yearFilter])
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [activeSector, setActiveSector] = useState(null) // shared between InlineRightPanel & InspectOverlay
  // Auto-select fills the desktop right panel, but on mobile the detail sheet
  // must NOT open by itself — only user-initiated selections set this true.
  const [userPicked, setUserPicked] = useState(false)
  const [profileMonth, setProfileMonth] = useState(null) // 1-12 — month-column profile

  // Shared fetch-id guard for BOTH index and stock fetches: a slow response for
  // a superseded request (rapid index-pill clicks, index→stock switches) must
  // not overwrite the heatmap that a newer request already rendered.
  const fetchIdRef = useRef(0)

  // force=true (manual ↻ only) busts the backend's 1-hour monthly cache —
  // without it the refresh button silently served the same cached payload.
  const doFetch = useCallback(async (indexId, force = false) => {
    const fid = ++fetchIdRef.current
    setLoading(true)
    setError('')
    // Don't blank data/selected on refresh — keep the panel visible while we refetch.
    try {
      const r = await getMonthlyReturns({ index_id: indexId, ...(force ? { refresh: 1 } : {}) })
      if (fid !== fetchIdRef.current) return
      setData(r.data)
      // Auto-select the latest month only if nothing is currently selected,
      // or if the previously-selected month no longer exists in the new data.
      setSelected((prev) => {
        if (prev) {
          const row = r.data?.years?.find((y) => y.year === prev.year)
          const val = row?.months?.[prev.month - 1]
          if (val != null) return { ...prev, value: val } // refresh the value
        }
        if (r.data?.latest_data_date && r.data?.years?.length) {
          // Parse 'YYYY-MM-DD' textually — new Date() reads it as UTC, so
          // getFullYear()/getMonth() shift a day (and possibly a month) for
          // users west of UTC.
          const [yr, mo] = r.data.latest_data_date.split('-').map(Number)
          const row = r.data.years.find((y) => y.year === yr)
          const val = row?.months?.[mo - 1] ?? null
          return { year: yr, month: mo, value: val }
        }
        return null
      })
    } catch (err) {
      if (fid !== fetchIdRef.current || isCanceled(err)) return
      setError(apiError(err, 'Failed to load data. Please try again.'))
    } finally {
      if (fid === fetchIdRef.current) setLoading(false)
    }
  }, [])

  // Stock mode fetch — /breakdown/stock-returns has the same shape as the index
  // payload except `latest_date` (vs latest_data_date) and no current_streak;
  // normalize here so every consumer downstream stays source-agnostic.
  const doFetchStock = useCallback(async (sym) => {
    const fid = ++fetchIdRef.current
    setLoading(true)
    setError('')
    try {
      const r = await getStockReturns({ symbol: sym })
      if (fid !== fetchIdRef.current) return
      const d = { ...r.data, latest_data_date: r.data.latest_date || null }
      setData(d)
      // Auto-select the stock's latest month so the panel isn't empty
      setSelected(() => {
        if (d.latest_data_date && d.years?.length) {
          const [yr, mo] = d.latest_data_date.split('-').map(Number)
          const row = d.years.find((y) => y.year === yr)
          return { year: yr, month: mo, value: row?.months?.[mo - 1] ?? null }
        }
        return null
      })
    } catch (err) {
      if (fid !== fetchIdRef.current || isCanceled(err)) return
      setError(apiError(err, `No monthly data found for ${sym}.`))
    } finally {
      if (fid === fetchIdRef.current) setLoading(false)
    }
  }, [])

  // Source switch (index pill or stock search) → reset selection, fetch the
  // right dataset. prevSourceRef keeps the initial mount from clearing state twice.
  const prevSourceRef = useRef(`idx:${selectedIndexId}`)
  useEffect(() => {
    const source = stock ? `stk:${stock.symbol}` : `idx:${selectedIndexId}`
    if (prevSourceRef.current !== source) {
      setSelected(null)
      setActiveSector(stock ? null : defaultSectorFor(selectedIndexId))
      setUserPicked(false)
      setProfileMonth(null)
      setMaximized(false)
      prevSourceRef.current = source
    }
    if (stock) doFetchStock(stock.symbol)
    else doFetch(selectedIndexId)
  }, [selectedIndexId, stock, doFetch, doFetchStock])

  const allYears = useMemo(() => data?.years || [], [data])
  const latestDate = data?.latest_data_date || null
  // Textual 'YYYY-MM-DD' parse — avoids the UTC shift of new Date(isoDate)
  const [curYear, curMon] = latestDate
    ? latestDate.split('-').map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1]

  const years = useMemo(
    () =>
      allYears.filter((y) => {
        if (yearFilter === '5') return y.year >= curYear - 4
        if (yearFilter === '10') return y.year >= curYear - 9
        return true
      }),
    [allYears, yearFilter, curYear]
  )

  const recentSet = useMemo(
    () => new Set(allYears.slice(0, RECENT_N).map((y) => y.year)),
    [allYears]
  )
  const wAvg = useMemo(
    () => (years.length ? weightedAvg(years) : data?.month_averages || []),
    [years, data]
  )
  const wWinRate = useMemo(
    () => (years.length ? weightedWinRate(years) : data?.month_win_rates || []),
    [years, data]
  )
  const wStdDev = useMemo(() => (years.length ? monthStdDev(years) : []), [years])

  // Plain per-month means over the visible years — pairs with wStdDev to flag
  // >2σ outlier cells (crash/boom months) directly on the heatmap.
  const monthMeans = useMemo(
    () =>
      Array.from({ length: 12 }, (_, mi) => {
        const vals = years.map((y) => y.months[mi]).filter((v) => v != null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }),
    [years]
  )

  // "This month, right now" hero strip — current month's historical profile
  // vs how it's actually doing this year.
  const heroInfo = useMemo(() => {
    if (!allYears.length) return null
    const mi = curMon - 1
    const avg = wAvg[mi]
    const win = wWinRate[mi]
    if (avg == null) return null
    const ranked = wAvg
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v != null)
      .sort((a, b) => b.v - a.v)
    const rank = ranked.findIndex((x) => x.i === mi) + 1
    const sofar = allYears.find((y) => y.year === curYear)?.months?.[mi] ?? null
    return { mi, avg, win, rank, nMonths: ranked.length, sofar }
  }, [allYears, wAvg, wWinRate, curMon, curYear])

  const LABELS = MONTHS_EN

  const handleCell = useCallback(
    (year, month, value) => {
      setSelected({ year, month, value })
      setActiveSector(stock ? null : defaultSectorFor(selectedIndexId))
      setProfileMonth(null)
      setUserPicked(true)
    },
    [selectedIndexId, stock]
  )

  const handleCloseDetail = useCallback(() => {
    setSelected(null)
    setActiveSector(null)
    setProfileMonth(null)
    setUserPicked(false)
    setMaximized(false)
  }, [])

  const handleNavigate = useCallback(
    (dir) => {
      if (!selected || !allYears.length) return
      let { year, month } = selected
      month += dir
      if (month < 1) {
        month = 12
        year--
      }
      if (month > 12) {
        month = 1
        year++
      }
      const row = allYears.find((y) => y.year === year)
      if (!row) return
      const value = row.months[month - 1] ?? null
      setSelected({ year, month, value })
      setActiveSector(stock ? null : defaultSectorFor(selectedIndexId))
    },
    [selected, allYears, selectedIndexId, stock]
  )

  const handleJump = useCallback(
    (year, month) => {
      if (!allYears.length) return
      const row = allYears.find((y) => y.year === year)
      if (!row) return
      const value = row.months[month - 1] ?? null
      setSelected({ year, month, value })
      setActiveSector(stock ? null : defaultSectorFor(selectedIndexId))
      setUserPicked(true)
    },
    [allYears, selectedIndexId, stock]
  )

  // ── Month-column profile (D2) ──
  const handleMonthHeader = useCallback((month) => {
    setProfileMonth((prev) => (prev === month ? null : month))
    setSelected(null)
    setActiveSector(null)
    setUserPicked(true)
  }, [])

  const handleProfileNav = useCallback((dir) => {
    setProfileMonth((m) => {
      if (m == null) return m
      let n = m + dir
      if (n < 1) n = 12
      if (n > 12) n = 1
      return n
    })
  }, [])

  // Click a year inside the profile → jump straight to that cell's detail
  const handleProfilePick = useCallback(
    (year, month, value) => {
      setProfileMonth(null)
      setSelected({ year, month, value })
      setActiveSector(stock ? null : defaultSectorFor(selectedIndexId))
      setUserPicked(true)
    },
    [selectedIndexId, stock]
  )

  // Index pill click — also exits stock mode (an index pick always means
  // "show me that index", even while a stock heatmap is on screen).
  const handleSelectIndex = useCallback((id) => {
    setStock(null)
    setSelectedIndexId(id)
  }, [])

  // Stable callback for the mobile index sheet: select index + close the sheet.
  // Pre-extracted so it doesn't break LeftInsightPanel's memo with an inline fn.
  const handleMobileIndexSelect = useCallback((id) => {
    setStock(null)
    setSelectedIndexId(id)
    setMobileLeftOpen(false)
  }, [])

  // Toolbar stock search → enter/exit stock mode
  const handleStockSelect = useCallback((symbol, name) => {
    setStock({ symbol, name })
  }, [])
  const handleStockClear = useCallback(() => setStock(null), [])

  // Global keyboard nav for the inline right panel (overlay has its own when maximized).
  useEffect(() => {
    if (maximized) return // overlay owns the keys
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      // Mobile index sheet open: Esc closes it, nothing else fires underneath
      if (mobileLeftOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setMobileLeftOpen(false)
        }
        return
      }
      // Month profile open: ← → step months (wrapping), Esc closes
      if (profileMonth) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          handleProfileNav(-1)
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          handleProfileNav(1)
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          handleCloseDetail()
        }
        return
      }
      // Only swallow keys when a cell is actually selected — an unconditional
      // preventDefault here blocked arrow-key page scrolling at all times.
      if (!selected) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleNavigate(-1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNavigate(1)
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCloseDetail()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [
    handleNavigate,
    handleCloseDetail,
    maximized,
    mobileLeftOpen,
    profileMonth,
    handleProfileNav,
    selected,
  ])

  const annualRows = years.filter((y) => y.annual != null)

  // Inject controls into DataLab tab bar
  const toolbar = useToolbarSlot(
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
      {/* Mobile: index trigger */}
      <button
        className="md:hidden flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
        onClick={() => setMobileLeftOpen(true)}
      >
        {stock?.symbol ?? INDEX_OPTIONS.find((o) => o.id === selectedIndexId)?.label ?? 'Index'}
        <svg
          className="w-2.5 h-2.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <polyline points="6 4 10 8 6 12" />
        </svg>
      </button>

      <span
        className={`${LABEL} normal-case hidden sm:inline ${stock ? 'max-w-[160px] truncate' : ''}`}
      >
        {stock
          ? stock.name || stock.symbol
          : INDEX_OPTIONS.find((o) => o.id === selectedIndexId)?.label}
      </span>
      {latestDate && (
        <span className={`${LABEL} normal-case text-gray-300 dark:text-gray-700 hidden sm:inline`}>
          · {latestDate}
        </span>
      )}

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0 hidden sm:block" />

      {/* Stock search — swaps the heatmap to a single stock's monthly seasonality */}
      <StockSearch
        activeSymbol={stock?.symbol || null}
        onSelect={handleStockSelect}
        onClear={handleStockClear}
      />

      {/* Year filter */}
      <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-700 text-[10px] font-bold">
        {[
          ['all', 'All'],
          ['10', '10yr'],
          ['5', '5yr'],
        ].map(([v, lbl]) => (
          <button
            key={v}
            onClick={() => setYearFilter(v)}
            className={`px-1.5 py-0.5 transition-colors ${
              yearFilter === v
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      <button
        onClick={() => (stock ? doFetchStock(stock.symbol) : doFetch(selectedIndexId, true))}
        disabled={loading}
        className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors text-[10px]"
      >
        {loading ? '·' : '↻'}
      </button>
    </div>
  )

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 bg-gray-50 dark:bg-gray-950">
      {toolbar}

      {/* ── Left Panel — desktop only ─────────────────────────────────────── */}
      <div
        className="hidden md:flex w-[200px] min-w-[180px] border-r border-gray-100 dark:border-gray-800
        bg-white dark:bg-gray-900 flex-col shrink-0 overflow-hidden relative"
      >
        {loading && !data ? (
          <div className="flex-1">
            <Skeleton />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
            <div>
              <div className="text-red-400 text-xs mb-2">{error}</div>
              <button
                onClick={() => (stock ? doFetchStock(stock.symbol) : doFetch(selectedIndexId))}
                className="text-[10px] text-blue-500 underline"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {loading && data && (
              <div className="absolute inset-0 z-10 flex items-start justify-center pt-6 pointer-events-none">
                <div
                  className="flex items-center gap-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm
                              px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
                >
                  <div className="w-3 h-3 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    Updating…
                  </span>
                </div>
              </div>
            )}
            <LeftInsightPanel
              data={data}
              wAvg={wAvg}
              wWinRate={wWinRate}
              selectedIndexId={stock ? null : selectedIndexId}
              setSelectedIndexId={handleSelectIndex}
            />
          </>
        )}
      </div>

      {/* ── Center — Heatmap + Annual strip ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50/40 dark:bg-gray-900/40">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 relative bg-gray-50/40 dark:bg-gray-900/40 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* Heatmap card: fills the column width so there's no empty band on the
              right of the heatmap. minWidth keeps it readable when the column is narrow
              (outer overflow-x-auto provides horizontal scroll in that case). */}
          <div
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800/80 p-3"
            style={{ minWidth: 520, width: '100%' }}
          >
            {loading && !data && <Skeleton />}

            {/* Heatmap.
                NOTE: `border-separate` + `border-spacing-0` is required for `position: sticky`
                to work on <th>/<td> in iOS Safari (< 16). The `translate-x-0` on sticky cells
                forces compositor layout — a known fix for iOS sticky-cell rendering glitches.
                The outer column's overflow-x-auto handles horizontal scroll when the table
                is wider than the column. */}
            {data && (
              <div>
                {/* "This month, right now" — the page's thesis in one line:
                    what this month usually does vs how it's doing this year */}
                {heroInfo && (
                  <div className="mb-2.5 flex items-center gap-x-2 gap-y-1 flex-wrap rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 px-2.5 py-1.5">
                    {stock && (
                      <span className="text-[10px] font-black px-1.5 py-px rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        {stock.symbol}
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                      {MONTHS_FULL[heroInfo.mi]}
                    </span>
                    {/* Say which window the stats come from — they silently change with the year filter */}
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {yearFilter === 'all' ? 'historically:' : `last ${yearFilter}yr:`}
                    </span>
                    <span
                      className={`text-[10px] font-bold tabular-nums ${heroInfo.avg >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                    >
                      {fmtPct(heroInfo.avg)} avg
                    </span>
                    <span className="text-[10px] text-gray-200 dark:text-gray-700">·</span>
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{
                        color:
                          heroInfo.win >= 60
                            ? '#22c55e'
                            : heroInfo.win >= 45
                              ? '#f59e0b'
                              : '#ef4444',
                      }}
                    >
                      {heroInfo.win}% win
                    </span>
                    <span className="text-[10px] text-gray-200 dark:text-gray-700">·</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      #{heroInfo.rank} of {heroInfo.nMonths} months
                    </span>
                    {/* Live market streak (consecutive ▲/▼ months) — backend computes it, was never shown */}
                    {data?.current_streak?.count > 1 && (
                      <>
                        <span className="text-[10px] text-gray-200 dark:text-gray-700">·</span>
                        <span
                          className={`text-[10px] font-bold tabular-nums ${
                            data.current_streak.direction === 'positive'
                              ? 'text-emerald-500'
                              : 'text-red-500'
                          }`}
                        >
                          {data.current_streak.count}-mo{' '}
                          {data.current_streak.direction === 'positive' ? '▲' : '▼'} streak
                        </span>
                      </>
                    )}
                    {heroInfo.sofar != null && (
                      <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-400">
                        {curYear} so far:{' '}
                        <span
                          className={`font-black tabular-nums ${heroInfo.sofar >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                        >
                          {fmtPct(heroInfo.sofar)}
                        </span>
                      </span>
                    )}
                  </div>
                )}

                <table className="w-full border-separate border-spacing-0">
                  {/* Sticky header: top-0 keeps month labels visible while scrolling
                      years; the Year corner cell needs both left+top and higher z. */}
                  <thead>
                    <tr>
                      <th
                        className="text-left pb-1.5 pr-2 sticky left-0 top-0 z-30 bg-white dark:bg-gray-900 translate-x-0
                        text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10"
                      >
                        Year
                      </th>
                      {LABELS.map((m, i) => (
                        <th
                          key={i}
                          className="pb-1.5 px-px min-w-[36px] sticky top-0 z-20 bg-white dark:bg-gray-900"
                        >
                          <button
                            onClick={() => handleMonthHeader(i + 1)}
                            title={`${MONTHS_FULL[i]} — profile across all years`}
                            className={`w-full text-center text-[10px] font-bold uppercase tracking-wide rounded py-0.5 transition-colors ${
                              profileMonth === i + 1
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                            }`}
                          >
                            {m}
                          </button>
                        </th>
                      ))}
                      <th className="pb-1.5 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-2 pr-1 min-w-[44px] border-l-2 border-gray-200 dark:border-gray-700 sticky top-0 z-20 bg-white dark:bg-gray-900">
                        YTD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((row) => {
                      const isRecent = recentSet.has(row.year)
                      const isLatest = row.year === curYear
                      const opacity = isRecent ? 1.0 : 0.78
                      return (
                        <tr
                          key={row.year}
                          style={{ opacity }}
                          className="hover:opacity-100 focus-within:!opacity-100 transition-opacity duration-150"
                        >
                          <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-900 translate-x-0">
                            <div className="flex items-center gap-1">
                              {isLatest ? (
                                <span className="text-[11px] font-black text-blue-500 leading-none">
                                  {row.year}
                                </span>
                              ) : isRecent ? (
                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 leading-none">
                                  {row.year}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 leading-none">
                                  {row.year}
                                </span>
                              )}
                              {isLatest && (
                                <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                              )}
                            </div>
                          </td>
                          {row.months.map((val, mi) => {
                            const isCur = row.year === curYear && mi + 1 === curMon
                            const isSel = selected?.year === row.year && selected?.month === mi + 1
                            const isDisabled = val == null
                            // >2σ from this month's mean — crash/boom outlier
                            const isOutlier =
                              val != null &&
                              monthMeans[mi] != null &&
                              (wStdDev[mi] ?? 0) > 0 &&
                              Math.abs(val - monthMeans[mi]) > 2 * wStdDev[mi]
                            return (
                              <td key={mi} className="py-0.5 px-px">
                                <button
                                  onClick={() => handleCell(row.year, mi + 1, val)}
                                  disabled={isDisabled}
                                  title={
                                    val != null
                                      ? `${MONTHS_FULL[mi]} ${row.year} · ${fmtPct(val)}${isOutlier ? ' · >2σ outlier' : ''}`
                                      : `${MONTHS_FULL[mi]} ${row.year} — no data`
                                  }
                                  // tabIndex={-1} keeps disabled cells out of the keyboard tab order
                                  // (browser still allows focus on disabled <button> via clicks/scripts,
                                  // but Tab navigation should skip dead cells).
                                  tabIndex={isDisabled ? -1 : 0}
                                  aria-label={
                                    val != null
                                      ? `${LABELS[mi]} ${row.year} return ${fmtPct(val)}`
                                      : `${LABELS[mi]} ${row.year} no data`
                                  }
                                  className={[
                                    'w-full rounded text-[10px] font-bold select-none transition-all duration-100 leading-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none',
                                    !isDisabled
                                      ? 'cursor-pointer hover:scale-105 hover:shadow-sm'
                                      : 'cursor-default opacity-20',
                                    // Selection (user-clicked) takes visual priority over "current month" — once
                                    // selected, that ring IS the indicator. Avoids stacking blue ring + blue outline
                                    // on the same cell when the user clicks today's month.
                                    isSel
                                      ? 'scale-105 shadow-md ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950 z-10'
                                      : '',
                                  ].join(' ')}
                                  style={{
                                    background: cellBg(val, dark),
                                    color: cellFg(val, dark),
                                    padding: '3px 1px',
                                    minWidth: 36,
                                    // "Today" outline shows only when NOT selected — selection ring is
                                    // the relevant state once user interacts.
                                    outline: isCur && !isSel ? '1.5px dashed #60a5fa' : undefined,
                                    outlineOffset: isCur && !isSel ? '1px' : undefined,
                                    // Outlier ring suppressed while selected — the blue
                                    // selection ring (box-shadow) must win.
                                    boxShadow:
                                      isOutlier && !isSel
                                        ? `0 0 0 1.5px ${dark ? '#a78bfa' : '#8b5cf6'}`
                                        : undefined,
                                  }}
                                >
                                  {val != null ? fmtPct(val) : '·'}
                                </button>
                              </td>
                            )
                          })}
                          {/* YTD column */}
                          <td className="py-0.5 pl-2 pr-1 border-l-2 border-gray-200 dark:border-gray-700">
                            <div
                              className="text-right text-[10px] font-black tabular-nums"
                              style={{ color: (row.annual ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}
                            >
                              {row.annual != null ? fmtPct(row.annual) : '—'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Weighted Avg row */}
                    {wAvg.some((v) => v != null) && (
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                        <td className="py-1 pr-2 sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 translate-x-0">
                          <span
                            className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap"
                            title={`Weighted average — last ${RECENT_N} years count ×2`}
                          >
                            Wtd Avg
                          </span>
                        </td>
                        {wAvg.map((v, i) => (
                          <td key={i} className="py-0.5 px-px">
                            <div
                              className="w-full rounded text-center text-[10px] font-black tabular-nums"
                              style={{
                                background: cellBg(v, dark),
                                color: cellFg(v, dark),
                                padding: '2px 1px',
                                minWidth: 36,
                              }}
                            >
                              {v != null ? fmtPct(v) : '—'}
                            </div>
                          </td>
                        ))}
                        <td className="border-l-2 border-gray-200 dark:border-gray-700" />
                      </tr>
                    )}

                    {/* Win rate row */}
                    {wWinRate.some((v) => v != null) && (
                      <tr>
                        <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-900 translate-x-0">
                          <span
                            className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wide"
                            title={`Share of positive years — last ${RECENT_N} years weighted ×2`}
                          >
                            Win%
                          </span>
                        </td>
                        {wWinRate.map((v, i) => {
                          const color = v >= 60 ? '#22c55e' : v >= 45 ? '#f59e0b' : '#ef4444'
                          const bg =
                            v >= 60
                              ? dark
                                ? 'rgba(34,197,94,0.12)'
                                : 'rgba(34,197,94,0.10)'
                              : v >= 45
                                ? dark
                                  ? 'rgba(245,158,11,0.12)'
                                  : 'rgba(245,158,11,0.10)'
                                : dark
                                  ? 'rgba(239,68,68,0.12)'
                                  : 'rgba(239,68,68,0.10)'
                          return (
                            <td key={i} className="py-0.5 px-px">
                              <div
                                className="w-full rounded text-center text-[10px] font-black"
                                style={{ background: bg, color, padding: '2px 1px' }}
                              >
                                {v != null ? v + '%' : '—'}
                              </div>
                            </td>
                          )
                        })}
                        <td />
                      </tr>
                    )}

                    {/* Volatility (σ) row */}
                    {wStdDev.some((v) => v != null) && (
                      <tr>
                        <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-900 translate-x-0">
                          <span
                            className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wide"
                            title="Standard deviation"
                          >
                            σ
                          </span>
                        </td>
                        {wStdDev.map((v, i) => (
                          <td key={i} className="py-0.5 px-px">
                            <div
                              className="w-full text-center text-[10px] font-bold tabular-nums text-gray-500 dark:text-gray-400"
                              style={{ padding: '2px 1px' }}
                            >
                              {v != null ? v.toFixed(1) : '—'}
                            </div>
                          </td>
                        ))}
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-1.5 mb-3 text-[10px] text-gray-500 dark:text-gray-500 px-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
                    <span className="text-blue-400 font-bold">{curYear}</span> = live
                  </span>
                  {/* Color scale — what the shades mean */}
                  <span className="flex items-center gap-1">
                    <span>−10%</span>
                    <span className="flex items-center gap-px">
                      {[-10, -5, -1, 1, 5, 10, 16].map((v) => (
                        <span
                          key={v}
                          className="w-2.5 h-2.5 rounded-[2px]"
                          style={{ background: cellBg(v, dark) }}
                        />
                      ))}
                    </span>
                    <span>+15%</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                      style={{ boxShadow: `inset 0 0 0 1.5px ${dark ? '#a78bfa' : '#8b5cf6'}` }}
                    />
                    &gt;2σ outlier
                  </span>
                  <span>YTD = annual return</span>
                  <span>σ = monthly volatility</span>
                  <span title={`Wtd Avg and Win% count the last ${RECENT_N} years twice`}>
                    Wtd/Win% = recent-weighted
                  </span>
                  <span className="ml-auto text-gray-500 dark:text-gray-500">
                    click cell for detail · month name for profile
                  </span>
                </div>
              </div>
            )}

            {/* Annual performance strip */}
            {data && !loading && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <span className="text-[10px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2">
                    Annual Performance
                  </span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800/60">
                  <div className="text-[10px] text-gray-400 dark:text-gray-600 mb-2">
                    Brighter = more recent · dimmed = historical
                  </div>
                  <div className="space-y-px">
                    {annualRows.map((row) => (
                      <AnnualBar
                        key={row.year}
                        year={row.year}
                        annual={row.annual}
                        isRecent={recentSet.has(row.year)}
                        isLatest={row.year === curYear}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Inline right panel — always open on desktop ──
          Month profile (header click) takes over the panel; cell detail otherwise.
          isLg-gated so the panel never mounts (and fetches) alongside the mobile sheet. */}
      {isLg && (
        <div className="hidden lg:flex w-[420px] min-w-[380px] shrink-0 border-l border-gray-100 dark:border-gray-800 flex-col min-h-0 bg-white dark:bg-gray-900">
          {profileMonth ? (
            <MonthProfilePanel
              month={profileMonth}
              years={years}
              wAvg={wAvg}
              wWinRate={wWinRate}
              wStdDev={wStdDev}
              onClose={handleCloseDetail}
              onNavigate={handleProfileNav}
              onPickCell={handleProfilePick}
            />
          ) : (
            <InlineRightPanel
              cell={selected}
              onClose={handleCloseDetail}
              onNavigate={handleNavigate}
              onMaximize={stock ? null : () => setMaximized(true)}
              symbol={stock?.symbol || null}
              dark={dark}
              allYears={allYears}
              indexId={selectedIndexId}
              activeSector={activeSector}
              setActiveSector={setActiveSector}
            />
          )}
        </div>
      )}

      {/* Mobile: bottom sheet — only for user-initiated selections (auto-select
          on load must not cover the heatmap). Same pattern as the index sheet.
          !isLg-gated: never mounted alongside the desktop panel. */}
      {!isLg && (profileMonth != null || selected != null) && userPicked && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={handleCloseDetail}
          />
          <div
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex flex-col
                          bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t
                          border-gray-200 dark:border-gray-800 overflow-hidden"
            style={{ height: '78vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            {profileMonth ? (
              <MonthProfilePanel
                month={profileMonth}
                years={years}
                wAvg={wAvg}
                wWinRate={wWinRate}
                wStdDev={wStdDev}
                onClose={handleCloseDetail}
                onNavigate={handleProfileNav}
                onPickCell={handleProfilePick}
              />
            ) : (
              <InlineRightPanel
                cell={selected}
                onClose={handleCloseDetail}
                onNavigate={handleNavigate}
                onMaximize={stock ? null : () => setMaximized(true)}
                symbol={stock?.symbol || null}
                dark={dark}
                allYears={allYears}
                indexId={selectedIndexId}
                activeSector={activeSector}
                setActiveSector={setActiveSector}
              />
            )}
          </div>
        </>
      )}

      {/* ── Maximized overlay — 3-column full-page inspect (index mode only:
          its Sectors/Stocks columns have no meaning for a single stock) ── */}
      {maximized && selected && !stock && (
        <InspectOverlay
          cell={selected}
          onClose={handleCloseDetail}
          onNavigate={handleNavigate}
          onJump={handleJump}
          onMinimize={() => setMaximized(false)}
          dark={dark}
          allYears={allYears}
          indexId={selectedIndexId}
          activeSector={activeSector}
          setActiveSector={setActiveSector}
        />
      )}

      {/* Mobile left panel sheet */}
      {mobileLeftOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={() => setMobileLeftOpen(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
                          bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t
                          border-gray-200 dark:border-gray-800"
            style={{ height: '70vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                Select Index
              </span>
              <button
                onClick={() => setMobileLeftOpen(false)}
                aria-label="Close index sheet"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[14px]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-900">
              <LeftInsightPanel
                data={data}
                wAvg={wAvg}
                wWinRate={wWinRate}
                selectedIndexId={stock ? null : selectedIndexId}
                setSelectedIndexId={handleMobileIndexSelect}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
