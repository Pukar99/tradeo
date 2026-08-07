// === ExplorePage.jsx — explore page: IPO / AI Signal / ShareMy / Risk Lab tabs, toolbar slot portal, CSS-preserve mount, auth gating ===
import { useState, useEffect, useRef, Suspense, lazy, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'
import ComingSoon from '../components/ComingSoon'
import AuthWall from '../components/AuthWall'
import PageSkeleton from '../components/PageSkeleton'
import { useAuth } from '../context/AuthContext'
import { TIER_TEXT, getDisplayTier } from '../components/common/TierMaterial'

const IPOPage = lazy(() => import('./IPOPage'))
const ResearchPage = lazy(() => import('./ResearchPage'))
const RiskLabPage = lazy(() => import('./RiskLabPage'))

// ── Toolbar slot ──────────────────────────────────────────────────────────────
// Parent holds a ref to a slot DOM node in the tab bar.
// Child calls useExploreToolbarSlot(jsx) to portal controls into it.
//
// Zero extra hooks — just useContext + createPortal.
// The slot <div ref> is rendered by ExplorePage before any Suspense child
// mounts, so slotRef.current is always populated by the time a child calls
// this hook. No tick/forceUpdate needed.
const ExploreToolbarSlotCtx = createContext(null)

export function useExploreToolbarSlot(node) {
  const slotRef = useContext(ExploreToolbarSlotCtx)
  if (!slotRef?.current) return null
  return createPortal(node, slotRef.current)
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  {
    id: 'ipo',
    label: 'IPO',
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
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'aisignal',
    label: 'AI Signal',
    coming: true,
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
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: 'sharemy',
    label: 'ShareMy',
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
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    id: 'risklab',
    label: 'Risk Lab',
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
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-4m-6 0V3" />
      </svg>
    ),
  },
]

const VALID_IDS = new Set(TABS.map((t) => t.id))
// Tabs that require login — risklab is public
const AUTH_REQUIRED_IDS = new Set(['ipo', 'aisignal', 'sharemy'])

// Content-shaped skeleton for lazy-tab load — fills the absolute inset-0 swap slot
// and mirrors the tab's layout (cards + panel + rows) so it matches content size,
// not a floating spinner (design.md §3: skeletons for in-page loading).
function TabSpinner() {
  return <PageSkeleton variant="tab" />
}

// ── ExplorePage ───────────────────────────────────────────────────────────────
// Design decisions:
// - IPOPage and ResearchPage are NOT unmounted on tab switch — they stay mounted
//   and hidden with CSS. This preserves Meroshare account state, fetched data,
//   and scroll position across tab switches.
// - Coming Soon tabs render inline (no lazy load needed).
// - URL stays in sync via navigate; browser back/forward updates activeTab.
// - Toolbar slot: tab content portals controls into the tab bar row via
//   useExploreToolbarSlot. Any future dropdown in the slot MUST use
//   useFixedDropdown from StockChart.jsx (Rule 59).

