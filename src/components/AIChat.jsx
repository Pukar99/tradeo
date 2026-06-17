// =============================================================================
// AIChat.jsx — AI chat panel (floating + full-page), SSE streaming, voice input
// =============================================================================
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import {
  sendAgentMessage,
  BASE_URL,
  transcribeAudio,
  saveChatSession,
  listChatSessions,
  loadChatSession,
  deleteChatSession,
} from '../api'
import { getChatSuggestions } from '../utils/globalCache'
import { dispatchChatAction, DEBRIEF_EVENT } from '../utils/chatEvents'
import { useNavigate } from 'react-router-dom'

// ── Tradeo logo SVG (reused everywhere in chat) ──────────────────────────────
const TradeoLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1" />
    <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e" />
    <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5" />
    <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5" />
    <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444" />
    <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5" />
    <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5" />
    <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e" />
    <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5" />
    <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5" />
  </svg>
)

// ── Lightweight markdown for assistant replies ───────────────────────────────
// Groq replies use **bold**, `code`, bullets and numbered lists. Rendered as
// React elements (never innerHTML) so model output can't inject markup.
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      )
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <code key={i} className="px-1 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">
          {p.slice(1, -1)}
        </code>
      )
    return p
  })
}

function MarkdownLite({ text }) {
  if (!text) return null
  const blocks = []
  let list = null // { ordered, items }
  const flush = () => {
    if (list) {
      blocks.push(list)
      list = null
    }
  }
  text.split('\n').forEach((line) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)/)
    const heading = line.match(/^#{1,4}\s+(.*)/)
    if (bullet) {
      if (!list || list.ordered) {
        flush()
        list = { ordered: false, items: [] }
      }
      list.items.push(bullet[1])
    } else if (ordered) {
      if (!list || !list.ordered) {
        flush()
        list = { ordered: true, items: [] }
      }
      list.items.push(ordered[1])
    } else {
      flush()
      if (heading) blocks.push({ heading: heading[1] })
      else if (line.trim() !== '') blocks.push(line)
    }
  })
  flush()
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        if (typeof b === 'string')
          return (
            <p key={i} className="whitespace-pre-wrap">
              {renderInline(b)}
            </p>
          )
        if (b.heading)
          return (
            <p key={i} className="font-semibold">
              {renderInline(b.heading)}
            </p>
          )
        const Tag = b.ordered ? 'ol' : 'ul'
        return (
          <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} pl-4 space-y-0.5`}>
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it)}</li>
            ))}
          </Tag>
        )
      })}
    </div>
  )
}

// ── Action card metadata ─────────────────────────────────────────────────────
const ACTION_META = {
  ADD_TRADE: {
    icon: '📒',
    label: 'Trade Logged',
    color: 'border-green-400 bg-green-50 dark:bg-green-900/30',
  },
  CLOSE_TRADE: {
    icon: '🏁',
    label: 'Trade Closed',
    color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/30',
  },
  UPDATE_SL_TP: {
    icon: '🎯',
    label: 'SL/TP Updated',
    color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/30',
  },
  ADD_WATCHLIST: {
    icon: '👁️',
    label: 'Added to Watchlist',
    color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30',
  },
  REMOVE_WATCHLIST: {
    icon: '🗑️',
    label: 'Removed from Watchlist',
    color: 'border-gray-400 bg-gray-50 dark:bg-gray-700/50',
  },
  CONFIRM_DELETE: {
    icon: '🗑️',
    label: 'Trades Deleted',
    color: 'border-red-400 bg-red-50 dark:bg-red-900/30',
  },
  BULK_ADD_WATCHLIST: {
    icon: '👁️',
    label: 'Bulk Added to Watchlist',
    color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30',
  },
  ADD_JOURNAL: {
    icon: '📝',
    label: 'Journal Saved',
    color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30',
  },
  ADD_GOAL: {
    icon: '🏆',
    label: 'Goal Added',
    color: 'border-teal-400 bg-teal-50 dark:bg-teal-900/30',
  },
  CALC_BROKER_FEE: {
    icon: '🧮',
    label: 'Fee Breakdown',
    color: 'border-sky-400 bg-sky-50 dark:bg-sky-900/30',
  },
  DRAFT_JOURNAL: {
    icon: '✏️',
    label: 'Journal Draft',
    color: 'border-amber-400 bg-amber-50 dark:bg-amber-900/30',
  },
  MORNING_BRIEF: {
    icon: '☀️',
    label: 'Morning Brief',
    color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30',
  },
  UPDATE_WATCHLIST: {
    icon: '✏️',
    label: 'Watchlist Updated',
    color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30',
  },
  STOCK_PRICE: {
    icon: '💹',
    label: 'Stock Price',
    color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
  },
  PARTIAL_CLOSE: {
    icon: '½',
    label: 'Partial Close',
    color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/30',
  },
  UPDATE_GOAL: {
    icon: '🏆',
    label: 'Goal Updated',
    color: 'border-teal-400 bg-teal-50 dark:bg-teal-900/30',
  },
  DELETE_GOAL: {
    icon: '🗑️',
    label: 'Goal Removed',
    color: 'border-gray-400 bg-gray-50 dark:bg-gray-700/50',
  },
  UNDO: {
    icon: '↩️',
    label: 'Action Undone',
    color: 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
  },
  TOGGLE_THEME: {
    icon: '🌙',
    label: 'Theme Changed',
    color: 'border-gray-400 bg-gray-50 dark:bg-gray-700/50',
  },
  SHOW_TRADES: {
    icon: '📋',
    label: 'Your Trades',
    color: 'border-green-400 bg-green-50 dark:bg-green-900/20',
  },
  SHOW_GOALS: {
    icon: '🏆',
    label: 'Your Goals',
    color: 'border-teal-400 bg-teal-50 dark:bg-teal-900/20',
  },
  SHOW_JOURNAL: {
    icon: '📝',
    label: 'Your Journal',
    color: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
  },
  SET_DISCIPLINE_SCORE: {
    icon: '📊',
    label: 'Discipline Logged',
    color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  },
  SHOW_RISK_SUMMARY: {
    icon: '⚠️',
    label: 'Risk Summary',
    color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
  },
  WEEKLY_SUMMARY: {
    icon: '📅',
    label: 'Weekly Summary',
    color: 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
  },
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
  if (type === 'UPDATE_WATCHLIST' && result.item) {
    rows.push(result.item.symbol)
    if (result.item.price_alert) rows.push(`Price Alert: Rs.${result.item.price_alert}`)
    if (result.item.alert_date) rows.push(`Date Reminder: ${result.item.alert_date}`)
    if (result.item.category) rows.push(`Category: ${result.item.category}`)
  }
  if (type === 'STOCK_PRICE') rows.push(`${result.symbol}: Rs.${result.ltp}`)
  if (type === 'PARTIAL_CLOSE' && result.trade) {
    rows.push(`${result.trade.symbol} — sold ${result.qty} kittas`)
    rows.push(
      `P&L: ${result.pnl >= 0 ? '+' : ''}Rs.${Math.abs(result.pnl).toLocaleString()} | ${result.remaining} kittas remaining`
    )
  }
  if (type === 'UPDATE_GOAL' && result.goal)
    rows.push(result.goal.completed ? `✅ ${result.goal.title}` : result.goal.title)
  if (type === 'DELETE_GOAL') rows.push(result.title)
  if (type === 'CONFIRM_DELETE')
    rows.push(`${result.count} trade(s) for ${result.symbol} permanently removed`)
  if (type === 'UNDO') {
    if (result.undid) rows.push(`Reversed: ${result.undid}`)
    if (result.symbol) rows.push(`Symbol: ${result.symbol}`)
    if (result.title) rows.push(result.title)
    if (result.count) rows.push(`${result.count} items removed`)
  }
  if (type === 'BULK_ADD_WATCHLIST' && result.items) {
    rows.push(`${result.items.length} stocks → ${result.category}`)
    rows.push(result.items.map((i) => i.symbol).join(', '))
  }
  return (
    <div className={`border-l-2 rounded-xl px-3 py-2 mb-1.5 ${meta.color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{meta.icon}</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          ✅ {meta.label}
        </span>
      </div>
      {rows.map((r, i) => (
        <p
          key={i}
          className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug"
          translate="no"
        >
          {r}
        </p>
      ))}
    </div>
  )
}

