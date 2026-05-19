import { useState, useEffect, useRef, Suspense, lazy, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'
import ComingSoon from '../components/ComingSoon'

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

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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

  const resolveTab = (t) => VALID_IDS.has(t) ? t : 'ipo'
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
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.coming && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
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

        {/* ── Content area — each real tab stays mounted, hidden when inactive ── */}
        <div className="flex-1 min-h-0 relative">

          {/* Coming Soon tabs */}
          {activeTabDef?.coming && (
            <div className="absolute inset-0 overflow-auto">
              <ComingSoon label={activeTabDef.label} />
            </div>
          )}

          {/* IPO — stays mounted once visited */}
          {visited.has('ipo') && !TABS.find(t => t.id === 'ipo')?.coming && (
            <div className="absolute inset-0 overflow-y-auto" style={{ display: activeTab === 'ipo' ? 'block' : 'none' }}>
              <ErrorBoundary label="IPO">
                <Suspense fallback={<TabSpinner />}>
                  <IPOPage isActive={activeTab === 'ipo'} />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* ShareMy — stays mounted once visited */}
          {visited.has('sharemy') && !TABS.find(t => t.id === 'sharemy')?.coming && (
            <div className="absolute inset-0 overflow-y-auto" style={{ display: activeTab === 'sharemy' ? 'block' : 'none' }}>
              <ErrorBoundary label="ShareMy">
                <Suspense fallback={<TabSpinner />}>
                  <ResearchPage />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* Risk Lab — stays mounted once visited */}
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
