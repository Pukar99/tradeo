import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTheme } from '../../context/ThemeContext'
import {
  getMarketCycles,
  runDropAnalysis,
  getSectorStocks,
  getStockPriceRange,
} from '../../api'
import { apiError, isCanceled } from '../../utils/format'
import { INDEX_OPTIONS } from '../../utils/constants'
import { useToolbarSlot } from '../../pages/DataLabPage'
import { safeSessionGet, safeSessionSet } from '../../utils/safeSession'
// Design tokens and Skeleton come from the shared DataLab module
import { CARD, LABEL, STITLE, Skeleton } from '../datalab/shared'
import { CollapsiblePanel, PanelToggle, usePanelOpen } from '../shared/CollapsiblePanel'
import ViewSwitcher from '../shared/ViewSwitcher'
import { useDataLabControls } from '../datalab/DataLabControls'
import { stripIndexName, pctTextCls, phaseCls } from './breakdown/helpers'
import { PriceChart, MiniOverview, SectorIndexChart } from './breakdown/charts'
import { SectorMatrix, StockList } from './breakdown/SectorMatrix'
import { ResilientTile, AggregateStats, CyclePill, IndexSelector, Stat } from './breakdown/atoms'
import CycleAnalyticsCards from './breakdown/CycleAnalyticsCards'
import { useCycleSelection, cycleKey } from './breakdown/useCycleSelection'

