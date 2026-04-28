import { useState, useMemo, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import TraderCard from './TraderCard'

// ── NEPSE broker commission tiers ─────────────────────────────────────────────
function calcBrokerFee(tradeValue) {
  if (tradeValue <= 0) return 0
  let rate
  if      (tradeValue <= 50000)    rate = 0.0060
  else if (tradeValue <= 500000)   rate = 0.0055
  else if (tradeValue <= 2000000)  rate = 0.0050
  else if (tradeValue <= 10000000) rate = 0.0045
  else                             rate = 0.0040
  return tradeValue * rate
}

// Nepal CGT: 7.5% short-term (<365 days), 5% long-term (>=365 days)
// Fiscal year: Jul 16 – Jul 15
function calcCGT(pnl, entryDateStr, exitDateStr) {
  if (pnl <= 0) return 0
  const entry = new Date(entryDateStr)
  const exit  = new Date(exitDateStr)
  const days  = Math.max(0, Math.floor((exit - entry) / 86400000))
  const rate  = days >= 365 ? 0.05 : 0.075
  return pnl * rate
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, valueClass = 'text-gray-900 dark:text-white', sub, icon }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3.5 flex flex-col gap-0.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">{label}</p>
        {icon && <span className="text-[13px]">{icon}</span>}
      </div>
      <p className={`text-[15px] font-black tracking-tight tabular-nums leading-tight ${valueClass}`}>{value}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Share modal ───────────────────────────────────────────────────────────────
function ShareModal({ onClose, kpis, trades, dateLabel, user }) {
  const cardRef    = useRef(null)
  const [gen, setGen]    = useState(false)
  const [pdfGen, setPdfGen] = useState(false)
  const [err, setErr]    = useState(null)

  const handleDownloadCard = async () => {
    if (!cardRef.current) return
    setGen(true); setErr(null)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const url = canvas.toDataURL('image/png')
      const a   = document.createElement('a')
      a.href     = url
      a.download = `tradeo-card-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
    } catch {
      setErr('Failed to generate image. Please try again.')
    } finally {
      setGen(false)
    }
  }

  const handleDownloadPDF = async () => {
    setPdfGen(true); setErr(null)
    try {
      // Capture card as image first
      const html2canvas = (await import('html2canvas')).default
      let cardDataUrl = null
      if (cardRef.current) {
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: '#0f172a',
          scale: 2,
          useCORS: true,
          logging: false,
        })
        cardDataUrl = canvas.toDataURL('image/png')
      }

      // Build PDF via browser print window (no jsPDF dep needed)
      const fmt = (n, isFx) =>
        isFx
          ? `$${Math.abs(n).toFixed(2)}`
          : `Rs.${Math.abs(Math.round(n)).toLocaleString()}`

      const tradeRows = trades.map(t => {
        const entryDate = t.date || ''
        const exitDate  = (t.updated_at || t.date || '').slice(0, 10)
        const days      = entryDate && exitDate
          ? Math.max(0, Math.floor((new Date(exitDate) - new Date(entryDate)) / 86400000))
          : 0
        const pnl = parseFloat(t.realized_pnl) || 0
        const isFx = t.market === 'forex'
        return `<tr style="border-bottom:1px solid #e5e7eb">
          <td>${entryDate}</td>
          <td style="font-weight:700">${t.symbol}</td>
          <td style="color:${t.position === 'LONG' ? '#059669' : '#dc2626'}">${t.position}</td>
          <td>${isFx && t.lots ? `${parseFloat(t.lots)}L` : (t.remaining_quantity ?? t.quantity)}</td>
          <td>${parseFloat(t.entry_price).toFixed(2)}</td>
          <td>${t.exit_price ? parseFloat(t.exit_price).toFixed(2) : '—'}</td>
          <td style="color:${pnl >= 0 ? '#059669' : '#dc2626'};font-weight:600">${pnl >= 0 ? '+' : '−'}${fmt(pnl, isFx)}</td>
          <td>${days}d</td>
        </tr>`
      }).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Tradeo Performance Report</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}
  h1{font-size:18px;margin-bottom:4px}
  .sub{color:#6b7280;font-size:11px;margin-bottom:24px}
  .card-img{width:100%;max-width:480px;border-radius:12px;margin-bottom:24px;display:block}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
  .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:10px}
  .kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
  .kpi-value{font-size:15px;font-weight:700;margin-top:4px}
  .pos{color:#059669}.neg{color:#dc2626}.neu{color:#111}.pur{color:#7c3aed}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f9fafb;padding:7px 5px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#374151}
  td{padding:6px 5px;vertical-align:middle}
  .note{margin-top:20px;font-size:9px;color:#9ca3af;line-height:1.6}
  @media print{body{padding:16px}}
</style></head><body>
<h1>Tradeo Performance Report</h1>
<p class="sub">${dateLabel} · Generated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} · tradeo-seven.vercel.app</p>
${cardDataUrl ? `<img src="${cardDataUrl}" class="card-img" alt="Trader Card"/>` : ''}
<div class="grid">
  <div class="kpi"><div class="kpi-label">Net P&L</div><div class="kpi-value ${kpis.netPnl >= 0 ? 'pos' : 'neg'}">${kpis.netPnl >= 0 ? '+' : '−'}Rs.${Math.abs(Math.round(kpis.netPnl)).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Win Rate</div><div class="kpi-value neu">${kpis.winRate !== null ? kpis.winRate.toFixed(1) + '%' : '—'}</div></div>
  <div class="kpi"><div class="kpi-label">Profit Factor</div><div class="kpi-value neu">${kpis.profitFactor !== null ? (kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)) : '—'}</div></div>
  <div class="kpi"><div class="kpi-label">Total Trades</div><div class="kpi-value neu">${kpis.totalTrades}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-value pos">Rs.${Math.round(kpis.grossProfit).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Loss</div><div class="kpi-value neg">Rs.${Math.round(kpis.grossLoss).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Est. Broker Fees</div><div class="kpi-value pur">Rs.${Math.round(kpis.brokerFees).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Est. CGT</div><div class="kpi-value pur">Rs.${Math.round(kpis.cgt).toLocaleString()}</div></div>
</div>
<table>
  <thead><tr><th>Entry Date</th><th>Symbol</th><th>Dir</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Hold</th></tr></thead>
  <tbody>${tradeRows}</tbody>
</table>
<p class="note">Nepal CGT: Short-term (&lt;365d) 7.5%, Long-term (≥365d) 5%. Broker fees: NEPSE commission tiers 0.40%–0.60%. This is an estimate — consult a tax advisor for official filing.</p>
</body></html>`

      const win = window.open('', '_blank')
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print(); setPdfGen(false) }, 400)
    } catch {
      setErr('Failed to generate PDF. Please try again.')
      setPdfGen(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Share My Stats</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Card preview */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-3">Trader Card Preview</p>
            <div className="flex justify-center">
              <TraderCard ref={cardRef} kpis={kpis} trades={trades} dateLabel={dateLabel} user={user} />
            </div>
          </div>

          {err && (
            <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">
              {err}
            </p>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadCard}
              disabled={gen || pdfGen}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {gen ? 'Generating…' : 'Download Card (PNG)'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={gen || pdfGen}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {pdfGen ? 'Generating…' : 'Download PDF Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main AuditTab ─────────────────────────────────────────────────────────────
export default function AuditTab({ trades, market, user }) {
  const { isDark } = useTheme()
  const isForex    = market === 'forex'

  // Default date range: current month start → today
  const today     = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const [fromDate, setFromDate]     = useState(monthStart)
  const [toDate,   setToDate]       = useState(today)
  const [applied,  setApplied]      = useState({ from: monthStart, to: today })
  const [showShare, setShowShare]   = useState(false)

  const handleApply = () => setApplied({ from: fromDate, to: toDate })

  // Filter trades by date range (entry date) + market
  const rangedTrades = useMemo(() => {
    return trades.filter(t => {
      if (t.market !== market && !((!t.market) && market === 'nepse')) return false
      if (applied.from && t.date < applied.from) return false
      if (applied.to   && t.date > applied.to)   return false
      return true
    })
  }, [trades, market, applied])

  const closed = rangedTrades.filter(t => t.status === 'CLOSED')

  // ── KPI calculations (all client-side from loaded trades array) ────────────
  const kpis = useMemo(() => {
    const totalTrades = rangedTrades.length
    const winners     = closed.filter(t => (parseFloat(t.realized_pnl) || 0) > 0)
    const losers      = closed.filter(t => (parseFloat(t.realized_pnl) || 0) < 0)
    const winRate     = closed.length > 0 ? (winners.length / closed.length) * 100 : null

    const grossProfit = winners.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
    const grossLoss   = Math.abs(losers.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0))
    const netPnl      = grossProfit - grossLoss
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null

    // Broker fees — only NEPSE trades (entry value × tier rate, each side)
    let brokerFees = 0
    let cgt        = 0
    let totalTradedValue = 0

    for (const t of closed) {
      const entry = parseFloat(t.entry_price) || 0
      const qty   = parseFloat(t.remaining_quantity ?? t.quantity) || 0
      const exitP = parseFloat(t.exit_price) || 0
      const pnl   = parseFloat(t.realized_pnl) || 0

      if (t.market !== 'forex') {
        const entryVal = entry * qty
        const exitVal  = exitP * qty
        brokerFees   += calcBrokerFee(entryVal) + calcBrokerFee(exitVal)
        totalTradedValue += entryVal
        // CGT on realized gain only
        const exitDate = (t.updated_at || t.date || '').slice(0, 10)
        if (pnl > 0 && t.date && exitDate) {
          cgt += calcCGT(pnl, t.date, exitDate)
        }
      } else {
        totalTradedValue += entry * (parseFloat(t.lots) || qty)
      }
    }

    const netAfterTaxFees = netPnl - brokerFees - cgt

    // Avg R:R from trades with SL + TP
    const rrTrades = closed.filter(t => t.sl && t.tp)
    const avgRR    = rrTrades.length > 0
      ? rrTrades.reduce((s, t) => {
          const e    = parseFloat(t.entry_price)
          const risk = Math.abs(e - parseFloat(t.sl))
          const rew  = Math.abs(parseFloat(t.tp) - e)
          return s + (risk > 0 ? rew / risk : 0)
        }, 0) / rrTrades.length
      : null

    // Max drawdown from equity curve of closed trades sorted by exit date
    const sortedClosed = [...closed].sort((a, b) => {
      const ad = (a.updated_at || a.date || '')
      const bd = (b.updated_at || b.date || '')
      return ad < bd ? -1 : 1
    })
    let equity = 0, peak = 0, maxDDPct = 0
    for (const t of sortedClosed) {
      equity += parseFloat(t.realized_pnl) || 0
      if (equity > peak) peak = equity
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
      if (dd > maxDDPct) maxDDPct = dd
    }

    // Best / worst
    const sortedByPnl = [...closed].sort((a, b) => (parseFloat(b.realized_pnl) || 0) - (parseFloat(a.realized_pnl) || 0))
    const bestTrade   = sortedByPnl[0] || null
    const worstTrade  = sortedByPnl[sortedByPnl.length - 1] || null

    // Avg hold days (closed trades with dates)
    const closedWithDates = closed.filter(t => t.date && t.updated_at)
    const avgHoldDays     = closedWithDates.length > 0
      ? closedWithDates.reduce((s, t) => {
          const d = Math.max(0, Math.floor((new Date(t.updated_at.slice(0,10)) - new Date(t.date)) / 86400000))
          return s + d
        }, 0) / closedWithDates.length
      : null

    // Daily win streak (current)
    const byDate = {}
    for (const t of closed) {
      const d = (t.updated_at || t.date || '').slice(0, 10)
      if (!d) continue
      byDate[d] = (byDate[d] || 0) + (parseFloat(t.realized_pnl) || 0)
    }
    const days = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a))
    let streak = 0
    for (const [, pnl] of days) {
      if (pnl > 0) streak++
      else break
    }

    // Equity curve points for sparkline
    const equityCurve = sortedClosed.reduce((acc, t) => {
      const prev = acc[acc.length - 1] ?? 0
      acc.push(prev + (parseFloat(t.realized_pnl) || 0))
      return acc
    }, [])

    return {
      totalTrades,
      closedCount: closed.length,
      winRate,
      winners: winners.length,
      losers:  losers.length,
      netPnl,
      grossProfit,
      grossLoss,
      profitFactor,
      brokerFees,
      cgt,
      netAfterTaxFees,
      avgRR,
      maxDDPct,
      bestTrade,
      worstTrade,
      avgHoldDays,
      streak,
      totalTradedValue,
      equityCurve,
    }
  }, [rangedTrades, closed])

  const fmtPnl = (n) => isForex
    ? `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(2)}`
    : `${n >= 0 ? '+' : '−'}Rs.${Math.abs(Math.round(n)).toLocaleString()}`

  const fmtAbs = (n) => isForex
    ? `$${Math.abs(n).toFixed(2)}`
    : `Rs.${Math.abs(Math.round(n)).toLocaleString()}`

  const pnlColor = (n) => n > 0 ? 'text-emerald-500' : n < 0 ? 'text-red-400' : 'text-gray-400'

  const dateLabel = applied.from === applied.to
    ? applied.from
    : `${applied.from} – ${applied.to}`

  return (
    <div className="space-y-5">

      {/* ── Date range selector ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-wrap items-center gap-3">
        <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0">Date Range</p>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-400 transition-colors"
          />
          <span className="text-[10px] text-gray-400">—</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-400 transition-colors"
          />
          <button
            onClick={handleApply}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-gray-400">{kpis.closedCount} closed trades in range</span>
          {/* Share button */}
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-[11px] font-semibold rounded-lg transition-all shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share My Stats
          </button>
        </div>
      </div>

      {kpis.closedCount === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-20 text-center">
          <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-[12px] font-medium text-gray-400">No closed trades in this date range</p>
          <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1">Adjust the date range or close some trades first</p>
        </div>
      ) : (
        <>
          {/* ── KPI Grid Row 1: Core ── */}
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Performance</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiCard
                label="Total Trades"
                value={kpis.totalTrades}
                sub={`${kpis.closedCount} closed`}
                icon="📊"
              />
              <KpiCard
                label="Win Rate"
                value={kpis.winRate !== null ? `${kpis.winRate.toFixed(1)}%` : '—'}
                valueClass={kpis.winRate !== null ? (kpis.winRate >= 50 ? 'text-emerald-500' : 'text-red-400') : 'text-gray-400'}
                sub={`${kpis.winners}W · ${kpis.losers}L`}
                icon="🎯"
              />
              <KpiCard
                label="Net P&L"
                value={fmtPnl(kpis.netPnl)}
                valueClass={pnlColor(kpis.netPnl)}
                sub="realized"
                icon="💰"
              />
              <KpiCard
                label="Profit Factor"
                value={kpis.profitFactor !== null ? (kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)) : '—'}
                valueClass={kpis.profitFactor !== null ? (kpis.profitFactor >= 1.5 ? 'text-emerald-500' : kpis.profitFactor >= 1 ? 'text-amber-500' : 'text-red-400') : 'text-gray-400'}
                sub="gross profit / loss"
                icon="⚖️"
              />
            </div>
          </div>

          {/* ── KPI Grid Row 2: P&L Breakdown ── */}
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">P&L Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <KpiCard
                label="Gross Profit"
                value={fmtAbs(kpis.grossProfit)}
                valueClass="text-emerald-500"
                sub={`${kpis.winners} winning trades`}
              />
              <KpiCard
                label="Gross Loss"
                value={fmtAbs(kpis.grossLoss)}
                valueClass="text-red-400"
                sub={`${kpis.losers} losing trades`}
              />
              <KpiCard
                label="Total Traded Value"
                value={fmtAbs(kpis.totalTradedValue)}
                valueClass="text-gray-700 dark:text-gray-200"
                sub="entry value of closed"
              />
            </div>
          </div>

          {/* ── KPI Grid Row 3: Tax & Fees ── */}
          {!isForex && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Tax & Fees (Nepal)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <KpiCard
                  label="Est. Broker Fees"
                  value={`Rs.${Math.round(kpis.brokerFees).toLocaleString()}`}
                  valueClass="text-violet-500"
                  sub="NEPSE tiers 0.40%–0.60%"
                />
                <KpiCard
                  label="Est. CGT Tax"
                  value={`Rs.${Math.round(kpis.cgt).toLocaleString()}`}
                  valueClass="text-violet-500"
                  sub="7.5% ST · 5% LT"
                />
                <KpiCard
                  label="Net After Tax & Fees"
                  value={fmtPnl(kpis.netAfterTaxFees)}
                  valueClass={pnlColor(kpis.netAfterTaxFees)}
                  sub="P&L − fees − CGT"
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-1.5 px-0.5">
                Estimates only. Nepal CGT: short-term (&lt;365d) 7.5%, long-term (≥365d) 5%. Fiscal year Jul 16–Jul 15. Consult a tax advisor.
              </p>
            </div>
          )}

          {/* ── KPI Grid Row 4: Risk & Timing ── */}
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Risk & Timing</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiCard
                label="Avg R:R"
                value={kpis.avgRR !== null ? `${kpis.avgRR.toFixed(2)}R` : '—'}
                valueClass={kpis.avgRR !== null ? (kpis.avgRR >= 2 ? 'text-emerald-500' : kpis.avgRR >= 1 ? 'text-amber-500' : 'text-red-400') : 'text-gray-400'}
                sub="from trades with SL+TP"
              />
              <KpiCard
                label="Max Drawdown"
                value={kpis.maxDDPct > 0 ? `${kpis.maxDDPct.toFixed(1)}%` : '0%'}
                valueClass={kpis.maxDDPct > 20 ? 'text-red-500' : kpis.maxDDPct > 10 ? 'text-amber-500' : 'text-emerald-500'}
                sub="from peak equity"
              />
              <KpiCard
                label="Avg Hold Days"
                value={kpis.avgHoldDays !== null ? (kpis.avgHoldDays < 1 ? '<1d' : `${Math.round(kpis.avgHoldDays)}d`) : '—'}
                sub="closed trades"
              />
              <KpiCard
                label="Win Streak"
                value={kpis.streak > 0 ? `${kpis.streak}d` : '—'}
                valueClass={kpis.streak >= 3 ? 'text-emerald-500' : 'text-gray-700 dark:text-gray-200'}
                sub="current consecutive wins"
              />
            </div>
          </div>

          {/* ── Best / Worst ── */}
          {(kpis.bestTrade || kpis.worstTrade) && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Best & Worst Trade</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {kpis.bestTrade && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-emerald-100 dark:border-emerald-800/30 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Best Trade</p>
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-0.5">{kpis.bestTrade.symbol}</p>
                        <p className="text-[9px] text-gray-400">{kpis.bestTrade.date} · {kpis.bestTrade.position}</p>
                      </div>
                    </div>
                    <p className="text-[15px] font-black text-emerald-500 tabular-nums">{fmtPnl(parseFloat(kpis.bestTrade.realized_pnl) || 0)}</p>
                  </div>
                )}
                {kpis.worstTrade && kpis.worstTrade.id !== kpis.bestTrade?.id && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-100 dark:border-red-800/30 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Worst Trade</p>
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-0.5">{kpis.worstTrade.symbol}</p>
                        <p className="text-[9px] text-gray-400">{kpis.worstTrade.date} · {kpis.worstTrade.position}</p>
                      </div>
                    </div>
                    <p className="text-[15px] font-black text-red-400 tabular-nums">{fmtPnl(parseFloat(kpis.worstTrade.realized_pnl) || 0)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Equity sparkline ── */}
          {kpis.equityCurve.length > 1 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Cumulative Equity Curve</p>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                {(() => {
                  const pts  = kpis.equityCurve
                  const minV = Math.min(...pts)
                  const maxV = Math.max(...pts)
                  const range = maxV - minV || 1
                  const h = 80
                  const w = 400
                  const step = w / Math.max(pts.length - 1, 1)
                  const toY  = (v) => h - ((v - minV) / range) * h
                  const points = pts.map((v, i) => `${i * step},${toY(v)}`).join(' ')
                  const fill   = pts.map((v, i) => `${i * step},${toY(v)}`).join(' ')
                  const lastY  = toY(pts[pts.length - 1])
                  const endPnl = pts[pts.length - 1]
                  return (
                    <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full" style={{ height: 88 }}>
                      <defs>
                        <linearGradient id="audit-eq-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={endPnl >= 0 ? '#10b981' : '#f87171'} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={endPnl >= 0 ? '#10b981' : '#f87171'} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points={`0,${h + 4} ${fill} ${(pts.length - 1) * step},${h + 4}`}
                        fill="url(#audit-eq-grad)"
                      />
                      <polyline
                        points={points}
                        fill="none"
                        stroke={endPnl >= 0 ? '#10b981' : '#f87171'}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <circle cx={(pts.length - 1) * step} cy={lastY} r="3" fill={endPnl >= 0 ? '#10b981' : '#f87171'} />
                    </svg>
                  )
                })()}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] text-gray-400">{applied.from}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${pnlColor(kpis.netPnl)}`}>{fmtPnl(kpis.netPnl)}</span>
                  <span className="text-[9px] text-gray-400">{applied.to}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Share modal */}
      {showShare && (
        <ShareModal
          onClose={() => setShowShare(false)}
          kpis={kpis}
          trades={closed}
          dateLabel={dateLabel}
          user={user}
        />
      )}
    </div>
  )
}
