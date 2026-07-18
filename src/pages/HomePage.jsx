// === HomePage.jsx — home page: logged-out landing (blurred preview + hero), logged-in dashboard (stats, watchlist, positions, alerts, NEPSE chart) ===
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useContextMenu } from '../components/ContextMenu'
import { useChatRefresh, useHighlightListener, dispatchHighlight } from '../utils/chatEvents'
import TaskBoard from '../components/dashboard/TaskBoard'
import DisciplineScore from '../components/dashboard/DisciplineScore'
import MonthlyGoals from '../components/dashboard/MonthlyGoals'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useLocalStorage } from '../hooks/useLocalStorage'
import NEPSEChart from '../components/NEPSEChart'
import PageSkeleton from '../components/PageSkeleton'
import { addToWatchlist, updateWatchlist, removeFromWatchlist } from '../api'
import { getDashboardInit, getMarketSymbols } from '../utils/globalCache'
import { MarketStatusChip } from '../components/common/MarketStatusBadge'

const MOTIVATIONAL_QUOTES = [
  'The market is a device for transferring money from the impatient to the patient.',
  'Risk comes from not knowing what you are doing.',
  'In investing, what is comfortable is rarely profitable.',
  'Trade what you see, not what you think.',
  'Plan the trade, trade the plan.',
  'Discipline is the bridge between trading goals and trading reality.',
]

const STOCK_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-yellow-500',
  'bg-cyan-500',
]
const STOCK_BORDERS = [
  'border-blue-400',
  'border-green-400',
  'border-purple-400',
  'border-orange-400',
  'border-pink-400',
  'border-teal-400',
  'border-red-400',
  'border-indigo-400',
  'border-yellow-400',
  'border-cyan-400',
]
const STOCK_BAR_COLORS = [
  'bg-blue-400',
  'bg-green-400',
  'bg-purple-400',
  'bg-orange-400',
  'bg-pink-400',
  'bg-teal-400',
  'bg-red-400',
  'bg-indigo-400',
  'bg-yellow-400',
  'bg-cyan-400',
]

// Hash the full symbol — using only charCodeAt(0) collapsed every same-initial
// symbol (NABIL/NTC/NLIC/NICA…) onto one color, which is common in NEPSE banks.
function hashSymbol(symbol) {
  let h = 0
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) | 0
  return Math.abs(h)
}
function getStockColor(symbol) {
  if (!symbol) return 'bg-blue-500'
  return STOCK_COLORS[hashSymbol(symbol) % STOCK_COLORS.length]
}
function getStockBorder(symbol) {
  if (!symbol) return 'border-blue-400'
  return STOCK_BORDERS[hashSymbol(symbol) % STOCK_BORDERS.length]
}
function getStockBar(symbol) {
  if (!symbol) return 'bg-blue-400'
  return STOCK_BAR_COLORS[hashSymbol(symbol) % STOCK_BAR_COLORS.length]
}

function StockAvatar({ symbol, size = 'w-8 h-8', textSize = 'text-xs' }) {
  return (
    <div
      className={`${size} ${getStockColor(symbol)} rounded-lg flex items-center justify-center flex-shrink-0`}
    >
      <span className={`text-white font-bold ${textSize}`}>{symbol?.slice(0, 2) || '??'}</span>
    </div>
  )
}

