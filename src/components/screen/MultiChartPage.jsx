// === MultiChartPage.jsx — multi-panel chart view: 2/3/4 layout, per-panel symbol+timeframe, data sync, crosshair sync ===
import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
import StockChart from './StockChart'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'
import { getMarketSymbols } from '../../utils/globalCache'
import { ToolbarDivider, ToolbarToggleChip } from './ScreenToolbarAtoms'
import SymbolSearch from '../common/SymbolSearch'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_PANEL = {
  symbol: 'NEPSE',
  indexId: 12,
  isIndex: true,
  timeframe: '1Y',
  companyName: null,
}
const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']
const MAX_PANELS = 4

// ── Session storage helpers ───────────────────────────────────────────────────
function loadState() {
  try {
    const r = sessionStorage.getItem('multichart_state')
    if (r) return JSON.parse(r)
  } catch {}
  return null
}
function saveState(s) {
  try {
    sessionStorage.setItem('multichart_state', JSON.stringify(s))
  } catch {}
}

// ── Layout icon (pure CSS) ────────────────────────────────────────────────────
function LayoutIcon({ layout }) {
  if (layout === 2)
    return (
      <div className="grid grid-cols-2 gap-px w-5 h-3.5 pointer-events-none">
        <div className="rounded-sm bg-current opacity-70" />
        <div className="rounded-sm bg-current opacity-70" />
      </div>
    )
  if (layout === 3)
    return (
      <div
        className="grid gap-px w-5 h-3.5 pointer-events-none"
        style={{
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gridTemplateAreas: '"a b" "c c"',
        }}
      >
        <div className="rounded-sm bg-current opacity-70" style={{ gridArea: 'a' }} />
        <div className="rounded-sm bg-current opacity-70" style={{ gridArea: 'b' }} />
        <div className="rounded-sm bg-current opacity-70" style={{ gridArea: 'c' }} />
      </div>
    )
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-px w-5 h-3.5 pointer-events-none">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-sm bg-current opacity-70" />
      ))}
    </div>
  )
}