const RANGE_VIEWS = [
  { id: 'all', label: 'All' },
  { id: '5y', label: '5Y' },
  { id: '2y', label: '2Y' },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function BreakdownPage() {
  const { isDark } = useTheme()

  // Swing threshold now lives in the shared DataLab toolbar controls (S2b) —
  // clamped 5–50 + session-persisted inside the provider.
  const { threshold, setThreshold } = useDataLabControls()

  // Core state — index survives refresh via sessionStorage
  const [indexId, setIndexId] = useState(() => {
    const v = parseInt(safeSessionGet('tradeo_breakdown_index', '12'))
    return INDEX_OPTIONS.some((o) => o.id === v) ? v : 12
  })
  const [ranThreshold, setRanThreshold] = useState(threshold) // clamped value of the last Detect run
  useEffect(() => {
    safeSessionSet('tradeo_breakdown_index', String(indexId))
  }, [indexId])
  useEffect(() => {
    safeSessionSet('tradeo_breakdown_threshold', String(ranThreshold))
  }, [ranThreshold])

  // Full-history overview range preset (spec §5.3 · pain #5)
  const [range, setRange] = useState(() => {
    const v = safeSessionGet('tradeo_breakdown_range', 'all')
    return RANGE_VIEWS.some((r) => r.id === v) ? v : 'all'
  })
  useEffect(() => {
    safeSessionSet('tradeo_breakdown_range', range)
  }, [range])

  const [cycles, setCycles] = useState([])
  const [allCandles, setAllCandles] = useState([])
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState('')

  // Cycle multi-select + focus (spec §5.3). `sel.focused` replaces the old
  // `activeCycle`; the selection set drives the center analytics cards.
  const sel = useCycleSelection(cycles)
  const focused = sel.focused

  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  const [activeSector, setActiveSector] = useState(null)
  const [sectorStocks, setSectorStocks] = useState({})
  const [sectorLoading, setSectorLoading] = useState({})
  const sectorStocksRef = useRef({})

  const [selectedStock, setSelectedStock] = useState(null)
  const [stockCandles, setStockCandles] = useState(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')

  const [sortBy, setSortBy] = useState('drop_pct')
  const [sortAsc, setSortAsc] = useState(true)

  const [cycleFilter, setCycleFilter] = useState('all')
  const [mobileCycles, setMobileCycles] = useState(false)

  // Collapsible side panels (S1 — localStorage-persisted, default open)
  const [leftOpen, toggleLeft] = usePanelOpen('tradeo_datalab_breakdown_leftOpen')
  const [rightOpen, toggleRight] = usePanelOpen('tradeo_datalab_breakdown_rightOpen')

  // Detect cycles (Rule 45 — abort superseded)
  const detectCtrlRef = useRef(null)
  const detectCycles = useCallback(async (thresh, idxId) => {
    if (detectCtrlRef.current) detectCtrlRef.current.abort()
    const ctrl = new AbortController()
    detectCtrlRef.current = ctrl
    // Normalize whatever is in the input (string, empty, out of range) and
    // reflect the clamped value back so the field shows what actually ran.
    // setThreshold clamps 5–50 internally (shared controls).
    setThreshold(thresh)
    const t = Math.min(50, Math.max(5, parseFloat(thresh) || 10))
    setRanThreshold(t)
    setDetecting(true)
    setDetectError('')
    try {
      const { data } = await getMarketCycles(
        { threshold: t, index_id: idxId },
        { signal: ctrl.signal }
      )
      if (ctrl.signal.aborted) return
      // Inject canonical names: Bull 1, Bear 1, Bull 2... in chronological order.
      // Backend already sorts by start_date ascending.
      let b = 0,
        be = 0
      const named = (data.cycles || []).map((c) => ({
        ...c,
        name: c.type === 'bull' ? `Bull ${++b}` : `Bear ${++be}`,
      }))
      setCycles(named)
      setAllCandles(data.candles || [])
      setAnalysis(null)
      setActiveSector(null)
      setSelectedStock(null)
      setStockCandles(null)
      sectorStocksRef.current = {}
      setSectorStocks({})
      setSectorLoading({})
    } catch (e) {
      if (ctrl.signal.aborted || isCanceled(e)) return
      setDetectError(apiError(e, 'Failed to detect cycles'))
    }
    if (!ctrl.signal.aborted) setDetecting(false)
  }, [setThreshold])

  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    detectCycles(threshold, indexId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleIndexSelect = useCallback(
    (id) => {
      if (id === indexId) return
      setIndexId(id)
      detectCycles(threshold, id)
    },
    [indexId, threshold, detectCycles]
  )

  // AbortController refs hoisted together so runAnalysis can cancel sibling
  // requests (sector-stocks, stock-chart) when the user switches cycles.
  const analysisCtrlRef = useRef(null)
  const stockChartCtrlRef = useRef(null)

  // Run analysis for the focused cycle (Rule 45). Called from the focus effect
  // below — no longer sets its own active cycle (the hook owns focus now).
  const runAnalysis = useCallback(
    async (cycle) => {
      if (analysisCtrlRef.current) analysisCtrlRef.current.abort()
      // Also abort any in-flight sector-stocks or stock-chart fetches from the
      // previous cycle so their stale data can't write into state for the new cycle.
      if (sectorStocksCtrlRef.current) sectorStocksCtrlRef.current.abort()
      if (stockChartCtrlRef.current) stockChartCtrlRef.current.abort()
      const ctrl = new AbortController()
      analysisCtrlRef.current = ctrl
      setAnalysis(null)
      setAnalyzeError('')
      setActiveSector(null)
      sectorStocksRef.current = {}
      setSectorStocks({})
      setSectorLoading({})
      setSelectedStock(null)
      setStockCandles(null)
      setStockError('')
      setAnalyzing(true)
      try {
        // index_id: without it the backend defaults to NEPSE — summary stats then
        // describe a different index than the cycles when Sensitive/sector is selected.
        const { data } = await runDropAnalysis(
          { peak_date: cycle.start_date, trough_date: cycle.end_date, index_id: indexId },
          { signal: ctrl.signal }
        )
        if (ctrl.signal.aborted) return
        setAnalysis(data)
      } catch (e) {
        if (ctrl.signal.aborted || isCanceled(e)) return
        setAnalyzeError(apiError(e, 'Failed to run analysis'))
      }
      if (!ctrl.signal.aborted) setAnalyzing(false)
    },
    [indexId]
  )

  // Tear down the focused-cycle drill-down — aborts in-flight work and clears
  // analysis/sector/stock state. Does NOT touch the selection set.
  const clearAnalysis = useCallback(() => {
    analysisCtrlRef.current?.abort()
    sectorStocksCtrlRef.current?.abort()
    stockChartCtrlRef.current?.abort()
    setAnalysis(null)
    setAnalyzeError('')
    setAnalyzing(false)
    setActiveSector(null)
    setSelectedStock(null)
    setStockCandles(null)
    setStockError('')
    sectorStocksRef.current = {}
    setSectorStocks({})
    setSectorLoading({})
  }, [])

  // Focus drives the right-panel drill-down: focused → run its analysis;
  // unfocused → tear the drill-down down (selection set is untouched).
  useEffect(() => {
    if (focused) runAnalysis(focused)
    else clearAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, runAnalysis, clearAnalysis])

  // Load sector stocks lazily (Rule 45 — abort last superseded sector fetch)
  const sectorStocksCtrlRef = useRef(null)
  const loadSectorStocks = useCallback(async (indexName, peakDate, troughDate) => {
    if (sectorStocksRef.current[indexName] !== undefined) return
    if (sectorStocksCtrlRef.current) sectorStocksCtrlRef.current.abort()
    const ctrl = new AbortController()
    sectorStocksCtrlRef.current = ctrl
    sectorStocksRef.current[indexName] = null
    setSectorLoading((prev) => ({ ...prev, [indexName]: true }))
    try {
      const { data } = await getSectorStocks(
        { sector_index: indexName, peak_date: peakDate, trough_date: troughDate },
        { signal: ctrl.signal }
      )
      if (ctrl.signal.aborted) return
      const stocks = data.stocks || []
      sectorStocksRef.current[indexName] = stocks
      setSectorStocks((prev) => ({ ...prev, [indexName]: stocks }))
    } catch (e) {
      if (ctrl.signal.aborted || isCanceled(e)) {
        // An aborted fetch must not poison the dedupe cache: clear the in-flight
        // marker and the loading flag so a later click on this sector retries
        // instead of showing a stuck skeleton forever.
        delete sectorStocksRef.current[indexName]
        setSectorLoading((prev) => ({ ...prev, [indexName]: false }))
        return
      }
      sectorStocksRef.current[indexName] = []
      setSectorStocks((prev) => ({ ...prev, [indexName]: [] }))
    }
    if (!ctrl.signal.aborted) setSectorLoading((prev) => ({ ...prev, [indexName]: false }))
  }, [])

  const handleSectorClick = useCallback(
    (sector) => {
      if (!focused) return
      const isNepse = sector.index_name === 'NEPSE'
      const next = activeSector?.index_name === sector.index_name ? null : sector
      setActiveSector(next)
      setSelectedStock(null)
      setStockCandles(null)
      setStockError('')
      if (next && !isNepse) {
        loadSectorStocks(next.index_name, focused.start_date, focused.end_date)
      }
    },
    [focused, activeSector, loadSectorStocks]
  )

  // Stock chart (ctrl ref hoisted above with the others)
  const loadStockChart = useCallback(
    async (stock) => {
      if (!focused) return
      if (stockChartCtrlRef.current) stockChartCtrlRef.current.abort()
      const ctrl = new AbortController()
      stockChartCtrlRef.current = ctrl
      setSelectedStock(stock)
      setStockCandles(null)
      setStockLoading(true)
      setStockError('')
      try {
        const addDays = (iso, n) => {
          const d = new Date(iso + 'T00:00:00Z')
          d.setUTCDate(d.getUTCDate() + n)
          return d.toISOString().slice(0, 10)
        }
        const fromStr = addDays(focused.start_date, -20)
        const today = new Date().toISOString().slice(0, 10)
        const rawTo = addDays(focused.end_date, 120)
        const toStr = rawTo < today ? rawTo : today
        const { data } = await getStockPriceRange(
          { symbol: stock.symbol, from: fromStr, to: toStr },
          { signal: ctrl.signal }
        )
        if (!ctrl.signal.aborted) setStockCandles(data.candles || [])
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setStockError(apiError(e, 'Failed to load stock chart'))
          setStockCandles([])
        }
      }
      if (!ctrl.signal.aborted) setStockLoading(false)
    },
    [focused]
  )

  const handleStockSelect = useCallback(
    (stock) => {
      if (!stock || selectedStock?.symbol === stock.symbol) {
        setSelectedStock(null)
        setStockCandles(null)
        setStockError('')
      } else {
        loadStockChart(stock)
      }
    },
    [selectedStock, loadStockChart]
  )

  const toggleSort = useCallback(
    (col) => {
      if (sortBy === col) setSortAsc((a) => !a)
      else {
        setSortBy(col)
        setSortAsc(false)
      }
    },
    [sortBy]
  )

  // Derived values (memoized — Rule 37)
  const sectors = useMemo(() => analysis?.sectors || [], [analysis])
  const summary = analysis?.summary
  const maxMoveAbs = useMemo(
    () => Math.max(...sectors.map((s) => Math.abs(s.drop_pct || 0)), 1),
    [sectors]
  )

  const nepseRow = useMemo(
    () =>
      summary
        ? {
            index_name: 'NEPSE',
            drop_pct: summary.drop_pct,
            drop_pts: summary.drop_pts,
            vs_nepse: null,
            recovery_pct: summary.recovery_pct,
            recovery_progress: summary.recovery_progress,
            recovery_days: summary.recovery_days,
            fully_recovered: summary.fully_recovered,
            stock_count: null,
            trading_days: summary.duration_days,
          }
        : null,
    [summary]
  )

  const sortedSectors = useMemo(
    () =>
      [...sectors].sort((a, b) => {
        const av = a[sortBy] ?? 0,
          bv = b[sortBy] ?? 0
        const diff = sortAsc ? av - bv : bv - av
        return diff !== 0 ? diff : (a.index_name ?? '').localeCompare(b.index_name ?? '')
      }),
    [sectors, sortBy, sortAsc]
  )

  const matrixRows = useMemo(
    () => (nepseRow ? [nepseRow, ...sortedSectors] : sortedSectors),
    [nepseRow, sortedSectors]
  )

  const bearCycles = useMemo(() => cycles.filter((c) => c.type === 'bear'), [cycles])
  const bullCycles = useMemo(() => cycles.filter((c) => c.type === 'bull'), [cycles])
  const filteredCycles = useMemo(
    () => (cycleFilter === 'all' ? cycles : cycles.filter((c) => c.type === cycleFilter)),
    [cycles, cycleFilter]
  )

  // Selected bears/bulls feed the default (no-focus) right-panel aggregate stats.
  const selectedBears = useMemo(
    () => sel.selectedCycles.filter((c) => c.type === 'bear'),
    [sel.selectedCycles]
  )
  const selectedBulls = useMemo(
    () => sel.selectedCycles.filter((c) => c.type === 'bull'),
    [sel.selectedCycles]
  )

  const selectedIndexLabel = INDEX_OPTIONS.find((o) => o.id === indexId)?.label || 'NEPSE'
  const thresholdDirty =
    cycles.length > 0 && Math.min(50, Math.max(5, parseFloat(threshold) || 10)) !== ranThreshold
  const focusedKey = focused ? cycleKey(focused) : null

  const cycleCandles = useMemo(() => {
    if (!focused || !allCandles.length) return []
    const from = new Date(focused.start_date)
    from.setDate(from.getDate() - 30)
    const to = new Date(focused.end_date)
    to.setDate(to.getDate() + 200)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)
    return allCandles.filter((c) => c.date >= fromStr && c.date <= toStr)
  }, [focused, allCandles])

  // Quick-chip row (shared by left panel + mobile sheet)
  const quickChips = (
    <div className="flex flex-wrap items-center gap-1">
      {[
        ['All', sel.selectAll],
        ['Bulls', sel.selectBulls],
        ['Bears', sel.selectBears],
        ['Last bull', sel.selectLastBull],
        ['Clear', sel.clear],
      ].map(([label, fn]) => (
        <button
          key={label}
          onClick={fn}
          className={`px-1.5 py-0.5 rounded ${LABEL} normal-case border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  // Cycle-filter tabs (shared by left panel + mobile sheet)
  const filterTabs = (padY) => (
    <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
      {[
        ['all', 'All'],
        ['bear', 'Bear'],
        ['bull', 'Bull'],
      ].map(([v, l]) => (
        <button
          key={v}
          onClick={() => setCycleFilter(v)}
          className={`flex-1 ${padY} text-[10px] font-semibold transition-colors
            ${
              cycleFilter === v
                ? v === 'bear'
                  ? 'text-red-500 border-b-2 border-red-500'
                  : v === 'bull'
                    ? 'text-emerald-500 border-b-2 border-emerald-500'
                    : 'text-gray-700 dark:text-gray-200 border-b-2 border-gray-700 dark:border-gray-200'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
        >
          {l}{' '}
          {v === 'bear' ? bearCycles.length : v === 'bull' ? bullCycles.length : cycles.length}
        </button>
      ))}
    </div>
  )

  // Toolbar — index pills moved to the left panel (spec §2.2); threshold +
  // Detect + counts + mobile cycles button stay here.
  const toolbar = useToolbarSlot(
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
      <div className="flex items-center gap-1 shrink-0">
        <span className={`${LABEL} normal-case`}>Swing ≥</span>
        <input
          type="number"
          value={threshold}
          min={5}
          max={50}
          step={1}
          onChange={(e) => setThreshold(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') detectCycles(threshold, indexId)
          }}
          className="w-10 text-[10px] font-semibold text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <span className={`${LABEL} normal-case`}>%</span>
        {/* Amber = input differs from the threshold the visible cycles were detected with */}
        <button
          onClick={() => detectCycles(threshold, indexId)}
          disabled={detecting}
          title={thresholdDirty ? 'Threshold changed — press Detect to re-run' : undefined}
          className={`px-2 py-0.5 rounded text-[10px] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity ${
            thresholdDirty
              ? 'bg-amber-500 text-white'
              : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
          }`}
        >
          {detecting ? '…' : 'Detect'}
        </button>
      </div>

      {cycles.length > 0 && (
        <span className={`${LABEL} normal-case hidden sm:inline`}>
          {bearCycles.length}▼ {bullCycles.length}▲ · {selectedIndexLabel}
        </span>
      )}

      {cycles.length > 0 && (
        <button
          className="lg:hidden flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
          onClick={() => setMobileCycles(true)}
        >
          {focused
            ? `${focused.type === 'bear' ? '▼' : '▲'} ${focused.name || focused.start_date?.slice(0, 7)}`
            : `Cycles (${cycles.length})`}
        </button>
      )}
    </div>
  )

  // Cycle checklist (shared by left panel + mobile sheet). `onRowClick` differs.
  const cycleChecklist = (onRowClick) => (
    <>
      {filteredCycles.map((c) => (
        <CyclePill
          key={`${c.type}-${c.start_date}`}
          cycle={c}
          active={focusedKey === cycleKey(c)}
          selected={sel.isSelected(c)}
          onClick={() => onRowClick(c)}
        />
      ))}
      {!detecting && filteredCycles.length === 0 && (
        <div className="flex items-center justify-center py-6 text-[10px] text-gray-400">
          No {cycleFilter !== 'all' ? cycleFilter : ''} cycles detected
        </div>
      )}
    </>
  )

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 overflow-hidden">
      {toolbar}

      {detectError && (
        <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/40 text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{detectError}</span>
          <button
            onClick={() => setDetectError('')}
            className="text-red-400 hover:text-red-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── LEFT PANEL (desktop ≥ lg) — index + quick chips + cycle checklist ── */}
        <CollapsiblePanel
          side="left"
          open={leftOpen}
          widthCls="w-[200px] min-w-[180px] max-w-[220px]"
        >
          <div className="shrink-0 px-2 py-2 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <IndexSelector options={INDEX_OPTIONS} activeId={indexId} onSelect={handleIndexSelect} />
            {quickChips}
          </div>
          {filterTabs('py-1.5')}
          {detecting && <Skeleton minH={120} />}
          <div className="flex-1 min-h-0 overflow-y-auto bg-white/40 dark:bg-gray-950/40">
            {cycleChecklist((c) => sel.toggle(c))}
          </div>
        </CollapsiblePanel>

        {/* ── CENTER ── */}
        <main className="relative flex-1 min-w-0 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col gap-3 p-3 bg-gray-50/50 dark:bg-gray-950/40">
          <PanelToggle side="left" open={leftOpen} onToggle={toggleLeft} label="cycle list" />
          <PanelToggle side="right" open={rightOpen} onToggle={toggleRight} label="detail panel" />

          {/* Mini overview — explicit detecting/empty/ready states (no ambiguous blank box) */}
          <div className={`${CARD} overflow-hidden shrink-0`}>
            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
              <span className={STITLE}>{selectedIndexLabel} — Full History</span>
              <div className="flex items-center gap-2">
                <span className={`${LABEL} normal-case hidden sm:inline`}>
                  {detecting
                    ? 'Detecting…'
                    : allCandles.length === 0
                      ? 'No data'
                      : 'Click a shaded zone'}
                </span>
                <ViewSwitcher
                  views={RANGE_VIEWS}
                  active={range}
                  onChange={setRange}
                  ariaLabel="Overview range"
                />
              </div>
            </div>
            {detecting && allCandles.length === 0 ? (
              <Skeleton minH={160} />
            ) : allCandles.length === 0 ? (
              <div className="h-[160px] flex items-center justify-center text-[11px] text-gray-400">
                No price data available
              </div>
            ) : (
              <MiniOverview
                candles={allCandles}
                cycles={cycles}
                selectedKeys={sel.selectedKeys}
                focusedKey={focusedKey}
                onCycleClick={sel.toggle}
                dark={isDark}
                range={range}
              />
            )}
          </div>

          {/* Top Movers + Consistency for the SELECTED cycles — fills the rest */}
          <CycleAnalyticsCards selectedCycles={sel.selectedCycles} />

          {/* Mobile-only detail (no right panel below lg) — focused cycle drill-down */}
          {focused && (
            <div className="lg:hidden space-y-3">
              <div className={`${CARD} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[11px] font-black ${focused.type === 'bull' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {focused.type === 'bull' ? '▲' : '▼'}{' '}
                    {focused.name || (focused.type === 'bull' ? 'Bull' : 'Bear')}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${phaseCls(focused.phase)}`}
                  >
                    {focused.phase}
                  </span>
                  <span
                    className={`text-[15px] font-black tabular-nums ml-auto
                    ${focused.type === 'bull' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {focused.pct >= 0 ? '+' : ''}
                    {focused.pct?.toFixed(1)}%
                  </span>
                </div>
                {selectedStock ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => handleStockSelect(selectedStock)}
                        className="text-[10px] text-gray-400"
                      >
                        ← back
                      </button>
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">
                        {selectedStock.symbol}
                      </span>
                    </div>
                    {stockLoading ? (
                      <Skeleton minH={220} />
                    ) : (
                      <PriceChart
                        candles={stockCandles}
                        startDate={focused.start_date}
                        endDate={focused.end_date}
                        type={focused.type}
                        dark={isDark}
                        label={selectedStock.symbol}
                        height={220}
                      />
                    )}
                  </>
                ) : activeSector && activeSector.index_name !== 'NEPSE' ? (
                  <SectorIndexChart sector={activeSector} cycle={focused} dark={isDark} />
                ) : (
                  <PriceChart
                    candles={cycleCandles}
                    startDate={focused.start_date}
                    endDate={focused.end_date}
                    type={focused.type}
                    dark={isDark}
                    label={selectedIndexLabel}
                    height={220}
                  />
                )}
              </div>

              {/* Sector matrix (mobile) */}
              {analyzeError && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
                  <span>{analyzeError}</span>
                  <button onClick={() => setAnalyzeError('')} className="font-bold ml-4">
                    ×
                  </button>
                </div>
              )}
              {analyzing ? (
                <div className={`${CARD}`}>
                  <Skeleton minH={260} />
                </div>
              ) : sectors.length === 0 ? (
                <div
                  className={`${CARD} flex items-center justify-center py-6 text-[11px] text-gray-400`}
                >
                  No sector data for this cycle
                </div>
              ) : (
                <SectorMatrix
                  rows={matrixRows}
                  activeSectorName={activeSector?.index_name}
                  onRowClick={handleSectorClick}
                  cycleType={focused.type}
                  sortBy={sortBy}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                  maxMoveAbs={maxMoveAbs}
                />
              )}

              {activeSector && activeSector.index_name !== 'NEPSE' && (
                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                    <span className={STITLE}>{stripIndexName(activeSector.index_name)}</span>
                    <button
                      onClick={() => handleSectorClick(activeSector)}
                      className="text-gray-300 hover:text-gray-500 text-[14px] leading-none ml-auto"
                    >
                      ×
                    </button>
                  </div>
                  <div className="max-h-[260px] overflow-auto">
                    <StockList
                      stocks={sectorStocks[activeSector.index_name]}
                      loading={!!sectorLoading[activeSector.index_name]}
                      onSelect={handleStockSelect}
                      selected={selectedStock}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT PANEL (desktop ≥ lg) — default aggregate stats / focused drill-down ── */}
        <CollapsiblePanel
          side="right"
          open={rightOpen}
          widthCls="w-[360px] lg:w-[420px] min-w-[300px]"
        >
          {!focused ? (
            <div className="flex-1 min-h-0 overflow-y-auto bg-white/40 dark:bg-gray-950/40 p-3 space-y-3">
              <div className={`${CARD} p-3`}>
                <p className={`${LABEL} text-gray-400 mb-1`}>
                  {sel.selectedCycles.length} cycle{sel.selectedCycles.length === 1 ? '' : 's'}{' '}
                  selected
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                  Click a zone to drill into sectors.
                </p>
              </div>
              <AggregateStats bearCycles={selectedBears} bullCycles={selectedBulls} />
            </div>
          ) : (
            <>
              {/* Header — text colors bumped to -700/-300 for AA contrast on tinted bg */}
              <div
                className={`shrink-0 px-3 py-2 border-b
                ${
                  focused.type === 'bull'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40'
                    : 'bg-red-50/70 dark:bg-red-950/20 border-red-100 dark:border-red-900/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[11px] font-black ${focused.type === 'bull' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
                  >
                    {focused.type === 'bull' ? '▲' : '▼'}{' '}
                    {focused.name || (focused.type === 'bull' ? 'Bull' : 'Bear')}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${phaseCls(focused.phase)}`}
                  >
                    {focused.phase}
                  </span>
                  <span
                    className={`text-[18px] font-black tabular-nums ml-auto
                    ${focused.type === 'bull' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
                  >
                    {focused.pct >= 0 ? '+' : ''}
                    {focused.pct?.toFixed(1)}%
                  </span>
                  <button
                    onClick={() => sel.setFocused(null)}
                    aria-label="Close cycle detail"
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 text-[13px] leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mb-1">
                  {focused.start_date} → {focused.end_date} · {focused.duration_days}d
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                  {focused.start_close != null && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>From </span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                        {(+focused.start_close).toLocaleString()}
                      </span>
                    </span>
                  )}
                  {focused.end_close != null && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>To </span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                        {(+focused.end_close).toLocaleString()}
                      </span>
                    </span>
                  )}
                  {focused.type === 'bear' && focused.recovery_needed_pct != null && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>Need </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{focused.recovery_needed_pct.toFixed(1)}%
                      </span>
                    </span>
                  )}
                  {focused.type === 'bear' && focused.recovery_date && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>Recovered </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {focused.recovery_date}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto bg-white/40 dark:bg-gray-950/40 p-3 space-y-3">
                {/* Chart: cycle / sector / stock */}
                <div className={`${CARD} p-2`}>
                  {selectedStock ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => handleStockSelect(selectedStock)}
                          className="text-[10px] text-gray-400 hover:text-gray-600"
                        >
                          ← back
                        </button>
                        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">
                          {selectedStock.symbol}
                        </span>
                        <span
                          className={`text-[10px] font-bold ml-auto ${pctTextCls(selectedStock.drop_pct)}`}
                        >
                          {selectedStock.drop_pct != null
                            ? `${selectedStock.drop_pct >= 0 ? '+' : ''}${selectedStock.drop_pct.toFixed(1)}%`
                            : ''}
                        </span>
                      </div>
                      {stockError && (
                        <div className="text-[10px] text-red-500 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded mb-1">
                          {stockError}
                        </div>
                      )}
                      {stockLoading ? (
                        <Skeleton minH={260} />
                      ) : (
                        <PriceChart
                          candles={stockCandles}
                          startDate={focused.start_date}
                          endDate={focused.end_date}
                          type={focused.type}
                          dark={isDark}
                          label={selectedStock.symbol}
                          height={260}
                        />
                      )}
                    </div>
                  ) : activeSector && activeSector.index_name !== 'NEPSE' ? (
                    <SectorIndexChart sector={activeSector} cycle={focused} dark={isDark} />
                  ) : (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 font-mono">
                        {selectedIndexLabel}
                      </p>
                      <PriceChart
                        candles={cycleCandles}
                        startDate={focused.start_date}
                        endDate={focused.end_date}
                        type={focused.type}
                        dark={isDark}
                        label={selectedIndexLabel}
                        height={260}
                      />
                    </div>
                  )}
                </div>

                {/* Stat strip */}
                {summary && (
                  <div
                    className={`${CARD} px-3 py-2 flex divide-x divide-gray-100 dark:divide-gray-800`}
                  >
                    <Stat
                      l="Move"
                      v={`${focused.pct >= 0 ? '+' : ''}${focused.pct?.toFixed(1)}%`}
                      tone={focused.type === 'bull' ? 'green' : 'red'}
                    />
                    <Stat l="Days" v={`${focused.duration_days}`} />
                    {focused.type === 'bear' && (
                      <>
                        <Stat
                          l="Rec %"
                          v={
                            summary.recovery_pct != null
                              ? `${summary.recovery_pct >= 0 ? '+' : ''}${summary.recovery_pct.toFixed(1)}%`
                              : '—'
                          }
                          tone={summary.recovery_pct > 0 ? 'green' : 'gray'}
                        />
                        <Stat
                          l="Rec d"
                          v={focused.recovery_days != null ? `${focused.recovery_days}` : '—'}
                          tone={focused.recovery_date ? 'green' : 'amber'}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* Sector matrix — moved here from center (drill-down is focus-driven) */}
                {analyzeError && (
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
                    <span>{analyzeError}</span>
                    <button onClick={() => setAnalyzeError('')} className="font-bold ml-4">
                      ×
                    </button>
                  </div>
                )}
                {analyzing ? (
                  <div className={`${CARD}`}>
                    <Skeleton minH={200} />
                  </div>
                ) : sectors.length === 0 ? (
                  <div
                    className={`${CARD} flex items-center justify-center py-6 text-[11px] text-gray-400`}
                  >
                    No sector data for this cycle
                  </div>
                ) : (
                  <div className={`${CARD} overflow-hidden`}>
                    <div className="max-h-[320px] overflow-y-auto">
                      <SectorMatrix
                        rows={matrixRows}
                        activeSectorName={activeSector?.index_name}
                        onRowClick={handleSectorClick}
                        cycleType={focused.type}
                        sortBy={sortBy}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                        maxMoveAbs={maxMoveAbs}
                      />
                    </div>
                  </div>
                )}

                {/* Sector zoom: stocks inline */}
                {activeSector && activeSector.index_name !== 'NEPSE' && (
                  <div className={`${CARD} overflow-hidden`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                      <span className={STITLE}>{stripIndexName(activeSector.index_name)}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">click to chart</span>
                      <button
                        onClick={() => handleSectorClick(activeSector)}
                        className="text-gray-300 hover:text-gray-500 text-[14px] leading-none"
                      >
                        ×
                      </button>
                    </div>
                    <div className="max-h-[320px] overflow-auto">
                      <StockList
                        stocks={sectorStocks[activeSector.index_name]}
                        loading={!!sectorLoading[activeSector.index_name]}
                        onSelect={handleStockSelect}
                        selected={selectedStock}
                      />
                    </div>
                  </div>
                )}

                {/* Resilience tile (bear only, after analysis) */}
                {focused.type === 'bear' && !analyzing && sectors.length > 0 && (
                  <ResilientTile sectors={[...(nepseRow ? [nepseRow] : []), ...sectors]} />
                )}
              </div>
            </>
          )}
        </CollapsiblePanel>
      </div>

      {/* Mobile cycles sheet */}
      {mobileCycles && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={() => setMobileCycles(false)}
          />
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
                          bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t
                          border-gray-200 dark:border-gray-800"
            style={{ height: '72vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                {cycles.length} Cycles · {selectedIndexLabel}
              </span>
              <button
                onClick={() => setMobileCycles(false)}
                aria-label="Close cycles sheet"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[14px]"
              >
                ✕
              </button>
            </div>
            <div className="shrink-0 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              {quickChips}
            </div>
            {filterTabs('py-2')}
            <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-900">
              {cycleChecklist((c) => sel.toggle(c))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
