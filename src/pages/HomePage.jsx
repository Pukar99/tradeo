import { useState, useEffect } from 'react'
import { getStocks, getMarketSummary } from '../api'
import StockCard from '../components/StockCard'
import NEPSEIndex from '../components/NEPSEIndex'

function HomePage() {
  const [stocks, setStocks] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stocksRes, summaryRes] = await Promise.all([
          getStocks(),
          getMarketSummary()
        ])
        setStocks(stocksRes.data)
        setSummary(summaryRes.data)
      } catch (err) {
        setError('Failed to load market data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-gray-500">Loading market data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Welcome to Tradeo
      </h1>
      <NEPSEIndex />
      {summary && (
        <div className="bg-white rounded-xl p-4 shadow-sm mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            NEPSE Market Summary
          </h2>
          <p className="text-sm text-gray-600">Date: {summary.date}</p>
          <p className="text-sm text-gray-600">
            Total Turnover: {summary.totalTurnover.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            Total Traded Shares: {summary.totalTradedShares.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            Total Transactions: {summary.totalTransactions.toLocaleString()}
          </p>
        </div>
      )}
      <div className="flex justify-between items-center mb-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Top Stocks Today
        </h2>
        <span className="text-sm text-blue-600">View All →</span>
      </div>
      <div className="flex gap-4">
        {stocks.map(stock => (
          <StockCard
            key={stock.id}
            name={stock.name}
            symbol={stock.symbol}
            price={stock.price}
            change={stock.change}
            volume={stock.volume}
            sector={stock.sector}
          />
        ))}
      </div>
    </div>
  )
}

export default HomePage