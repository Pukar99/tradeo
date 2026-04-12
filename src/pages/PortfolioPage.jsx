import { useState, useEffect } from 'react'
import { getTradeLog, getStockPrice } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useNavigate } from 'react-router-dom'

const fmt = (n) => Math.abs(Math.round(n)).toLocaleString()
const sign = (n) => n >= 0 ? '+' : ''

function PortfolioPage() {
  const [trades, setTrades]             = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [loading, setLoading]           = useState(true)
  const { user }  = useAuth()
  const { t }     = useLanguage()
  const navigate  = useNavigate()

  useEffect(() => { if (user) fetchData() }, [])

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
            return { ...t, currentPrice: ltp, change: priceRes.data.change, latestDate: priceRes.data.latestDate, unrealizedPnl: Math.round(pnl), pnlPct: ((pnl / (t.entry_price * qty)) * 100).toFixed(2) }
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

  if (!user) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center max-w-sm">
        <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-1">{t('portfolio.loginRequired')}</p>
        <p className="text-[11px] text-gray-400 mb-5">{t('portfolio.loginMsg')}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">{t('auth.loginBtn')}</button>
          <button onClick={() => navigate('/signup')} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors">{t('auth.signupBtn')}</button>
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[11px] text-gray-400">Loading portfolio…</p>
      </div>
    </div>
  )

  const closedTrades      = trades.filter(t => t.status === 'CLOSED')
  const totalInvested     = openPositions.reduce((s, t) => s + t.entry_price * (t.remaining_quantity || t.quantity), 0)
  const totalUnrealized   = openPositions.reduce((s, t) => s + (t.unrealizedPnl || 0), 0)
  const totalRealized     = closedTrades.reduce((s, t) => s + (t.realized_pnl || 0), 0)
  const totalPnl          = totalRealized + totalUnrealized
  const profitableTrades  = closedTrades.filter(t => (t.realized_pnl || 0) > 0).length
  const winRate           = closedTrades.length > 0 ? Math.round((profitableTrades / closedTrades.length) * 100) : null
  const avgWin            = profitableTrades > 0 ? closedTrades.filter(t => t.realized_pnl > 0).reduce((s, t) => s + t.realized_pnl, 0) / profitableTrades : 0
  const losses            = closedTrades.filter(t => (t.realized_pnl || 0) < 0)
  const avgLoss           = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.realized_pnl, 0) / losses.length) : 0
  const expectancy        = avgWin && avgLoss && winRate !== null ? ((winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss).toFixed(0) : null

  const statusPill = { OPEN: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', PARTIAL: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', CLOSED: 'text-gray-400 bg-gray-100 dark:bg-gray-800' }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Portfolio</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Live positions & performance overview</p>
        </div>
        <button
          onClick={() => navigate('/trader')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Trade
        </button>
      </div>

      {/* P&L Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Total P&L',      value: `${sign(totalPnl)}Rs.${fmt(totalPnl)}`,           color: totalPnl >= 0 ? 'text-emerald-500' : 'text-red-400',     sub: 'realized + unrealized' },
          { label: 'Realized',       value: `${sign(totalRealized)}Rs.${fmt(totalRealized)}`,  color: totalRealized >= 0 ? 'text-emerald-500' : 'text-red-400', sub: `${closedTrades.length} closed trades` },
          { label: 'Unrealized',     value: `${sign(totalUnrealized)}Rs.${fmt(totalUnrealized)}`, color: totalUnrealized >= 0 ? 'text-emerald-500' : 'text-red-400', sub: `${openPositions.length} open positions` },
          { label: 'Win Rate',       value: winRate !== null ? `${winRate}%` : '—',            color: winRate !== null ? (winRate >= 50 ? 'text-emerald-500' : 'text-red-400') : 'text-gray-400', sub: winRate !== null ? `${profitableTrades}/${closedTrades.length} trades` : 'no closed trades' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{s.label}</p>
            <p className={`text-[18px] font-bold tracking-tight leading-none ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Summary + Open Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Summary card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Summary</p>

          <div className="space-y-2.5">
            {[
              { label: 'Investor',       value: user.name,                                             valueClass: 'text-gray-800 dark:text-gray-200' },
              { label: 'Open Positions', value: openPositions.length,                                  valueClass: 'text-blue-500' },
              { label: 'Closed Trades',  value: closedTrades.length,                                   valueClass: 'text-gray-700 dark:text-gray-300' },
              { label: 'Total Trades',   value: trades.length,                                         valueClass: 'text-gray-700 dark:text-gray-300' },
              { label: 'Total Invested', value: `Rs.${Math.round(totalInvested).toLocaleString()}`,    valueClass: 'text-gray-700 dark:text-gray-300' },
              winRate !== null && { label: 'Win Rate', value: `${winRate}% (${profitableTrades}/${closedTrades.length})`, valueClass: winRate >= 50 ? 'text-emerald-500' : 'text-red-400' },
              expectancy && { label: 'Expectancy / trade', value: `${Number(expectancy) >= 0 ? '+' : ''}Rs.${Math.abs(Number(expectancy)).toLocaleString()}`, valueClass: Number(expectancy) >= 0 ? 'text-emerald-500' : 'text-red-400' },
            ].filter(Boolean).map((row, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{row.label}</span>
                <span className={`text-[11px] font-semibold ${row.valueClass}`}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Win/loss bar */}
          {closedTrades.length > 0 && (
            <div className="pt-1">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] text-emerald-500">{profitableTrades} wins</span>
                <span className="text-[9px] text-red-400">{closedTrades.length - profitableTrades} losses</span>
              </div>
              <div className="h-1.5 bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${winRate}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Open Positions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Open Positions</p>
            <span className="text-[10px] text-gray-400">{openPositions.length} active</span>
          </div>

          {openPositions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-[12px] text-gray-400">No open positions</p>
              <button onClick={() => navigate('/trader')} className="mt-2 text-[11px] text-green-500 hover:text-green-400 transition-colors">Add a trade →</button>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {openPositions.map((t, idx) => {
                const qty = t.remaining_quantity || t.quantity
                const invested = t.entry_price * qty
                const pnlPct = parseFloat(t.pnlPct || 0)
                const isProfit = (t.unrealizedPnl || 0) >= 0
                return (
                  <div key={t.id}
                    className="group bg-gray-50/50 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl px-3 py-2.5 transition-colors animate-fade-up"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: symbol + badges */}
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight">{t.symbol}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${t.position === 'LONG' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                              {t.position === 'LONG' ? '↑ Long' : '↓ Short'}
                            </span>
                            {t.status === 'PARTIAL' && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-amber-500 bg-amber-50 dark:bg-amber-900/20">Partial</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-gray-400">{qty} shares @ Rs.{t.entry_price}</span>
                            {t.sl && <span className="text-[9px] text-red-400">SL {t.sl}</span>}
                            {t.tp && <span className="text-[9px] text-emerald-400">TP {t.tp}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: LTP + P&L */}
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                          {t.currentPrice ? `Rs.${t.currentPrice.toLocaleString()}` : '—'}
                        </p>
                        {t.unrealizedPnl !== null && (
                          <p className={`text-[10px] font-semibold ${isProfit ? 'text-emerald-500' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}Rs.{Math.abs(t.unrealizedPnl).toLocaleString()}
                            <span className="font-normal text-gray-400 ml-1">({t.pnlPct}%)</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Mini P&L bar */}
                    {t.unrealizedPnl !== null && (
                      <div className="mt-2 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isProfit ? 'bg-emerald-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(Math.abs(pnlPct) * 5, 100)}%`, marginLeft: isProfit ? '50%' : `${Math.max(50 - Math.abs(pnlPct) * 5, 0)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Trade History</p>
          <span className="text-[10px] text-gray-400">{trades.length} total</span>
        </div>

        {trades.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-[12px] text-gray-400">No trades yet</p>
            <button onClick={() => navigate('/trader')} className="mt-2 text-[11px] text-green-500 hover:text-green-400 transition-colors">Add your first trade →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {['Date', 'Symbol', 'Position', 'Qty', 'Entry', 'Exit', 'SL / TP', 'P&L', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => {
                  const pnl = t.realized_pnl || 0
                  return (
                    <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-[10px] text-gray-400">{t.date}</td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{t.symbol}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.position === 'LONG' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                          {t.position === 'LONG' ? '↑ Long' : '↓ Short'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400">
                        {t.remaining_quantity || t.quantity}<span className="text-gray-300 dark:text-gray-700">/{t.quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-medium text-gray-700 dark:text-gray-300">Rs.{parseFloat(t.entry_price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-500 dark:text-gray-400">
                        {t.exit_price ? `Rs.${parseFloat(t.exit_price).toFixed(2)}` : <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[10px] space-y-0.5">
                          {t.sl && <div className="text-red-400">SL {t.sl}</div>}
                          {t.tp && <div className="text-emerald-400">TP {t.tp}</div>}
                          {!t.sl && !t.tp && <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold ${pnl > 0 ? 'text-emerald-500' : pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {pnl !== 0 ? `${pnl > 0 ? '+' : ''}Rs.${Math.round(pnl).toLocaleString()}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusPill[t.status] || ''}`}>{t.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default PortfolioPage
