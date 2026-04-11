import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
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
  const { t } = useLanguage()
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]

  const dummyStats = [
    { label: 'Total P/L', value: '+Rs. 24,850', color: 'text-green-500' },
    { label: 'Win Rate', value: '68%', color: 'text-blue-500' },
    { label: 'Open Trades', value: '4', color: 'text-gray-900 dark:text-white' },
    { label: 'Streak', value: '🔥 7 days', color: 'text-orange-500' },
  ]
  const dummyWatchlist = ['NABIL', 'NTC', 'SCB', 'EBL', 'NICA', 'HBL', 'NLIC', 'UPPER']
  const dummyTrades = [
    { symbol: 'NABIL', entry: 1240, ltp: 1310, pnl: '+Rs. 3,500', pct: '+5.6%', pos: 'LONG' },
    { symbol: 'NTC', entry: 890, ltp: 860, pnl: '-Rs. 1,200', pct: '-3.4%', pos: 'LONG' },
    { symbol: 'SCB', entry: 3100, ltp: 3280, pnl: '+Rs. 9,000', pct: '+5.8%', pos: 'LONG' },
    { symbol: 'EBL', entry: 1560, ltp: 1590, pnl: '+Rs. 1,500', pct: '+1.9%', pos: 'LONG' },
  ]
  const dummyTasks = ['Review morning briefing', 'Check NABIL resistance', 'Update trade journal', 'Set SL for SCB']

  return (
    <div className="relative w-full">

      {/* Blurred dashboard preview */}
      <div className="relative select-none pointer-events-none px-4 py-4 flex flex-col gap-4">

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 filter blur-[2px]">
          {dummyStats.map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left column */}
          <div className="col-span-3 flex flex-col gap-4">
            {/* Discipline score skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Discipline Score</p>
              <div className="flex items-center justify-center">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3"
                      strokeDasharray="68 32" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">68</span>
                    <span className="text-[9px] text-gray-400">/ 100</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {['Consistency', 'Risk Mgmt', 'Journaling'].map((l, i) => (
                  <div key={l} className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400">{l}</span>
                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${[72, 60, 80][i]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly goals skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Monthly Goals</p>
              <div className="space-y-2">
                {[['P&L Target', 75], ['Win Rate', 60], ['Trade Count', 90]].map(([l, pct]) => (
                  <div key={l}>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>{l}</span><span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center column */}
          <div className="col-span-6 flex flex-col gap-4">
            {/* Open positions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden filter blur-[2px]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Open Positions</h3>
                <span className="text-xs text-gray-400">4 active</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {dummyTrades.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <StockAvatar symbol={t.symbol} size="w-7 h-7" />
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{t.symbol}</p>
                        <p className="text-[10px] text-gray-400">Entry Rs.{t.entry}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${t.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{t.pnl}</p>
                      <p className={`text-[10px] ${t.pct.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{t.pct}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Watchlist */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden filter blur-[2px]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Watchlist</h3>
                <div className="flex gap-1">
                  {['Active', 'Pre-Watch', 'Portfolio'].map(tab => (
                    <span key={tab} className={`text-[10px] px-2 py-0.5 rounded-full ${tab === 'Active' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'text-gray-400'}`}>{tab}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 grid grid-cols-4 gap-2">
                {dummyWatchlist.map((sym, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <StockAvatar symbol={sym} size="w-6 h-6" textSize="text-[9px]" />
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{sym}</p>
                    </div>
                    <p className="text-[10px] text-gray-400">Rs.{[1240,890,3100,1560,420,760,980,640][i]}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${i % 2 === 0 ? 'bg-green-100 dark:bg-green-900 text-green-600' : 'bg-red-100 dark:bg-red-900 text-red-500'}`}>
                      {i % 2 === 0 ? '+' : '-'}{[2.4,1.8,3.1,0.9,2.2,1.5,4.0,0.7][i]}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="col-span-3 flex flex-col gap-4">
            {/* Task board skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Today's Tasks</p>
              <div className="space-y-2">
                {dummyTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${i < 2 ? 'bg-green-400 border-green-400' : 'border-gray-300'}`} />
                    <span className={`text-[11px] ${i < 2 ? 'line-through text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>{task}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between text-[10px] text-gray-400">
                <span>2 / 4 done</span><span>50%</span>
              </div>
            </div>

            {/* AI chat skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Tradeo AI</p>
              <div className="space-y-2">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-gray-500">NABIL has broken resistance at 1300. Consider reviewing your SL.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900 rounded-xl px-3 py-2 ml-4">
                  <p className="text-[11px] text-blue-600 dark:text-blue-300">What's my win rate this month?</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-gray-500">Your win rate is 68% with 17 trades closed this month.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Centered intro overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg mx-4">
          {/* Main card */}
          <div className="bg-white/97 dark:bg-gray-900/97 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header strip */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 px-8 py-6 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium tracking-widest uppercase">NEPSE Trading Workspace</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-snug">
                {t('hero.headline')}<br />
                <span className="text-green-400">{t('hero.headlineAccent')}</span>
              </h1>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                {t('hero.sub')}
              </p>
            </div>

            {/* Features grid */}
            <div className="px-8 py-5 grid grid-cols-2 gap-3">
              {[
                { icon: '📒', title: t('hero.feat1Title'), desc: t('hero.feat1Desc') },
                { icon: '👁️', title: t('hero.feat2Title'), desc: t('hero.feat2Desc') },
                { icon: '📊', title: t('hero.feat3Title'), desc: t('hero.feat3Desc') },
                { icon: '🧠', title: t('hero.feat4Title'), desc: t('hero.feat4Desc') },
                { icon: '🤖', title: t('hero.feat5Title'), desc: t('hero.feat5Desc') },
                { icon: '⚗️', title: t('hero.feat6Title'), desc: t('hero.feat6Desc') },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-2.5">
                  <span className="text-base mt-0.5">{f.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{f.title}</p>
                    <p className="text-[11px] text-gray-400 leading-snug">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quote */}
            <div className="px-8 py-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] text-gray-400 italic text-center">"{quote}"</p>
            </div>

            {/* CTA */}
            <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <Link to="/signup" className="flex-1 bg-green-500 hover:bg-green-400 text-white py-2.5 rounded-xl text-sm font-semibold text-center transition-colors">
                {t('hero.cta')}
              </Link>
              <Link to="/login" className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl text-sm font-medium text-center hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors">
                {t('hero.ctaLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CenterDashboard({ navigate }) {
  const { t: tr } = useLanguage()
  const [trades, setTrades] = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [perfStats, setPerfStats] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [watchlistTab, setWatchlistTab] = useState('active')
  const [perfCollapsed, setPerfCollapsed] = useState(false)
  const [positionsCollapsed, setPositionsCollapsed] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [newSymbol, setNewSymbol] = useState('')
  const [searchingSymbol, setSearchingSymbol] = useState(false)
  const [symbolInfo, setSymbolInfo] = useState(null)
  const [symbolError, setSymbolError] = useState('')
  const [watchForm, setWatchForm] = useState({
    price_alert: '',
    alert_date: '',
    alert_type: '',
    notes: ''
  })

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
      await addToWatchlist({
        symbol: newSymbol.toUpperCase(),
        category,
        price_alert: watchForm.price_alert ? parseFloat(watchForm.price_alert) : null,
        alert_date: watchForm.alert_date || null,
        notes: watchForm.alert_type
          ? `[${watchForm.alert_type}] ${watchForm.notes || ''}`.trim()
          : watchForm.notes || null,
      })
      setNewSymbol('')
      setSymbolInfo(null)
      setShowAddWatch(false)
      setWatchForm({ price_alert: '', alert_date: '', alert_type: '', notes: '' })
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
              label: tr('stats.totalPL'),
              value: `${perfStats.totalPnl >= 0 ? '+' : ''}Rs. ${Math.abs(Math.round(perfStats.totalPnl)).toLocaleString()}`,
              color: perfStats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
            },
            {
              label: tr('stats.unrealized'),
              value: `${perfStats.totalInvested > 0 ? ((perfStats.unrealizedPnl / perfStats.totalInvested) * 100).toFixed(2) : '0.00'}%`,
              color: perfStats.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
            },
            {
              label: tr('stats.winRate'),
              value: `${perfStats.winRate}%`,
              color: 'text-gray-900 dark:text-white'
            },
            {
              label: tr('stats.openPositions'),
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tr('positions.title')}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPositionsCollapsed(!positionsCollapsed)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              {positionsCollapsed ? tr('positions.expand') : tr('positions.collapse')}
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
                <p className="text-gray-400 text-sm">{tr('positions.noPositions')}</p>
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tr('watchlist.title')}</h3>
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
                {tab === 'active' ? tr('watchlist.active') : tab === 'pre' ? tr('watchlist.preWatch') : tr('watchlist.portfolio')}
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

            {/* Symbol Search */}
            <div className="flex gap-2 mb-3">
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

            {/* Stock Info */}
            {symbolInfo && (
              <>
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <StockAvatar symbol={symbolInfo.symbol} size="w-7 h-7" />
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{symbolInfo.symbol}</p>
                      <p className="text-xs text-gray-400">Rs.{symbolInfo.price?.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={`text-xs font-medium ${symbolInfo.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {symbolInfo.change >= 0 ? '+' : ''}{symbolInfo.change}%
                  </p>
                </div>

                {/* Alert Type */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setWatchForm(prev => ({ ...prev, alert_type: prev.alert_type === 'BUY' ? '' : 'BUY' }))}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      watchForm.alert_type === 'BUY'
                        ? 'bg-green-500 text-white border-green-500'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-500'
                    }`}
                  >
                    ✓ Buy Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatchForm(prev => ({ ...prev, alert_type: prev.alert_type === 'SELL' ? '' : 'SELL' }))}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      watchForm.alert_type === 'SELL'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-500'
                    }`}
                  >
                    ✓ Sell Alert
                  </button>
                </div>

                {/* Price Alert */}
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">🎯 Price Alert (Rs.)</p>
                  <input
                    type="number"
                    value={watchForm.price_alert}
                    onChange={e => setWatchForm(prev => ({ ...prev, price_alert: e.target.value }))}
                    placeholder={`Current: Rs.${symbolInfo.price}`}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                  {watchForm.price_alert && symbolInfo.price && (
                    <div className={`mt-1 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center justify-between ${
                      parseFloat(watchForm.price_alert) > symbolInfo.price
                        ? 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900 text-red-500'
                    }`}>
                      <span>
                        {parseFloat(watchForm.price_alert) > symbolInfo.price ? '↑' : '↓'} Rs.{Math.abs(Math.round(parseFloat(watchForm.price_alert) - symbolInfo.price)).toLocaleString()} away
                      </span>
                      <span>
                        {Math.abs(((parseFloat(watchForm.price_alert) - symbolInfo.price) / symbolInfo.price) * 100).toFixed(2)}% {parseFloat(watchForm.price_alert) > symbolInfo.price ? 'rally' : 'drop'} needed
                      </span>
                    </div>
                  )}
                </div>

                {/* Date Alert */}
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">📅 Date Alert</p>
                  <input
                    type="date"
                    value={watchForm.alert_date}
                    onChange={e => setWatchForm(prev => ({ ...prev, alert_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                  {watchForm.alert_date && (
                    <div className="mt-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-between">
                      <span>📅 {new Date(watchForm.alert_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>{Math.ceil((new Date(watchForm.alert_date) - new Date()) / (1000 * 60 * 60 * 24))} days remaining</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="mb-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={watchForm.notes}
                      onChange={e => setWatchForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="📝 Note (optional)"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[
                        '💰 Salary coming',
                        '📰 Bad news',
                        '📈 NEPSE season starting',
                        '📉 NEPSE season ending',
                        '🏦 Dividend expected',
                        '📊 Bonus share',
                        '⚡ Breakout watch',
                        '🔄 Accumulation zone',
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setWatchForm(prev => ({ ...prev, notes: suggestion }))}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            watchForm.notes === suggestion
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 bg-white dark:bg-gray-800'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddWatch('active')}
                    className="flex-1 text-xs bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 font-medium"
                  >
                    {tr('watchlist.addToActive')}
                  </button>
                  <button
                    onClick={() => handleAddWatch('pre')}
                    className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-xl hover:bg-gray-200 font-medium"
                  >
                    {tr('watchlist.addToPreWatch')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-3">
          {filteredWatch.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-gray-400">
                {watchlistTab === 'portfolio' ? tr('watchlist.noPositions') : tr('watchlist.noStocks')}
              </p>
              {watchlistTab !== 'portfolio' && (
                <button onClick={() => setShowAddWatch(true)} className="text-xs text-blue-500 mt-1 hover:underline">{tr('watchlist.addStock')}</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {filteredWatch.map(item => (
                <div key={item.id} className="flex flex-col bg-gray-50 dark:bg-gray-700 rounded-lg px-2.5 py-2 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <StockAvatar symbol={item.symbol} size="w-7 h-7" />
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
                        <p className="text-[10px] text-gray-400">
                          {item.isPosition
                            ? `${item.quantity} @ Rs.${item.entry_price}`
                            : `Rs.${item.currentPrice?.toLocaleString() || '—'}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.isPosition && item.unrealizedPnl !== null ? (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.unrealizedPnl >= 0
                            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
                        }`}>
                          {item.unrealizedPnl >= 0 ? '+' : ''}Rs.{Math.abs(item.unrealizedPnl).toLocaleString()}
                        </span>
                      ) : item.change !== undefined && item.change !== null ? (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
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
                  {/* Alert messages */}
                  {!item.isPosition && (() => {
                    const messages = []
                    const ltp = item.currentPrice

                    if (item.price_alert && ltp) {
                      const diff = item.price_alert - ltp
                      const pct = Math.abs((diff / ltp) * 100).toFixed(2)
                      const isBuy = item.notes?.startsWith('[BUY]')
                      const isSell = item.notes?.startsWith('[SELL]')
                      const tag = isBuy ? '🟢 BUY' : isSell ? '🔴 SELL' : '🎯'

                      if (Math.abs(diff) < ltp * 0.02) {
                        messages.push({ text: `${tag} Near alert! Rs.${item.price_alert}`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900' })
                      } else if (diff > 0) {
                        messages.push({ text: `${tag} +${pct}% rally → Rs.${item.price_alert}`, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900' })
                      } else {
                        messages.push({ text: `${tag} ${pct}% drop → Rs.${item.price_alert}`, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900' })
                      }
                    }

                    if (item.alert_date) {
                      const days = Math.ceil((new Date(item.alert_date) - new Date()) / (1000 * 60 * 60 * 24))
                      const isBuy = item.notes?.startsWith('[BUY]')
                      const isSell = item.notes?.startsWith('[SELL]')
                      const dateTag = isBuy ? '🟢 BUY' : isSell ? '🔴 SELL' : '📅'
                      const dateColor = isBuy ? 'text-green-600 dark:text-green-400' : isSell ? 'text-red-500' : 'text-blue-500'
                      const dateBg = isBuy ? 'bg-green-50 dark:bg-green-900' : isSell ? 'bg-red-50 dark:bg-red-900' : 'bg-blue-50 dark:bg-blue-900'

                      if (days < 0) {
                        messages.push({ text: `${dateTag} Alert expired ${Math.abs(days)}d ago`, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700' })
                      } else if (days === 0) {
                        messages.push({ text: `${dateTag} Alert date is TODAY!`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900' })
                      } else if (days <= 3) {
                        messages.push({ text: `${dateTag} ${days}d to alert date`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900' })
                      } else {
                        messages.push({ text: `${dateTag} ${days} days to alert date`, color: dateColor, bg: dateBg })
                      }
                    }

                    const cleanNote = item.notes?.replace(/^\[(BUY|SELL)\]\s*/, '')
                    if (cleanNote) {
                      messages.push({ text: `📝 ${cleanNote}`, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700' })
                    }

                    return messages.length > 0 ? (
                      <div className="mt-1.5 space-y-1">
                        {messages.map((m, i) => (
                          <div key={i} className={`${m.bg} px-1.5 py-0.5 rounded-lg`}>
                            <p className={`text-[10px] font-medium leading-tight ${m.color}`}>{m.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : null
                  })()}
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