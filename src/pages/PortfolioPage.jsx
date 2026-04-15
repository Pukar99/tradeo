import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getTradeLog, getStockPrice } from '../api'
import { useChatRefresh } from '../utils/chatEvents'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, ReferenceLine,
  AreaChart, Area,
} from 'recharts'

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtRs  = (n) => `Rs.${Math.abs(Math.round(n)).toLocaleString()}`
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${parseFloat(n).toFixed(2)}%`
const signCls = (n) => n >= 0 ? 'text-emerald-500' : 'text-red-400'

function stockInitials(symbol) { return symbol?.slice(0, 2) || '??' }

const SYM_COLORS = [
  'bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500',
  'bg-pink-500','bg-teal-500','bg-red-500','bg-indigo-500',
  'bg-cyan-500','bg-orange-500',
]
const symColor = (s) => SYM_COLORS[(s?.charCodeAt(0) || 0) % SYM_COLORS.length]

// ── Tiny shared components ─────────────────────────────────────────────────────

function StatCard({ label, value, valueClass, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-4">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <p className={`text-[20px] font-bold tracking-tight leading-none ${valueClass}`}>{value}</p>
      {sub && <p className="text-[9px] mt-1.5 text-gray-400">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, right }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
      {right}
    </div>
  )
}

function EmptyState({ icon, title, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div className="w-11 h-11 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">{icon}</div>
      <p className="text-[12px] text-gray-400">{title}</p>
      {action && <button onClick={onAction} className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors">{action}</button>}
    </div>
  )
}

function SymAvatar({ symbol, size = 'w-8 h-8', text = 'text-[11px]' }) {
  return (
    <div className={`${size} ${symColor(symbol)} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <span className={`${text} font-bold text-white`}>{stockInitials(symbol)}</span>
    </div>
  )
}

// ── Donut chart colour palette (hex — Recharts needs hex, not Tailwind classes) ─

const DONUT_COLORS = [
  '#3b82f6','#10b981','#8b5cf6','#f59e0b',
  '#ec4899','#14b8a6','#ef4444','#6366f1',
  '#06b6d4','#f97316',
]
const donutColor = (i) => DONUT_COLORS[i % DONUT_COLORS.length]

// ── Custom donut tooltip ───────────────────────────────────────────────────────

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[11px] font-bold text-gray-900 dark:text-white">{d.symbol}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">Rs.{Math.round(d.value).toLocaleString()}</p>
      <p className="text-[10px] font-semibold text-blue-500">{d.pct}% of portfolio</p>
    </div>
  )
}

// ── Allocation donut chart ─────────────────────────────────────────────────────

