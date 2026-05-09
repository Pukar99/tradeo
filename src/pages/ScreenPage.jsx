import { useState, useEffect } from 'react'
import { ScreenProvider } from '../context/ScreenContext'
import { ComplexTabProvider }        from '../hooks/useComplexTab.jsx'
import StockChart                    from '../components/screen/StockChart'
import MarketStatusBadge             from '../components/screen/MarketStatusBadge'
import LeftPanel                     from '../components/screen/LeftPanel'
import RightPanel                    from '../components/screen/RightPanel'
import BacktestPage                  from '../components/backtest/BacktestPage'
import InsightPage                   from '../components/complex/InsightPage'
import BreakdownPage                 from '../components/complex/BreakdownPage'
import ErrorBoundary                 from '../components/ErrorBoundary'

const COMPLEX_TABS = [
  { id: 'Backtesting', label: 'Backtesting', short: 'BT'    },
  { id: 'Insight',     label: 'Insight',     short: 'Ins.'  },
  { id: 'Breakdown',   label: 'Breakdown',   short: 'Break' },
]

function ComplexContent({ activeTab }) {
  if (activeTab === 'Backtesting') return (
    <ErrorBoundary label="Backtesting">
      <BacktestPage />
    </ErrorBoundary>
  )
  if (activeTab === 'Insight') return (
    <ErrorBoundary label="Insight">
      <InsightPage />
    </ErrorBoundary>
  )
  if (activeTab === 'Breakdown') return (
    <ErrorBoundary label="Breakdown">
      <BreakdownPage />
    </ErrorBoundary>
  )
  return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
      {activeTab} — coming soon
    </div>
  )
}

// ── Mobile bottom navigation bar ────────────────────────────────────────────────
function MobileBottomNav({ panel, setPanel }) {
  const tabs = [
    {
      id: null,
      label: 'Chart',
      icon: (
        <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      id: 'positions',
      label: 'Positions',
      icon: (
        <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>
      ),
    },
    {
      id: 'market',
      label: 'Market',
      icon: (
        <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
  ]

  return (
    <div
      className="md:hidden shrink-0 flex border-t border-gray-200 dark:border-gray-800
                 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map(t => {
        const active = t.id === null ? panel === null : panel === t.id
        return (
          <button
            key={String(t.id)}
            onClick={() => setPanel(t.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
            }`}
          >
            {t.icon}
            <span className="text-[9px] font-semibold">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Mobile slide-up sheet ───────────────────────────────────────────────────────
function MobileSheet({ panel, onClose }) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (!panel) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [panel])

  if (!panel) return null

  const title = panel === 'positions' ? 'Positions & Watchlist' : 'Market & Movers'

  return (
    <>
      {/* Backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
                   bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl
                   border-t border-gray-200 dark:border-gray-800"
        style={{ height: '68vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Drag handle */}
        <div className="shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400
                       hover:bg-gray-200 dark:hover:bg-gray-700 text-[12px] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {panel === 'positions' ? <LeftPanel /> : <RightPanel />}
        </div>
      </div>
    </>
  )
}

// ── Screen inner ────────────────────────────────────────────────────────────────
function ScreenInner() {
  const [mode,       setMode]       = useState(() => sessionStorage.getItem('screen_mode')       || 'simple')
  const [complexTab, setComplexTab] = useState(() => sessionStorage.getItem('screen_complexTab') || 'Backtesting')
  const [mobilePanel, setMobilePanel] = useState(null) // null | 'positions' | 'market'

  const handleMode      = (m) => { setMode(m);      sessionStorage.setItem('screen_mode', m) }
  const handleComplexTab = (t) => { setComplexTab(t); sessionStorage.setItem('screen_complexTab', t) }

  // Close sheet on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setMobilePanel(null) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top strip ── */}
      <div className="flex items-center justify-between px-3 py-0.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">

          {/* Simple / Complex toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {['simple', 'complex'].map(m => (
              <button key={m} onClick={() => handleMode(m)}
                className={`px-2.5 py-0.5 rounded-md text-[9px] font-semibold capitalize transition-colors ${
                  mode === m
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                {m}
              </button>
            ))}
          </div>

          {/* Complex sub-tabs */}
          {mode === 'complex' && (
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {COMPLEX_TABS.map(t => (
                <button key={t.id} onClick={() => handleComplexTab(t.id)}
                  className={`px-2.5 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${
                    complexTab === t.id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <MarketStatusBadge />
      </div>

      {/* ── Content ── */}
      {mode === 'complex' ? (
        <ComplexTabProvider>
          <ComplexContent activeTab={complexTab} />
        </ComplexTabProvider>
      ) : (
        <>
          <div className="flex-1 flex overflow-hidden min-h-0">

            {/* Left panel — desktop only (lg+) */}
            <div className="w-[10%] min-w-[120px] max-w-[180px] border-r border-gray-100
                            dark:border-gray-800 overflow-y-auto hidden lg:flex flex-col shrink-0">
              <LeftPanel />
            </div>

            {/* Chart — full width on mobile, flex-1 on desktop */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ErrorBoundary label="Chart">
                <StockChart />
              </ErrorBoundary>
            </div>

            {/* Right panel — tablet+ (md+) */}
            <div className="w-[15%] min-w-[160px] max-w-[240px] border-l border-gray-100
                            dark:border-gray-800 overflow-y-auto hidden md:flex flex-col shrink-0">
              <RightPanel />
            </div>

          </div>

          {/* Mobile bottom nav — in document flow so chart isn't obscured */}
          <MobileBottomNav panel={mobilePanel} setPanel={setMobilePanel} />

          {/* Mobile slide-up sheet — portal-style fixed overlay */}
          <MobileSheet panel={mobilePanel} onClose={() => setMobilePanel(null)} />
        </>
      )}
    </div>
  )
}

export default function ScreenPage() {
  return (
    <ScreenProvider>
      <ScreenInner />
    </ScreenProvider>
  )
}
