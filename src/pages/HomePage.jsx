import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useContextMenu } from '../components/ContextMenu'
import { useChatRefresh } from '../utils/chatEvents'
import TaskBoard from '../components/dashboard/TaskBoard'
import DisciplineScore from '../components/dashboard/DisciplineScore'
import MonthlyGoals from '../components/dashboard/MonthlyGoals'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import NEPSEChart from '../components/NEPSEChart'
import {
  getDashboardInit as _getDashboardInit, getStockPrice,
  addToWatchlist, removeFromWatchlist,
} from '../api'
import { getDashboardInit } from '../utils/globalCache'

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

// ── Logged-out landing ────────────────────────────────────────────────────────
function LoggedOutHome() {
  const { t } = useLanguage()
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)])

  const dummyStats = [
    { label: 'Total P/L', value: '+Rs. 24,850', color: 'text-green-500' },
    { label: 'Win Rate', value: '68%', color: 'text-blue-500' },
    { label: 'Open Trades', value: '4', color: 'text-gray-900 dark:text-white' },
    { label: 'Streak', value: '🔥 7 days', color: 'text-orange-500' },
  ]
  const dummyWatchlist = ['NABIL', 'NTC', 'SCB', 'EBL', 'NICA', 'HBL', 'NLIC', 'UPPER']
  const dummyTrades = [
    { symbol: 'NABIL', entry: 1240, ltp: 1310, pnl: '+Rs. 3,500', pct: '+5.6%' },
    { symbol: 'NTC',   entry: 890,  ltp: 860,  pnl: '-Rs. 1,200', pct: '-3.4%' },
    { symbol: 'SCB',   entry: 3100, ltp: 3280, pnl: '+Rs. 9,000', pct: '+5.8%' },
    { symbol: 'EBL',   entry: 1560, ltp: 1590, pnl: '+Rs. 1,500', pct: '+1.9%' },
  ]
  const dummyTasks = ['Review morning briefing', 'Check NABIL resistance', 'Update trade journal', 'Set SL for SCB']

  return (
    <div className="relative w-full">

      {/* Blurred dashboard preview */}
      <div className="relative select-none pointer-events-none px-4 py-4 flex flex-col gap-4">

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 filter blur-[2px]">
          {dummyStats.map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left column */}
          <div className="hidden lg:flex col-span-3 flex-col gap-4">
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden filter blur-[2px]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Watchlist</h3>
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
          <div className="bg-white/97 dark:bg-gray-900/97 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header strip */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 px-5 sm:px-8 py-5 sm:py-6 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium tracking-widest uppercase">Trading Workspace</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {t('hero.headline')}<br />
                <span className="text-green-400">{t('hero.headlineAccent')}</span>
              </h1>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">{t('hero.sub')}</p>
            </div>

            {/* Features grid */}
            <div className="px-5 sm:px-8 py-4 sm:py-5 grid grid-cols-1 xs:grid-cols-2 gap-3">
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
            <div className="px-5 sm:px-8 py-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] text-gray-400 italic text-center">"{quote}"</p>
            </div>

            {/* CTA */}
            <div className="px-5 sm:px-8 py-4 sm:py-5 border-t border-gray-100 dark:border-gray-800 flex gap-3">
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

// ── Alerts widget (right column) ─────────────────────────────────────────────
function AlertsWidget({ initData }) {
  const navigate = useNavigate()
  const trades   = initData?.trades   || []
  const watchlist = initData?.watchlist || []
  const goals    = initData?.goals    || []
  const prices   = initData?.prices   || {}

  const today = new Date().toISOString().slice(0, 10)

  const alerts = []

  // SL near / No SL — open positions
  for (const t of trades) {
    if (t.status !== 'OPEN' && t.status !== 'PARTIAL') continue
    const entry = parseFloat(t.entry_price) || 0
    const ltp   = parseFloat(prices[t.symbol]?.price) || 0
    const sl    = t.sl != null ? parseFloat(t.sl) : null
    const tp    = t.tp != null ? parseFloat(t.tp) : null

    if (!sl) {
      alerts.push({ type: 'nosl', label: `${t.symbol} — No SL set`, severity: 'warn', to: '/logs' })
    } else if (ltp > 0) {
      const slDist = t.position === 'LONG'
        ? ((ltp - sl) / ltp) * 100
        : ((sl - ltp) / ltp) * 100
      if (slDist >= 0 && slDist <= 3)
        alerts.push({ type: 'sl', label: `${t.symbol} SL near — ${slDist.toFixed(1)}% away`, severity: 'danger', to: '/logs' })
    }

    if (tp && ltp > 0) {
      const tpDist = t.position === 'LONG'
        ? ((tp - ltp) / ltp) * 100
        : ((ltp - tp) / ltp) * 100
      if (tpDist >= 0 && tpDist <= 3)
        alerts.push({ type: 'tp', label: `${t.symbol} TP near — ${tpDist.toFixed(1)}% away`, severity: 'success', to: '/logs' })
    }
  }

  // Watchlist price alert
  for (const w of watchlist) {
    if (!w.price_alert) continue
    const ltp    = parseFloat(prices[w.symbol]?.price) || 0
    const target = parseFloat(w.price_alert)
    if (ltp <= 0) continue
    const dist = Math.abs((ltp - target) / target) * 100
    if (dist <= 2)
      alerts.push({ type: 'watch', label: `${w.symbol} near alert Rs.${target.toLocaleString()} — ${dist.toFixed(1)}% away`, severity: 'info', to: '/' })
  }

  // Goal deadline — expiring within 7 days
  for (const g of goals) {
    if (g.completed || !g.target_date) continue
    const daysLeft = Math.ceil((new Date(g.target_date) - new Date(today)) / 86400000)
    if (daysLeft >= 0 && daysLeft <= 7)
      alerts.push({ type: 'goal', label: `Goal "${g.title}" — ${daysLeft === 0 ? 'due today' : `${daysLeft}d left`}`, severity: 'warn', to: '/logs' })
  }

  // Circuit near — open positions within 5% of ±10% circuit
  for (const t of trades) {
    if (t.status !== 'OPEN' && t.status !== 'PARTIAL') continue
    const ltp   = parseFloat(prices[t.symbol]?.price) || 0
    const chg   = parseFloat(prices[t.symbol]?.change) || 0
    if (ltp <= 0) continue
    if (Math.abs(chg) >= 8)
      alerts.push({ type: 'circuit', label: `${t.symbol} near circuit — ${chg > 0 ? '+' : ''}${chg}%`, severity: chg > 0 ? 'success' : 'danger', to: '/screen' })
  }

  const iconMap = {
    nosl: '⚠', sl: '🔴', tp: '🟢', watch: '🔔', goal: '📅', circuit: '⚡',
  }
  const severityClass = {
    danger:  'border-l-red-400 bg-red-50 dark:bg-red-900/10',
    warn:    'border-l-orange-400 bg-orange-50 dark:bg-orange-900/10',
    success: 'border-l-green-400 bg-green-50 dark:bg-green-900/10',
    info:    'border-l-blue-400 bg-blue-50 dark:bg-blue-900/10',
  }
  const textClass = {
    danger: 'text-red-600 dark:text-red-400',
    warn:   'text-orange-600 dark:text-orange-400',
    success:'text-green-600 dark:text-green-400',
    info:   'text-blue-600 dark:text-blue-400',
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-[12px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Alerts</h3>
        {alerts.length > 0 && (
          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-gray-400">All clear — no active alerts</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-64 overflow-y-auto">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => navigate(a.to)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-l-2 hover:opacity-80 transition-opacity ${severityClass[a.severity]}`}
            >
              <span className="text-sm flex-shrink-0">{iconMap[a.type]}</span>
              <span className={`text-[11px] font-medium leading-snug ${textClass[a.severity]}`}>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Open Positions panel (right column) ──────────────────────────────────────
function OpenPositionsPanel({ openPositions, perfStats, navigate }) {
  const { t: tr } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-[12px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          {tr('positions.title')}
          {perfStats && perfStats.openCount > 0 && (
            <span className="ml-2 text-[10px] font-normal text-gray-400">({perfStats.openCount})</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
            aria-expanded={!collapsed}
          >
            <svg className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button onClick={() => navigate('/portfolio')} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">›</button>
        </div>
      </div>

      {!collapsed && (
        openPositions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-400 text-xs">{tr('positions.noPositions')}</p>
            <button onClick={() => navigate('/logs')} className="mt-2 text-blue-500 text-xs hover:underline">+ Add a trade</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {openPositions.slice(0, 5).map(t => {
              const slDistPct = t.sl != null && t.currentPrice
                ? t.position === 'SHORT'
                  ? (((t.sl - t.currentPrice) / t.currentPrice) * 100).toFixed(1)
                  : (((t.currentPrice - t.sl) / t.currentPrice) * 100).toFixed(1)
                : null
              const tpDistPct = t.tp != null && t.currentPrice
                ? t.position === 'SHORT'
                  ? (((t.currentPrice - t.tp) / t.currentPrice) * 100).toFixed(1)
                  : (((t.tp - t.currentPrice) / t.currentPrice) * 100).toFixed(1)
                : null

              return (
                <div key={t.id} className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" translate="no">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StockAvatar symbol={t.symbol} size="w-7 h-7" textSize="text-[10px]" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{t.symbol}</p>
                          <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                            t.position === 'LONG'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>{t.position}</span>
                          {t.status === 'PARTIAL' && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300 font-medium">P</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">{t.quantity} @ Rs.{(t.entry_price || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {t.unrealizedPnl != null ? (
                        <p className={`text-xs font-semibold ${t.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {t.unrealizedPnl >= 0 ? '+' : ''}Rs.{Math.abs(t.unrealizedPnl).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">—</p>
                      )}
                      {t.pnlPct != null && (
                        <p className={`text-[10px] ${parseFloat(t.pnlPct) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {parseFloat(t.pnlPct) >= 0 ? '+' : ''}{t.pnlPct}%
                        </p>
                      )}
                    </div>
                  </div>
                  {/* SL / TP compact pills */}
                  <div className="flex items-center gap-1.5 mt-1.5 ml-9 flex-wrap">
                    {t.sl != null ? (
                      <span className="text-[10px] bg-red-50 dark:bg-red-900/40 text-red-500 px-1.5 py-0.5 rounded">
                        SL {slDistPct !== null ? `${parseFloat(slDistPct) > 0 ? '+' : ''}${slDistPct}%` : `Rs.${t.sl.toLocaleString()}`}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-orange-50 dark:bg-orange-900/40 text-orange-500 px-1.5 py-0.5 rounded">⚠ No SL</span>
                    )}
                    {t.tp != null && (
                      <span className="text-[10px] bg-green-50 dark:bg-green-900/40 text-green-500 px-1.5 py-0.5 rounded">
                        TP {tpDistPct !== null ? `${parseFloat(tpDistPct) > 0 ? '+' : ''}${tpDistPct}%` : `Rs.${t.tp.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {openPositions.length > 5 && (
              <button
                onClick={() => navigate('/portfolio')}
                className="w-full px-4 py-2 text-[11px] font-semibold text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center"
              >
                +{openPositions.length - 5} more → Portfolio
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl px-4 py-3 border border-gray-100 dark:border-gray-800">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Center dashboard (authenticated) ─────────────────────────────────────────
function CenterDashboard({ navigate, initData, onRefresh, onDataReady }) {
  const { t: tr } = useLanguage()
  const [openPositions, setOpenPositions] = useState([])
  const [perfStats, setPerfStats] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [watchlistTab, setWatchlistTab] = useState('active')
  const { onContextMenu: watchCtx, ContextMenuPortal: WatchMenuPortal } = useContextMenu()
  const [loading, setLoading] = useState(!initData)
  const [error, setError] = useState(null)
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [newSymbol, setNewSymbol] = useState('')
  const [searchingSymbol, setSearchingSymbol] = useState(false)
  const [symbolInfo, setSymbolInfo] = useState(null)
  const [symbolError, setSymbolError] = useState('')
  const [watchActionErr, setWatchActionErr] = useState(null)
  const [watchForm, setWatchForm] = useState({
    price_alert: '',
    alert_date: '',
    alert_type: '',
    notes: ''
  })

  // Rule 14 — close add-watch panel on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setShowAddWatch(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  const applyData = useCallback((d) => {
    const trades    = d.trades || []
    const priceMap  = d.prices || {}
    const open      = trades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
    const closed    = trades.filter(t => t.status === 'CLOSED' || t.status === 'PARTIAL')

    const openWithPrices = open.map(t => {
      const entry = parseFloat(t.entry_price) || 0
      const qty   = parseFloat(t.remaining_quantity || t.quantity) || 0
      const p     = priceMap[t.symbol]
      const ltp   = p ? parseFloat(p.price) || 0 : 0
      const pnl   = ltp ? (t.position === 'LONG' ? (ltp - entry) * qty : (entry - ltp) * qty) : 0
      const pnlPct = entry > 0 && qty > 0 && ltp ? ((pnl / (entry * qty)) * 100).toFixed(2) : '0.00'
      return {
        ...t,
        entry_price: entry, quantity: qty, remaining_quantity: qty,
        sl: t.sl != null ? parseFloat(t.sl) : null,
        tp: t.tp != null ? parseFloat(t.tp) : null,
        currentPrice: ltp || null, change: p?.change ?? null,
        unrealizedPnl: ltp ? Math.round(pnl) : null, pnlPct: ltp ? pnlPct : null,
      }
    })
    setOpenPositions(openWithPrices)

    const totalUnrealized = openWithPrices.reduce((s, t) => s + (t.unrealizedPnl || 0), 0)
    const totalRealized   = closed.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
    const profitable      = closed.filter(t => (parseFloat(t.realized_pnl) || 0) > 0).length
    const winRate         = closed.length > 0 ? Math.round((profitable / closed.length) * 100) : 0
    setPerfStats({
      totalPnl: totalRealized + totalUnrealized, unrealizedPnl: totalUnrealized,
      realizedPnl: totalRealized, winRate, openCount: openWithPrices.length,
      closedCount: closed.length,
      totalInvested:  openWithPrices.reduce((s, t) => s + (t.entry_price * t.quantity), 0),
      currentValue:   openWithPrices.reduce((s, t) => s + ((t.currentPrice || t.entry_price) * t.quantity), 0),
    })

    const watchWithPrices = (d.watchlist || []).map(w => {
      const p = priceMap[w.symbol]
      return { ...w, currentPrice: p ? parseFloat(p.price) || null : null, change: p?.change ?? null }
    })
    const portfolioItems = openWithPrices.map(t => ({
      id: `pos_${t.id}`, symbol: t.symbol, currentPrice: t.currentPrice, change: t.change,
      category: '__portfolio__', isPosition: true, position: t.position,
      quantity: t.quantity, entry_price: t.entry_price, unrealizedPnl: t.unrealizedPnl,
      pnlPct: t.pnlPct, sl: t.sl, tp: t.tp, status: t.status,
    }))
    setWatchlist([...watchWithPrices, ...portfolioItems])
    if (onDataReady) onDataReady({ openPositions: openWithPrices, perfStats: {
      totalPnl: totalRealized + totalUnrealized, unrealizedPnl: totalUnrealized,
      realizedPnl: totalRealized, winRate, openCount: openWithPrices.length,
      closedCount: closed.length,
      totalInvested:  openWithPrices.reduce((s, t) => s + (t.entry_price * t.quantity), 0),
      currentValue:   openWithPrices.reduce((s, t) => s + ((t.currentPrice || t.entry_price) * t.quantity), 0),
    }})
  }, [onDataReady])

  // Hydrate from parent-supplied initData (avoids a second /init fetch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initData) { applyData(initData); setLoading(false) }
  }, [initData])

  useChatRefresh(['trades', 'watchlist'], onRefresh)

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
    setWatchActionErr(null)
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
      if (onRefresh) await onRefresh()
    } catch (err) {
      setWatchActionErr(err.response?.data?.message || 'Failed to add to watchlist.')
    }
  }

  const handleRemoveWatch = async (id) => {
    setWatchActionErr(null)
    try {
      await removeFromWatchlist(id)
      setWatchlist(prev => prev.filter(w => w.id !== id))
    } catch (err) {
      setWatchActionErr(err.response?.data?.message || 'Failed to remove from watchlist.')
    }
  }

  const filteredWatch = watchlist.filter(w => {
    if (watchlistTab === 'portfolio') return w.category === '__portfolio__'
    return w.category === watchlistTab
  })

  // Rule 8 — ISO date comparison for alert_date countdown
  const today = new Date().toISOString().slice(0, 10)

  if (loading) return (
    <div className="flex flex-col gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
        <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl" />)}
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
      <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      <button onClick={onRefresh} className="mt-3 text-xs text-red-500 hover:underline">Retry</button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      {perfStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatCard
            label={tr('stats.totalPL')}
            value={`${perfStats.totalPnl >= 0 ? '+' : ''}Rs. ${Math.abs(Math.round(perfStats.totalPnl)).toLocaleString()}`}
            color={perfStats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}
            sub={`Realized ${perfStats.realizedPnl >= 0 ? '+' : ''}Rs.${Math.round(perfStats.realizedPnl).toLocaleString()} · Open ${perfStats.unrealizedPnl >= 0 ? '+' : ''}Rs.${Math.round(perfStats.unrealizedPnl).toLocaleString()}`}
          />
          <StatCard
            label="Realized P/L"
            value={`${perfStats.realizedPnl >= 0 ? '+' : ''}Rs. ${Math.abs(Math.round(perfStats.realizedPnl)).toLocaleString()}`}
            color={perfStats.realizedPnl > 0 ? 'text-green-500' : perfStats.realizedPnl < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}
            sub={perfStats.closedCount > 0 ? `${perfStats.closedCount} closed trade${perfStats.closedCount !== 1 ? 's' : ''}` : 'No closed trades yet'}
          />
          <StatCard
            label={tr('stats.winRate')}
            value={`${perfStats.winRate}%`}
            color={perfStats.winRate >= 50 ? 'text-green-500' : perfStats.winRate > 0 ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-400'}
            sub={perfStats.closedCount > 0 ? `from ${perfStats.closedCount} closed trades` : 'No closed trades yet'}
          />
          <StatCard
            label={tr('stats.openPositions')}
            value={perfStats.openCount}
            color="text-gray-900 dark:text-white"
            sub={perfStats.totalInvested > 0 ? `Rs. ${Math.round(perfStats.totalInvested).toLocaleString()} invested` : undefined}
          />
        </div>
      )}

      {/* Drawdown warning */}
      {perfStats && perfStats.totalPnl < 0 && perfStats.totalInvested > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
          <p className="text-[11px] text-red-600 dark:text-red-300 font-medium">
            {/* Rule 6 — guard denominator */}
            Drawdown: {((perfStats.totalPnl / perfStats.totalInvested) * 100).toFixed(2)}%
            {(perfStats.totalInvested + perfStats.totalPnl) > 0 &&
              ` — Need +${Math.abs((perfStats.totalPnl / (perfStats.totalInvested + perfStats.totalPnl)) * 100).toFixed(2)}% to recover`
            }
          </p>
        </div>
      )}

      {/* ── NEPSE Chart ───────────────────────────────────────────────────────── */}
      <NEPSEChart fixed={true} />

      {/* ── Watchlist ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-[12px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{tr('watchlist.title')}</h3>
          <div className="flex items-center gap-1">
            {[
              { key: 'active',      label: tr('watchlist.active') },
              { key: 'pre',         label: tr('watchlist.preWatch') },
              { key: 'portfolio',   label: tr('watchlist.portfolio') },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setWatchlistTab(key)}
                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                  watchlistTab === key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
            {watchlistTab !== 'portfolio' && (
              <button
                onClick={() => setShowAddWatch(v => !v)}
                aria-expanded={showAddWatch}
                className="ml-1 w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors font-bold text-sm"
              >
                {showAddWatch ? '×' : '+'}
              </button>
            )}
          </div>
        </div>

        {/* Add-watch panel */}
        {showAddWatch && watchlistTab !== 'portfolio' && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60">

            {/* Rule 5 — surface errors */}
            {watchActionErr && (
              <div className="mb-2 flex items-center justify-between bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400">{watchActionErr}</p>
                <button onClick={() => setWatchActionErr(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
              </div>
            )}

            {/* Symbol search */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newSymbol}
                onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                placeholder="Symbol e.g. NABIL"
                autoComplete="off"
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleSymbolSearch()}
              />
              <button
                onClick={handleSymbolSearch}
                disabled={searchingSymbol || !newSymbol.trim()}
                className="bg-gray-800 dark:bg-gray-700 text-white px-3 py-1.5 rounded-xl text-xs hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
              >
                {searchingSymbol ? '...' : 'Search'}
              </button>
            </div>

            {symbolError && <p className="text-xs text-red-500 mb-2">{symbolError}</p>}

            {symbolInfo && (
              <>
                {/* Stock info card */}
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <StockAvatar symbol={symbolInfo.symbol} size="w-7 h-7" />
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{symbolInfo.symbol}</p>
                      <p className="text-xs text-gray-400">Rs.{parseFloat(symbolInfo.price || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={`text-xs font-medium ${symbolInfo.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {symbolInfo.change >= 0 ? '+' : ''}{symbolInfo.change}%
                  </p>
                </div>

                {/* Alert type toggle */}
                <div className="flex gap-2 mb-3">
                  {['BUY', 'SELL'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setWatchForm(prev => ({ ...prev, alert_type: prev.alert_type === type ? '' : type }))}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        watchForm.alert_type === type
                          ? type === 'BUY' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                          : `border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 ${
                              type === 'BUY' ? 'hover:border-green-400 hover:text-green-500' : 'hover:border-red-400 hover:text-red-500'
                            }`
                      }`}
                    >
                      {type === 'BUY' ? '✓ Buy Alert' : '✓ Sell Alert'}
                    </button>
                  ))}
                </div>

                {/* Price alert */}
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
                      parseFloat(watchForm.price_alert) > parseFloat(symbolInfo.price)
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-500'
                    }`}>
                      <span>
                        {parseFloat(watchForm.price_alert) > parseFloat(symbolInfo.price) ? '↑' : '↓'} Rs.{Math.abs(Math.round(parseFloat(watchForm.price_alert) - parseFloat(symbolInfo.price))).toLocaleString()} away
                      </span>
                      {/* Rule 6 — guard division */}
                      {parseFloat(symbolInfo.price) > 0 && (
                        <span>
                          {Math.abs(((parseFloat(watchForm.price_alert) - parseFloat(symbolInfo.price)) / parseFloat(symbolInfo.price)) * 100).toFixed(2)}% {parseFloat(watchForm.price_alert) > parseFloat(symbolInfo.price) ? 'rally' : 'drop'} needed
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Date alert */}
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">📅 Date Alert</p>
                  <input
                    type="date"
                    value={watchForm.alert_date}
                    onChange={e => setWatchForm(prev => ({ ...prev, alert_date: e.target.value }))}
                    min={today}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                  {watchForm.alert_date && (
                    <div className="mt-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-between">
                      {/* Rule 8 — ISO string date comparison */}
                      <span>📅 {new Date(watchForm.alert_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>{Math.ceil((new Date(watchForm.alert_date) - new Date(today)) / (1000 * 60 * 60 * 24))} days remaining</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={watchForm.notes}
                    onChange={e => setWatchForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="📝 Note (optional)"
                    autoComplete="off"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 mb-1.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[
                      '💰 Salary coming', '📰 Bad news',
                      '📈 NEPSE season starting', '📉 NEPSE season ending',
                      '🏦 Dividend expected', '📊 Bonus share',
                      '⚡ Breakout watch', '🔄 Accumulation zone',
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

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddWatch('active')}
                    className="flex-1 text-xs bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 font-medium transition-colors"
                  >
                    {tr('watchlist.addToActive')}
                  </button>
                  <button
                    onClick={() => handleAddWatch('pre')}
                    className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
                  >
                    {tr('watchlist.addToPreWatch')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rule 5 — surface remove errors */}
        {watchActionErr && !showAddWatch && (
          <div className="mx-3 mt-2 flex items-center justify-between bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
            <p className="text-xs text-red-600 dark:text-red-400">{watchActionErr}</p>
            <button onClick={() => setWatchActionErr(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
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
              <WatchMenuPortal />
              {filteredWatch.map(item => (
                <div key={item.id}
                  onContextMenu={!item.isPosition ? watchCtx([
                    { label: 'Delete', icon: '🗑️', danger: true, action: () => handleRemoveWatch(item.id) },
                  ]) : undefined}
                  className="flex flex-col bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-2 group cursor-default"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <StockAvatar symbol={item.symbol} size="w-7 h-7" />
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
                        <p className="text-[10px] text-gray-400">
                          {item.isPosition
                            ? `${item.quantity} @ Rs.${item.entry_price?.toLocaleString()}`
                            : `Rs.${item.currentPrice != null ? parseFloat(item.currentPrice).toLocaleString() : '—'}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.isPosition && item.unrealizedPnl != null ? (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.unrealizedPnl >= 0
                            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
                        }`}>
                          {item.unrealizedPnl >= 0 ? '+' : ''}Rs.{Math.abs(item.unrealizedPnl).toLocaleString()}
                        </span>
                      ) : item.change != null ? (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.change >= 0
                            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
                        }`}>
                          {item.change >= 0 ? '+' : ''}{item.change}%
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Alert badges (visible on hover) */}
                  {!item.isPosition && (() => {
                    const messages = []
                    const ltp = item.currentPrice ? parseFloat(item.currentPrice) : null

                    if (item.price_alert && ltp) {
                      const alertPrice = parseFloat(item.price_alert)
                      const diff = alertPrice - ltp
                      // Rule 6 — guard division
                      const pct = ltp > 0 ? Math.abs((diff / ltp) * 100).toFixed(2) : '0.00'
                      const isBuy  = item.notes?.startsWith('[BUY]')
                      const isSell = item.notes?.startsWith('[SELL]')
                      const tag = isBuy ? '🟢 BUY' : isSell ? '🔴 SELL' : '🎯'

                      if (Math.abs(diff) < ltp * 0.02) {
                        messages.push({ text: `${tag} Near alert! Rs.${alertPrice}`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' })
                      } else if (diff > 0) {
                        messages.push({ text: `${tag} +${pct}% → Rs.${alertPrice}`, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' })
                      } else {
                        messages.push({ text: `${tag} ${pct}% drop → Rs.${alertPrice}`, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' })
                      }
                    }

                    if (item.alert_date) {
                      // Rule 8 — ISO string comparison
                      const days = Math.ceil((new Date(item.alert_date) - new Date(today)) / (1000 * 60 * 60 * 24))
                      const isBuy  = item.notes?.startsWith('[BUY]')
                      const isSell = item.notes?.startsWith('[SELL]')
                      const dateTag = isBuy ? '🟢 BUY' : isSell ? '🔴 SELL' : '📅'
                      const dateColor = isBuy ? 'text-green-600 dark:text-green-400' : isSell ? 'text-red-500' : 'text-blue-500'
                      const dateBg   = isBuy ? 'bg-green-50 dark:bg-green-900/30' : isSell ? 'bg-red-50 dark:bg-red-900/30' : 'bg-blue-50 dark:bg-blue-900/30'

                      if (days < 0) {
                        messages.push({ text: `${dateTag} Expired ${Math.abs(days)}d ago`, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700' })
                      } else if (days === 0) {
                        messages.push({ text: `${dateTag} Alert date is TODAY!`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' })
                      } else if (days <= 3) {
                        messages.push({ text: `${dateTag} ${days}d to alert`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' })
                      } else {
                        messages.push({ text: `${dateTag} ${days} days to alert`, color: dateColor, bg: dateBg })
                      }
                    }

                    const cleanNote = item.notes?.replace(/^\[(BUY|SELL)\]\s*/, '')
                    if (cleanNote) {
                      messages.push({ text: `📝 ${cleanNote}`, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700' })
                    }

                    return messages.length > 0 ? (
                      <div className="mt-1.5 space-y-1 hidden group-hover:block">
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

// ── Logged-in layout ─────────────────────────────────────────────────────────
function LoggedInHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [initData, setInitData] = useState(null)
  const [dashData, setDashData] = useState({ openPositions: [], perfStats: null })

  const handleDashData = useCallback(({ openPositions, perfStats }) => {
    setDashData({ openPositions, perfStats })
  }, [])

  // gCache-backed fetch — survives navigate-away-and-back within 60s TTL
  const fetchDashboard = useCallback(async (force = false) => {
    try {
      const res = await getDashboardInit(() => _getDashboardInit(), force)
      setInitData(res.data)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

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
    <>
    <div className="w-full px-3 sm:px-4 py-3 sm:py-4 bg-gray-50 dark:bg-gray-900 min-h-screen">

      {/* Greeting bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Trader'} 👋
          </p>
          <p className="text-[11px] text-gray-400">{today}</p>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>

      {/* 3-Column Layout — stacks on mobile, side-by-side on lg */}
      <div className="grid grid-cols-12 gap-3 sm:gap-4">

        {/* LEFT — Daily Routine + Goals */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 sm:gap-4">
          <TaskBoard initData={initData?.tasks} mindsetContent={initData?.mindset?.content} />
          <MonthlyGoals initData={initData?.goals} />
        </div>

        {/* CENTER — Stats + Watchlist */}
        <div className="col-span-12 lg:col-span-6">
          <CenterDashboard navigate={navigate} initData={initData} onRefresh={() => fetchDashboard(true)} onDataReady={handleDashData} />
        </div>

        {/* RIGHT — Discipline Score + Open Positions + Alerts */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 sm:gap-4">
          <DisciplineScore initData={initData?.discipline} />
          <OpenPositionsPanel openPositions={dashData.openPositions} perfStats={dashData.perfStats} navigate={navigate} />
          <AlertsWidget initData={initData} />
        </div>

      </div>
    </div>

    </>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {user ? <LoggedInHome /> : <LoggedOutHome />}
    </div>
  )
}

export default HomePage
