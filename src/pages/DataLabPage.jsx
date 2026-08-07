// === DataLabPage.jsx — DataLab page: Performance / Insight / Breakdown tabs, toolbar slot portal, auth gating, navbar auto-hide ===
import {
  useState,
  Suspense,
  lazy,
  createContext,
  useContext,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react'
import { useNavbarAutoHide, useNavbarState } from '../App'
import { createPortal } from 'react-dom'
import { ComplexTabProvider } from '../hooks/useComplexTab.jsx'
import ErrorBoundary from '../components/ErrorBoundary'
import UpgradePrompt from '../components/UpgradePrompt'
import AuthWall from '../components/AuthWall'
import PageSkeleton from '../components/PageSkeleton'
import ComingSoon from '../components/ComingSoon'
import { useAuth } from '../context/AuthContext'
import { safeSessionGet, safeSessionSet } from '../utils/safeSession'
import { DataLabControlsProvider } from '../components/datalab/DataLabControls'
import { TIER_TEXT, getDisplayTier } from '../components/common/TierMaterial'

// ── Toolbar slot — portal approach ────────────────────────────────────────────
// Parent passes a ref to the slot DOM node via context.
// Child calls useToolbarSlot(node) which portals JSX into that DOM node.
// Child owns its own state — always fresh, no sync, no loops.

const ToolbarSlotCtx = createContext(null)

export function useToolbarSlot(node) {
  const slotRef = useContext(ToolbarSlotCtx)
  // useLayoutEffect fires synchronously after DOM commit — slotRef.current is
  // guaranteed populated before paint, preventing blank toolbar on re-renders.
  const [, setTick] = useState(0)
  useLayoutEffect(() => {
    setTick((t) => t + 1)
  }, [])

  if (!slotRef?.current) return null
  return createPortal(node, slotRef.current)
}

// ── Lazy tab components ───────────────────────────────────────────────────────

const InsightPage = lazy(() => import('../components/complex/InsightPage'))
const BreakdownPage = lazy(() => import('../components/complex/BreakdownPage'))

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  {
    id: 'performance',
    label: 'Performance',
    icon: (
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    hint: 'New Performance experience — coming soon',
    steps: [
      'This tab is being redesigned',
      "Stock-vs-NEPSE cycle comparison moved to Breakdown → Compare",
      'Use the Compare toggle in the center card',
    ],
  },
  {
    id: 'insight',
    label: 'Insight',
    icon: (
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    hint: 'Monthly return heatmap & seasonality',
    steps: [
      'Pick an index from the left panel (NEPSE, Banking, etc.)',
      "Click any heatmap cell to see that month's detail chart",
      'Click a month name to profile it across all years',
      'Weighted Avg row shows the historically strongest months',
      'Use ← → arrow keys to navigate months in the detail view',
    ],
  },
  {
    id: 'breakdown',
    label: 'Breakdown',
    icon: (
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    hint: 'Sector drawdown & cycle analysis',
    steps: [
      'Click a shaded zone on the overview chart to select a cycle',
      'Or pick a cycle from the left sidebar list',
      'Click a sector row to see how it moved vs the index',
      'Click a stock inside the sector to chart its price action',
    ],
  },
]

// ── Info button ───────────────────────────────────────────────────────────────

function InfoButton({ tab }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)

  function updateRect() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
  }

  // Outside-click handler — close only when the click is outside BOTH the trigger
  // button and the dropdown panel. Without checking the dropdown, any click on
  // its contents (future links/buttons) would dismiss it.
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (btnRef.current?.contains(e.target)) return
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    // Escape key also closes
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reposition the popover/tooltip when the page scrolls or window resizes.
  // Without this, fixed-position floaters stay glued to the original button rect.
  useEffect(() => {
    if (!open && !hovered) return
    function reposition() {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    }
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true) // capture for nested scrollers
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, hovered])

  useEffect(() => {
    setOpen(false)
  }, [tab?.id])

  if (!tab) return null

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-label={`${tab.label} tab — show help`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          updateRect()
          setOpen((o) => !o)
        }}
        onMouseEnter={() => {
          updateRect()
          setHovered(true)
        }}
        onMouseLeave={() => setHovered(false)}
        className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold italic transition-all border ${
          open
            ? 'bg-blue-500 border-blue-500 text-white'
            : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400'
        }`}
      >
        i
      </button>

      {hovered && !open && rect && (
        <div
          className="fixed z-[999] pointer-events-none px-2.5 py-1 rounded-full bg-gray-800 dark:bg-gray-700 text-gray-200 text-[10px] whitespace-nowrap shadow-md"
          style={{ top: rect.bottom + 5, right: window.innerWidth - rect.right }}
        >
          {tab.hint}
        </div>
      )}

      {open && rect && (
        <div
          ref={dropdownRef}
          role="dialog"
          aria-label={`${tab.label} help`}
          className="fixed z-[999] w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
          style={{ top: rect.bottom + 5, right: window.innerWidth - rect.right }}
        >
          <div className="pt-3 pb-1 px-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">
              {tab.label}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tab.hint}</p>
          </div>
          <ul className="px-4 pb-3 pt-2 space-y-2">
            {tab.steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 border-l-2 border-gray-100 dark:border-gray-800 pl-2.5"
              >
                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-snug">
                  {step}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Loading fallback ──────────────────────────────────────────────────────────

// Content-shaped skeleton for lazy-tab load — mirrors the tab's layout (cards +
// chart panel + rows) so it matches content size instead of a floating spinner
// (design.md §3: skeletons for in-page loading).
function TabLoader() {
  return <PageSkeleton variant="tab" />
}

// ── Tab content ───────────────────────────────────────────────────────────────

function TabContent({ activeTab }) {
  const { user } = useAuth()
  // Auth-resolve is handled by the page-level skeleton gate; here `loading` is false.
  if (!user) return <AuthWall subtitle="Sign in to access Data Lab analytics" />

  if (activeTab === 'performance')
    return (
      <ComingSoon
        label="Performance"
        desc="Being redesigned — cycle comparison now lives in Breakdown's Compare view."
      />
    )

  if (activeTab === 'insight')
    return user.tier === 'basic' && !user?.is_admin ? (
      <UpgradePrompt feature="Insight" />
    ) : (
      <ComplexTabProvider>
        <ErrorBoundary label="Insight">
          <Suspense fallback={<TabLoader />}>
            <InsightPage />
          </Suspense>
        </ErrorBoundary>
      </ComplexTabProvider>
    )

  if (activeTab === 'breakdown')
    return user.tier === 'basic' && !user?.is_admin ? (
      <UpgradePrompt feature="Breakdown" />
    ) : (
      <ComplexTabProvider>
        <ErrorBoundary label="Breakdown">
          <Suspense fallback={<TabLoader />}>
            <BreakdownPage />
          </Suspense>
        </ErrorBoundary>
      </ComplexTabProvider>
    )

  return null
}

// ── DataLabPage ───────────────────────────────────────────────────────────────

// Safe sessionStorage access moved to utils/safeSession (S1) — re-exported here
// because the tab components historically import it from this page.
export { safeSessionGet, safeSessionSet } from '../utils/safeSession'

export default function DataLabPage() {
  const [activeTab, setActiveTab] = useState(() =>
    // Default = Breakdown (the flagship tab). 'performance' is a ComingSoon stub
    // since 2026-07-08 — defaulting there made the page open on an empty toolbar.
    safeSessionGet('tradeo_datalab_tab', 'breakdown')
  )
  const slotRef = useRef(null)
  const { user, loading: authLoading } = useAuth()
  const displayTier = getDisplayTier(user)

  // Opt into navbar auto-hide — activates on mount, restores on unmount
  useNavbarAutoHide()
  const { active: navAutoHide, hidden: navHidden, scheduleHide, showNavbar } = useNavbarState()

  function handleTab(id) {
    setActiveTab(id)
    safeSessionSet('tradeo_datalab_tab', id)
  }

  // Whole shell is skeleton while /api/auth/me resolves — gating only the content
  // body would leave the real tab labels visible above the skeleton on reload.
  // Shaped like DataLab's own toolbar (chips + slot + info button), and reuses
  // PageSkeleton's "tab" variant for the body since that's already the same
  // shape TabLoader shows once a tab's lazy chunk is loading — no shape change
  // on handoff either way.
  if (authLoading) {
    return (
      <div
        className="flex flex-col overflow-hidden bg-white dark:bg-gray-900 animate-pulse"
        style={{ height: '100dvh' }}
        aria-hidden="true"
      >
        <div className="w-full max-w-[1800px] mx-auto flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-gray-200 dark:border-gray-800">
            <div className="h-6 w-52 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0" />
            <div className="w-px h-4 bg-gray-100 dark:bg-gray-800 shrink-0" />
            <div className="flex-1" />
            <div className="h-5 w-5 bg-gray-100 dark:bg-gray-800 rounded-full shrink-0" />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <PageSkeleton variant="tab" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <ToolbarSlotCtx.Provider value={slotRef}>
      <DataLabControlsProvider>
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
            (owner call: consistent even on this workspace-style page). Toolbar
            and content stay aligned since both live inside this same wrapper. */}
        <div className="w-full max-w-[1800px] mx-auto flex-1 min-h-0 flex flex-col">
        {/* ── Tab bar + inline toolbar ──
            Strategy: ONLY the slot scrolls horizontally. The outer row is a
            simple flex with hard shrink-0 on the chips and info button so they
            never compress. Mobile (< 480px) scrolls the slot horizontally,
            which is exactly where the user expects it.       */}
        {/* Toolbar strip — onMouseEnter as fast path; global mousemove listener
            in App.jsx handles portalled controls (portal breaks React bubbling) */}
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
          onMouseEnter={showNavbar}
        >
          {/* Compact tab chips — never compress */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTab(tab.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? `bg-white dark:bg-gray-700 shadow-sm ${TIER_TEXT[displayTier] || 'text-gray-900 dark:text-white'}`
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {!user && (
                    <svg
                      width="8"
                      height="8"
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

          {/* Divider — never compress */}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Slot — single source of horizontal overflow.
              `overscroll-x-contain` prevents the swipe from leaking to the page.
              Scrollbar is hidden app-wide (index.css global rule). */}
          <div
            ref={slotRef}
            className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto overscroll-x-contain"
          />

          {/* Info button — never compress */}
          <InfoButton tab={TABS.find((t) => t.id === activeTab)} />
        </div>

        {/* ── Content — mouse entering chart area triggers navbar hide ──
            MUST be a flex container: Insight/Breakdown roots use `flex-1 min-h-0`,
            which is inert in a block parent — the page then grows to content
            height, the ancestor clips it, and every inner scroll panel dies. */}
        <div
          className="flex-1 overflow-hidden min-h-0 flex flex-col"
          onMouseEnter={navHidden ? undefined : scheduleHide}
        >
          <TabContent activeTab={activeTab} />
        </div>
        </div>
      </div>
      </DataLabControlsProvider>
    </ToolbarSlotCtx.Provider>
  )
}
