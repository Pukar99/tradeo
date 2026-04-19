import { createContext, useContext, useState, useEffect } from 'react'

const MarketContext = createContext(null)

export function MarketProvider({ children }) {
  const [market, setMarket] = useState(() => {
    try { return localStorage.getItem('tradeo_market') || 'nepse' } catch { return 'nepse' }
  })

  const toggleMarket = () => {
    setMarket(m => {
      const next = m === 'nepse' ? 'forex' : 'nepse'
      try { localStorage.setItem('tradeo_market', next) } catch {}
      return next
    })
  }

  const isNepse = market === 'nepse'
  const isForex = market === 'forex'

  return (
    <MarketContext.Provider value={{ market, isNepse, isForex, toggleMarket }}>
      {children}
    </MarketContext.Provider>
  )
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
