import { useState, Suspense, lazy } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'

const IPOPage      = lazy(() => import('./IPOPage'))
const ResearchPage = lazy(() => import('./ResearchPage'))

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
    id:      'aisignal',
    label:   'AI Signal',
    coming:  true,
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
]

// ── Loading fallback ──────────────────────────────────────────────────────────
function TabLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Coming soon placeholder ───────────────────────────────────────────────────
function ComingSoon({ label, desc }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
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

// ── Tab content ───────────────────────────────────────────────────────────────
function TabContent({ activeTab }) {
  const tab = TABS.find(t => t.id === activeTab)

  if (tab?.coming) return <ComingSoon label={tab.label} desc={tab.desc} />

  if (activeTab === 'ipo') return (
    <ErrorBoundary label="IPO">
      <Suspense fallback={<TabLoader />}>
        <IPOPage />
      </Suspense>
    </ErrorBoundary>
  )

  if (activeTab === 'sharemy') return (
    <ErrorBoundary label="ShareMy">
      <Suspense fallback={<TabLoader />}>
        <ResearchPage />
      </Suspense>
    </ErrorBoundary>
  )

  return null
}

// ── ExplorePage ───────────────────────────────────────────────────────────────
export default function ExplorePage() {
  const { tab: urlTab } = useParams()
  const navigate        = useNavigate()

  const [activeTab, setActiveTab] = useState(
    () => TABS.find(t => t.id === urlTab)?.id || 'ipo'
  )

  function handleTab(id) {
    setActiveTab(id)
    navigate(`/explore/${id}`, { replace: true })
  }

  const active = TABS.find(t => t.id === activeTab)

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ── Tab bar ── */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
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

        {/* Active tab description */}
        {active?.desc && (
          <span className="ml-3 text-[10px] text-gray-400 dark:text-gray-500 hidden md:block truncate">
            {active.desc}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden min-h-0">
        <TabContent activeTab={activeTab} />
      </div>
    </div>
  )
}
