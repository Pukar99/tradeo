import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ScreenContext = createContext(null)

export function ScreenProvider({ children }) {
  const [selectedSymbol,  setSelectedSymbol]  = useState('NEPSE')
  const [selectedIndexId, setSelectedIndexId] = useState(12)
  const [chartType,       setChartType]       = useState('candlestick')
  const [timeframe,       setTimeframe]       = useState('1Y')
  const [activeIndicators,setActiveIndicators]= useState([])

  // Hover / click-lock state — drives the candle movers overlay
  const [hoveredDate,   setHoveredDate]   = useState(null)
  const [pinnedDate,    setPinnedDate]    = useState(null)  // null = not pinned
  const [hoveredMovers, setHoveredMovers] = useState(null)  // { gainers, losers }
  const [pinnedMovers,  setPinnedMovers]  = useState(null)

  // Active positions array — supports multiple entries for same symbol
  // Each: { id, entry_price, sl, tp, position, quantity }
  // null when viewing watchlist or index
  const [activePositions, setActivePositions] = useState(null)

  const location = useLocation()

  const isIndex = (sym) =>
    sym === 'NEPSE' ||
    sym.includes('Index') ||
    sym.includes('Sub-Index') ||
    sym.includes('NEPSE 20') ||
    sym.includes('Float') ||
    sym.includes('Sensitive')

  const selectSymbol = useCallback((sym, indexId = null, positions = null) => {
    setSelectedSymbol(sym)
    if (indexId) setSelectedIndexId(indexId)
    setPinnedDate(null)
    setPinnedMovers(null)
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
  useEffect(() => {
    const state = location.state
    if (state?.symbol) {
      setSelectedSymbol(state.symbol)
      setPinnedDate(null)
      setPinnedMovers(null)
      setActivePositions(state.positions?.length > 0 ? state.positions : null)
      // Clear the navigation state so back-navigation doesn't re-trigger
      window.history.replaceState({}, '')
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

  // Called by StockChart on candle click — toggles pin
  const onPin = useCallback((date, movers) => {
    setPinnedDate(prev => {
      const next = prev === date ? null : date
      setPinnedMovers(next === null ? null : movers)
      return next
    })
  }, [])

  const clearPin = useCallback(() => {
    setPinnedDate(null)
    setPinnedMovers(null)
  }, [])

  // Active date/movers = pinned takes priority over hovered
  const activeDate   = pinnedDate   ?? hoveredDate
  const activeMovers = pinnedMovers ?? hoveredMovers

  return (
    <ScreenContext.Provider value={{
      selectedSymbol, selectedIndexId,
      chartType,       setChartType,
      timeframe,       setTimeframe,
      activeIndicators, toggleIndicator,
      selectSymbol,    isIndex,
      hoveredDate, pinnedDate, activeDate,
      hoveredMovers, pinnedMovers, activeMovers,
      onHover, onPin, clearPin,
      activePositions,
      // backwards-compat: components that read activePosition get the first entry
      activePosition: activePositions?.[0] ?? null,
    }}>
      {children}
    </ScreenContext.Provider>
  )
}

export const useScreen = () => useContext(ScreenContext)
