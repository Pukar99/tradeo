import { createContext, useContext, useState, useCallback } from 'react'

const AnalysisContext = createContext(null)

export function AnalysisProvider({ children }) {
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

  // Active position — set when user clicks a portfolio row (has SL/TP/entry)
  // null when viewing watchlist or index
  const [activePosition, setActivePosition] = useState(null)

  const isIndex = (sym) =>
    sym === 'NEPSE' ||
    sym.includes('Index') ||
    sym.includes('Sub-Index') ||
    sym.includes('NEPSE 20') ||
    sym.includes('Float') ||
    sym.includes('Sensitive')

  const selectSymbol = useCallback((sym, indexId = null, position = null) => {
    setSelectedSymbol(sym)
    if (indexId) setSelectedIndexId(indexId)
    // Clear any pin when switching symbol
    setPinnedDate(null)
    setPinnedMovers(null)
    // Set active position (null when coming from watchlist / right panel)
    setActivePosition(position)
  }, [])

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
    setPinnedDate(prev => prev === date ? null : date)
    setPinnedMovers(prev => prev && pinnedDate === date ? null : movers)
  }, [pinnedDate])

  const clearPin = useCallback(() => {
    setPinnedDate(null)
    setPinnedMovers(null)
  }, [])

  // Active date/movers = pinned takes priority over hovered
  const activeDate   = pinnedDate   ?? hoveredDate
  const activeMovers = pinnedMovers ?? hoveredMovers

  return (
    <AnalysisContext.Provider value={{
      selectedSymbol, selectedIndexId,
      chartType,       setChartType,
      timeframe,       setTimeframe,
      activeIndicators, toggleIndicator,
      selectSymbol,    isIndex,
      hoveredDate, pinnedDate, activeDate,
      hoveredMovers, pinnedMovers, activeMovers,
      onHover, onPin, clearPin,
      activePosition,
    }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export const useAnalysis = () => useContext(AnalysisContext)
