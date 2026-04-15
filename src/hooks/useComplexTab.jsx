import { createContext, useContext, useState, useRef } from 'react'

const ComplexTabContext = createContext(null)

export function ComplexTabProvider({ children }) {
  const [symbol,       setSymbol]       = useState(null)
  const [activeModule, setActiveModule] = useState('Backtesting')
  const chartRef = useRef(null)

  return (
    <ComplexTabContext.Provider value={{
      symbol, setSymbol,
      activeModule, setActiveModule,
      chartRef,
    }}>
      {children}
    </ComplexTabContext.Provider>
  )
}

export function useComplexTab() {
  const ctx = useContext(ComplexTabContext)
  if (!ctx) throw new Error('useComplexTab must be used inside ComplexTabProvider')
  return ctx
}
