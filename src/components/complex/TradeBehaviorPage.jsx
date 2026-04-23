import { useState, useEffect, useCallback, useRef } from 'react'
import { API } from '../../api'

// ── Mini bar chart ────────────────────────────────────────────────────────────

function BarChart({ data, xKey, yKey, colorKey, label, valueFormatter, height = 120 }) {
  if (!data?.length) return <Empty />
  const values = data.map(d => d[yKey] || 0)
  const maxAbs  = Math.max(...values.map(Math.abs), 1)
  return (
    <div>
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => {
          const val   = d[yKey] || 0
          const pct   = Math.abs(val) / maxAbs
          const isPos = val >= 0
          const color = d[colorKey] != null
            ? (d[colorKey] >= 60 ? '#22c55e' : d[colorKey] >= 40 ? '#f59e0b' : '#ef4444')
            : (isPos ? '#22c55e' : '#ef4444')
          return (
            <div key={i} className="flex flex-col items-center flex-1 min-w-0" title={`${d[xKey]}: ${valueFormatter ? valueFormatter(val) : val}`}>
              <div className="text-[8px] text-gray-500 mb-0.5 truncate w-full text-center">
                {valueFormatter ? valueFormatter(val) : val}
              </div>
              <div className="w-full rounded-t" style={{ height: `${Math.max(pct * (height - 20), 2)}px`, backgroundColor: color, opacity: 0.85 }} />
              <div className="text-[8px] text-gray-400 mt-0.5 truncate w-full text-center">{d[xKey]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Mini scatter plot ─────────────────────────────────────────────────────────

function ScatterPlot({ data, label }) {
  if (!data?.length) return <Empty />
  const maxX = Math.max(...data.map(d => d.holding_days || 0), 1)
  const vals  = data.map(d => d.pnl_pct || 0)
  const minY  = Math.min(...vals)
  const maxY  = Math.max(...vals)
  const rangeY = (maxY - minY) || 1

  return (
    <div>
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</div>
      <div className="relative bg-gray-50 dark:bg-gray-900 rounded-md overflow-hidden" style={{ height: 140 }}>
        {/* Zero line */}
        <div className="absolute left-0 right-0 border-t border-gray-300 dark:border-gray-600" style={{
          top: `${((maxY / rangeY) * 100)}%`
        }} />
        {data.map((d, i) => {
          const x  = (d.holding_days / maxX) * 100
          const y  = ((maxY - (d.pnl_pct || 0)) / rangeY) * 100
          const isWin = (d.pnl_pct || 0) >= 0
          return (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full border border-white dark:border-gray-900"
              style={{
                left: `${Math.min(x, 95)}%`,
                top:  `${Math.min(Math.max(y, 2), 94)}%`,
                backgroundColor: isWin ? '#22c55e' : '#ef4444',
                opacity: 0.75,
                transform: 'translate(-50%, -50%)',
              }}
              title={`${d.symbol} | ${d.holding_days}d | ${d.pnl_pct > 0 ? '+' : ''}${d.pnl_pct}%`}
            />
          )
        })}
        <div className="absolute bottom-1 right-1 text-[8px] text-gray-400">Holding days →</div>
        <div className="absolute top-1 left-1 text-[8px] text-gray-400">PnL%</div>
      </div>
    </div>
  )
}

// ── Equity curve ─────────────────────────────────────────────────────────────

function EquityCurve({ data, label }) {
  if (!data?.length) return <Empty />
  const vals   = data.map(d => d.cum_pnl)
  const minVal = Math.min(...vals)
  const maxVal = Math.max(...vals)
  const range  = (maxVal - minVal) || 1
  const H = 100

  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100
    const y = H - ((d.cum_pnl - minVal) / range) * H
    return `${x},${y}`
  }).join(' ')

  const fill = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100
    const y = H - ((d.cum_pnl - minVal) / range) * H
    return `${x},${y}`
  })
  const fillPath = `${fill[0].split(',')[0]},${H} ${fill.join(' ')} ${fill[fill.length - 1].split(',')[0]},${H}`

  const finalPnL = vals[vals.length - 1]
  const color = finalPnL >= 0 ? '#22c55e' : '#ef4444'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</div>
        <div className={`text-[11px] font-bold ${finalPnL >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {finalPnL >= 0 ? '+' : ''}Rs. {finalPnL.toLocaleString()}
        </div>
      </div>
      <svg viewBox={`0 0 100 ${H}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
        <polygon points={fillPath} fill={color} fillOpacity="0.12" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
        {/* Zero line */}
        {minVal < 0 && maxVal > 0 && (
          <line
            x1="0" x2="100"
            y1={H - ((0 - minVal) / range) * H}
            y2={H - ((0 - minVal) / range) * H}
            stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2,2"
          />
        )}
      </svg>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Empty() {
  return <div className="text-[10px] text-gray-400 py-2">No data</div>
}

function SummaryCard({ label, value, sub, color }) {
  const textColor = color === 'green' ? 'text-green-600 dark:text-green-400'
                  : color === 'red'   ? 'text-red-500 dark:text-red-400'
                  : color === 'amber' ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-900 dark:text-white'
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5">
      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-[15px] font-bold mt-0.5 ${textColor}`}>{value ?? '—'}</div>
      {sub && <div className="text-[8px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function MistakeCard({ mistake }) {
  return (
    <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300">{mistake.label}</div>
        <div className="text-[9px] text-gray-500">{mistake.count}× trades</div>
      </div>
      <div className={`text-[11px] font-bold mb-1 ${mistake.total_pnl < 0 ? 'text-red-600' : 'text-green-600'}`}>
        Rs. {mistake.total_pnl > 0 ? '+' : ''}{mistake.total_pnl.toLocaleString()} total impact
      </div>
      <div className="text-[9px] text-gray-600 dark:text-gray-400 leading-tight">{mistake.tip}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const VIEWS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'patterns',  label: 'Patterns'  },
  { id: 'mistakes',  label: 'Mistakes'  },
]

export default function TradeBehaviorPage() {
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [data,      setData]      = useState(null)
  const [view,      setView]      = useState('overview')
  const [groupBy,   setGroupBy]   = useState('day_of_week')

  const fetchStats = useCallback(async () => {
    setError('')
    setLoading(true)
    setData(null)
    try {
      const params = {}
      if (from) params.from = from
      if (to)   params.to   = to
      const r = await API.get('/api/behavior/stats', { params })
      setData(r.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { fetchStats() }, [])

  // Compute group data for current groupBy selection
  const groupData = data ? (() => {
    switch (groupBy) {
      case 'day_of_week':    return { items: data.by_day_of_week,    xKey: 'day',     }
      case 'month':          return { items: data.by_month,          xKey: 'month',   }
      case 'holding_period': return { items: data.by_holding_period, xKey: 'bucket',  }
      case 'rr_at_entry':    return { items: data.by_rr_at_entry,    xKey: 'rr_range',}
      case 'symbol':         return { items: data.by_symbol.slice(0,10), xKey: 'symbol', }
      default: return { items: [], xKey: 'x' }
    }
  })() : null

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT: Controls ───────────────────────────────────────────── */}
      <div className="w-[200px] min-w-[180px] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Trade Behavior
          </div>

          {/* Date filters */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-violet-500" />
          </div>

          {/* Group by */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Group By</label>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-violet-500">
              <option value="day_of_week">Day of Week</option>
              <option value="month">Month</option>
              <option value="holding_period">Holding Period</option>
              <option value="rr_at_entry">R:R at Entry</option>
              <option value="symbol">Symbol (Top 10)</option>
            </select>
          </div>

          {error && (
            <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">{error}</div>
          )}

          <button onClick={fetchStats} disabled={loading}
            className="w-full py-2 text-[11px] font-bold rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors">
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          {/* View selector */}
          {data && data.total > 0 && (
            <div>
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">View</label>
              <div className="flex flex-col gap-1">
                {VIEWS.map(v => (
                  <button key={v.id} onClick={() => setView(v.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                      view === v.id
                        ? 'bg-violet-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {data && (
            <div className="mt-auto text-[9px] text-gray-400 text-center leading-tight">
              {data.total} closed trades analyzed
              {data.date_range?.from && (
                <div>{data.date_range.from?.slice(0, 10)} → {data.date_range.to?.slice(0, 10)}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER + RIGHT: Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 min-w-0">

        {loading && (
          <div className="flex items-center justify-center h-full text-[12px] text-gray-400">
            Loading trade analysis…
          </div>
        )}

        {!loading && !data && (
          <div className="flex items-center justify-center h-full text-[12px] text-gray-400">
            No data loaded
          </div>
        )}

        {!loading && data && data.total === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-[32px]">📊</div>
            <div className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">No closed trades yet</div>
            <div className="text-[11px] text-gray-400 max-w-xs">
              Close some trades in the Trade Log to start seeing behavioral patterns and insights.
            </div>
          </div>
        )}

        {!loading && data && data.total > 0 && (
          <>
            {/* ── OVERVIEW VIEW ───────────────────────────────────────── */}
            {view === 'overview' && (
              <div className="flex flex-col gap-6 max-w-4xl">

                {/* AI Insights */}
                {data.insights?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                      Key Insights
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {data.insights.map((ins, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-800">
                          <span className="text-violet-500 text-[12px] mt-0.5 shrink-0">◆</span>
                          <span className="text-[11px] text-gray-700 dark:text-gray-300">{ins}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary cards */}
                <div>
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                    Summary — {data.total} Closed Trades
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <SummaryCard
                      label="Win Rate"
                      value={data.summary.win_rate != null ? `${data.summary.win_rate}%` : '—'}
                      color={data.summary.win_rate >= 60 ? 'green' : data.summary.win_rate >= 40 ? 'amber' : 'red'}
                    />
                    <SummaryCard
                      label="Total PnL"
                      value={`Rs. ${(data.summary.total_pnl || 0).toLocaleString()}`}
                      color={data.summary.total_pnl >= 0 ? 'green' : 'red'}
                    />
                    <SummaryCard
                      label="Profit Factor"
                      value={data.summary.profit_factor ?? '—'}
                      color={data.summary.profit_factor >= 1.5 ? 'green' : data.summary.profit_factor >= 1 ? 'amber' : 'red'}
                    />
                    <SummaryCard
                      label="Avg R:R Entry"
                      value={data.summary.avg_rr_at_entry ?? '—'}
                      color={data.summary.avg_rr_at_entry >= 2 ? 'green' : data.summary.avg_rr_at_entry >= 1 ? 'amber' : 'red'}
                    />
                    <SummaryCard
                      label="Avg Win"
                      value={data.summary.avg_win_pnl != null ? `Rs. ${data.summary.avg_win_pnl.toLocaleString()}` : '—'}
                      color="green"
                    />
                    <SummaryCard
                      label="Avg Loss"
                      value={data.summary.avg_loss_pnl != null ? `Rs. ${data.summary.avg_loss_pnl.toLocaleString()}` : '—'}
                      color="red"
                    />
                    <SummaryCard
                      label="Avg Hold"
                      value={data.summary.avg_holding_days != null ? `${data.summary.avg_holding_days}d` : '—'}
                    />
                    <SummaryCard
                      label="Avg Return"
                      value={data.summary.avg_return_pct != null ? `${data.summary.avg_return_pct > 0 ? '+' : ''}${data.summary.avg_return_pct}%` : '—'}
                      color={data.summary.avg_return_pct >= 0 ? 'green' : 'red'}
                    />
                  </div>
                </div>

                {/* Equity curve */}
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                  <EquityCurve data={data.pnl_curve} label="Cumulative PnL Curve" />
                </div>

                {/* Group chart */}
                {groupData && groupData.items.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <BarChart
                      data={groupData.items}
                      xKey={groupData.xKey}
                      yKey="win_rate"
                      colorKey="win_rate"
                      label={`Win Rate by ${groupBy.replace(/_/g, ' ')}`}
                      valueFormatter={v => v != null ? `${v}%` : '—'}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── PATTERNS VIEW ───────────────────────────────────────── */}
            {view === 'patterns' && (
              <div className="flex flex-col gap-6 max-w-4xl">
                <div className="grid grid-cols-2 gap-4">

                  {/* Holding period bars */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <BarChart
                      data={data.by_holding_period}
                      xKey="bucket"
                      yKey="win_rate"
                      colorKey="win_rate"
                      label="Win Rate by Holding Period"
                      valueFormatter={v => `${v}%`}
                    />
                  </div>

                  {/* Day of week bars */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <BarChart
                      data={data.by_day_of_week}
                      xKey="day"
                      yKey="win_rate"
                      colorKey="win_rate"
                      label="Win Rate by Entry Day"
                      valueFormatter={v => `${v}%`}
                    />
                  </div>

                  {/* R:R at entry */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <BarChart
                      data={data.by_rr_at_entry}
                      xKey="rr_range"
                      yKey="win_rate"
                      colorKey="win_rate"
                      label="Win Rate by R:R at Entry"
                      valueFormatter={v => `${v}%`}
                    />
                    <div className="mt-2 text-[9px] text-gray-400">
                      Trades with R:R &lt; 1 at entry should have a very high win rate to be profitable.
                    </div>
                  </div>

                  {/* Scatter: holding vs PnL% */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <ScatterPlot data={data.scatter} label="Holding Days vs PnL%" />
                    <div className="mt-2 text-[9px] text-gray-400">
                      Each dot = one trade. Hover for symbol.
                    </div>
                  </div>
                </div>

                {/* Monthly PnL */}
                {data.by_month.length > 1 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <BarChart
                      data={data.by_month}
                      xKey="month"
                      yKey="total_pnl"
                      colorKey={null}
                      label="Monthly PnL (Closed Trades)"
                      valueFormatter={v => v >= 0 ? `+${v.toLocaleString()}` : v.toLocaleString()}
                      height={140}
                    />
                  </div>
                )}

                {/* Top symbols */}
                {data.by_symbol.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                      Performance by Symbol
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800">
                            {['Symbol', 'Trades', 'Win%', 'Total PnL', 'Avg PnL', 'Avg Return%'].map(h => (
                              <th key={h} className="text-left pb-1.5 font-semibold text-gray-400 pr-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.by_symbol.map((s, i) => (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-900">
                              <td className="py-1 pr-4 font-bold text-gray-900 dark:text-white">{s.symbol}</td>
                              <td className="py-1 pr-4 text-gray-500">{s.count}</td>
                              <td className={`py-1 pr-4 font-semibold ${s.win_rate >= 60 ? 'text-green-600' : s.win_rate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                                {s.win_rate}%
                              </td>
                              <td className={`py-1 pr-4 font-bold ${s.total_pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                Rs. {s.total_pnl > 0 ? '+' : ''}{s.total_pnl.toLocaleString()}
                              </td>
                              <td className={`py-1 pr-4 ${s.avg_pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                Rs. {s.avg_pnl > 0 ? '+' : ''}{s.avg_pnl.toLocaleString()}
                              </td>
                              <td className={`py-1 ${s.avg_return_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {s.avg_return_pct > 0 ? '+' : ''}{s.avg_return_pct}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MISTAKES VIEW ───────────────────────────────────────── */}
            {view === 'mistakes' && (
              <div className="flex flex-col gap-6 max-w-2xl">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                    Recurring Mistake Patterns
                  </div>
                  <div className="text-[11px] text-gray-400 mb-4">
                    Detected from {data.total} closed trades. Sorted by total financial impact.
                  </div>
                  {data.mistakes.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {data.mistakes.map((m, i) => <MistakeCard key={i} mistake={m} />)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                      <div className="text-[32px]">✅</div>
                      <div className="text-[13px] font-semibold text-green-700 dark:text-green-400">No recurring mistake patterns found</div>
                      <div className="text-[11px] text-gray-400">
                        Need at least 2 instances of the same mistake to flag it.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
