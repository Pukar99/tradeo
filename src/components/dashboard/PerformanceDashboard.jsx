import { useState, useEffect } from 'react'
import { getTrades, getPortfolio, getStockPrice } from '../../api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

function PerformanceDashboard() {
  const [trades, setTrades] = useState([])
  const [holdings, setHoldings] = useState([])
  const [equityCurve, setEquityCurve] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [priceDate, setPriceDate] = useState('')
  const [showHoldings, setShowHoldings] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tradesRes, portfolioRes] = await Promise.all([
          getTrades(),
          getPortfolio()
        ])

        const tradeData = tradesRes.data
        const portfolioData = portfolioRes.data
        setTrades(tradeData)

        const holdingsWithPrices = await Promise.all(
          portfolioData.map(async (holding) => {
            try {
              const priceRes = await getStockPrice(holding.symbol)
              return {
                ...holding,
                currentPrice: priceRes.data.price,
                change: priceRes.data.change,
                latestDate: priceRes.data.latestDate
              }
            } catch {
              return { ...holding, currentPrice: null }
            }
          })
        )

        setHoldings(holdingsWithPrices)

        if (holdingsWithPrices[0]?.latestDate) {
          setPriceDate(holdingsWithPrices[0].latestDate)
        }

        calculateStats(tradeData, holdingsWithPrices)
        buildEquityCurve(tradeData, holdingsWithPrices)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const calculateStats = (tradeData, holdingsData) => {
    const buys = tradeData.filter(t => t.type === 'BUY')
    const sells = tradeData.filter(t => t.type === 'SELL')

    const totalInvested = buys.reduce((sum, t) => sum + t.total, 0)
    const realizedPnl = sells.reduce((sum, t) => sum + t.total, 0) -
      buys
        .filter(b => sells.some(s => s.symbol === b.symbol))
        .reduce((sum, t) => sum + t.total, 0)

    let unrealizedPnl = 0
    holdingsData.forEach(h => {
      if (h.currentPrice) {
        const costBasis = h.avg_price * h.quantity
        const currentValue = h.currentPrice * h.quantity
        unrealizedPnl += currentValue - costBasis
      }
    })

    const totalPnl = realizedPnl + unrealizedPnl
    const currentValue = holdingsData.reduce((sum, h) => {
      return sum + (h.currentPrice
        ? h.currentPrice * h.quantity
        : h.avg_price * h.quantity)
    }, 0)

    const pnlPct = totalInvested > 0
      ? ((totalPnl / totalInvested) * 100).toFixed(2)
      : '0.00'

    const winRate = sells.length > 0
      ? Math.round(
          (sells.filter(t => {
            const matchBuy = buys.find(b => b.symbol === t.symbol)
            return matchBuy ? t.price > matchBuy.price : false
          }).length / sells.length) * 100
        )
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
      openPositions: holdingsData.length
    })
  }

  const buildEquityCurve = (tradeData, holdingsData) => {
    if (!tradeData.length) return

    const sorted = [...tradeData].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    )

    let invested = 0
    const curve = sorted.map(t => {
      if (t.type === 'BUY') invested += t.total
      else invested -= t.total
      return {
        date: t.date,
        invested: Math.round(invested)
      }
    })

    const currentValue = holdingsData.reduce((sum, h) => {
      return sum + (h.currentPrice
        ? h.currentPrice * h.quantity
        : h.avg_price * h.quantity)
    }, 0)

    curve.push({
      date: 'Now',
      invested: Math.round(currentValue)
    })

    setEquityCurve(curve)
  }

  const calculateDrawdown = () => {
    if (!stats) return null
    if (stats.totalPnl >= 0) return null
    const dd = Math.abs(parseFloat(stats.pnlPct))
    if (dd === 0) return null
    const recovery = dd >= 100
      ? '∞'
      : ((dd / (100 - dd)) * 100).toFixed(2)
    return { dd: dd.toFixed(2), recovery }
  }

  const drawdown = calculateDrawdown()

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value
      return (
        <div className="bg-gray-900 text-white rounded-lg p-2 text-xs">
          <p className="text-gray-400">{payload[0].payload.date}</p>
          <p className="text-blue-400 font-medium">
            Rs. {val.toLocaleString()}
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
            <p className={`text-lg font-bold ${
              stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {stats.totalPnl >= 0 ? '+' : '-'}Rs.{Math.abs(Math.round(stats.totalPnl)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Total P&L</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <p className={`text-lg font-bold ${
              parseFloat(stats.pnlPct) >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {parseFloat(stats.pnlPct) >= 0 ? '+' : ''}{stats.pnlPct}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Return</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-500">
              {stats.winRate}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Win Rate</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {stats.openPositions}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Open Positions</p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Unrealized P&L</p>
            <p className={`text-base font-bold ${
              stats.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {stats.unrealizedPnl >= 0 ? '+' : '-'}Rs.{Math.abs(Math.round(stats.unrealizedPnl)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              From {stats.openPositions} open position{stats.openPositions !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Total Invested</p>
            <p className="text-base font-bold text-gray-900 dark:text-white">
              Rs.{Math.round(stats.totalInvested).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Current value: Rs.{Math.round(stats.currentValue).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {drawdown && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-100 dark:border-red-800 rounded-lg p-3 mb-4 text-xs">
          <p className="text-red-600 dark:text-red-300 font-medium">
            ⚠️ You are -{drawdown.dd}% down →
            Need +{drawdown.recovery}% to recover
          </p>
        </div>
      )}

      {holdings.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowHoldings(prev => !prev)}
            className="flex items-center justify-between w-full mb-2 group"
          >
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Holdings ({holdings.length})
            </p>
            <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200">
              {showHoldings ? '▲ Hide' : '▼ Show'}
            </span>
          </button>

          {showHoldings && (
            <div className="space-y-2">
              {holdings.map(h => {
                const costBasis = h.avg_price * h.quantity
                const currentVal = h.currentPrice
                  ? h.currentPrice * h.quantity
                  : costBasis
                const pnl = currentVal - costBasis
                const pnlPct = ((pnl / costBasis) * 100).toFixed(2)
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {h.symbol}
                      </p>
                      <p className="text-xs text-gray-400">
                        {h.quantity} shares @ Rs.{h.avg_price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Rs.{h.currentPrice?.toLocaleString() || '—'}
                      </p>
                      <p className={`text-xs font-medium ${
                        pnl >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
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
            Investment Curve
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={Math.floor(equityCurve.length / 4)}
              />
              <YAxis tick={{ fontSize: 10 }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="#3b82f6"
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