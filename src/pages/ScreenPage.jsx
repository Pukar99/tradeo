// === ScreenPage.jsx — screen page: simple/advanced mode, tab routing, toolbar slot portal, auth gating, mobile sheet ===
import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  lazy,
  Suspense,
  createContext,
  useContext,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavbarAutoHide, useNavbarState } from '../App'
import { ScreenProvider } from '../context/ScreenContext'
import { AdvancedTabProvider } from '../hooks/useAdvancedTab.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useSlidingIndicator } from '../hooks/useSlidingIndicator'
import { useAuth } from '../context/AuthContext'
import StockChart from '../components/screen/StockChart'
import MarketStatusBadge from '../components/common/MarketStatusBadge'
import LeftPanel from '../components/screen/LeftPanel'
import RightPanel from '../components/screen/RightPanel'
import ErrorBoundary from '../components/ErrorBoundary'
import ComingSoon from '../components/ComingSoon'
import UpgradePrompt from '../components/UpgradePrompt'
import AuthWall from '../components/AuthWall'
import { useCompactToolbar, LayoutIcon } from '../components/screen/ScreenToolbarAtoms'
import {
  TIER_ACCENT,
  TIER_TEXT,
  TierAccentOverlay,
  tierRingClass,
  getDisplayTier,
} from '../components/common/TierMaterial'

// ── Screen toolbar slot — EXACT same portal pattern as DataLabPage.useToolbarSlot ──
// Context value is a stable useRef object; the hook forces one re-render after DOM
// commit via useLayoutEffect+setTick so slotRef.current is read AFTER the slot div
// attaches. This is the proven, in-production pattern.
//
// DO NOT rewrite this to a state-backed callback ref (ref={setState}). That variant
// re-fires the callback with `null` on every toolbar-strip remount (mode/tab/navbar
// auto-hide re-render), which strands the portal and silently drops StockChart's
// symbol-search/timeframe controls. The consumers (StockChart/SMC/PriceAction/
// MultiChart) were written for THIS ref-based contract — keep them in sync if you
// ever change it. (Regression history: state-backed rewrite dropped the chart
// controls; reverted to this. See memory feedback_portal_toolbar.)
const ScreenToolbarSlotCtx = createContext(null)

export function useScreenToolbarSlot(node) {
  const slotRef = useContext(ScreenToolbarSlotCtx)
  // useLayoutEffect fires synchronously after DOM commit — slotRef.current is
  // guaranteed populated before paint, so the toolbar never renders blank.
  const [, setTick] = useState(0)
  useLayoutEffect(() => {
    setTick((t) => t + 1)
  }, [])

  if (!slotRef?.current) return null
  return createPortal(node, slotRef.current)
}

const MultiChartPage = lazy(() => import('../components/screen/MultiChartPage'))
const SMCChartPage = lazy(() => import('../components/screen/SMCChartPage'))
const PriceActionPage = lazy(() => import('../components/screen/PriceActionPage'))
const BacktestPage = lazy(() => import('../components/backtest/BacktestPage'))

function TabSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Tab definitions ──────────────────────────────────────────────────────────

const SIMPLE_TABS = [
  { id: 'General', label: 'General', short: 'Gen' },
  { id: 'SMC', label: 'SMC', short: 'SMC' },
  { id: 'PriceAction', label: 'Price Action', short: 'PA' },
]

const ADVANCED_TABS = [
  { id: 'Backtesting', label: 'Backtesting', short: 'BT' },
  { id: 'StrategyLab', label: 'Strategy Lab', short: 'Strat' },
]

// ── Simple mode content ──────────────────────────────────────────────────────

