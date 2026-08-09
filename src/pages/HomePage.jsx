// === HomePage.jsx — home page: logged-out landing (blurred preview + hero), logged-in dashboard (stats, watchlist, positions, alerts, NEPSE chart) ===
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useChatRefresh, dispatchHighlight } from '../utils/chatEvents'
import TaskBoard from '../components/dashboard/TaskBoard'
import DisciplineScore from '../components/dashboard/DisciplineScore'
import MonthlyGoals from '../components/dashboard/MonthlyGoals'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import NEPSEChart from '../components/NEPSEChart'
import { getDashboardInit } from '../utils/globalCache'
import { MarketStatusChip } from '../components/common/MarketStatusBadge'
import StockAvatar from '../components/common/StockAvatar'
import {
  IconWarning,
  IconAlertCircle,
  IconCheckCircle,
  IconBell,
  IconCalendar,
  IconBolt,
} from '../components/common/icons'
import WatchlistPanel from '../components/dashboard/watchlist/WatchlistPanel'
import { generateSwingCandles } from '../utils/candlestickData'
import {
  TIER_ACCENT,
  TierAccentOverlay,
  tierRingClass,
  TIER_TEXT,
  getDisplayTier,
} from '../components/common/TierMaterial'

const MOTIVATIONAL_QUOTES = [
  'The market is a device for transferring money from the impatient to the patient.',
  'Risk comes from not knowing what you are doing.',
  'In investing, what is comfortable is rarely profitable.',
  'Trade what you see, not what you think.',
  'Plan the trade, trade the plan.',
  'Discipline is the bridge between trading goals and trading reality.',
]

