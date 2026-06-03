// === ScreenPage.jsx — screen page: simple/complex mode, tab routing, toolbar slot portal, auth gating, mobile sheet ===
import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useNavbarAutoHide, useNavbarState } from '../App'
import { ScreenProvider }       from '../context/ScreenContext'
import { ComplexTabProvider }   from '../hooks/useComplexTab.jsx'
import { useAuth }              from '../context/AuthContext'
import StockChart               from '../components/screen/StockChart'
import MarketStatusBadge        from '../components/screen/MarketStatusBadge'
import LeftPanel                from '../components/screen/LeftPanel'
import RightPanel               from '../components/screen/RightPanel'
import ErrorBoundary            from '../components/ErrorBoundary'
import ComingSoon               from '../components/ComingSoon'

// ── Screen toolbar slot — same portal pattern as DataLabPage ─────────────────
const ScreenToolbarSlotCtx = createContext(null)

export function useScreenToolbarSlot(node) {
  const slotRef = useContext(ScreenToolbarSlotCtx)
  const [, setTick] = useState(0)
  useLayoutEffect(() => { setTick(t => t + 1) }, [])
  if (!slotRef?.current) return null
  return createPortal(node, slotRef.current)
}

const MultiChartPage  = lazy(() => import('../components/screen/MultiChartPage'))
const SMCChartPage    = lazy(() => import('../components/screen/SMCChartPage'))
const PriceActionPage = lazy(() => import('../components/screen/PriceActionPage'))
const BacktestPage    = lazy(() => import('../components/backtest/BacktestPage'))
const ReplayPage      = lazy(() => import('../components/screen/ReplayPage'))

function TabSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Auth wall ────────────────────────────────────────────────────────────────

function AuthWall({ feature }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 animate-fade-up">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{feature} requires login</p>
        <p className="text-xs text-gray-400 mt-1">Sign in to access this feature</p>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/login" className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Login</Link>
        <Link to="/signup" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">Sign up free</Link>
      </div>
    </div>
  )
}

// ── Tab definitions ──────────────────────────────────────────────────────────

const SIMPLE_TABS = [
  { id: 'General',     label: 'General',      short: 'Gen'   },
  { id: 'MultiChart',  label: 'MultiChart',   short: 'Multi' },
  { id: 'SMC',         label: 'SMC',          short: 'SMC'   },
  { id: 'PriceAction', label: 'Price Action', short: 'PA'    },
]

const COMPLEX_TABS = [
  { id: 'Backtesting', label: 'Backtesting',  short: 'BT'    },
  { id: 'Replay',      label: 'Replay',       short: 'Rep'   },
  { id: 'StrategyLab', label: 'Strategy Lab', short: 'Strat' },
]

// ── Simple mode content ──────────────────────────────────────────────────────

