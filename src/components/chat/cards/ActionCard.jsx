// === ActionCard.jsx — chat action + confirm cards ===
// Moved verbatim from AIChat.jsx (P2.1 split). ACTION_META is module-private.

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
export function ActionCard({ type, result }) {
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
export function ConfirmCard({ pending, onConfirm, onCancel, done }) {
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