// ── Hero feature-grid icons (line style, not emoji — HOME-15 precedent) ───────
const heroIconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.8',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}
// Trade Journal — same mark as Login/SignupPage BrandPanel.
function HeroIconJournal() {
  return (
    <svg {...heroIconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
// Smart Watchlist — same mark as AuthFormShell's password-visibility eye.
function HeroIconEye() {
  return (
    <svg {...heroIconProps}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
// Portfolio Tracker
function HeroIconChart() {
  return (
    <svg {...heroIconProps}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
// Discipline Score — same mark as Login/SignupPage BrandPanel.
function HeroIconClock() {
  return (
    <svg {...heroIconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  )
}
// Tradeo AI — same mark as Login/SignupPage BrandPanel.
function HeroIconChat() {
  return (
    <svg {...heroIconProps}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
// Risk Lab
function HeroIconFlask() {
  return (
    <svg {...heroIconProps}>
      <path d="M9 2v6.5L4 18a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9.5V2" />
      <line x1="9" y1="2" x2="15" y2="2" />
    </svg>
  )
}

// ── Logged-out landing ────────────────────────────────────────────────────────
function LoggedOutHome() {
  const { t } = useLanguage()
  const [quote] = useState(
    () => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  )

  const dummyStats = [
    { label: 'Total P/L Today', value: '+Rs. 24,850', color: 'text-green-500' },
    { label: 'Realized P/L', value: '+Rs. 18,200', color: 'text-blue-500' },
    { label: 'Win Rate', value: '68%', color: 'text-gray-900 dark:text-white' },
    { label: 'Open Positions', value: '4', color: 'text-orange-500' },
  ]
  const dummyWatchlist = ['NABIL', 'NTC', 'SCB', 'EBL', 'NICA', 'HBL', 'NLIC', 'UPPER']
  const dummyTasks = [
    'Review morning briefing',
    'Check NABIL resistance',
    'Update trade journal',
    'Set SL for SCB',
  ]
  const dummyAlerts = [
    { symbol: 'NABIL', note: 'Crossed Rs.1,300 — BUY zone', tone: 'green' },
    { symbol: 'SCB', note: 'Approaching SL at Rs.3,050', tone: 'red' },
    { symbol: 'EBL', note: 'Volume spike, +12% today', tone: 'green' },
  ]
  const dummyDiscipline = [
    ['Task Completion', 82],
    ['Journal Rate', 75],
    ['Win Rate', 68],
  ]
  // Small NEPSE-style candlestick strip for the center chart card preview —
  // a real swinging price path (each candle connects to the next), not
  // independent random bars.
  // Random seed each mount (not fixed) so the pattern is fresh every page
  // load, still generated by the same connected-swing algorithm so it never
  // reads as noise. useMemo so it doesn't reshuffle on every incidental
  // re-render — only once per visit.
  const chartCandles = useMemo(
    () =>
      generateSwingCandles(19, {
        seed: Math.floor(Math.random() * 1e6),
        spacing: 15,
        startX: 10,
        baseline: 32,
        amplitude: 14,
        minBody: 4,
        maxBody: 11,
      }),
    []
  )

  // Candlestick motif for the brand backdrop (same generator + look as the
  // auth BrandPanel, tuned for this wider/shorter viewBox).
  const heroCandles = useMemo(
    () =>
      generateSwingCandles(8, {
        seed: Math.floor(Math.random() * 1e6),
        spacing: 50,
        startX: 40,
        baseline: 140,
        amplitude: 60,
        minBody: 28,
        maxBody: 58,
      }),
    []
  )

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
                y1={c.t - 15}
                x2={c.x}
                y2={c.t + c.h + 15}
                stroke={c.green ? '#22c55e' : '#ef4444'}
                strokeWidth="1.5"
              />
              <rect
                x={c.x - 6}
                y={c.t}
                width="12"
                height={c.h}
                fill={c.green ? '#22c55e' : '#ef4444'}
                rx="2"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Blurred dashboard preview — desktop only (intentional marketing mock per
          design.md), deliberately mirrors the REAL logged-in dashboard's layout
          (LoggedInHome below): routine+goals left, stats+chart+watchlist center,
          discipline+alerts right — same 3/6/3 grid, same column names/positions,
          both side columns hidden below lg exactly like the real one. Hidden on
          phones, where it read as a fake-data "vibecoded" wall; phones get the
          clean brand backdrop above instead. */}
      <div className="hidden sm:flex absolute inset-0 select-none pointer-events-none px-4 py-4 flex-col gap-4 overflow-hidden">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 filter blur-[2px]">
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
          {/* Left column — matches real TaskBoard + MonthlyGoals, desktop only */}
          <div className="hidden lg:flex col-span-3 flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Daily Routine</p>
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

          {/* Center column — full width until lg (matches the real dashboard:
              CenterDashboard is the only column shown below lg), 6 of 12 once
              both side columns reappear at lg */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden filter blur-[2px]">
              <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">NEPSE</h3>
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm">
                    Daily
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-gray-400">
                    Weekly
                  </span>
                </div>
              </div>
              <div className="px-3 pt-2 flex items-baseline gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">2,667.97</span>
                <span className="text-[10px] font-medium text-green-500">+0.18%</span>
              </div>
              <div className="px-2 pb-3">
                <svg viewBox="0 0 300 65" className="w-full h-20">
                  {chartCandles.map((c, i) => (
                    <g key={i}>
                      <line
                        x1={c.x}
                        y1={c.t - 3}
                        x2={c.x}
                        y2={c.t + c.h + 3}
                        stroke={c.green ? '#22c55e' : '#ef4444'}
                        strokeWidth="1"
                      />
                      <rect
                        x={c.x - 2.5}
                        y={c.t}
                        width="5"
                        height={c.h}
                        fill={c.green ? '#22c55e' : '#ef4444'}
                        rx="1"
                      />
                    </g>
                  ))}
                </svg>
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

          {/* Right column — matches real DisciplineScore (compact) + AlertsWidget,
              desktop only */}
          <div className="hidden lg:flex col-span-3 flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500">Discipline Score</p>
                <span className="text-lg font-bold text-green-500">68</span>
              </div>
              <div className="space-y-2">
                {dummyDiscipline.map(([l, pct]) => (
                  <div key={l} className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400">{l}</span>
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 filter blur-[2px]">
              <p className="text-xs font-semibold text-gray-500 mb-3">Alerts</p>
              <div className="space-y-2">
                {dummyAlerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.tone === 'green' ? 'bg-green-400' : 'bg-red-400'}`}
                    />
                    <p className="text-[11px] text-gray-500 leading-snug">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {a.symbol}
                      </span>{' '}
                      {a.note}
                    </p>
                  </div>
                ))}
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

            {/* Features grid — 2-up on all phone widths to keep the card short.
                Line icons, not emoji (HOME-15 precedent) — reuses the same Trade
                Journal / Discipline Score / Tradeo AI marks as Login/SignupPage's
                BrandPanel for cross-page consistency. */}
            <div className="px-5 sm:px-8 py-3.5 sm:py-5 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-3">
              {[
                { icon: <HeroIconJournal />, title: t('hero.feat1Title'), desc: t('hero.feat1Desc') },
                { icon: <HeroIconEye />, title: t('hero.feat2Title'), desc: t('hero.feat2Desc') },
                { icon: <HeroIconChart />, title: t('hero.feat3Title'), desc: t('hero.feat3Desc') },
                { icon: <HeroIconClock />, title: t('hero.feat4Title'), desc: t('hero.feat4Desc') },
                { icon: <HeroIconChat />, title: t('hero.feat5Title'), desc: t('hero.feat5Desc') },
                { icon: <HeroIconFlask />, title: t('hero.feat6Title'), desc: t('hero.feat6Desc') },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="flex items-start gap-2.5 animate-fade-up"
                  style={{ animationDelay: `${100 + i * 50}ms` }}
                >
                  <span className="text-blue-500 dark:text-blue-400 mt-0.5">{f.icon}</span>
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
                className="active:scale-[0.98] flex-1 bg-green-500 hover:bg-green-400 text-white min-h-[48px] flex items-center justify-center py-3 rounded-xl text-sm font-semibold text-center transition-all duration-200 ease-luxury shadow-sm shadow-green-500/20 hover:shadow-md hover:shadow-green-500/25"
              >
                {t('hero.cta')}
              </Link>
              <Link
                to="/login"
                className="active:scale-[0.98] flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 min-h-[48px] flex items-center justify-center py-3 rounded-xl text-sm font-medium text-center hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all duration-200 ease-luxury"
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
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
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
    nosl: <IconWarning />,
    sl: <IconAlertCircle />,
    tp: <IconCheckCircle />,
    watch: <IconBell />,
    goal: <IconCalendar />,
    circuit: <IconBolt />,
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
      <div className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/10 shadow-sm h-full animate-pulse p-4 space-y-2">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    )

  return (
    <div
      className={`hp-card group relative bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-2xl ${accent ? '' : 'border'} border-white/60 dark:border-white/10 overflow-hidden h-full flex flex-col min-h-0 ${accent ? tierRingClass(displayTier) : 'shadow-sm'}`}
    >
      <TierAccentOverlay accent={accent} />
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
                <span className={`flex-shrink-0 ${textClass[a.severity]}`}>{iconMap[a.type]}</span>
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
    <div className="hp-stat bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-3 border border-white/60 dark:border-white/10 shadow-sm">
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

// ── Center dashboard skeleton — shared by CenterDashboard's own initData-loading
// state and HomeSkeleton (HomePage's authLoading gate), so the two loading
// phases render pixel-identical markup and the swap between them is invisible.
function CenterDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 animate-pulse">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 shadow-sm px-3 py-2.5"
          >
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-2" />
            <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/10 shadow-sm h-[200px] sm:h-[220px]" />
      {/* Watchlist placeholder */}
      <div className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/10 shadow-sm">
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
}

// ── Center dashboard (authenticated) ─────────────────────────────────────────
function CenterDashboard({ navigate, initData, onRefresh, onDataReady, mobileTopTab, setMobileTopTab }) {
  const { t: tr } = useLanguage()
  const [openPositions, setOpenPositions] = useState([])
  const [perfStats, setPerfStats] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const priceMapRef = useRef({})
  const [loading, setLoading] = useState(!initData)

  // Stats window in months — READ-ONLY here (HOME-9c: the home screen carries no
  // settings UI; the control lives in Profile → Dashboard preferences, same key,
  // until the full Settings page absorbs it). Clamped 1–24, default 2.
  const [statMonthsRaw] = useLocalStorage('hp.statsMonths', 2)
  const statMonths = Math.min(24, Math.max(1, parseInt(statMonthsRaw) || 2))

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

  if (loading) return <CenterDashboardSkeleton />

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ── Stats Bar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {!perfStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md dark:backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 shadow-sm px-2 sm:px-3 py-1.5 sm:py-2.5"
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

      {/* ── Watchlist (extracted t30 HOME-10; multi-select delete HOME-16) ────── */}
      <WatchlistPanel
        watchlist={watchlist}
        setWatchlist={setWatchlist}
        openPositions={openPositions}
        onRefresh={onRefresh}
        priceMapRef={priceMapRef}
        navigate={navigate}
      />
    </div>
  )
}

// ── Logged-in layout ─────────────────────────────────────────────────────────
function LoggedInHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [initData, setInitData] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [mobileTopTab, setMobileTopTab] = useState('tasks') // 'tasks' | 'discipline'
  const [mobileBottomTab, setMobileBottomTab] = useState('goals') // 'goals' | 'alerts'

  // gCache-backed fetch — survives navigate-away-and-back within 60s TTL
  const fetchDashboard = useCallback(async (force = false) => {
    try {
      const res = await getDashboardInit(force)
      setInitData(res.data)
      setFetchError(null)
    } catch (err) {
      console.error(err)
      setFetchError('Failed to load dashboard. Please refresh.')
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

  // A failed initial fetch left `initData` null forever — without this, CenterDashboard's own
  // `loading` (derived purely from `!initData`) never clears, so the page was stuck on the
  // skeleton indefinitely with no error shown and no way to retry.
  if (fetchError && !initData)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-[13px] text-red-400 font-medium">{fetchError}</p>
          <button
            onClick={() => {
              setFetchError(null)
              fetchDashboard(true)
            }}
            className="text-[11px] text-blue-500 border border-blue-200 dark:border-blue-800 px-4 py-1.5 rounded-lg transition-colors hover:text-blue-400"
          >
            Retry
          </button>
        </div>
      </div>
    )

  return (
    <>
      {/* Use flex-col so side columns can stretch to remaining height without hardcoding greeting bar px */}
      <div className="w-full px-3 sm:px-4 py-3 sm:py-4 pb-safe min-h-[100dvh] flex flex-col bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50/30 dark:bg-none dark:bg-gray-950">
        {/* Content cap — wider than LogsPage/PortfolioPage's max-w-7xl on purpose
            (owner call: this is a trading OS, a 27" monitor is a real target, not
            an edge case to shrink away from). Below ~1800px this is a no-op; above
            it, stops the 12-col grid from linear-stretching into oversized cards
            with huge dead space. Background gradient stays full-bleed on the outer
            div above. */}
        <div className="w-full max-w-[1800px] mx-auto flex flex-col flex-1 min-h-0">
          {/* Greeting bar — shrinks to its content, never stretches */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 animate-fade-up flex-shrink-0">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {getGreeting()},{' '}
                <span className={TIER_TEXT[getDisplayTier(user)] || ''}>
                  {user?.name?.split(' ')[0] || 'Trader'}
                </span>
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

          {/* LEFT column — desktop only: Daily Routine sizes to its own content (HOME-18 —
              was a forced 35fr row, leaving dead space below its short task list), Monthly
              Goals absorbs whatever height is left. */}
          <div
            className="hidden lg:grid col-span-3 order-1 gap-3 min-h-0"
            style={{ gridTemplateRows: 'auto 1fr' }}
          >
            {initData ? (
              <>
                <TaskBoard initData={initData.tasks} mindsetContent={initData.mindset?.content} />
                <MonthlyGoals initData={initData.goals} />
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[170px]" />
                <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[200px]" />
              </>
            )}
          </div>

          {/* RIGHT column — desktop only: Discipline Score sizes to its own content (HOME-18 —
              same forced-height issue as the left column), Alerts absorbs what's left. */}
          <div
            className="hidden lg:grid col-span-3 order-3 gap-3 min-h-0"
            style={{ gridTemplateRows: 'auto 1fr' }}
          >
            {initData ? (
              <DisciplineScore initData={initData.discipline} />
            ) : (
              <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[170px]" />
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
      </div>
    </>
  )
}

// ── Home skeleton — the authLoading gate's placeholder. Mirrors LoggedInHome's
// own shell (greeting bar + 3-column grid) instead of the generic cross-page
// PageSkeleton, so there's no shape change when LoggedInHome takes over —
// previously the generic skeleton → this one was an visible seam on any slow
// reload (cold cache / hard reload), since it only ever showed briefly enough
// to go unnoticed on a warm reload. `user` isn't known yet at this point, so
// the greeting text itself is a pulse bar rather than real content.
function HomeSkeleton() {
  return (
    <div className="w-full px-3 sm:px-4 py-3 sm:py-4 pb-safe min-h-[100dvh] flex flex-col bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50/30 dark:bg-none dark:bg-gray-950">
      <div className="w-full max-w-[1800px] mx-auto flex flex-col flex-1 min-h-0">
        {/* Greeting bar */}
        <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 flex-shrink-0 animate-pulse">
          <div>
            <div className="h-[18px] w-40 bg-gray-100 dark:bg-gray-800 rounded mb-1.5" />
            <div className="h-[14px] w-52 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
          <div className="h-6 w-24 bg-gray-100 dark:bg-gray-800 rounded-full" />
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 sm:gap-4">
          {/* CENTER — always first on mobile */}
          <div className="col-span-12 lg:col-span-6 order-1 lg:order-2 min-h-0">
            <CenterDashboardSkeleton />
          </div>

          {/* LEFT column — desktop only. Rows match LoggedInHome's real auto/1fr split (HOME-18)
              so the skeleton→real swap has no visible shape change. */}
          <div
            className="hidden lg:grid col-span-3 order-1 gap-3 min-h-0"
            style={{ gridTemplateRows: 'auto 1fr' }}
          >
            <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[170px]" />
            <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[200px]" />
          </div>

          {/* RIGHT column — desktop only. Same auto/1fr split as LoggedInHome (HOME-18). */}
          <div
            className="hidden lg:grid col-span-3 order-3 gap-3 min-h-0"
            style={{ gridTemplateRows: 'auto 1fr' }}
          >
            <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[170px]" />
            <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[200px]" />
          </div>

          {/* MOBILE only */}
          <div className="col-span-12 lg:hidden order-2">
            <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse min-h-[180px]" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const { user, loading } = useAuth()
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50/30 dark:bg-none dark:bg-gray-950 transition-colors">
      {/* Wait for /api/auth/me before choosing a view. `/` is public, so without
          this gate `user` is null on reload and the logged-OUT landing flashes
          for ~1s before flipping to LoggedInHome. HomeSkeleton (not the generic
          PageSkeleton) so the loading shape stays identical once LoggedInHome
          takes over and shows its own initData-loading state. */}
      {loading ? (
        <HomeSkeleton />
      ) : user ? (
        <LoggedInHome />
      ) : (
        <LoggedOutHome />
      )}
    </div>
  )
}

export default HomePage
