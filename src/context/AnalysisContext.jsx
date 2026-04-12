import { createContext, useContext, useState } from 'react'

const AnalysisContext = createContext(null)

export function AnalysisProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState('NEPSE')
  const [selectedIndexId, setSelectedIndexId] = useState(12)
  const [chartType, setChartType] = useState('candlestick')   // 'candlestick' | 'line'
  const [timeframe, setTimeframe] = useState('1Y')             // '1D'|'1W'|'1M'|'6M'|'1Y'|'3Y'|'ALL'
  const [activeIndicators, setActiveIndicators] = useState([]) // ['RSI','MACD','MA']

  const isIndex = (sym) => sym === 'NEPSE' || sym.includes('Index') || sym.includes('Sub-Index')

  function selectSymbol(sym, indexId = null) {
    setSelectedSymbol(sym)
    if (indexId) setSelectedIndexId(indexId)
  }

  function toggleIndicator(name) {
    setActiveIndicators(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    )
  }

  return (
    <AnalysisContext.Provider value={{
      selectedSymbol, selectedIndexId,
      chartType, setChartType,
      timeframe, setTimeframe,
      activeIndicators, toggleIndicator,
      selectSymbol, isIndex,
    }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export const useAnalysis = () => useContext(AnalysisContext)
