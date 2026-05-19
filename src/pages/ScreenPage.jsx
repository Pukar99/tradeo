import { useState, useEffect, lazy, Suspense } from 'react'
import { ScreenProvider }       from '../context/ScreenContext'
import { ComplexTabProvider }   from '../hooks/useComplexTab.jsx'
import StockChart               from '../components/screen/StockChart'
import MarketStatusBadge        from '../components/screen/MarketStatusBadge'
import LeftPanel                from '../components/screen/LeftPanel'
import RightPanel               from '../components/screen/RightPanel'
import ErrorBoundary            from '../components/ErrorBoundary'
import ComingSoon               from '../components/ComingSoon'

const BacktestPage = lazy(() => import('../components/backtest/BacktestPage'))
const ReplayPage   = lazy(() => import('../components/screen/ReplayPage'))

function TabSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Tab definitions ──────────────────────────────────────────────────────────

const SIMPLE_TABS = [
  { id: 'General',     label: 'General',     short: 'Gen'   },
  { id: 'MultiChart',  label: 'MultiChart',  short: 'Multi' },
  { id: 'SMC',         label: 'SMC',         short: 'SMC'   },
  { id: 'PriceAction', label: 'Price Action', short: 'PA'   },
]

const COMPLEX_TABS = [
  { id: 'Backtesting',  label: 'Backtesting',   short: 'BT'    },
  { id: 'Replay',       label: 'Replay',         short: 'Rep'   },
  { id: 'StrategyLab',  label: 'Strategy Lab',   short: 'Strat' },
]


// ── Simple mode content ──────────────────────────────────────────────────────

function SimpleContent({ activeTab, mobilePanel, setMobilePanel }) {
  if (activeTab === 'MultiChart') return <ComingSoon compact label="MultiChart — coming soon" />
  if (activeTab === 'SMC')        return <ComingSoon compact label="SMC — coming soon" />
  if (activeTab === 'PriceAction') return <ComingSoon compact label="Price Action — coming soon" />

  // General — chart + panels layout
  return (
    <>
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left panel — desktop only (lg+) */}
        <div className="w-[10%] min-w-[120px] max-w-[180px] border-r border-gray-100
                        dark:border-gray-800 overflow-y-auto hidden lg:flex flex-col shrink-0">
          <LeftPanel />
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ErrorBoundary label="Chart">
            <StockChart />
          </ErrorBoundary>
        </div>

        {/* Right panel — desktop only (lg+) */}
        <div className="w-[15%] min-w-[160px] max-w-[240px] border-l border-gray-100
                        dark:border-gray-800 overflow-y-auto hidden lg:flex flex-col shrink-0">
          <RightPanel />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav panel={mobilePanel} setPanel={setMobilePanel} />
      <MobileSheet panel={mobilePanel} onClose={() => setMobilePanel(null)} />
    </>
  )
}

// ── Complex mode content ─────────────────────────────────────────────────────

function ComplexContent({ activeTab }) {
  if (activeTab === 'Backtesting') return (
    <Suspense fallback={<TabSpinner />}>
      <ErrorBoundary label="Backtesting">
        <BacktestPage />
      </ErrorBoundary>
    </Suspense>
  )
  if (activeTab === 'Replay') return (
    <Suspense fallback={<TabSpinner />}>
      <ErrorBoundary label="Replay">
        <ReplayPage />
      </ErrorBoundary>
    </Suspense>
  )
  if (activeTab === 'StrategyLab') return <ComingSoon compact label="Strategy Lab — automated strategy testing" />
  return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
      {activeTab} — coming soon
    </div>
  )
}

// ── Mobile bottom navigation bar ─────────────────────────────────────────────

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
      className="lg:hidden shrink-0 flex border-t border-gray-200 dark:border-gray-800
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
            <span className="text-[10px] font-semibold">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Mobile slide-up sheet ────────────────────────────────────────────────────

function MobileSheet({ panel, onClose }) {
  useEffect(() => {
    if (!panel) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [panel])

  if (!panel) return null

  const title = panel === 'positions' ? 'Positions & Watchlist' : 'Market & Movers'

  return (
    <>
      <div
        className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
                   bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl
                   border-t border-gray-200 dark:border-gray-800"
        style={{ height: '68vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
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
        <div className="flex-1 overflow-y-auto min-h-0">
          {panel === 'positions' ? <LeftPanel /> : <RightPanel />}
        </div>
      </div>
    </>
  )
}

// ── Tab bar strip ────────────────────────────────────────────────────────────

function TabStrip({ tabs, active, onChange }) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors whitespace-nowrap ${
            active === t.id
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}>
          <span className="hidden sm:inline">{t.label}</span>
          <span className="sm:hidden">{t.short}</span>
        </button>
      ))}
    </div>
  )
}

// ── Screen inner ─────────────────────────────────────────────────────────────

function ScreenInner() {
  const [mode,        setMode]        = useState(() => sessionStorage.getItem('screen_mode')        || 'simple')
  const [simpleTab,   setSimpleTab]   = useState(() => sessionStorage.getItem('screen_simpleTab')   || 'General')
  const [complexTab,  setComplexTab]  = useState(() => sessionStorage.getItem('screen_complexTab')  || 'Backtesting')
  const [mobilePanel, setMobilePanel] = useState(null)

  const handleMode       = (m) => { setMode(m);       sessionStorage.setItem('screen_mode', m) }
  const handleSimpleTab  = (t) => { setSimpleTab(t);  sessionStorage.setItem('screen_simpleTab', t) }
  const handleComplexTab = (t) => { setComplexTab(t); sessionStorage.setItem('screen_complexTab', t) }

  // Close mobile sheet on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setMobilePanel(null) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const isSimple = mode === 'simple'

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top strip ── */}
      <div className="flex items-center justify-between px-3 py-0.5 border-b border-gray-100 dark:border-gray-800 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-0">

          {/* Simple / Complex toggle */}
          <TabStrip
            tabs={[{ id: 'simple', label: 'Simple', short: 'Sim' }, { id: 'complex', label: 'Complex', short: 'Cpx' }]}
            active={mode}
            onChange={handleMode}
          />

          {/* Sub-tabs */}
          {isSimple
            ? <TabStrip tabs={SIMPLE_TABS}  active={simpleTab}  onChange={handleSimpleTab}  />
            : <TabStrip tabs={COMPLEX_TABS} active={complexTab} onChange={handleComplexTab} />
          }
        </div>
        <MarketStatusBadge />
      </div>

      {/* ── Content ── */}
      {isSimple ? (
        <SimpleContent
          activeTab={simpleTab}
          mobilePanel={mobilePanel}
          setMobilePanel={setMobilePanel}
        />
      ) : (
        <ComplexTabProvider>
          <ComplexContent activeTab={complexTab} />
        </ComplexTabProvider>
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