// ── Confirm card — gated money action awaiting [Confirm]/[Cancel] (#3b) ──
function ConfirmCard({ pending, onConfirm, onCancel, done }) {
  if (!pending?.token) return null
  const risk =
    { CLOSE_TRADE: 'red', DELETE_TRADE: 'red', PARTIAL_CLOSE: 'red', UPDATE_SL_TP: 'amber', ADD_TRADE: 'emerald' }[
      pending.action
    ] || 'amber'
  const confirmColor = {
    red: 'bg-red-600 hover:bg-red-700 text-white',
    amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  }[risk]
  return (
    <div className="border-l-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 rounded-xl px-3 py-2 mb-1.5 w-full">
      <p className="text-[11px] text-gray-700 dark:text-gray-200 mb-2 leading-snug" translate="no">
        {pending.preview?.human}
      </p>
      <div className="flex gap-2">
        <button
          disabled={done}
          onClick={() => onConfirm(pending.token)}
          className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-50 transition-colors ${confirmColor}`}
        >
          {done ? '…' : 'Confirm'}
        </button>
        <button
          disabled={done}
          onClick={() => onCancel(pending.token)}
          className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Slot-fill card — money action awaiting a missing field (multi-turn binding) ──
function SlotFillCard({ slot, onSubmit, onCancel, done }) {
  // Pre-seed the optional trade date with today (buy/sell forms only). It rides in `vals`, so the
  // existing submit() picks it up automatically; it is NOT in `slot.missing`, so it never gates Continue.
  const [vals, setVals] = useState(() =>
    slot?.dateField ? { date: new Date().toISOString().slice(0, 10) } : {}
  )
  if (!slot?.missing?.length && !slot?.suggestion) return null

  const set = (f, v) => setVals((p) => ({ ...p, [f]: v }))
  const ready = slot.missing.every((f) => {
    const v = vals[f.field]
    if (v == null || v === '') return false
    if (f.kind === 'int') return /^\d+$/.test(String(v))
    if (f.kind === 'num') return /^\d+(\.\d+)?$/.test(String(v))
    return true
  })

  const submit = (extra = {}) => {
    // UPDATE_SL_TP sentinel: the sl_or_tp box fills sl (a sensible default for the common case).
    const filled = { ...vals }
    if ('sl_or_tp' in filled) {
      filled.sl = filled.sl_or_tp
      delete filled.sl_or_tp
    }
    onSubmit({ action: slot.action, ...slot.knownArgs, ...filled, ...extra })
  }

  return (
    <div className="border-l-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 rounded-xl px-3 py-2 mb-1.5 w-full">
      <p className="text-[11px] text-gray-700 dark:text-gray-200 mb-2 leading-snug" translate="no">
        {slot.reply}
      </p>
      {slot.suggestion && (
        <button
          disabled={done}
          onClick={() => submit({ symbol: slot.suggestion })}
          className="mb-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          Yes, {slot.suggestion}
        </button>
      )}
      {slot.missing.map((f) => (
        <input
          key={f.field}
          type={f.kind === 'text' ? 'text' : 'number'}
          placeholder={f.label}
          value={vals[f.field] ?? ''}
          disabled={done}
          onChange={(e) => set(f.field, f.kind === 'text' ? e.target.value.toUpperCase() : e.target.value)}
          className="w-full mb-1.5 px-2 py-1.5 rounded-lg text-[12px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100"
        />
      ))}
      {slot.dateField && (
        <label className="block mb-1.5">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{slot.dateField.label} (defaults to today)</span>
          <input
            type="date"
            value={vals.date ?? ''}
            disabled={done}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set('date', e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 rounded-lg text-[12px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100"
          />
        </label>
      )}
      <div className="flex gap-2 mt-1">
        <button
          disabled={done || !ready}
          onClick={() => submit()}
          className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
        >
          {done ? '…' : 'Continue'}
        </button>
        <button
          disabled={done}
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Disambiguation card — shown when multiple open entries exist for a symbol ──
function DisambiguationCard({ result, onPick }) {
  if (!result?.entries?.length) return null
  const actionLabel =
    {
      CLOSE_TRADE: 'Close which entry?',
      UPDATE_SL_TP: 'Update SL/TP for which entry?',
      PARTIAL_CLOSE: 'Partial close which entry?',
    }[result.original_action] || 'Which entry?'

  return (
    <div className="border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">⚠️</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          Multiple {result.symbol} entries — {actionLabel}
        </span>
      </div>
      <div className="space-y-1">
        {result.entries.map((e, i) => (
          <button
            key={e.id}
            onClick={() => onPick(e, result)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all text-left group"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}</span>
              <div>
                <p
                  className="text-[11px] font-semibold text-gray-800 dark:text-white"
                  translate="no"
                >
                  {e.position} · Rs.{parseFloat(e.entry_price).toFixed(2)} · {e.quantity} kittas
                </p>
                <p className="text-[10px] text-gray-400">{e.date}</p>
              </div>
            </div>
            <svg
              className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
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
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200" translate="no">
          NEPSE Fee Breakdown — {fee.transaction === 'buy' ? 'BUY' : 'SELL'} {fee.quantity} kittas
          {fee.symbol ? ` of ${fee.symbol}` : ''} @ Rs.{fee.price?.toLocaleString()}
        </span>
      </div>
      <div className="space-y-0.5">
        <FeeRow label="Total Value" value={`Rs.${fee.totalValue?.toLocaleString()}`} />
        <FeeRow
          label={`Broker (${fee.brokerRate}%)`}
          value={`Rs.${fee.brokerCommission?.toLocaleString()}`}
          dim
        />
        <FeeRow label="SEBON (0.015%)" value={`Rs.${fee.sebon?.toLocaleString()}`} dim />
        {fee.dp > 0 && <FeeRow label="DP Charge" value={`Rs.${fee.dp}`} dim />}
        {fee.capitalGainTax > 0 && (
          <FeeRow
            label={`CGT (${fee.cgtRate}% · ${fee.holdingDays}d ${fee.holdingType === 'long' ? 'long-term' : 'short-term'})`}
            value={`Rs.${fee.capitalGainTax?.toLocaleString()}`}
            dim
          />
        )}
        {fee.transaction === 'sell' && fee.capitalGainTax === 0 && fee.holdingDays !== null && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5" translate="no">
            No CGT — no profit on this trade ({fee.holdingDays}d held)
          </p>
        )}
        {fee.transaction === 'sell' && fee.holdingDays === null && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5">
            CGT not estimated — trade entry not found
          </p>
        )}
        <div className="border-t border-sky-200 dark:border-sky-800 my-1" />
        <FeeRow
          label="Total Charges"
          value={`Rs.${fee.totalCharges?.toLocaleString()}`}
          accent="text-red-500"
        />
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
      <span
        className={`text-[10px] ${dim ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}
      >
        {label}
      </span>
      <span
        className={`text-[10px] ${accent || (dim ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200')}`}
        translate="no"
      >
        {value}
      </span>
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
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${draft.pnl >= 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'bg-red-100 dark:bg-red-900/40 text-red-500'}`}
          >
            {draft.pnl >= 0 ? '+' : ''}Rs.{Math.abs(draft.pnl).toLocaleString()} P&L
          </span>
        )}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
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

// ── Show trades card ──────────────────────────────────────────────────────────
function ShowTradesCard({ result }) {
  if (!result?.trades) return null
  const { trades, filter } = result
  const labelMap = { open: 'Open / Partial', closed: 'Closed', all: 'All' }
  return (
    <div className="border-l-2 border-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">📋</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          {labelMap[filter] || 'Your'} Trades ({trades.length})
        </span>
      </div>
      {trades.length === 0 ? (
        <p className="text-[10px] text-gray-400">No trades found.</p>
      ) : (
        <div className="space-y-1">
          {trades.map((t, i) => {
            const qty = parseInt(t.remaining_quantity ?? t.quantity, 10) || 0
            const entry = parseFloat(t.entry_price)
            const ltp = t.ltp ? parseFloat(t.ltp) : null
            const unrealized =
              ltp && t.status !== 'CLOSED'
                ? (t.position === 'LONG' ? ltp - entry : entry - ltp) * qty
                : null
            const realized =
              t.status === 'CLOSED' || t.status === 'PARTIAL'
                ? parseFloat(t.realized_pnl || 0)
                : null
            const pnl = realized ?? unrealized
            const statusColor =
              t.status === 'OPEN'
                ? 'text-green-500'
                : t.status === 'PARTIAL'
                  ? 'text-yellow-500'
                  : 'text-gray-400'
            return (
              <div
                key={t.id}
                className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 border border-gray-100 dark:border-gray-800"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase ${statusColor}`}>
                    {t.status}
                  </span>
                  <span
                    className="text-[11px] font-semibold text-gray-800 dark:text-white"
                    translate="no"
                  >
                    {t.symbol}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {t.position} · {qty}@{entry}
                  </span>
                </div>
                {pnl !== null && (
                  <span
                    className={`text-[10px] font-semibold ${pnl >= 0 ? 'text-green-500' : 'text-red-400'}`}
                    translate="no"
                  >
                    {pnl >= 0 ? '+' : ''}Rs.{Math.round(pnl).toLocaleString()}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Show goals card ───────────────────────────────────────────────────────────
function ShowGoalsCard({ result }) {
  if (!result?.goals) return null
  const { goals, filter } = result
  const pending = goals.filter((g) => !g.completed)
  const done = goals.filter((g) => g.completed)
  return (
    <div className="border-l-2 border-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">🏆</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          Goals ({done.length}/{goals.length} completed)
        </span>
      </div>
      {goals.length === 0 ? (
        <p className="text-[10px] text-gray-400">No goals found.</p>
      ) : (
        <div className="space-y-1">
          {goals.map((g, i) => (
            <div
              key={g.id}
              className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 border border-gray-100 dark:border-gray-800"
            >
              <span className="text-sm">{g.completed ? '✅' : '⬜'}</span>
              <span
                className={`text-[10px] ${g.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}
              >
                {g.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Show journal card ──────────────────────────────────────────────────────────
function ShowJournalCard({ result }) {
  if (!result?.entries) return null
  const { entries, symbol } = result
  return (
    <div className="border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">📝</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          Journal{symbol ? ` — ${symbol}` : ''} ({entries.length})
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[10px] text-gray-400">No journal entries found.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => (
            <div
              key={e.id}
              className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 border border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className="text-[10px] font-semibold text-gray-700 dark:text-gray-200"
                  translate="no"
                >
                  {e.symbol}
                </span>
                <span className="text-[10px] text-gray-400">{e.created_at?.slice(0, 10)}</span>
              </div>
              {e.notes && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                  {e.notes}
                </p>
              )}
              {e.pre_trade_reasoning && (
                <p className="text-[10px] text-blue-400 mt-0.5 leading-snug line-clamp-1">
                  Pre: {e.pre_trade_reasoning}
                </p>
              )}
              {e.post_trade_evaluation && (
                <p className="text-[10px] text-purple-400 mt-0.5 leading-snug line-clamp-1">
                  Post: {e.post_trade_evaluation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Trade plan card — TRADE_PLAN returns a full technical plan ────────────────
function PlanStat({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p
        className={`text-[11px] font-semibold ${accent || 'text-gray-800 dark:text-white'}`}
        translate="no"
      >
        {value}
      </p>
    </div>
  )
}

function TradePlanCard({ plan }) {
  if (!plan) return null
  const trendCls =
    plan.trend === 'UPTREND'
      ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
      : plan.trend === 'DOWNTREND'
        ? 'bg-red-100 dark:bg-red-900/40 text-red-500'
        : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400'
  return (
    <div className="border-l-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📐</span>
          <span
            className="text-[11px] font-semibold text-gray-700 dark:text-gray-200"
            translate="no"
          >
            Trade Plan — {plan.symbol} · Rs.{plan.ltp?.toLocaleString()}
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${trendCls}`}>
          {plan.trend}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-1.5">
        <PlanStat
          label="RSI"
          value={plan.rsi}
          accent={plan.rsi >= 70 ? 'text-red-400' : plan.rsi <= 30 ? 'text-green-500' : undefined}
        />
        <PlanStat label="ATR" value={plan.atr} />
        <PlanStat label="EMA20" value={plan.ema20} />
        <PlanStat label="EMA50" value={plan.ema50} />
      </div>
      <div className="grid grid-cols-2 gap-1 mb-1.5">
        <PlanStat
          label="Support"
          value={`Rs.${plan.nearest_support?.toLocaleString()}`}
          accent="text-green-500"
        />
        <PlanStat
          label="Resistance"
          value={`Rs.${plan.nearest_resistance?.toLocaleString()}`}
          accent="text-red-400"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 mb-1.5 border border-blue-100 dark:border-blue-900/50">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
          Suggested Setup
        </p>
        <div className="space-y-0.5 text-[10px]" translate="no">
          <div className="flex justify-between">
            <span className="text-gray-400">Entry</span>
            <span className="font-semibold text-gray-800 dark:text-white">
              Rs.{plan.suggested_entry?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Stop Loss</span>
            <span className="font-semibold text-red-500">
              Rs.{plan.suggested_sl?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Target 1</span>
            <span className="font-semibold text-green-500">
              Rs.{plan.suggested_tp1?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Target 2</span>
            <span className="font-semibold text-green-500">
              Rs.{plan.suggested_tp2?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-0.5 mt-0.5">
            <span className="text-gray-400">R:R Ratio</span>
            <span
              className={`font-semibold ${plan.rr_ratio >= 2 ? 'text-green-500' : plan.rr_ratio >= 1.5 ? 'text-yellow-500' : 'text-red-500'}`}
            >
              {plan.rr_ratio}:1
            </span>
          </div>
        </div>
      </div>

      {plan.ai_analysis && (
        <div className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
          <MarkdownLite text={plan.ai_analysis} />
        </div>
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-1.5">
        Algorithmic suggestion — not financial advice.
      </p>
    </div>
  )
}

// ── Risk summary card — SHOW_RISK_SUMMARY: capital at risk across positions ───
function RiskSummaryCard({ result }) {
  if (!result?.positions) return null
  const { positions, totalInvested, totalRisk, totalUnrealized, noSlCount } = result
  return (
    <div className="border-l-2 border-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">⚠️</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          Risk Summary ({positions.length} open)
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        <PlanStat label="Invested" value={`Rs.${Math.round(totalInvested).toLocaleString()}`} />
        <PlanStat
          label="At Risk"
          value={`Rs.${Math.round(totalRisk).toLocaleString()}`}
          accent="text-red-500"
        />
        <PlanStat
          label="Unrealized"
          value={`${totalUnrealized >= 0 ? '+' : ''}Rs.${Math.round(totalUnrealized).toLocaleString()}`}
          accent={totalUnrealized >= 0 ? 'text-green-500' : 'text-red-400'}
        />
      </div>
      {positions.length > 0 && (
        <div className="space-y-1 mb-1.5">
          {positions.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 border border-gray-100 dark:border-gray-800 text-[10px]"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-800 dark:text-white" translate="no">
                  {p.symbol}
                </span>
                <span className="text-gray-400" translate="no">
                  {p.qty}@{p.entry}
                </span>
              </div>
              {p.riskAmount != null ? (
                <span className="font-semibold text-red-400" translate="no">
                  −Rs.{Math.round(p.riskAmount).toLocaleString()} max
                </span>
              ) : (
                <span className="font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500">
                  no SL
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {noSlCount > 0 && (
        <p className="text-[10px] text-red-500 font-medium">
          {noSlCount} position{noSlCount > 1 ? 's' : ''} without a stop loss — capital fully
          exposed.
        </p>
      )}
    </div>
  )
}

// ── Weekly summary card — WEEKLY_SUMMARY: this week's performance ─────────────
function WeeklySummaryCard({ result }) {
  if (!result) return null
  const {
    totalPnl,
    wins,
    losses,
    winRate,
    tradesOpened,
    tradesClosed,
    bestTrade,
    worstTrade,
    avgDiscipline,
  } = result
  return (
    <div className="border-l-2 border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">📅</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          This Week's Performance
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        <PlanStat
          label="Net P&L"
          value={`${totalPnl >= 0 ? '+' : ''}Rs.${Math.round(totalPnl).toLocaleString()}`}
          accent={totalPnl >= 0 ? 'text-green-500' : 'text-red-400'}
        />
        <PlanStat
          label="Win Rate"
          value={`${winRate}%`}
          accent={winRate >= 50 ? 'text-green-500' : 'text-red-400'}
        />
        <PlanStat label="W / L" value={`${wins} / ${losses}`} />
      </div>
      <div className="space-y-0.5 text-[10px] mb-1.5" translate="no">
        <div className="flex justify-between">
          <span className="text-gray-400">Opened / Closed</span>
          <span className="text-gray-600 dark:text-gray-300">
            {tradesOpened} / {tradesClosed}
          </span>
        </div>
        {bestTrade && (
          <div className="flex justify-between">
            <span className="text-gray-400">Best</span>
            <span className="text-green-500 font-semibold">
              {bestTrade.symbol} +Rs.{bestTrade.pnl.toLocaleString()}
            </span>
          </div>
        )}
        {worstTrade && worstTrade.pnl < 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">Worst</span>
            <span className="text-red-400 font-semibold">
              {worstTrade.symbol} −Rs.{Math.abs(worstTrade.pnl).toLocaleString()}
            </span>
          </div>
        )}
      </div>
      {avgDiscipline !== null && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Discipline avg:</span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${avgDiscipline >= 70 ? 'bg-green-400' : avgDiscipline >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${avgDiscipline}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
            {avgDiscipline}%
          </span>
        </div>
      )}
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
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          {greeting}! Your Trading Brief
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        <BriefStat
          icon="📈"
          label="Open Trades"
          value={brief.openTradesCount}
          color="text-green-600 dark:text-green-400"
        />
        <BriefStat
          icon="👁️"
          label="Watch Alerts"
          value={brief.watchAlertsCount}
          color="text-purple-600 dark:text-purple-400"
        />
        <BriefStat
          icon="🏆"
          label="Goals Pending"
          value={brief.pendingGoalsCount}
          color="text-teal-600 dark:text-teal-400"
        />
      </div>

      {/* Discipline */}
      {brief.avgDiscipline !== null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            7-day discipline avg:
          </span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${brief.avgDiscipline >= 70 ? 'bg-green-400' : brief.avgDiscipline >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${brief.avgDiscipline}%` }}
            />
          </div>
          <span
            className={`text-[10px] font-semibold ${brief.avgDiscipline >= 70 ? 'text-green-500' : brief.avgDiscipline >= 40 ? 'text-yellow-500' : 'text-red-500'}`}
          >
            {brief.avgDiscipline}%
          </span>
        </div>
      )}

      {/* Risk alerts */}
      {brief.riskAlerts?.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-red-500 mb-0.5">⚠️ Risk Alerts</p>
          {brief.riskAlerts.map((a, i) => (
            <p key={i} className="text-[10px] text-red-400">
              {a.symbol} — {a.reason}
            </p>
          ))}
        </div>
      )}

      {/* Near target */}
      {brief.nearTarget?.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-green-600 mb-0.5">
            🎯 Near Target — Consider booking profit
          </p>
          {brief.nearTarget.map((a, i) => (
            <p key={i} className="text-[10px] text-green-500" translate="no">
              {a.symbol} → TP: Rs.{a.tp}
            </p>
          ))}
        </div>
      )}

      {/* Watchlist alerts */}
      {brief.watchAlerts?.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mb-1">
            👁️ Watchlist Alerts
          </p>
          {brief.watchAlerts.map((w, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="font-medium text-gray-700 dark:text-gray-300" translate="no">
                {w.symbol}
              </span>
              <span className="text-gray-400" translate="no">
                {w.ltp ? `Rs.${w.ltp}` : '—'}
              </span>
              {w.alertStatus && <span className="text-purple-500">{w.alertStatus}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Pending goals */}
      {brief.pendingGoals?.length > 0 && (
        <div className="mb-1.5">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
            🏆 Pending Goals
          </p>
          {brief.pendingGoals.map((g, i) => (
            <p key={i} className="text-[10px] text-gray-500 dark:text-gray-400">
              • {g}
            </p>
          ))}
        </div>
      )}

      {/* Open positions table */}
      {brief.openTrades?.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Open Positions
          </p>
          <div className="space-y-0.5">
            {brief.openTrades.map((t, i) => {
              const unrealized = t.ltp
                ? (t.position === 'LONG' ? t.ltp - t.entry : t.entry - t.ltp) * t.qty
                : null
              return (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{t.symbol}</span>
                  <span className="text-gray-400">
                    {t.qty}@{t.entry}
                  </span>
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
      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{label}</p>
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
          <p className="font-semibold text-gray-800 dark:text-white">
            {qty} × Rs.{entryPrice.toLocaleString()}
          </p>
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
            <p
              className={`font-semibold ${parseFloat(rr) >= 2 ? 'text-green-500' : parseFloat(rr) >= 1.5 ? 'text-yellow-500' : 'text-red-500'}`}
            >
              {rr}:1
            </p>
          </div>
        )}
      </div>
      {warnings.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5 mb-2">
          {warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-red-500">
              • {w}
            </p>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={onConfirm}
          className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded-xl text-[10px] font-semibold transition-colors"
        >
          Confirm & Log Trade
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 py-1.5 rounded-xl text-[10px] transition-colors"
        >
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
    <div
      className={`border-l-2 rounded-xl px-3 py-2 mb-1.5 ${isLow ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{isLow ? '🔴' : '🟡'}</span>
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
            Discipline Alert
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 text-[10px]"
        >
          ✕
        </button>
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
        {isLow
          ? `Your 7-day discipline avg is ${score}% — critically low. Missing your daily routine is a compounding habit. Let's fix that today.`
          : `Discipline at ${score}% — room to improve. Consistent routines lead to consistent results.`}
      </p>
      <div className="mt-1.5 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isLow ? 'bg-red-400' : 'bg-yellow-400'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// ── Inline quick-action forms ────────────────────────────────────────────────
// pendingRiskWarning: when set, shows risk check before sending
function QuickForm({ type, onSubmit, onCancel }) {
  const [form, setForm] = useState({})
  const [pendingWarning, setPendingWarning] = useState(null) // trade data waiting for risk confirm
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

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
        <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
          📒 Log BUY Trade
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol (NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
          <input
            placeholder="Qty (kittas)"
            type="number"
            value={form.qty || ''}
            onChange={(e) => set('qty', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
          <input
            placeholder="Entry price"
            type="number"
            value={form.entry || ''}
            onChange={(e) => set('entry', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
          <input
            placeholder="SL (optional)"
            type="number"
            value={form.sl || ''}
            onChange={(e) => set('sl', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
          <input
            placeholder="TP (optional)"
            type="number"
            value={form.tp || ''}
            onChange={(e) => set('tp', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol || !form.qty || !form.entry) return
              // Show risk warning first
              setPendingWarning({
                symbol: form.symbol,
                qty: form.qty,
                entry: form.entry,
                sl: form.sl,
                tp: form.tp,
              })
            }}
            className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Review & Log
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (type === 'sell') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-red-300 dark:border-red-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-red-500 flex items-center gap-1">
          🏁 Close / Sell Trade
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol (NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
          <input
            placeholder="Exit price"
            type="number"
            value={form.exit || ''}
            onChange={(e) => set('exit', e.target.value)}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol || !form.exit) return
              onSubmit(`Close my ${form.symbol} trade at Rs.${form.exit}`)
            }}
            className="flex-1 bg-red-500 hover:bg-red-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Close Trade
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (type === 'watchlist') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-purple-300 dark:border-purple-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
          👁️ Add to Watchlist
        </p>
        <div className="space-y-1.5">
          <input
            placeholder="Symbol (e.g. NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400"
          />
          <div className="flex gap-1">
            {['active', 'pre'].map((cat) => (
              <button
                key={cat}
                onClick={() => set('cat', cat)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors ${form.cat === cat ? 'bg-purple-500 text-white border-purple-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400'}`}
              >
                {cat === 'active' ? '⭐ Active' : '🟡 Pre-Watch'}
              </button>
            ))}
          </div>
          <input
            placeholder="Price alert (optional)"
            type="number"
            value={form.alert || ''}
            onChange={(e) => set('alert', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol) return
              const cat = form.cat || 'active'
              const msg = `Add ${form.symbol} to ${cat} watchlist${form.alert ? ` with price alert Rs.${form.alert}` : ''}`
              onSubmit(msg)
            }}
            className="flex-1 bg-purple-500 hover:bg-purple-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Add to Watchlist
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (type === 'sltp') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-orange-500 flex items-center gap-1">
          🎯 Update SL / TP
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-400"
          />
          <input
            placeholder="Stop Loss"
            type="number"
            value={form.sl || ''}
            onChange={(e) => set('sl', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
          <input
            placeholder="Take Profit"
            type="number"
            value={form.tp || ''}
            onChange={(e) => set('tp', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol || (!form.sl && !form.tp)) return
              const parts = [`Update ${form.symbol}`]
              if (form.sl) parts.push(`SL ${form.sl}`)
              if (form.tp) parts.push(`TP ${form.tp}`)
              onSubmit(parts.join(' '))
            }}
            className="flex-1 bg-orange-500 hover:bg-orange-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Update SL/TP
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  // Broker fee calculator form
  if (type === 'fee') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-sky-300 dark:border-sky-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1">
          🧮 NEPSE Broker Fee Calculator
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol (NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400"
          />
          <input
            placeholder="Qty (kittas)"
            type="number"
            value={form.qty || ''}
            onChange={(e) => set('qty', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400"
          />
          <input
            placeholder="Price (Rs.)"
            type="number"
            value={form.price || ''}
            onChange={(e) => set('price', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400"
          />
          <div className="col-span-2 flex gap-1">
            {['buy', 'sell'].map((tx) => (
              <button
                key={tx}
                onClick={() => set('tx', tx)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors capitalize ${form.tx === tx ? (tx === 'buy' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-sky-400'}`}
              >
                {tx === 'buy' ? '📈 Buy' : '📉 Sell'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.qty || !form.price) return
              const tx = form.tx || 'buy'
              const msg = `Calculate broker fee for ${tx}ing ${form.qty} kittas of ${form.symbol || 'stock'} at Rs.${form.price}`
              onSubmit(msg)
            }}
            className="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Calculate Fees
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ── Chip definitions ─────────────────────────────────────────────────────────
const QUICK_CHIPS = [
  {
    id: 'buy',
    label: 'Buy',
    icon: '📈',
    color:
      'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30',
  },
  {
    id: 'sell',
    label: 'Sell',
    icon: '📉',
    color:
      'text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30',
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: '👁️',
    color:
      'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30',
  },
  {
    id: 'sltp',
    label: 'SL/TP',
    icon: '🎯',
    color:
      'text-orange-500 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/30',
  },
  {
    id: 'fee',
    label: 'Fees',
    icon: '🧮',
    color:
      'text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-900/30',
  },
  {
    id: 'brief',
    label: 'Brief',
    icon: '☀️',
    color:
      'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30',
  },
]

const PRESET_PROMPTS = [
  { icon: '📊', text: 'Show my open positions' },
  { icon: '📐', text: 'Trade plan for NABIL' },
  { icon: '⚠️', text: 'Show my risk summary' },
  { icon: '📅', text: 'How did I do this week?' },
  { icon: '🔥', text: 'Top gainers today on NEPSE' },
  { icon: '🎯', text: 'Suggest SL for my open trades' },
  { icon: '🧮', text: 'Calculate broker fee for buying 100 kittas at Rs.500' },
  { icon: '📝', text: 'Draft a journal for my latest trade' },
]

// ── Slash commands — type "/" in the input for the full capability list ───────
// type: 'form'   → opens the matching QuickForm
//       'send'   → sends a preset message to the agent immediately
//       'insert' → inserts a stub into the input for the user to finish
//       'new'    → clears the conversation
const SLASH_COMMANDS = [
  { cmd: 'buy', icon: '📈', desc: 'Log a buy trade', type: 'form', arg: 'buy' },
  { cmd: 'sell', icon: '📉', desc: 'Close / sell a trade', type: 'form', arg: 'sell' },
  { cmd: 'watch', icon: '👁️', desc: 'Add a stock to watchlist', type: 'form', arg: 'watchlist' },
  { cmd: 'sltp', icon: '🎯', desc: 'Update stop loss / target', type: 'form', arg: 'sltp' },
  { cmd: 'fee', icon: '🧮', desc: 'NEPSE broker fee calculator', type: 'form', arg: 'fee' },
  {
    cmd: 'plan',
    icon: '📐',
    desc: 'AI trade plan for a stock',
    type: 'insert',
    arg: 'Trade plan for ',
  },
  { cmd: 'price', icon: '💹', desc: 'Live price of a stock', type: 'insert', arg: 'Price of ' },
  {
    cmd: 'brief',
    icon: '☀️',
    desc: 'Morning trading brief',
    type: 'send',
    arg: 'Morning brief — show my trading summary for today',
  },
  {
    cmd: 'risk',
    icon: '⚠️',
    desc: 'Capital-at-risk summary',
    type: 'send',
    arg: 'Show my risk summary',
  },
  {
    cmd: 'week',
    icon: '📅',
    desc: "This week's performance",
    type: 'send',
    arg: 'How did I do this week?',
  },
  { cmd: 'trades', icon: '📋', desc: 'Show open trades', type: 'send', arg: 'Show my open trades' },
  { cmd: 'goals', icon: '🏆', desc: 'Show goals', type: 'send', arg: 'Show my goals' },
  {
    cmd: 'journal',
    icon: '📝',
    desc: 'Show journal entries',
    type: 'send',
    arg: 'Show my journal',
  },
  { cmd: 'undo', icon: '↩️', desc: 'Undo last action', type: 'send', arg: 'Undo my last action' },
  { cmd: 'new', icon: '🧹', desc: 'Start a new chat', type: 'new' },
]

// ── Contextual follow-ups — suggested next steps after an action completes ────
// Keyed by actionType; each returns [{ label, text }] sent as a normal message.
const FOLLOW_UPS = {
  ADD_TRADE: (r) => [
    r.trade?.symbol && { label: '✏️ Draft journal', text: `Draft a journal for ${r.trade.symbol}` },
    { label: '⚠️ Risk summary', text: 'Show my risk summary' },
  ],
  CLOSE_TRADE: (r) => [
    r.trade?.symbol && { label: '✏️ Draft journal', text: `Draft a journal for ${r.trade.symbol}` },
    { label: '📅 Week so far', text: 'How did I do this week?' },
  ],
  STOCK_PRICE: (r) => [
    r.symbol && { label: '📐 Trade plan', text: `Trade plan for ${r.symbol}` },
    r.symbol && { label: '👁️ Watch', text: `Add ${r.symbol} to watchlist` },
  ],
  TRADE_PLAN: (r) => [
    r.plan?.symbol && {
      label: '👁️ Add to watchlist',
      text: `Add ${r.plan.symbol} to watchlist with price alert Rs.${r.plan.suggested_entry}`,
    },
  ],
  SHOW_TRADES: () => [{ label: '⚠️ Risk summary', text: 'Show my risk summary' }],
  SHOW_RISK_SUMMARY: (r) => [
    r.noSlCount > 0 && { label: '🎯 Fix missing SLs', text: 'Suggest SL for my open trades' },
    { label: '📋 Open trades', text: 'Show my open trades' },
  ],
  WEEKLY_SUMMARY: () => [{ label: '📋 Show trades', text: 'Show my trades' }],
  MORNING_BRIEF: () => [{ label: '⚠️ Risk summary', text: 'Show my risk summary' }],
}

// ── Main AIChat component ────────────────────────────────────────────────────
function AIChat({ isFullPage = false, onClose, onDragStart }) {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('chat_messages')
      if (!saved) return []
      // Revive time strings back to Date objects
      return JSON.parse(saved).map((m) => ({ ...m, time: m.time ? new Date(m.time) : undefined }))
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  // P4-004: persist lastAction in sessionStorage so undo survives within the same tab session
  const [lastAction, setLastAction] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('chat_lastAction'))
    } catch {
      return null
    }
  })
  const [activeForm, setActiveForm] = useState(null)
  // Inline special cards waiting for user action
  const [journalDraft, setJournalDraft] = useState(null) // { symbol, trade, ltp, pnl, suggestedContent }
  const [disciplineNudge, setDisciplineNudge] = useState(null) // score number

  // Copy-to-clipboard feedback — which message id shows the "copied" check
  const [copiedId, setCopiedId] = useState(null)
  const copiedTimerRef = useRef(null)

  // Smart auto-scroll: only follow new messages when the user is already near
  // the bottom. Ref mirrors state so the scroll effect reads it without
  // re-subscribing; guard in setAtBottom avoids re-render per scroll event.
  const [atBottom, setAtBottom] = useState(true)
  const atBottomRef = useRef(true)
  const scrollBoxRef = useRef(null)

  // ── Chat session persistence ─────────────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const currentSessionIdRef = useRef(null)
  const [sessions, setSessions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const saveTimeoutRef = useRef(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortCtrlRef = useRef(null)
  // P3-002: always-fresh ref so handleSend never closes over stale lastAction
  const lastActionRef = useRef(lastAction)

  // ── Voice input state ──────────────────────────────────────────────────────
  // 'idle' | 'listening' | 'processing' | 'error'
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceError, setVoiceError] = useState('')
  const [voiceSeconds, setVoiceSeconds] = useState(0) // recording duration counter
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const silenceTimerRef = useRef(null) // 4s auto-stop timer
  const recordTickRef = useRef(null) // seconds counter interval
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const silenceFrameRef = useRef(null) // rAF for silence detection
  const streamRef = useRef(null)

  // Cancel any in-flight SSE stream + voice recording on unmount
  useEffect(() => {
    return () => {
      abortCtrlRef.current?.abort()
      stopVoiceRecording()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // P4-004: sync lastAction to sessionStorage so undo survives in-tab refresh
  // P3-002: keep ref in sync so handleSend always reads the latest lastAction
  useEffect(() => {
    lastActionRef.current = lastAction
    if (lastAction) sessionStorage.setItem('chat_lastAction', JSON.stringify(lastAction))
    else sessionStorage.removeItem('chat_lastAction')
  }, [lastAction])

  // Persist messages to sessionStorage — keep last 30 to stay within storage limits
  // Streaming messages (incomplete) are excluded to avoid storing partial content
  useEffect(() => {
    try {
      const toSave = messages.filter((m) => !m.streaming).slice(-30)
      sessionStorage.setItem('chat_messages', JSON.stringify(toSave))
    } catch {
      /* storage full or private mode — fail silently */
    }
  }, [messages])

  // Keep session ID ref in sync so the save timeout always reads current value
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // Auto-save session to Supabase 3s after any message change (debounced)
  useEffect(() => {
    const completed = messages.filter((m) => !m.streaming && m.content)
    if (!user || completed.length === 0) return
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const sid = currentSessionIdRef.current
        const payload = {
          messages: completed.slice(-50).map((m) => ({
            role: m.role,
            content: m.content,
            actionType: m.actionType || null,
            time: m.time || null,
          })),
          ...(sid ? { session_id: sid } : {}),
        }
        const res = await saveChatSession(payload)
        if (!sid && res.data?.id) {
          setCurrentSessionId(res.data.id)
        }
      } catch {
        /* fail silently — session save is non-critical */
      }
    }, 3000)
    return () => clearTimeout(saveTimeoutRef.current)
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      getChatSuggestions()
        .then((res) => setSuggestions(res.data?.suggestions || []))
        .catch(() => {})
    }
  }, [user])

  // ── Inject AI Trade Coach debrief when fired by LogsPage after close ─────────
  useEffect(() => {
    const handler = (e) => {
      const { symbol, debrief } = e.detail || {}
      if (!debrief) return
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: `Coach · ${symbol || 'Trade'} closed\n\n${debrief}`,
          time: new Date(),
          isCoach: true,
        },
      ])
    }
    window.addEventListener(DEBRIEF_EVENT, handler)
    return () => window.removeEventListener(DEBRIEF_EVENT, handler)
  }, [])

  useEffect(() => {
    if (atBottomRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, journalDraft])

  const handleChatScroll = () => {
    const el = scrollBoxRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    atBottomRef.current = near
    setAtBottom((prev) => (prev === near ? prev : near))
  }

  const scrollToBottom = () => {
    atBottomRef.current = true
    setAtBottom(true)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCopy = (msg) => {
    navigator.clipboard.writeText(msg.content).catch(() => {})
    setCopiedId(msg.id)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1500)
  }

  // ── Voice helpers ──────────────────────────────────────────────────────────
  function stopVoiceRecording() {
    clearTimeout(silenceTimerRef.current)
    clearInterval(recordTickRef.current)
    cancelAnimationFrame(silenceFrameRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
  }

  async function transcribeAndSend(chunks, autoSend) {
    if (!chunks.length) {
      setVoiceState('idle')
      return
    }
    setVoiceState('processing')
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')
      const { data } = await transcribeAudio(formData)
      const text = data.text?.trim()
      if (!text) {
        setVoiceState('idle')
        return
      }
      setInput((prev) => (prev ? prev + ' ' : '') + text)
      setVoiceState('idle')
      if (autoSend) {
        // small delay so state settles, then fire send with the full new text
        setTimeout(() => handleSend((input ? input + ' ' : '') + text), 80)
      } else {
        inputRef.current?.focus()
      }
    } catch (err) {
      setVoiceError(err.message || 'Transcription failed')
      setVoiceState('error')
      setTimeout(() => {
        setVoiceState('idle')
        setVoiceError('')
      }, 3500)
    }
  }

  // ── Voice input toggle ─────────────────────────────────────────────────────
  const SILENCE_MS = 4000 // auto-stop after 4 s of silence
  const SILENCE_THRESHOLD = 8 // RMS below this = silent (0–255 scale)

  const handleVoice = async () => {
    // Stop if already recording
    if (voiceState === 'listening') {
      stopVoiceRecording()
      const chunks = [...audioChunksRef.current]
      audioChunksRef.current = []
      setVoiceState('idle')
      setVoiceSeconds(0)
      await transcribeAndSend(chunks, false)
      return
    }
    if (voiceState === 'processing') return

    setVoiceError('')
    audioChunksRef.current = []

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      setVoiceError('Microphone access denied')
      setVoiceState('error')
      setTimeout(() => {
        setVoiceState('idle')
        setVoiceError('')
      }, 3500)
      return
    }
    streamRef.current = stream

    // ── Silence detection via AnalyserNode ─────────────────────────────────
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser
    const dataArr = new Uint8Array(analyser.frequencyBinCount)

    let silentSince = Date.now()
    let hasSpeech = false

    function checkSilence() {
      analyser.getByteTimeDomainData(dataArr)
      // RMS of signal around 128 (silence baseline)
      let sum = 0
      for (let i = 0; i < dataArr.length; i++) sum += Math.abs(dataArr[i] - 128)
      const rms = sum / dataArr.length

      if (rms > SILENCE_THRESHOLD) {
        silentSince = Date.now()
        hasSpeech = true
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(async () => {
          // 4 s of silence after speech → auto-stop + auto-send
          stopVoiceRecording()
          const chunks = [...audioChunksRef.current]
          audioChunksRef.current = []
          setVoiceState('idle')
          setVoiceSeconds(0)
          await transcribeAndSend(chunks, true)
        }, SILENCE_MS)
      }
      silenceFrameRef.current = requestAnimationFrame(checkSilence)
    }
    silenceFrameRef.current = requestAnimationFrame(checkSilence)

    // ── MediaRecorder ───────────────────────────────────────────────────────
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) audioChunksRef.current.push(e.data)
    }
    recorder.start(250) // chunk every 250 ms so we always get data

    setVoiceState('listening')
    setVoiceSeconds(0)
    recordTickRef.current = setInterval(() => setVoiceSeconds((s) => s + 1), 1000)
  }

  // ── Shared non-stream response handler ──────────────────────────────────────
  // Called by both handleSend (JSON branch) and handleAction (confirm/cancel).
  const handleAgentResponse = (data) => {
    // Frontend-only: theme toggle
    if (data.type === 'action' && data.action === 'TOGGLE_THEME') {
      const wantDark = data.result.mode === 'dark'
      if (wantDark !== isDark) toggleTheme()
    }

    // Journal draft — show interactive card instead of plain bubble
    if (data.type === 'action' && data.action === 'DRAFT_JOURNAL' && data.result?.draft) {
      setJournalDraft(data.result.draft)
    }

    // Dispatch event so other components re-fetch instantly
    if (data.type === 'action' && data.action) {
      dispatchChatAction(data.action)
    }

    // Keep lastAction alive for follow-ups
    // DELETE_TRADE removed — it now arrives as type:'pending' (covered by that clause below)
    const keepAliveActions = ['ADD_TRADE', 'CLOSE_TRADE', 'DRAFT_JOURNAL', 'NEEDS_DISAMBIGUATION']
    if (
      data.type === 'pending' ||
      data.type === 'slotfill' ||
      (data.type === 'action' && keepAliveActions.includes(data.action))
    ) {
      // slotfill carries knownArgs (symbol etc.); pending/action carry result. Either feeds the
      // strengthened lastActionContext so a TYPED answer (not the form) still binds to this action.
      setLastAction({ action: data.action, result: data.knownArgs || data.result })
    } else {
      setLastAction(null)
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'assistant',
        content: data.reply,
        time: new Date(),
        actionType: data.type === 'action' ? data.action : (data.type === 'pending' ? '__PENDING__' : null),
        actionResult: (data.type === 'action' || data.type === 'pending') ? data.result : null,
        pending: data.type === 'pending'
          ? { token: data.result?.token, action: data.action, preview: data.result?.preview }
          : null,
        // multi-turn: a structured slot-fill request renders SlotFillCard (no LLM on the answer)
        slotfill: data.type === 'slotfill'
          ? {
              action: data.action,
              knownArgs: data.knownArgs || {},
              missing: data.missing || [],
              reply: data.reply,
              suggestion: data.suggestion || null,
            }
          : null,
      },
    ])
  }

  // ── Structured action dispatch — bypasses the LLM intent-parse ───────────────
  // Used by ConfirmCard [Confirm]/[Cancel] today; phase-2 Y action-card buttons
  // reuse this same seam. Posts { action, ...payload } to the same agent endpoint.
  const handleAction = async (payload) => {
    setLoading(true)
    try {
      const stored = localStorage.getItem('auth_token')
      const res = await fetch(`${BASE_URL}/api/chat/agent`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(stored ? { Authorization: `Bearer ${stored}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      handleAgentResponse(data)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          time: new Date(),
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // ── Mark a confirm card as done (disables buttons to prevent double-fire) ────
  const markConfirmDone = (id) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, confirmDone: true } : m)))

  // Handles sending any message (from input or quick actions)
  const handleSend = async (messageText) => {
    const text = messageText || input.trim()
    if (!text || loading) return
    if (!user) {
      navigate('/login')
      return
    }

    setActiveForm(null)
    const userMessage = { id: Date.now(), role: 'user', content: text, time: new Date() }
    // P4-003: cap in-memory history at 100 messages to prevent memory bloat
    setMessages((prev) => [...prev, userMessage].slice(-100))
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto' // reset auto-grow
    // Sending implies the user wants to follow the reply — re-enable auto-scroll
    atBottomRef.current = true
    setAtBottom(true)
    setLoading(true)

    try {
      abortCtrlRef.current?.abort()
      abortCtrlRef.current = null
      const ctrl = new AbortController()
      abortCtrlRef.current = ctrl

      // Cookie preferred; Bearer fallback for Safari ITP (mobile blocks the cross-site
      // cookie — mirrors the axios interceptor in api/index.js). Temporary until custom domain.
      const stored = localStorage.getItem('auth_token')
      const response = await fetch(`${BASE_URL}/api/chat/agent`, {
        method: 'POST',
        signal: ctrl.signal,
        credentials: 'include', // send httpOnly cookie when the browser allows it
        headers: {
          'Content-Type': 'application/json',
          ...(stored ? { Authorization: `Bearer ${stored}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          // Exclude streaming/incomplete messages from history — they have empty content
          history: messages
            .filter((m) => !m.streaming && m.content)
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
          lastAction: lastActionRef.current,
          lang,
        }),
      })

      const contentType = response.headers.get('content-type') || ''

      // ── Streaming chat response ──────────────────────────────────────────────
      if (contentType.includes('text/event-stream')) {
        const msgId = Date.now()
        // Add a placeholder bubble immediately
        setMessages((prev) => [
          ...prev,
          { id: msgId, role: 'assistant', content: '', time: new Date(), streaming: true },
        ])
        setLoading(false)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let fullText = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done || ctrl.signal.aborted) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() // keep incomplete line in buffer
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              try {
                const event = JSON.parse(line.slice(6))
                if (event.type === 'chunk' && event.text) {
                  fullText += event.text
                  setMessages((prev) =>
                    prev.map((m) => (m.id === msgId ? { ...m, content: fullText } : m))
                  )
                } else if (event.type === 'done') {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === msgId ? { ...m, streaming: false } : m))
                  )
                  // Check discipline nudge in full text
                  const disciplineMatch = fullText.match(/discipline.*?(\d+)%/i)
                  if (disciplineMatch) {
                    const score = parseInt(disciplineMatch[1])
                    if (score < 70) setDisciplineNudge(score)
                  }
                  // Do NOT clear lastAction after streaming — user may follow up
                }
              } catch {
                /* skip malformed SSE lines */
              }
            }
          }
        } catch (streamErr) {
          console.error('SSE stream read error:', streamErr)
          try {
            reader.cancel()
          } catch {
            /* ignore cancel errors */
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    streaming: false,
                    content: fullText || 'Stream interrupted. Please try again.',
                  }
                : m
            )
          )
        }
        inputRef.current?.focus()
        return
      }

      // ── JSON action / non-streaming response ─────────────────────────────────
      const data = await response.json()
      handleAgentResponse(data)
    } catch (err) {
      if (err?.name === 'AbortError') return // intentional cancel — no error message
      console.error('AIChat handleSend error:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: err?.message?.includes('Failed to fetch')
            ? 'Cannot reach the server — check your connection and try again.'
            : 'Something went wrong. Please try again.',
          time: new Date(),
          isError: true,
          retryText: text, // lets the error bubble offer one-click resend
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // Save journal draft — routes through ADD_JOURNAL agent action, saves as notes on the trade_log action row
  const handleJournalSave = async (symbol, content) => {
    setJournalDraft(null)
    setLastAction(null)
    await handleSend(`Add journal note for ${symbol}: ${content}`)
  }

  // Stop an in-flight response (SSE stream or pending request).
  // The stream's AbortError path keeps whatever text already arrived.
  const handleStop = () => {
    abortCtrlRef.current?.abort()
    setLoading(false)
  }

  // Brief chip — send brief request immediately
  const handleBriefChip = () => {
    setActiveForm(null)
    handleSend('Morning brief — show my trading summary for today')
  }

  // ── Slash-command palette ────────────────────────────────────────────────
  // Open while the input is a single "/word" token; filter as the user types.
  const slashQuery =
    input.startsWith('/') && !/[\s\n]/.test(input) ? input.slice(1).toLowerCase() : null
  const slashMatches =
    slashQuery !== null ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery)) : []
  const slashOpen = slashMatches.length > 0
  const [slashIdx, setSlashIdx] = useState(0)
  useEffect(() => {
    setSlashIdx(0)
  }, [slashQuery])

  const runSlash = (c) => {
    if (c.type === 'insert') {
      setInput(c.arg)
      inputRef.current?.focus()
      return
    }
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    if (c.type === 'form') setActiveForm(c.arg)
    else if (c.type === 'send') handleSend(c.arg)
    else if (c.type === 'new') handleNewChat()
  }

  const handleKeyDown = (e) => {
    // Palette navigation takes priority while open
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIdx((i) => (i + 1) % slashMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIdx((i) => (i - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        runSlash(slashMatches[slashIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setInput('')
        return
      }
    }
    // ↑ on an empty input recalls the last sent message for editing
    if (e.key === 'ArrowUp' && !input.trim()) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      if (lastUser) {
        e.preventDefault()
        setInput(lastUser.content)
        requestAnimationFrame(autoGrowInput)
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Grow the textarea with content (Shift+Enter newlines), capped at ~4 lines
  const autoGrowInput = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }

  const formatTime = (date) =>
    date ? new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''

  // ── Session management ───────────────────────────────────────────────────────
  const handleOpenHistory = async () => {
    const opening = !showHistory
    setShowHistory(opening)
    if (opening) {
      setSessionsLoading(true)
      try {
        const res = await listChatSessions()
        setSessions(res.data || [])
      } catch {
        /* fail silently */
      } finally {
        setSessionsLoading(false)
      }
    }
  }

  const handleLoadSession = async (id) => {
    try {
      const res = await loadChatSession(id)
      const loaded = res.data?.messages || []
      setMessages(
        loaded.map((m) => ({
          ...m,
          id: Math.random(),
          time: m.time ? new Date(m.time) : new Date(),
        }))
      )
      setCurrentSessionId(id)
      setLastAction(null)
      setJournalDraft(null)
      setDisciplineNudge(null)
      setActiveForm(null)
      setShowHistory(false)
      sessionStorage.removeItem('chat_lastAction')
    } catch {
      /* fail silently */
    }
  }

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteChatSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (currentSessionId === id) {
        setCurrentSessionId(null)
        setMessages([])
        sessionStorage.removeItem('chat_messages')
      }
    } catch {
      /* fail silently */
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setCurrentSessionId(null)
    setLastAction(null)
    setJournalDraft(null)
    setDisciplineNudge(null)
    setActiveForm(null)
    setShowHistory(false)
    sessionStorage.removeItem('chat_messages')
    sessionStorage.removeItem('chat_lastAction')
  }

  // Disambiguation pick — user clicked an entry card
  const handleDisambiguationPick = (entry, result) => {
    const { original_action, exit_price, sl, tp, exit_quantity } = result
    // Build a natural language message so the AI routes it as SELECT_TRADE
    // The backend uses the NEEDS_DISAMBIGUATION context (still in lastAction) to match entry by trade_id
    let msg = `Select trade ${entry.id} for ${original_action}`
    if (original_action === 'CLOSE_TRADE') msg += ` at exit price ${exit_price}`
    if (original_action === 'UPDATE_SL_TP')
      msg += `${sl != null ? ` sl ${sl}` : ''}${tp != null ? ` tp ${tp}` : ''}`
    if (original_action === 'PARTIAL_CLOSE') msg += ` exit ${exit_quantity} at ${exit_price}`
    // lastAction still holds { action: 'NEEDS_DISAMBIGUATION', result: { entries, original_action, ... } }
    // Backend uses this to build the disambiguation prompt context — no change needed
    handleSend(msg)
  }

  // Render a single message bubble + any special cards attached
  const renderMessage = (msg, i, isLast = false) => {
    // Follow-up chips — only under the most recent completed assistant message
    const followUps =
      isLast &&
      msg.role === 'assistant' &&
      !msg.streaming &&
      !msg.isError &&
      msg.actionType &&
      FOLLOW_UPS[msg.actionType]
        ? (FOLLOW_UPS[msg.actionType](msg.actionResult || {}) || []).filter(Boolean)
        : []
    const showBrokerFee = msg.actionType === 'CALC_BROKER_FEE' && msg.actionResult?.fee
    const showMorningBrief = msg.actionType === 'MORNING_BRIEF' && msg.actionResult?.brief
    const showDisambiguation =
      msg.actionType === 'NEEDS_DISAMBIGUATION' && msg.actionResult?.entries?.length
    const showShowTrades = msg.actionType === 'SHOW_TRADES' && msg.actionResult?.trades
    const showShowGoals = msg.actionType === 'SHOW_GOALS' && msg.actionResult?.goals
    const showShowJournal = msg.actionType === 'SHOW_JOURNAL' && msg.actionResult?.entries
    const showTradePlan = msg.actionType === 'TRADE_PLAN' && msg.actionResult?.plan
    const showRiskSummary = msg.actionType === 'SHOW_RISK_SUMMARY' && msg.actionResult?.positions
    const showWeekly = msg.actionType === 'WEEKLY_SUMMARY' && msg.actionResult
    // TOGGLE_THEME: handled inline, no card needed
    // DRAFT_JOURNAL: shown as interactive JournalDraftCard (not inline here, added to messages area separately)
    // __PENDING__: shown as ConfirmCard below (DELETE_TRADE and other money actions via confirm-gate)
    const showConfirm = msg.pending?.token
    // multi-turn: inline slot-fill form, dismissed once filled/cancelled (reuses confirmDone)
    const showSlotfill = msg.slotfill && !msg.confirmDone
    const showStandardCard =
      msg.actionType &&
      msg.actionResult &&
      !showBrokerFee &&
      !showMorningBrief &&
      !showDisambiguation &&
      !showShowTrades &&
      !showShowGoals &&
      !showShowJournal &&
      !showTradePlan &&
      !showRiskSummary &&
      !showWeekly &&
      !showConfirm &&
      !['DRAFT_JOURNAL', 'TOGGLE_THEME', '__PENDING__'].includes(msg.actionType)

    return (
      <div
        key={msg.id ?? i}
        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5 animate-fade-up`}
        style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
      >
        {msg.role === 'assistant' && (
          <div className="flex-shrink-0 mt-0.5">
            <TradeoLogo size={20} />
          </div>
        )}
        <div
          className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          {/* Disambiguation picker */}
          {showDisambiguation && (
            <DisambiguationCard result={msg.actionResult} onPick={handleDisambiguationPick} />
          )}
          {/* Confirm gate card — gated money actions awaiting [Confirm]/[Cancel] */}
          {showConfirm && (
            <ConfirmCard
              pending={msg.pending}
              done={msg.confirmDone}
              onConfirm={(token) => {
                markConfirmDone(msg.id)
                handleAction({ action: 'CONFIRM_ACTION', token })
              }}
              onCancel={(token) => {
                markConfirmDone(msg.id)
                handleAction({ action: 'CANCEL_ACTION', token })
              }}
            />
          )}
          {/* Slot-fill card — missing money-action field; filled answer posts as a structured */}
          {/* gated action (no LLM), flowing into the same confirm-gate as ConfirmCard. */}
          {showSlotfill && (
            <SlotFillCard
              slot={msg.slotfill}
              done={msg.confirmDone}
              onSubmit={(payload) => {
                markConfirmDone(msg.id)
                handleAction(payload)
              }}
              onCancel={() => markConfirmDone(msg.id)}
            />
          )}
          {/* Standard action card */}
          {showStandardCard && <ActionCard type={msg.actionType} result={msg.actionResult} />}
          {/* Broker fee breakdown card */}
          {showBrokerFee && <BrokerFeeCard fee={msg.actionResult.fee} />}
          {/* Morning brief card */}
          {showMorningBrief && <MorningBriefCard brief={msg.actionResult.brief} />}
          {/* Read-side query cards */}
          {showShowTrades && <ShowTradesCard result={msg.actionResult} />}
          {showShowGoals && <ShowGoalsCard result={msg.actionResult} />}
          {showShowJournal && <ShowJournalCard result={msg.actionResult} />}
          {/* Analysis cards */}
          {showTradePlan && <TradePlanCard plan={msg.actionResult.plan} />}
          {showRiskSummary && <RiskSummaryCard result={msg.actionResult} />}
          {showWeekly && <WeeklySummaryCard result={msg.actionResult} />}
          {/* Text bubble */}
          <div
            className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-green-500 text-white rounded-tr-sm'
                : msg.isError
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-200 dark:border-red-800 rounded-tl-sm'
                  : msg.isCoach
                    ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
                    : isFloat
                      ? 'bg-white/55 dark:bg-white/8 border border-white/50 dark:border-white/12 text-gray-800 dark:text-gray-100 rounded-tl-sm shadow-sm backdrop-blur-sm'
                      : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
            }`}
          >
            {msg.role === 'assistant' && !msg.isError ? (
              <>
                <MarkdownLite text={msg.content} />
                {msg.streaming && (
                  <span className="inline-block w-0.5 h-3 bg-green-500 ml-0.5 animate-pulse align-middle" />
                )}
              </>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
          {/* Retry — resend the message that failed */}
          {msg.isError && msg.retryText && (
            <button
              onClick={() => handleSend(msg.retryText)}
              className="mt-1 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <svg
                className="w-2.5 h-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h5M20 20v-5h-5M5.5 9A7.5 7.5 0 0119 7.5M18.5 15A7.5 7.5 0 015 16.5"
                />
              </svg>
              Retry
            </button>
          )}
          {/* Suggested next steps */}
          {followUps.length > 0 && !busy && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {followUps.map((f, j) => (
                <button
                  key={j}
                  onClick={() => handleSend(f.text)}
                  className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors animate-fade-up"
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5 px-1">
            <span className="text-gray-400 text-[10px]">{formatTime(msg.time)}</span>
            {msg.role === 'assistant' && msg.content && !msg.streaming && (
              <button
                onClick={() => handleCopy(msg)}
                className={`transition-colors ${copiedId === msg.id ? 'text-green-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}
                title={copiedId === msg.id ? 'Copied!' : 'Copy'}
              >
                {copiedId === msg.id ? (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        {msg.role === 'user' && (
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const isFloat = !isFullPage
  const isStreaming = messages.some((m) => m.streaming)
  const busy = loading || isStreaming

  return (
    <div
      className={`flex flex-col h-full ${isFloat ? 'bg-transparent' : 'bg-white dark:bg-gray-950'}`}
    >
      {/* ── Header ── (floating: doubles as the drag handle) */}
      <div
        onMouseDown={isFloat ? onDragStart : undefined}
        onTouchStart={isFloat ? onDragStart : undefined}
        className={`flex items-center justify-between px-3 py-2.5 shrink-0 border-b ${
          isFloat
            ? 'bg-white/20 dark:bg-black/20 border-white/20 dark:border-white/8 cursor-move select-none'
            : 'bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <TradeoLogo size={22} />
          <div>
            <p className="text-xs font-bold tracking-tight text-gray-900 dark:text-white leading-none">
              Tradeo AI
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-gray-400">Agent · NEPSE</span>
            </div>
          </div>
        </div>
        {/* stopPropagation so clicking an action doesn't begin a header drag */}
        <div
          className="flex items-center gap-1"
          onMouseDown={isFloat ? (e) => e.stopPropagation() : undefined}
          onTouchStart={isFloat ? (e) => e.stopPropagation() : undefined}
        >
          {/* History / sessions button */}
          {user && (
            <button
              onClick={handleOpenHistory}
              className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors ${showHistory ? 'bg-black/5 dark:bg-white/5' : ''}`}
              title="Chat history"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-[10px] px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="New chat"
            >
              + New
            </button>
          )}
          {!isFullPage && (
            <button
              onClick={() => navigate('/chat')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
              title="Open full page"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          )}
          {/* Close — floating only (the full page has its own nav) */}
          {isFloat && onClose && (
            <button
              onClick={onClose}
              aria-label="Close chat"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
              title="Close chat"
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
          )}
        </div>
      </div>

      {/* ── Session history panel ── */}
      {showHistory && (
        <div
          className={`border-b shrink-0 max-h-48 overflow-y-auto ${
            isFloat
              ? 'bg-white/20 dark:bg-black/20 border-white/15 dark:border-white/6'
              : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
          }`}
        >
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Recent Chats
            </p>
            {sessionsLoading && <p className="text-[10px] text-gray-400 py-1">Loading...</p>}
            {!sessionsLoading && sessions.length === 0 && (
              <p className="text-[10px] text-gray-400 py-1">
                No saved sessions yet. Start chatting!
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleLoadSession(s.id)}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer mb-0.5 group transition-colors ${
                  s.id === currentSessionId
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200 truncate">
                    {s.title}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all shrink-0 p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick action chips: REMOVED — these actions move to `/` slash commands
            (next session). The QuickForm machinery (setActiveForm/'buy'/'sell'/etc.)
            is intentionally kept below so the `/` handler can reuse it. ── */}

      {/* ── Messages area ── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 right-0 h-6 bg-gradient-to-b ${isFloat ? 'from-white/0' : 'from-white/80 dark:from-gray-950/80'} to-transparent z-10 pointer-events-none`}
        />
        <div
          className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t ${isFloat ? 'from-white/0' : 'from-white/80 dark:from-gray-950/80'} to-transparent z-10 pointer-events-none`}
        />
        {/* Scroll-to-bottom — appears when user has scrolled up */}
        {!atBottom && messages.length > 0 && (
          <button
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="absolute bottom-3 right-3 z-20 w-7 h-7 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-green-500 dark:hover:text-green-400 transition-colors animate-fade-up"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
        <div
          ref={scrollBoxRef}
          onScroll={handleChatScroll}
          className="h-full overflow-y-auto no-scrollbar px-3 py-3 space-y-3"
        >
          {/* Empty state */}
          {messages.length === 0 && !activeForm && (
            <div className="flex flex-col items-center pt-4 pb-2">
              <TradeoLogo size={42} />
              <p className="text-gray-900 dark:text-white text-sm font-semibold mt-3 mb-1 drop-shadow-sm">
                {t('chat.greeting')}
              </p>
              <p className="text-gray-500 dark:text-gray-300 text-[11px] text-center max-w-[200px] leading-relaxed mb-4">
                {t('chat.greetingSub')}
              </p>
              <p className="w-full text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                Try asking
              </p>
              <div className="w-full grid grid-cols-2 gap-1.5">
                {(suggestions.length > 0
                  ? suggestions
                      .slice(0, 8)
                      .map((s, i) => ({ icon: PRESET_PROMPTS[i]?.icon || '💬', text: s }))
                  : PRESET_PROMPTS
                ).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p.text)}
                    className={`flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-left transition-all group border ${
                      isFloat
                        ? 'bg-white/25 dark:bg-white/6 border-white/40 dark:border-white/10 hover:bg-white/45 dark:hover:bg-white/12 backdrop-blur-sm'
                        : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-gray-800 hover:border-blue-200 dark:hover:border-gray-700'
                    }`}
                  >
                    <span className="text-sm leading-none mt-0.5">{p.icon}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-gray-200 leading-snug">
                      {p.text}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
                Type{' '}
                <kbd className="px-1 py-px rounded border border-gray-200 dark:border-gray-700 font-sans text-[9px]">
                  /
                </kbd>{' '}
                for quick commands
              </p>
            </div>
          )}

          {/* Quick form in empty state */}
          {activeForm && messages.length === 0 && (
            <QuickForm
              type={activeForm}
              onSubmit={handleSend}
              onCancel={() => setActiveForm(null)}
            />
          )}

          {/* Messages */}
          {messages.map((msg, i) => renderMessage(msg, i, i === messages.length - 1))}

          {/* Quick form after messages */}
          {activeForm && messages.length > 0 && (
            <QuickForm
              type={activeForm}
              onSubmit={handleSend}
              onCancel={() => setActiveForm(null)}
            />
          )}

          {/* Journal draft card */}
          {journalDraft && (
            <JournalDraftCard
              draft={journalDraft}
              onSave={handleJournalSave}
              onDiscard={() => {
                setJournalDraft(null)
                setLastAction(null)
              }}
            />
          )}

          {/* Discipline nudge card */}
          {disciplineNudge !== null && (
            <DisciplineNudgeCard
              score={disciplineNudge}
              onDismiss={() => setDisciplineNudge(null)}
            />
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start gap-1.5 animate-fade-up">
              <div className="flex-shrink-0 mt-0.5">
                <TradeoLogo size={20} />
              </div>
              <div
                className={`px-3 py-2.5 rounded-2xl rounded-tl-sm shadow-sm ${
                  isFloat
                    ? 'bg-white/40 dark:bg-white/8 border border-white/40 dark:border-white/12 backdrop-blur-sm'
                    : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
                }`}
              >
                <div className="flex gap-1 items-center">
                  <div
                    className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce"
                    style={{ animationDelay: '200ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce"
                    style={{ animationDelay: '400ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div
        className={`px-3 py-2.5 shrink-0 border-t ${
          isFloat
            ? 'bg-white/15 dark:bg-black/15 border-white/20 dark:border-white/8'
            : 'bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800'
        }`}
      >
        {!user ? (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-green-400 transition-colors"
          >
            {t('chat.loginToChat')}
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Slash-command palette */}
            {slashOpen && (
              <div
                className={`rounded-xl border overflow-hidden max-h-56 overflow-y-auto ${
                  isFloat
                    ? 'bg-white/80 dark:bg-gray-900/90 border-white/50 dark:border-white/15 backdrop-blur-md'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-3 pt-2 pb-1">
                  Commands · ↑↓ + Enter
                </p>
                {slashMatches.map((c, i) => (
                  <button
                    key={c.cmd}
                    onMouseDown={(e) => e.preventDefault() /* keep textarea focus */}
                    onClick={() => runSlash(c)}
                    onMouseEnter={() => setSlashIdx(i)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                      i === slashIdx ? 'bg-green-50 dark:bg-green-900/20' : ''
                    }`}
                  >
                    <span className="text-sm w-5 text-center">{c.icon}</span>
                    <span
                      className={`text-[11px] font-semibold ${i === slashIdx ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      /{c.cmd}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate">{c.desc}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Undo chip — backend supports one-step UNDO; surface it after an
                undoable write action instead of requiring the user to know to type "undo" */}
            {!busy && ['ADD_TRADE', 'CLOSE_TRADE'].includes(lastAction?.action) && (
              <button
                onClick={() => handleSend('Undo my last action')}
                className="self-start flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors animate-fade-up"
              >
                <svg
                  className="w-2.5 h-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h10a5 5 0 015 5v1m-15-6l4-4m-4 4l4 4"
                  />
                </svg>
                Undo last action
              </button>
            )}
            {/* Voice status bar */}
            {voiceState === 'listening' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium flex-1">
                  Recording… {voiceSeconds}s
                </span>
                <span className="text-[10px] text-red-400 dark:text-red-500">
                  auto-sends after 4s silence
                </span>
              </div>
            )}
            {voiceState === 'processing' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  Transcribing with Whisper…
                </span>
              </div>
            )}
            {voiceState === 'error' && voiceError && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <span className="text-[10px] text-red-500">{voiceError}</span>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  autoGrowInput()
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  voiceState === 'listening'
                    ? 'Listening… speak in Nepali or English'
                    : voiceState === 'processing'
                      ? 'Transcribing…'
                      : t('chat.placeholder')
                }
                rows={1}
                className={`flex-1 border focus:border-green-400 dark:focus:border-green-500 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-3 py-2 text-xs focus:outline-none resize-none transition-colors ${
                  isFloat
                    ? 'bg-white/40 dark:bg-white/10 border-white/50 dark:border-white/15 backdrop-blur-sm'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}
              />

              {/* Mic button */}
              <button
                onClick={handleVoice}
                disabled={loading || voiceState === 'processing'}
                title={
                  voiceState === 'listening'
                    ? 'Stop recording (or wait 4s of silence)'
                    : voiceState === 'processing'
                      ? 'Transcribing…'
                      : 'Voice input — Nepali / English (Whisper AI)'
                }
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all border disabled:opacity-40 ${
                  voiceState === 'listening'
                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/40'
                    : voiceState === 'processing'
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-500'
                      : voiceState === 'error'
                        ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-500'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {voiceState === 'listening' ? (
                  // Animated waveform bars while recording
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <rect
                      x="1"
                      y="5"
                      width="2"
                      height="6"
                      rx="1"
                      className="animate-[bounce_0.6s_infinite]"
                    />
                    <rect
                      x="4.5"
                      y="3"
                      width="2"
                      height="10"
                      rx="1"
                      className="animate-[bounce_0.6s_0.1s_infinite]"
                    />
                    <rect
                      x="8"
                      y="1"
                      width="2"
                      height="14"
                      rx="1"
                      className="animate-[bounce_0.6s_0.2s_infinite]"
                    />
                    <rect
                      x="11.5"
                      y="3"
                      width="2"
                      height="10"
                      rx="1"
                      className="animate-[bounce_0.6s_0.1s_infinite]"
                    />
                  </svg>
                ) : voiceState === 'processing' ? (
                  // Spinner
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  // Microphone icon
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0v-4A2.5 2.5 0 0 0 8 1z" />
                    <path d="M4.5 7.5a.5.5 0 0 0-1 0A4.5 4.5 0 0 0 7.5 12v1.5H6a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H8.5V12a4.5 4.5 0 0 0 4-4.5.5.5 0 0 0-1 0 3.5 3.5 0 0 1-7 0z" />
                  </svg>
                )}
              </button>

              {/* Send / Stop button — swaps to stop while a reply is generating */}
              {busy ? (
                <button
                  onClick={handleStop}
                  title="Stop generating"
                  aria-label="Stop generating"
                  className="bg-gray-800 dark:bg-gray-200 hover:bg-gray-700 dark:hover:bg-white text-white dark:text-gray-900 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  title="Send (Enter)"
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-30 text-white w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIChat
