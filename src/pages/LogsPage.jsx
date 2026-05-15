import { useState, useEffect, useCallback, useMemo } from 'react'
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

  // Trades-tab controls — lifted here so they live on the same bar as tabs
  const [view,   setView]   = useState('database')
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [addModal, setAddModal] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await getPositions()
      const allPositions = res.data || []
      setPositions(allPositions)

      const openSymbols = [...new Set(
        allPositions.filter(p => p.status !== 'CLOSED').map(p => p.symbol)
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
        } catch { /* prices unavailable */ }
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

  const allSymbols = useMemo(() => {
    const seen = new Set()
    positions.forEach(p => seen.add(p.symbol))
    return [...seen]
  }, [positions])

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

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30 rounded-xl">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm leading-none">×</button>
        </div>
      )}

      {/* ── unified single toolbar ── */}
      <div className="flex items-center gap-2 mb-5">

        {/* tabs — left */}
        <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-xl p-1 gap-0.5">
          {TABS.map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* spacer — pushes everything right */}
        <div className="flex-1" />

        {/* trades-only controls — right side */}
        {activeTab === 'trades' && <>

          {/* view toggle */}
          <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-lg p-0.5 gap-0.5">
            {['database', 'calendar'].map(v => (
              <button key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all capitalize ${
                  view === v
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {v}
              </button>
            ))}
          </div>

          {view === 'database' && <>
            {/* divider */}
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

            {/* open / all */}
            <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-lg p-0.5 gap-0.5">
              {['open', 'all'].map(f => (
                <button key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    filter === f
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {f === 'open' ? 'Open' : 'All'}
                </button>
              ))}
            </div>

            {/* symbol search */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[11px] pointer-events-none select-none">⌕</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Symbol"
                list="symbol-datalist"
                className="pl-6 pr-3 py-1 w-24 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:w-32 transition-all"
              />
              <datalist id="symbol-datalist">
                {allSymbols.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </>}

          {/* divider */}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

          {/* new trade */}
          <button
            onClick={() => setAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-sm shadow-blue-500/30">
            <span className="text-sm leading-none">+</span>
            New Trade
          </button>
        </>}
      </div>

      {/* ── tab content ── */}
      {activeTab === 'trades' && (
        <TradeActionsTab
          positions={positions}
          ltpMap={ltpMap}
          view={view}
          filter={filter}
          search={search}
          addModal={addModal}
          setAddModal={setAddModal}
          onRefresh={handleRefresh}
        />
      )}
      {activeTab === 'market' && <MarketJournalTab />}
      {activeTab === 'audit'  && <AuditTab />}
      {activeTab === 'stats'  && (
        <div className="flex items-center justify-center min-h-48 text-gray-400 dark:text-gray-500 text-sm">
          Stats tab — coming soon
        </div>
      )}
    </div>
  )
}
