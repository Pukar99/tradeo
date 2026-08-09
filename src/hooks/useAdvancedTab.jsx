import { createContext, useContext, useState, useRef } from 'react'

const AdvancedTabContext = createContext(null)

export function AdvancedTabProvider({ children }) {
  const [symbol, setSymbol] = useState(null)
  const [activeModule, setActiveModule] = useState('Backtesting')
  const chartRef = useRef(null)

  return (
    <AdvancedTabContext.Provider
      value={{
        symbol,
        setSymbol,
        activeModule,
        setActiveModule,
        chartRef,
      }}
    >
      {children}
    </AdvancedTabContext.Provider>
  )
}

export function useAdvancedTab() {
  const ctx = useContext(AdvancedTabContext)
  if (!ctx) throw new Error('useAdvancedTab must be used inside AdvancedTabProvider')
  return ctx
}
