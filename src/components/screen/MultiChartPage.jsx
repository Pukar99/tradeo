// === MultiChartPage.jsx — multi-panel chart view: 2/3/4 layout, per-panel symbol+timeframe, data sync, crosshair sync ===
import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
import StockChart from './StockChart'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'
import { getMarketSymbols } from '../../utils/globalCache'

// ── useFixedDropdown ──────────────────────────────────────────────────────────
function useFixedDropdown(align = 'left') {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const triggerRef      = useRef(null)

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!open) return
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [open, updateRect])

  useEffect(() => {
    if (!open) return
    const fn = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const dropStyle = rect ? {
    position: 'fixed',
    top: rect.bottom + 4,
    ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    zIndex: 9999,
  } : {}

  const portal = useCallback((content) => {
    if (!open || !rect) return null
    return createPortal(<div style={dropStyle}>{content}</div>, document.body)
  }, [open, rect, dropStyle]) // eslint-disable-line react-hooks/exhaustive-deps

  return { triggerRef, open, setOpen, portal, updateRect }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_PANEL = { symbol: 'NEPSE', indexId: 12, isIndex: true, timeframe: '1Y', companyName: null }
const TIMEFRAMES    = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']
const MAX_PANELS    = 4

// ── Session storage helpers ───────────────────────────────────────────────────
function loadState() {
  try { const r = sessionStorage.getItem('multichart_state'); if (r) return JSON.parse(r) } catch {}
  return null
}
function saveState(s) {
  try { sessionStorage.setItem('multichart_state', JSON.stringify(s)) } catch {}
}

// ── Layout icon (pure CSS) ────────────────────────────────────────────────────
function LayoutIcon({ layout }) {
  if (layout === 2) return (
    <div className="grid grid-cols-2 gap-px w-5 h-3.5 pointer-events-none">
      <div className="rounded-sm bg-current opacity-70" /><div className="rounded-sm bg-current opacity-70" />
    </div>
  )
  if (layout === 3) return (
    <div className="grid gap-px w-5 h-3.5 pointer-events-none"
      style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gridTemplateAreas: '"a b" "c c"' }}>
      <div className="rounded-sm bg-current opacity-70" style={{ gridArea: 'a' }} />
      <div className="rounded-sm bg-current opacity-70" style={{ gridArea: 'b' }} />
      <div className="rounded-sm bg-current opacity-70" style={{ gridArea: 'c' }} />
    </div>
  )
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-px w-5 h-3.5 pointer-events-none">
      {[0,1,2,3].map(i => <div key={i} className="rounded-sm bg-current opacity-70" />)}
    </div>
  )
}