// ── Per-panel header ──────────────────────────────────────────────────────────
function PanelHeader({
  panelIdx,
  isActive,
  onActivate,
  onExternalSymbolChange,
  onExternalTimeframeChange,
  allSymbols,
}) {
  const { selectedSymbol, selectSymbol, timeframe, setTimeframe, chartType, setChartType } =
    useScreen()

  const handleTimeframe = useCallback(
    (tf) => {
      setTimeframe(tf)
      onExternalTimeframeChange?.(tf)
    },
    [setTimeframe, onExternalTimeframeChange]
  )

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onActivate(panelIdx)
      }}
      className="shrink-0 flex items-center gap-1 px-2 h-8 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 cursor-pointer select-none overflow-hidden"
    >
      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
      />

      <SymbolSearch
        symbols={allSymbols}
        value={selectedSymbol}
        onSelect={(symbol, indexId, companyName) => {
          selectSymbol(symbol, indexId, null, companyName)
          onExternalSymbolChange?.(symbol, indexId, companyName)
        }}
      />

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={(e) => {
              e.stopPropagation()
              handleTimeframe(tf)
            }}
            className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors whitespace-nowrap ${
              timeframe === tf
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
        {[
          ['candlestick', 'C'],
          ['line', 'L'],
        ].map(([type, label]) => (
          <button
            key={type}
            onClick={(e) => {
              e.stopPropagation()
              setChartType(type)
            }}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
              chartType === type
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <span className="ml-auto pl-1 text-[9px] font-bold text-gray-300 dark:text-gray-600 shrink-0">
        {panelIdx + 1}
      </span>
    </div>
  )
}

// ── SyncBridge ────────────────────────────────────────────────────────────────
function SyncBridge({ onSelectSymbolReady, onSetTimeframeReady }) {
  const { selectSymbol, setTimeframe } = useScreen()
  useEffect(() => {
    onSelectSymbolReady(selectSymbol)
    onSetTimeframeReady(setTimeframe)
  }, [selectSymbol, setTimeframe, onSelectSymbolReady, onSetTimeframeReady])
  return null
}

// ── ChartPanel ────────────────────────────────────────────────────────────────
function ChartPanel({
  panelIdx,
  panelState,
  isActive,
  onActivate,
  onExternalSymbolChange,
  onExternalTimeframeChange,
  onChartReady,
  onSelectSymbolReady,
  onSetTimeframeReady,
  allSymbols,
}) {
  const stableOnChartReady = useCallback(
    (chart, series) => onChartReady(chart, series),
    [onChartReady]
  )
  return (
    <ScreenProvider
      initialSymbol={panelState.symbol}
      initialIndexId={panelState.indexId}
      initialIsIndex={panelState.isIndex}
      initialTimeframe={panelState.timeframe}
      disableMovers
      disablePositions
      disableNavState // FIX MC10: prevents location.state from firing in all panels
    >
      <SyncBridge
        onSelectSymbolReady={onSelectSymbolReady}
        onSetTimeframeReady={onSetTimeframeReady}
      />
      <div
        className={`flex flex-col h-full overflow-hidden border-t-2 transition-colors duration-150 ${
          isActive ? 'border-blue-500' : 'border-transparent'
        }`}
        onClick={() => onActivate(panelIdx)}
      >
        <PanelHeader
          panelIdx={panelIdx}
          isActive={isActive}
          onActivate={onActivate}
          onExternalSymbolChange={onExternalSymbolChange}
          onExternalTimeframeChange={onExternalTimeframeChange}
          allSymbols={allSymbols}
        />
        <div className="flex-1 overflow-hidden min-h-0">
          <StockChart hideToolbar onChartReady={stableOnChartReady} />
        </div>
      </div>
    </ScreenProvider>
  )
}

// ── ChartPanelWrapper (MC02 fix) ──────────────────────────────────────────────
// Memoized wrapper so the grid map doesn't recreate inline arrows every render.
// Generates stable useCallback props from the stable parent handler refs.
const ChartPanelWrapper = memo(function ChartPanelWrapper({
  panelIdx,
  panelState,
  isActive,
  onActivate,
  onExternalSymbolChange: parentSymbolHandler,
  onExternalTimeframeChange: parentTimeframeHandler,
  onChartReady: parentChartReady,
  onSelectSymbolReady: parentSymbolReady,
  onSetTimeframeReady: parentTimeframeReady,
  allSymbols,
}) {
  const handleSymbol = useCallback(
    (sym, indexId, name) => parentSymbolHandler(panelIdx, sym, indexId, name),
    [parentSymbolHandler, panelIdx]
  )
  const handleTimeframe = useCallback(
    (tf) => parentTimeframeHandler(panelIdx, tf),
    [parentTimeframeHandler, panelIdx]
  )
  const handleChartReady = useCallback(
    (chart, series) => parentChartReady(panelIdx, chart, series),
    [parentChartReady, panelIdx]
  )
  const handleSymbolRdy = useCallback(
    (fn) => parentSymbolReady(panelIdx, fn),
    [parentSymbolReady, panelIdx]
  )
  const handleTfRdy = useCallback(
    (fn) => parentTimeframeReady(panelIdx, fn),
    [parentTimeframeReady, panelIdx]
  )

  return (
    <ChartPanel
      panelIdx={panelIdx}
      panelState={panelState}
      isActive={isActive}
      onActivate={onActivate}
      onExternalSymbolChange={handleSymbol}
      onExternalTimeframeChange={handleTimeframe}
      onChartReady={handleChartReady}
      onSelectSymbolReady={handleSymbolRdy}
      onSetTimeframeReady={handleTfRdy}
      allSymbols={allSymbols}
    />
  )
})

// ── Toolbar ───────────────────────────────────────────────────────────────────
// On mobile the layout is fixed at 2 stacked charts, so the 2/3/4 layout switcher
// is hidden — only the Sync + Crosshair toggles render (they wire panel 0 ↔ 1).
function MultiChartToolbar({
  layout,
  setLayout,
  syncData,
  setSyncData,
  syncCross,
  setSyncCross,
  isMobile,
}) {
  return useScreenToolbarSlot(
    <div className="flex items-center gap-1.5 min-w-0">
      {!isMobile && (
        <>
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setLayout(n)}
                className={`flex items-center justify-center w-7 h-5 rounded transition-all ${
                  layout === n
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <LayoutIcon layout={n} />
              </button>
            ))}
          </div>
          <ToolbarDivider />
        </>
      )}

      <ToolbarToggleChip
        label={syncData ? 'Sync ON' : 'Sync'}
        active={syncData}
        onClick={() => setSyncData((v) => !v)}
        activeColor="#2563eb"
      />
      <ToolbarToggleChip
        label={syncCross ? 'Crosshair ON' : 'Crosshair'}
        active={syncCross}
        onClick={() => setSyncCross((v) => !v)}
        activeColor="#7c3aed"
      />
    </div>
  )
}

// ── MultiChartPage ────────────────────────────────────────────────────────────
export default function MultiChartPage() {
  // FIX MC03: lazy initialisers — loadState() runs once, not every render
  const [layout, setLayout] = useState(() => loadState()?.layout ?? 2)
  const [syncData, setSyncData] = useState(() => loadState()?.syncData ?? false)
  const [syncCross, setSyncCross] = useState(() => loadState()?.syncCross ?? false)
  const [activePanel, setActivePanel] = useState(0)

  // Mount only ONE of the mobile/desktop subtrees (declared early so panelCount can
  // depend on it). With CSS-only hiding both were always mounted: desktop built a 5th
  // hidden panel-0 chart, and mobile built all 2–4 desktop charts behind display:none.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const [panels, setPanels] = useState(() => {
    // saveState persists only the active panels (1–4 entries, FIX MC09) — accept any
    // valid length and pad the rest with defaults. Requiring exactly MAX_PANELS here
    // silently discarded saved state for 2/3-panel layouts.
    const s = loadState()?.panels
    if (Array.isArray(s) && s.length > 0 && s.length <= MAX_PANELS) {
      return [
        ...s.map((p) => ({ ...DEFAULT_PANEL, ...p })),
        ...Array(MAX_PANELS - s.length)
          .fill(null)
          .map(() => ({ ...DEFAULT_PANEL })),
      ]
    }
    return Array(MAX_PANELS)
      .fill(null)
      .map(() => ({ ...DEFAULT_PANEL }))
  })

  const selectSymbolRefs = useRef(Array(MAX_PANELS).fill(null))
  const setTimeframeRefs = useRef(Array(MAX_PANELS).fill(null))
  const chartRefs = useRef(Array(MAX_PANELS).fill(null))
  const seriesRefs = useRef(Array(MAX_PANELS).fill(null))
  const syncingRef = useRef(false)
  const syncCrossRef = useRef(syncCross)
  const syncDataRef = useRef(syncData)
  const panelCountRef = useRef(layout)
  useEffect(() => {
    syncCrossRef.current = syncCross
  }, [syncCross])
  useEffect(() => {
    syncDataRef.current = syncData
  }, [syncData])

  // Mobile is locked to 2 stacked charts regardless of the desktop `layout` choice.
  // Driving panelCount this way means the crosshair/data-sync engine, saveState, and
  // grid all operate on exactly the two visible panels with no engine changes.
  const panelCount = isMobile ? 2 : layout
  useEffect(() => {
    panelCountRef.current = panelCount
  }, [panelCount])

  // FIX MC04: debounced saveState — 500ms after last change
  const saveTimerRef = useRef(null)
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    // FIX MC09: persist only panels that are currently active
    saveTimerRef.current = setTimeout(() => {
      saveState({ layout, syncData, syncCross, panels: panels.slice(0, panelCount) })
    }, 500)
    return () => clearTimeout(saveTimerRef.current)
  }, [layout, syncData, syncCross, panels, panelCount])

  const handleSelectSymbolReady = useCallback((idx, fn) => {
    selectSymbolRefs.current[idx] = fn
  }, [])
  const handleSetTimeframeReady = useCallback((idx, fn) => {
    setTimeframeRefs.current[idx] = fn
  }, [])

  const handleExternalSymbolChange = useCallback((sourceIdx, sym, indexId, companyName) => {
    setPanels((prev) =>
      prev.map((p, i) =>
        i === sourceIdx
          ? {
              ...p,
              symbol: sym,
              indexId: indexId ?? p.indexId,
              isIndex: indexId != null,
              companyName: companyName ?? null,
            }
          : p
      )
    )
    if (!syncDataRef.current) return
    selectSymbolRefs.current.forEach((fn, i) => {
      if (i === sourceIdx || i >= panelCountRef.current || !fn) return
      fn(sym, indexId ?? null, null, companyName ?? null)
    })
  }, [])

  const handleExternalTimeframeChange = useCallback((sourceIdx, tf) => {
    setPanels((prev) => prev.map((p, i) => (i === sourceIdx ? { ...p, timeframe: tf } : p)))
    if (!syncDataRef.current) return
    setTimeframeRefs.current.forEach((fn, i) => {
      if (i === sourceIdx || i >= panelCountRef.current || !fn) return
      fn(tf)
    })
  }, [])

  const [allSymbols, setAllSymbols] = useState(null)
  useEffect(() => {
    getMarketSymbols()
      .then((r) => {
        if (r.data?.stocks?.length) setAllSymbols(r.data)
      })
      .catch(() => {})
  }, [])

  const rewireTimerRef = useRef(null)
  const triggerRewireRef = useRef(null) // set by crosshair effect to its rewire fn

  const handleChartReady = useCallback((idx, chart, series) => {
    chartRefs.current[idx] = chart
    seriesRefs.current[idx] = series
    if (!syncCrossRef.current) return
    // Debounce: panels load in rapid succession — wait 200ms for all to settle
    clearTimeout(rewireTimerRef.current)
    rewireTimerRef.current = setTimeout(() => triggerRewireRef.current?.(), 200)
  }, [])

  // Central crosshair sync.
  // Wires every unique panel pair bidirectionally. Exposed via triggerRewireRef so
  // handleChartReady can re-wire after a symbol change without a state update.
  const allUnsubsRef = useRef([])

  function unsub() {
    allUnsubsRef.current.forEach((fn) => {
      try {
        fn()
      } catch (_) {}
    })
    allUnsubsRef.current = []
  }

  function wireCrosshair(n) {
    unsub()

    function sub(src, srcS, tgt, tgtS) {
      try {
        const u = src.subscribeCrosshairMove((p) => {
          if (syncingRef.current) return
          syncingRef.current = true
          try {
            if (!p.time || !p.point) {
              tgt.clearCrosshairPosition()
            } else {
              const bar = p.seriesData?.get(srcS)
              const price = bar?.close ?? bar?.value ?? null
              if (price != null) tgt.setCrosshairPosition(price, p.time, tgtS)
            }
          } catch (_) {}
          syncingRef.current = false
        })
        if (u) allUnsubsRef.current.push(u)
      } catch (_) {}
      try {
        const uR = src.timeScale().subscribeVisibleLogicalRangeChange((r) => {
          if (syncingRef.current || !r) return
          syncingRef.current = true
          try {
            tgt.timeScale().setVisibleLogicalRange(r)
          } catch (_) {}
          syncingRef.current = false
        })
        if (uR) allUnsubsRef.current.push(uR)
      } catch (_) {}
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ci = chartRefs.current[i],
          si = seriesRefs.current[i]
        const cj = chartRefs.current[j],
          sj = seriesRefs.current[j]
        if (!ci || !si || !cj || !sj) continue
        sub(ci, si, cj, sj)
        sub(cj, sj, ci, si)
      }
    }
  }

  useEffect(() => {
    unsub()
    if (!syncCross) {
      triggerRewireRef.current = null
      return
    }

    let attempts = 0
    let tid

    function tryWire() {
      const n = panelCount
      for (let i = 0; i < n; i++) {
        if (!chartRefs.current[i] || !seriesRefs.current[i]) {
          if (++attempts < 40) {
            tid = setTimeout(tryWire, 150)
            return
          }
          return
        }
      }
      wireCrosshair(n)
      triggerRewireRef.current = () => wireCrosshair(panelCountRef.current)
    }

    tid = setTimeout(tryWire, 300)
    return () => {
      clearTimeout(tid)
      clearTimeout(rewireTimerRef.current)
      triggerRewireRef.current = null
      unsub()
    }
  }, [syncCross, panelCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const gridStyle = useMemo(() => {
    if (layout === 3)
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gridTemplateAreas: '"p0 p1" "p2 p2"',
        flex: 1,
        minHeight: 0,
      }
    if (layout === 4)
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        flex: 1,
        minHeight: 0,
      }
    return {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr',
      flex: 1,
      minHeight: 0,
    }
  }, [layout])

  const panelStyle = (idx) => {
    const base = { minHeight: 0, overflow: 'hidden' }
    if (layout === 3) return { ...base, gridArea: `p${idx}` }
    return base
  }

  const panelBorderClass = (idx) => {
    const parts = ['flex flex-col border-gray-100 dark:border-gray-800']
    if (idx % 2 === 0) parts.push('border-r')
    if (layout === 4 && idx < 2) parts.push('border-b')
    if (layout === 3 && idx < 2) parts.push('border-b')
    return parts.join(' ')
  }

  return (
    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
      <MultiChartToolbar
        layout={layout}
        setLayout={setLayout}
        syncData={syncData}
        setSyncData={setSyncData}
        syncCross={syncCross}
        setSyncCross={setSyncCross}
        isMobile={isMobile}
      />

      {isMobile ? (
        /* Mobile: exactly two charts stacked 50/50 (panelCount is forced to 2 above).
           Real handleChartReady is wired for both panels so the Sync + Crosshair
           toggles actually link panel 0 ↔ panel 1 — same engine the desktop grid uses. */
        <div className="flex flex-col flex-1 min-h-0">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className={`flex flex-col flex-1 min-h-0 overflow-hidden ${
                idx === 0 ? 'border-b border-gray-100 dark:border-gray-800' : ''
              }`}
            >
              <ChartPanelWrapper
                panelIdx={idx}
                panelState={panels[idx]}
                isActive={activePanel === idx}
                onActivate={setActivePanel}
                onExternalSymbolChange={handleExternalSymbolChange}
                onExternalTimeframeChange={handleExternalTimeframeChange}
                onChartReady={handleChartReady}
                onSelectSymbolReady={handleSelectSymbolReady}
                onSetTimeframeReady={handleSetTimeframeReady}
                allSymbols={allSymbols}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Desktop grid — FIX MC02: ChartPanelWrapper is memo'd, stable parent handlers
           passed as props. No inline arrows in the map → SyncBridge re-fires only when
           actually needed (symbol/timeframe change), not every render. */
        <div className="flex flex-col flex-1 min-h-0">
          <div style={gridStyle}>
            {Array.from({ length: panelCount }).map((_, idx) => (
              <div key={idx} style={panelStyle(idx)} className={panelBorderClass(idx)}>
                <ChartPanelWrapper
                  panelIdx={idx}
                  panelState={panels[idx]}
                  isActive={activePanel === idx}
                  onActivate={setActivePanel}
                  onExternalSymbolChange={handleExternalSymbolChange}
                  onExternalTimeframeChange={handleExternalTimeframeChange}
                  onChartReady={handleChartReady}
                  onSelectSymbolReady={handleSelectSymbolReady}
                  onSetTimeframeReady={handleSetTimeframeReady}
                  allSymbols={allSymbols}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
