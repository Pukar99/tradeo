import { useAuth } from '../context/AuthContext'
import TaskBoard from '../components/dashboard/TaskBoard'
import DisciplineScore from '../components/dashboard/DisciplineScore'
import MonthlyGoals from '../components/dashboard/MonthlyGoals'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  getTradeLog, getStockPrice,
  getWatchlist, addToWatchlist,
  removeFromWatchlist
} from '../api'

const MOTIVATIONAL_QUOTES = [
  "The market is a device for transferring money from the impatient to the patient.",
  "Risk comes from not knowing what you are doing.",
  "In investing, what is comfortable is rarely profitable.",
  "Trade what you see, not what you think.",
  "Cut losses short, let profits run.",
  "Plan the trade, trade the plan.",
  "Discipline is the bridge between trading goals and trading reality.",
]

const STOCK_COLORS = [
  'bg-blue-500','bg-green-500','bg-purple-500',
  'bg-orange-500','bg-pink-500','bg-teal-500',
  'bg-red-500','bg-indigo-500','bg-yellow-500','bg-cyan-500'
]

function getStockColor(symbol) {
  if (!symbol) return 'bg-blue-500'
  return STOCK_COLORS[symbol.charCodeAt(0) % STOCK_COLORS.length]
}

function StockAvatar({ symbol, size = 'w-8 h-8', textSize = 'text-xs' }) {
  return (
    <div className={`${size} ${getStockColor(symbol)} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <span className={`text-white font-bold ${textSize}`}>{symbol?.slice(0, 2) || '??'}</span>
    </div>
  )
}

function LoggedOutHome() {
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  const [topGainers, setTopGainers] = useState([])

  useEffect(() => {
    axios.get('http://localhost:5000/api/market/top-movers')
      .then(res => setTopGainers(res.data.gainers?.slice(0, 5) || []))
      .catch(() => {})
  }, [])

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Professional NEPSE Trading Workspace
        </div>
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
          Trade Smarter.<br /><span className="text-green-500">Stay Disciplined.</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          Your all-in-one NEPSE trading workspace — charts, journal, portfolio, and discipline tracker.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/signup" className="bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors">Get Started Free →</Link>
          <Link to="/login" className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-colors">Login</Link>
        </div>
      </div>
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 mb-8 text-center">
        <p className="text-white italic text-sm font-medium opacity-90">"{quote}"</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-green-500 text-lg">📈</span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Today's Top Gainers</h3>
          </div>
          {topGainers.length > 0 ? (
            <div className="space-y-2">
              {topGainers.map((s, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <StockAvatar symbol={s.s} size="w-6 h-6" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{s.s}</span>
                  </div>
                  <span className="text-sm text-green-500 font-medium bg-green-50 dark:bg-green-900 px-2 py-0.5 rounded-full">+{s.p}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex justify-between py-1">
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-blue-500 text-lg">💼</span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Performance Preview</h3>
          </div>
          <div className="space-y-3 filter blur-sm select-none pointer-events-none">
            {[['Total P&L','+Rs. 12,450','text-green-500'],['Win Rate','68%','text-blue-500'],['Total Trades','24','text-gray-900 dark:text-white'],['Streak','🔥 5 days','text-orange-500']].map(([l,v,c]) => (
              <div key={l} className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">{l}</span>
                <span className={`text-sm font-bold ${c}`}>{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-gray-400 mt-4 border-t border-gray-100 dark:border-gray-700 pt-3">🔒 Login to see your real data</p>
        </div>
      </div>
    </div>
  )
}

function CenterDashboard({ navigate }) {
  const [trades, setTrades] = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [perfStats, setPerfStats] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [watchlistTab, setWatchlistTab] = useState('active')
  const [perfCollapsed, setPerfCollapsed] = useState(false)
  const [positionsCollapsed, setPositionsCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [newSymbol, setNewSymbol] = useState('')
  const [searchingSymbol, setSearchingSymbol] = useState(false)
  const [symbolInfo, setSymbolInfo] = useState(null)
  const [symbolError, setSymbolError] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [tradesRes, watchRes] = await Promise.all([
        getTradeLog(),
        getWatchlist()
      ])

      const tradeData = tradesRes.data
      setTrades(tradeData)
      const open = tradeData.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
      const closed = tradeData.filter(t => t.status === 'CLOSED')

      const openWithPrices = await Promise.all(
        open.map(async (t) => {
          try {
            const priceRes = await getStockPrice(t.symbol)
            const qty = t.remaining_quantity || t.quantity
            const ltp = priceRes.data.price
            const pnl = t.position === 'LONG'
              ? (ltp - t.entry_price) * qty
              : (t.entry_price - ltp) * qty
            return { ...t, currentPrice: ltp, change: priceRes.data.change, unrealizedPnl: Math.round(pnl), pnlPct: ((pnl / (t.entry_price * qty)) * 100).toFixed(2) }
          } catch {
            return { ...t, currentPrice: null, unrealizedPnl: null }
          }
        })
      )
      setOpenPositions(openWithPrices)

      const totalUnrealized = openWithPrices.reduce((s, t) => s + (t.unrealizedPnl || 0), 0)
      const totalRealized = closed.reduce((s, t) => s + (t.realized_pnl || 0), 0)
      const profitable = closed.filter(t => (t.realized_pnl || 0) > 0).length
      const winRate = closed.length > 0 ? Math.round((profitable / closed.length) * 100) : 0
      const totalInvested = openWithPrices.reduce((s, t) => s + (t.entry_price * (t.remaining_quantity || t.quantity)), 0)

      setPerfStats({
        totalPnl: totalRealized + totalUnrealized,
        unrealizedPnl: totalUnrealized,
        realizedPnl: totalRealized,
        winRate,
        openCount: openWithPrices.length,
        totalInvested,
        currentValue: openWithPrices.reduce((s, t) => s + ((t.currentPrice || t.entry_price) * (t.remaining_quantity || t.quantity)), 0)
      })

      // Watchlist with prices
      const watchItems = watchRes.data
      const watchWithPrices = await Promise.all(
        watchItems.map(async (w) => {
          try {
            const priceRes = await getStockPrice(w.symbol)
            return { ...w, currentPrice: priceRes.data.price, change: priceRes.data.change }
          } catch {
            return { ...w, currentPrice: null }
          }
        })
      )

      // Portfolio tab = open positions
      const portfolioItems = openWithPrices.map(t => ({
        id: `pos_${t.id}`,
        symbol: t.symbol,
        currentPrice: t.currentPrice,
        change: t.change,
        category: 'portfolio',
        isPosition: true,
        position: t.position,
        quantity: t.remaining_quantity || t.quantity,
        entry_price: t.entry_price,
        unrealizedPnl: t.unrealizedPnl,
        pnlPct: t.pnlPct,
        sl: t.sl,
        tp: t.tp,
        status: t.status
      }))

      setWatchlist([...watchWithPrices, ...portfolioItems])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSymbolSearch = async () => {
    if (!newSymbol.trim()) return
    setSearchingSymbol(true)
    setSymbolError('')
    setSymbolInfo(null)
    try {
      const res = await getStockPrice(newSymbol.trim())
      setSymbolInfo(res.data)
    } catch {
      setSymbolError(`${newSymbol.toUpperCase()} not found`)
    } finally {
      setSearchingSymbol(false)
    }
  }

  const handleAddWatch = async (category) => {
    if (!symbolInfo) return
    try {
      await addToWatchlist({ symbol: newSymbol.toUpperCase(), category })
      setNewSymbol('')
      setSymbolInfo(null)
      setShowAddWatch(false)
      fetchData()
    } catch (err) { console.error(err) }
  }

  const handleRemoveWatch = async (id) => {
    try {
      await removeFromWatchlist(id)
      setWatchlist(prev => prev.filter(w => w.id !== id))
    } catch (err) { console.error(err) }
  }

  const filteredWatch = watchlist.filter(w => {
    if (watchlistTab === 'portfolio') return w.category === 'portfolio'
    return w.category === watchlistTab
  })

  if (loading) return (
    <div className="flex flex-col gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
        <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl" />)}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Stats Bar — inside center */}
      {perfStats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: 'Total P/L Today',
              value: `${perfStats.totalPnl >= 0 ? '+' : ''}Rs. ${Math.abs(Math.round(perfStats.totalPnl)).toLocaleString()}`,
              color: perfStats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
            },
            {
              label: 'Unrealized',
              value: `${perfStats.totalInvested > 0 ? ((perfStats.unrealizedPnl / perfStats.totalInvested) * 100).toFixed(2) : '0.00'}%`,
              color: perfStats.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
            },
            {
              label: 'Win Rate',
              value: `${perfStats.winRate}%`,
              color: 'text-gray-900 dark:text-white'
            },
            {
              label: 'Open Positions',
              value: perfStats.openCount,
              color: 'text-gray-900 dark:text-white'
            },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Performance Section — Always Visible */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Performance</h3>
        </div>

        {perfStats && (
          <div className="p-5">
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total P/L', value: `${perfStats.totalPnl >= 0 ? '+' : ''}Rs. ${Math.abs(Math.round(perfStats.totalPnl)).toLocaleString()}`, color: perfStats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500' },
                { label: 'Unrealized', value: `${perfStats.totalInvested > 0 ? ((perfStats.unrealizedPnl / perfStats.totalInvested) * 100).toFixed(2) : '0.00'}%`, color: perfStats.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500' },
                { label: 'Win Rate', value: `${perfStats.winRate}%`, color: 'text-gray-900 dark:text-white' },
                { label: 'Total Invested', value: `Rs. ${Math.round(perfStats.totalInvested).toLocaleString()}`, sub: `Current Value Rs: ${Math.round(perfStats.currentValue).toLocaleString()}`, color: 'text-gray-900 dark:text-white' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>

            {perfStats.totalPnl < 0 && perfStats.totalInvested > 0 && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900 border border-red-100 dark:border-red-800 rounded-xl px-4 py-2.5">
                <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-300 font-medium">
                  Drawdown: {((perfStats.totalPnl / perfStats.totalInvested) * 100).toFixed(2)}% — Need +{Math.abs(((perfStats.totalPnl / (perfStats.totalInvested + perfStats.totalPnl))) * 100).toFixed(2)}% to recover
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Open Positions — with Collapse */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Open Positions</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPositionsCollapsed(!positionsCollapsed)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              {positionsCollapsed ? 'Expand' : 'Collapse'}
              <svg className={`w-3 h-3 transition-transform ${positionsCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button onClick={() => navigate('/portfolio')} className="text-xs text-blue-500 hover:text-blue-700">›</button>
          </div>
        </div>

        {!positionsCollapsed && (
          <>
            {openPositions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">No open positions</p>
                <button onClick={() => navigate('/trader')} className="mt-2 text-blue-500 text-xs hover:underline">+ Add a trade</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {openPositions.map(t => {
                  const slDistPct = t.sl && t.currentPrice
                    ? (((t.currentPrice - t.sl) / t.currentPrice) * 100).toFixed(2)
                    : null
                  const tpDistPct = t.tp && t.currentPrice
                    ? (((t.tp - t.currentPrice) / t.currentPrice) * 100).toFixed(2)
                    : null

                  return (
                    <div key={t.id} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <StockAvatar symbol={t.symbol} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.symbol}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                t.position === 'LONG'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              }`}>
                                {t.position}
                              </span>
                              {t.status === 'PARTIAL' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300 font-medium">PARTIAL</span>
                              )}
                            </div>
                            <p className={`text-xs font-medium mt-0.5 ${t.unrealizedPnl !== null ? (t.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400'}`}>
                              {t.unrealizedPnl !== null ? `${t.unrealizedPnl >= 0 ? '+' : ''}Rs.${Math.abs(t.unrealizedPnl).toLocaleString()}` : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            Rs.{t.currentPrice?.toLocaleString() || '—'}
                          </p>
                          {t.change !== undefined && (
                            <p className={`text-xs ${t.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {t.change >= 0 ? '+' : ''}{t.change}%
                            </p>
                          )}
                        </div>
                      </div>

                      {/* SL / TP distance info */}
                      {(t.sl || t.tp) && (
                        <div className="flex items-center gap-3 mt-2 ml-11">
                          {t.sl && (
                            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900 px-2.5 py-1 rounded-lg">
                              <span className="text-xs text-red-500 font-medium">SL</span>
                              <span className="text-xs text-gray-700 dark:text-gray-200">Rs.{t.sl}</span>
                              {slDistPct !== null && (
                                <span className="text-xs text-red-500 font-medium">
                                  ({slDistPct > 0 ? '+' : ''}{slDistPct}% from LTP)
                                </span>
                              )}
                            </div>
                          )}
                          {t.tp && (
                            <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900 px-2.5 py-1 rounded-lg">
                              <span className="text-xs text-green-500 font-medium">TP</span>
                              <span className="text-xs text-gray-700 dark:text-gray-200">Rs.{t.tp}</span>
                              {tpDistPct !== null && (
                                <span className="text-xs text-green-500 font-medium">
                                  ({tpDistPct > 0 ? '+' : ''}{tpDistPct}% from LTP)
                                </span>
                              )}
                            </div>
                          )}
                          {!t.sl && (
                            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900 px-2.5 py-1 rounded-lg">
                              <span className="text-xs text-orange-500 font-medium">⚠️ No SL set</span>
                            </div>
                          )}
                        </div>
                      )}
                      {!t.sl && !t.tp && (
                        <div className="flex items-center gap-1.5 mt-2 ml-11 bg-orange-50 dark:bg-orange-900 px-2.5 py-1 rounded-lg w-fit">
                          <span className="text-xs text-orange-500 font-medium">⚠️ No SL or TP set</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Watchlist — Full Width */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Watchlist</h3>
          <div className="flex items-center gap-1">
            {['active', 'pre', 'portfolio'].map(tab => (
              <button
                key={tab}
                onClick={() => setWatchlistTab(tab)}
                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                  watchlistTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'active' ? 'Active' : tab === 'pre' ? 'Pre-Watch' : 'Portfolio'}
              </button>
            ))}
            {watchlistTab !== 'portfolio' && (
              <button
                onClick={() => setShowAddWatch(!showAddWatch)}
                className="ml-1 w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center hover:bg-blue-200 transition-colors font-bold text-sm"
              >
                +
              </button>
            )}
          </div>
        </div>

        {showAddWatch && watchlistTab !== 'portfolio' && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSymbol}
                onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                placeholder="Symbol e.g. NABIL"
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleSymbolSearch()}
              />
              <button
                onClick={handleSymbolSearch}
                disabled={searchingSymbol || !newSymbol.trim()}
                className="bg-gray-800 text-white px-3 py-1.5 rounded-xl text-xs hover:bg-gray-700 disabled:opacity-40"
              >
                {searchingSymbol ? '...' : 'Search'}
              </button>
            </div>
            {symbolError && <p className="text-xs text-red-500 mb-2">{symbolError}</p>}
            {symbolInfo && (
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-2 mb-2">
                <div className="flex items-center gap-2">
                  <StockAvatar symbol={symbolInfo.symbol} size="w-7 h-7" />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{symbolInfo.symbol}</p>
                    <p className="text-xs text-gray-400">Rs.{symbolInfo.price}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleAddWatch('active')} className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700">+ Active</button>
                  <button onClick={() => handleAddWatch('pre')} className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-300">+ Pre</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-3">
          {filteredWatch.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-gray-400">
                {watchlistTab === 'portfolio' ? 'No open positions' : 'No stocks added'}
              </p>
              {watchlistTab !== 'portfolio' && (
                <button onClick={() => setShowAddWatch(true)} className="text-xs text-blue-500 mt-1 hover:underline">+ Add stock</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredWatch.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2.5 group">
                  <div className="flex items-center gap-2">
                    <StockAvatar symbol={item.symbol} size="w-8 h-8" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
                      <p className="text-xs text-gray-400">
                        {item.isPosition
                          ? `${item.quantity} @ Rs.${item.entry_price}`
                          : `Rs.${item.currentPrice?.toLocaleString() || '—'}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.isPosition && item.unrealizedPnl !== null ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.unrealizedPnl >= 0
                          ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
                      }`}>
                        {item.unrealizedPnl >= 0 ? '+' : ''}Rs.{Math.abs(item.unrealizedPnl).toLocaleString()}
                      </span>
                    ) : item.change !== undefined && item.change !== null ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.change >= 0
                          ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
                      }`}>
                        {item.change >= 0 ? '+' : ''}{item.change}%
                      </span>
                    ) : null}
                    {!item.isPosition && (
                      <button
                        onClick={() => handleRemoveWatch(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity ml-1"
                      >✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoggedInHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [disciplineKey, setDisciplineKey] = useState(0)
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })


  return (
    <div className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 min-h-screen">

      {/* Top date bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs text-gray-400">{today}</p>
        <div className="hidden lg:flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Market data as of 2026-02-26</span>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-12 gap-4">

        {/* LEFT — TaskBoard + Monthly Goals */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <TaskBoard compact={true} onTaskComplete={() => setDisciplineKey(k => k + 1)} />
          <MonthlyGoals />
        </div>

        {/* CENTER — Stats + Performance + Positions + Watchlist */}
        <div className="col-span-12 lg:col-span-6">
          <CenterDashboard navigate={navigate} />
        </div>

        {/* RIGHT — Discipline + Journal */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <DisciplineScore key={disciplineKey} />
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Journal Entry</h3>
              <button onClick={() => navigate('/trader')} className="text-gray-400 hover:text-gray-600">›</button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <Link to="/trader" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors group">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📈</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">Add NEPSE Journal Entry</p>
                  <p className="text-xs text-gray-400">Write & track your NEPSE journey</p>
                </div>
              </Link>
              <Link to="/trader" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-purple-50 dark:hover:bg-gray-600 transition-colors group">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💹</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Add Forex Journal Entry</p>
                  <p className="text-xs text-gray-400">Write & track your Forex journey</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function HomePage() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {user ? <LoggedInHome /> : <LoggedOutHome />}
    </div>
  )
}

export default HomePage