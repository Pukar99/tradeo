import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPositions, getBatchPrices } from '../api'
import { useChatRefresh } from '../utils/chatEvents'
import { clearEligibilityCache } from '../utils/globalCache'

import TradeActionsTab  from '../components/logs/TradeActionsTab'
import AuditTab         from '../components/logs/AuditTab'
import MarketJournalTab from '../components/logs/MarketJournalTab'

const TABS = [
  { key: 'trades', label: 'Trades' },
  { key: 'market', label: 'Market' },
  { key: 'audit',  label: 'Audit'  },
  { key: 'stats',  label: 'Stats'  },
]

export default function LogsPage() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [positions,  setPositions]  = useState([])
  const [ltpMap,     setLtpMap]     = useState({})
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState('trades')
  const [error,      setError]      = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await getPositions()
      const allPositions = res.data || []
      setPositions(allPositions)

      // Fetch LTP for open/partial positions only
      const openSymbols = [...new Set(
        allPositions
          .filter(p => p.status !== 'CLOSED')
          .map(p => p.symbol)
      )]
      if (openSymbols.length > 0) {
        try {
          const batchRes = await getBatchPrices(openSymbols)
          const prices   = batchRes.data.prices || {}
          const map = {}
          for (const sym of openSymbols) {
            if (prices[sym]) map[sym] = prices[sym].price
          }
          setLtpMap(map)
        } catch { /* prices unavailable — positions still show */ }
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load positions. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useChatRefresh(['trades'], fetchData)

  const handleRefresh = useCallback(() => {
    clearEligibilityCache()
    fetchData()
  }, [fetchData])

  if (!user) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center max-w-sm">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Login required</p>
        <p className="text-xs text-gray-400 mb-5">Please log in to view your trade log.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">Login</button>
          <button onClick={() => navigate('/signup')} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors">Sign up</button>
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div className="w-full px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-gray-400">Loading positions…</p>
      </div>
    </div>
  )

  return (
    <div className="w-full px-3 sm:px-5 pt-4 sm:pt-5 pb-16 max-w-7xl mx-auto">

      {/* error toast */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30 rounded-xl">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm leading-none">×</button>
        </div>
      )}

      {/* tab bar */}
      <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/80 rounded-xl p-1 gap-0.5 mb-5 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      {activeTab === 'trades' && (
        <TradeActionsTab
          positions={positions}
          ltpMap={ltpMap}
          onRefresh={handleRefresh}
        />
      )}

      {activeTab === 'market' && (
        <MarketJournalTab />
      )}

      {activeTab === 'audit' && (
        <AuditTab />
      )}

      {activeTab === 'stats' && (
        <div className="flex items-center justify-center min-h-48 text-gray-400 dark:text-gray-500 text-sm">
          Stats tab — coming soon
        </div>
      )}
    </div>
  )
}