function AllocationDonut({ openPositions }) {
  const [active, setActive] = useState(null)

  // P3-004: memoize expensive aggregation — re-compute only when openPositions changes
  const { data, total } = useMemo(() => {
    const bySymbol = openPositions.reduce((map, t) => {
      const qty = parseFloat(t.remaining_quantity ?? t.quantity) || 0
      const inv = (parseFloat(t.entry_price) || 0) * qty
      map[t.symbol] = (map[t.symbol] || 0) + inv
      return map
    }, {})
    const tot = Object.values(bySymbol).reduce((s, v) => s + v, 0)
    const entries = Object.entries(bySymbol)
      .sort((a, b) => b[1] - a[1])
      .map(([symbol, value]) => ({
        symbol,
        value,
        pct: tot > 0 ? ((value / tot) * 100).toFixed(1) : '0',
      }))
    return { data: entries, total: tot }
  }, [openPositions])

  if (total === 0) return null
  const activeEntry = active != null ? data[active] : null

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Capital Allocation</p>

      <div className="flex items-center gap-4">

        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={64}
                paddingAngle={data.length > 1 ? 2 : 0}
                dataKey="value"
                onMouseEnter={(_, idx) => setActive(idx)}
                onMouseLeave={() => setActive(null)}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={donutColor(i)}
                    opacity={active === null || active === i ? 1 : 0.35}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                  />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {activeEntry ? (
              <>
                <span className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight">{activeEntry.symbol}</span>
                <span className="text-[11px] font-bold text-blue-500">{activeEntry.pct}%</span>
              </>
            ) : (
              <>
                <span className="text-[9px] text-gray-400 leading-tight">invested</span>
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
                  Rs.{Math.round(total / 1000)}k
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 space-y-2 overflow-y-auto no-scrollbar" style={{ maxHeight: 140 }}>
          {data.map((d, i) => (
            <div
              key={d.symbol}
              className={`flex items-center gap-2 cursor-default transition-opacity ${active !== null && active !== i ? 'opacity-40' : 'opacity-100'}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: donutColor(i) }} />
              <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">{d.symbol}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Concentration warning */}
      {data[0] && parseFloat(data[0].pct) > 40 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-[9px] text-amber-500">
            <span className="font-semibold">{data[0].symbol}</span> is {data[0].pct}% of open capital — high concentration risk
          </p>
        </div>
      )}
    </div>
  )
}

// ── Monthly P&L bar chart ──────────────────────────────────────────────────────

function MonthlyPnlBar({ payload, x, y, width, height }) {
  // Custom bar shape — rounded top corners only
  const r  = 3
  const isPos = height >= 0
  const bx = x, by = isPos ? y : y + height
  const bh = Math.abs(height), bw = width

  if (bh < 1) return null
  return (
    <path
      d={`
        M ${bx + r} ${by}
        Q ${bx} ${by} ${bx} ${by + r}
        L ${bx} ${by + bh}
        L ${bx + bw} ${by + bh}
        L ${bx + bw} ${by + r}
        Q ${bx + bw} ${by} ${bx + bw - r} ${by}
        Z
      `}
      fill={payload.value >= 0 ? '#10b981' : '#f87171'}
      opacity={0.85}
    />
  )
}

function MonthlyPnlTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className={`text-[12px] font-bold ${val >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
        {val >= 0 ? '+' : ''}{fmtRs(val)}
      </p>
    </div>
  )
}

function MonthlyPnlChart({ closedTrades }) {
  // Build last 12 months labels
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('default', { month: 'short' }),
      value: 0,
    })
  }

  closedTrades.forEach(t => {
    if (t.realized_pnl == null) return
    // Use updated_at (close date) if available, fallback to entry date
    const closeDate = t.updated_at ? t.updated_at.slice(0, 7) : t.date?.slice(0, 7)
    if (!closeDate) return
    const m = months.find(m => m.key === closeDate)
    if (m) m.value += parseFloat(t.realized_pnl) || 0
  })

  // Round values
  months.forEach(m => { m.value = Math.round(m.value) })

  const hasData   = months.some(m => m.value !== 0)
  const maxAbs    = Math.max(...months.map(m => Math.abs(m.value)), 1)
  const totalYear = months.reduce((s, m) => s + m.value, 0)
  const posMonths = months.filter(m => m.value > 0).length
  const negMonths = months.filter(m => m.value < 0).length

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Monthly P&L</p>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-gray-400">
            <span className="text-emerald-500 font-semibold">{posMonths}↑</span>
            {' '}<span className="text-red-400 font-semibold">{negMonths}↓</span>
            {' '}last 12 mo
          </span>
          <span className={`text-[11px] font-bold ${signCls(totalYear)}`}>
            {totalYear >= 0 ? '+' : ''}{fmtRs(totalYear)}
          </span>
        </div>
      </div>
      <p className="text-[9px] text-gray-400 mb-3">Realized P&L per month</p>

      {!hasData ? (
        <div className="h-[120px] flex items-center justify-center">
          <p className="text-[11px] text-gray-300 dark:text-gray-700">No closed trades yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={months} barSize={18} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              dy={4}
            />
            <YAxis hide domain={[-maxAbs * 1.2, maxAbs * 1.2]} />
            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
            <Tooltip
              content={<MonthlyPnlTooltip />}
              cursor={{ fill: 'transparent' }}
            />
            <Bar dataKey="value" shape={<MonthlyPnlBar />} radius={[3, 3, 0, 0]}>
              {months.map((m, i) => (
                <Cell key={i} fill={m.value >= 0 ? '#10b981' : '#f87171'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Equity Curve ──────────────────────────────────────────────────────────────

function EquityCurveTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[9px] text-gray-400 mb-0.5">Trade #{d.tradeNum} · {d.date}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        {d.pnl >= 0 ? '+' : ''}{fmtRs(d.pnl)}
        <span className="ml-1 text-gray-400">this trade</span>
      </p>
      <p className={`text-[12px] font-bold ${signCls(d.cumulative)}`}>
        {d.cumulative >= 0 ? '+' : ''}{fmtRs(d.cumulative)}
        <span className="text-[9px] font-normal text-gray-400 ml-1">cumulative</span>
      </p>
    </div>
  )
}

function EquityCurve({ closedTrades }) {
  if (closedTrades.length === 0) return null

  // Sort trades by close date ascending, build cumulative P&L series
  const sorted = [...closedTrades]
    .filter(t => t.realized_pnl != null)
    .map(t => ({ ...t, _closeDate: (t.updated_at || t.date || '').slice(0, 10) }))
    .filter(t => t._closeDate)
    .sort((a, b) => a._closeDate.localeCompare(b._closeDate))

  if (sorted.length < 2) return null

  let cumulative = 0
  const data = sorted.map((t, i) => {
    const pnl = parseFloat(t.realized_pnl) || 0
    cumulative += pnl
    return {
      tradeNum:   i + 1,
      date:       t._closeDate,
      symbol:     t.symbol,
      pnl,
      cumulative: Math.round(cumulative),
    }
  })

  const finalPnl    = data[data.length - 1].cumulative
  const peak        = Math.max(...data.map(d => d.cumulative))
  const trough      = Math.min(...data.map(d => d.cumulative))
  const isPositive  = finalPnl >= 0

  // Max drawdown: biggest drop from any peak to any subsequent trough
  let maxDD = 0, runningPeak = data[0].cumulative
  for (const d of data) {
    if (d.cumulative > runningPeak) runningPeak = d.cumulative
    const dd = runningPeak - d.cumulative
    if (dd > maxDD) maxDD = dd
  }

  // Gradient id — must be unique per render to avoid SVG id collisions when P&L sign changes
  const gradId = `equityGrad_${isPositive ? 'pos' : 'neg'}_${sorted.length}`
  const lineColor  = isPositive ? '#10b981' : '#f87171'
  const gradTop    = isPositive ? '#10b98140' : '#f8717140'
  const gradBottom = isPositive ? '#10b98105' : '#f8717105'

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Equity Curve</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Cumulative realized P&L · {sorted.length} trades</p>
        </div>
        <div className="text-right">
          <p className={`text-[16px] font-bold tracking-tight leading-none ${signCls(finalPnl)}`}>
            {finalPnl >= 0 ? '+' : ''}{fmtRs(finalPnl)}
          </p>
          <p className="text-[9px] text-gray-400 mt-0.5">total realized</p>
        </div>
      </div>

      {/* Mini stats row */}
      <div className="flex gap-4 mb-3">
        <div>
          <p className="text-[8px] uppercase tracking-widest text-gray-400">Peak</p>
          <p className="text-[10px] font-semibold text-emerald-500">+{fmtRs(peak)}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase tracking-widest text-gray-400">Trough</p>
          <p className="text-[10px] font-semibold text-red-400">{fmtRs(trough)}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase tracking-widest text-gray-400">Max DD</p>
          <p className="text-[10px] font-semibold text-amber-500">-{fmtRs(maxDD)}</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={130}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="tradeNum" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3 3" />
          <Tooltip content={<EquityCurveTooltip />} cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={lineColor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Best / Worst trade callouts ────────────────────────────────────────────────

function BestWorstTrades({ closedTrades }) {
  if (closedTrades.length === 0) return null

  const withPnl = closedTrades
    .filter(t => t.realized_pnl != null)
    .map(t => ({ ...t, realized_pnl: parseFloat(t.realized_pnl) || 0 }))
  if (withPnl.length === 0) return null

  const best  = withPnl.reduce((a, b) => (b.realized_pnl > a.realized_pnl ? b : a))
  const worst = withPnl.reduce((a, b) => (b.realized_pnl < a.realized_pnl ? b : a))

  // Streak: count current consecutive wins or losses from most recent closed trade
  const byDate  = [...withPnl]
    .map(t => ({ ...t, _closeDate: (t.updated_at || t.date || '') }))
    .sort((a, b) => b._closeDate.localeCompare(a._closeDate))
  let streak = 0, streakType = null
  for (const t of byDate) {
    const w = t.realized_pnl > 0
    if (streakType === null) { streakType = w; streak = 1 }
    else if (w === streakType) streak++
    else break
  }

  const cards = [
    {
      label:    'Best Trade',
      symbol:   best.symbol,
      date:     best.date,
      pnl:      best.realized_pnl,
      pos:      best.position,
      accent:   'border-emerald-400',
      dotBg:    'bg-emerald-400',
      valClass: 'text-emerald-500',
      icon: (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label:    'Worst Trade',
      symbol:   worst.symbol,
      date:     worst.date,
      pnl:      worst.realized_pnl,
      pos:      worst.position,
      accent:   'border-red-400',
      dotBg:    'bg-red-400',
      valClass: 'text-red-400',
      icon: (
        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
    },
    {
      label:    streakType ? 'Win Streak' : 'Loss Streak',
      symbol:   `${streak} in a row`,
      date:     'current',
      pnl:      null,
      streakVal: streak,
      accent:   streakType ? 'border-blue-400' : 'border-amber-400',
      dotBg:    streakType ? 'bg-blue-400' : 'bg-amber-400',
      valClass: streakType ? 'text-blue-500' : 'text-amber-500',
      icon: (
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <div
          key={i}
          className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-[3px] ${c.accent} px-4 py-3.5 flex items-center gap-3`}
        >
          {/* Icon bubble */}
          <div className={`w-8 h-8 rounded-xl ${c.dotBg} bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center flex-shrink-0`}>
            {c.icon}
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">{c.label}</p>

            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <SymAvatar symbol={c.symbol.length <= 6 ? c.symbol : '🔥'} size="w-5 h-5" text="text-[8px]" />
                <span className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight truncate">
                  {c.symbol}
                </span>
                {c.pos && (
                  <span className={`text-[8px] font-semibold px-1 py-0.5 rounded flex-shrink-0 ${
                    c.pos === 'LONG'
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'text-red-500 bg-red-50 dark:bg-red-900/20'
                  }`}>
                    {c.pos === 'LONG' ? '↑L' : '↓S'}
                  </span>
                )}
              </div>

              {c.pnl != null ? (
                <span className={`text-[13px] font-bold flex-shrink-0 ${c.valClass}`}>
                  {c.pnl >= 0 ? '+' : ''}{fmtRs(c.pnl)}
                </span>
              ) : (
                <span className={`text-[18px] font-bold flex-shrink-0 ${c.valClass}`}>
                  {c.streakVal}×
                </span>
              )}
            </div>

            <p className="text-[9px] text-gray-400 mt-0.5">{c.date}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Risk Gauge ─────────────────────────────────────────────────────────────────
//
// Visual: |--- SL ---[====LTP====]--- TP ---| on a single track
//
// Zones:
//   Left edge  = SL (red zone)
//   Right edge = TP (green zone)
//   Dot        = current LTP position clamped between SL and TP
//   If LTP < SL or LTP > TP it clamps to 0% or 100%
//
// When SL or TP is missing we fall back to the simple P&L direction bar.

function RiskGauge({ entry, sl, tp, ltp, position, pnlPct }) {
  const hasFull = sl != null && tp != null && ltp != null
  const hasPnl  = pnlPct != null

  if (!hasFull && !hasPnl) return null

  // ── Full gauge (SL + TP + LTP known) ────────────────────────────────────────
  if (hasFull) {
    const e  = Number(entry)
    const s  = Number(sl)
    const tp_ = Number(tp)
    const l  = Number(ltp)

    // Normalise so left=SL, right=TP regardless of LONG/SHORT
    const lo   = position === 'LONG' ? Math.min(s, e)     : Math.min(tp_, e)
    const hi   = position === 'LONG' ? Math.max(tp_, e)   : Math.max(s, e)
    const slX  = position === 'LONG' ? 0                  : 100
    const tpX  = position === 'LONG' ? 100                : 0
    const range = hi - lo

    if (range <= 0) return null

    const ltpPct  = Math.max(0, Math.min(100, ((l - lo) / range) * 100))
    const entryPct = Math.max(0, Math.min(100, ((e - lo) / range) * 100))

    // How close to SL? Danger if within 10% of SL-side
    const distToSl = position === 'LONG'
      ? ((l - s) / (e - s || 1)) * 100
      : ((s - l) / (s - e || 1)) * 100
    const danger = distToSl < 15 && distToSl >= 0

    // Color of the dot
    const dotColor = danger
      ? 'bg-red-500 ring-2 ring-red-300 dark:ring-red-800'
      : ltpPct > entryPct
        ? (position === 'LONG' ? 'bg-emerald-400' : 'bg-red-400')
        : (position === 'LONG' ? 'bg-red-400' : 'bg-emerald-400')

    return (
      <div className="mt-2.5 space-y-1">
        {/* Track */}
        <div className="relative h-[5px] rounded-full overflow-visible" style={{ background: 'linear-gradient(to right, #fca5a5, #fef3c7, #6ee7b7)' }}>
          {/* Entry tick */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-gray-400 dark:bg-gray-500"
            style={{ left: `${entryPct}%` }}
          />
          {/* LTP dot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-500 ${dotColor}`}
            style={{ left: `calc(${ltpPct}% - 5px)` }}
          />
        </div>
        {/* Labels */}
        <div className="flex justify-between items-center">
          <span className="text-[8px] text-red-400 font-medium">SL {sl}</span>
          {danger && (
            <span className="text-[8px] text-red-400 font-semibold animate-pulse">⚠ Near SL</span>
          )}
          <span className="text-[8px] text-emerald-500 font-medium">TP {tp}</span>
        </div>
      </div>
    )
  }

  // ── Fallback: simple P&L direction bar ───────────────────────────────────────
  const pct    = parseFloat(pnlPct)
  const width  = Math.min(Math.abs(pct) * 4, 50)
  const profit = pct >= 0
  return (
    <div className="mt-2.5 h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
      <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
      <div
        className={`absolute h-full rounded-full transition-all duration-700 ${profit ? 'bg-emerald-400' : 'bg-red-400'}`}
        style={profit ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
      />
    </div>
  )
}

// ── Sort chevron ───────────────────────────────────────────────────────────────

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <span className="text-gray-300 dark:text-gray-700 ml-0.5">↕</span>
  return <span className="text-blue-400 ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>
}

// ── Grouped position card (multiple entries, same symbol) ─────────────────────

function GroupCard({ symbol, entries, idx, onChart, isFirstLoad }) {
  const [expanded, setExpanded] = useState(false)

  const totalQty      = entries.reduce((s, t) => s + (t.remaining_quantity ?? t.quantity), 0)
  const totalInvested = entries.reduce((s, t) => s + parseFloat(t.entry_price) * (t.remaining_quantity ?? t.quantity), 0)
  const weightedAvg   = totalQty > 0 ? totalInvested / totalQty : parseFloat(entries[0]?.entry_price) || 0
  const totalPnl      = entries.reduce((s, t) => s + (t.unrealizedPnl ?? 0), 0)
  const allHavePnl    = entries.every(t => t.unrealizedPnl != null)
  const ltp           = entries[0]?.currentPrice
  const directions    = [...new Set(entries.map(t => t.position))]
  const dirLabel      = directions.length > 1 ? 'Mixed' : directions[0] === 'LONG' ? '↑ Long' : '↓ Short'
  const dirClass      = directions.length > 1
    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
    : directions[0] === 'LONG'
      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
      : 'text-red-500 bg-red-50 dark:bg-red-900/20'

  const pnlPct   = allHavePnl ? ((totalPnl / totalInvested) * 100).toFixed(2) : null
  const isProfit = totalPnl >= 0

  // For risk gauge: use the tightest SL (worst case) and furthest TP across entries
  const slValues  = entries.map(t => t.sl).filter(Boolean).map(Number)
  const tpValues  = entries.map(t => t.tp).filter(Boolean).map(Number)
  // LONG: tightest SL = highest SL value (closest to entry from below), furthest TP = highest TP
  // SHORT: tightest SL = lowest SL value (closest to entry from above), furthest TP = lowest TP
  const groupSl   = slValues.length > 0 ? (directions[0] === 'LONG' ? Math.max(...slValues) : Math.min(...slValues)) : null
  const groupTp   = tpValues.length > 0 ? (directions[0] === 'LONG' ? Math.max(...tpValues) : Math.min(...tpValues)) : null
  const groupDir  = directions.length === 1 ? directions[0] : 'LONG'

  return (
    <div
      className={`${isFirstLoad ? 'animate-fade-up' : ''} rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-hidden`}
      style={isFirstLoad ? { animationDelay: `${idx * 35}ms` } : undefined}
    >
      {/* Group header row */}
      <div
        className="group bg-gray-50/50 dark:bg-gray-800/40 hover:bg-white dark:hover:bg-gray-800/80 p-3.5 cursor-pointer transition-all duration-200"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <SymAvatar symbol={symbol} />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight">{symbol}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${dirClass}`}>{dirLabel}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-blue-500 bg-blue-50 dark:bg-blue-900/20">
                  {entries.length} entries
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-gray-400">{totalQty} shares avg @ Rs.{weightedAvg.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0 flex items-center gap-3">
            <div>
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                {ltp != null ? `Rs.${Number(ltp).toLocaleString()}` : <span className="text-gray-300 dark:text-gray-600">—</span>}
              </p>
              {allHavePnl && (
                <p className={`text-[10px] font-semibold ${signCls(totalPnl)}`}>
                  {totalPnl >= 0 ? '+' : ''}{fmtRs(totalPnl)}
                  <span className="font-normal text-gray-400 ml-1">({fmtPct(pnlPct)})</span>
                </p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onChart({ symbol, entries }) }}
              className="text-[9px] text-blue-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              Chart →
            </button>
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <RiskGauge
          entry={weightedAvg}
          sl={groupSl}
          tp={groupTp}
          ltp={ltp}
          position={groupDir}
          pnlPct={pnlPct}
        />

        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-gray-400">
            Invested <span className="font-medium text-gray-500 dark:text-gray-400">{fmtRs(totalInvested)}</span>
          </span>
          <span className="text-[9px] text-gray-400">{expanded ? 'Hide' : 'Show'} entries</span>
        </div>
      </div>

      {/* Expanded individual entries */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((t, i) => {
            const qty  = t.remaining_quantity ?? t.quantity
            const ePct = parseFloat(t.pnlPct ?? 0)
            return (
              <div key={t.id} className="px-4 py-3 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-semibold text-gray-400 w-4">#{i + 1}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                          {qty} shares @ Rs.{Number(t.entry_price).toFixed(2)}
                        </span>
                        {t.status === 'PARTIAL' && (
                          <span className="text-[8px] font-semibold px-1 py-0.5 rounded text-amber-500 bg-amber-50 dark:bg-amber-900/20">Partial</span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-400">{t.date}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {t.unrealizedPnl != null ? (
                      <p className={`text-[10px] font-semibold ${signCls(t.unrealizedPnl)}`}>
                        {t.unrealizedPnl >= 0 ? '+' : ''}{fmtRs(t.unrealizedPnl)}
                        <span className="font-normal text-gray-400 ml-1">({fmtPct(ePct)})</span>
                      </p>
                    ) : (
                      <span className="text-[9px] text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </div>
                </div>
                {/* Per-entry risk gauge */}
                <div className="mt-1.5 pl-7">
                  <RiskGauge
                    entry={t.entry_price}
                    sl={t.sl}
                    tp={t.tp}
                    ltp={t.currentPrice}
                    position={t.position}
                    pnlPct={t.unrealizedPnl != null ? ePct : null}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Single position card ───────────────────────────────────────────────────────

function PositionCard({ trade, idx, onChart, isFirstLoad }) {
  const qty      = parseFloat(trade.remaining_quantity ?? trade.quantity) || 0
  const invested = (parseFloat(trade.entry_price) || 0) * qty
  const isProfit = (trade.unrealizedPnl ?? 0) >= 0
  const pnlPct   = parseFloat(trade.pnlPct ?? 0)
  const barWidth = Math.min(Math.abs(pnlPct) * 4, 50)

  return (
    <div
      className={`group bg-gray-50/50 dark:bg-gray-800/40 hover:bg-white dark:hover:bg-gray-800/80 rounded-xl p-3.5 transition-all duration-200 border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 ${isFirstLoad ? 'animate-fade-up' : ''}`}
      style={isFirstLoad ? { animationDelay: `${idx * 35}ms` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <SymAvatar symbol={trade.symbol} />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight">{trade.symbol}</span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                trade.position === 'LONG'
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'text-red-500 bg-red-50 dark:bg-red-900/20'
              }`}>
                {trade.position === 'LONG' ? '↑ Long' : '↓ Short'}
              </span>
              {trade.status === 'PARTIAL' && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-amber-500 bg-amber-50 dark:bg-amber-900/20">Partial</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-gray-400">{qty} shares @ Rs.{Number(trade.entry_price).toLocaleString()}</span>
              {trade.sl && <span className="text-[9px] text-red-400">SL {trade.sl}</span>}
              {trade.tp && <span className="text-[9px] text-emerald-400">TP {trade.tp}</span>}
            </div>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white">
            {trade.currentPrice != null
              ? `Rs.${Number(trade.currentPrice).toLocaleString()}`
              : <span className="text-gray-300 dark:text-gray-600">—</span>
            }
          </p>
          {trade.unrealizedPnl != null && (
            <p className={`text-[10px] font-semibold ${signCls(trade.unrealizedPnl)}`}>
              {trade.unrealizedPnl >= 0 ? '+' : ''}{fmtRs(trade.unrealizedPnl)}
              <span className="font-normal text-gray-400 ml-1">({fmtPct(pnlPct)})</span>
            </p>
          )}
          {trade.currentPrice == null && (
            <p className="text-[9px] text-gray-300 dark:text-gray-600">No price data</p>
          )}
        </div>
      </div>

      <RiskGauge
        entry={trade.entry_price}
        sl={trade.sl}
        tp={trade.tp}
        ltp={trade.currentPrice}
        position={trade.position}
        pnlPct={trade.unrealizedPnl != null ? pnlPct : null}
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-gray-400">
          Invested <span className="font-medium text-gray-500 dark:text-gray-400">{fmtRs(invested)}</span>
        </span>
        <button
          onClick={() => onChart(trade)}
          className="text-[9px] text-blue-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          Chart →
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function PortfolioPage() {
  const [trades, setTrades]               = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [loading, setLoading]             = useState(true)
  const [ltpLoading, setLtpLoading]       = useState(false)
  const [fetchError, setFetchError]       = useState(null)
  const [isFirstLoad, setIsFirstLoad]     = useState(true)   // controls entry animation — only on first paint

  // History table controls
  const [filterStatus, setFilterStatus]   = useState('ALL')   // ALL | OPEN | PARTIAL | CLOSED
  const [search, setSearch]               = useState('')
  const [sort, setSort]                   = useState({ col: 'date', dir: 'desc' })

  const { user }   = useAuth()
  const { t }      = useLanguage()
  const navigate   = useNavigate()

  // ── Data fetch ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const res       = await getTradeLog()
      const allTrades = res.data ?? []
      setTrades(allTrades)

      const open = allTrades.filter(tr => tr.status === 'OPEN' || tr.status === 'PARTIAL')

      if (open.length === 0) {
        setOpenPositions([])
        setLoading(false)
        return
      }

      // Fetch all prices in parallel before any state update — eliminates the
      // double-render (null prices → real prices) that causes the flicker
      setLtpLoading(true)
      const uniqueSymbols = [...new Set(open.map(tr => tr.symbol))]
      const results       = await Promise.allSettled(uniqueSymbols.map(sym => getStockPrice(sym)))

      const priceMap = {}
      uniqueSymbols.forEach((sym, i) => {
        const r = results[i]
        if (r.status === 'fulfilled') priceMap[sym] = r.value.data
      })

      // Single state update with complete data — no intermediate null-price render
      setOpenPositions(open.map(tr => {
        const p      = priceMap[tr.symbol]
        const qty    = parseFloat(tr.remaining_quantity ?? tr.quantity) || 0
        const entry  = parseFloat(tr.entry_price) || 0
        if (!p) return { ...tr, currentPrice: null, unrealizedPnl: null, pnlPct: null }
        const ltp      = parseFloat(p.price) || 0
        const invested = entry * qty
        const pnl      = tr.position === 'LONG' ? (ltp - entry) * qty : (entry - ltp) * qty
        const pnlPct   = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : '0.00'
        return { ...tr, currentPrice: ltp, change: p.change, latestDate: p.latestDate, unrealizedPnl: Math.round(pnl), pnlPct }
      }))
    } catch (err) {
      console.error('PortfolioPage fetch error:', err)
      setFetchError('Failed to load portfolio data. Please refresh.')
    } finally {
      setLoading(false)
      setLtpLoading(false)
      setIsFirstLoad(false)  // subsequent refreshes won't re-animate cards
    }
  }, [user?.id])   // depend on id only — not full user object (avatar_url changes trigger flicker)

  useEffect(() => { if (user) fetchData() }, [user, fetchData])
  useChatRefresh(['trades'], fetchData)

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const handleGoToChart = ({ symbol, entries, id, entry_price, sl, tp, position, remaining_quantity, quantity, date }) => {
    // Called from both GroupCard (passes { symbol, entries }) and PositionCard (passes a single trade)
    const positions = entries
      ? entries.map(tr => ({
          id:                 tr.id,
          entry_price:        parseFloat(tr.entry_price),
          sl:                 tr.sl ? parseFloat(tr.sl) : null,
          tp:                 tr.tp ? parseFloat(tr.tp) : null,
          position:           tr.position,
          quantity:           tr.quantity,
          remaining_quantity: tr.remaining_quantity ?? tr.quantity,
          entry_date:         tr.date,
        }))
      : [{ id, entry_price: parseFloat(entry_price), sl: sl ? parseFloat(sl) : null, tp: tp ? parseFloat(tp) : null, position, quantity, remaining_quantity: remaining_quantity ?? quantity, entry_date: date }]
    navigate('/screen', { state: { symbol, positions } })
  }

  // ── Sort helper ────────────────────────────────────────────────────────────

  const toggleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { col, dir: 'desc' }
    )
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!user) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center max-w-sm w-full">
        <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-1">Login Required</p>
        <p className="text-[11px] text-gray-400 mb-5">Sign in to view your portfolio</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">Login</button>
          <button onClick={() => navigate('/signup')} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Sign Up</button>
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

  if (fetchError) return (
    <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center space-y-3">
        <p className="text-[13px] text-red-400 font-medium">{fetchError}</p>
        <button onClick={() => { setFetchError(null); setLoading(true); fetchData() }}
          className="text-[11px] text-blue-500 hover:text-blue-400 border border-blue-200 dark:border-blue-800 px-4 py-1.5 rounded-lg transition-colors">
          Retry
        </button>
      </div>
    </div>
  )

  // ── Derived stats ──────────────────────────────────────────────────────────

  // Normalise closed trades once so every derived calc uses parseFloat'd PnL
  const closedTrades    = trades
    .filter(t => t.status === 'CLOSED')
    .map(t => ({ ...t, realized_pnl: parseFloat(t.realized_pnl) || 0 }))
  const totalInvested   = openPositions.reduce((s, t) => s + (parseFloat(t.entry_price) || 0) * (parseFloat(t.remaining_quantity ?? t.quantity) || 0), 0)
  const totalUnrealized = openPositions.reduce((s, t) => s + (t.unrealizedPnl ?? 0), 0)
  const totalRealized   = closedTrades.reduce((s, t) => s + t.realized_pnl, 0)
  const totalPnl        = totalRealized + totalUnrealized
  const wins            = closedTrades.filter(t => t.realized_pnl > 0)
  const losses          = closedTrades.filter(t => t.realized_pnl < 0)
  const winRate         = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : null
  const avgWin          = wins.length   > 0 ? wins.reduce((s, t)   => s + t.realized_pnl, 0) / wins.length   : 0
  const avgLoss         = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.realized_pnl, 0) / losses.length) : 0
  const expectancy      = winRate != null && avgWin && avgLoss
    ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss
    : null
  const grossWin        = wins.reduce((s, t) => s + t.realized_pnl, 0)
  const grossLoss       = Math.abs(losses.reduce((s, t) => s + t.realized_pnl, 0))
  const profitFactor    = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : wins.length > 0 ? '∞' : null

  // ── Open positions: group by symbol ───────────────────────────────────────

  const grouped = openPositions.reduce((map, t) => {
    if (!map[t.symbol]) map[t.symbol] = []
    map[t.symbol].push(t)
    return map
  }, {})
  const groupedEntries = Object.entries(grouped) // [[symbol, trades[]], ...]

  // ── History: filter + sort + search ───────────────────────────────────────

  const statusPill = {
    OPEN:    'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
    PARTIAL: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
    CLOSED:  'text-gray-400 bg-gray-100 dark:bg-gray-800',
  }

  const filtered = trades
    .filter(t => filterStatus === 'ALL' || t.status === filterStatus)
    .filter(t => !search.trim() || t.symbol.toUpperCase().includes(search.trim().toUpperCase()))

  const sortVal = (t) => {
    if (sort.col === 'date')   return t.date ?? ''
    if (sort.col === 'symbol') return t.symbol ?? ''
    if (sort.col === 'entry')  return Number(t.entry_price) ?? 0
    if (sort.col === 'pnl')    return t.realized_pnl ?? 0
    if (sort.col === 'qty')    return (t.remaining_quantity ?? t.quantity) ?? 0
    return ''
  }

  const sorted = [...filtered].sort((a, b) => {
    const av = sortVal(a), bv = sortVal(b)
    if (av < bv) return sort.dir === 'asc' ? -1 : 1
    if (av > bv) return sort.dir === 'asc' ? 1 : -1
    return 0
  })

  const COLS = [
    { key: 'date',   label: 'Date',          sortable: true  },
    { key: 'symbol', label: 'Symbol',         sortable: true  },
    { key: 'dir',    label: 'Direction',      sortable: false },
    { key: 'qty',    label: 'Qty',            sortable: true  },
    { key: 'entry',  label: 'Entry',          sortable: true  },
    { key: 'exit',   label: 'Exit',           sortable: false },
    { key: 'sltp',   label: 'SL / TP',        sortable: false },
    { key: 'pnl',    label: 'Realized P&L',   sortable: true  },
    { key: 'status', label: 'Status',         sortable: false },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-12 space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Portfolio</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Live positions & performance overview</p>
        </div>
        <button
          onClick={() => navigate('/logs')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Trade
        </button>
      </div>

      {/* ── Stats Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}${fmtRs(totalPnl)}`}
          valueClass={signCls(totalPnl)}
          sub="realized + unrealized"
        />
        <StatCard
          label="Realized"
          value={`${totalRealized >= 0 ? '+' : ''}${fmtRs(totalRealized)}`}
          valueClass={signCls(totalRealized)}
          sub={`${closedTrades.length} closed trade${closedTrades.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Unrealized"
          value={ltpLoading
            ? '—'
            : `${totalUnrealized >= 0 ? '+' : ''}${fmtRs(totalUnrealized)}`}
          valueClass={ltpLoading ? 'text-gray-400 dark:text-gray-600' : signCls(totalUnrealized)}
          sub={ltpLoading
            ? 'Fetching prices…'
            : `${openPositions.length} open position${openPositions.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Win Rate"
          value={winRate != null ? `${winRate}%` : '—'}
          valueClass={winRate != null ? (winRate >= 50 ? 'text-emerald-500' : 'text-red-400') : 'text-gray-400'}
          sub={winRate != null ? `${wins.length}W / ${losses.length}L of ${closedTrades.length}` : 'no closed trades'}
        />
      </div>

      {/* ── Allocation + Summary + Open Positions ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left column: donut on top, summary below */}
        <div className="flex flex-col gap-4">

          {/* Allocation donut — only when positions are loaded and have data */}
          {!ltpLoading && openPositions.length > 0 && <AllocationDonut openPositions={openPositions} />}
          {ltpLoading && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 animate-pulse">
              <div className="h-2.5 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="flex items-center gap-4">
                <div className="w-[140px] h-[140px] rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                <div className="flex-1 space-y-2.5">
                  {[1,2,3].map(i => <div key={i} className="h-2 bg-gray-100 dark:bg-gray-800 rounded" />)}
                </div>
              </div>
            </div>
          )}

        {/* Summary card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Summary</p>

          <div className="space-y-3">
            {[
              { label: 'Investor',       value: user?.name || user?.email || 'Trader',                                                         vc: 'text-gray-800 dark:text-gray-200' },
              { label: 'Open Positions', value: openPositions.length,                                             vc: 'text-blue-500' },
              { label: 'Closed Trades',  value: closedTrades.length,                                              vc: 'text-gray-700 dark:text-gray-300' },
              { label: 'Total Trades',   value: trades.length,                                                    vc: 'text-gray-700 dark:text-gray-300' },
              { label: 'Total Invested', value: fmtRs(totalInvested),                                             vc: 'text-gray-700 dark:text-gray-300' },
              winRate != null && {
                label: 'Win Rate',       value: `${winRate}% (${wins.length}/${closedTrades.length})`,            vc: winRate >= 50 ? 'text-emerald-500' : 'text-red-400',
              },
              profitFactor && {
                label: 'Profit Factor',  value: profitFactor,                                                      vc: parseFloat(profitFactor) >= 1 ? 'text-emerald-500' : 'text-red-400',
              },
              expectancy != null && {
                label: 'Expectancy',     value: `${expectancy >= 0 ? '+' : ''}${fmtRs(expectancy)} / trade`,     vc: expectancy >= 0 ? 'text-emerald-500' : 'text-red-400',
              },
            ].filter(Boolean).map((row, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{row.label}</span>
                <span className={`text-[11px] font-semibold ${row.vc}`}>{row.value}</span>
              </div>
            ))}
          </div>

          {closedTrades.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between mb-1.5">
                <span className="text-[9px] text-emerald-500 font-medium">{wins.length} wins</span>
                <span className="text-[9px] text-red-400 font-medium">{losses.length} losses</span>
              </div>
              <div className="h-1.5 bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${winRate}%` }} />
              </div>
            </div>
          )}
        </div>

        </div>{/* end left column */}

        {/* Open Positions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
          <SectionHeader
            title="Open Positions"
            right={
              ltpLoading
                ? <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 border-t-blue-400 rounded-full animate-spin inline-block" />
                    Fetching prices…
                  </span>
                : <span className="text-[10px] text-gray-400">{openPositions.length} active</span>
            }
          />

          {ltpLoading ? (
            /* Loading skeleton — shown while prices are being fetched */
            <div className="p-3 space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700/50 p-3.5 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-2 w-36 bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                    <div className="text-right space-y-1.5">
                      <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-2 w-12 bg-gray-100 dark:bg-gray-800 rounded ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : openPositions.length === 0 ? (
            <EmptyState
              icon={<svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              title="No open positions"
              action="Log a trade →"
              onAction={() => navigate('/logs')}
            />
          ) : (
            <div className="p-3 space-y-2 overflow-y-auto no-scrollbar">
              {groupedEntries.map(([symbol, entries], idx) =>
                entries.length > 1
                  ? <GroupCard key={symbol} symbol={symbol} entries={entries} idx={idx} onChart={handleGoToChart} isFirstLoad={isFirstLoad} />
                  : <PositionCard key={entries[0].id} trade={entries[0]} idx={idx} onChart={(tr) => handleGoToChart(tr)} isFirstLoad={isFirstLoad} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Charts row: Monthly P&L + Equity Curve ──────────────────────────── */}
      {closedTrades.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MonthlyPnlChart closedTrades={closedTrades} />
          <EquityCurve closedTrades={closedTrades} />
        </div>
      )}

      {/* ── Best / Worst / Streak ───────────────────────────────────────────── */}
      <BestWorstTrades closedTrades={closedTrades} />

      {/* ── Trade History ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <SectionHeader
          title="Trade History"
          right={
            <div className="flex items-center gap-2 flex-wrap">
              {/* Symbol search */}
              <div className="relative">
                <svg className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Symbol…"
                  className="pl-7 pr-3 py-1.5 text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-24 transition-all"
                />
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-1">
                {['ALL', 'OPEN', 'PARTIAL', 'CLOSED'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                      filterStatus === s
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <span className="text-[10px] text-gray-400">{sorted.length}/{trades.length}</span>
            </div>
          }
        />

        {trades.length === 0 ? (
          <EmptyState
            icon={<svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            title="No trades yet"
            action="Add your first trade →"
            onAction={() => navigate('/logs')}
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
            title="No trades match your filter"
            action="Clear filters"
            onAction={() => { setFilterStatus('ALL'); setSearch('') }}
          />
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {COLS.map(c => (
                    <th
                      key={c.key}
                      onClick={() => c.sortable && toggleSort(c.key)}
                      className={`px-4 py-2.5 text-left text-[9px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap select-none ${c.sortable ? 'cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors' : ''}`}
                    >
                      {c.label}
                      {c.sortable && <SortIcon col={c.key} sort={sort} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => {
                  const pnl = t.realized_pnl ?? 0
                  const qty = t.remaining_quantity ?? t.quantity
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-[10px] text-gray-400 whitespace-nowrap">{t.date}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 ${symColor(t.symbol)} rounded flex items-center justify-center flex-shrink-0`}>
                            <span className="text-[8px] font-bold text-white">{stockInitials(t.symbol)}</span>
                          </div>
                          <span className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{t.symbol}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          t.position === 'LONG'
                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'text-red-500 bg-red-50 dark:bg-red-900/20'
                        }`}>
                          {t.position === 'LONG' ? '↑ Long' : '↓ Short'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {qty}{qty !== t.quantity && <span className="text-gray-300 dark:text-gray-700">/{t.quantity}</span>}
                      </td>

                      <td className="px-4 py-3 text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        Rs.{Number(t.entry_price).toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {t.exit_price ? `Rs.${Number(t.exit_price).toFixed(2)}` : <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-[10px] space-y-0.5">
                          {t.sl && <div className="text-red-400">SL {t.sl}</div>}
                          {t.tp && <div className="text-emerald-400">TP {t.tp}</div>}
                          {!t.sl && !t.tp && <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.status === 'CLOSED' || pnl !== 0 ? (
                          <span className={`text-[11px] font-bold ${signCls(pnl)}`}>
                            {pnl >= 0 ? '+' : ''}{fmtRs(pnl)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 dark:text-gray-700">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusPill[t.status] ?? ''}`}>
                          {t.status}
                        </span>
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
