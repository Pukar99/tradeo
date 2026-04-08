import TopMovers from '../components/TopMovers'
import NEPSEChart from '../components/NEPSEChart'

function AnalysisPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        NEPSE Analysis
      </h1>

      <NEPSEChart />

      <TopMovers />

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">
            Technical Chart
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            Visit nepsealpha.com for interactive charts
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">
            Market Breadth
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            How many stocks went up vs down — coming soon
          </p>
        </div>
      </div>
    </div>
  )
}

export default AnalysisPage