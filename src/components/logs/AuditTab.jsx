// === AuditTab.jsx — merged performance tab: KPI grid, setup breakdown, streaks,
// equity curve, tax/fees estimates, script audit, share modal (PNG + PDF) ===
import { useState, useEffect, useCallback, useMemo, useRef, useId } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTradeActions } from '../../utils/globalCache'
import TraderCard from './TraderCard'
import EmptyState from './EmptyState'
import { rangeToFromTo } from './tradeConstants'
import {
  nepseCharges,
  nepseCGT,
  fmtRs as fmtAbs,
  fmtRsSigned as fmtPnl,
  pnlClass,
} from '../../utils/format'

const EXIT_TYPES = ['Close Position', 'Partial Exit']
const LABEL = 'text-[10px] uppercase tracking-widest font-semibold text-gray-400'

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, valueClass = 'text-gray-900 dark:text-white', sub, icon }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3.5 flex flex-col gap-0.5">
      <div className="flex items-center justify-between mb-1">
        <p className={LABEL}>{label}</p>
        {icon && <span className="text-[13px]">{icon}</span>}
      </div>
      <p
        className={`text-[15px] font-black tracking-tight tabular-nums leading-tight ${valueClass}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Hidden-iframe print (replaces popup + document.write — popup-blocker safe) ─
function printHtml(html) {
  document.getElementById('tradeo-pdf-frame')?.remove()
  const iframe = document.createElement('iframe')
  iframe.id = 'tradeo-pdf-frame'
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.srcdoc = html
  iframe.onload = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }
  document.body.appendChild(iframe)
}

// ── Share modal ───────────────────────────────────────────────────────────────
function ShareModal({ onClose, kpis, trades, entryDateMap, dateLabel, user }) {
  const cardRef = useRef(null)
  const [gen, setGen] = useState(false)
  const [pdfGen, setPdfGen] = useState(false)
  const [err, setErr] = useState(null)

  const captureCard = async () => {
    if (!cardRef.current) return null
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: '#0f172a',
      scale: 2,
      useCORS: true,
      logging: false,
    })
    return canvas.toDataURL('image/png')
  }

  const handleDownloadCard = async () => {
    setGen(true)
    setErr(null)
    try {
      const url = await captureCard()
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.download = `tradeo-card-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
    } catch {
      setErr('Failed to generate image. Please try again.')
    } finally {
      setGen(false)
    }
  }

  const handleDownloadPDF = async () => {
    setPdfGen(true)
    setErr(null)
    try {
      let cardDataUrl = null
      try {
        cardDataUrl = await captureCard()
      } catch {
        /* card image is optional */
      }

      const tradeRows = trades
        .map((t) => {
          const entryDate = entryDateMap[t.trade_id] || t.date || ''
          const exitDate = t.date || ''
          const days =
            entryDate && exitDate
              ? Math.max(0, Math.floor((new Date(exitDate) - new Date(entryDate)) / 86400000))
              : 0
          const pnl = parseFloat(t.realized_pnl) || 0
          return `<tr style="border-bottom:1px solid #e5e7eb">
          <td>${entryDate}</td>
          <td>${exitDate}</td>
          <td style="font-weight:700">${t.symbol}</td>
          <td style="color:${t.position === 'LONG' ? '#059669' : '#dc2626'}">${t.position}</td>
          <td>${parseFloat(t.quantity) || 0}</td>
          <td>${parseFloat(t.entry_price || 0).toFixed(2)}</td>
          <td>${t.exit_price ? parseFloat(t.exit_price).toFixed(2) : '—'}</td>
          <td style="color:${pnlClass(pnl, '#059669', '#dc2626')};font-weight:600">${fmtPnl(pnl)}</td>
          <td>${days}d</td>
        </tr>`
        })
        .join('')

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
<p class="sub">${dateLabel} · Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · tradeo-seven.vercel.app</p>
${cardDataUrl ? `<img src="${cardDataUrl}" class="card-img" alt="Trader Card"/>` : ''}
<div class="grid">
  <div class="kpi"><div class="kpi-label">Net P&L</div><div class="kpi-value ${pnlClass(kpis.netPnl, 'pos', 'neg')}">${fmtPnl(kpis.netPnl)}</div></div>
  <div class="kpi"><div class="kpi-label">Win Rate</div><div class="kpi-value neu">${kpis.winRate !== null ? kpis.winRate.toFixed(1) + '%' : '—'}</div></div>
  <div class="kpi"><div class="kpi-label">Profit Factor</div><div class="kpi-value neu">${kpis.profitFactor !== null ? (kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)) : '—'}</div></div>
  <div class="kpi"><div class="kpi-label">Total Trades</div><div class="kpi-value neu">${kpis.totalTrades}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-value pos">${fmtAbs(kpis.grossProfit)}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Loss</div><div class="kpi-value neg">${fmtAbs(kpis.grossLoss)}</div></div>
  <div class="kpi"><div class="kpi-label">Est. Broker Fees</div><div class="kpi-value pur">${fmtAbs(kpis.brokerFees)}</div></div>
  <div class="kpi"><div class="kpi-label">Est. CGT</div><div class="kpi-value pur">${fmtAbs(kpis.cgt)}</div></div>
</div>
<table>
  <thead><tr><th>Entry Date</th><th>Exit Date</th><th>Symbol</th><th>Dir</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Hold</th></tr></thead>
  <tbody>${tradeRows}</tbody>
</table>
<p class="note">Nepal CGT: Short-term (&lt;365d) 7.5%, Long-term (≥365d) 5%, applied to gains net of fees. Broker fees: SEBON-regulated tiers (0.36%–0.24%). This is an estimate — consult a tax advisor for official filing.</p>
</body></html>`

      printHtml(html)
    } catch {
      setErr('Failed to generate PDF. Please try again.')
    } finally {
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
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
              Share My Stats
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Card preview */}
          <div>
            <p className={`${LABEL} mb-3`}>Trader Card Preview</p>
            <div className="flex justify-center">
              <TraderCard ref={cardRef} kpis={kpis} dateLabel={dateLabel} user={user} />
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {gen ? 'Generating…' : 'Download Card (PNG)'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={gen || pdfGen}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
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
export default function AuditTab({
  range = '1M',
  symbol = 'all',
  onSymbolsLoaded,
  shareOpen = false,
  onShareClose,
}) {
  const { user } = useAuth()
  const uid = useId()
  const gradId = `audit-eq-grad-${uid}`

  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTrades = useCallback(async () => {
    try {
      const res = await getTradeActions()
      setTrades(res.data || [])
    } catch {
      setTrades([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  // Derive from/to from range prop — recalculates whenever range changes
  const { from: appliedFrom, to: appliedTo } = useMemo(() => rangeToFromTo(range), [range])

  // Expose unique symbols to parent so it can populate the select
  useEffect(() => {
    if (!onSymbolsLoaded) return
    const syms = [
      ...new Set(trades.filter((t) => EXIT_TYPES.includes(t.action_type)).map((t) => t.symbol)),
    ].sort()
    onSymbolsLoaded(syms)
  }, [trades, onSymbolsLoaded])

  // Filter by date range + symbol
  const rangedTrades = useMemo(() => {
    return trades.filter((t) => {
      if (appliedFrom && t.date < appliedFrom) return false
      if (appliedTo && t.date > appliedTo) return false
      if (symbol !== 'all' && t.symbol !== symbol) return false
      return true
    })
  }, [trades, appliedFrom, appliedTo, symbol])

  // Only action rows that actually realised P&L — not open-position rows that happen to have PARTIAL status
  const closed = useMemo(
    () => rangedTrades.filter((t) => EXIT_TYPES.includes(t.action_type)),
    [rangedTrades]
  )

  // Entry metadata per trade_id from the New Position action row:
  // date for hold-days/CGT, sl/tp for planned R:R, setup_type for the breakdown.
  const entryMap = useMemo(() => {
    const map = {}
    trades.forEach((t) => {
      if (t.action_type === 'New Position') {
        map[t.trade_id] = {
          date: t.date,
          sl: t.sl,
          tp: t.tp,
          setup_type: t.setup_type,
          entry_price: t.entry_price,
        }
      }
    })
    return map
  }, [trades])

  const entryDateMap = useMemo(() => {
    const map = {}
    for (const [id, e] of Object.entries(entryMap)) map[id] = e.date
    return map
  }, [entryMap])

  // ── KPI calculations (all client-side from loaded trades array) ────────────
  const kpis = useMemo(() => {
    const totalTrades = new Set(rangedTrades.map((t) => t.trade_id)).size
    const pnlOf = (t) => parseFloat(t.realized_pnl) || 0
    const winners = closed.filter((t) => pnlOf(t) > 0)
    const losers = closed.filter((t) => pnlOf(t) < 0)
    const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : null

    const grossProfit = winners.reduce((s, t) => s + pnlOf(t), 0)
    const grossLoss = Math.abs(losers.reduce((s, t) => s + pnlOf(t), 0))
    const netPnl = grossProfit - grossLoss
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null
    const avgWin = winners.length ? grossProfit / winners.length : null
    const avgLoss = losers.length ? grossLoss / losers.length : null

    // Broker fees + CGT — NEPSE only. CGT applies to gains net of transaction
    // charges (per format.js fee schedule), per exit action.
    let brokerFees = 0
    let cgt = 0
    let totalTradedValue = 0

    for (const t of closed) {
      const entry = parseFloat(t.entry_price) || 0
      const qty = parseFloat(t.quantity) || 0
      const exitP = parseFloat(t.exit_price) || 0
      const pnl = pnlOf(t)

      const entryVal = entry * qty
      const exitVal = exitP * qty
      const charges = nepseCharges(entryVal) + nepseCharges(exitVal)
      brokerFees += charges
      totalTradedValue += entryVal

      // t.date = exit date (action date); entryDateMap = entry date from New Position row
      const entryDate = entryDateMap[t.trade_id] || t.date
      const taxable = pnl - charges
      if (taxable > 0 && entryDate && t.date) {
        cgt += nepseCGT(taxable, entryDate, t.date)
      }
    }

    const netAfterTaxFees = netPnl - brokerFees - cgt

    // Max drawdown — absolute Rs peak-to-trough on the cumulative curve.
    // (A % of peak is undefined when equity starts negative.)
    const sortedClosed = [...closed].sort((a, b) => {
      if ((a.date || '') !== (b.date || '')) return (a.date || '') < (b.date || '') ? -1 : 1
      return (a.created_at || '') < (b.created_at || '') ? -1 : 1
    })
    let equity = 0,
      peak = 0,
      maxDD = 0
    for (const t of sortedClosed) {
      equity += pnlOf(t)
      if (equity > peak) peak = equity
      const dd = peak - equity
      if (dd > maxDD) maxDD = dd
    }

    // Best / worst — closed already contains only Close Position + Partial Exit rows
    const sortedByPnl = [...closed].sort((a, b) => pnlOf(b) - pnlOf(a))
    const bestTrade = sortedByPnl[0] || null
    const worstTrade = sortedByPnl[sortedByPnl.length - 1] || null

    // Avg hold days — t.date = exit date, entryDateMap[trade_id] = entry date
    const closedWithDates = closed.filter((t) => t.date && entryDateMap[t.trade_id])
    const avgHoldDays =
      closedWithDates.length > 0
        ? closedWithDates.reduce((s, t) => {
            const d = Math.max(
              0,
              Math.floor((new Date(t.date) - new Date(entryDateMap[t.trade_id])) / 86400000)
            )
            return s + d
          }, 0) / closedWithDates.length
        : null

    // Daily win streak (current) — group exits by date, count consecutive green days
    const byDate = {}
    for (const t of closed) {
      const d = t.date || ''
      if (!d) continue
      byDate[d] = (byDate[d] || 0) + pnlOf(t)
    }
    const days = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a))
    let dailyStreak = 0
    for (const [, pnl] of days) {
      if (pnl > 0) dailyStreak++
      else break
    }

    // Exit streaks — consecutive winning/losing exits in chronological order
    let curWin = 0,
      curLoss = 0,
      bestWinRun = 0,
      worstLossRun = 0
    sortedClosed.forEach((t) => {
      if (pnlOf(t) > 0) {
        curWin++
        curLoss = 0
        bestWinRun = Math.max(bestWinRun, curWin)
      } else {
        curLoss++
        curWin = 0
        worstLossRun = Math.max(worstLossRun, curLoss)
      }
    })
    const lastPnl = sortedClosed.length ? pnlOf(sortedClosed[sortedClosed.length - 1]) : 0
    const currentStreak = lastPnl > 0 ? curWin : -curLoss

    // Setup breakdown — setup_type lives on the entry row; group exits by it
    const bySetup = {}
    closed.forEach((t) => {
      const key = entryMap[t.trade_id]?.setup_type || 'Untagged'
      if (!bySetup[key]) bySetup[key] = { wins: 0, total: 0, pnl: 0 }
      bySetup[key].total++
      bySetup[key].pnl += pnlOf(t)
      if (pnlOf(t) > 0) bySetup[key].wins++
    })
    const setupRows = Object.entries(bySetup).sort((a, b) => b[1].total - a[1].total)

    // Expectancy per exit
    const expectancy = closed.length > 0 ? netPnl / closed.length : null

    // Equity curve points for sparkline
    const equityCurve = sortedClosed.reduce((acc, t) => {
      const prev = acc[acc.length - 1] ?? 0
      acc.push(prev + pnlOf(t))
      return acc
    }, [])

    return {
      totalTrades,
      closedCount: closed.length,
      winRate,
      winners: winners.length,
      losers: losers.length,
      netPnl,
      grossProfit,
      grossLoss,
      profitFactor,
      avgWin,
      avgLoss,
      brokerFees,
      cgt,
      netAfterTaxFees,
      maxDD,
      bestTrade,
      worstTrade,
      avgHoldDays,
      dailyStreak,
      currentStreak,
      bestWinRun,
      worstLossRun,
      setupRows,
      expectancy,
      totalTradedValue,
      equityCurve,
    }
  }, [rangedTrades, closed, entryMap, entryDateMap])

  // Avg planned R:R — computed separately for clarity: reward/risk from the
  // entry row's fill price vs its SL/TP.
  const avgRR = useMemo(() => {
    const entries = [...new Set(closed.map((t) => t.trade_id))]
      .map((id) => {
        const e = entryMap[id]
        if (!e || !e.sl || !e.tp) return null
        const fill = parseFloat(e.entry_price)
        const sl = parseFloat(e.sl)
        const tp = parseFloat(e.tp)
        if (!fill || !sl || !tp) return null
        const risk = Math.abs(fill - sl)
        return risk > 0 ? Math.abs(tp - fill) / risk : null
      })
      .filter((v) => v != null)
    return entries.length > 0 ? entries.reduce((a, b) => a + b, 0) / entries.length : null
  }, [closed, entryMap])

  const pnlColor = (n) => (n > 0 ? 'text-emerald-500' : n < 0 ? 'text-red-400' : 'text-gray-400')

  const dateLabel = !appliedFrom
    ? `All Time – ${appliedTo}`
    : appliedFrom === appliedTo
      ? appliedFrom
      : `${appliedFrom} – ${appliedTo}`

  // Share-card KPIs — pass the entry-derived avgRR through
  const shareKpis = useMemo(() => ({ ...kpis, avgRR }), [kpis, avgRR])

  // Script audit rows — all exit actions for the selected symbol in range
  const scriptAuditRows = useMemo(() => {
    if (symbol === 'all') return []
    return rangedTrades
      .filter((t) => EXIT_TYPES.includes(t.action_type) && t.symbol === symbol)
      .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))
  }, [rangedTrades, symbol])

  const scriptKpis = useMemo(() => {
    if (!scriptAuditRows.length) return null
    const pnls = scriptAuditRows.map((t) => parseFloat(t.realized_pnl) || 0)
    const wins = pnls.filter((p) => p > 0)
    const total = pnls.reduce((a, b) => a + b, 0)
    return {
      total,
      winRate: (wins.length / scriptAuditRows.length) * 100,
      count: scriptAuditRows.length,
      winCount: wins.length,
    }
  }, [scriptAuditRows])

  const streakLabel =
    kpis.currentStreak > 0
      ? `${kpis.currentStreak} win${kpis.currentStreak > 1 ? 's' : ''} ✓`
      : kpis.currentStreak < 0
        ? `${Math.abs(kpis.currentStreak)} loss${Math.abs(kpis.currentStreak) > 1 ? 'es' : ''} ✗`
        : '—'
  const streakColor =
    kpis.currentStreak > 0
      ? 'text-emerald-500'
      : kpis.currentStreak < 0
        ? 'text-red-400'
        : 'text-gray-400'

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )

  return (
    <div className="space-y-5">
      {/* Active filter banner */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400 px-0.5">
        <span>
          {kpis.closedCount} closed trade{kpis.closedCount !== 1 ? 's' : ''} in range
        </span>
        {symbol !== 'all' && (
          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-semibold">
            {symbol}
          </span>
        )}
        {trades.length >= 1000 && (
          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-semibold">
            Showing latest 1,000 actions
          </span>
        )}
        <span className="ml-auto text-gray-300 dark:text-gray-700">{dateLabel}</span>
      </div>

      {/* Script audit — shown when a specific symbol is selected */}
      {symbol !== 'all' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-100 dark:border-blue-800/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-blue-500">
                Script Audit
              </p>
              <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-0.5">{symbol}</p>
            </div>
            {scriptKpis && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={LABEL}>Win Rate</p>
                  <p
                    className={`text-[13px] font-bold tabular-nums ${scriptKpis.winRate >= 50 ? 'text-emerald-500' : 'text-red-400'}`}
                  >
                    {scriptKpis.winRate.toFixed(0)}% ({scriptKpis.winCount}/{scriptKpis.count})
                  </p>
                </div>
                <div className="text-right">
                  <p className={LABEL}>Net P&L</p>
                  <p
                    className={`text-[13px] font-bold tabular-nums ${pnlClass(scriptKpis.total)}`}
                  >
                    {fmtPnl(scriptKpis.total)}
                  </p>
                </div>
              </div>
            )}
          </div>
          {scriptAuditRows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[11px] text-gray-400">
                No closed trades for {symbol} in this range.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {['Date', 'Action', 'Qty', 'Entry', 'Exit', 'Hold', 'P&L'].map((h) => (
                      <th key={h} className={`text-left px-4 py-2 ${LABEL}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scriptAuditRows.map((t, i) => {
                    const pnl = parseFloat(t.realized_pnl) || 0
                    const entryDt = entryDateMap[t.trade_id] || t.date
                    const holdDays =
                      entryDt && t.date
                        ? Math.max(0, Math.floor((new Date(t.date) - new Date(entryDt)) / 86400000))
                        : null
                    return (
                      <tr
                        key={t.id}
                        className={
                          i % 2 === 1
                            ? 'bg-gray-50/80 dark:bg-gray-800/40'
                            : 'bg-white dark:bg-gray-900'
                        }
                      >
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {t.date}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {t.action_type}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                          {Math.abs(parseFloat(t.quantity) || 0)}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                          Rs.{parseFloat(t.entry_price || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                          {t.exit_price ? `Rs.${parseFloat(t.exit_price).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-gray-500">
                          {holdDays !== null ? `${holdDays}d` : '—'}
                        </td>
                        <td
                          className={`px-4 py-2 tabular-nums font-bold whitespace-nowrap ${pnlClass(pnl)}`}
                        >
                          {fmtPnl(pnl)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {kpis.closedCount === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <EmptyState
            icon="📊"
            title="No closed trades in this date range"
            subtitle="Adjust the date range or close some trades first."
          />
        </div>
      ) : (
        <>
          {/* ── KPI Grid Row 1: Core ── */}
          <div>
            <p className={`${LABEL} mb-2`}>Performance</p>
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
                valueClass={
                  kpis.winRate !== null
                    ? kpis.winRate >= 50
                      ? 'text-emerald-500'
                      : 'text-red-400'
                    : 'text-gray-400'
                }
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
                value={
                  kpis.profitFactor !== null
                    ? kpis.profitFactor === Infinity
                      ? '∞'
                      : kpis.profitFactor.toFixed(2)
                    : '—'
                }
                valueClass={
                  kpis.profitFactor !== null
                    ? kpis.profitFactor >= 1.5
                      ? 'text-emerald-500'
                      : kpis.profitFactor >= 1
                        ? 'text-amber-500'
                        : 'text-red-400'
                    : 'text-gray-400'
                }
                sub="gross profit / loss"
                icon="⚖️"
              />
            </div>
          </div>

          {/* ── KPI Grid Row 2: P&L Breakdown ── */}
          <div>
            <p className={`${LABEL} mb-2`}>P&L Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiCard
                label="Gross Profit"
                value={fmtAbs(kpis.grossProfit)}
                valueClass="text-emerald-500"
                sub={`${kpis.winners} winning exits`}
              />
              <KpiCard
                label="Gross Loss"
                value={fmtAbs(kpis.grossLoss)}
                valueClass="text-red-400"
                sub={`${kpis.losers} losing exits`}
              />
              <KpiCard
                label="Avg Win"
                value={kpis.avgWin !== null ? fmtAbs(kpis.avgWin) : '—'}
                valueClass={kpis.avgWin !== null ? 'text-emerald-500' : 'text-gray-400'}
                sub="per winning exit"
              />
              <KpiCard
                label="Avg Loss"
                value={kpis.avgLoss !== null ? fmtAbs(kpis.avgLoss) : '—'}
                valueClass={kpis.avgLoss !== null ? 'text-red-400' : 'text-gray-400'}
                sub="per losing exit"
              />
            </div>
          </div>

          {/* ── KPI Grid Row 3: Tax & Fees ── */}
          <div>
            <p className={`${LABEL} mb-2`}>Tax & Fees (Nepal)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiCard
                label="Est. Broker Fees"
                value={fmtAbs(kpis.brokerFees)}
                valueClass="text-violet-500"
                sub="SEBON tiers (0.36%–0.24%)"
              />
              <KpiCard
                label="Est. CGT Tax"
                value={fmtAbs(kpis.cgt)}
                valueClass="text-violet-500"
                sub="7.5% ST · 5% LT, net of fees"
              />
              <KpiCard
                label="Net After Tax & Fees"
                value={fmtPnl(kpis.netAfterTaxFees)}
                valueClass={pnlColor(kpis.netAfterTaxFees)}
                sub="P&L − fees − CGT"
              />
              <KpiCard
                label="Total Traded Value"
                value={fmtAbs(kpis.totalTradedValue)}
                valueClass="text-gray-700 dark:text-gray-200"
                sub="entry value of closed"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 px-0.5">
              Estimates only. Nepal CGT: short-term (&lt;365d) 7.5%, long-term (≥365d) 5%, applied
              to gains net of fees. Fiscal year Jul 16–Jul 15. Consult a tax advisor.
            </p>
          </div>

          {/* ── KPI Grid Row 4: Risk & Timing ── */}
          <div>
            <p className={`${LABEL} mb-2`}>Risk & Timing</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiCard
                label="Avg Planned R:R"
                value={avgRR !== null ? `${avgRR.toFixed(2)}R` : '—'}
                valueClass={
                  avgRR !== null
                    ? avgRR >= 2
                      ? 'text-emerald-500'
                      : avgRR >= 1
                        ? 'text-amber-500'
                        : 'text-red-400'
                    : 'text-gray-400'
                }
                sub="from entries with SL+TP"
              />
              <KpiCard
                label="Max Drawdown"
                value={kpis.maxDD > 0 ? fmtAbs(kpis.maxDD) : 'None'}
                valueClass={kpis.maxDD > 0 ? 'text-red-400' : 'text-emerald-500'}
                sub="peak-to-trough equity"
              />
              <KpiCard
                label="Avg Hold Days"
                value={
                  kpis.avgHoldDays !== null
                    ? kpis.avgHoldDays < 1
                      ? '<1d'
                      : `${Math.round(kpis.avgHoldDays)}d`
                    : '—'
                }
                sub="closed trades"
              />
              <KpiCard
                label="Daily Win Streak"
                value={kpis.dailyStreak > 0 ? `${kpis.dailyStreak}d` : '—'}
                valueClass={
                  kpis.dailyStreak >= 3 ? 'text-emerald-500' : 'text-gray-700 dark:text-gray-200'
                }
                sub="consecutive green days"
              />
            </div>
          </div>

          {/* ── Row 5: Setup breakdown + streak panel ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Setup type breakdown */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-4">
              <p className={`${LABEL} mb-3`}>By Setup Type</p>
              {kpis.setupRows.length === 0 ? (
                <p className="text-xs text-gray-400">No setup types tagged.</p>
              ) : (
                <div className="space-y-1.5">
                  {kpis.setupRows.map(([name, data]) => {
                    const wr = data.total > 0 ? data.wins / data.total : 0
                    return (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-600 dark:text-gray-300 w-28 truncate shrink-0">
                          {name}
                        </span>
                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${wr >= 0.5 ? 'bg-emerald-400' : 'bg-red-400'}`}
                            style={{ width: `${Math.round(wr * 100)}%` }}
                          />
                        </div>
                        <span
                          className={`text-[10px] font-bold tabular-nums shrink-0 w-8 text-right ${wr >= 0.5 ? 'text-emerald-500' : 'text-red-400'}`}
                        >
                          {Math.round(wr * 100)}%
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          ({data.wins}/{data.total})
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Streak + expectancy panel */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-4">
              <p className={`${LABEL} mb-3`}>Win / Loss Streak</p>
              <div className="space-y-3">
                <div>
                  <p className={LABEL}>Current</p>
                  <p className={`text-[15px] font-black tracking-tight ${streakColor}`}>
                    {streakLabel}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className={LABEL}>Best Win Run</p>
                    <p className="text-[13px] font-bold text-emerald-500 tabular-nums">
                      {kpis.bestWinRun > 0 ? `${kpis.bestWinRun} in a row` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className={LABEL}>Worst Loss Run</p>
                    <p className="text-[13px] font-bold text-red-400 tabular-nums">
                      {kpis.worstLossRun > 0 ? `${kpis.worstLossRun} in a row` : '—'}
                    </p>
                  </div>
                </div>
                <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
                  <p className={`${LABEL} mb-1`}>Expectancy per exit</p>
                  <p
                    className={`text-[13px] font-bold tabular-nums ${pnlColor(kpis.expectancy ?? 0)}`}
                  >
                    {kpis.expectancy !== null ? fmtPnl(kpis.expectancy) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Best / Worst ── */}
          {(kpis.bestTrade || kpis.worstTrade) && (
            <div>
              <p className={`${LABEL} mb-2`}>Best & Worst Trade</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {kpis.bestTrade && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-emerald-100 dark:border-emerald-800/30 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-emerald-400 flex-shrink-0" />
                      <div>
                        <p className={LABEL}>Best Trade</p>
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-0.5">
                          {kpis.bestTrade.symbol}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {kpis.bestTrade.date} · {kpis.bestTrade.position}
                        </p>
                      </div>
                    </div>
                    <p className="text-[15px] font-black text-emerald-500 tabular-nums">
                      {fmtPnl(parseFloat(kpis.bestTrade.realized_pnl) || 0)}
                    </p>
                  </div>
                )}
                {kpis.worstTrade && kpis.worstTrade.id !== kpis.bestTrade?.id && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-100 dark:border-red-800/30 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-red-400 flex-shrink-0" />
                      <div>
                        <p className={LABEL}>Worst Trade</p>
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-0.5">
                          {kpis.worstTrade.symbol}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {kpis.worstTrade.date} · {kpis.worstTrade.position}
                        </p>
                      </div>
                    </div>
                    <p className="text-[15px] font-black text-red-400 tabular-nums">
                      {fmtPnl(parseFloat(kpis.worstTrade.realized_pnl) || 0)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Equity sparkline ── */}
          {kpis.equityCurve.length > 1 && (
            <div>
              <p className={`${LABEL} mb-2`}>Cumulative Equity Curve</p>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                {(() => {
                  const pts = kpis.equityCurve
                  const minV = Math.min(...pts)
                  const maxV = Math.max(...pts)
                  const range = maxV - minV || 1
                  const h = 80
                  const w = 400
                  const step = w / Math.max(pts.length - 1, 1)
                  const toY = (v) => h - ((v - minV) / range) * h
                  const points = pts.map((v, i) => `${i * step},${toY(v)}`).join(' ')
                  const lastY = toY(pts[pts.length - 1])
                  const endPnl = pts[pts.length - 1]
                  const col = pnlClass(endPnl, '#10b981', '#f87171')
                  return (
                    <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full" style={{ height: 88 }}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={col} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={col} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points={`0,${h + 4} ${points} ${(pts.length - 1) * step},${h + 4}`}
                        fill={`url(#${gradId})`}
                      />
                      <polyline
                        points={points}
                        fill="none"
                        stroke={col}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <circle cx={(pts.length - 1) * step} cy={lastY} r="3" fill={col} />
                    </svg>
                  )
                })()}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-gray-400">{appliedFrom || 'All time'}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${pnlColor(kpis.netPnl)}`}>
                    {fmtPnl(kpis.netPnl)}
                  </span>
                  <span className="text-[10px] text-gray-400">{appliedTo}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Share modal — single source of truth is the parent toolbar's shareOpen */}
      {shareOpen && (
        <ShareModal
          onClose={onShareClose}
          kpis={shareKpis}
          trades={closed}
          entryDateMap={entryDateMap}
          dateLabel={dateLabel}
          user={user}
        />
      )}
    </div>
  )
}
