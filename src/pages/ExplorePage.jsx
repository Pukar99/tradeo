import { useState, useEffect, useRef, Suspense, lazy, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'
import ComingSoon from '../components/ComingSoon'
import { useAuth } from '../context/AuthContext'

const IPOPage      = lazy(() => import('./IPOPage'))
const ResearchPage = lazy(() => import('./ResearchPage'))
const RiskLabPage  = lazy(() => import('./RiskLabPage'))

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
    id:    'ipo',
    label: 'IPO',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id:     'aisignal',
    label:  'AI Signal',
    coming: true,
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id:    'sharemy',
    label: 'ShareMy',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    id:    'risklab',
    label: 'Risk Lab',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-4m-6 0V3" />
      </svg>
    ),
  },
]

const VALID_IDS = new Set(TABS.map(t => t.id))
// Tabs that require login — risklab is public
const AUTH_REQUIRED_IDS = new Set(['ipo', 'aisignal', 'sharemy'])

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AuthWall({ feature }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 animate-fade-up">
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
  const navigate        = useNavigate()
  const slotRef         = useRef(null)
  const { user }        = useAuth()

  // Default to risklab for unauthenticated users if they land on a locked tab
  const resolveTab = (t) => {
    if (VALID_IDS.has(t)) {
      if (!user && AUTH_REQUIRED_IDS.has(t)) return 'risklab'
      return t
    }
    return 'ipo'
  }
  const [activeTab, setActiveTab] = useState(() => resolveTab(urlTab))

  // Sync activeTab when URL changes (browser back/forward)
  useEffect(() => {
    const resolved = resolveTab(urlTab)
    if (resolved !== activeTab) setActiveTab(resolved)
  }, [urlTab]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTab(id) {
    if (id === activeTab) return
    setActiveTab(id)
    navigate(`/explore/${id}`, { replace: true })
  }

  const isLocked = (id) => !user && AUTH_REQUIRED_IDS.has(id)

  const activeTabDef = TABS.find(t => t.id === activeTab)

  // Track which real tabs have been visited so we only lazy-load them once
  const [visited, setVisited] = useState(() => new Set([resolveTab(urlTab)]))
  useEffect(() => {
    setVisited(prev => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  return (
    <ExploreToolbarSlotCtx.Provider value={slotRef}>
      <div className="flex flex-col bg-white dark:bg-gray-950" style={{ height: 'calc(100dvh - 56px)' }}>

        {/* ── Tab bar ──
            Same structure as DataLabPage:
            [compact chip group] | [divider] | [slot flex-1]
            Only the slot overflows horizontally — tab chips never compress.    */}
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">

          {/* Compact tab chips — never compress */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap relative ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
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
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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
            className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full"
          />
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 min-h-0 relative">

          {/* Auth wall — shown when a locked tab is active and user is not logged in */}
          {isLocked(activeTab) && !activeTabDef?.coming && (
            <AuthWall feature={activeTabDef?.label || activeTab} />
          )}

          {/* Coming Soon tabs */}
          {activeTabDef?.coming && (
            <div className="absolute inset-0 overflow-auto">
              <ComingSoon label={activeTabDef.label} />
            </div>
          )}

          {/* IPO — only mount if logged in */}
          {visited.has('ipo') && !TABS.find(t => t.id === 'ipo')?.coming && user && (
            <div className="absolute inset-0 overflow-y-auto" style={{ display: activeTab === 'ipo' ? 'block' : 'none' }}>
              <ErrorBoundary label="IPO">
                <Suspense fallback={<TabSpinner />}>
                  <IPOPage isActive={activeTab === 'ipo'} />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* ShareMy — only mount if logged in */}
          {visited.has('sharemy') && !TABS.find(t => t.id === 'sharemy')?.coming && user && (
            <div className="absolute inset-0 overflow-y-auto" style={{ display: activeTab === 'sharemy' ? 'block' : 'none' }}>
              <ErrorBoundary label="ShareMy">
                <Suspense fallback={<TabSpinner />}>
                  <ResearchPage />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* Risk Lab — public, always available */}
          {visited.has('risklab') && !TABS.find(t => t.id === 'risklab')?.coming && (
            <div className="absolute inset-0 overflow-y-auto" style={{ display: activeTab === 'risklab' ? 'block' : 'none' }}>
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