function SimpleContent({
  activeTab,
  multiOn,
  multiLayout,
  setMultiLayout,
  mobilePanel,
  setMobilePanel,
  leftOpen,
  toggleLeft,
  rightOpen,
  toggleRight,
}) {
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
  const compact = useCompactToolbar()
  useEffect(() => {
    if (!compact || activeTab !== 'General') setMobilePanel(null)
  }, [compact, activeTab, setMobilePanel])
  if (activeTab === 'SMC')
    return (
      <div key="SMC" className="flex-1 min-h-0 flex flex-col animate-tab-in">
        {user?.tier === 'basic' && !user?.is_admin ? (
          <UpgradePrompt feature="SMC" />
        ) : (
          <Suspense fallback={<TabSpinner />}>
            <SMCChartPage />
          </Suspense>
        )}
      </div>
    )
  if (activeTab === 'PriceAction')
    return (
      <div key="PriceAction" className="flex-1 min-h-0 flex flex-col animate-tab-in">
        {user?.tier === 'basic' && !user?.is_admin ? (
          <UpgradePrompt feature="Price Action" />
        ) : (
          <Suspense fallback={<TabSpinner />}>
            <PriceActionPage />
          </Suspense>
        )}
      </div>
    )

  // General — MultiChart (full content area, no side panels) when toggled on.
  // layout/setLayout are controlled from ScreenPage's persistent selector (see
  // toolbar row below) so it drives the ALREADY-MOUNTED grid live, not just the
  // initial panel count; hideLayoutSelector skips MultiChartPage's own 2/3/4
  // icons since the persistent selector already covers that.
  if (multiOn)
    return (
      <div key="Multi" className="flex-1 min-h-0 flex flex-col animate-tab-in">
        <Suspense fallback={<TabSpinner />}>
          <MultiChartPage layout={multiLayout} setLayout={setMultiLayout} hideLayoutSelector />
        </Suspense>
      </div>
    )

  // General — chart + collapsible panels
  return (
    <>
      <div className="flex-1 flex overflow-hidden min-h-0 animate-tab-in">
        {/* Left panel — collapsible */}
        {!compact && (
          <div
            data-side="left"
            className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative group
                        bg-white dark:bg-gray-900
                        shadow-[1px_0_0_rgba(255,255,255,0.18),2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[1px_0_0_rgba(255,255,255,0.07),2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-300 ease-luxury
                        ${leftOpen ? 'w-[13%] min-w-[150px] max-w-[200px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'}
                        ${!leftOpen ? 'screen-panel-collapsed' : ''}
                        ${accent ? tierRingClass(displayTier) : ''}`}
          >
            <TierAccentOverlay accent={accent} radius="" />
            <div className="screen-panel-content flex flex-col h-full">
              <LeftPanel />
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <button
            onClick={toggleLeft}
            title={leftOpen ? 'Hide left panel' : 'Show left panel'}
            aria-label={leftOpen ? 'Hide left panel' : 'Show left panel'}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-30
                       h-12 w-4 items-center justify-center
                       bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                       border-y border-r border-gray-200/60 dark:border-gray-700/50
                       rounded-r-lg shadow-sm text-gray-400 dark:text-gray-500
                       hover:bg-white dark:hover:bg-gray-700
                       hover:text-blue-500 dark:hover:text-blue-400
                       transition-all duration-200 ease-luxury"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-300 ease-luxury ${leftOpen ? '' : 'rotate-180'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            onClick={toggleRight}
            title={rightOpen ? 'Hide right panel' : 'Show right panel'}
            aria-label={rightOpen ? 'Hide right panel' : 'Show right panel'}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-30
                       h-12 w-4 items-center justify-center
                       bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                       border-y border-l border-gray-200/60 dark:border-gray-700/50
                       rounded-l-lg shadow-sm text-gray-400 dark:text-gray-500
                       hover:bg-white dark:hover:bg-gray-700
                       hover:text-blue-500 dark:hover:text-blue-400
                       transition-all duration-200 ease-luxury"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-300 ease-luxury ${rightOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <ErrorBoundary label="Chart">
            <StockChart />
          </ErrorBoundary>
        </div>

        {/* Right panel — collapsible */}
        {!compact && (
          <div
            data-side="right"
            className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative group
                        bg-white dark:bg-gray-900
                        shadow-[-1px_0_0_rgba(255,255,255,0.18),-2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[-1px_0_0_rgba(255,255,255,0.07),-2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-300 ease-luxury
                        ${rightOpen ? 'w-[20%] min-w-[220px] max-w-[300px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'}
                        ${!rightOpen ? 'screen-panel-collapsed' : ''}
                        ${accent ? tierRingClass(displayTier) : ''}`}
          >
            <TierAccentOverlay accent={accent} radius="" />
            <div className="screen-panel-content flex flex-col h-full">
              <RightPanel />
            </div>
          </div>
        )}
      </div>

      {compact && <MobileBottomNav panel={mobilePanel} setPanel={setMobilePanel} />}
      {compact && <MobileSheet panel={mobilePanel} onClose={() => setMobilePanel(null)} />}
    </>
  )
}

// ── Advanced mode content ────────────────────────────────────────────────────

function AdvancedContent({ activeTab }) {
  const { user } = useAuth()
  // Backtesting tab — includes both Live Backtest and Replay (SCR-10, Wave 5: Replay
  // merged into this tab as an internal mode toggle, see BacktestPage.jsx's `mode`
  // state). One gate covers both modes since they were always gated identically.
  if (activeTab === 'Backtesting')
    return user?.tier === 'basic' && !user?.is_admin ? (
      <UpgradePrompt feature="Backtesting" />
    ) : (
      <Suspense fallback={<TabSpinner />}>
        <ErrorBoundary label="Backtesting">
          <BacktestPage />
        </ErrorBoundary>
      </Suspense>
    )
  if (activeTab === 'StrategyLab')
    return <ComingSoon compact label="Strategy Lab — automated strategy testing" />
  return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
      {activeTab} — coming soon
    </div>
  )
}

