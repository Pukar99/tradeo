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
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Please login to view your portfolio
        </p>
        <Link to="/login" className="text-blue-600 hover:underline">
          Go to Login
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-gray-500 dark:text-gray-400">
          Loading portfolio...
        </p>
      </div>
    )
  }

  const buys = trades.filter(t => t.type === 'BUY')
  const sells = trades.filter(t => t.type === 'SELL')
  const totalInvested = buys.reduce((sum, t) => sum + t.total, 0)
  const winRate = sells.length > 0
    ? Math.round(
        (sells.filter(t => {
          const matchBuy = buys.find(b => b.symbol === t.symbol)
          return matchBuy ? t.price > matchBuy.price : false
        }).length / sells.length) * 100
      )
    : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        My Portfolio
      </h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Portfolio Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Investor
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {user.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Holdings
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {portfolio.length} stocks
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Trades
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {trades.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Invested
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Rs. {totalInvested.toLocaleString()}
              </span>
            </div>
            {winRate !== null && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Win Rate
                </span>
                <span className={`text-sm font-medium ${
                  winRate >= 50 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {winRate}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            My Holdings
          </h3>
          {portfolio.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              No holdings yet
            </p>
          ) : (
            <div className="space-y-2">
              {portfolio.map(holding => (
                <div
                  key={holding.id}
                  className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700"
                >
                  <div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {holding.symbol}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {holding.quantity} shares
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    @ Rs.{holding.avg_price}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Recent Trades
        </h3>
        {trades.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No trades yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 10).map(trade => (
                  <tr
                    key={trade.id}
                    className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {trade.date}
                    </td>
                    <td className="py-2 text-sm font-semibold text-gray-900 dark:text-white">
                      {trade.symbol}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        trade.type === 'BUY'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-500'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-2 text-sm text-right text-gray-600 dark:text-gray-300">
                      {trade.quantity}
                    </td>
                    <td className="py-2 text-sm text-right text-gray-600 dark:text-gray-300">
                      Rs.{trade.price.toLocaleString()}
                    </td>
                    <td className="py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                      Rs.{trade.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default PortfolioPage