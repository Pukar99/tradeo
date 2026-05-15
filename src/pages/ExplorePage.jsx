import { useState, Suspense, lazy, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'

const IPOPage      = lazy(() => import('./IPOPage'))
const ResearchPage = lazy(() => import('./ResearchPage'))
const RiskLabPage  = lazy(() => import('./RiskLabPage'))

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  {
    id:    'ipo',
    label: 'IPO',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    desc: 'IPO applications, allotment results and Meroshare integration',
  },
  {
    id:     'aisignal',
    label:  'AI Signal',
    coming: true,
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    desc: 'AI-powered buy/sell signals across NEPSE stocks — coming soon',
  },
  {
    id:    'sharemy',
    label: 'ShareMy',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
    desc: 'Share and discover research posts from the community',
  },
  {
    id:    'risklab',
    label: 'Risk Lab',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-4m-6 0V3" />
      </svg>
    ),
    desc: 'NEPSE calculator, position sizing and SIP projections',
  },
]

const VALID_IDS = new Set(TABS.map(t => t.id))

// ── Coming soon placeholder ───────────────────────────────────────────────────
function ComingSoon({ label, desc }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-20">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{desc}</p>
      </div>
      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        Coming Soon
      </span>
    </div>
  )
}

// ── ExplorePage ───────────────────────────────────────────────────────────────
// Design decisions:
// - IPOPage and ResearchPage are NOT unmounted on tab switch — they stay mounted
//   and are hidden with CSS. This preserves Meroshare account state, fetched data,
//   and scroll position across tab switches.
// - Coming Soon tabs render inline (no lazy load needed).
// - URL stays in sync via navigate; browser back/forward updates activeTab via useEffect.

export default function ExplorePage() {
  const { tab: urlTab } = useParams()
  const navigate        = useNavigate()

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

  const active = TABS.find(t => t.id === activeTab)

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
    <div className="flex flex-col bg-white dark:bg-gray-950" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Tab bar — fixed height, never scrolls away ── */}
      <div className="shrink-0 flex items-center gap-1 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" style={{ height: 44 }}>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all relative ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.coming && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400 border border-white dark:border-gray-900" />
              )}
            </button>
          )
        })}

        {active?.desc && (
          <span className="ml-3 text-[10px] text-gray-400 dark:text-gray-500 hidden md:block truncate">
            {active.desc}
          </span>
        )}
      </div>

      {/* ── Content area — each real tab stays mounted, hidden when inactive ── */}
      <div className="flex-1 min-h-0 relative">

        {/* Coming Soon tabs — rendered inline, no mount/unmount issue */}
        {active?.coming && (
          <div className="absolute inset-0 overflow-auto">
            <ComingSoon label={active.label} desc={active.desc} />
          </div>
        )}

        {/* IPO tab — stays mounted once visited, hidden when not active */}
        {visited.has('ipo') && !TABS.find(t => t.id === 'ipo')?.coming && (
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{ display: activeTab === 'ipo' ? 'block' : 'none' }}
          >
            <ErrorBoundary label="IPO">
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <IPOPage />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {/* ShareMy tab — stays mounted once visited */}
        {visited.has('sharemy') && !TABS.find(t => t.id === 'sharemy')?.coming && (
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{ display: activeTab === 'sharemy' ? 'block' : 'none' }}
          >
            <ErrorBoundary label="ShareMy">
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <ResearchPage />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {/* Risk Lab tab — stays mounted once visited */}
        {visited.has('risklab') && !TABS.find(t => t.id === 'risklab')?.coming && (
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{ display: activeTab === 'risklab' ? 'block' : 'none' }}
          >
            <ErrorBoundary label="Risk Lab">
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <RiskLabPage />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  )
}
