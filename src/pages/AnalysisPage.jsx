function AnalysisPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        NEPSE Analysis
      </h1>

      <div className="grid grid-cols-2 gap-4 mt-6">

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Top Gainers</h3>
          <p className="text-sm text-gray-500 mt-2">
            Stocks with highest gains today — coming soon
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Top Losers</h3>
          <p className="text-sm text-gray-500 mt-2">
            Stocks with highest losses today — coming soon
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Technical Chart</h3>
          <p className="text-sm text-gray-500 mt-2">
            
              href="https://www.nepsealpha.com/trading/chart"
              target="_blank"
              rel="noopener"
              className="text-blue-600 hover:underline"
            >
              View Interactive Chart
            </a>
            {' '}— coming soon
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Market Breadth</h3>
          <p className="text-sm text-gray-500 mt-2">
            How many stocks went up vs down today — coming soon
          </p>
        </div>

      </div>
    </div>
  )
}

export default AnalysisPage