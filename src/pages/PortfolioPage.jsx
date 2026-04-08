function PortfolioPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        My Portfolio
      </h1>

      <div className="grid grid-cols-2 gap-4 mt-6">

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Portfolio Summary</h3>
          <p className="text-sm text-gray-500 mt-1">Investor: Pukar Sharma</p>
          <p className="text-sm text-gray-500">Total Value: NPR 1,000,000</p>
          <p className="text-sm text-green-500 font-medium">Total Gain: +5%</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">My Holdings</h3>
          <p className="text-sm text-gray-500 mt-1">NTC — 100 shares @ NPR 1,000</p>
          <p className="text-sm text-gray-500">NABIL — 50 shares @ NPR 1,500</p>
          <p className="text-sm text-gray-500">HDFC — 30 shares @ NPR 2,000</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Trading Log</h3>
          <p className="text-sm text-gray-500 mt-2">
            Record of your buy and sell history — coming soon
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Win Rate</h3>
          <p className="text-sm text-gray-500 mt-2">
            Percentage of your profitable trades — coming soon
          </p>
        </div>

      </div>
    </div>
  )
}

export default PortfolioPage