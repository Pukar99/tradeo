import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { sendAgentMessage, getChatSuggestions } from '../api'
import { useNavigate } from 'react-router-dom'

// ── Tradeo logo SVG (reused everywhere in chat) ──────────────────────────────
const TradeoLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1"/>
    <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e"/>
    <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5"/>
    <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444"/>
    <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5"/>
    <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5"/>
    <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e"/>
    <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5"/>
  </svg>
)

// ── Action card metadata ─────────────────────────────────────────────────────
const ACTION_META = {
  ADD_TRADE:          { icon: '📒', label: 'Trade Logged',            color: 'border-green-400 bg-green-50 dark:bg-green-900/30' },
  CLOSE_TRADE:        { icon: '🏁', label: 'Trade Closed',            color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' },
  UPDATE_SL_TP:       { icon: '🎯', label: 'SL/TP Updated',           color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/30' },
  ADD_WATCHLIST:      { icon: '👁️', label: 'Added to Watchlist',      color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30' },
  REMOVE_WATCHLIST:   { icon: '🗑️', label: 'Removed from Watchlist',  color: 'border-gray-400 bg-gray-50 dark:bg-gray-700/50' },
  CONFIRM_DELETE:     { icon: '🗑️', label: 'Trades Deleted',          color: 'border-red-400 bg-red-50 dark:bg-red-900/30' },
  BULK_ADD_WATCHLIST: { icon: '👁️', label: 'Bulk Added to Watchlist', color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30' },
  ADD_JOURNAL:        { icon: '📝', label: 'Journal Saved',            color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' },
  ADD_GOAL:           { icon: '🏆', label: 'Goal Added',               color: 'border-teal-400 bg-teal-50 dark:bg-teal-900/30' },
  CALC_BROKER_FEE:    { icon: '🧮', label: 'Fee Breakdown',            color: 'border-sky-400 bg-sky-50 dark:bg-sky-900/30' },
  DRAFT_JOURNAL:      { icon: '✏️', label: 'Journal Draft',            color: 'border-amber-400 bg-amber-50 dark:bg-amber-900/30' },
  MORNING_BRIEF:      { icon: '☀️', label: 'Morning Brief',            color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' },
}

// ── Standard action card (trade, watchlist, goal, journal, etc.) ─────────────
function ActionCard({ type, result }) {
  const meta = ACTION_META[type]
  if (!meta) return null
  const rows = []
  if (type === 'ADD_TRADE' && result.trade) {
    const t = result.trade
    rows.push(`${t.symbol} · ${t.position} · ${t.quantity} kittas @ Rs.${t.entry_price}`)
    if (t.sl) rows.push(`SL: Rs.${t.sl}`)
    if (t.tp) rows.push(`TP: Rs.${t.tp}`)
  }
  if (type === 'CLOSE_TRADE' && result.trade) {
    const pnl = Math.round(result.pnl || 0)
    rows.push(`${result.trade.symbol} · Exit Rs.${result.trade.exit_price}`)
    rows.push(`P&L: ${pnl >= 0 ? '+' : ''}Rs.${pnl.toLocaleString()}`)
  }
  if (type === 'UPDATE_SL_TP' && result.trade) {
    const t = result.trade
    rows.push(`${t.symbol} · SL: Rs.${t.sl || '—'} · TP: Rs.${t.tp || '—'}`)
  }
  if (type === 'ADD_WATCHLIST' && result.item) {
    rows.push(`${result.item.symbol} · ${result.item.category}`)
    if (result.item.price_alert) rows.push(`Price Alert: Rs.${result.item.price_alert}`)
  }
  if (type === 'ADD_GOAL' && result.goal) rows.push(result.goal.title)
  if (type === 'ADD_JOURNAL') rows.push('Entry saved to journal')
  if (type === 'REMOVE_WATCHLIST') rows.push(`${result.symbol} removed`)
  if (type === 'CONFIRM_DELETE') rows.push(`${result.count} trade(s) for ${result.symbol} permanently removed`)
  if (type === 'BULK_ADD_WATCHLIST' && result.items) {
    rows.push(`${result.items.length} stocks → ${result.category}`)
    rows.push(result.items.map(i => i.symbol).join(', '))
  }
  return (
    <div className={`border-l-2 rounded-xl px-3 py-2 mb-1.5 ${meta.color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{meta.icon}</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">✅ {meta.label}</span>
      </div>
      {rows.map((r, i) => (
        <p key={i} className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{r}</p>
      ))}
    </div>
  )
}

// ── Broker fee result card ────────────────────────────────────────────────────
function BrokerFeeCard({ fee }) {
  if (!fee) return null
  const isProfit = fee.transaction === 'sell'
  return (
    <div className="border-l-2 border-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded-xl px-3 py-2 mb-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">🧮</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          NEPSE Fee Breakdown — {fee.transaction === 'buy' ? 'BUY' : 'SELL'} {fee.quantity} kittas{fee.symbol ? ` of ${fee.symbol}` : ''} @ Rs.{fee.price?.toLocaleString()}
        </span>
      </div>
      <div className="space-y-0.5">
        <FeeRow label="Total Value" value={`Rs.${fee.totalValue?.toLocaleString()}`} />
        <FeeRow label={`Broker (${fee.brokerRate}%)`} value={`Rs.${fee.brokerCommission?.toLocaleString()}`} dim />
        <FeeRow label="SEBON (0.015%)" value={`Rs.${fee.sebon?.toLocaleString()}`} dim />
        {fee.dp > 0 && <FeeRow label="DP Charge" value={`Rs.${fee.dp}`} dim />}
        <div className="border-t border-sky-200 dark:border-sky-800 my-1" />
        <FeeRow label="Total Charges" value={`Rs.${fee.totalCharges?.toLocaleString()}`} accent="text-red-500" />
        <FeeRow
          label={isProfit ? 'Net Receive' : 'Net Pay'}
          value={`Rs.${fee.netAmount?.toLocaleString()}`}
          accent="text-sky-600 dark:text-sky-400 font-semibold"
        />
      </div>
    </div>
  )
}
function FeeRow({ label, value, dim, accent }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-[10px] ${dim ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>{label}</span>
      <span className={`text-[10px] ${accent || (dim ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200')}`}>{value}</span>
    </div>
  )
}

// ── Journal draft card with edit + save + discard ────────────────────────────
function JournalDraftCard({ draft, onSave, onDiscard }) {
  const [content, setContent] = useState(draft.suggestedContent || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    await onSave(draft.symbol, content)
    setSaving(false)
  }

  return (
    <div className="border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 mb-1.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">✏️</span>
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
            Journal Draft — {draft.symbol}
          </span>
        </div>
        {draft.pnl !== null && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${draft.pnl >= 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'bg-red-100 dark:bg-red-900/40 text-red-500'}`}>
            {draft.pnl >= 0 ? '+' : ''}Rs.{Math.abs(draft.pnl).toLocaleString()} P&L
          </span>
        )}
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={5}
        className="w-full text-[10px] bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
      />
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
        >
          {saving ? 'Saving…' : '📝 Save to Journal'}
        </button>
        <button
          onClick={onDiscard}
          className="px-2.5 py-1.5 rounded-lg text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

// ── Morning brief card ────────────────────────────────────────────────────────
function MorningBriefCard({ brief }) {
  if (!brief) return null
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="border-l-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-3 py-2 mb-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">☀️</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{greeting}! Your Trading Brief</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        <BriefStat icon="📈" label="Open Trades" value={brief.openTradesCount} color="text-green-600 dark:text-green-400" />
        <BriefStat icon="👁️" label="Watch Alerts" value={brief.watchAlertsCount} color="text-purple-600 dark:text-purple-400" />
        <BriefStat icon="🏆" label="Goals Pending" value={brief.pendingGoalsCount} color="text-teal-600 dark:text-teal-400" />
      </div>

      {/* Discipline */}
      {brief.avgDiscipline !== null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">7-day discipline avg:</span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${brief.avgDiscipline >= 70 ? 'bg-green-400' : brief.avgDiscipline >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${brief.avgDiscipline}%` }}
            />
          </div>
          <span className={`text-[10px] font-semibold ${brief.avgDiscipline >= 70 ? 'text-green-500' : brief.avgDiscipline >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
            {brief.avgDiscipline}%
          </span>
        </div>
      )}

      {/* Risk alerts */}
      {brief.riskAlerts?.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-red-500 mb-0.5">⚠️ Risk Alerts</p>
          {brief.riskAlerts.map((a, i) => (
            <p key={i} className="text-[10px] text-red-400">{a.symbol} — {a.reason}</p>
          ))}
        </div>
      )}

      {/* Near target */}
      {brief.nearTarget?.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-green-600 mb-0.5">🎯 Near Target — Consider booking profit</p>
          {brief.nearTarget.map((a, i) => (
            <p key={i} className="text-[10px] text-green-500">{a.symbol} → TP: Rs.{a.tp}</p>
          ))}
        </div>
      )}

      {/* Open positions table */}
      {brief.openTrades?.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Open Positions</p>
          <div className="space-y-0.5">
            {brief.openTrades.map((t, i) => {
              const unrealized = t.ltp ? (t.position === 'LONG' ? t.ltp - t.entry : t.entry - t.ltp) * t.qty : null
              return (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{t.symbol}</span>
                  <span className="text-gray-400">{t.qty}@{t.entry}</span>
                  {unrealized !== null && (
                    <span className={unrealized >= 0 ? 'text-green-500' : 'text-red-400'}>
                      {unrealized >= 0 ? '+' : ''}Rs.{Math.round(unrealized).toLocaleString()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
function BriefStat({ icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 text-center">
      <p className="text-sm leading-none">{icon}</p>
      <p className={`text-sm font-bold ${color} mt-0.5`}>{value}</p>
      <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{label}</p>
    </div>
  )
}

// ── Risk warning card shown before logging a trade ───────────────────────────
function RiskWarningCard({ trade, ltp, onConfirm, onCancel }) {
  const entryPrice = parseFloat(trade.entry)
  const qty = parseInt(trade.qty)
  const slPrice = trade.sl ? parseFloat(trade.sl) : null
  const tpPrice = trade.tp ? parseFloat(trade.tp) : null
  const ltpNum = parseFloat(ltp) || entryPrice

  const riskAmt = slPrice ? Math.abs(entryPrice - slPrice) * qty : null
  const rewardAmt = tpPrice ? Math.abs(tpPrice - entryPrice) * qty : null
  const rr = riskAmt && rewardAmt ? (rewardAmt / riskAmt).toFixed(1) : null
  const slPct = slPrice ? Math.abs(((entryPrice - slPrice) / entryPrice) * 100).toFixed(1) : null
  const noSl = !slPrice
  const badRR = rr && parseFloat(rr) < 1.5
  const warnings = []
  if (noSl) warnings.push('No stop loss set — capital at full risk')
  if (badRR) warnings.push(`R:R is ${rr}:1 — below the recommended 1:2`)

  return (
    <div className="border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-3 mb-2">
      <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1">
        ⚠️ Trade Risk Check — Review before logging
      </p>
      <div className="grid grid-cols-2 gap-1 mb-2 text-[10px]">
        <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
          <p className="text-gray-400">Symbol</p>
          <p className="font-semibold text-gray-800 dark:text-white">{trade.symbol}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
          <p className="text-gray-400">Qty × Entry</p>
          <p className="font-semibold text-gray-800 dark:text-white">{qty} × Rs.{entryPrice.toLocaleString()}</p>
        </div>
        {slPrice && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">SL ({slPct}% away)</p>
            <p className="font-semibold text-red-500">Rs.{slPrice.toLocaleString()}</p>
          </div>
        )}
        {tpPrice && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">TP</p>
            <p className="font-semibold text-green-500">Rs.{tpPrice.toLocaleString()}</p>
          </div>
        )}
        {riskAmt && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">Max Risk</p>
            <p className="font-semibold text-red-500">Rs.{Math.round(riskAmt).toLocaleString()}</p>
          </div>
        )}
        {rr && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">R:R Ratio</p>
            <p className={`font-semibold ${parseFloat(rr) >= 2 ? 'text-green-500' : parseFloat(rr) >= 1.5 ? 'text-yellow-500' : 'text-red-500'}`}>{rr}:1</p>
          </div>
        )}
      </div>
      {warnings.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5 mb-2">
          {warnings.map((w, i) => <p key={i} className="text-[10px] text-red-500">• {w}</p>)}
        </div>
      )}
      <div className="flex gap-1.5">
        <button onClick={onConfirm} className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded-xl text-[10px] font-semibold transition-colors">
          Confirm & Log Trade
        </button>
        <button onClick={onCancel} className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 py-1.5 rounded-xl text-[10px] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Discipline nudge card (shown after low discipline responses) ──────────────
function DisciplineNudgeCard({ score, onDismiss }) {
  const isLow = score < 40
  const isMid = score >= 40 && score < 70
  return (
    <div className={`border-l-2 rounded-xl px-3 py-2 mb-1.5 ${isLow ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{isLow ? '🔴' : '🟡'}</span>
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">Discipline Alert</span>
        </div>
        <button onClick={onDismiss} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 text-[10px]">✕</button>
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
        {isLow
          ? `Your 7-day discipline avg is ${score}% — critically low. Missing your daily routine is a compounding habit. Let's fix that today.`
          : `Discipline at ${score}% — room to improve. Consistent routines lead to consistent results.`
        }
      </p>
      <div className="mt-1.5 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${isLow ? 'bg-red-400' : 'bg-yellow-400'}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ── Inline quick-action forms ────────────────────────────────────────────────
// pendingRiskWarning: when set, shows risk check before sending
function QuickForm({ type, onSubmit, onCancel }) {
  const [form, setForm] = useState({})
  const [pendingWarning, setPendingWarning] = useState(null) // trade data waiting for risk confirm
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // BUY — shows risk warning before sending
  if (type === 'buy') {
    if (pendingWarning) {
      return (
        <RiskWarningCard
          trade={pendingWarning}
          ltp={null}
          onConfirm={() => {
            const f = pendingWarning
            const msg = `Buy ${f.qty} kittas of ${f.symbol} at Rs.${f.entry}${f.sl ? ` SL ${f.sl}` : ''}${f.tp ? ` TP ${f.tp}` : ''}`
            setPendingWarning(null)
            onSubmit(msg)
          }}
          onCancel={() => setPendingWarning(null)}
        />
      )
    }
    return (
      <div className="bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">📒 Log BUY Trade</p>
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Symbol (NABIL)" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
          <input placeholder="Qty (kittas)" type="number" value={form.qty||''} onChange={e=>set('qty',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
          <input placeholder="Entry price" type="number" value={form.entry||''} onChange={e=>set('entry',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
          <input placeholder="SL (optional)" type="number" value={form.sl||''} onChange={e=>set('sl',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
          <input placeholder="TP (optional)" type="number" value={form.tp||''} onChange={e=>set('tp',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol || !form.qty || !form.entry) return
            // Show risk warning first
            setPendingWarning({ symbol: form.symbol, qty: form.qty, entry: form.entry, sl: form.sl, tp: form.tp })
          }} className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Review & Log
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  if (type === 'sell') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-red-300 dark:border-red-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-red-500 flex items-center gap-1">🏁 Close / Sell Trade</p>
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Symbol (NABIL)" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
          <input placeholder="Exit price" type="number" value={form.exit||''} onChange={e=>set('exit',e.target.value)}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol || !form.exit) return
            onSubmit(`Close my ${form.symbol} trade at Rs.${form.exit}`)
          }} className="flex-1 bg-red-500 hover:bg-red-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Close Trade
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  if (type === 'watchlist') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-purple-300 dark:border-purple-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">👁️ Add to Watchlist</p>
        <div className="space-y-1.5">
          <input placeholder="Symbol (e.g. NABIL)" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400" />
          <div className="flex gap-1">
            {['active','pre-watch'].map(cat => (
              <button key={cat} onClick={() => set('cat', cat)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors ${form.cat===cat ? 'bg-purple-500 text-white border-purple-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400'}`}>
                {cat === 'active' ? '⭐ Active' : '🟡 Pre-Watch'}
              </button>
            ))}
          </div>
          <input placeholder="Price alert (optional)" type="number" value={form.alert||''} onChange={e=>set('alert',e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol) return
            const cat = form.cat || 'active'
            const msg = `Add ${form.symbol} to ${cat} watchlist${form.alert ? ` with price alert Rs.${form.alert}` : ''}`
            onSubmit(msg)
          }} className="flex-1 bg-purple-500 hover:bg-purple-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Add to Watchlist
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  if (type === 'sltp') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-orange-500 flex items-center gap-1">🎯 Update SL / TP</p>
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Symbol" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-400" />
          <input placeholder="Stop Loss" type="number" value={form.sl||''} onChange={e=>set('sl',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
          <input placeholder="Take Profit" type="number" value={form.tp||''} onChange={e=>set('tp',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol || (!form.sl && !form.tp)) return
            const parts = [`Update ${form.symbol}`]
            if (form.sl) parts.push(`SL ${form.sl}`)
            if (form.tp) parts.push(`TP ${form.tp}`)
            onSubmit(parts.join(' '))
          }} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Update SL/TP
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  // Broker fee calculator form
  if (type === 'fee') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-sky-300 dark:border-sky-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1">🧮 NEPSE Broker Fee Calculator</p>
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Symbol (NABIL)" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400" />
          <input placeholder="Qty (kittas)" type="number" value={form.qty||''} onChange={e=>set('qty',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400" />
          <input placeholder="Price (Rs.)" type="number" value={form.price||''} onChange={e=>set('price',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400" />
          <div className="col-span-2 flex gap-1">
            {['buy','sell'].map(tx => (
              <button key={tx} onClick={() => set('tx', tx)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors capitalize ${form.tx===tx ? (tx==='buy' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-sky-400'}`}>
                {tx === 'buy' ? '📈 Buy' : '📉 Sell'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.qty || !form.price) return
            const tx = form.tx || 'buy'
            const msg = `Calculate broker fee for ${tx}ing ${form.qty} kittas of ${form.symbol || 'stock'} at Rs.${form.price}`
            onSubmit(msg)
          }} className="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Calculate Fees
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  return null
}

// ── Chip definitions ─────────────────────────────────────────────────────────
const QUICK_CHIPS = [
  { id: 'buy',       label: 'Buy',       icon: '📈', color: 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30' },
  { id: 'sell',      label: 'Sell',      icon: '📉', color: 'text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30' },
  { id: 'watchlist', label: 'Watchlist', icon: '👁️', color: 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30' },
  { id: 'sltp',      label: 'SL/TP',    icon: '🎯', color: 'text-orange-500 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/30' },
  { id: 'fee',       label: 'Fees',     icon: '🧮', color: 'text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-900/30' },
  { id: 'brief',     label: 'Brief',    icon: '☀️', color: 'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30' },
]

const PRESET_PROMPTS = [
  { icon: '📊', text: 'Show my open positions' },
  { icon: '📈', text: 'What\'s my win rate this month?' },
  { icon: '🔥', text: 'Top gainers today on NEPSE' },
  { icon: '⚠️', text: 'Any risk alerts on my trades?' },
  { icon: '🎯', text: 'Suggest SL for my open trades' },
  { icon: '💼', text: 'Portfolio summary' },
]

// ── Main AIChat component ────────────────────────────────────────────────────
function AIChat({ isFullPage = false, onClose }) {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [lastAction, setLastAction] = useState(null)
  const [activeForm, setActiveForm] = useState(null)
  // Inline special cards waiting for user action
  const [journalDraft, setJournalDraft] = useState(null)   // { symbol, trade, ltp, pnl, suggestedContent }
  const [disciplineNudge, setDisciplineNudge] = useState(null) // score number

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (user) {
      getChatSuggestions()
        .then(res => setSuggestions(res.data.suggestions))
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, journalDraft])

  // Handles sending any message (from input or quick actions)
  const handleSend = async (messageText) => {
    const text = messageText || input.trim()
    if (!text || loading) return
    if (!user) { navigate('/login'); return }

    setActiveForm(null)
    const userMessage = { role: 'user', content: text, time: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await sendAgentMessage({ message: text, history: messages.slice(-6), lastAction, lang })
      const data = res.data

      // Frontend-only: theme toggle
      if (data.type === 'action' && data.action === 'TOGGLE_THEME') {
        const wantDark = data.result.mode === 'dark'
        if (wantDark !== isDark) toggleTheme()
      }

      // Journal draft — show interactive card instead of plain bubble
      if (data.type === 'action' && data.action === 'DRAFT_JOURNAL' && data.result?.draft) {
        setJournalDraft(data.result.draft)
      }

      // Morning brief — result embedded in message bubble via custom card
      // Discipline nudge: scan reply for low discipline mention
      if (data.type === 'chat' && data.reply) {
        const disciplineMatch = data.reply.match(/discipline.*?(\d+)%/i)
        if (disciplineMatch) {
          const score = parseInt(disciplineMatch[1])
          if (score < 70) setDisciplineNudge(score)
        }
      }

      // Keep lastAction alive for follow-ups
      const keepAliveActions = ['ADD_TRADE', 'CLOSE_TRADE', 'DELETE_TRADE', 'DRAFT_JOURNAL']
      if (data.type === 'pending' || (data.type === 'action' && keepAliveActions.includes(data.action))) {
        setLastAction({ action: data.action, result: data.result })
      } else {
        setLastAction(null)
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        time: new Date(),
        actionType: data.type === 'action' ? data.action : null,
        actionResult: data.type === 'action' ? data.result : null,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        time: new Date(),
        isError: true
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // Save journal draft — routes through the agent so it hits the correct trade_journal table
  const handleJournalSave = async (symbol, content) => {
    setJournalDraft(null)
    setLastAction(null)
    // Send as an ADD_JOURNAL agent message — agent will insert into trade_journal with content field
    await handleSend(`Add journal note for ${symbol}: ${content}`)
  }

  // Brief chip — send brief request immediately
  const handleBriefChip = () => {
    setActiveForm(null)
    handleSend('Morning brief — show my trading summary for today')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  // Render a single message bubble + any special cards attached
  const renderMessage = (msg, i) => {
    const showBrokerFee = msg.actionType === 'CALC_BROKER_FEE' && msg.actionResult?.fee
    const showMorningBrief = msg.actionType === 'MORNING_BRIEF' && msg.actionResult?.brief
    const showStandardCard = msg.actionType && msg.actionResult && !showBrokerFee && !showMorningBrief
      && !['DRAFT_JOURNAL'].includes(msg.actionType)

    return (
      <div
        key={i}
        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5 animate-fade-up`}
        style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
      >
        {msg.role === 'assistant' && (
          <div className="flex-shrink-0 mt-0.5"><TradeoLogo size={20} /></div>
        )}
        <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
          {/* Standard action card */}
          {showStandardCard && <ActionCard type={msg.actionType} result={msg.actionResult} />}
          {/* Broker fee breakdown card */}
          {showBrokerFee && <BrokerFeeCard fee={msg.actionResult.fee} />}
          {/* Morning brief card */}
          {showMorningBrief && <MorningBriefCard brief={msg.actionResult.brief} />}
          {/* Text bubble */}
          <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
            msg.role === 'user'
              ? 'bg-green-500 text-white rounded-tr-sm'
              : msg.isError
              ? 'bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-200 dark:border-red-800 rounded-tl-sm'
              : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
          }`}>
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
          <span className="text-gray-400 text-[10px] mt-0.5 px-1">{formatTime(msg.time)}</span>
        </div>
        {msg.role === 'user' && (
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">{user?.name?.[0]?.toUpperCase() || '?'}</span>
                </div>
            }
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <TradeoLogo size={22} />
          <div>
            <p className="text-xs font-bold tracking-tight text-gray-900 dark:text-white leading-none">Tradeo AI</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-gray-400">Agent · NEPSE</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setActiveForm(null); setJournalDraft(null); setDisciplineNudge(null); setLastAction(null) }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-[10px] px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {t('chat.clear')}
            </button>
          )}
          {!isFullPage && (
            <button
              onClick={() => navigate('/chat')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
              title="Open full page"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Quick action chips ── */}
      {user && (
        <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar">
          {QUICK_CHIPS.map(chip => (
            chip.id === 'brief' ? (
              // Brief chip sends immediately — no form
              <button
                key={chip.id}
                onClick={handleBriefChip}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all flex-shrink-0 bg-white dark:bg-gray-900 ${chip.color}`}
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ) : (
              <button
                key={chip.id}
                onClick={() => setActiveForm(activeForm === chip.id ? null : chip.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  activeForm === chip.id
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                    : `bg-white dark:bg-gray-900 ${chip.color}`
                }`}
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            )
          ))}
        </div>
      )}

      {/* ── Messages area ── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Top fade edge */}
        <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-gray-50 dark:from-gray-950 to-transparent z-10 pointer-events-none" />
        {/* Bottom fade edge */}
        <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent z-10 pointer-events-none" />
      <div className="h-full overflow-y-auto no-scrollbar px-3 py-3 space-y-3 bg-gray-50 dark:bg-gray-950">

        {/* Empty state */}
        {messages.length === 0 && !activeForm && (
          <div className="flex flex-col items-center pt-4 pb-2">
            <TradeoLogo size={42} />
            <p className="text-gray-900 dark:text-white text-sm font-semibold mt-3 mb-1">{t('chat.greeting')}</p>
            <p className="text-gray-400 text-[11px] text-center max-w-[200px] leading-relaxed mb-4">{t('chat.greetingSub')}</p>
            <div className="w-full grid grid-cols-2 gap-1.5">
              {(suggestions.length > 0
                ? suggestions.slice(0, 6).map((s, i) => ({ icon: PRESET_PROMPTS[i]?.icon || '💬', text: s }))
                : PRESET_PROMPTS
              ).map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p.text)}
                  className="flex items-start gap-1.5 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-gray-700 rounded-xl px-2.5 py-2 text-left transition-all group"
                >
                  <span className="text-sm leading-none mt-0.5">{p.icon}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-gray-200 leading-snug">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick form in empty state */}
        {activeForm && messages.length === 0 && (
          <QuickForm type={activeForm} onSubmit={handleSend} onCancel={() => setActiveForm(null)} />
        )}

        {/* Messages */}
        {messages.map((msg, i) => renderMessage(msg, i))}

        {/* Quick form after messages */}
        {activeForm && messages.length > 0 && (
          <QuickForm type={activeForm} onSubmit={handleSend} onCancel={() => setActiveForm(null)} />
        )}

        {/* Journal draft card */}
        {journalDraft && (
          <JournalDraftCard
            draft={journalDraft}
            onSave={handleJournalSave}
            onDiscard={() => { setJournalDraft(null); setLastAction(null) }}
          />
        )}

        {/* Discipline nudge card */}
        {disciplineNudge !== null && (
          <DisciplineNudgeCard score={disciplineNudge} onDismiss={() => setDisciplineNudge(null)} />
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start gap-1.5 animate-fade-up">
            <div className="flex-shrink-0 mt-0.5"><TradeoLogo size={20} /></div>
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce" style={{ animationDelay: '200ms' }} />
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      </div>{/* end outer relative wrapper */}

      {/* ── Input bar ── */}
      <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
        {!user ? (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-green-400 transition-colors"
          >
            {t('chat.loginToChat')}
          </button>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-green-400 dark:focus:border-green-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none resize-none transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-30 text-white w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIChat
