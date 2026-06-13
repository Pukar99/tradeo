// === ActionHistory.jsx — timeline of trade actions (buy/add/partial/close/reversal cards with action menu) ===

import { useContextMenu } from '../ContextMenu'
import { fmt } from '../../utils/format'

const ACTION_CFG = {
  'New Position': {
    label: 'Buy',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    accent: 'border-l-emerald-400',
  },
  'Add Position': {
    label: 'Add',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    dot: 'bg-blue-500',
    accent: 'border-l-blue-400',
  },
  'Partial Exit': {
    label: 'Partial',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    dot: 'bg-amber-500',
    accent: 'border-l-amber-400',
  },
  'Close Position': {
    label: 'Close',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
    dot: 'bg-gray-400',
    accent: 'border-l-gray-400',
  },
  Reversal: {
    label: 'Rev',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    dot: 'bg-purple-500',
    accent: 'border-l-purple-400',
  },
}

// Read-only badge colors (lighter than the selectable pill maps in tradeConstants)
const EMOTION_CFG = {
  Confident: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10',
  Calm: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10',
  Anxious: 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-500/10',
  Fearful: 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/10',
  Greedy: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/10',
  FOMO: 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/10',
  Neutral: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/10',
}

const MARKET_CFG = {
  Bullish: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10',
  Bearish: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/10',
  Sideways: 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-500/10',
  Volatile: 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/10',
  'Low Vol': 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/10',
}

const EXIT_REASON_CFG = {
  'Target Hit': 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10',
  'SL Hit': 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/10',
  'Manual Exit': 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10',
  'Reversal Signal': 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/10',
  'Time Stop': 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-500/10',
}

const isBuy = (t) => t.action_type === 'New Position' || t.action_type === 'Add Position'

function ActionCard({ action, onEdit, onDelete, isLast }) {
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const cfg = ACTION_CFG[action.action_type] || ACTION_CFG['Close Position']
  const buy = isBuy(action)
  const price = buy ? parseFloat(action.entry_price) : parseFloat(action.exit_price)
  const qty = parseInt(action.quantity) || 0
  const pnl = parseFloat(action.realized_pnl)
  const hasPnl = !buy && !isNaN(pnl)

  const menuItems = [
    onEdit && { label: 'Edit Action', icon: '✏️', action: () => onEdit(action) },
    onDelete && {
      label: 'Delete Action',
      icon: '🗑️',
      danger: true,
      action: () => onDelete(action),
    },
  ].filter(Boolean)

  return (
    <div className="flex gap-3">
      <ContextMenuPortal />

      {/* timeline spine */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-2.5 h-2.5 rounded-full mt-3.5 shrink-0 ring-2 ring-white dark:ring-gray-900 ${cfg.dot}`}
        />
        {!isLast && <div className="w-px flex-1 bg-gray-100 dark:bg-gray-800 mt-1" />}
      </div>

      {/* action card */}
      <div
        className={`flex-1 mb-3 rounded-xl border-l-2 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/40 p-3 cursor-context-menu ${cfg.accent}`}
        onContextMenu={onContextMenu(menuItems)}
      >
        {/* header row */}
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            {action.date}
          </span>
          {action.setup_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              {action.setup_type}
            </span>
          )}
          {/* action menu — visible so edit/delete work without right-click (touch) */}
          {menuItems.length > 0 && (
            <button
              onClick={onContextMenu(menuItems)}
              aria-label="Action options"
              className="ml-auto w-5 h-5 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-[13px] leading-none"
            >
              ⋯
            </button>
          )}
        </div>

        {/* main numbers */}
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <span className="text-[13px] font-bold font-mono text-gray-900 dark:text-gray-100">
            {qty}{' '}
            <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">units</span>
          </span>
          <span className="text-[13px] font-bold font-mono text-gray-900 dark:text-gray-100">
            @ Rs.{fmt(price)}
          </span>
          {action.after_qty != null && (
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-500">
              → {parseFloat(action.after_qty)} remaining
            </span>
          )}
          {hasPnl && (
            <span
              className={`text-[13px] font-bold font-mono ml-auto ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {pnl >= 0 ? '+' : ''}Rs.{fmt(pnl)}
            </span>
          )}
        </div>

        {/* SL / TP */}
        {(action.sl || action.tp) && (
          <div className="flex gap-3 mb-2">
            {action.sl && (
              <span className="text-[10px] font-mono text-red-600 dark:text-red-400">
                SL Rs.{fmt(action.sl)}
              </span>
            )}
            {action.tp && (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                TP Rs.{fmt(action.tp)}
              </span>
            )}
          </div>
        )}

        {/* pills row */}
        {(action.market_condition || action.emotional_state || action.exit_reason) && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {action.exit_reason && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${EXIT_REASON_CFG[action.exit_reason] || 'text-gray-600 bg-gray-100'}`}
              >
                {action.exit_reason}
              </span>
            )}
            {action.market_condition && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${MARKET_CFG[action.market_condition] || 'text-gray-600 bg-gray-100'}`}
              >
                {action.market_condition}
              </span>
            )}
            {action.emotional_state && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${EMOTION_CFG[action.emotional_state] || 'text-gray-600 bg-gray-100'}`}
              >
                {action.emotional_state}
              </span>
            )}
          </div>
        )}

        {/* journal text fields */}
        {action.why_taking_trade && (
          <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1 leading-relaxed">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1.5">
              Thesis
            </span>
            {action.why_taking_trade}
          </p>
        )}
        {action.thesis_notes && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 italic leading-relaxed">
            {action.thesis_notes}
          </p>
        )}
        {action.post_trade_evaluation && (
          <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1 leading-relaxed">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1.5">
              Reflection
            </span>
            {action.post_trade_evaluation}
          </p>
        )}
        {action.lessons_notes && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic leading-relaxed">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1.5">
              Lessons
            </span>
            {action.lessons_notes}
          </p>
        )}
        {action.notes && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            {action.notes}
          </p>
        )}
      </div>
    </div>
  )
}

export default function ActionHistory({ actions, onEdit, onDelete }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-xs text-gray-400 dark:text-gray-600">
        No actions yet.
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-0">
      {actions.map((action, i) => (
        <ActionCard
          key={action.id}
          action={action}
          onEdit={onEdit}
          onDelete={onDelete}
          isLast={i === actions.length - 1}
        />
      ))}
    </div>
  )
}