function SimpleContent({ activeTab, mobilePanel, setMobilePanel, leftOpen, toggleLeft, rightOpen, toggleRight }) {
  if (activeTab === 'MultiChart') return (
    <div key="MultiChart" className="flex-1 min-h-0 flex flex-col animate-tab-in">
      <Suspense fallback={<TabSpinner />}><MultiChartPage /></Suspense>
    </div>
  )
  if (activeTab === 'SMC') return (
    <div key="SMC" className="flex-1 min-h-0 flex flex-col animate-tab-in">
      <Suspense fallback={<TabSpinner />}><SMCChartPage /></Suspense>
    </div>
  )
  if (activeTab === 'PriceAction') return (
    <div key="PriceAction" className="flex-1 min-h-0 flex flex-col animate-tab-in">
      <Suspense fallback={<TabSpinner />}><PriceActionPage /></Suspense>
    </div>
  )

  // General — chart + collapsible panels
  return (
    <>
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left panel — collapsible */}
        <div className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative
                        bg-white/50 dark:bg-gray-950/60 backdrop-blur-2xl
                        shadow-[1px_0_0_rgba(255,255,255,0.18),2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[1px_0_0_rgba(255,255,255,0.07),2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-200 ease-in-out
                        ${leftOpen ? 'w-[13%] min-w-[150px] max-w-[200px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'}
                        ${!leftOpen ? 'screen-panel-collapsed' : ''}`}>
          <div className="screen-panel-content flex flex-col h-full">
            <LeftPanel />
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <button
            onClick={toggleLeft}
            title={leftOpen ? 'Hide left panel' : 'Show left panel'}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-30
                       h-12 w-4 items-center justify-center
                       bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                       border-y border-r border-gray-200/60 dark:border-gray-700/50
                       rounded-r-lg shadow-sm text-gray-400 dark:text-gray-500
                       hover:bg-white dark:hover:bg-gray-700
                       hover:text-blue-500 dark:hover:text-blue-400
                       transition-all duration-150"
          >
            <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${leftOpen ? '' : 'rotate-180'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            onClick={toggleRight}
            title={rightOpen ? 'Hide right panel' : 'Show right panel'}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-30
                       h-12 w-4 items-center justify-center
                       bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                       border-y border-l border-gray-200/60 dark:border-gray-700/50
                       rounded-l-lg shadow-sm text-gray-400 dark:text-gray-500
                       hover:bg-white dark:hover:bg-gray-700
                       hover:text-blue-500 dark:hover:text-blue-400
                       transition-all duration-150"
          >
            <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${rightOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <ErrorBoundary label="Chart">
            <StockChart />
          </ErrorBoundary>
        </div>

        {/* Right panel — collapsible */}
        <div className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative
                        bg-white/50 dark:bg-gray-950/60 backdrop-blur-2xl
                        shadow-[-1px_0_0_rgba(255,255,255,0.18),-2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[-1px_0_0_rgba(255,255,255,0.07),-2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-200 ease-in-out
                        ${rightOpen ? 'w-[16%] min-w-[170px] max-w-[240px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'}
                        ${!rightOpen ? 'screen-panel-collapsed' : ''}`}>
          <div className="screen-panel-content flex flex-col h-full">
            <RightPanel />
          </div>
        </div>
      </div>

      <MobileBottomNav panel={mobilePanel} setPanel={setMobilePanel} />
      <MobileSheet panel={mobilePanel} onClose={() => setMobilePanel(null)} />
    </>
  )
}

// ── Complex mode content ─────────────────────────────────────────────────────

function ComplexContent({ activeTab }) {
  if (activeTab === 'Backtesting') return (
    <Suspense fallback={<TabSpinner />}>
      <ErrorBoundary label="Backtesting"><BacktestPage /></ErrorBoundary>
    </Suspense>
  )
  if (activeTab === 'Replay') return (
    <Suspense fallback={<TabSpinner />}>
      <ErrorBoundary label="Replay"><ReplayPage /></ErrorBoundary>
    </Suspense>
  )
  if (activeTab === 'StrategyLab') return <ComingSoon compact label="Strategy Lab — automated strategy testing" />
  return <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">{activeTab} — coming soon</div>
}

// ── Mobile bottom navigation ─────────────────────────────────────────────────

