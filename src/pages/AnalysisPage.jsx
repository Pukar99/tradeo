import TopMovers from '../components/TopMovers'
import NEPSEChart from '../components/NEPSEChart'

function AnalysisPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">NEPSE Analysis</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">Market data, movers & technical overview</p>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">NEPSE Index</p>
        </div>
        <div className="p-4">
          <NEPSEChart />
        </div>
      </div>

      {/* Top Movers */}
      <TopMovers />

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href="https://nepsealpha.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-4 hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">Technical Charts</p>
            <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <p className="text-[10px] text-gray-400">Interactive charts on nepsealpha.com</p>
        </a>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">Market Breadth</p>
            <span className="text-[9px] text-gray-300 dark:text-gray-700 font-medium uppercase tracking-wide">Soon</span>
          </div>
          <p className="text-[10px] text-gray-400">Advances vs declines breakdown</p>
        </div>
      </div>

    </div>
  )
}

export default AnalysisPage