// ── Symbol search ─────────────────────────────────────────────────────────────
function PanelSymbolSearch({ onExternalChange }) {
  const { selectedSymbol, selectSymbol } = useScreen()
  const [query,   setQuery]   = useState('')
  const [symbols, setSymbols] = useState({ stocks: [], indexes: [] })
  const [cursor,  setCursor]  = useState(-1)
  const inputRef              = useRef(null)
  const listRef               = useRef(null)
  const mouseDownInList       = useRef(false)
  const { triggerRef, open, setOpen, portal, updateRect } = useFixedDropdown('left')

  useEffect(() => {
    getMarketSymbols()
      .then(r => { if (r.data?.stocks?.length) setSymbols(r.data) })
      .catch(() => {})
  }, [])

  const allItems = useMemo(() => [
    ...symbols.indexes.map(i => ({ label: i.name, sub: 'Index', indexId: i.index_id, companyName: null })),
    ...symbols.stocks.map(s => ({ label: s.symbol, sub: 'Stock', indexId: null, companyName: s.company_name || null })),
  ], [symbols])

  const q = query.toLowerCase()
  const filtered = query.length < 1
    ? allItems.slice(0, 20)
    : allItems
        .filter(i => i.label.toLowerCase().startsWith(q) || i.label.toLowerCase().includes(q) || (i.companyName && i.companyName.toLowerCase().includes(q)))
        .sort((a, b) => (a.label.toLowerCase().startsWith(q) ? 0 : 1) - (b.label.toLowerCase().startsWith(q) ? 0 : 1))
        .slice(0, 30)

  const handleSelect = useCallback((item) => {
    selectSymbol(item.label, item.indexId ?? null, null, item.companyName ?? null)
    onExternalChange?.(item.label, item.indexId ?? null, item.companyName ?? null)
    setQuery(''); setOpen(false); setCursor(-1)
  }, [selectSymbol, onExternalChange, setOpen])

  function handleKey(e) {
    if (!open) { setOpen(true); updateRect(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') {
      const target = cursor >= 0 ? filtered[cursor] : filtered[0]
      if (target) handleSelect(target)
    }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <div className="shrink-0" ref={triggerRef}
      onClick={() => { setOpen(true); updateRect(); setTimeout(() => inputRef.current?.focus(), 30) }}>
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value.toUpperCase()); setOpen(true); updateRect(); setCursor(-1) }}
          onFocus={() => { setOpen(true); updateRect() }}
          onBlur={() => { if (!mouseDownInList.current) setOpen(false) }}
          onKeyDown={handleKey}
          placeholder={selectedSymbol}
          autoComplete="off"
          spellCheck={false}
          className="bg-transparent text-[10px] font-bold text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 outline-none w-[52px] uppercase"
        />
      </div>

      {portal(
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden" style={{ width: 240, maxHeight: 280, overflowY: 'auto' }}>
          {filtered.length > 0 ? (
            <ul ref={listRef}>
              {filtered.map((item, i) => {
                const isActive = i === cursor || (cursor === -1 && i === 0 && query.length > 0)
                return (
                  <li key={item.label}
                    onMouseDown={() => { mouseDownInList.current = true; handleSelect(item); mouseDownInList.current = false }}
                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-950/60' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.label}</span>
                      {item.companyName && <span className="text-[10px] text-gray-400 truncate leading-tight">{item.companyName}</span>}
                    </div>
                    <span className={`shrink-0 ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${item.sub === 'Index' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                      {item.sub}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-3 py-3 text-[10px] text-gray-400">No results for "{query}"</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Per-panel header ──────────────────────────────────────────────────────────
function PanelHeader({ panelIdx, isActive, onActivate, onExternalSymbolChange, onExternalTimeframeChange }) {
  const { timeframe, setTimeframe, chartType, setChartType } = useScreen()

  const handleTimeframe = useCallback((tf) => {
    setTimeframe(tf)
    onExternalTimeframeChange?.(tf)
  }, [setTimeframe, onExternalTimeframeChange])

  return (
    <div
      onClick={e => { e.stopPropagation(); onActivate(panelIdx) }}
      className="shrink-0 flex items-center gap-1.5 px-2 h-8 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 cursor-pointer select-none"
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />

      <PanelSymbolSearch onExternalChange={onExternalSymbolChange} />

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
        {TIMEFRAMES.map(tf => (
          <button key={tf}
            onClick={e => { e.stopPropagation(); handleTimeframe(tf) }}
            className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors whitespace-nowrap ${
              timeframe === tf
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {tf}
          </button>
        ))}
      </div>

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
        {[['candlestick', 'Candle'], ['line', 'Line']].map(([type, label]) => (
          <button key={type}
            onClick={e => { e.stopPropagation(); setChartType(type) }}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
              chartType === type
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <span className="ml-auto text-[9px] font-bold text-gray-200 dark:text-gray-800 shrink-0">{panelIdx + 1}</span>
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
function ChartPanel({ panelIdx, panelState, isActive, onActivate,
                      onExternalSymbolChange, onExternalTimeframeChange,
                      onChartReady, onSelectSymbolReady, onSetTimeframeReady }) {
  const stableOnChartReady = useCallback(
    (chart, series) => onChartReady(panelIdx, chart, series),
    [onChartReady, panelIdx]
  )
  return (
    <ScreenProvider
      initialSymbol={panelState.symbol}
      initialIndexId={panelState.indexId}
      initialIsIndex={panelState.isIndex}
      initialTimeframe={panelState.timeframe}
      disableMovers
      disablePositions
      disableNavState  // FIX MC10: prevents location.state from firing in all panels
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
        />
        <div className="flex-1 overflow-hidden min-h-0">
          <StockChart
            hideToolbar
            onChartReady={stableOnChartReady}
          />
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
}) {
  const handleSymbol     = useCallback((sym, indexId, name) => parentSymbolHandler(panelIdx, sym, indexId, name),    [parentSymbolHandler, panelIdx])
  const handleTimeframe  = useCallback((tf)                  => parentTimeframeHandler(panelIdx, tf),                [parentTimeframeHandler, panelIdx])
  const handleChartReady = useCallback((chart, series)       => parentChartReady(panelIdx, chart, series),           [parentChartReady, panelIdx])
  const handleSymbolRdy  = useCallback((fn)                  => parentSymbolReady(panelIdx, fn),                     [parentSymbolReady, panelIdx])
  const handleTfRdy      = useCallback((fn)                  => parentTimeframeReady(panelIdx, fn),                  [parentTimeframeReady, panelIdx])

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
    />
  )
})

// ── Toolbar ───────────────────────────────────────────────────────────────────
function MultiChartToolbar({ layout, setLayout, syncData, setSyncData, syncCross, setSyncCross }) {
  return useScreenToolbarSlot(
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
        {[2, 3, 4].map(n => (
          <button key={n} onClick={() => setLayout(n)}
            className={`flex items-center justify-center w-7 h-5 rounded transition-all ${
              layout === n
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}>
            <LayoutIcon layout={n} />
          </button>
        ))}
      </div>

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <button onClick={() => setSyncData(v => !v)}
        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border ${
          syncData
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
        }`}>
        {syncData ? 'Sync ON' : 'Sync'}
      </button>

      <button onClick={() => setSyncCross(v => !v)}
        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border ${
          syncCross
            ? 'bg-violet-600 border-violet-600 text-white'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
        }`}>
        {syncCross ? 'Crosshair ON' : 'Crosshair'}
      </button>
    </div>
  )
}

// ── MultiChartPage ────────────────────────────────────────────────────────────
export default function MultiChartPage() {
  // FIX MC03: lazy initialisers — loadState() runs once, not every render
  const [layout,      setLayout]      = useState(() => loadState()?.layout    ?? 2)
  const [syncData,    setSyncData]    = useState(() => loadState()?.syncData  ?? false)
  const [syncCross,   setSyncCross]   = useState(() => loadState()?.syncCross ?? false)
  const [activePanel, setActivePanel] = useState(0)

  const [panels, setPanels] = useState(() => {
    const s = loadState()?.panels
    if (Array.isArray(s) && s.length === MAX_PANELS) return s
    return Array(MAX_PANELS).fill(null).map(() => ({ ...DEFAULT_PANEL }))
  })

  const selectSymbolRefs  = useRef(Array(MAX_PANELS).fill(null))
  const setTimeframeRefs  = useRef(Array(MAX_PANELS).fill(null))
  const chartRefs         = useRef(Array(MAX_PANELS).fill(null))
  const seriesRefs        = useRef(Array(MAX_PANELS).fill(null))
  const syncingRef        = useRef(false)
  const crosshairUnsubs   = useRef({})
  const syncCrossRef      = useRef(syncCross)
  useEffect(() => { syncCrossRef.current = syncCross }, [syncCross])

  const panelCount = layout

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
    setPanels(prev => prev.map((p, i) => i === sourceIdx ? { ...p, symbol: sym, indexId: indexId ?? p.indexId, isIndex: indexId != null, companyName: companyName ?? null } : p))
    if (!syncData) return
    selectSymbolRefs.current.forEach((fn, i) => {
      if (i === sourceIdx || i >= panelCount || !fn) return
      fn(sym, indexId ?? null, null, companyName ?? null)
    })
  }, [syncData, panelCount])

  const handleExternalTimeframeChange = useCallback((sourceIdx, tf) => {
    setPanels(prev => prev.map((p, i) => i === sourceIdx ? { ...p, timeframe: tf } : p))
    if (!syncData) return
    setTimeframeRefs.current.forEach((fn, i) => {
      if (i === sourceIdx || i >= panelCount || !fn) return
      fn(tf)
    })
  }, [syncData, panelCount])

  const handleChartReady = useCallback((idx, chart, series) => {
    chartRefs.current[idx]  = chart
    seriesRefs.current[idx] = series
  }, [])

  // Central crosshair sync — exact DataLab PerformanceChart pattern.
  // Runs when syncCross toggles. Retries every 150ms (up to 40x = 6s) until
  // all active panels have chart + series refs populated.
  // Wires every unique panel pair bidirectionally — no duplicate subscriptions.
  const allUnsubsRef = useRef([])
  useEffect(() => {
    // Always clear previous subs first
    allUnsubsRef.current.forEach(fn => { try { fn() } catch (_) {} })
    allUnsubsRef.current = []
    if (!syncCross) return

    let attempts = 0
    let tid

    function tryWire() {
      const n = panelCount
      // Check all active panels have refs
      for (let i = 0; i < n; i++) {
        if (!chartRefs.current[i] || !seriesRefs.current[i]) {
          if (++attempts < 40) { tid = setTimeout(tryWire, 150); return }
          return // give up after 6s
        }
      }

      // All ready — wire every unique pair (i, j) bidirectionally
      function sub(src, srcS, tgt, tgtS) {
        try {
          const u = src.subscribeCrosshairMove(p => {
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
          const uR = src.timeScale().subscribeVisibleLogicalRangeChange(r => {
            if (syncingRef.current || !r) return
            syncingRef.current = true
            try { tgt.timeScale().setVisibleLogicalRange(r) } catch (_) {}
            syncingRef.current = false
          })
          if (uR) allUnsubsRef.current.push(uR)
        } catch (_) {}
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const ci = chartRefs.current[i], si = seriesRefs.current[i]
          const cj = chartRefs.current[j], sj = seriesRefs.current[j]
          sub(ci, si, cj, sj)  // i → j
          sub(cj, sj, ci, si)  // j → i
        }
      }
    }

    tid = setTimeout(tryWire, 300) // initial delay matches DataLab
    return () => {
      clearTimeout(tid)
      allUnsubsRef.current.forEach(fn => { try { fn() } catch (_) {} })
      allUnsubsRef.current = []
    }
  }, [syncCross, panelCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const gridStyle = useMemo(() => {
    if (layout === 3) return {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gridTemplateAreas: '"p0 p1" "p2 p2"',
      height: '100%',
    }
    if (layout === 4) return {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      height: '100%',
    }
    return {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr',
      height: '100%',
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

  // Stable no-op — mobile panel must not write to chartRefs/seriesRefs
  const noopChartReady = useCallback(() => {}, [])

  return (
    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">

      <MultiChartToolbar
        layout={layout} setLayout={setLayout}
        syncData={syncData} setSyncData={setSyncData}
        syncCross={syncCross} setSyncCross={setSyncCross}
      />

      {/* Mobile: single panel — uses a no-op onChartReady so it never writes to
          chartRefs/seriesRefs (those are for the desktop grid only). Without this,
          the mobile panel's cleanup call zeroes out chartRefs[0], breaking crosshair
          sync for panel 0 on desktop. */}
      <div className="md:hidden flex-1 flex flex-col min-h-0">
        <ChartPanelWrapper
          panelIdx={0}
          panelState={panels[0]}
          isActive={true}
          onActivate={() => {}}
          onExternalSymbolChange={handleExternalSymbolChange}
          onExternalTimeframeChange={handleExternalTimeframeChange}
          onChartReady={noopChartReady}
          onSelectSymbolReady={handleSelectSymbolReady}
          onSetTimeframeReady={handleSetTimeframeReady}
        />
        <p className="shrink-0 text-center text-[10px] text-gray-400 py-1 border-t border-gray-100 dark:border-gray-800">
          MultiChart shows all panels on wider screens
        </p>
      </div>

      {/* Desktop grid — FIX MC02: ChartPanelWrapper is memo'd, stable parent handlers
          passed as props. No inline arrows in the map → SyncBridge re-fires only when
          actually needed (symbol/timeframe change), not every render. */}
      <div className="hidden md:block flex-1 min-h-0" style={{ height: '100%' }}>
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
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