function MobileBottomNav({ panel, setPanel }) {
  const tabs = [
    { id: null, label: 'Chart', icon: <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> },
    { id: 'positions', label: 'Positions', icon: <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" /></svg> },
    { id: 'market', label: 'Market', icon: <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg> },
  ]
  return (
    <div className="lg:hidden shrink-0 flex border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map(t => {
        const active = t.id === null ? panel === null : panel === t.id
        return (
          <button key={String(t.id)} onClick={() => setPanel(t.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
            }`}>
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
      <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-800"
        style={{ height: '68vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{title}</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 text-[12px] transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {panel === 'positions' ? <LeftPanel /> : <RightPanel />}
        </div>
      </div>
    </>
  )
}

// ── Tab bar strip ────────────────────────────────────────────────────────────

function TabStrip({ tabs, active, onChange, lockedIds = [] }) {
  return (
    <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/80 rounded-lg p-0.5 gap-0.5">
      {tabs.map(t => {
        const locked = lockedIds.includes(t.id)
        const isActive = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm animate-scale-in'
                : locked
                  ? 'text-gray-300 dark:text-gray-600 cursor-pointer'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/40'
            }`}>
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
            {locked && (
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Screen inner ─────────────────────────────────────────────────────────────

function ScreenInner() {
  const [mode,        setMode]        = useState(() => sessionStorage.getItem('tradeo_screen_mode') || 'simple')
  const [simpleTab,   setSimpleTab]   = useState(() => {
    const stored = sessionStorage.getItem('tradeo_screen_simpleTab')
    return SIMPLE_TABS.some(t => t.id === stored) ? stored : 'General'
  })
  const [complexTab,  setComplexTab]  = useState(() => {
    const stored = sessionStorage.getItem('tradeo_screen_complexTab')
    return COMPLEX_TABS.some(t => t.id === stored) ? stored : 'Backtesting'
  })
  const [mobilePanel, setMobilePanel] = useState(null)
  const [leftOpen,    setLeftOpen]    = useState(() => localStorage.getItem('tradeo_screen_leftOpen')  !== 'false')
  const [rightOpen,   setRightOpen]   = useState(() => localStorage.getItem('tradeo_screen_rightOpen') !== 'false')
  const toolbarSlotRef = useRef(null)
  const { user } = useAuth()

  const toggleLeft  = () => setLeftOpen(v  => { localStorage.setItem('tradeo_screen_leftOpen',  String(!v)); return !v })
  const toggleRight = () => setRightOpen(v => { localStorage.setItem('tradeo_screen_rightOpen', String(!v)); return !v })

  // Opt into navbar auto-hide — activates on mount, restores on unmount
  useNavbarAutoHide()
  const { active: navAutoHide, hidden: navHidden, scheduleHide, showNavbar } = useNavbarState()

  const handleMode       = (m) => { if (!user && m === 'complex') return; setMode(m); sessionStorage.setItem('tradeo_screen_mode', m) }
  const handleSimpleTab  = (t) => { if (!user && t !== 'General') return; setSimpleTab(t); sessionStorage.setItem('tradeo_screen_simpleTab', t) }
  const handleComplexTab = (t) => { setComplexTab(t); sessionStorage.setItem('tradeo_screen_complexTab', t) }

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setMobilePanel(null) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const isSimple = mode === 'simple'

  return (
    <ScreenToolbarSlotCtx.Provider value={toolbarSlotRef}>
    <div
      className="flex flex-col overflow-hidden bg-white dark:bg-gray-900"
      style={{ height: '100dvh', paddingTop: navAutoHide && !navHidden ? 56 : 0 }}
    >
      {/* ── Toolbar strip ── */}
      {/* NOTE: ChartSymbolSearch uses absolute positioning — toolbar slot must
          never be inside overflow-x-auto or the dropdown clips. */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b border-gray-100 dark:border-gray-800/80 shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
        onMouseEnter={showNavbar}
      >
        <TabStrip
          tabs={[{ id: 'simple', label: 'Simple', short: 'Sim' }, { id: 'complex', label: 'Complex', short: 'Cpx' }]}
          active={mode}
          onChange={handleMode}
          lockedIds={!user ? ['complex'] : []}
        />

        <div className="w-px h-5 bg-gray-300/80 dark:bg-gray-600/70 shrink-0 mx-0.5" />

        <div className="shrink-0">
          {isSimple
            ? <TabStrip tabs={SIMPLE_TABS} active={simpleTab} onChange={handleSimpleTab} lockedIds={!user ? ['MultiChart', 'SMC', 'PriceAction'] : []} />
            : <TabStrip tabs={COMPLEX_TABS} active={complexTab} onChange={handleComplexTab} />
          }
        </div>

        <div className="w-px h-5 bg-gray-300/80 dark:bg-gray-600/70 shrink-0 mx-0.5" />

        <div ref={toolbarSlotRef} className="flex-1 flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar" />

        <MarketStatusBadge />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col" onMouseEnter={navHidden ? undefined : scheduleHide}>
        {isSimple ? (
          !user && simpleTab !== 'General'
            ? <AuthWall feature={SIMPLE_TABS.find(t => t.id === simpleTab)?.label || simpleTab} />
            : <SimpleContent
                activeTab={simpleTab}
                mobilePanel={mobilePanel}
                setMobilePanel={setMobilePanel}
                leftOpen={leftOpen}
                toggleLeft={toggleLeft}
                rightOpen={rightOpen}
                toggleRight={toggleRight}
              />
        ) : (
          !user
            ? <AuthWall feature="Complex mode" />
            : <ComplexTabProvider><ComplexContent activeTab={complexTab} /></ComplexTabProvider>
        )}
      </div>
    </div>
    </ScreenToolbarSlotCtx.Provider>
  )
}

export default function ScreenPage() {
  return (
    <ScreenProvider>
      <ScreenInner />
    </ScreenProvider>
  )
}