export default function ExplorePage() {
  const { tab: urlTab } = useParams()
  const navigate = useNavigate()
  const slotRef = useRef(null)
  const { user, loading: authLoading } = useAuth()
  const displayTier = getDisplayTier(user)

  // Default to risklab for unauthenticated users if they land on a locked tab
  // (the bare /explore fallback follows the same rule — ipo is auth-locked)
  const resolveTab = (t) => {
    if (VALID_IDS.has(t)) {
      if (!user && AUTH_REQUIRED_IDS.has(t)) return 'risklab'
      return t
    }
    return user ? 'ipo' : 'risklab'
  }
  const [activeTab, setActiveTab] = useState(() => resolveTab(urlTab))

  // Sync activeTab when URL changes (browser back/forward)
  useEffect(() => {
    const resolved = resolveTab(urlTab)
    if (resolved !== activeTab) setActiveTab(resolved)
  }, [urlTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-resolve once auth finishes resolving. The initial resolveTab() call above
  // can run while `user` is still null (authLoading true), silently downgrading
  // a logged-in user's deep link (e.g. /explore/ipo) to the guest-only 'risklab'
  // tab — and since the URL-sync effect above only watches `urlTab`, nothing
  // else ever corrects that stale guess once auth actually resolves.
  useEffect(() => {
    if (authLoading) return
    const resolved = resolveTab(urlTab)
    if (resolved !== activeTab) setActiveTab(resolved)
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTab(id) {
    if (id === activeTab) return
    setActiveTab(id)
    // Push (not replace) — each tab is a distinct URL, so back/forward should
    // move between tabs as the sync effect above expects.
    navigate(`/explore/${id}`)
  }

  const isLocked = (id) => !user && AUTH_REQUIRED_IDS.has(id)

  const activeTabDef = TABS.find((t) => t.id === activeTab)

  // Track which real tabs have been visited so we only lazy-load them once
  const [visited, setVisited] = useState(() => new Set([resolveTab(urlTab)]))
  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  // Whole shell is skeleton while /api/auth/me resolves — gating only the content
  // body would leave the real tab labels visible above the skeleton on reload,
  // and (per the re-sync effect above) would also flash the guest-locked tab
  // set for logged-in users before the correction kicks in. Shaped like
  // Explore's own toolbar (tab chips + slot), and reuses PageSkeleton's "tab"
  // variant for the body — the same shape TabSpinner already shows once a
  // tab's lazy chunk is loading, so there's no shape change on handoff.
  if (authLoading) {
    return (
      <div
        className="flex flex-col bg-white dark:bg-gray-950 animate-pulse"
        style={{ height: 'calc(100dvh - 56px)' }}
        aria-hidden="true"
      >
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="h-6 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0" />
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
          <div className="flex-1" />
        </div>
        <div className="flex-1 min-h-0">
          <PageSkeleton variant="tab" />
        </div>
      </div>
    )
  }

  return (
    <ExploreToolbarSlotCtx.Provider value={slotRef}>
      <div
        className="flex flex-col bg-white dark:bg-gray-950"
        style={{ height: 'calc(100dvh - 56px)' }}
      >
        {/* ── Tab bar ──
            Same structure as DataLabPage:
            [compact chip group] | [divider] | [slot flex-1]
            Only the slot overflows horizontally — tab chips never compress.    */}
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {/* Compact tab chips — never compress */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap relative ${
                  activeTab === tab.id
                    ? `bg-white dark:bg-gray-700 shadow-sm ${TIER_TEXT[displayTier] || 'text-gray-900 dark:text-white'}`
                    : isLocked(tab.id)
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.coming && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
                {isLocked(tab.id) && (
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
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Toolbar slot — tab content portals controls here.
              overflow-x-auto so injected controls scroll on narrow screens.
              Any dropdown inside MUST use useFixedDropdown (Rule 59).          */}
          <div
            ref={slotRef}
            className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto overscroll-x-contain"
          />
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 min-h-0 relative">
          {/* Auth wall — shown when a locked tab is active and user is not logged in */}
          {isLocked(activeTab) && !activeTabDef?.coming && (
            <AuthWall
              feature={activeTabDef?.label || activeTab}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 animate-fade-up"
            />
          )}

          {/* Coming Soon tabs */}
          {activeTabDef?.coming && (
            <div className="absolute inset-0 overflow-auto">
              <ComingSoon label={activeTabDef.label} />
            </div>
          )}

          {/* IPO — only mount if logged in */}
          {visited.has('ipo') && !TABS.find((t) => t.id === 'ipo')?.coming && user && (
            <div
              className="absolute inset-0 overflow-y-auto"
              style={{ display: activeTab === 'ipo' ? 'block' : 'none' }}
            >
              <ErrorBoundary label="IPO">
                <Suspense fallback={<TabSpinner />}>
                  <IPOPage isActive={activeTab === 'ipo'} />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* ShareMy — only mount if logged in */}
          {visited.has('sharemy') && !TABS.find((t) => t.id === 'sharemy')?.coming && user && (
            <div
              className="absolute inset-0 overflow-y-auto"
              style={{ display: activeTab === 'sharemy' ? 'block' : 'none' }}
            >
              <ErrorBoundary label="ShareMy">
                <Suspense fallback={<TabSpinner />}>
                  <ResearchPage />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* Risk Lab — public, always available */}
          {visited.has('risklab') && !TABS.find((t) => t.id === 'risklab')?.coming && (
            <div
              className="absolute inset-0 overflow-y-auto"
              style={{ display: activeTab === 'risklab' ? 'block' : 'none' }}
            >
              <ErrorBoundary label="Risk Lab">
                <Suspense fallback={<TabSpinner />}>
                  <RiskLabPage />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}
        </div>
      </div>
    </ExploreToolbarSlotCtx.Provider>
  )
}
