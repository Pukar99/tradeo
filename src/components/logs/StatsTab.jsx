import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Design tokens (match DataLab) ─────────────────────────────────────────────
const CARD  = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
const LABEL = 'text-[9px] font-bold uppercase tracking-widest text-gray-400'
const SVAL  = 'text-[15px] font-black tracking-tight tabular-nums leading-tight'

// ── Range config ──────────────────────────────────────────────────────────────
export const STAT_RANGES = [
  { key: '1M',  label: 'This Month' },
  { key: '3M',  label: '3M' },
  { key: '6M',  label: '6M' },
  { key: '1Y',  label: 'This Year' },
  { key: 'all', label: 'All Time' },
]

function rangeStart(key) {
  const d = new Date()
  if (key === '1M') return new Date(d.getFullYear(), d.getMonth(), 1)
  if (key === '3M') { d.setMonth(d.getMonth() - 3); return d }
  if (key === '6M') { d.setMonth(d.getMonth() - 6); return d }
  if (key === '1Y') return new Date(d.getFullYear(), 0, 1)
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtRs = n => {
  const abs = Math.abs(n)
  if (abs >= 100000) return `Rs ${(n / 100000).toFixed(1)}L`
  if (abs >= 1000)   return `Rs ${(n / 1000).toFixed(1)}k`
  return `Rs ${Math.round(n).toLocaleString()}`
}

const fmtPct = n => `${(n * 100).toFixed(1)}%`

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, valueClass = 'text-gray-900 dark:text-white', sub }) {
  return (
    <div className={`${CARD} px-4 py-3.5 flex flex-col gap-0.5`}>
      <p className={`${LABEL} mb-1`}>{label}</p>
      <p className={`${SVAL} ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className={`${CARD} px-4 py-3.5 h-20`}>
            <div className="h-2 w-16 bg-gray-100 dark:bg-gray-800 rounded mb-3" />
            <div className="h-5 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className={`${CARD} px-4 py-3.5 h-20`}>
            <div className="h-2 w-16 bg-gray-100 dark:bg-gray-800 rounded mb-3" />
            <div className="h-5 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
      <div className={`${CARD} px-4 py-4 h-52`}>
        <div className="h-2 w-28 bg-gray-100 dark:bg-gray-800 rounded mb-4" />
        <div className="h-36 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ range }) {
  const label = STAT_RANGES.find(r => r.key === range)?.label || range
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-3 text-gray-300 dark:text-gray-700">📊</div>
      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No closed trades</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {range === 'all'
          ? 'Close a trade to see your stats here.'
          : `No closed trades in "${label}". Try a wider range.`}
      </p>
    </div>
  )
}

// ── Custom tooltip for P&L curve ──────────────────────────────────────────────
function CurveTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  const color = pt.cum >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2 shadow-lg text-[10px]">
      <p className="text-gray-400 mb-0.5">{pt.date}</p>
      <p className={`font-bold tabular-nums ${color}`}>{fmtRs(pt.cum)}</p>
      <p className="text-gray-400 tabular-nums">{pt.pnl >= 0 ? '+' : ''}{fmtRs(pt.pnl)} this trade</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StatsTab({ positions, loading, range }) {
  const closedTrades = useMemo(
    () => (positions || []).filter(t => t.status === 'CLOSED'),
    [positions]
  )

  const filtered = useMemo(() => {
    const cutoff = rangeStart(range)
    if (!cutoff) return closedTrades
    return closedTrades.filter(t => {
      const d = new Date(t.last_action_at || t.created_at)
      return d >= cutoff
    })
  }, [closedTrades, range])

  const stats = useMemo(() => {
    if (!filtered.length) return null

    const pnl = t => parseFloat(t.total_realized_pnl) || 0

    const wins   = filtered.filter(t => pnl(t) > 0)
    const losses = filtered.filter(t => pnl(t) < 0)

    const totalPnl     = filtered.reduce((a, t) => a + pnl(t), 0)
    const grossProfit  = wins.reduce((a, t) => a + pnl(t), 0)
    const grossLoss    = Math.abs(losses.reduce((a, t) => a + pnl(t), 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0)
    const avgWin       = wins.length   ? grossProfit / wins.length   : null
    const avgLoss      = losses.length ? grossLoss   / losses.length : null
    const winRate      = filtered.length ? wins.length / filtered.length : 0

    // Best / worst
    const byPnl = [...filtered].sort((a, b) => pnl(b) - pnl(a))
    const best  = byPnl[0]
    const worst = byPnl[byPnl.length - 1]

    // Cumulative P&L curve (sorted by close date)
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.last_action_at || a.created_at) - new Date(b.last_action_at || b.created_at)
    )
    let running = 0
    const curve = sorted.map(t => {
      running += pnl(t)
      const date = (t.last_action_at || t.created_at || '').slice(0, 10)
      return { date, pnl: pnl(t), cum: running }
    })

    // Max drawdown on cumulative curve
    let peak = -Infinity, maxDD = 0
    curve.forEach(pt => {
      if (pt.cum > peak) peak = pt.cum
      const dd = peak - pt.cum
      if (dd > maxDD) maxDD = dd
    })

    // Streak
    let curWin = 0, curLoss = 0, bestWin = 0, worstLoss = 0
    sorted.forEach(t => {
      if (pnl(t) > 0) { curWin++; curLoss = 0; bestWin  = Math.max(bestWin,  curWin)  }
      else             { curLoss++; curWin = 0;  worstLoss = Math.max(worstLoss, curLoss) }
    })
    // current streak: sign tells direction
    const lastPnl = pnl(sorted[sorted.length - 1])
    const currentStreak = lastPnl > 0 ? curWin : -curLoss

    // By setup type
    const bySetup = {}
    filtered.forEach(t => {
      const key = t.setup_type || 'Untagged'
      if (!bySetup[key]) bySetup[key] = { wins: 0, total: 0 }
      bySetup[key].total++
      if (pnl(t) > 0) bySetup[key].wins++
    })
    const setupRows = Object.entries(bySetup)
      .sort((a, b) => b[1].total - a[1].total)

    return {
      totalPnl, winRate, profitFactor, avgWin, avgLoss,
      best, worst, maxDD, curve,
      currentStreak, bestWin, worstLoss,
      setupRows,
      totalTrades: filtered.length,
      winCount: wins.length,
    }
  }, [filtered])

  if (loading) return <Skeleton />
  if (!stats)  return <EmptyState range={range} />

  const pnlColor   = stats.totalPnl >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
  const curveColor = stats.totalPnl >= 0 ? '#22c55e' : '#ef4444'
  const curveGradId = stats.totalPnl >= 0 ? 'pnlGreen' : 'pnlRed'

  const pfDisplay = stats.profitFactor === Infinity
    ? '∞'
    : stats.profitFactor.toFixed(2)
  const pfColor = stats.profitFactor >= 1
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'

  const streakLabel = stats.currentStreak > 0
    ? `${stats.currentStreak} win${stats.currentStreak > 1 ? 's' : ''} ✓`
    : stats.currentStreak < 0
      ? `${Math.abs(stats.currentStreak)} loss${Math.abs(stats.currentStreak) > 1 ? 'es' : ''} ✗`
      : '—'
  const streakColor = stats.currentStreak > 0
    ? 'text-green-600 dark:text-green-400'
    : stats.currentStreak < 0
      ? 'text-red-500 dark:text-red-400'
      : 'text-gray-400'

  return (
    <div className="space-y-3">

      {/* ── Row 1: Win Rate / PF / Avg Win / Avg Loss ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Win Rate"
          value={fmtPct(stats.winRate)}
          valueClass={stats.winRate >= 0.5 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          sub={`${stats.winCount} / ${stats.totalTrades} trades`}
        />
        <KpiCard
          label="Profit Factor"
          value={pfDisplay}
          valueClass={pfColor}
          sub={pfDisplay === '∞' ? 'No losing trades' : stats.profitFactor >= 2 ? 'Excellent' : stats.profitFactor >= 1.5 ? 'Good' : stats.profitFactor >= 1 ? 'Positive' : 'Negative'}
        />
        <KpiCard
          label="Avg Win"
          value={stats.avgWin !== null ? fmtRs(stats.avgWin) : '—'}
          valueClass="text-green-600 dark:text-green-400"
          sub={stats.avgWin !== null ? `${stats.winCount} wins` : 'No winning trades'}
        />
        <KpiCard
          label="Avg Loss"
          value={stats.avgLoss !== null ? fmtRs(stats.avgLoss) : '—'}
          valueClass="text-red-600 dark:text-red-400"
          sub={stats.avgLoss !== null ? `${stats.totalTrades - stats.winCount} losses` : 'No losing trades'}
        />
      </div>

      {/* ── Row 2: Total P&L / Max DD / Best / Worst ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total P&L"
          value={fmtRs(stats.totalPnl)}
          valueClass={pnlColor}
          sub={`${stats.totalTrades} closed trades`}
        />
        <KpiCard
          label="Max Drawdown"
          value={stats.maxDD > 0 ? fmtRs(stats.maxDD) : 'None'}
          valueClass={stats.maxDD > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
          sub="Peak-to-trough"
        />
        <KpiCard
          label="Best Trade"
          value={fmtRs(parseFloat(stats.best.total_realized_pnl) || 0)}
          valueClass="text-green-600 dark:text-green-400"
          sub={stats.best.symbol}
        />
        <KpiCard
          label="Worst Trade"
          value={fmtRs(parseFloat(stats.worst.total_realized_pnl) || 0)}
          valueClass="text-red-600 dark:text-red-400"
          sub={stats.worst.symbol}
        />
      </div>

      {/* ── Row 3: P&L Curve ── */}
      {stats.curve.length > 1 && (
        <div className={`${CARD} px-4 py-4`}>
          <p className={`${LABEL} mb-3`}>Cumulative P&L Curve</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.curve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={curveGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={curveColor} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={curveColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => {
                  const abs = Math.abs(v)
                  if (abs >= 100000) return `${(v/100000).toFixed(0)}L`
                  if (abs >= 1000)   return `${(v/1000).toFixed(0)}k`
                  return v
                }}
                width={36}
              />
              <Tooltip content={<CurveTooltip />} />
              <Area
                type="monotone"
                dataKey="cum"
                stroke={curveColor}
                strokeWidth={1.5}
                fill={`url(#${curveGradId})`}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Row 4: By Setup + Streak ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Setup type breakdown */}
        <div className={`${CARD} px-4 py-4`}>
          <p className={`${LABEL} mb-3`}>By Setup Type</p>
          {stats.setupRows.length === 0 ? (
            <p className="text-xs text-gray-400">No setup types tagged.</p>
          ) : (
            <div className="space-y-1.5">
              {stats.setupRows.map(([name, data]) => {
                const wr = data.total > 0 ? data.wins / data.total : 0
                return (
                  <div key={name} className="flex items-center gap-2">
                    {/* Name */}
                    <span className="text-[11px] text-gray-600 dark:text-gray-300 w-28 truncate shrink-0">{name}</span>
                    {/* Bar */}
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${wr >= 0.5 ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.round(wr * 100)}%` }}
                      />
                    </div>
                    {/* Pct + count */}
                    <span className={`text-[10px] font-bold tabular-nums shrink-0 w-8 text-right ${wr >= 0.5 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {Math.round(wr * 100)}%
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">({data.wins}/{data.total})</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Streak panel */}
        <div className={`${CARD} px-4 py-4`}>
          <p className={`${LABEL} mb-3`}>Win / Loss Streak</p>
          <div className="space-y-3">
            <div>
              <p className={`${LABEL}`}>Current</p>
              <p className={`text-[15px] font-black tracking-tight ${streakColor}`}>{streakLabel}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className={`${LABEL}`}>Best Win Run</p>
                <p className="text-[13px] font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {stats.bestWin > 0 ? `${stats.bestWin} in a row` : '—'}
                </p>
              </div>
              <div>
                <p className={`${LABEL}`}>Worst Loss Run</p>
                <p className="text-[13px] font-bold text-red-500 dark:text-red-400 tabular-nums">
                  {stats.worstLoss > 0 ? `${stats.worstLoss} in a row` : '—'}
                </p>
              </div>
            </div>
            {/* Quick ratio */}
            <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
              <p className={`${LABEL} mb-1`}>Expectancy per trade</p>
              <p className={`text-[13px] font-bold tabular-nums ${stats.totalPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {fmtRs(stats.totalPnl / stats.totalTrades)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
