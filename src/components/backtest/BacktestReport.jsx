import { useState, useEffect, useCallback } from 'react'
import { btGetReport, btEndSession } from '../../api/backtest'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../context/ThemeContext'

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function fmtPct(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%' }

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-0.5">
      <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-[15px] font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  )
}

export default function BacktestReport({ sessionId, onClose }) {
  const { isDark } = useTheme()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]    = useState('')

  useEffect(() => {
    btGetReport(sessionId)
      .then(r => setReport(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [sessionId])

  // Build equity curve data
  const equityData = report ? (() => {
    let eq = parseFloat(report.initial_capital)
    return [
      { date: 'Start', equity: eq },
      ...(report.trades || []).map(t => {
        eq += parseFloat(t.net_pnl || 0)
        return { date: t.exit_date?.slice(0, 10) || '', equity: +eq.toFixed(0) }
      })
    ]
  })() : []

  const isPositive = report?.total_pnl >= 0

  const handleExportCSV = useCallback(() => {
    if (!report?.trades?.length) return
    const headers = ['Symbol','Entry Date','Exit Date','Qty','Entry Price','Exit Price','Net P&L','Return %','Hold Days','Reason']
    const rows = report.trades.map(t => [
      t.symbol, t.entry_date?.slice(0,10), t.exit_date?.slice(0,10),
      t.quantity, t.entry_price, t.exit_price,
      t.net_pnl, t.return_pct, t.hold_days, t.exit_reason
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `backtest_${report.strategy_name?.replace(/\s+/g,'_')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }, [report])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
      Loading report…
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-red-500">{error}</div>
  )

  const s = report.summary

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-bold dark:text-white">{report.strategy_name}</h2>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {report.trades?.[0]?.entry_date?.slice(0,10) || '—'} → {report.trades?.[report.trades.length-1]?.exit_date?.slice(0,10) || '—'}
            {' · '}SL Mode: <span className={`font-semibold ${report.sl_mode === 'AUTO' ? 'text-orange-500' : 'text-blue-500'}`}>{report.sl_mode}</span>
          </div>
        </div>
        <button onClick={onClose}
          className="text-[11px] font-semibold border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          ← Back
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <StatCard
          label="Total P&L"
          value={`Rs.${fmt(report.total_pnl)}`}
          sub={fmtPct(report.total_return_pct)}
          color={report.total_pnl >= 0 ? 'text-green-600' : 'text-red-500'}
        />
        <StatCard
          label="Win Rate"
          value={`${s.win_rate}%`}
          sub={`${s.winners}W / ${s.losers}L`}
          color={s.win_rate >= 50 ? 'text-green-600' : 'text-red-500'}
        />
        <StatCard
          label="Profit Factor"
          value={s.profit_factor === 999 ? '∞' : s.profit_factor}
          sub={`Avg hold ${s.avg_hold_days}d`}
          color={s.profit_factor >= 1.5 ? 'text-green-600' : 'text-orange-500'}
        />
        <StatCard
          label="Max Drawdown"
          value={`Rs.${fmt(Math.abs(s.max_drawdown))}`}
          sub={fmtPct(s.max_drawdown_pct)}
          color="text-red-500"
        />
      </div>

      {/* Equity curve */}
      {equityData.length > 1 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 mb-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Equity Curve</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={equityData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`btEqGrad_${isPositive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  fontSize: 10,
                  background: isDark ? '#1f2937' : '#ffffff',
                  border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                  borderRadius: 6,
                  color: isDark ? '#e5e7eb' : '#111827',
                }}
                formatter={v => [`Rs.${fmt(v)}`, 'Equity']}
              />
              <Area
                type="monotone" dataKey="equity" stroke={isPositive ? '#22c55e' : '#ef4444'}
                fill={`url(#btEqGrad_${isPositive ? 'pos' : 'neg'})`}
                strokeWidth={1.5} dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trade log */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 mb-4">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Trade Log ({report.trades?.length || 0} trades)
        </div>
        {report.trades?.length === 0 ? (
          <div className="text-[11px] text-gray-400 py-4 text-center">No closed trades</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  {['#','Symbol','Entry','Exit','Qty','Entry P','Exit P','Net P&L','R%','Days','Reason'].map(h => (
                    <th key={h} className="text-left py-1 px-1 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.trades.map((t, i) => {
                  const pnl = parseFloat(t.net_pnl || 0)
                  return (
                    <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-1 px-1 text-gray-400">{i + 1}</td>
                      <td className="py-1 px-1 font-bold dark:text-white">{t.symbol}</td>
                      <td className="py-1 px-1 text-gray-600 dark:text-gray-400">{t.entry_date?.slice(0,10)}</td>
                      <td className="py-1 px-1 text-gray-600 dark:text-gray-400">{t.exit_date?.slice(0,10)}</td>
                      <td className="py-1 px-1 dark:text-gray-300">{t.quantity - (t.remaining_quantity || 0) || t.quantity}</td>
                      <td className="py-1 px-1 dark:text-gray-300">Rs.{fmt(t.entry_price)}</td>
                      <td className="py-1 px-1 dark:text-gray-300">Rs.{fmt(t.exit_price)}</td>
                      <td className={`py-1 px-1 font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {pnl >= 0 ? '+' : ''}Rs.{fmt(pnl)}
                      </td>
                      <td className={`py-1 px-1 ${parseFloat(t.return_pct) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {fmtPct(t.return_pct)}
                      </td>
                      <td className="py-1 px-1 text-gray-500 dark:text-gray-400">{t.hold_days || '—'}</td>
                      <td className="py-1 px-1">
                        <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${
                          t.exit_reason === 'TP_HIT'    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          t.exit_reason === 'SL_HIT'    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          t.exit_reason === 'SL_IGNORED'? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          t.exit_reason === 'EARLY_EXIT'? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>{t.exit_reason || '—'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Behavior log */}
      {report.behavior_log?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-orange-200 dark:border-orange-900 p-3 mb-4">
          <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2">
            ⚠ Behavior Log ({report.behavior_log.length} events)
          </div>
          {report.behavior_log.map((e, i) => (
            <div key={i} className="text-[10px] text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
              <span className="text-orange-400 font-semibold">{e.event_type}</span>
              <span>{e.event_date?.slice(0,10)}</span>
              <span className="font-semibold dark:text-gray-300">{e.symbol}</span>
              {e.detail && <span className="text-gray-400">{JSON.stringify(e.detail)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Best / Worst */}
      {(s.best_trade || s.worst_trade) && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {s.best_trade && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-green-200 dark:border-green-900 p-3">
              <div className="text-[9px] text-green-500 font-bold uppercase mb-1">Best Trade</div>
              <div className="font-bold dark:text-white">{s.best_trade.symbol}</div>
              <div className="text-green-600 font-bold">+Rs.{fmt(s.best_trade.pnl)}</div>
              <div className="text-[9px] text-gray-400">{s.best_trade.date}</div>
            </div>
          )}
          {s.worst_trade && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900 p-3">
              <div className="text-[9px] text-red-500 font-bold uppercase mb-1">Worst Trade</div>
              <div className="font-bold dark:text-white">{s.worst_trade.symbol}</div>
              <div className="text-red-500 font-bold">Rs.{fmt(s.worst_trade.pnl)}</div>
              <div className="text-[9px] text-gray-400">{s.worst_trade.date}</div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleExportCSV}
          className="px-4 py-1.5 text-[11px] font-semibold border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Export CSV
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          Close Session
        </button>
      </div>
    </div>
  )
}
