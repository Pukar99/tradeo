import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getTradeLog, getStockPrice, getWatchlist, getDiscipline, getTodayTasks, getTopMovers } from '../api'

const NEPSE_QUOTES = [
  "The market rewards patience, not activity.",
  "Cut losses short, let profits run.",
  "Plan the trade, trade the plan.",
  "Discipline is the edge that separates winners.",
  "Risk management is not optional — it is survival.",
  "Every expert was once a beginner who refused to quit.",
  "The trend is your friend until it ends.",
  "Trade what you see, not what you think.",
]

function MorningBriefing({ onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const containerRef = useRef(null)
  const quote = NEPSE_QUOTES[new Date().getDay() % NEPSE_QUOTES.length]

  const fetchBriefingData = useCallback(async () => {
    setFetchError(null)
    setLoading(true)
    try {
      const [tradesRes, watchRes, disciplineRes, tasksRes] = await Promise.all([
        getTradeLog(),
        getWatchlist(),
        getDiscipline(),
        getTodayTasks()
      ])

      const trades = tradesRes.data
      const open = trades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
      const closed = trades.filter(t => t.status === 'CLOSED')

      // P3-003: fetch all open position prices in parallel (Promise.allSettled)
      const priceResults = await Promise.allSettled(open.map(t => getStockPrice(t.symbol)))
      const openWithPrices = open.map((t, idx) => {
        if (priceResults[idx].status === 'rejected') {
          return { ...t, currentPrice: null, unrealizedPnl: null }
        }
        const priceRes = priceResults[idx].value
        const qty = parseFloat(t.remaining_quantity || t.quantity) || 0
        const ltp = parseFloat(priceRes.data.price) || 0
        const entryPrice = parseFloat(t.entry_price) || 0
        const pnl = t.position === 'LONG'
          ? (ltp - entryPrice) * qty
          : (entryPrice - ltp) * qty
        const slDistPct = t.sl ? Math.abs(((ltp - parseFloat(t.sl)) / ltp) * 100) : null
        const tpDistPct = t.tp ? Math.abs(((parseFloat(t.tp) - ltp) / ltp) * 100) : null
        return {
          ...t, currentPrice: ltp,
          change: priceRes.data.change,
          unrealizedPnl: Math.round(pnl),
          slDistPct: slDistPct?.toFixed(1),
          tpDistPct: tpDistPct?.toFixed(1),
          nearSL: slDistPct != null && slDistPct < 3,
          nearTP: tpDistPct != null && tpDistPct < 3,
          noSL: !t.sl
        }
      })

      // Top movers from market API — use the shared axios instance (no hardcoded URL)
      let topGainers = []
      let topLosers = []
      try {
        const mktRes = await getTopMovers()
        topGainers = mktRes.data.gainers?.slice(0, 3) || []
        topLosers = mktRes.data.losers?.slice(0, 3) || []
      } catch { /* market snapshot is non-critical */ }

      // Watchlist alerts due today — compare ISO date strings to avoid UTC/local skew
      const todayISO = new Date().toISOString().slice(0, 10)
      const watchAlerts = watchRes.data.filter(w => {
        if (!w.alert_date) return false
        const alertISO = w.alert_date.slice(0, 10)
        return alertISO <= todayISO
      })

      // Tasks
      const { fixedTasks: ft, customTasks: ct } = tasksRes.data
      const completedYesterday = (ft || []).filter(f => f.completed).length

      // Risk alerts
      const riskAlerts = openWithPrices.filter(t => t.nearSL || t.noSL)
      const nearTPAlerts = openWithPrices.filter(t => t.nearTP)

      // Discipline
      const discipline = disciplineRes.data
      const unrealizedTotal = openWithPrices.reduce((s, t) => s + (t.unrealizedPnl || 0), 0)

      // AI suggestion
      let aiSuggestion = ''
      if (riskAlerts.length > 0) {
        aiSuggestion = `⚠️ ${riskAlerts[0].symbol} is ${riskAlerts[0].nearSL ? `only ${riskAlerts[0].slDistPct}% from your stoploss` : 'missing a stoploss'}. Review before trading today.`
      } else if (nearTPAlerts.length > 0) {
        aiSuggestion = `🎯 ${nearTPAlerts[0].symbol} is ${nearTPAlerts[0].tpDistPct}% away from your target. Consider booking partial profits.`
      } else if (discipline?.streak >= 3) {
        aiSuggestion = `🔥 You're on a ${discipline.streak}-day discipline streak! Keep the momentum going today.`
      } else if (topGainers.length > 0) {
        aiSuggestion = `📈 ${topGainers[0]?.s} is the top gainer today at +${topGainers[0]?.p}%. Check if it's on your watchlist.`
      } else {
        aiSuggestion = `📊 You have ${open.length} open position${open.length !== 1 ? 's' : ''}. Stay disciplined and follow your plan.`
      }

      setData({
        openPositions: openWithPrices,
        topGainers, topLosers,
        watchAlerts,
        riskAlerts, nearTPAlerts,
        discipline, unrealizedTotal,
        completedYesterday, totalTasks: (ft || []).length,
        aiSuggestion,
        winRate: closed.length > 0
          ? Math.round((closed.filter(t => (parseFloat(t.realized_pnl) || 0) > 0).length / closed.length) * 100)
          : 0
      })
    } catch (err) {
      console.error('MorningBriefing fetch error:', err)
      setFetchError('Could not load your briefing. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBriefingData()
  }, [fetchBriefingData])

  // Keyboard: Escape closes modal; trap focus inside overlay
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return { text: 'Good Morning', emoji: '☀️' }
    if (h < 17) return { text: 'Good Afternoon', emoji: '🌤️' }
    return { text: 'Good Evening', emoji: '🌙' }
  }

  const { text: greetText, emoji: greetEmoji } = getGreeting()

  const handleAction = (action) => {
    onClose()
    if (action === 'logs') navigate('/logs')
    if (action === 'portfolio') navigate('/portfolio')
    if (action === 'chat') navigate('/chat')
    if (action === 'risklab') navigate('/risklab')
  }

  // Format unrealized P&L — show full number for small values, K-suffix for large
  const formatUnrealized = (val) => {
    const abs = Math.abs(val)
    const prefix = val >= 0 ? '+' : '-'
    if (abs >= 10000) return `${prefix}${Math.round(abs / 1000)}K`
    return `${prefix}Rs.${abs.toLocaleString()}`
  }

  if (loading) return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Loading morning briefing"
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center w-80">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Preparing your briefing...</p>
      </div>
    </div>
  )

  if (fetchError) return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center w-80 space-y-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-700 dark:text-gray-200 font-semibold">Briefing Unavailable</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{fetchError}</p>
        <div className="flex gap-3">
          <button
            onClick={fetchBriefingData}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )

  if (!data) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Morning briefing"
      ref={containerRef}
    >
      <div className="w-full max-w-2xl max-h-screen overflow-y-auto">

        {/* Main Card */}
        <div className="relative bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="relative bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 px-8 py-8 overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500 rounded-full filter blur-3xl" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-purple-500 rounded-full filter blur-3xl" />
              <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-green-500 rounded-full filter blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{greetEmoji}</span>
                    <p className="text-blue-300 text-sm font-medium">{greetText}</p>
                  </div>
                  <h1 className="text-3xl font-bold text-white">
                    {user?.name?.split(' ')[0]} 👋
                  </h1>
                  <p className="text-gray-400 text-sm mt-1">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close morning briefing"
                  className="w-8 h-8 rounded-xl bg-white bg-opacity-10 hover:bg-opacity-20 flex items-center justify-center text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quote */}
              <div className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-2xl px-4 py-3 mb-4">
                <p className="text-gray-300 text-sm italic">"{quote}"</p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Open', value: data.openPositions.length, color: 'text-blue-400' },
                  { label: 'Win Rate', value: `${data.winRate}%`, color: data.winRate >= 50 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Streak', value: `🔥${data.discipline?.streak || 0}`, color: 'text-orange-400' },
                  { label: 'Unrealized', value: formatUnrealized(data.unrealizedTotal), color: data.unrealizedTotal >= 0 ? 'text-green-400' : 'text-red-400' },
                ].map((s, i) => (
                  <div key={i} className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl p-2 text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-gray-500 text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">

            {/* AI Suggestion */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 border border-blue-100 dark:border-blue-700 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <div className="w-4 h-4 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs font-black">T</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 mb-1">Tradeo AI · Today's Insight</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{data.aiSuggestion}</p>
                </div>
              </div>
            </div>

            {/* Risk Alerts */}
            {(data.riskAlerts.length > 0 || data.nearTPAlerts.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">⚠️ Risk Alerts</p>
                <div className="space-y-2">
                  {data.riskAlerts.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-red-50 dark:bg-red-900 border border-red-100 dark:border-red-700 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{t.symbol.slice(0,2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t.symbol}</p>
                          <p className="text-xs text-red-500">
                            {t.noSL ? '⚠️ No stoploss set!' : `🔴 Only ${t.slDistPct}% from SL`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${(t.unrealizedPnl || 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {(t.unrealizedPnl || 0) >= 0 ? '+' : ''}Rs.{Math.abs(t.unrealizedPnl || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {data.nearTPAlerts.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-green-50 dark:bg-green-900 border border-green-100 dark:border-green-700 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{t.symbol.slice(0,2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t.symbol}</p>
                          <p className="text-xs text-green-500">🎯 Only {t.tpDistPct}% from target!</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-lg bg-green-100 text-green-700">
                        +Rs.{Math.abs(t.unrealizedPnl || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market Snapshot */}
            {(data.topGainers.length > 0 || data.topLosers.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">📈 Market Snapshot</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                    <p className="text-xs font-semibold text-green-500 mb-2">Top Gainers</p>
                    <div className="space-y-1.5">
                      {data.topGainers.map((s, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: ['#3b82f6','#8b5cf6','#06b6d4'][i] }}>
                              {s.s?.slice(0,2)}
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{s.s}</span>
                          </div>
                          <span className="text-xs font-semibold text-green-500 bg-green-50 dark:bg-green-900 px-1.5 py-0.5 rounded-lg">+{s.p}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                    <p className="text-xs font-semibold text-red-500 mb-2">Top Losers</p>
                    <div className="space-y-1.5">
                      {data.topLosers.map((s, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: ['#ef4444','#f97316','#eab308'][i] }}>
                              {s.s?.slice(0,2)}
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{s.s}</span>
                          </div>
                          <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-900 px-1.5 py-0.5 rounded-lg">{s.p}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Watchlist Alerts Due */}
            {data.watchAlerts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">📅 Watchlist Alerts Due</p>
                <div className="space-y-2">
                  {data.watchAlerts.map(w => (
                    <div key={w.id} className="flex items-center justify-between bg-orange-50 dark:bg-orange-900 border border-orange-100 dark:border-orange-700 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{w.symbol.slice(0,2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{w.symbol}</p>
                          <p className="text-xs text-orange-500">
                            {w.notes?.replace(/^\[(BUY|SELL)\]\s*/, '') || 'Alert date reached'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        w.notes?.startsWith('[BUY]')
                          ? 'bg-green-100 text-green-700'
                          : w.notes?.startsWith('[SELL]')
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {w.notes?.startsWith('[BUY]') ? '🟢 BUY' : w.notes?.startsWith('[SELL]') ? '🔴 SELL' : '📅 DUE'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Focus */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">🎯 Today's Focus</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-blue-500">{data.completedYesterday}/{data.totalTasks}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tasks Done</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-orange-400">🔥 {data.discipline?.streak || 0}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Day Streak</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-green-500">{data.discipline?.monthlyScore || 0}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">Monthly Score</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleAction('logs')}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-sm font-semibold transition-colors"
              >
                <span>📈</span> Add Trade
              </button>
              <button
                onClick={() => handleAction('chat')}
                className="flex items-center justify-center gap-2 bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-2xl text-sm font-semibold transition-colors"
              >
                <div className="w-4 h-4 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-xs font-black">T</span>
                </div>
                Ask AI
              </button>
              <button
                onClick={() => handleAction('risklab')}
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl text-sm font-semibold transition-colors"
              >
                <span>⚗️</span> Risk Lab
              </button>
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-2xl text-sm font-semibold transition-colors"
              >
                <span>🚀</span> Start Trading
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default MorningBriefing
