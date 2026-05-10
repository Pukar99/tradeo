import { useState, Suspense, lazy } from 'react'
import { ComplexTabProvider } from '../hooks/useComplexTab.jsx'
import ErrorBoundary from '../components/ErrorBoundary'

const PerformanceChart = lazy(() => import('../components/datalab/PerformanceChart'))
const InsightPage      = lazy(() => import('../components/complex/InsightPage'))
const BreakdownPage    = lazy(() => import('../components/complex/BreakdownPage'))

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  {
    id:    'performance',
    label: 'Performance',
    short: 'Perf',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    desc: 'Stock vs NEPSE return comparison with cycle detection',
  },
  {
    id:    'insight',
    label: 'Insight',
    short: 'Ins',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    desc: 'Monthly return heatmap and seasonality analysis',
  },
  {
    id:    'breakdown',
    label: 'Breakdown',
    short: 'Break',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    desc: 'Sector drawdown, recovery and cycle analysis',
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

// ── Tab content ───────────────────────────────────────────────────────────────

function TabContent({ activeTab }) {
  if (activeTab === 'performance') return (
    <ErrorBoundary label="Performance">
      <Suspense fallback={<TabLoader />}>
        <PerformanceChart />
      </Suspense>
    </ErrorBoundary>
  )

  if (activeTab === 'insight') return (
    <ComplexTabProvider>
      <ErrorBoundary label="Insight">
        <Suspense fallback={<TabLoader />}>
          <InsightPage />
        </Suspense>
      </ErrorBoundary>
    </ComplexTabProvider>
  )

  if (activeTab === 'breakdown') return (
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

export default function DataLabPage() {
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('datalab_tab') || 'performance'
  )

  function handleTab(id) {
    setActiveTab(id)
    sessionStorage.setItem('datalab_tab', id)
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.short}</span>
            </button>
          )
        })}

        {/* Active tab description */}
        {active?.desc && (
          <span className="ml-3 text-[10px] text-gray-400 dark:text-gray-500 hidden md:block">
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
