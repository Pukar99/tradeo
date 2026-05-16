import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPositions, getMarketJournals, autoCreateMarketJournal } from '../api'
import { getBatchPrices } from '../utils/globalCache'
import { useChatRefresh } from '../utils/chatEvents'
import { clearEligibilityCache } from '../utils/globalCache'

import TradeActionsTab  from '../components/logs/TradeActionsTab'
const AuditTab         = lazy(() => import('../components/logs/AuditTab'))
const MarketJournalTab = lazy(() => import('../components/logs/MarketJournalTab'))

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

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

  // Shared log view — persists across Trades + Market tabs
  const [view,   setView]   = useState('database')
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [addModal, setAddModal] = useState(false)

  // Market-tab state — only loaded when user first opens the Market tab
  const [marketJournals,      setMarketJournals]      = useState([])
  const [marketJournalLoaded, setMarketJournalLoaded] = useState(false)

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

  const fetchMarketJournals = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      await autoCreateMarketJournal(today)
      const journalsRes = await getMarketJournals()
      const all = journalsRes.data || []
      setMarketJournals(all)

      // Backfill news for recent entries that have none — parallel, max 5
      const missing = all.filter(e => !e.news).slice(0, 5)
      if (missing.length > 0) {
        await Promise.all(missing.map(e => autoCreateMarketJournal(e.date).catch(() => {})))
        const refreshed = await getMarketJournals()
        setMarketJournals(refreshed.data || [])
      }
    } catch (err) {
      console.error('[fetchMarketJournals]', err?.message)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  // Defer market journal load until the Market tab is first opened
  useEffect(() => {
    if (activeTab === 'market' && !marketJournalLoaded) {
      setMarketJournalLoaded(true)
      fetchMarketJournals()
    }
  }, [activeTab, marketJournalLoaded, fetchMarketJournals])
  useChatRefresh(['trades'], fetchData)

  const handleRefresh = useCallback(() => {
    clearEligibilityCache()
    fetchData()
  }, [fetchData])

  const handleMarketJournalSaved = useCallback((updated) => {
    setMarketJournals(prev => prev.map(e => e.date === updated.date ? updated : e))
  }, [])

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
    <div className="w-full px-3 sm:px-5 pt-4 sm:pt-5 pb-16 max-w-7xl mx-auto animate-pulse">
      {/* toolbar row 1 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-56 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        <div className="flex-1" />
        <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
      {/* toolbar row 2 */}
      <div className="flex items-center gap-2 mb-5">
        <div className="h-7 w-52 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-7 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-7 w-36 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
      {/* position rows */}
      {[1, 2, 3].map(i => (
        <div key={i} className="mb-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-4 w-10 bg-gray-100 dark:bg-gray-800 rounded-full" />
              <div className="h-4 w-12 bg-gray-100 dark:bg-gray-800 rounded-full" />
            </div>
            <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(j => (
              <div key={j}>
                <div className="h-3 w-12 bg-gray-100 dark:bg-gray-800 rounded mb-1" />
                <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
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

      {/* ── unified toolbar — row 1: tabs + New Trade; row 2 (trades only): view + filter + search ── */}
      <div className="flex flex-col gap-2 mb-5">

        {/* Row 1: tabs left, New Trade right */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-xl p-1 gap-0.5">
            {TABS.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] ${
                  activeTab === tab.key
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {activeTab === 'trades' && (
            <button
              onClick={() => setAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-bold rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-sm shadow-blue-500/30 min-h-[44px]">
              <span className="text-sm leading-none">+</span>
              <span className="hidden xs:inline">New Trade</span>
              <span className="xs:hidden">New</span>
            </button>
          )}
        </div>

        {/* Row 2: view toggle + trades controls — only for trades/market tabs */}
        {(activeTab === 'trades' || activeTab === 'market') && (
          <div className="flex items-center gap-2 flex-wrap">

            {/* view toggle */}
            <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-lg p-0.5 gap-0.5">
              {[
                { key: 'database', label: 'Database' },
                { key: 'gallery',  label: 'Gallery'  },
                { key: 'calendar', label: 'Calendar' },
              ].map(v => (
                <button key={v.key}
                  onClick={() => setView(v.key)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    view === v.key
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* trades-only filter + search */}
            {activeTab === 'trades' && (view === 'database' || view === 'gallery') && <>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

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

              <div className="relative flex-1 min-w-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[11px] pointer-events-none select-none">⌕</span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Symbol"
                  list="symbol-datalist"
                  className="pl-6 pr-3 py-1 w-full min-w-[80px] text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <datalist id="symbol-datalist">
                  {allSymbols.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </>}
          </div>
        )}
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
      {activeTab === 'market' && (
        <Suspense fallback={<TabSpinner />}>
          <MarketJournalTab
            view={view}
            marketJournals={marketJournals}
            onMarketJournalSaved={handleMarketJournalSaved}
          />
        </Suspense>
      )}
      {activeTab === 'audit'  && (
        <Suspense fallback={<TabSpinner />}>
          <AuditTab />
        </Suspense>
      )}
      {activeTab === 'stats'  && (
        <div className="flex items-center justify-center min-h-[50vh] text-gray-400 dark:text-gray-500 text-sm">
          Stats tab — coming soon
        </div>
      )}
    </div>
  )
}
