// =============================================================================
// ScreenContext.jsx — Shared state for all ScreenPage tabs
// =============================================================================
// Sections:
//   1. Provider   — symbol, chart, indicators, hover/pin, positions, nav state
//   2. Hook       — useScreen
// =============================================================================

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getPositions } from '../utils/globalCache'

const ScreenContext = createContext(null)

// =============================================================================
// 1. PROVIDER
// =============================================================================

export function ScreenProvider({ children, initialSymbol, initialIndexId, initialIsIndex, initialTimeframe, onSymbolChange, disableMovers, disablePositions, disableNavState }) {
  const [selectedSymbol,      setSelectedSymbol]      = useState(initialSymbol  || 'NEPSE')
  const [selectedCompanyName, setSelectedCompanyName] = useState(null)
  const [selectedIndexId,     setSelectedIndexId]     = useState(initialIndexId ?? 12)
  const [selectedIsIndex,     setSelectedIsIndex]     = useState(initialIsIndex ?? true)
  const [chartType,       setChartType]       = useState('candlestick')
  const [timeframe,       setTimeframe]       = useState(initialTimeframe || '1Y')
  const [activeIndicators,setActiveIndicators]= useState([])

  // Hover / click-lock state — drives the candle movers overlay
  const [hoveredDate,   setHoveredDate]   = useState(null)
  const [pinnedDate,    setPinnedDate]    = useState(null)  // null = not pinned
  const [hoveredMovers, setHoveredMovers] = useState(null)  // { gainers, losers }
  const [pinnedMovers,  setPinnedMovers]  = useState(null)

  // Shared positions — fetched once, consumed by LeftPanel + any future ScreenPage component.
  // Raw position_view rows — each consumer does its own field mapping.
  const [sharedPositions,    setSharedPositions]    = useState([])
  const [positionsLoading,   setPositionsLoading]   = useState(true)
  const positionsFetchedRef  = useRef(false)

  const refreshPositions = useCallback(() => {
    setPositionsLoading(true)
    getPositions()
      .then(r => { setSharedPositions(r.data || []); positionsFetchedRef.current = true })
      .catch(() => {})
      .finally(() => setPositionsLoading(false))
  }, [])

  // Fetch once on mount — skipped when disablePositions=true (e.g. MultiChart panels)
  useEffect(() => { if (!disablePositions) refreshPositions() }, [refreshPositions, disablePositions])

  // Active positions array — supports multiple entries for same symbol
  // Each: { id, entry_price, sl, tp, position, quantity }
  // null when viewing watchlist or index
  const [activePositions, setActivePositions] = useState(null)

  const location = useLocation()

  const isIndex = () => selectedIsIndex

  const selectSymbol = useCallback((sym, indexId = null, positions = null, companyName = null) => {
    setSelectedSymbol(sym)
    setSelectedCompanyName(indexId != null ? null : companyName)
    setSelectedIsIndex(indexId != null)
    if (indexId != null) setSelectedIndexId(indexId)
    setPinnedDate(null)
    setPinnedMovers(null)
    onSymbolChange?.(sym, indexId, companyName)
    // positions can be null, a single object (legacy), or an array
    if (positions === null) {
      setActivePositions(null)
    } else if (Array.isArray(positions)) {
      setActivePositions(positions)
    } else {
      setActivePositions([positions])
    }
  }, [])

  // On mount: read navigate state from LogsPage "Go to Chart"
  // disableNavState=true skips this for MultiChart panels — otherwise all panels
  // consume location.state and jump to the same symbol simultaneously (BUG-MC10).
  useEffect(() => {
    if (disableNavState) return
    const state = location.state
    if (state?.symbol) {
      setSelectedSymbol(state.symbol)
      setPinnedDate(null)
      setPinnedMovers(null)
      setActivePositions(state.positions?.length > 0 ? state.positions : null)
      // Surgically remove only the symbol/positions keys we consumed — preserves
      // any other navigation state other features might have set
      const { symbol: _s, positions: _p, ...rest } = state
      window.history.replaceState(Object.keys(rest).length ? rest : null, '')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleIndicator = useCallback((name) => {
    setActiveIndicators(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    )
  }, [])

  // Called by StockChart on crosshair move
  const onHover = useCallback((date, movers) => {
    setHoveredDate(date)
    setHoveredMovers(movers)
  }, [])

  // Click-locked movers — shown in RightPanel when a candle is clicked
  const [clickedMovers, setClickedMovers] = useState(null) // { date, movers }

  // Called by StockChart on candle click — toggles pin
  const onPin = useCallback((date, movers) => {
    setPinnedDate(prev => {
      const next = prev === date ? null : date
      setPinnedMovers(next === null ? null : movers)
      setClickedMovers(next === null ? null : { date, movers })
      return next
    })
  }, [])

  const clearPin = useCallback(() => {
    setPinnedDate(null)
    setPinnedMovers(null)
    setClickedMovers(null)
  }, [])

  // Active date/movers = pinned takes priority over hovered
  const activeDate   = pinnedDate   ?? hoveredDate
  const activeMovers = pinnedMovers ?? hoveredMovers

  return (
    <ScreenContext.Provider value={{
      selectedSymbol, selectedCompanyName, selectedIndexId,
      chartType,       setChartType,
      timeframe,       setTimeframe,
      activeIndicators, toggleIndicator,
      selectSymbol,    isIndex,
      hoveredDate, pinnedDate, activeDate,
      hoveredMovers, pinnedMovers, activeMovers,
      clickedMovers,
      onHover, onPin, clearPin,
      disableMovers,
      activePositions,
      // backwards-compat: components that read activePosition get the first entry
      activePosition: activePositions?.[0] ?? null,
      // Shared positions — one fetch for all ScreenPage consumers
      sharedPositions, positionsLoading, refreshPositions,
    }}>
      {children}
    </ScreenContext.Provider>
  )
}

// =============================================================================
// 2. HOOK
// =============================================================================

export const useScreen = () => useContext(ScreenContext)
