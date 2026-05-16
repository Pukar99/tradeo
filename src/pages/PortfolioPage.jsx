import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getPositions, getTradeActions, getBatchPrices } from '../api'
import { useChatRefresh } from '../utils/chatEvents'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, ReferenceLine,
  AreaChart, Area, LineChart, Line, CartesianGrid,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtRs  = (n, forex = false) => forex
  ? `$${Math.abs(n).toFixed(2)}`
  : `Rs.${Math.abs(Math.round(n)).toLocaleString()}`
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${parseFloat(n).toFixed(2)}%`
const signCls = (n) => n >= 0 ? 'text-emerald-500' : 'text-red-400'
const signBg  = (n) => n >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'

function stockInitials(symbol) { return symbol?.slice(0, 2) || '??' }

const SYM_COLORS = [
  'bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500',
  'bg-pink-500','bg-teal-500','bg-red-500','bg-indigo-500',
  'bg-cyan-500','bg-orange-500',
]
const symColor   = (s) => SYM_COLORS[(s?.charCodeAt(0) || 0) % SYM_COLORS.length]

const DONUT_COLORS = [
  '#3b82f6','#10b981','#8b5cf6','#f59e0b',
  '#ec4899','#14b8a6','#ef4444','#6366f1','#06b6d4','#f97316',
]
const donutColor = (i) => DONUT_COLORS[i % DONUT_COLORS.length]

// ── Shared components ─────────────────────────────────────────────────────────

function SymAvatar({ symbol, size = 'w-8 h-8', text = 'text-[11px]' }) {
  return (
    <div className={`${size} ${symColor(symbol)} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <span className={`${text} font-bold text-white`}>{stockInitials(symbol)}</span>
    </div>
  )
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <span className="text-gray-300 dark:text-gray-700 ml-0.5 text-[10px]">↕</span>
  return <span className="text-blue-400 ml-0.5 text-[10px]">{sort.dir === 'asc' ? '↑' : '↓'}</span>
}

function EmptySlate({ icon, title, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2.5">
      <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">{icon}</div>
      <p className="text-[11px] text-gray-400">{title}</p>
      {action && (
        <button onClick={onAction} className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors">
          {action}
        </button>
      )}
    </div>
  )
}

// ── Risk Heat Dashboard ───────────────────────────────────────────────────────

function riskLevel(position, ltp, entry, sl) {
  if (ltp == null || sl == null || entry == null) return 'unknown'
  const e = parseFloat(entry), s = parseFloat(sl), l = parseFloat(ltp)
  if (isNaN(e) || isNaN(s) || isNaN(l)) return 'unknown'
  const distPct = position === 'LONG'
    ? ((l - s) / (Math.abs(e - s) || 1)) * 100
    : ((s - l) / (Math.abs(s - e) || 1)) * 100
  if (distPct < 0)   return 'breached'
  if (distPct < 15)  return 'critical'
  if (distPct < 35)  return 'warning'
  return 'safe'
}

const RISK_META = {
  breached: { label: 'SL Breached', dot: 'bg-red-600',    bar: 'bg-red-600',    card: 'border-red-500    bg-red-50    dark:bg-red-900/20',   text: 'text-red-600   dark:text-red-400',   order: 0 },
  critical: { label: 'Critical',    dot: 'bg-red-500',    bar: 'bg-red-500',    card: 'border-red-400    bg-red-50/60 dark:bg-red-900/10',   text: 'text-red-500   dark:text-red-400',   order: 1 },
  warning:  { label: 'Warning',     dot: 'bg-amber-400',  bar: 'bg-amber-400',  card: 'border-amber-300  bg-amber-50  dark:bg-amber-900/15', text: 'text-amber-500 dark:text-amber-400', order: 2 },
  safe:     { label: 'Safe',        dot: 'bg-emerald-400',bar: 'bg-emerald-400',card: 'border-emerald-200 bg-white     dark:bg-gray-900',     text: 'text-emerald-500',                  order: 3 },
  unknown:  { label: 'No SL',       dot: 'bg-gray-300',   bar: 'bg-gray-300',   card: 'border-gray-200   bg-white     dark:bg-gray-900',     text: 'text-gray-400',                     order: 4 },
}

function daysHeld(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  return Math.max(0, diff)
}

function breakEven(entry, qty, fees = 0) {
  const e = parseFloat(entry), q = parseFloat(qty)
  if (!e || !q) return null
  return (e + fees / q).toFixed(2)
}