// ── Logged-out landing ────────────────────────────────────────────────────────
function LoggedOutHome() {
  const { t } = useLanguage()
  const [quote] = useState(
    () => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  )

  const dummyStats = [
    { label: 'Total P/L', value: '+Rs. 24,850', color: 'text-green-500' },
    { label: 'Win Rate', value: '68%', color: 'text-blue-500' },
    { label: 'Open Trades', value: '4', color: 'text-gray-900 dark:text-white' },
    { label: 'Streak', value: '🔥 7 days', color: 'text-orange-500' },
  ]
  const dummyWatchlist = ['NABIL', 'NTC', 'SCB', 'EBL', 'NICA', 'HBL', 'NLIC', 'UPPER']
  const dummyTrades = [
    { symbol: 'NABIL', entry: 1240, ltp: 1310, pnl: '+Rs. 3,500', pct: '+5.6%' },
    { symbol: 'NTC', entry: 890, ltp: 860, pnl: '-Rs. 1,200', pct: '-3.4%' },
    { symbol: 'SCB', entry: 3100, ltp: 3280, pnl: '+Rs. 9,000', pct: '+5.8%' },
    { symbol: 'EBL', entry: 1560, ltp: 1590, pnl: '+Rs. 1,500', pct: '+1.9%' },
  ]
  const dummyTasks = [
    'Review morning briefing',
    'Check NABIL resistance',
    'Update trade journal',
    'Set SL for SCB',
  ]

  // Candlestick motif for the brand backdrop (same asset as the auth BrandPanel).
  const heroCandles = [
    { x: 40, h: 80, t: 200, green: true },
    { x: 90, h: 150, t: 150, green: false },
    { x: 140, h: 60, t: 230, green: true },
    { x: 190, h: 120, t: 170, green: true },
    { x: 240, h: 190, t: 130, green: false },
    { x: 290, h: 90, t: 210, green: true },
    { x: 340, h: 140, t: 160, green: true },
    { x: 390, h: 70, t: 235, green: false },
  ]

  return (
    <div className="relative w-full min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Brand backdrop — clean gray-950 surface with a faint animated candlestick
          motif (the real brand element, not fake dashboard data). This is the base
          layer behind the hero on every screen size. */}
      <div className="absolute inset-0 bg-gray-950 pointer-events-none select-none overflow-hidden">
        {/* soft radial glow — top-weighted so the empty space above the card has depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(34,197,94,0.14),transparent_65%)]" />
        <svg
          className="absolute inset-x-0 bottom-0 w-full h-[55%] opacity-[0.13]"
          viewBox="0 0 420 280"
          preserveAspectRatio="xMidYMax slice"
        >
          {heroCandles.map((c, i) => (
            <g
              key={c.x}
              className="animate-candle-grow origin-bottom"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <line
                x1={c.x}
                y1={c.t - 22}
                x2={c.x}
                y2={c.t + c.h + 22}
                stroke={c.green ? '#22c55e' : '#ef4444'}
                strokeWidth="1.5"
              />
              <rect
                x={c.x - 9}
                y={c.t}
                width="18"
                height={c.h}
                fill={c.green ? '#22c55e' : '#ef4444'}
                rx="2"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Blurred dashboard preview — desktop only (intentional marketing mock per
          design.md). Hidden on phones, where it read as a fake-data "vibecoded"
          wall; phones get the clean brand backdrop above instead. */}
      <div className="hidden sm:flex absolute inset-0 select-none pointer-events-none px-4 py-4 flex-col gap-4 overflow-hidden">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 filter blur-[2px]">
          {dummyStats.map((s, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700"
            >
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
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3"
                      strokeDasharray="68 32"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">68</span>
                    <span className="text-[10px] text-gray-400">/ 100</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {['Consistency', 'Risk Mgmt', 'Journaling'].map((l, i) => (
                  <div key={l} className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400">{l}</span>
                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full"
                        style={{ width: `${[72, 60, 80][i]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Monthly Goals</p>
              <div className="space-y-2">
                {[
                  ['P&L Target', 75],
                  ['Win Rate', 60],
                  ['Trade Count', 90],
                ].map(([l, pct]) => (
                  <div key={l}>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>{l}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center column */}
          <div className="col-span-6 flex flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden filter blur-[2px]">
              <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Open Positions
                </h3>
                <span className="text-xs text-gray-400">4 active</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {dummyTrades.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StockAvatar symbol={t.symbol} size="w-7 h-7" />
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                          {t.symbol}
                        </p>
                        <p className="text-[10px] text-gray-400">Entry Rs.{t.entry}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xs font-semibold ${t.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {t.pnl}
                      </p>
                      <p
                        className={`text-[10px] ${t.pct.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {t.pct}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden filter blur-[2px]">
              <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Watchlist</h3>
              </div>
              <div className="p-3 grid grid-cols-4 gap-2">
                {dummyWatchlist.map((sym, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <StockAvatar symbol={sym} size="w-6 h-6" textSize="text-[10px]" />
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{sym}</p>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Rs.{[1240, 890, 3100, 1560, 420, 760, 980, 640][i]}
                    </p>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${i % 2 === 0 ? 'bg-green-100 dark:bg-green-900 text-green-600' : 'bg-red-100 dark:bg-red-900 text-red-500'}`}
                    >
                      {i % 2 === 0 ? '+' : '-'}
                      {[2.4, 1.8, 3.1, 0.9, 2.2, 1.5, 4.0, 0.7][i]}%
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
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${i < 2 ? 'bg-green-400 border-green-400' : 'border-gray-300'}`}
                    />
                    <span
                      className={`text-[11px] ${i < 2 ? 'line-through text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                      {task}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between text-[10px] text-gray-400">
                <span>2 / 4 done</span>
                <span>50%</span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Tradeo AI</p>
              <div className="space-y-2">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-gray-500">
                    NABIL has broken resistance at 1300. Consider reviewing your SL.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900 rounded-xl px-3 py-2 ml-4">
                  <p className="text-[11px] text-blue-600 dark:text-blue-300">
                    What's my win rate this month?
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-gray-500">
                    Your win rate is 68% with 17 trades closed this month.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrim — desktop only: softens the blurred preview behind the centered card.
          On mobile the backdrop is already the clean dark brand surface, so no wash. */}
      <div className="hidden sm:block absolute inset-0 z-10 pointer-events-none bg-white/30 dark:bg-gray-950/40" />

      {/* Intro overlay — vertically centered in the viewport box. scale-in on mount. */}
      <div
        className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none px-3 py-3 sm:p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="pointer-events-auto w-full max-w-lg animate-scale-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl ring-1 ring-black/5 border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[88dvh] overflow-y-auto">
            {/* Header strip */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 px-5 sm:px-8 py-4 sm:py-6 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium tracking-widest uppercase">
                  Trading Workspace
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {t('hero.headline')}
                <br />
                <span className="text-green-400">{t('hero.headlineAccent')}</span>
              </h1>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">{t('hero.sub')}</p>
            </div>

            {/* Features grid — 2-up on all phone widths to keep the card short */}
            <div className="px-5 sm:px-8 py-3.5 sm:py-5 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-3">
              {[
                { icon: '📒', title: t('hero.feat1Title'), desc: t('hero.feat1Desc') },
                { icon: '👁️', title: t('hero.feat2Title'), desc: t('hero.feat2Desc') },
                { icon: '📊', title: t('hero.feat3Title'), desc: t('hero.feat3Desc') },
                { icon: '🧠', title: t('hero.feat4Title'), desc: t('hero.feat4Desc') },
                { icon: '🤖', title: t('hero.feat5Title'), desc: t('hero.feat5Desc') },
                { icon: '⚗️', title: t('hero.feat6Title'), desc: t('hero.feat6Desc') },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="flex items-start gap-2.5 animate-fade-up"
                  style={{ animationDelay: `${100 + i * 50}ms` }}
                >
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

            {/* CTA — primary full-width on top, login below (no wrap, clear hierarchy) */}
            <div className="px-5 sm:px-8 py-3.5 sm:py-5 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <Link
                to="/signup"
                className="active:scale-[0.98] flex-1 bg-green-500 hover:bg-green-400 text-white min-h-[48px] flex items-center justify-center py-3 rounded-xl text-sm font-semibold text-center transition-all shadow-sm shadow-green-500/20"
              >
                {t('hero.cta')}
              </Link>
              <Link
                to="/login"
                className="active:scale-[0.98] flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 min-h-[48px] flex items-center justify-center py-3 rounded-xl text-sm font-medium text-center hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all"
              >
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
const ALERTS_DEFAULT_LIMIT = 7

const SEVERITY_ORDER = { danger: 0, warn: 1, success: 2, info: 3 }

function AlertsWidget({ initData }) {
  const navigate = useNavigate()
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const trades = initData?.trades || []
  const watchlist = initData?.watchlist || []
  const goals = initData?.goals || []
  const prices = initData?.prices || {}

  // Local calendar day (NEPSE is UTC+5:45 — toISOString rolls over after ~18:15
  // local, throwing the goal day-count off by one in the evening).
  const today = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  const alerts = []

  // SL near / No SL — open positions
  for (const t of trades) {
    if (t.status !== 'OPEN' && t.status !== 'PARTIAL') continue
    const entry = parseFloat(t.entry_price) || 0
    const ltp = parseFloat(prices[t.symbol]?.price) || 0
    const sl = t.sl != null ? parseFloat(t.sl) : null
    const tp = t.tp != null ? parseFloat(t.tp) : null

    if (!sl) {
      alerts.push({
        type: 'nosl',
        symbol: t.symbol,
        label: `${t.symbol} — No SL set`,
        severity: 'warn',
        to: '/logs',
      })
    } else if (ltp > 0) {
      // Positive = price still above SL (LONG) / below SL (SHORT); negative = SL breached.
      const slDist = t.position === 'LONG' ? ((ltp - sl) / ltp) * 100 : ((sl - ltp) / ltp) * 100
      if (slDist < 0)
        alerts.push({
          type: 'sl',
          symbol: t.symbol,
          label: `${t.symbol} SL breached — ${Math.abs(slDist).toFixed(1)}% past`,
          severity: 'danger',
          to: '/logs',
        })
      else if (slDist <= 3)
        alerts.push({
          type: 'sl',
          symbol: t.symbol,
          label: `${t.symbol} SL near — ${slDist.toFixed(1)}% away`,
          severity: 'danger',
          to: '/logs',
        })
    }

    if (tp && ltp > 0) {
      const tpDist = t.position === 'LONG' ? ((tp - ltp) / ltp) * 100 : ((ltp - tp) / ltp) * 100
      if (tpDist >= 0 && tpDist <= 3)
        alerts.push({
          type: 'tp',
          symbol: t.symbol,
          label: `${t.symbol} TP near — ${tpDist.toFixed(1)}% away`,
          severity: 'success',
          to: '/logs',
        })
    }
  }

  // Watchlist price alert
  for (const w of watchlist) {
    if (!w.price_alert) continue
    const ltp = parseFloat(prices[w.symbol]?.price) || 0
    const target = parseFloat(w.price_alert)
    if (ltp <= 0) continue
    const dist = Math.abs((ltp - target) / target) * 100
    if (dist <= 2)
      alerts.push({
        type: 'watch',
        symbol: w.symbol,
        label: `${w.symbol} near alert Rs.${target.toLocaleString()} — ${dist.toFixed(1)}% away`,
        severity: 'info',
        to: '/',
        highlight: { domain: 'watchlist', key: w.symbol },
      })
  }

  // Goal deadline — expiring within 7 days. Anchor both dates to local midnight so
  // the day-count is timezone-stable.
  const todayMidnight = new Date(today + 'T00:00:00')
  for (const g of goals) {
    if (g.completed || !g.target_date) continue
    const goalDate = new Date(g.target_date.slice(0, 10) + 'T00:00:00')
    const daysLeft = Math.round((goalDate - todayMidnight) / 86400000)
    if (daysLeft >= 0 && daysLeft <= 7)
      alerts.push({
        type: 'goal',
        title: g.title,
        daysLeft,
        label: `Goal "${g.title}" — ${daysLeft === 0 ? 'due today' : `${daysLeft}d left`}`,
        severity: 'warn',
        // Goals live in the MonthlyGoals card on the home page, not the trade log.
        to: '/',
        highlight: { domain: 'goals', key: g.id ?? g.title },
      })
  }

  // Circuit near — open positions within 5% of ±10% circuit
  for (const t of trades) {
    if (t.status !== 'OPEN' && t.status !== 'PARTIAL') continue
    const ltp = parseFloat(prices[t.symbol]?.price) || 0
    const chg = parseFloat(prices[t.symbol]?.change) || 0
    if (ltp <= 0) continue
    if (Math.abs(chg) >= 8)
      alerts.push({
        type: 'circuit',
        symbol: t.symbol,
        label: `${t.symbol} near circuit — ${chg > 0 ? '+' : ''}${chg}%`,
        severity: chg > 0 ? 'success' : 'danger',
        // It's the user's own open position — take them to their trade log, not the
        // market-wide screener.
        to: '/logs',
      })
  }

  // Sort by severity (danger first); within equal severity, sooner goal deadlines win.
  const sortedAlerts = [...alerts].sort((a, b) => {
    const sd = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
    if (sd !== 0) return sd
    // Secondary: goal alerts with fewer days left are more urgent.
    if (a.type === 'goal' && b.type === 'goal') return a.daysLeft - b.daysLeft
    return 0
  })

  const visibleAlerts = showAllAlerts ? sortedAlerts : sortedAlerts.slice(0, ALERTS_DEFAULT_LIMIT)
  const hasMoreAlerts = sortedAlerts.length > ALERTS_DEFAULT_LIMIT

  const iconMap = {
    nosl: '⚠',
    sl: '🔴',
    tp: '🟢',
    watch: '🔔',
    goal: '📅',
    circuit: '⚡',
  }
  const severityClass = {
    danger: 'border-l-red-400 bg-red-50 dark:bg-red-900/10',
    warn: 'border-l-orange-400 bg-orange-50 dark:bg-orange-900/10',
    success: 'border-l-green-400 bg-green-50 dark:bg-green-900/10',
    info: 'border-l-blue-400 bg-blue-50 dark:bg-blue-900/10',
  }
  const textClass = {
    danger: 'text-red-600 dark:text-red-400',
    warn: 'text-orange-600 dark:text-orange-400',
    success: 'text-green-600 dark:text-green-400',
    info: 'text-blue-600 dark:text-blue-400',
  }

  if (!initData)
    return (
      <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm h-full animate-pulse p-4 space-y-2">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    )

  return (
    <div className="hp-card bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm overflow-hidden h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          Alerts
        </h3>
        {alerts.length > 0 && (
          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4 py-6 text-center">
          <p className="text-[11px] text-gray-400 dark:text-gray-600">
            All clear — no active alerts
          </p>
        </div>
      ) : (
        <>
          {/* Scrollable alert list */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-gray-50 dark:divide-gray-800">
            {visibleAlerts.map((a) => (
              <button
                key={`${a.type}-${a.symbol ?? a.title ?? a.label}`}
                onClick={() => {
                  navigate(a.to)
                  // Flash the matching card item. If we're already on the target page
                  // the listener fires immediately; if we just navigated to '/', the
                  // card mounts and the listener picks it up on the next dispatch tick.
                  if (a.highlight)
                    requestAnimationFrame(() => dispatchHighlight(a.highlight))
                }}
                className={`hp-alert-row w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-l-2 ${severityClass[a.severity]}`}
              >
                <span className="text-[13px] flex-shrink-0">{iconMap[a.type]}</span>
                <span className={`text-[11px] font-medium leading-snug ${textClass[a.severity]}`}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
          {/* Show all — always pinned at bottom, outside scroll */}
          {hasMoreAlerts && (
            <button
              onClick={() => setShowAllAlerts((s) => !s)}
              className="flex-shrink-0 py-2 text-[10px] font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 transition-colors border-t border-gray-100 dark:border-gray-800 w-full"
            >
              {showAllAlerts ? '↑ Show less' : `Show all ${sortedAlerts.length} alerts`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div className="hp-stat bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-3 border border-white/60 dark:border-white/10 shadow-sm">
      <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5 sm:mb-1 truncate">
        {label}
      </p>
      <p className={`text-[12px] sm:text-lg font-bold tracking-tight leading-none ${color}`}>
        {value}
      </p>
      {sub && <p className="hidden sm:block text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Center dashboard (authenticated) ─────────────────────────────────────────
function CenterDashboard({ navigate, initData, onRefresh, onDataReady, mobileTopTab, setMobileTopTab }) {
  const { t: tr } = useLanguage()
  const [openPositions, setOpenPositions] = useState([])
  const [perfStats, setPerfStats] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [watchlistTab, setWatchlistTab] = useState('active')
  const { onContextMenu: watchCtx, ContextMenuPortal: WatchMenuPortal } = useContextMenu()
  const [loading, setLoading] = useState(!initData)
  const [error, setError] = useState(null)

  // Stats window in months — owner-selectable + persisted (the future Settings
  // page takes ownership of this preference later). Clamped 1–24. #t30 HOME-9
  const [statMonthsRaw, setStatMonths] = useLocalStorage('hp.statsMonths', 2)
  const statMonths = Math.min(24, Math.max(1, parseInt(statMonthsRaw) || 2))
  const [showStatsSettings, setShowStatsSettings] = useState(false)

  // add-flow: null | 'search' | { symbol, refPrice }
  const [watchAddState, setWatchAddState] = useState(null)
  // edit-flow
  const [watchEditItem, setWatchEditItem] = useState(null)
  const [watchActionErr, setWatchActionErr] = useState(null)

  // symbol list for autocomplete — load once
  const symbolListRef = useRef([])
  const priceMapRef = useRef({})
  const [symbolsReady, setSymbolsReady] = useState(false)
  // search UI
  const [watchQuery, setWatchQuery] = useState('')
  const [watchCursor, setWatchCursor] = useState(-1)
  const watchInputRef = useRef(null)
  // add-form state
  const [watchForm, setWatchForm] = useState({
    price_alert: '',
    alert_date: '',
    watch_low: '',
    watch_high: '',
    notes: '',
  })
  const [watchAdding, setWatchAdding] = useState(false)
  // edit-form state
  const [watchEditForm, setWatchEditForm] = useState(null)
  const [watchSaving, setWatchSaving] = useState(false)
  // highlight-on-alert-click
  const [highlightSym, setHighlightSym] = useState(null)
  const watchRowRefs = useRef({}) // symbol → row DOM node
  const highlightTimer = useRef(null)

  useEscapeKey(() => {
    setWatchAddState(null)
    setWatchEditItem(null)
    setWatchForm({ price_alert: '', alert_date: '', watch_low: '', watch_high: '', notes: '' })
    setWatchEditForm(null)
    setWatchQuery('')
    setShowStatsSettings(false)
  })

  const applyData = useCallback(
    (d) => {
      const trades = d.trades || []
      const priceMap = d.prices || {}
      priceMapRef.current = priceMap
      const open = trades.filter((t) => t.status === 'OPEN' || t.status === 'PARTIAL')
      const closed = trades.filter((t) => t.status === 'CLOSED')

      const openWithPrices = open.map((t) => {
        const entry = parseFloat(t.entry_price) || 0
        const qty = parseFloat(t.total_qty || t.quantity) || 0
        const p = priceMap[t.symbol]
        const ltp = p ? parseFloat(p.price) || 0 : 0
        const pnl = ltp ? (t.position === 'LONG' ? (ltp - entry) * qty : (entry - ltp) * qty) : 0
        const pnlPct =
          entry > 0 && qty > 0 && ltp ? ((pnl / (entry * qty)) * 100).toFixed(2) : '0.00'
        // Today's intraday move on this open position. `change` is the day's % move
        // (diff_pct vs previous close), so prevClose = ltp / (1 + change/100), and
        // today's gain = (ltp − prevClose) * qty (inverted for SHORT).
        const dayChgPct = p?.change != null ? parseFloat(p.change) : null
        let dayPnl = 0
        if (ltp && dayChgPct != null && Number.isFinite(dayChgPct)) {
          const prevClose = ltp / (1 + dayChgPct / 100)
          const move = (ltp - prevClose) * qty
          dayPnl = t.position === 'LONG' ? move : -move
        }
        return {
          ...t,
          entry_price: entry,
          quantity: qty,
          remaining_quantity: qty,
          sl: t.sl != null ? parseFloat(t.sl) : null,
          tp: t.tp != null ? parseFloat(t.tp) : null,
          currentPrice: ltp || null,
          change: p?.change ?? null,
          unrealizedPnl: ltp ? Math.round(pnl) : null,
          dayPnl: ltp ? Math.round(dayPnl) : 0,
          pnlPct: ltp ? pnlPct : null,
        }
      })
      setOpenPositions(openWithPrices)

      const totalUnrealized = openWithPrices.reduce((s, t) => s + (t.unrealizedPnl || 0), 0)
      // Local calendar day (NEPSE is UTC+5:45 — toISOString would roll the date
      // over after ~18:15 local and misattribute late-evening trades to tomorrow).
      const todayStr = (() => {
        const d = new Date()
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      })()
      // Selected window (statMonths) for the labeled "Realized P/L (nM)" / "Win Rate (nM)" cards
      const windowStart = new Date()
      windowStart.setMonth(windowStart.getMonth() - statMonths)
      windowStart.setHours(0, 0, 0, 0)
      // Backend /init maps last_action_at → updated_at in the trade shape
      const recent = closed.filter((t) => t.updated_at && new Date(t.updated_at) >= windowStart)
      const realizedWindow = recent.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
      const profitable = recent.filter((t) => (parseFloat(t.realized_pnl) || 0) > 0).length
      const winRate = recent.length > 0 ? Math.round((profitable / recent.length) * 100) : 0
      // "Total P/L" must be a true lifetime figure: all closed realized P/L + open
      // unrealized. Using the 2-month subset here silently dropped older gains.
      const realizedAll = closed.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
      // Today's P/L = realized P/L from trades closed today + today's intraday move
      // on still-open positions (was 0 unless something was closed today).
      const realizedToday = closed
        .filter((t) => t.updated_at?.slice(0, 10) === todayStr)
        .reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
      const openDayPnl = openWithPrices.reduce((s, t) => s + (t.dayPnl || 0), 0)
      const todayPnl = realizedToday + openDayPnl
      const totalInvested = openWithPrices.reduce((s, t) => s + t.entry_price * t.quantity, 0)
      const currentValue = openWithPrices.reduce(
        (s, t) => s + (t.currentPrice || t.entry_price) * t.quantity,
        0
      )
      const stats = {
        totalPnl: realizedAll + totalUnrealized,
        unrealizedPnl: totalUnrealized,
        realizedPnl: realizedWindow,
        todayPnl,
        winRate,
        openCount: openWithPrices.length,
        closedCount: recent.length,
        totalInvested,
        currentValue,
      }
      setPerfStats(stats)

      const watchWithPrices = (d.watchlist || [])
        .filter((w) => w.category !== 'portfolio')
        .map((w) => {
          const p = priceMap[w.symbol]
          return {
            ...w,
            currentPrice: p ? parseFloat(p.price) || null : null,
            change: p?.change ?? null,
          }
        })
      setWatchlist(watchWithPrices)
      if (onDataReady) onDataReady({ openPositions: openWithPrices, perfStats: stats })
    },
    [onDataReady, statMonths]
  )

  // Hydrate from parent-supplied initData (avoids a second /init fetch).
  // applyData in deps → the stats recompute locally when the window changes (no refetch).
  useEffect(() => {
    if (initData) {
      applyData(initData)
      setLoading(false)
    }
  }, [initData, applyData])

  useChatRefresh(['trades', 'watchlist'], onRefresh)

  // ── Load symbol list once for autocomplete ─────────────────────────────────
  useEffect(() => {
    getMarketSymbols()
      .then((res) => {
        symbolListRef.current = res.data?.stocks || []
        setSymbolsReady(true)
      })
      .catch(() => setSymbolsReady(true))
  }, [])

  // Focus search input when add panel opens
  useEffect(() => {
    if (watchAddState === 'search') setTimeout(() => watchInputRef.current?.focus(), 50)
  }, [watchAddState])

  // ── Classify: auto-derive active/pre from signals ───────────────────────────
  // Stable date ref — computed once per mount, re-computed only if date string changes
  const watchTodayStr = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toDateString()
  }, [])
  const watchToday = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [watchTodayStr]) // eslint-disable-line react-hooks/exhaustive-deps

  const classifiedWatch = useMemo(() => {
    return watchlist.map((w) => {
      const ltp = w.currentPrice
      let priceSignal = 'neutral'
      if (w.price_alert && ltp) {
        const pct = Math.abs((ltp - parseFloat(w.price_alert)) / ltp) * 100
        priceSignal = pct <= 15 ? 'active' : 'pre'
      }
      let dateSignal = 'neutral',
        wStatus = null
      if (w.alert_date) {
        const days = Math.ceil((new Date(w.alert_date + 'T00:00:00') - watchToday) / 86400000)
        if (days >= 0 && days <= 14) {
          dateSignal = 'active'
        } else if (days > 14) {
          dateSignal = 'pre'
        } else if (days >= -10) {
          dateSignal = 'active'
          wStatus = 'grace'
        } else {
          dateSignal = 'expired'
          wStatus = 'expired'
        }
      }
      if (dateSignal === 'expired') return { ...w, category: 'pre', wStatus: 'expired' }
      if (priceSignal === 'active' || dateSignal === 'active')
        return { ...w, category: 'active', wStatus }
      return { ...w, category: 'pre', wStatus }
    })
  }, [watchlist, watchToday])

  const activeWatchItems = classifiedWatch.filter((w) => w.category === 'active')
  const preWatchItems = classifiedWatch.filter((w) => w.category === 'pre')
  const filteredWatch = watchlistTab === 'active' ? activeWatchItems : preWatchItems

  // ── Highlight a watchlist / position row when its alert is clicked ──────────
  // Switch to whichever tab actually contains the symbol, scroll it into view,
  // and flash the glow. Matches by symbol (case-insensitive).
  useHighlightListener('watchlist', (key) => {
    const sym = String(key).toUpperCase()
    let tab = null
    if (activeWatchItems.some((w) => w.symbol?.toUpperCase() === sym)) tab = 'active'
    else if (preWatchItems.some((w) => w.symbol?.toUpperCase() === sym)) tab = 'pre'
    else if (openPositions.some((t) => t.symbol?.toUpperCase() === sym)) tab = 'positions'
    if (!tab) return
    setWatchlistTab(tab)
    setWatchAddState(null)
    setHighlightSym(sym)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        watchRowRefs.current[sym]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightSym(null), 2100)
  })

  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  // ── Autocomplete suggestions ────────────────────────────────────────────────
  // WL-03 fix: depend on symbolsReady so memo re-runs after symbols load
  const watchSuggestions = useMemo(() => {
    const q = watchQuery.trim().toUpperCase()
    if (!q || !symbolsReady) return []
    return symbolListRef.current
      .filter((s) => s.symbol.startsWith(q) || s.company_name?.toUpperCase().includes(q))
      .slice(0, 8)
  }, [watchQuery, symbolsReady])

  // Returns YYYY-MM-DD string offset by N days from today
  const dateOffset = (days) => {
    const d = new Date(watchToday)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }
  // Returns next weekday (Mon–Fri) from today
  const nextWeekday = (day) => {
    // 1=Mon … 5=Fri
    const d = new Date(watchToday)
    const curr = d.getDay() // 0=Sun
    let diff = day - curr
    if (diff <= 0) diff += 7
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
  }

  const handleWatchKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setWatchCursor((c) => Math.min(c + 1, watchSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setWatchCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick =
        watchCursor >= 0
          ? watchSuggestions[watchCursor]
          : watchSuggestions.length === 1
            ? watchSuggestions[0]
            : null
      if (pick) {
        const p = priceMapRef.current[pick.symbol]
        setWatchAddState({ symbol: pick.symbol, refPrice: p ? parseFloat(p.price) || null : null })
        setWatchQuery('')
        setWatchCursor(-1)
      }
    } else if (e.key === 'Escape') {
      setWatchAddState(null)
      setWatchQuery('')
    }
  }

  // ── Add handler ─────────────────────────────────────────────────────────────
  const handleAddWatch = async (e) => {
    e.preventDefault()
    if (!watchAddState || typeof watchAddState !== 'object') return
    // Case-insensitive guard. Note this only covers non-portfolio items in local
    // state; a symbol held as a 'portfolio' entry is caught by the backend's unique
    // constraint (409), surfaced via the catch below.
    const dupSym = watchAddState.symbol.toUpperCase()
    if (watchlist.some((w) => w.symbol?.toUpperCase() === dupSym)) {
      setWatchActionErr(`${watchAddState.symbol} is already in your watchlist.`)
      return
    }
    setWatchAdding(true)
    setWatchActionErr(null)
    setWatchQuery('')
    try {
      await addToWatchlist({
        symbol: watchAddState.symbol,
        price_alert: watchForm.price_alert ? parseFloat(watchForm.price_alert) : null,
        alert_date: watchForm.alert_date || null,
        watch_low: watchForm.watch_low ? parseFloat(watchForm.watch_low) : null,
        watch_high: watchForm.watch_high ? parseFloat(watchForm.watch_high) : null,
        notes: watchForm.notes || null,
        category: 'pre',
      })
      setWatchAddState(null)
      setWatchForm({ price_alert: '', alert_date: '', watch_low: '', watch_high: '', notes: '' })
      if (onRefresh) await onRefresh()
    } catch (err) {
      setWatchActionErr(err.response?.data?.error || 'Failed to add.')
    } finally {
      setWatchAdding(false)
    }
  }

  // ── Edit handlers ───────────────────────────────────────────────────────────
  const openWatchEdit = (item) => {
    setWatchActionErr(null) // WL-06 fix: clear stale add-form error before opening edit
    setWatchEditItem(item)
    setWatchEditForm({
      watch_low: item.watch_low != null ? String(item.watch_low) : '',
      watch_high: item.watch_high != null ? String(item.watch_high) : '',
      price_alert: item.price_alert != null ? String(item.price_alert) : '',
      alert_date: item.alert_date ? item.alert_date.slice(0, 10) : '',
      notes: item.notes || '',
    })
  }

  const handleSaveWatch = async (e) => {
    e.preventDefault()
    if (!watchEditItem || !watchEditForm) return
    setWatchSaving(true)
    setWatchActionErr(null)
    try {
      await updateWatchlist(watchEditItem.id, {
        watch_low: watchEditForm.watch_low !== '' ? parseFloat(watchEditForm.watch_low) : null,
        watch_high: watchEditForm.watch_high !== '' ? parseFloat(watchEditForm.watch_high) : null,
        price_alert:
          watchEditForm.price_alert !== '' ? parseFloat(watchEditForm.price_alert) : null,
        alert_date: watchEditForm.alert_date || null,
        notes: watchEditForm.notes || null,
        category: 'pre',
      })
      setWatchEditItem(null)
      setWatchEditForm(null)
      if (onRefresh) await onRefresh()
    } catch (err) {
      setWatchActionErr(err.response?.data?.error || 'Failed to save.')
    } finally {
      setWatchSaving(false)
    }
  }

  // ── Remove handler ──────────────────────────────────────────────────────────
  const handleRemoveWatch = async (id) => {
    const snapshot = watchlist
    setWatchActionErr(null)
    setWatchlist((prev) => prev.filter((w) => w.id !== id))
    try {
      await removeFromWatchlist(id)
    } catch {
      // Restore the full prior list so the item returns to its original position,
      // and tell the user it failed instead of silently reappearing.
      setWatchlist(snapshot)
      setWatchActionErr('Failed to remove — please try again.')
    }
  }

  // alert messages per item
  function watchAlertMsgs(item) {
    const msgs = []
    const ltp = item.currentPrice
    if (!ltp) return msgs
    if (item.price_alert) {
      const alert = parseFloat(item.price_alert)
      const diff = alert - ltp
      const pct = Math.abs((diff / ltp) * 100).toFixed(1)
      if (Math.abs(diff) < ltp * 0.02)
        msgs.push({
          text: 'Near alert level',
          color: 'text-orange-500',
          bg: 'bg-orange-50 dark:bg-orange-900/30',
        })
      else if (diff > 0)
        msgs.push({
          text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to alert`,
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/30',
        })
      else
        msgs.push({
          text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to alert`,
          color: 'text-red-500',
          bg: 'bg-red-50 dark:bg-red-900/30',
        })
    }
    if (item.watch_low && ltp) {
      const wl = parseFloat(item.watch_low)
      const diff = ltp - wl
      const pct = Math.abs((diff / ltp) * 100).toFixed(1)
      if (diff > 0)
        msgs.push({
          text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to watch low`,
          color: 'text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/30',
        })
      else
        msgs.push({
          text: 'Below watch low',
          color: 'text-red-500',
          bg: 'bg-red-50 dark:bg-red-900/30',
        })
    }
    if (item.watch_high && ltp) {
      const wh = parseFloat(item.watch_high)
      const diff = wh - ltp
      const pct = Math.abs((diff / ltp) * 100).toFixed(1)
      if (diff > 0)
        msgs.push({
          text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to watch high`,
          color: 'text-green-500',
          bg: 'bg-green-50 dark:bg-green-900/30',
        })
      else
        msgs.push({
          text: 'Above watch high',
          color: 'text-green-500',
          bg: 'bg-green-50 dark:bg-green-900/30',
        })
    }
    if (item.alert_date) {
      const days = Math.ceil((new Date(item.alert_date + 'T00:00:00') - watchToday) / 86400000)
      if (days < -10)
        msgs.push({
          text: `Alert expired ${Math.abs(days)}d ago`,
          color: 'text-gray-400',
          bg: 'bg-gray-100 dark:bg-gray-800',
        })
      else if (days < 0)
        msgs.push({
          text: `${Math.abs(days)}d overdue — grace`,
          color: 'text-amber-500',
          bg: 'bg-amber-50 dark:bg-amber-900/30',
        })
      else if (days === 0)
        msgs.push({
          text: 'Alert date is today',
          color: 'text-orange-500',
          bg: 'bg-orange-50 dark:bg-orange-900/30',
        })
      else if (days <= 3)
        msgs.push({
          text: `${days}d left`,
          color: 'text-orange-500',
          bg: 'bg-orange-50 dark:bg-orange-900/30',
        })
      else if (days <= 14)
        msgs.push({
          text: `${days}d left`,
          color: 'text-blue-500',
          bg: 'bg-blue-50 dark:bg-blue-900/30',
        })
    }
    return msgs
  }

  if (loading)
    return (
      <div className="flex flex-col gap-3 sm:gap-4 animate-pulse">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 shadow-sm px-3 py-2.5"
            >
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-2" />
              <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
        {/* Chart placeholder */}
        <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm h-[200px] sm:h-[220px]" />
        {/* Watchlist placeholder */}
        <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm">
          <div className="h-10 border-b border-gray-100 dark:border-gray-800 px-3 flex items-center gap-2">
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-16" />
            <div className="flex-1" />
            <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-lg w-40" />
          </div>
          <div className="flex gap-2 p-2 overflow-x-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="shrink-0 basis-[calc((100%-1rem)/3)] sm:basis-[calc((100%-1.5rem)/4)] bg-gray-50 dark:bg-gray-800/50 rounded-xl px-1.5 py-1.5 space-y-1.5"
              >
                <div className="flex items-center gap-1">
                  <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0" />
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )

  if (error)
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <button onClick={onRefresh} className="mt-3 text-xs text-red-500 hover:underline">
          Retry
        </button>
      </div>
    )

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ── Stats Bar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Stats settings — the window preference lives behind a gear button, not on
            the page surface (owner call; the future Settings page absorbs this). #t30 HOME-9 */}
        <div className="flex items-center justify-end px-1 relative">
          <button
            onClick={() => setShowStatsSettings((s) => !s)}
            title="Stats settings"
            aria-label="Stats settings"
            className={`w-5 h-5 flex items-center justify-center rounded-md transition-colors ${
              showStatsSettings
                ? 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showStatsSettings && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowStatsSettings(false)} />
              <div className="absolute right-0 top-6 z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 w-56">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                  Stats window
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                    {[1, 3, 6].map((m) => (
                      <button
                        key={m}
                        onClick={() => setStatMonths(m)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                          statMonths === m
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {m}M
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={statMonths}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      if (v >= 1 && v <= 24) setStatMonths(v)
                    }}
                    title="Custom window (months)"
                    className="w-11 px-1 py-0.5 rounded-md text-[10px] font-semibold text-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent focus:border-blue-400 outline-none"
                  />
                  <span className="text-[9px] text-gray-400">mo</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 leading-snug">
                  Applies to Realized P/L and Win Rate cards.
                </p>
              </div>
            </>
          )}
        </div>
        {!perfStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 shadow-sm px-2 sm:px-3 py-1.5 sm:py-2.5"
              >
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-1.5 sm:mb-2" />
                <div className="h-3.5 sm:h-5 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            <StatCard
              label="Total P/L Today"
              value={`${perfStats.todayPnl >= 0 ? '+' : ''}Rs. ${Math.abs(Math.round(perfStats.todayPnl)).toLocaleString()}`}
              color={
                perfStats.todayPnl > 0
                  ? 'text-green-500'
                  : perfStats.todayPnl < 0
                    ? 'text-red-500'
                    : 'text-gray-500 dark:text-gray-400'
              }
              sub={
                perfStats.openCount > 0
                  ? `Live on ${perfStats.openCount} open position${perfStats.openCount !== 1 ? 's' : ''}`
                  : perfStats.todayPnl !== 0
                    ? 'Closed today'
                    : 'No activity today'
              }
            />
            <StatCard
              label={`Realized P/L (${statMonths}M)`}
              value={`${perfStats.realizedPnl >= 0 ? '+' : ''}Rs. ${Math.abs(Math.round(perfStats.realizedPnl)).toLocaleString()}`}
              color={
                perfStats.realizedPnl > 0
                  ? 'text-green-500'
                  : perfStats.realizedPnl < 0
                    ? 'text-red-500'
                    : 'text-gray-500 dark:text-gray-400'
              }
              sub={
                perfStats.closedCount > 0
                  ? `${perfStats.closedCount} trade${perfStats.closedCount !== 1 ? 's' : ''} last ${statMonths}mo`
                  : `No trades last ${statMonths}mo`
              }
            />
            <StatCard
              label={`Win Rate (${statMonths}M)`}
              value={`${perfStats.winRate}%`}
              color={
                perfStats.winRate >= 50
                  ? 'text-green-500'
                  : perfStats.winRate > 0
                    ? 'text-yellow-500'
                    : 'text-gray-500 dark:text-gray-400'
              }
              sub={
                perfStats.closedCount > 0
                  ? `${perfStats.closedCount} trade${perfStats.closedCount !== 1 ? 's' : ''} last ${statMonths}mo`
                  : `No trades last ${statMonths}mo`
              }
            />
            <StatCard
              label={tr('stats.openPositions')}
              value={perfStats.openCount}
              color={perfStats.openCount > 0 ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}
              sub={
                perfStats.totalInvested > 0
                  ? `Rs. ${Math.round(perfStats.totalInvested).toLocaleString()} invested`
                  : undefined
              }
            />
          </div>
        )}

        {/* Drawdown warning — open positions underwater. Based on UNREALIZED P/L over
            invested capital (both open-position quantities) so it stays a coherent
            ratio; lifetime totalPnl would mix in realized gains over the wrong base. */}
        {perfStats && perfStats.unrealizedPnl < 0 && perfStats.totalInvested > 0 && (
          <div className="hp-drawdown flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
            <p className="text-[11px] text-red-600 dark:text-red-300 font-medium">
              {/* Rule 6 — guard denominator */}
              Drawdown: {((perfStats.unrealizedPnl / perfStats.totalInvested) * 100).toFixed(2)}%
              {perfStats.totalInvested + perfStats.unrealizedPnl > 0 &&
                ` — Need +${Math.abs((perfStats.unrealizedPnl / (perfStats.totalInvested + perfStats.unrealizedPnl)) * 100).toFixed(2)}% to recover`}
            </p>
          </div>
        )}
      </div>
      {/* end stats section */}

      {/* ── MOBILE only — Routine ↔ Score toggle, sits between the stat cards and
          the chart (desktop shows these in the side columns instead). No header
          label: TaskBoard / DisciplineScore render their own title. ───────────── */}
      <div className="lg:hidden flex flex-col gap-2">
        <div className="flex items-center justify-end px-1">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setMobileTopTab('tasks')}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                mobileTopTab === 'tasks'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Routine
            </button>
            <button
              onClick={() => setMobileTopTab('discipline')}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                mobileTopTab === 'discipline'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Score
            </button>
          </div>
        </div>
        {initData ? (
          mobileTopTab === 'tasks' ? (
            <TaskBoard initData={initData.tasks} mindsetContent={initData.mindset?.content} />
          ) : (
            <DisciplineScore initData={initData.discipline} />
          )
        ) : (
          <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[180px]" />
        )}
      </div>

      {/* ── NEPSE Chart ──────────────────────────────────────────────────────── */}
      <div>
        <NEPSEChart fixed={true} />
      </div>

      {/* ── Watchlist ────────────────────────────────────────────────────────── */}
      {/* No overflow-hidden here: it has no border-radius and was clipping the inner
          rounded-2xl card's corners square. The card clips its own content already. */}
      <div className="flex flex-col">
        {/* ── Watchlist edit modal — rendered via portal (WL-04 fix) ── */}
        <WatchMenuPortal />
        {watchEditItem &&
          watchEditForm &&
          (() => {
            const ltp =
              watchEditItem.currentPrice != null ? parseFloat(watchEditItem.currentPrice) : null
            const pctChips = ltp
              ? [
                  { label: '−10%', val: (ltp * 0.9).toFixed(2) },
                  { label: '−5%', val: (ltp * 0.95).toFixed(2) },
                  { label: 'LTP', val: ltp.toFixed(2) },
                  { label: '+5%', val: (ltp * 1.05).toFixed(2) },
                  { label: '+10%', val: (ltp * 1.1).toFixed(2) },
                ]
              : null
            const dateChips = [
              { label: 'Mon', val: nextWeekday(1) },
              { label: '+1w', val: dateOffset(7) },
              { label: '+2w', val: dateOffset(14) },
              { label: '+1m', val: dateOffset(30) },
            ]
            return (
              <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  onClick={() => setWatchEditItem(null)}
                />
                <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full sm:max-w-xs z-10 overflow-hidden max-h-[90dvh] overflow-y-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="text-[13px] font-bold text-gray-900 dark:text-white"
                          translate="no"
                        >
                          {watchEditItem.symbol}
                        </p>
                        {ltp != null && (
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            Rs.{ltp.toLocaleString()}
                          </span>
                        )}
                        {watchEditItem.change != null && (
                          <span
                            className={`text-[9px] font-semibold tabular-nums ${watchEditItem.change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                          >
                            {watchEditItem.change >= 0 ? '+' : ''}
                            {watchEditItem.change}%
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mt-0.5">
                        Edit alert levels
                      </p>
                    </div>
                    <button
                      onClick={() => setWatchEditItem(null)}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-base leading-none shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={handleSaveWatch} className="px-4 py-3 space-y-2.5">
                    {/* ── Price Alert ── */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                        Price Alert
                      </p>
                      {pctChips && (
                        <div className="flex gap-1 mb-1.5 flex-wrap">
                          {pctChips.map((c) => (
                            <button
                              key={c.label}
                              type="button"
                              onClick={() =>
                                setWatchEditForm((f) => ({ ...f, price_alert: c.val }))
                              }
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors border ${
                                watchEditForm.price_alert === c.val
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : c.label.startsWith('−')
                                    ? 'border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                                    : c.label.startsWith('+')
                                      ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40'
                                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={watchEditForm.price_alert}
                        autoComplete="off"
                        onChange={(e) =>
                          setWatchEditForm((f) => ({ ...f, price_alert: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40 transition-all"
                      />
                      {watchEditForm.price_alert &&
                        ltp != null &&
                        (() => {
                          const pct = ((parseFloat(watchEditForm.price_alert) - ltp) / ltp) * 100
                          return (
                            <p
                              className={`text-[9px] mt-0.5 tabular-nums ${pct >= 0 ? 'text-green-500' : 'text-red-400'}`}
                            >
                              {pct >= 0 ? '+' : ''}
                              {pct.toFixed(1)}% from LTP
                            </p>
                          )
                        })()}
                    </div>

                    {/* ── Target Date ── */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                        Target Date
                      </p>
                      <div className="flex gap-1 mb-1.5">
                        {dateChips.map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => setWatchEditForm((f) => ({ ...f, alert_date: c.val }))}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors border ${
                              watchEditForm.alert_date === c.val
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="date"
                        value={watchEditForm.alert_date}
                        onChange={(e) =>
                          setWatchEditForm((f) => ({ ...f, alert_date: e.target.value }))
                        }
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40 transition-all"
                      />
                      {watchEditForm.alert_date && (
                        <p className="text-[9px] mt-0.5 text-blue-500">
                          {Math.ceil(
                            (new Date(watchEditForm.alert_date + 'T00:00:00') - watchToday) /
                              86400000
                          )}
                          d from today
                        </p>
                      )}
                    </div>

                    {/* ── Watch Range ── */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                          Watch Low
                        </p>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={watchEditForm.watch_low}
                          autoComplete="off"
                          onChange={(e) =>
                            setWatchEditForm((f) => ({ ...f, watch_low: e.target.value }))
                          }
                          placeholder="0.00"
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-red-300 dark:focus:border-red-500/50 focus:ring-1 focus:ring-red-200/50 transition-all"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                          Watch High
                        </p>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={watchEditForm.watch_high}
                          autoComplete="off"
                          onChange={(e) =>
                            setWatchEditForm((f) => ({ ...f, watch_high: e.target.value }))
                          }
                          placeholder="0.00"
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-green-300 dark:focus:border-green-500/50 focus:ring-1 focus:ring-green-200/50 transition-all"
                        />
                      </div>
                    </div>

                    {/* ── Notes ── */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                        Notes
                      </p>
                      <input
                        type="text"
                        value={watchEditForm.notes}
                        maxLength={300}
                        autoComplete="off"
                        onChange={(e) => setWatchEditForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Setup reason, catalyst…"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40 transition-all"
                      />
                    </div>

                    {watchActionErr && (
                      <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/50 px-2.5 py-1.5 rounded-lg">
                        {watchActionErr}
                      </p>
                    )}
                    <div className="flex gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setWatchEditItem(null)}
                        className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={watchSaving}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-[11px] font-bold transition-colors"
                      >
                        {watchSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )
          })()}

        {/* ── Watchlist ─────────────────────────────────────────────────────────── */}
        <div className="hp-card bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">
              Watchlist
            </p>
            <div className="flex-1 shrink-0 min-w-[8px]" />
            {/* Tab pill group */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0">
              {[
                {
                  id: 'active',
                  label: `Active${activeWatchItems.length ? ` ${activeWatchItems.length}` : ''}`,
                },
                {
                  id: 'pre',
                  label: `Pre-Watch${preWatchItems.length ? ` ${preWatchItems.length}` : ''}`,
                },
                {
                  id: 'positions',
                  label: `Pos.${openPositions.length ? ` ${openPositions.length}` : ''}`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setWatchlistTab(tab.id)
                    setWatchAddState(null)
                  }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                    watchlistTab === tab.id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Add button — only on watchlist tabs */}
            {watchAddState === null && watchlistTab !== 'positions' && (
              <button
                onClick={() => setWatchAddState('search')}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors shrink-0"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add
              </button>
            )}
          </div>

          {/* Symbol search panel */}
          {watchAddState === 'search' && (
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 h-7">
                  <svg
                    className="w-3 h-3 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                    />
                  </svg>
                  <input
                    ref={watchInputRef}
                    type="text"
                    value={watchQuery}
                    onChange={(e) => {
                      setWatchQuery(e.target.value.toUpperCase())
                      setWatchCursor(-1)
                    }}
                    onKeyDown={handleWatchKey}
                    placeholder="Type symbol…"
                    className="flex-1 bg-transparent text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
                    translate="no"
                  />
                  {watchQuery && (
                    <button
                      onClick={() => setWatchQuery('')}
                      className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
                {watchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden">
                    {watchSuggestions.map((s, i) => (
                      <button
                        key={s.symbol}
                        onClick={() => {
                          const p = priceMapRef.current[s.symbol]
                          setWatchAddState({
                            symbol: s.symbol,
                            refPrice: p ? parseFloat(p.price) || null : null,
                          })
                          setWatchQuery('')
                          setWatchCursor(-1)
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === watchCursor ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} ${i < watchSuggestions.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className="text-[11px] font-bold text-gray-900 dark:text-white"
                            translate="no"
                          >
                            {s.symbol}
                          </span>
                          {s.company_name && (
                            <span className="text-[10px] text-gray-400 ml-1.5 truncate">
                              {s.company_name}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setWatchAddState(null)
                  setWatchQuery('')
                  setWatchForm({
                    price_alert: '',
                    alert_date: '',
                    watch_low: '',
                    watch_high: '',
                    notes: '',
                  })
                }}
                className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Add form — after symbol selected */}
          {watchAddState &&
            typeof watchAddState === 'object' &&
            (() => {
              const ltp = watchAddState.refPrice
              const pctChips = ltp
                ? [
                    { label: '−10%', val: (ltp * 0.9).toFixed(2) },
                    { label: '−5%', val: (ltp * 0.95).toFixed(2) },
                    { label: 'LTP', val: ltp.toFixed(2) },
                    { label: '+5%', val: (ltp * 1.05).toFixed(2) },
                    { label: '+10%', val: (ltp * 1.1).toFixed(2) },
                  ]
                : null
              const dateChips = [
                { label: 'Mon', val: nextWeekday(1) },
                { label: '+1w', val: dateOffset(7) },
                { label: '+2w', val: dateOffset(14) },
                { label: '+1m', val: dateOffset(30) },
              ]
              const noteTags = ['Breakout', 'Dip buy', 'Earnings', 'Long term', 'Sector play']
              return (
                <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                  {/* Symbol + LTP strip */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <p
                        className="text-[12px] font-bold text-gray-900 dark:text-white"
                        translate="no"
                      >
                        {watchAddState.symbol}
                      </p>
                      {ltp != null ? (
                        <span className="text-[10px] font-semibold tabular-nums text-gray-500 dark:text-gray-400 bg-gray-200/60 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          LTP Rs.{ltp.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">No live price</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setWatchAddState(null)
                        setWatchForm({
                          price_alert: '',
                          alert_date: '',
                          watch_low: '',
                          watch_high: '',
                          notes: '',
                        })
                      }}
                      className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 leading-none px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleAddWatch} className="px-3 py-2.5 space-y-2.5">
                    {/* ── Price Alert ── */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                        Price Alert
                      </p>
                      {pctChips && (
                        <div className="flex gap-1 mb-1.5 flex-wrap">
                          {pctChips.map((c) => (
                            <button
                              key={c.label}
                              type="button"
                              onClick={() => setWatchForm((f) => ({ ...f, price_alert: c.val }))}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors border ${
                                watchForm.price_alert === c.val
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : c.label.startsWith('−')
                                    ? 'border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                                    : c.label.startsWith('+')
                                      ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40'
                                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={watchForm.price_alert}
                        onChange={(e) =>
                          setWatchForm((f) => ({ ...f, price_alert: e.target.value }))
                        }
                        placeholder="0.00"
                        autoComplete="off"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40 transition-all"
                      />
                      {watchForm.price_alert &&
                        ltp != null &&
                        (() => {
                          const pct = ((parseFloat(watchForm.price_alert) - ltp) / ltp) * 100
                          return (
                            <p
                              className={`text-[9px] mt-0.5 tabular-nums ${pct >= 0 ? 'text-green-500' : 'text-red-400'}`}
                            >
                              {pct >= 0 ? '+' : ''}
                              {pct.toFixed(1)}% from LTP
                            </p>
                          )
                        })()}
                    </div>

                    {/* ── Target Date ── */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                        Target Date
                      </p>
                      <div className="flex gap-1 mb-1.5">
                        {dateChips.map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => setWatchForm((f) => ({ ...f, alert_date: c.val }))}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors border ${
                              watchForm.alert_date === c.val
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="date"
                        value={watchForm.alert_date}
                        onChange={(e) =>
                          setWatchForm((f) => ({ ...f, alert_date: e.target.value }))
                        }
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40 transition-all"
                      />
                      {watchForm.alert_date && (
                        <p className="text-[9px] mt-0.5 text-blue-500">
                          {Math.ceil(
                            (new Date(watchForm.alert_date + 'T00:00:00') - watchToday) / 86400000
                          )}
                          d from today
                        </p>
                      )}
                    </div>

                    {/* ── Watch Range ── */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                          Watch Low
                        </p>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={watchForm.watch_low}
                          onChange={(e) =>
                            setWatchForm((f) => ({ ...f, watch_low: e.target.value }))
                          }
                          placeholder="0.00"
                          autoComplete="off"
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-red-300 dark:focus:border-red-500/50 focus:ring-1 focus:ring-red-200/50 transition-all"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                          Watch High
                        </p>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={watchForm.watch_high}
                          onChange={(e) =>
                            setWatchForm((f) => ({ ...f, watch_high: e.target.value }))
                          }
                          placeholder="0.00"
                          autoComplete="off"
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-green-300 dark:focus:border-green-500/50 focus:ring-1 focus:ring-green-200/50 transition-all"
                        />
                      </div>
                    </div>

                    {/* ── Notes + quick tags ── */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                        Notes
                      </p>
                      <div className="flex gap-1 flex-wrap mb-1.5">
                        {noteTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setWatchForm((f) => {
                                // Append the tag (comma-separated) instead of no-op'ing once
                                // notes had any text. Skip if the tag is already present.
                                const cur = f.notes.trim()
                                if (cur.split(/,\s*/).includes(tag)) return f
                                return { ...f, notes: cur ? `${cur}, ${tag}` : tag }
                              })
                            }
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={watchForm.notes}
                        maxLength={300}
                        autoComplete="off"
                        onChange={(e) => setWatchForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Setup reason, catalyst…"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40 transition-all"
                      />
                    </div>

                    {watchActionErr && (
                      <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/50 px-2.5 py-1.5 rounded-lg">
                        {watchActionErr}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={watchAdding}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-[11px] font-bold transition-colors"
                    >
                      {watchAdding ? 'Adding…' : 'Add to Watchlist'}
                    </button>
                  </form>
                </div>
              )
            })()}

          {/* List */}
          {watchlistTab === 'positions' ? (
            <div className="overflow-y-auto no-scrollbar max-h-[280px]">
              {openPositions.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-400 text-xs">No open positions</p>
                  <button
                    onClick={() => navigate('/logs')}
                    className="mt-2 text-blue-500 text-xs hover:underline"
                  >
                    + Add a trade
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {openPositions.map((t) => {
                    const slDistPct =
                      t.sl != null && t.currentPrice
                        ? t.position === 'SHORT'
                          ? (((t.sl - t.currentPrice) / t.currentPrice) * 100).toFixed(1)
                          : (((t.currentPrice - t.sl) / t.currentPrice) * 100).toFixed(1)
                        : null
                    const tpDistPct =
                      t.tp != null && t.currentPrice
                        ? t.position === 'SHORT'
                          ? (((t.currentPrice - t.tp) / t.currentPrice) * 100).toFixed(1)
                          : (((t.tp - t.currentPrice) / t.currentPrice) * 100).toFixed(1)
                        : null
                    const isHl = highlightSym === t.symbol?.toUpperCase()
                    return (
                      <div
                        key={t.id}
                        ref={(el) => {
                          const k = t.symbol?.toUpperCase()
                          if (!k) return
                          if (el) watchRowRefs.current[k] = el
                          else delete watchRowRefs.current[k]
                        }}
                        className={`px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isHl ? 'hp-highlight' : ''}`}
                        translate="no"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StockAvatar symbol={t.symbol} size="w-7 h-7" textSize="text-[10px]" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                  {t.symbol}
                                </p>
                                <span
                                  className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                                    t.position === 'LONG'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                  }`}
                                >
                                  {t.position}
                                </span>
                                {t.status === 'PARTIAL' && (
                                  <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300 font-medium">
                                    P
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400">
                                {t.quantity} @ Rs.{(t.entry_price || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {t.unrealizedPnl != null ? (
                              <p
                                className={`text-xs font-semibold ${t.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
                              >
                                {t.unrealizedPnl >= 0 ? '+' : ''}Rs.
                                {Math.abs(t.unrealizedPnl).toLocaleString()}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400">—</p>
                            )}
                            {t.pnlPct != null && (
                              <p
                                className={`text-[10px] ${parseFloat(t.pnlPct) >= 0 ? 'text-green-400' : 'text-red-400'}`}
                              >
                                {parseFloat(t.pnlPct) >= 0 ? '+' : ''}
                                {t.pnlPct}%
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 ml-9 flex-wrap">
                          {t.sl != null ? (
                            <span className="text-[10px] bg-red-50 dark:bg-red-900/40 text-red-500 px-1.5 py-0.5 rounded">
                              SL{' '}
                              {slDistPct !== null
                                ? `${parseFloat(slDistPct) > 0 ? '+' : ''}${slDistPct}%`
                                : `Rs.${t.sl.toLocaleString()}`}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-orange-50 dark:bg-orange-900/40 text-orange-500 px-1.5 py-0.5 rounded">
                              ⚠ No SL
                            </span>
                          )}
                          {t.tp != null && (
                            <span className="text-[10px] bg-green-50 dark:bg-green-900/40 text-green-500 px-1.5 py-0.5 rounded">
                              TP{' '}
                              {tpDistPct !== null
                                ? `${parseFloat(tpDistPct) > 0 ? '+' : ''}${tpDistPct}%`
                                : `Rs.${t.tp.toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <button
                    onClick={() => navigate('/portfolio')}
                    className="w-full px-4 py-2 text-[11px] font-semibold text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center"
                  >
                    View all in Portfolio →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar snap-x snap-mandatory">
              {filteredWatch.length === 0 ? (
                <div className="w-full py-8 text-center">
                  <p className="text-[11px] text-gray-400">
                    No stocks in {watchlistTab === 'active' ? 'Active' : 'Pre-Watch'}
                  </p>
                  <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
                    {watchlistTab === 'active'
                      ? 'Items auto-promote when alert is within 15% or 2 weeks'
                      : 'Click + to add a symbol'}
                  </p>
                </div>
              ) : (
                filteredWatch.map((item) => {
                  const isExpired = item.wStatus === 'expired'
                  const inGrace = item.wStatus === 'grace'
                  const priceFill =
                    item.price_alert && item.currentPrice
                      ? Math.max(
                          0,
                          Math.min(
                            100,
                            100 -
                              (Math.abs(
                                (item.currentPrice - parseFloat(item.price_alert)) /
                                  item.currentPrice
                              ) *
                                100) /
                                15
                          )
                        )
                      : null
                  const meta = item.price_alert
                    ? `@ Rs.${parseFloat(item.price_alert).toLocaleString()}`
                    : item.alert_date
                      ? `By ${new Date(item.alert_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : item.notes || null
                  const isUp = item.change != null && item.change >= 0

                  const isHl = highlightSym === item.symbol?.toUpperCase()
                  return (
                    <div
                      key={item.id}
                      ref={(el) => {
                        const k = item.symbol?.toUpperCase()
                        if (!k) return
                        if (el) watchRowRefs.current[k] = el
                        else delete watchRowRefs.current[k]
                      }}
                      onContextMenu={watchCtx([
                        { label: 'Edit', icon: '✏️', action: () => openWatchEdit(item) },
                        { separator: true },
                        {
                          label: 'Delete',
                          icon: '🗑️',
                          danger: true,
                          action: () => handleRemoveWatch(item.id),
                        },
                      ])}
                      className={`hp-watch-item relative flex flex-col gap-1 px-1.5 py-1.5 rounded-xl cursor-default snap-start
                    shrink-0 basis-[calc((100%-1rem)/3)] sm:basis-[calc((100%-1.5rem)/4)]
                    bg-white/70 dark:bg-gray-800/50 border border-white/80 dark:border-white/5
                    backdrop-blur-sm shadow-sm border-l-[3px] ${getStockBorder(item.symbol)}
                    ${isExpired ? 'opacity-50' : ''} ${isHl ? 'hp-highlight' : ''}`}
                      translate="no"
                    >
                      {/* Avatar + symbol */}
                      <div className="flex items-center gap-1">
                        <StockAvatar symbol={item.symbol} size="w-5 h-5" textSize="text-[8px]" />
                        <span
                          className={`text-[10px] font-bold leading-none truncate ${isExpired ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}
                        >
                          {item.symbol}
                        </span>
                      </div>

                      {/* Price + change */}
                      <div className="flex items-baseline justify-between gap-0.5">
                        <p className="text-[11px] font-bold tabular-nums text-gray-900 dark:text-white leading-none truncate">
                          {item.currentPrice != null
                            ? `Rs.${parseFloat(item.currentPrice).toLocaleString()}`
                            : '—'}
                        </p>
                        {item.change != null && (
                          <span
                            className={`text-[9px] font-semibold tabular-nums shrink-0 ${isUp ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                          >
                            {isUp ? '+' : ''}
                            {item.change}%
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      {meta && (
                        <p className="text-[8px] text-gray-400 dark:text-gray-500 truncate leading-none">
                          {meta}
                        </p>
                      )}

                      {/* Status badges */}
                      {(isExpired || inGrace) && (
                        <div className="flex gap-1">
                          {isExpired && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 font-semibold uppercase tracking-wide">
                              Exp
                            </span>
                          )}
                          {inGrace && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">
                              Grace
                            </span>
                          )}
                        </div>
                      )}

                      {/* Progress bar */}
                      {watchlistTab === 'active' && priceFill != null && (
                        <div className="h-0.5 w-full bg-gray-100 dark:bg-gray-700/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getStockBar(item.symbol)} transition-all`}
                            style={{ width: `${priceFill}%` }}
                          />
                        </div>
                      )}

                      {/* Alert badges */}
                      {(() => {
                        const msgs = watchAlertMsgs(item)
                        if (!msgs.length) return null
                        return (
                          <div className="flex flex-wrap gap-0.5">
                            {msgs.map((m, i) => (
                              <span
                                key={i}
                                className={`text-[8px] font-medium px-1 py-0.5 rounded-full ${m.bg} ${m.color}`}
                              >
                                {m.text}
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
      {/* end watchlist section */}
    </div>
  )
}

// ── Logged-in layout ─────────────────────────────────────────────────────────
function LoggedInHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [initData, setInitData] = useState(null)
  const [mobileTopTab, setMobileTopTab] = useState('tasks') // 'tasks' | 'discipline'
  const [mobileBottomTab, setMobileBottomTab] = useState('goals') // 'goals' | 'alerts'

  // gCache-backed fetch — survives navigate-away-and-back within 60s TTL
  const fetchDashboard = useCallback(async (force = false) => {
    try {
      const res = await getDashboardInit(force)
      setInitData(res.data)
    } catch (err) {
      console.error(err)
    }
  }, [])

  const onRefresh = useCallback(() => fetchDashboard(true), [fetchDashboard])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      {/* Use flex-col so side columns can stretch to remaining height without hardcoding greeting bar px */}
      <div className="w-full px-3 sm:px-4 py-3 sm:py-4 pb-safe min-h-[100dvh] flex flex-col bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-slate-900">
        {/* Greeting bar — shrinks to its content, never stretches */}
        <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 animate-fade-up flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'Trader'} 👋
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{today}</p>
          </div>
          <MarketStatusChip />
        </div>

        {/* 3-Column Layout — flex-1 so it fills exactly the remaining height */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 sm:gap-4">
          {/* CENTER — always first on mobile */}
          <div className="col-span-12 lg:col-span-6 order-1 lg:order-2 min-h-0">
            <CenterDashboard
              navigate={navigate}
              initData={initData}
              onRefresh={onRefresh}
              mobileTopTab={mobileTopTab}
              setMobileTopTab={setMobileTopTab}
            />
          </div>

          {/* LEFT column — desktop only: stacked 35/65 rows, fills remaining height exactly */}
          <div
            className="hidden lg:grid col-span-3 order-1 gap-3 min-h-0"
            style={{ gridTemplateRows: '35fr 65fr' }}
          >
            {initData ? (
              <>
                <TaskBoard initData={initData.tasks} mindsetContent={initData.mindset?.content} />
                <MonthlyGoals initData={initData.goals} />
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[120px]" />
                <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[200px]" />
              </>
            )}
          </div>

          {/* RIGHT column — desktop only: stacked 35/65 rows, fills remaining height exactly */}
          <div
            className="hidden lg:grid col-span-3 order-3 gap-3 min-h-0"
            style={{ gridTemplateRows: '35fr 65fr' }}
          >
            {initData ? (
              <DisciplineScore initData={initData.discipline} />
            ) : (
              <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[120px]" />
            )}
            {initData ? (
              <AlertsWidget initData={initData} />
            ) : (
              <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[200px]" />
            )}
          </div>

          {/* MOBILE only — Goals ↔ Alerts toggle. Sits last (after the center
              column's stats → routine/score → chart → watchlist). The Routine ↔
              Score toggle now lives inside CenterDashboard, between stats and chart. */}
          <div className="col-span-12 lg:hidden order-2 flex flex-col gap-3">
            {/* Goals ↔ Alerts toggle.
                No header label — MonthlyGoals / AlertsWidget self-title. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-end px-1">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setMobileBottomTab('goals')}
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                      mobileBottomTab === 'goals'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Goals
                  </button>
                  <button
                    onClick={() => setMobileBottomTab('alerts')}
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                      mobileBottomTab === 'alerts'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Alerts
                  </button>
                </div>
              </div>
              {initData ? (
                mobileBottomTab === 'goals' ? (
                  <MonthlyGoals initData={initData.goals} />
                ) : (
                  <AlertsWidget initData={initData} />
                )
              ) : (
                <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[180px]" />
              )}
            </div>
          </div>
          {/* end mobile panels wrapper */}
        </div>
      </div>
    </>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const { user, loading } = useAuth()
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-slate-900 transition-colors">
      {/* Wait for /api/auth/me before choosing a view. `/` is public, so without
          this gate `user` is null on reload and the logged-OUT landing flashes
          for ~1s before flipping to LoggedInHome. Spinner matches PrivateRoute. */}
      {loading ? (
        <PageSkeleton />
      ) : user ? (
        <LoggedInHome />
      ) : (
        <LoggedOutHome />
      )}
    </div>
  )
}

export default HomePage
