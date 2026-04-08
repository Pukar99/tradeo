import { useState, useEffect } from 'react'
import { getPortfolio, getTrades } from '../api'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

function PortfolioPage() {
  const [portfolio, setPortfolio] = useState([])
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [portfolioRes, tradesRes] = await Promise.all([
          getPortfolio(),
          getTrades()
        ])
        setPortfolio(portfolioRes.data)
        setTrades(tradesRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 text-center">
        <p className="text-gray-500 mb-4">Please login to view your portfolio</p>
        <Link to="/login" className="text-blue-600 hover:underline">
          Go to Login
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-gray-500">Loading portfolio...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        My Portfolio
      </h1>

      <div className="grid grid-cols-2 gap-4">

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Portfolio Summary</h3>
          <p className="text-sm text-gray-500 mt-1">Investor: {user.name}</p>
          <p className="text-sm text-gray-500">Holdings: {portfolio.length} stocks</p>
          <p className="text-sm text-gray-500">Total Trades: {trades.length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">My Holdings</h3>
          {portfolio.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No holdings yet</p>
          ) : (
            portfolio.map(holding => (
              <p key={holding.id} className="text-sm text-gray-500 mt-1">
                {holding.symbol} — {holding.quantity} shares @ NPR {holding.avg_price}
              </p>
            ))
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Trading Log</h3>
          {trades.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No trades yet</p>
          ) : (
            trades.slice(0, 3).map(trade => (
              <p key={trade.id} className="text-sm text-gray-500 mt-1">
                {trade.type} {trade.quantity} {trade.symbol} @ NPR {trade.price}
              </p>
            ))
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Win Rate</h3>
          <p className="text-sm text-gray-500 mt-2">
            Coming soon — requires sell trades
          </p>
        </div>

      </div>
    </div>
  )
}

export default PortfolioPage