function RiskHeatDashboard({ positions }) {
  if (positions.length === 0) return null

  const enriched = positions.map(t => {
    const ltp   = t.currentPrice
    const entry = parseFloat(t.entry_price) || 0
    const qty   = parseFloat(t.remaining_quantity ?? t.quantity) || 0
    const risk  = riskLevel(t.position, ltp, entry, t.sl)
    const meta  = RISK_META[risk]
    const days  = daysHeld(t.date)
    const be    = breakEven(entry, qty)

    // Distance to SL as % for progress bar (capped 0–100)
    let slDistPct = null
    if (ltp != null && t.sl != null) {
      const s = parseFloat(t.sl)
      const e = entry
      const raw = t.position === 'LONG'
        ? ((parseFloat(ltp) - s) / (Math.abs(e - s) || 1)) * 100
        : ((s - parseFloat(ltp)) / (Math.abs(s - e) || 1)) * 100
      slDistPct = Math.max(0, Math.min(100, raw))
    }

    return { ...t, risk, meta, days, be, slDistPct, entry, qty }
  }).sort((a, b) => a.meta.order - b.meta.order)

  const counts = enriched.reduce((acc, t) => { acc[t.risk] = (acc[t.risk] || 0) + 1; return acc }, {})

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Risk Heat</p>
          {['breached','critical','warning','safe'].map(r => counts[r] ? (
            <span key={r} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${RISK_META[r].card} ${RISK_META[r].text}`}>
              {counts[r]} {RISK_META[r].label}
            </span>
          ) : null)}
        </div>
        <p className="text-[9px] text-gray-300 dark:text-gray-700">sorted by risk · click row to chart</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {enriched.map(t => (
          <div key={t.id} className={`rounded-xl border p-3 ${t.meta.card}`}>
            {/* Top row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.meta.dot}`} />
                <span className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{t.symbol}</span>
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${t.meta.card} ${t.meta.text}`}>
                  {t.position === 'LONG' ? '↑L' : '↓S'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {t.days != null && (
                  <span className="text-[8px] text-gray-400 tabular-nums">{t.days}d</span>
                )}
                <span className={`text-[9px] font-bold ${t.meta.text}`}>{t.meta.label}</span>
              </div>
            </div>

            {/* Price row */}
            <div className="flex items-center gap-3 mb-2">
              <div>
                <p className="text-[8px] text-gray-400">Entry</p>
                <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">Rs.{t.entry.toFixed(2)}</p>
              </div>
              {t.currentPrice != null && (
                <div>
                  <p className="text-[8px] text-gray-400">LTP</p>
                  <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">Rs.{Number(t.currentPrice).toLocaleString()}</p>
                </div>
              )}
              {t.sl && (
                <div>
                  <p className="text-[8px] text-gray-400">SL</p>
                  <p className="text-[10px] font-semibold text-red-400 tabular-nums">{t.sl}</p>
                </div>
              )}
              {t.be && (
                <div className="ml-auto">
                  <p className="text-[8px] text-gray-400">Break-even</p>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">Rs.{t.be}</p>
                </div>
              )}
            </div>

            {/* SL proximity bar */}
            {t.slDistPct != null ? (
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[8px] text-gray-400">SL proximity</span>
                  <span className={`text-[8px] font-semibold tabular-nums ${t.meta.text}`}>{t.slDistPct.toFixed(0)}% away</span>
                </div>
                <div className="h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${t.meta.bar}`} style={{ width: `${t.slDistPct}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-[8px] text-gray-300 dark:text-gray-700 italic">No stop-loss set</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Risk gauge ────────────────────────────────────────────────────────────────

function RiskGauge({ entry, sl, tp, ltp, position, pnlPct }) {
  const hasFull = sl != null && tp != null && ltp != null

  if (hasFull) {
    const e = Number(entry), s = Number(sl), tp_ = Number(tp), l = Number(ltp)
    const lo = position === 'LONG' ? Math.min(s, e) : Math.min(tp_, e)
    const hi = position === 'LONG' ? Math.max(tp_, e) : Math.max(s, e)
    const range = hi - lo
    if (range <= 0) return null
    const ltpPct   = Math.max(0, Math.min(100, ((l - lo) / range) * 100))
    const entryPct = Math.max(0, Math.min(100, ((e - lo) / range) * 100))
    const distToSl = position === 'LONG'
      ? ((l - s) / (e - s || 1)) * 100
      : ((s - l) / (s - e || 1)) * 100
    const danger    = distToSl < 15 && distToSl >= 0
    const dotColor  = danger
      ? 'bg-red-500 ring-2 ring-red-300 dark:ring-red-800'
      : ltpPct > entryPct
        ? (position === 'LONG' ? 'bg-emerald-400' : 'bg-red-400')
        : (position === 'LONG' ? 'bg-red-400' : 'bg-emerald-400')

    return (
      <div className="mt-2 space-y-0.5">
        <div className="relative h-[4px] rounded-full overflow-visible" style={{ background: 'linear-gradient(to right, #fca5a5, #fef3c7, #6ee7b7)' }}>
          <div className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-gray-400 dark:bg-gray-500" style={{ left: `${entryPct}%` }} />
          <div className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-500 ${dotColor}`} style={{ left: `calc(${ltpPct}% - 5px)` }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[8px] text-red-400">SL {sl}</span>
          {danger && <span className="text-[8px] text-red-400 font-semibold animate-pulse">⚠ Near SL</span>}
          <span className="text-[8px] text-emerald-500">TP {tp}</span>
        </div>
      </div>
    )
  }

  if (pnlPct == null) return null
  const pct   = parseFloat(pnlPct)
  const width = Math.min(Math.abs(pct) * 4, 50)
  return (
    <div className="mt-2 h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
      <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
      <div
        className={`absolute h-full rounded-full transition-all duration-700 ${pct >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
        style={pct >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
      />
    </div>
  )
}

// ── Allocation donut ──────────────────────────────────────────────────────────

function AllocationDonut({ openPositions }) {
  const [active, setActive] = useState(null)

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
      .map(([symbol, value]) => ({ symbol, value, pct: tot > 0 ? ((value / tot) * 100).toFixed(1) : '0' }))
    return { data: entries, total: tot }
  }, [openPositions])

  if (total === 0) return null
  const activeEntry = active != null ? data[active] : null

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Capital Allocation</p>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={36} outerRadius={54}
                paddingAngle={data.length > 1 ? 2 : 0}
                dataKey="value"
                onMouseEnter={(_, idx) => setActive(idx)}
                onMouseLeave={() => setActive(null)}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={donutColor(i)} opacity={active === null || active === i ? 1 : 0.3} style={{ cursor: 'pointer', transition: 'opacity 0.15s' }} />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-2.5 py-1.5 shadow-lg">
                    <p className="text-[10px] font-bold text-gray-900 dark:text-white">{d.symbol}</p>
                    <p className="text-[9px] text-blue-500 font-semibold">{d.pct}%</p>
                  </div>
                )
              }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {activeEntry ? (
              <>
                <span className="text-[9px] font-bold text-gray-900 dark:text-white">{activeEntry.symbol}</span>
                <span className="text-[10px] font-bold text-blue-500">{activeEntry.pct}%</span>
              </>
            ) : (
              <>
                <span className="text-[8px] text-gray-400">invested</span>
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">Rs.{Math.round(total / 1000)}k</span>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5 overflow-y-auto no-scrollbar" style={{ maxHeight: 120 }}>
          {data.map((d, i) => (
            <div
              key={d.symbol}
              className={`flex items-center gap-1.5 cursor-default transition-opacity ${active !== null && active !== i ? 'opacity-30' : 'opacity-100'}`}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: donutColor(i) }} />
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate flex-1">{d.symbol}</span>
              <span className="text-[9px] text-gray-400 flex-shrink-0">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      {data[0] && parseFloat(data[0].pct) > 40 && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-[9px] text-amber-500">
            <span className="font-semibold">{data[0].symbol}</span> is {data[0].pct}% — high concentration
          </p>
        </div>
      )}
    </div>
  )
}

// ── Monthly P&L bar chart ─────────────────────────────────────────────────────

function MonthlyPnlChart({ closedTrades }) {
  const fx = false
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'short' }), value: 0 })
  }
  closedTrades.forEach(t => {
    if (t.realized_pnl == null) return
    const closeDate = t.updated_at ? t.updated_at.slice(0, 7) : t.date?.slice(0, 7)
    if (!closeDate) return
    const m = months.find(m => m.key === closeDate)
    if (m) m.value += parseFloat(t.realized_pnl) || 0
  })
  months.forEach(m => { m.value = Math.round(m.value) })
  const hasData   = months.some(m => m.value !== 0)
  const maxAbs    = Math.max(...months.map(m => Math.abs(m.value)), 1)
  const totalYear = months.reduce((s, m) => s + m.value, 0)
  const posMonths = months.filter(m => m.value > 0).length
  const negMonths = months.filter(m => m.value < 0).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Monthly P&L</p>
          <p className="text-[9px] text-gray-400 mt-0.5">
            <span className="text-emerald-500 font-semibold">{posMonths}↑</span>
            {' '}<span className="text-red-400 font-semibold">{negMonths}↓</span>
            {' '}over 12 months
          </p>
        </div>
        <span className={`text-[13px] font-bold ${signCls(totalYear)}`}>
          {totalYear >= 0 ? '+' : ''}{fmtRs(totalYear, fx)}
        </span>
      </div>
      {!hasData ? (
        <div className="h-[110px] flex items-center justify-center">
          <p className="text-[10px] text-gray-300 dark:text-gray-700">No closed trades yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={months} barSize={14} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#9ca3af' }} dy={4} />
            <YAxis hide domain={[-maxAbs * 1.2, maxAbs * 1.2]} />
            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const val = payload[0].value
                return (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-2.5 py-1.5 shadow-lg">
                    <p className="text-[9px] text-gray-400">{label}</p>
                    <p className={`text-[11px] font-bold ${val >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {val >= 0 ? '+' : ''}{fmtRs(val, fx)}
                    </p>
                  </div>
                )
              }}
              cursor={{ fill: 'transparent' }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {months.map((m, i) => <Cell key={i} fill={m.value >= 0 ? '#10b981' : '#f87171'} opacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Equity Curve ──────────────────────────────────────────────────────────────

function EquityCurve({ closedTrades }) {
  const fx = false
  if (closedTrades.length === 0) return null
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
    return { tradeNum: i + 1, date: t._closeDate, symbol: t.symbol, pnl, cumulative: Math.round(cumulative) }
  })

  const finalPnl   = data[data.length - 1].cumulative
  const isPositive = finalPnl >= 0
  let maxDD = 0, runningPeak = data[0].cumulative
  for (const d of data) {
    if (d.cumulative > runningPeak) runningPeak = d.cumulative
    const dd = runningPeak - d.cumulative
    if (dd > maxDD) maxDD = dd
  }

  const gradId    = `eqGrad_${isPositive ? 'p' : 'n'}_${sorted.length}`
  const lineColor = isPositive ? '#10b981' : '#f87171'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Equity Curve</p>
          <p className="text-[9px] text-gray-400 mt-0.5">{sorted.length} closed trades · max DD: <span className="text-amber-500 font-medium">{fmtRs(maxDD, fx)}</span></p>
        </div>
        <span className={`text-[13px] font-bold ${signCls(finalPnl)}`}>
          {finalPnl >= 0 ? '+' : ''}{fmtRs(finalPnl, fx)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="tradeNum" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3 3" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-2.5 py-1.5 shadow-lg">
                  <p className="text-[8px] text-gray-400">Trade #{d.tradeNum} · {d.date}</p>
                  <p className={`text-[11px] font-bold ${signCls(d.cumulative)}`}>
                    {d.cumulative >= 0 ? '+' : ''}{fmtRs(d.cumulative, fx)}
                  </p>
                </div>
              )
            }}
            cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Area type="monotone" dataKey="cumulative" stroke={lineColor} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Drawdown + Equity Widget ──────────────────────────────────────────────────

function DrawdownWidget({ equityCurve, currentDrawdown, maxDrawdown, peakEquity, currentEquity, dailyStreak }) {
  const [tab, setTab] = useState('equity') // 'equity' | 'drawdown'

  if (equityCurve.length === 0) return null

  const ddColor = currentDrawdown === 0 ? 'text-emerald-500'
    : currentDrawdown < 10 ? 'text-amber-500'
    : 'text-red-500'

  const ddBg = currentDrawdown === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
    : currentDrawdown < 10 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          {[
            { key: 'equity',   label: 'Equity Curve' },
            { key: 'drawdown', label: 'Drawdown' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                tab === t.key
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${ddBg} ${ddColor}`}>
            DD: {currentDrawdown.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-400 whitespace-nowrap">
            Max: <span className="font-semibold text-red-400">{maxDrawdown.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="px-2 pt-3 pb-1">
        {tab === 'equity' ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={equityCurve} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={currentEquity >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={currentEquity >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false}
                tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={48}
                tickFormatter={v => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(v, n, p) => [`Rs.${Number(v).toLocaleString()}`, 'Equity']}
                labelFormatter={l => l}
              />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="equity" stroke={currentEquity >= 0 ? '#10b981' : '#ef4444'}
                strokeWidth={2} fill="url(#eqGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={equityCurve} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false}
                tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={36}
                tickFormatter={v => `${v.toFixed(0)}%`} reversed />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(v) => [`${v.toFixed(2)}%`, 'Drawdown']}
                labelFormatter={l => l}
              />
              <Area type="monotone" dataKey="drawdown" stroke="#ef4444"
                strokeWidth={2} fill="url(#ddGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily streak dots */}
      {dailyStreak.length > 0 && (
        <div className="px-4 pb-3 pt-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Last {dailyStreak.length} trading days</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {dailyStreak.map((d, i) => (
              <div key={i} title={`${d.date}: ${d.pnl >= 0 ? '+' : ''}Rs.${d.pnl.toLocaleString()}`}
                className={`relative group w-5 h-5 rounded-md flex-shrink-0 ${d.win ? 'bg-emerald-400' : 'bg-red-400'}`}>
                {/* tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-gray-900 text-white text-[9px] px-2 py-1 rounded-lg whitespace-nowrap">
                    {d.date.slice(5)}: {d.pnl >= 0 ? '+' : ''}Rs.{Math.abs(d.pnl).toLocaleString()}
                  </div>
                  <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mt-1" />
                </div>
              </div>
            ))}
            <div className="ml-1 flex items-center gap-2 text-[9px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />Win</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />Loss</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function PortfolioPage() {
  // v2.2 data: positions from position_view, action rows for recent trades
  const [positions, setPositions]     = useState([])   // position_view rows (all statuses)
  const [recentActions, setRecentActions] = useState([]) // trade_log action rows, newest first
  const [loading, setLoading]         = useState(true)
  const [ltpLoading, setLtpLoading]   = useState(false)
  const [fetchError, setFetchError]   = useState(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState({ col: 'last_action_at', dir: 'desc' })

  const { user }   = useAuth()
  const navigate   = useNavigate()
  const fmtC = (n) => `Rs.${Math.abs(Math.round(n)).toLocaleString()}`

  const fetchData = useCallback(async () => {
    try {
      const [posRes, actRes] = await Promise.all([
        getPositions(),      // position_view — all statuses
        getTradeActions(),   // all action rows newest first
      ])

      const allPositions = posRes.data ?? []
      setPositions(allPositions)
      setRecentActions(actRes.data ?? [])

      const open = allPositions.filter(p => p.status === 'OPEN' || p.status === 'PARTIAL')
      setLoading(false)

      if (open.length === 0) return

      setLtpLoading(true)
      try {
        const syms = [...new Set(open.map(p => p.symbol))]
        const batchRes = await getBatchPrices(syms)
        const priceMap = batchRes.data.prices ?? {}
        setPositions(prev => prev.map(p => {
          if (p.status !== 'OPEN' && p.status !== 'PARTIAL') return p
          const pr   = priceMap[p.symbol]
          if (!pr) return { ...p, currentPrice: null, unrealizedPnl: null, pnlPct: null }
          const qty   = parseFloat(p.total_qty) || 0
          const wacc  = parseFloat(p.wacc) || 0
          const ltp   = parseFloat(pr.price) || 0
          // direction from position_view.direction (or derive via status fallback)
          const dir   = (p.direction || 'LONG').toUpperCase()
          const pnl   = dir === 'SHORT' ? (wacc - ltp) * qty : (ltp - wacc) * qty
          const invested = wacc * qty
          const pnlPct = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : '0.00'
          return { ...p, currentPrice: ltp, change: pr.change, unrealizedPnl: Math.round(pnl), pnlPct }
        }))
      } catch { /* prices optional */ } finally {
        setLtpLoading(false)
      }
    } catch (err) {
      console.error('PortfolioPage fetch error:', err)
      setFetchError('Failed to load portfolio data. Please refresh.')
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { if (user?.id) fetchData() }, [user?.id, fetchData])
  useChatRefresh(['trades'], fetchData)

  const handleGoToChart = ({ symbol, trade_id, wacc, sl, tp, direction, total_qty, opened_at }) => {
    navigate('/screen', { state: { symbol, positions: [{
      id:          trade_id,
      entry_price: parseFloat(wacc),
      sl:          sl ? parseFloat(sl) : null,
      tp:          tp ? parseFloat(tp) : null,
      position:    (direction || 'LONG').toUpperCase(),
      quantity:    parseFloat(total_qty) || 0,
      entry_date:  opened_at?.slice(0, 10),
    }] } })
  }

  const toggleSort = (col) => setSort(prev => prev.col === col ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })

  // ── Derived stats ─────────────────────────────────────────────────────────

  const openPositions   = positions.filter(p => p.status === 'OPEN' || p.status === 'PARTIAL')
  const closedPositions = positions.filter(p => p.status === 'CLOSED')

  // Sum realized_pnl from all exit-type action rows (Close, Reversal, Partial Exit)
  const closedPnlByTrade = useMemo(() => {
    const map = {}
    recentActions.forEach(row => {
      if (row.action_type === 'Close Position' || row.action_type === 'Reversal' || row.action_type === 'Partial Exit') {
        const pnl = parseFloat(row.realized_pnl) || 0
        map[row.trade_id] = (map[row.trade_id] || 0) + pnl
      }
    })
    return map
  }, [recentActions])

  const closedTrades = useMemo(() =>
    closedPositions.map(p => ({
      ...p,
      realized_pnl: parseFloat(closedPnlByTrade[p.trade_id]) || 0,
    }))
  , [closedPositions, closedPnlByTrade])

  const totalInvested   = openPositions.reduce((s, p) => s + (parseFloat(p.wacc) || 0) * (parseFloat(p.total_qty) || 0), 0)
  const totalUnrealized = openPositions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0)
  const totalRealized   = closedTrades.reduce((s, p) => s + p.realized_pnl, 0)
  const totalPnl        = totalRealized + totalUnrealized

  const wins        = closedTrades.filter(t => t.realized_pnl > 0)
  const losses      = closedTrades.filter(t => t.realized_pnl < 0)
  const winRate     = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : null
  const grossWin    = wins.reduce((s, t) => s + t.realized_pnl, 0)
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.realized_pnl, 0))
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : wins.length > 0 ? '∞' : null

  const withPnl    = closedTrades.filter(t => t.realized_pnl != null)
  const bestTrade  = withPnl.length > 0 ? withPnl.reduce((a, b) => b.realized_pnl > a.realized_pnl ? b : a) : null
  const worstTrade = withPnl.length > 0 ? withPnl.reduce((a, b) => b.realized_pnl < a.realized_pnl ? b : a) : null

  const equityCurve = useMemo(() => {
    const sorted = [...closedTrades]
      .filter(t => t.last_action_at)
      .sort((a, b) => a.last_action_at > b.last_action_at ? 1 : -1)
    if (sorted.length === 0) return []
    let equity = 0, peak = 0
    return sorted.map(t => {
      equity += t.realized_pnl
      if (equity > peak) peak = equity
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
      return {
        date:     t.last_action_at.slice(0, 10),
        equity:   Math.round(equity),
        drawdown: parseFloat(dd.toFixed(2)),
        pnl:      Math.round(t.realized_pnl),
        symbol:   t.symbol,
      }
    })
  }, [closedTrades])

  const currentDrawdown = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].drawdown : 0
  const maxDrawdown     = equityCurve.length > 0 ? Math.max(...equityCurve.map(p => p.drawdown)) : 0
  const peakEquity      = equityCurve.length > 0 ? Math.max(...equityCurve.map(p => p.equity)) : 0
  const currentEquity   = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0

  const dailyStreak = useMemo(() => {
    const byDate = {}
    closedTrades.forEach(t => {
      const d = t.last_action_at?.slice(0, 10)
      if (!d) return
      byDate[d] = (byDate[d] || 0) + t.realized_pnl
    })
    return Object.entries(byDate)
      .sort((a, b) => a[0] > b[0] ? 1 : -1)
      .slice(-14)
      .map(([date, pnl]) => ({ date, pnl: Math.round(pnl), win: pnl > 0 }))
  }, [closedTrades])

  // Top 10 recent action rows (New Position / Close Position only for "recent trades" display)
  const top10Recent = useMemo(() =>
    recentActions
      .filter(r => r.action_type === 'New Position' || r.action_type === 'Close Position' || r.action_type === 'Reversal')
      .slice(0, 10)
  , [recentActions])

  // History filter/sort — based on positions (one row per trade_id)
  const sortVal = (p) => {
    if (sort.col === 'last_action_at') return p.last_action_at ?? ''
    if (sort.col === 'symbol')         return p.symbol ?? ''
    if (sort.col === 'wacc')           return Number(p.wacc) ?? 0
    if (sort.col === 'pnl')            return closedPnlByTrade[p.trade_id] ?? 0
    if (sort.col === 'qty')            return Number(p.total_qty) ?? 0
    return ''
  }
  const histPositions = positions
    .filter(p => filterStatus === 'ALL' || p.status === filterStatus)
    .filter(p => !search.trim() || p.symbol.toUpperCase().includes(search.trim().toUpperCase()))
    .sort((a, b) => {
      const av = sortVal(a), bv = sortVal(b)
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center max-w-sm w-full">
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
    <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[11px] text-gray-400">Loading portfolio…</p>
      </div>
    </div>
  )

  if (fetchError) return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center space-y-3">
        <p className="text-[13px] text-red-400 font-medium">{fetchError}</p>
        <button onClick={() => { setFetchError(null); setLoading(true); fetchData() }} className="text-[11px] text-blue-500 border border-blue-200 dark:border-blue-800 px-4 py-1.5 rounded-lg transition-colors hover:text-blue-400">Retry</button>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 lg:pt-5 pb-14 space-y-4 sm:space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">Portfolio</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Live positions · performance overview</p>
        </div>
        <button
          onClick={() => navigate('/logs')}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Trade
        </button>
      </div>

      {/* ── Row 1: Pie chart + stat cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Allocation pie */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          {openPositions.length > 0
            ? <AllocationDonut openPositions={openPositions.map(p => ({ ...p, entry_price: p.wacc, remaining_quantity: p.total_qty, quantity: p.total_qty }))} />
            : (
              <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Capital Allocation</p>
                <p className="text-[10px] text-gray-300 dark:text-gray-700">No open positions</p>
              </div>
            )
          }
        </div>

        {/* Stat cards: Total P&L · Realized · Unrealized */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: 'Total P&L',
              value: `${totalPnl >= 0 ? '+' : ''}${fmtC(totalPnl)}`,
              cls: signCls(totalPnl),
              sub: 'realized + unrealized',
              accent: totalPnl >= 0 ? 'border-t-emerald-400' : 'border-t-red-400',
              detail: [
                { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—', cls: winRate != null ? (winRate >= 50 ? 'text-emerald-500' : 'text-red-400') : 'text-gray-400' },
                { label: 'Profit Factor', value: profitFactor ?? '—', cls: profitFactor ? (parseFloat(profitFactor) >= 1 ? 'text-emerald-500' : 'text-red-400') : 'text-gray-400' },
              ],
            },
            {
              label: 'Realized',
              value: `${totalRealized >= 0 ? '+' : ''}${fmtC(totalRealized)}`,
              cls: signCls(totalRealized),
              sub: `${closedTrades.length} closed trades`,
              accent: 'border-t-blue-400',
              detail: [
                bestTrade  ? { label: 'Best',  value: `+${fmtC(bestTrade.realized_pnl)}`,  cls: 'text-emerald-500' } : null,
                worstTrade ? { label: 'Worst', value: fmtC(worstTrade.realized_pnl), cls: 'text-red-400' } : null,
              ].filter(Boolean),
            },
            {
              label: 'Unrealized',
              value: `${totalUnrealized >= 0 ? '+' : ''}${fmtC(totalUnrealized)}`,
              cls: signCls(totalUnrealized),
              sub: `${openPositions.length} open${ltpLoading ? ' · updating…' : ''}`,
              accent: 'border-t-violet-400',
              detail: [
                { label: 'Invested', value: fmtC(totalInvested), cls: 'text-gray-600 dark:text-gray-300' },
                currentDrawdown > 0 ? { label: 'Max DD', value: `${maxDrawdown.toFixed(1)}%`, cls: 'text-red-400' } : null,
              ].filter(Boolean),
            },
          ].map((s, i) => (
            <div key={i} className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-t-2 ${s.accent} p-4 flex flex-col gap-3`}>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{s.label}</p>
                <p className={`text-[22px] font-black tracking-tight leading-none tabular-nums ${s.cls}`}>{s.value}</p>
                <p className="text-[9px] text-gray-400 mt-1.5">{s.sub}</p>
              </div>
              {s.detail.length > 0 && (
                <div className="flex items-center gap-3 border-t border-gray-50 dark:border-gray-800 pt-2.5">
                  {s.detail.map((d, j) => (
                    <div key={j}>
                      <p className="text-[8px] text-gray-400 uppercase tracking-widest">{d.label}</p>
                      <p className={`text-[11px] font-bold tabular-nums ${d.cls}`}>{d.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 2: Top 10 recent trades ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Recent Trades</p>
          <span className="text-[9px] text-gray-400">last {Math.min(top10Recent.length, 10)} entries</span>
        </div>
        {top10Recent.length === 0 ? (
          <EmptySlate
            icon={<svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            title="No trades yet"
            action="Add your first trade →"
            onAction={() => navigate('/logs')}
          />
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-50 dark:border-gray-800/60 bg-gray-50/30 dark:bg-gray-800/10">
                  {['Date', 'Symbol', 'Action', 'Qty', 'Price', 'P&L', 'Setup'].map((h, i) => (
                    <th key={i} className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top10Recent.map(row => {
                  const isClose = row.action_type === 'Close Position' || row.action_type === 'Reversal'
                  const isNew   = row.action_type === 'New Position'
                  const pnl     = parseFloat(row.realized_pnl) || 0
                  return (
                    <tr key={row.id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-2.5 text-[10px] text-gray-400 tabular-nums whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <SymAvatar symbol={row.symbol} size="w-5 h-5" text="text-[8px]" />
                          <span className="text-[12px] font-bold text-gray-900 dark:text-white">{row.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isNew   ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                          isClose ? 'text-gray-500 bg-gray-100 dark:bg-gray-800' :
                          'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        }`}>
                          {row.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-gray-600 dark:text-gray-400 tabular-nums">{row.quantity}</td>
                      <td className="px-4 py-2.5 text-[10px] font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                        {fmtC(parseFloat(row.entry_price || row.exit_price) || 0)}
                      </td>
                      <td className="px-4 py-2.5">
                        {isClose && pnl !== 0 ? (
                          <span className={`text-[11px] font-bold tabular-nums ${signCls(pnl)}`}>
                            {pnl >= 0 ? '+' : ''}{fmtC(pnl)}
                          </span>
                        ) : <span className="text-[10px] text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[9px] text-gray-400 truncate max-w-[100px]">
                        {row.setup_type || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Row 3: Holdings (open positions) ────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Holdings</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500">{openPositions.length}</span>
          </div>
          {ltpLoading && (
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 border-t-blue-400 rounded-full animate-spin inline-block" />
              Fetching prices…
            </span>
          )}
        </div>

        {openPositions.length === 0 ? (
          <EmptySlate
            icon={<svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            title="No open positions"
            action="Log a trade →"
            onAction={() => navigate('/logs')}
          />
        ) : (
          <>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {['Symbol', 'Dir', 'Qty / WACC', 'LTP', 'P&L', 'Invested', 'SL / TP', ''].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest first:px-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map(p => {
                    const dir     = (p.direction || 'LONG').toUpperCase()
                    const qty     = parseFloat(p.total_qty) || 0
                    const wacc    = parseFloat(p.wacc) || 0
                    const invested = wacc * qty
                    const pnl     = p.unrealizedPnl ?? 0
                    const pnlPct  = parseFloat(p.pnlPct ?? 0)
                    return (
                      <tr key={p.trade_id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <SymAvatar symbol={p.symbol} size="w-7 h-7" text="text-[10px]" />
                            <div>
                              <p className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{p.symbol}</p>
                              <p className="text-[9px] text-gray-400">{p.last_action_at?.slice(0, 10)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex text-[8px] font-semibold px-1.5 py-0.5 rounded-full w-fit ${
                              dir === 'LONG' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'
                            }`}>
                              {dir === 'LONG' ? '↑ L' : '↓ S'}
                            </span>
                            {p.status === 'PARTIAL' && (
                              <span className="inline-flex text-[8px] font-semibold px-1.5 py-0.5 rounded-full w-fit text-amber-500 bg-amber-50 dark:bg-amber-900/20">Partial</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[10px]">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{qty}</p>
                          <p className="text-gray-400 tabular-nums">@ Rs.{wacc.toFixed(2)}</p>
                        </td>
                        <td className="px-3 py-3 text-[11px] font-bold text-gray-800 dark:text-white tabular-nums">
                          {p.currentPrice != null
                            ? `Rs.${Number(p.currentPrice).toLocaleString()}`
                            : <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          {p.unrealizedPnl != null ? (
                            <div>
                              <p className={`text-[11px] font-bold tabular-nums ${signCls(pnl)}`}>
                                {pnl >= 0 ? '+' : ''}{fmtC(pnl)}
                              </p>
                              <p className={`text-[9px] font-medium ${signCls(pnlPct)}`}>{fmtPct(pnlPct)}</p>
                            </div>
                          ) : <span className="text-[10px] text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-gray-400 tabular-nums">{fmtC(invested)}</td>
                        <td className="px-3 py-3">
                          <div className="text-[9px] space-y-0.5">
                            {p.sl ? <p className="text-red-400">SL {p.sl}</p> : <p className="text-gray-300 dark:text-gray-700">No SL</p>}
                            {p.tp ? <p className="text-emerald-500">TP {p.tp}</p> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleGoToChart(p)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-blue-500 hover:text-blue-400 font-semibold"
                          >
                            Chart →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                Total invested: <span className="font-semibold text-gray-700 dark:text-gray-300">{fmtC(totalInvested)}</span>
              </span>
              <span className={`text-[11px] font-bold ${signCls(totalUnrealized)}`}>
                {totalUnrealized >= 0 ? '+' : ''}{fmtC(totalUnrealized)} unrealized
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Row 4: Trade history ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-wrap">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Trade History</p>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="relative">
              <svg className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Symbol…"
                className="pl-6 pr-2.5 py-1 text-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:border-blue-400 w-20 transition-all"
              />
            </div>
            <div className="flex gap-1">
              {['ALL', 'OPEN', 'PARTIAL', 'CLOSED'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-semibold transition-colors ${
                    filterStatus === s ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400">{histPositions.length}/{positions.length}</span>
          </div>
        </div>

        {positions.length === 0 ? (
          <EmptySlate
            icon={<svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            title="No trades yet"
            action="Add your first trade →"
            onAction={() => navigate('/logs')}
          />
        ) : histPositions.length === 0 ? (
          <EmptySlate
            icon={<svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
            title="No trades match"
            action="Clear filters"
            onAction={() => { setFilterStatus('ALL'); setSearch('') }}
          />
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
                  {[
                    { key: 'last_action_at', label: 'Last Action',  sortable: true  },
                    { key: 'symbol',         label: 'Symbol',        sortable: true  },
                    { key: null,             label: 'Dir',           sortable: false },
                    { key: 'qty',            label: 'Qty',           sortable: true  },
                    { key: 'wacc',           label: 'WACC',          sortable: true  },
                    { key: null,             label: 'SL / TP',       sortable: false },
                    { key: 'pnl',            label: 'Realized P&L',  sortable: true  },
                    { key: null,             label: 'Status',        sortable: false },
                  ].map((c, i) => (
                    <th
                      key={i}
                      onClick={() => c.key && toggleSort(c.key)}
                      className={`px-4 py-2.5 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest select-none whitespace-nowrap ${c.sortable ? 'cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors' : ''}`}
                    >
                      {c.label}{c.key && <SortIcon col={c.key} sort={sort} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {histPositions.map(p => {
                  const pnl = closedPnlByTrade[p.trade_id] ?? 0
                  const dir = (p.direction || 'LONG').toUpperCase()
                  return (
                    <tr key={p.trade_id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer" onClick={() => handleGoToChart(p)}>
                      <td className="px-4 py-3 text-[10px] text-gray-400 tabular-nums whitespace-nowrap">{p.last_action_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <SymAvatar symbol={p.symbol} size="w-5 h-5" text="text-[8px]" />
                          <span className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{p.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          dir === 'LONG' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'
                        }`}>
                          {dir === 'LONG' ? '↑ L' : '↓ S'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-gray-600 dark:text-gray-400 tabular-nums">{p.total_qty}</td>
                      <td className="px-4 py-3 text-[10px] font-medium text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
                        {fmtC(parseFloat(p.wacc) || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[9px] space-y-0.5">
                          {p.sl ? <div className="text-red-400">SL {p.sl}</div> : null}
                          {p.tp ? <div className="text-emerald-500">TP {p.tp}</div> : null}
                          {!p.sl && !p.tp && <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.status === 'CLOSED' ? (
                          <span className={`text-[11px] font-bold tabular-nums ${signCls(pnl)}`}>
                            {pnl >= 0 ? '+' : ''}{fmtC(pnl)}
                          </span>
                        ) : <span className="text-[10px] text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          p.status === 'OPEN'    ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                          p.status === 'PARTIAL' ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' :
                          'text-gray-400 bg-gray-100 dark:bg-gray-800'
                        }`}>
                          {p.status}
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
