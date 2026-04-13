import { useState, useEffect, useCallback } from 'react'
import { getTradeLog, getStockPrice } from '../../api'
import { useChatRefresh } from '../../utils/chatEvents'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

function PerformanceDashboard() {
  const [trades, setTrades] = useState([])
  const [equityCurve, setEquityCurve] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [priceDate, setPriceDate] = useState('')
  const [showHoldings, setShowHoldings] = useState(false)
  const [openPositions, setOpenPositions] = useState([])

  const fetchData = useCallback(async () => {
      try {
        const tradesRes = await getTradeLog()
        const tradeData = tradesRes.data
        setTrades(tradeData)

        const open = tradeData.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
        const closed = tradeData.filter(t => t.status === 'CLOSED')

        // Fetch latest prices for open positions
        const openWithPrices = await Promise.all(
          open.map(async (trade) => {
            try {
              const priceRes = await getStockPrice(trade.symbol)
              return {
                ...trade,
                currentPrice: priceRes.data.price,
                latestDate: priceRes.data.latestDate
              }
            } catch {
              return { ...trade, currentPrice: null }
            }
          })
        )

        setOpenPositions(openWithPrices)
        if (openWithPrices[0]?.latestDate) {
          setPriceDate(openWithPrices[0].latestDate)
        }

        calculateStats(tradeData, openWithPrices, closed)
        buildEquityCurve(tradeData, openWithPrices)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useChatRefresh(['trades'], fetchData)

  const calculateStats = (tradeData, openWithPrices, closedTrades) => {
    const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0)

    let unrealizedPnl = 0
    openWithPrices.forEach(t => {
      if (t.currentPrice) {
        const qty = t.remaining_quantity || t.quantity
        const pnl = t.position === 'LONG'
          ? (t.currentPrice - t.entry_price) * qty
          : (t.entry_price - t.currentPrice) * qty
        unrealizedPnl += pnl
      }
    })

    const totalInvested = openWithPrices.reduce((sum, t) => {
      return sum + (t.entry_price * (t.remaining_quantity || t.quantity))
    }, 0)

    const currentValue = openWithPrices.reduce((sum, t) => {
      const price = t.currentPrice || t.entry_price
      const qty = t.remaining_quantity || t.quantity
      return sum + (price * qty)
    }, 0)

    const totalPnl = realizedPnl + unrealizedPnl
    const pnlPct = totalInvested > 0
      ? ((unrealizedPnl / totalInvested) * 100).toFixed(2)
      : '0.00'

    const profitableTrades = closedTrades.filter(t => (t.realized_pnl || 0) > 0).length
    const winRate = closedTrades.length > 0
      ? Math.round((profitableTrades / closedTrades.length) * 100)
      : 0

    setStats({
      totalInvested,
      currentValue,
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      pnlPct,
      winRate,
      totalTrades: tradeData.length,
      closedTrades: closedTrades.length,
      openCount: openWithPrices.length,
      profitableTrades
    })
  }

  const buildEquityCurve = (tradeData, openWithPrices) => {
    const closed = tradeData
      .filter(t => t.status === 'CLOSED')
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    if (!closed.length) return

    let cumPnl = 0
    const curve = closed.map(t => {
      cumPnl += t.realized_pnl || 0
      return {
        date: t.date,
        pnl: Math.round(cumPnl)
      }
    })

    const unrealized = openWithPrices.reduce((sum, t) => {
      if (t.currentPrice) {
        const qty = t.remaining_quantity || t.quantity
        return sum + (t.position === 'LONG'
          ? (t.currentPrice - t.entry_price) * qty
          : (t.entry_price - t.currentPrice) * qty)
      }
      return sum
    }, 0)

    curve.push({ date: 'Now', pnl: Math.round(cumPnl + unrealized) })
    setEquityCurve(curve)
  }

  const calculateDrawdown = () => {
    if (!stats || stats.totalPnl >= 0) return null
    const dd = Math.abs(parseFloat(stats.pnlPct))
    if (dd === 0) return null
    const recovery = dd >= 100 ? '∞' : ((dd / (100 - dd)) * 100).toFixed(2)
    return { dd: dd.toFixed(2), recovery }
  }

  const drawdown = calculateDrawdown()

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value
      return (
        <div className="bg-gray-900 text-white rounded-lg p-2 text-xs">
          <p className="text-gray-400">{payload[0].payload.date}</p>
          <p className={`font-medium ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {val >= 0 ? '+' : ''}Rs. {val.toLocaleString()}
          </p>
        </div>
      )
    }
    return null
  }

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-400">Loading performance...</p>
    </div>
  )

  if (!trades.length) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Performance Dashboard
      </h2>
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">No trades recorded yet</p>
        <p className="text-gray-400 text-xs mt-1">
          Add trades in the Trader screen to see your performance
        </p>
        <div className="mt-4 opacity-30 pointer-events-none select-none">
          <div className="grid grid-cols-4 gap-3">
            {['P&L', 'Return', 'Win Rate', 'Trades'].map(label => (
              <div key={label} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded mb-1" />
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Performance Dashboard
        </h2>
        {priceDate && (
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            Prices as of {priceDate}
          </span>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <p className={`text-lg font-bold ${stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.totalPnl >= 0 ? '+' : '-'}Rs.{Math.abs(Math.round(stats.totalPnl)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Total P&L</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <p className={`text-lg font-bold ${parseFloat(stats.pnlPct) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {parseFloat(stats.pnlPct) >= 0 ? '+' : ''}{stats.pnlPct}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Unrealized Return</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-500">{stats.winRate}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Win Rate</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.openCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Open Positions</p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Realized P&L</p>
            <p className={`text-base font-bold ${stats.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.realizedPnl >= 0 ? '+' : '-'}Rs.{Math.abs(Math.round(stats.realizedPnl)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{stats.profitableTrades}/{stats.closedTrades} trades profitable</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Unrealized P&L</p>
            <p className={`text-base font-bold ${stats.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.unrealizedPnl >= 0 ? '+' : '-'}Rs.{Math.abs(Math.round(stats.unrealizedPnl)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{stats.openCount} open position{stats.openCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Total Invested</p>
            <p className="text-base font-bold text-gray-900 dark:text-white">
              Rs.{Math.round(stats.totalInvested).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Current: Rs.{Math.round(stats.currentValue).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {drawdown && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-100 dark:border-red-800 rounded-lg p-3 mb-4 text-xs">
          <p className="text-red-600 dark:text-red-300 font-medium">
            ⚠️ Down -{drawdown.dd}% → Need +{drawdown.recovery}% to recover
          </p>
        </div>
      )}

      {openPositions.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowHoldings(prev => !prev)}
            className="flex items-center justify-between w-full mb-2 group"
          >
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Open Positions ({openPositions.length})
            </p>
            <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200">
              {showHoldings ? '▲ Hide' : '▼ Show'}
            </span>
          </button>

          {showHoldings && (
            <div className="space-y-2">
              {openPositions.map(t => {
                const qty = t.remaining_quantity || t.quantity
                const ltp = t.currentPrice || t.entry_price
                const pnl = t.position === 'LONG'
                  ? (ltp - t.entry_price) * qty
                  : (t.entry_price - ltp) * qty
                const pnlPct = ((pnl / (t.entry_price * qty)) * 100).toFixed(2)

                return (
                  <div key={t.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.symbol}</p>
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
                      <p className="text-xs text-gray-400">
                        {qty} shares @ Rs.{t.entry_price}
                        {t.sl && <span className="text-red-400 ml-2">SL:{t.sl}</span>}
                        {t.tp && <span className="text-green-400 ml-2">TP:{t.tp}</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Rs.{t.currentPrice?.toLocaleString() || '—'}
                      </p>
                      <p className={`text-xs font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {pnl >= 0 ? '+' : '-'}Rs.{Math.abs(Math.round(pnl)).toLocaleString()} ({pnlPct}%)
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {equityCurve.length > 1 && (
        <div>
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">
            P&L Curve
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(equityCurve.length / 4)} />
              <YAxis tick={{ fontSize: 10 }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default PerformanceDashboard