// ── Mobile bottom navigation ─────────────────────────────────────────────────

function MobileBottomNav({ panel, setPanel }) {
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const tabs = [
    {
      id: null,
      label: 'Chart',
      icon: (
        <svg
          className="w-[22px] h-[22px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      id: 'positions',
      label: 'Positions',
      icon: (
        <svg
          className="w-[22px] h-[22px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
        <svg
          className="w-[22px] h-[22px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
  ]
  return (
    <div
      className="lg:hidden shrink-0 flex border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((t) => {
        const active = t.id === null ? panel === null : panel === t.id
        return (
          <button
            key={String(t.id)}
            onClick={() => setPanel(t.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              active
                ? TIER_TEXT[displayTier] || 'text-blue-600 dark:text-blue-400'
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
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!panel) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.[0]?.focus()

    const trapFocus = (event) => {
      if (event.key !== 'Tab' || !focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog?.addEventListener('keydown', trapFocus)
    return () => {
      dialog?.removeEventListener('keydown', trapFocus)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [panel])

  if (!panel) return null
  const title = panel === 'positions' ? 'Positions & Watchlist' : 'Market & Movers'

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="screen-mobile-sheet-title"
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col group relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl ${accent ? '' : 'border-t border-gray-200 dark:border-gray-800'} ${accent ? tierRingClass(displayTier) : ''}`}
        style={{ height: '68vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <TierAccentOverlay accent={accent} />
        <div className="shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
          <span
            id="screen-mobile-sheet-title"
            className="text-[13px] font-bold text-gray-800 dark:text-gray-100"
          >
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 text-[12px] transition-colors"
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
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const { containerRef, indicatorStyle, onPointerDown } = useSlidingIndicator(active, onChange)
  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      className="relative flex items-center bg-gray-100/80 dark:bg-gray-800/80 rounded-lg p-0.5 gap-0.5"
    >
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 rounded-md bg-white dark:bg-gray-700 shadow-sm transition-[transform,width,height] duration-300 ease-luxury pointer-events-none"
        style={indicatorStyle}
      />
      {tabs.map((t) => {
        const locked = lockedIds.includes(t.id)
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            data-indicator-active={isActive || undefined}
            data-indicator-key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative z-10 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors whitespace-nowrap ${
              isActive
                ? TIER_TEXT[displayTier] || 'text-gray-900 dark:text-white'
                : locked
                  ? 'text-gray-300 dark:text-gray-600 cursor-pointer'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
            {locked && (
              <svg
                width="7"
                height="7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-40"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
  const [mode, setMode] = useState(() => {
    const stored = sessionStorage.getItem('tradeo_screen_mode')
    return stored === 'advanced' ? 'advanced' : 'simple'
  })
  const [simpleTab, setSimpleTab] = useState(() => {
    const stored = sessionStorage.getItem('tradeo_screen_simpleTab')
    return SIMPLE_TABS.some((t) => t.id === stored) ? stored : 'General'
  })
  const [advancedTab, setAdvancedTab] = useState(() => {
    const stored = sessionStorage.getItem('tradeo_screen_advancedTab')
    return ADVANCED_TABS.some((t) => t.id === stored) ? stored : 'Backtesting'
  })
  const [mobilePanel, setMobilePanel] = useState(null)
  const [leftOpen, setLeftOpen] = useLocalStorage('tradeo_screen_leftOpen', true)
  const [rightOpen, setRightOpen] = useLocalStorage('tradeo_screen_rightOpen', true)
  // Multi (formerly the MultiChart tab) — merged into General as a permanent
  // 1/2/3/4 layout selector in the toolbar (see below). No persistence (resets to
  // off / layout 2 on reload), same as mobilePanel.
  const [multiOn, setMultiOn] = useState(false)
  const [multiLayout, setMultiLayout] = useState(2)
  const toolbarSlotRef = useRef(null)
  const { user, loading: authLoading } = useAuth()

  const toggleLeft = () => setLeftOpen((v) => !v)
  const toggleRight = () => setRightOpen((v) => !v)

  // No explicit collapse/restore of leftOpen/rightOpen needed for Multi mode:
  // SimpleContent's `multiOn` branch already skips rendering LeftPanel/RightPanel
  // entirely (full-width grid), regardless of what leftOpen/rightOpen are set to —
  // so there's nothing to force-collapse and nothing to restore. (An earlier version
  // of this DID force them via setLeftOpen/setRightOpen, which are localStorage-
  // backed — that created a real bug: reloading mid-Multi-mode left the panels
  // permanently collapsed in normal view after Multi's own state reset to off on
  // reload, with no restore trigger. Leaving leftOpen/rightOpen untouched avoids
  // that entirely.)

  // Opt into navbar auto-hide — activates on mount, restores on unmount
  useNavbarAutoHide()
  const { active: navAutoHide, hidden: navHidden, scheduleHide, showNavbar } = useNavbarState()

  // Locked tabs stay clickable for guests — the content area renders AuthWall,
  // which is the feedback for why the feature is unavailable. A silent no-op
  // click reads as a broken button.
  const handleMode = (m) => {
    setMode(m)
    sessionStorage.setItem('tradeo_screen_mode', m)
  }
  const handleSimpleTab = (t) => {
    setSimpleTab(t)
    sessionStorage.setItem('tradeo_screen_simpleTab', t)
  }
  const handleAdvancedTab = (t) => {
    setAdvancedTab(t)
    sessionStorage.setItem('tradeo_screen_advancedTab', t)
  }

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') setMobilePanel(null)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const isSimple = mode === 'simple'

  // Whole shell is skeleton while /api/auth/me resolves — gating only the content
  // body would leave the real tab labels (Simple/Advanced/SMC…) + market badge text
  // visible above the skeleton on reload. Shaped like Screen's own toolbar +
  // left/chart/right dock layout (not the generic cross-page PageSkeleton) so
  // there's no shape change once the real shell mounts underneath.
  if (authLoading) {
    return (
      <div
        className="flex flex-col overflow-hidden bg-white dark:bg-gray-900 animate-pulse"
        style={{ height: '100dvh' }}
        aria-hidden="true"
      >
        <div className="w-full max-w-[1800px] mx-auto flex-1 min-h-0 flex flex-col">
          <div className="flex flex-row items-center gap-1.5 lg:gap-2 px-3 py-1 border-b border-gray-100 dark:border-gray-800/80 shrink-0">
            <div className="h-6 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0" />
            <div className="w-px h-5 bg-gray-100 dark:bg-gray-800 shrink-0" />
            <div className="hidden sm:block h-6 w-56 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0" />
            <div className="hidden lg:block w-px h-5 bg-gray-100 dark:bg-gray-800 shrink-0" />
            <div className="flex-1" />
            <div className="hidden lg:block h-5 w-24 bg-gray-100 dark:bg-gray-800 rounded-full shrink-0" />
          </div>
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div className="hidden lg:block w-[13%] min-w-[150px] max-w-[200px] shrink-0 bg-gray-50 dark:bg-gray-800/40 border-r border-gray-100 dark:border-gray-800" />
            <div className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-800/40 m-3 rounded-xl" />
            <div className="hidden lg:block w-[16%] min-w-[170px] max-w-[240px] shrink-0 bg-gray-50 dark:bg-gray-800/40 border-l border-gray-100 dark:border-gray-800" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <ScreenToolbarSlotCtx.Provider value={toolbarSlotRef}>
      <div
        className="flex flex-col overflow-hidden bg-white dark:bg-gray-900"
        style={{
          height: '100dvh',
          paddingTop: navAutoHide && !navHidden ? 56 : 0,
          // Match the navbar's slide (duration-300 ease-in-out) so content
          // reflows with it instead of jumping 56px in one frame
          transition: 'padding-top 300ms ease-in-out',
        }}
      >
        {/* Content cap — matches every other page's max-w-[1800px] convention
            (owner call: consistent even on this workspace-style page). The
            collapsible side panels are already self-capped via their own
            max-w-200px/240px, so this only bounds how wide the chart canvas
            stretches on 27"+ monitors; toolbar and content stay aligned since
            both live inside this same wrapper. */}
        <div className="w-full max-w-[1800px] mx-auto flex-1 min-h-0 flex flex-col">
        {/* ── Toolbar strip ── */}
        {/* Single row at every breakpoint: [tabs (scroll) | divider | sub-tabs |
          divider | slot | badge]. On mobile the chart toolbar is compact
          (search + menu only — see StockChart compactToolbar), so it fits on the
          same line as the tabs. The tab group scrolls horizontally if it
          overflows; the toolbar slot stays OUTSIDE that scroll container. */}
        <div
          className="flex flex-row items-center gap-1.5 lg:gap-2 px-3 py-1 border-b border-gray-100 dark:border-gray-800/80 shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
          onMouseEnter={showNavbar}
        >
          {/* Tab strips (+ mobile market dot) — scrolls horizontally if it
            overflows so it never pushes the toolbar slot off-screen. */}
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar lg:overflow-visible">
            <TabStrip
              tabs={[
                { id: 'simple', label: 'Simple', short: 'Sim' },
                { id: 'advanced', label: 'Advanced', short: 'Adv' },
              ]}
              active={mode}
              onChange={handleMode}
              lockedIds={!user ? ['advanced'] : []}
            />

            <div className="w-px h-5 bg-gray-300/80 dark:bg-gray-600/70 shrink-0 mx-0.5" />

            <div className="shrink-0">
              {isSimple ? (
                <TabStrip
                  tabs={SIMPLE_TABS}
                  active={simpleTab}
                  onChange={handleSimpleTab}
                  lockedIds={!user ? ['SMC', 'PriceAction'] : []}
                />
              ) : (
                <TabStrip tabs={ADVANCED_TABS} active={advancedTab} onChange={handleAdvancedTab} />
              )}
            </div>
          </div>

          <div className="hidden lg:block w-px h-5 bg-gray-300/80 dark:bg-gray-600/70 shrink-0 mx-0.5" />

          {/* Toolbar slot row — flex-1 so it takes the remaining width and scrolls
            horizontally when a tab's toolbar is wide (SMC/PA inject many controls
            here). The portal target (toolbarSlotRef) and the persistent layout
            selector are BOTH plain (non-flex-1) children inside this shared row, so
            the selector sits flush after whatever gets portalled in instead of being
            pushed to the far right by a second flex-1 element with dead space
            between them. */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
            <div ref={toolbarSlotRef} className="flex items-center gap-1.5 shrink-0" />

            {/* Persistent layout selector — merged from the old MultiChart tab.
              Placed right after the portalled controls (search/candlestick-line/
              timeframe/indicators) per owner placement call, not mixed into the
              tab-strip group. "1" = normal single-chart General, "2/3/4" =
              MultiChart's grid at that panel count. Selecting 2/3/4 while already in
              multi mode changes the live grid immediately (layout is controlled from
              here, passed into MultiChartPage — see SimpleContent). Shares the exact
              icon glyphs MultiChartPage's own selector used, now lifted to
              ScreenToolbarAtoms so both can use it. Only meaningful on General. */}
            {isSimple && simpleTab === 'General' && (
              <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
                {[1, 2, 3, 4].map((n) => {
                  const active = n === 1 ? !multiOn : multiOn && multiLayout === n
                  const locked = n > 1 && !user
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        if (n === 1) setMultiOn(false)
                        else {
                          setMultiLayout(n)
                          setMultiOn(true)
                        }
                      }}
                      aria-pressed={active}
                      title={n === 1 ? 'General' : locked ? 'MultiChart — sign in to use' : 'MultiChart'}
                      className={`relative flex items-center justify-center w-7 h-5 rounded transition-all ${
                        active
                          ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      <LayoutIcon layout={n} />
                      {locked && (
                        <svg
                          width="6"
                          height="6"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="absolute -top-0.5 -right-0.5 opacity-60"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="hidden lg:block">
            <MarketStatusBadge />
          </div>
        </div>

        {/* ── Content ── */}
        <div
          className="flex-1 overflow-hidden min-h-0 flex flex-col"
          onMouseEnter={navHidden ? undefined : scheduleHide}
        >
          {isSimple ? (
            !user && (simpleTab !== 'General' || multiOn) ? (
              <AuthWall
                feature={
                  simpleTab !== 'General'
                    ? SIMPLE_TABS.find((t) => t.id === simpleTab)?.label || simpleTab
                    : 'MultiChart'
                }
              />
            ) : (
              <SimpleContent
                activeTab={simpleTab}
                multiOn={multiOn}
                multiLayout={multiLayout}
                setMultiLayout={setMultiLayout}
                mobilePanel={mobilePanel}
                setMobilePanel={setMobilePanel}
                leftOpen={leftOpen}
                toggleLeft={toggleLeft}
                rightOpen={rightOpen}
                toggleRight={toggleRight}
              />
            )
          ) : !user ? (
            <AuthWall feature="Advanced mode" />
          ) : (
            <AdvancedTabProvider>
              <AdvancedContent activeTab={advancedTab} />
            </AdvancedTabProvider>
          )}
        </div>
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
