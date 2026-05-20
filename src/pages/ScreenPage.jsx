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
// Parent holds a ref to a DOM node in the tab bar. Child calls
// useScreenToolbarSlot(jsx) to portal its controls into that node.
// Child owns its own state — no sync, no loops.
const ScreenToolbarSlotCtx = createContext(null)

export function useScreenToolbarSlot(node) {
  const slotRef = useContext(ScreenToolbarSlotCtx)
  const [, setTick] = useState(0)
  // useLayoutEffect fires synchronously after DOM commit — slotRef.current is
  // guaranteed to be populated before the portal renders, preventing the blank
  // toolbar that occurs when useEffect fires after paint on re-renders.
  useLayoutEffect(() => { setTick(t => t + 1) }, [])

  if (!slotRef?.current) return null
  return createPortal(node, slotRef.current)
}

const MultiChartPage    = lazy(() => import('../components/screen/MultiChartPage'))
const SMCChartPage      = lazy(() => import('../components/screen/SMCChartPage'))
const PriceActionPage   = lazy(() => import('../components/screen/PriceActionPage'))
const BacktestPage   = lazy(() => import('../components/backtest/BacktestPage'))
const ReplayPage     = lazy(() => import('../components/screen/ReplayPage'))

function TabSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Auth wall — shown inline when a locked tab is clicked while logged out ───
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
        <Link
          to="/login"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Login
        </Link>
        <Link
          to="/signup"
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
        >
          Sign up free
        </Link>
      </div>
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
  if (activeTab === 'MultiChart') return (
    <Suspense fallback={<TabSpinner />}>
      <MultiChartPage />
    </Suspense>
  )
  if (activeTab === 'SMC') return (
    <Suspense fallback={<TabSpinner />}>
      <SMCChartPage />
    </Suspense>
  )
  if (activeTab === 'PriceAction') return (
    <Suspense fallback={<TabSpinner />}>
      <PriceActionPage />
    </Suspense>
  )

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

function TabStrip({ tabs, active, onChange, lockedIds = [] }) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {tabs.map(t => {
        const locked = lockedIds.includes(t.id)
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors whitespace-nowrap ${
              active === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : locked
                  ? 'text-gray-400 dark:text-gray-600 cursor-pointer'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
            {locked && (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
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
  const [mode,        setMode]        = useState(() => sessionStorage.getItem('tradeo_screen_mode')        || 'simple')
  const [simpleTab,   setSimpleTab]   = useState(() => sessionStorage.getItem('tradeo_screen_simpleTab')   || 'General')
  const [complexTab,  setComplexTab]  = useState(() => sessionStorage.getItem('tradeo_screen_complexTab')  || 'Backtesting')
  const [mobilePanel, setMobilePanel] = useState(null)
  const toolbarSlotRef = useRef(null)
  const { user } = useAuth()

  // Opt into navbar auto-hide — activates on mount, restores on unmount
  useNavbarAutoHide()
  const { hidden: navHidden, scheduleHide, showNavbar } = useNavbarState()

  // If not logged in, keep simple mode and reset to General — never allow locked tabs to persist
  const handleMode = (m) => {
    if (!user && m === 'complex') return
    setMode(m)
    sessionStorage.setItem('tradeo_screen_mode', m)
  }
  const handleSimpleTab  = (t) => {
    if (!user && t !== 'General') return
    setSimpleTab(t)
    sessionStorage.setItem('tradeo_screen_simpleTab', t)
  }
  const handleComplexTab = (t) => { setComplexTab(t); sessionStorage.setItem('tradeo_screen_complexTab', t) }

  // Close mobile sheet on Escape
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
      style={{ height: '100dvh', paddingTop: navHidden ? 0 : 56 }}
    >

      {/* ── Top strip ── */}
      {/* NOTE: ChartSymbolSearch dropdown uses absolute positioning — it must NOT
          be inside an overflow-x-auto container or the dropdown clips. The slot
          ref sits outside the scrollable portion, after the shrink-0 tab groups. */}
      {/* Toolbar strip — onMouseEnter as fast path; global mousemove listener
          in App.jsx handles portalled controls (portal breaks React bubbling) */}
      <div
        className="flex items-center gap-2 px-3 py-0.5 border-b border-gray-100 dark:border-gray-800 shrink-0"
        onMouseEnter={showNavbar}
      >

        {/* Simple / Complex toggle — always visible, shrink-0 */}
        <TabStrip
          tabs={[{ id: 'simple', label: 'Simple', short: 'Sim' }, { id: 'complex', label: 'Complex', short: 'Cpx' }]}
          active={mode}
          onChange={handleMode}
          lockedIds={!user ? ['complex'] : []}
        />

        {/* Divider */}
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Sub-tabs — shrink-0 so they never compress */}
        <div className="shrink-0">
          {isSimple
            ? <TabStrip
                tabs={SIMPLE_TABS}
                active={simpleTab}
                onChange={handleSimpleTab}
                lockedIds={!user ? ['MultiChart', 'SMC', 'PriceAction'] : []}
              />
            : <TabStrip tabs={COMPLEX_TABS} active={complexTab} onChange={handleComplexTab} />
          }
        </div>

        {/* Divider — shown for all simple tabs (they all populate the toolbar slot) */}
        {isSimple && (
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
        )}

        {/* Toolbar slot — StockChart portals its controls here.
            flex-1 so it fills available space; overflow-x-auto for narrow screens.
            Must NOT be overflow-x-auto when ChartSymbolSearch is in it — see note above.
            We use overflow-visible here; the tab bar itself handles horizontal scroll
            only when needed via the outer wrapper below. */}
        <div ref={toolbarSlotRef} className="flex-1 flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar" />

        {/* Market status — always at far right, shrink-0 */}
        <MarketStatusBadge />
      </div>

      {/* ── Content — mouse entering chart area triggers navbar hide ── */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col" onMouseEnter={navHidden ? undefined : scheduleHide}>
      {isSimple ? (
        !user && simpleTab !== 'General'
          ? <AuthWall feature={SIMPLE_TABS.find(t => t.id === simpleTab)?.label || simpleTab} />
          : <SimpleContent
              activeTab={simpleTab}
              mobilePanel={mobilePanel}
              setMobilePanel={setMobilePanel}
            />
      ) : (
        !user
          ? <AuthWall feature="Complex mode" />
          : <ComplexTabProvider>
              <ComplexContent activeTab={complexTab} />
            </ComplexTabProvider>
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
