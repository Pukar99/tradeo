import { useState, useEffect } from 'react'
import { getTradeLog, getStockPrice } from '../api'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'

function PortfolioPage() {
  const [trades, setTrades] = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const tradesRes = await getTradeLog()
      const tradeData = tradesRes.data
      setTrades(tradeData)

      const open = tradeData.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')

      const openWithPrices = await Promise.all(
        open.map(async (t) => {
          try {
            const priceRes = await getStockPrice(t.symbol)
            const qty = t.remaining_quantity || t.quantity
            const ltp = priceRes.data.price
            const pnl = t.position === 'LONG'
              ? (ltp - t.entry_price) * qty
              : (t.entry_price - ltp) * qty
            return {
              ...t,
              currentPrice: ltp,
              change: priceRes.data.change,
              latestDate: priceRes.data.latestDate,
              unrealizedPnl: Math.round(pnl),
              pnlPct: ((pnl / (t.entry_price * qty)) * 100).toFixed(2)
            }
          } catch {
            return { ...t, currentPrice: null, unrealizedPnl: null }
          }
        })
      )

      setOpenPositions(openWithPrices)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading portfolio...</p>
          </div>
        </div>
      </div>
    )
  }

  const closedTrades = trades.filter(t => t.status === 'CLOSED')
  const allTrades = trades
  const totalInvested = openPositions.reduce((sum, t) => sum + (t.entry_price * (t.remaining_quantity || t.quantity)), 0)
  const totalUnrealized = openPositions.reduce((sum, t) => sum + (t.unrealizedPnl || 0), 0)
  const totalRealized = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0)
  const totalPnl = totalRealized + totalUnrealized
  const profitableTrades = closedTrades.filter(t => (t.realized_pnl || 0) > 0).length
  const winRate = closedTrades.length > 0
    ? Math.round((profitableTrades / closedTrades.length) * 100)
    : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Portfolio
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Overview of your positions and performance
          </p>
        </div>
        <button
          onClick={() => navigate('/trader')}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Add Trade
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total P&L',
            value: `${totalPnl >= 0 ? '+' : ''}Rs.${Math.abs(Math.round(totalPnl)).toLocaleString()}`,
            color: totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
          },
          {
            label: 'Realized P&L',
            value: `${totalRealized >= 0 ? '+' : ''}Rs.${Math.abs(Math.round(totalRealized)).toLocaleString()}`,
            color: totalRealized >= 0 ? 'text-green-500' : 'text-red-500'
          },
          {
            label: 'Unrealized P&L',
            value: `${totalUnrealized >= 0 ? '+' : ''}Rs.${Math.abs(Math.round(totalUnrealized)).toLocaleString()}`,
            color: totalUnrealized >= 0 ? 'text-green-500' : 'text-red-500'
          },
          {
            label: 'Win Rate',
            value: winRate !== null ? `${winRate}%` : '—',
            color: winRate !== null ? (winRate >= 50 ? 'text-green-500' : 'text-red-500') : 'text-gray-400'
          },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Portfolio Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Investor</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Open Positions</span>
              <span className="text-xs font-medium text-blue-500">{openPositions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Closed Trades</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{closedTrades.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Trades</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{allTrades.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Invested</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">
                Rs.{Math.round(totalInvested).toLocaleString()}
              </span>
            </div>
            {winRate !== null && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Win Rate</span>
                <span className={`text-xs font-medium ${winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                  {winRate}% ({profitableTrades}/{closedTrades.length})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Open Positions
          </h3>
          {openPositions.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl mb-3 block">📭</span>
              <p className="text-gray-400 text-sm">No open positions</p>
              <button
                onClick={() => navigate('/trader')}
                className="mt-3 text-blue-600 text-xs hover:underline"
              >
                Add a trade →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {openPositions.map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {t.symbol}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        t.position === 'LONG'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {t.position}
                      </span>
                      {t.status === 'PARTIAL' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 font-medium">
                          PARTIAL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{t.remaining_quantity || t.quantity} shares @ Rs.{t.entry_price}</span>
                      {t.sl && <span className="text-red-400">SL: {t.sl}</span>}
                      {t.tp && <span className="text-green-400">TP: {t.tp}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Rs.{t.currentPrice?.toLocaleString() || '—'}
                    </p>
                    {t.unrealizedPnl !== null && (
                      <p className={`text-xs font-medium ${t.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {t.unrealizedPnl >= 0 ? '+' : ''}Rs.{Math.abs(t.unrealizedPnl).toLocaleString()}
                        {t.pnlPct && ` (${t.pnlPct}%)`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Trade History
          </h3>
          <span className="text-xs text-gray-400">{allTrades.length} total trades</span>
        </div>

        {allTrades.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">No trades yet</p>
            <button
              onClick={() => navigate('/trader')}
              className="mt-3 text-blue-600 text-xs hover:underline"
            >
              Add your first trade →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                  {['Date', 'Symbol', 'Position', 'Qty', 'Entry', 'Exit', 'SL/TP', 'P&L', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTrades.map(t => (
                  <tr
                    key={t.id}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{t.date}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{t.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        t.position === 'LONG'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {t.position === 'LONG' ? '📈 Long' : '📉 Short'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {t.remaining_quantity || t.quantity}/{t.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      Rs.{parseFloat(t.entry_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {t.exit_price ? `Rs.${parseFloat(t.exit_price).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {t.sl && <div className="text-red-500">SL: {t.sl}</div>}
                        {t.tp && <div className="text-green-500">TP: {t.tp}</div>}
                        {!t.sl && !t.tp && <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${
                        (t.realized_pnl || 0) > 0 ? 'text-green-500'
                        : (t.realized_pnl || 0) < 0 ? 'text-red-500'
                        : 'text-gray-400'
                      }`}>
                        {t.realized_pnl
                          ? `${t.realized_pnl >= 0 ? '+' : ''}Rs.${Math.round(t.realized_pnl).toLocaleString()}`
                          : '—'
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        t.status === 'OPEN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : t.status === 'PARTIAL' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {t.status}
                      </span>
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