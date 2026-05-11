import { fmt } from '../../utils/format'

const ACTION_COLORS = {
  'New Position':   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Add Position':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Partial Exit':   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Close Position': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'Reversal':       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

const EMOTIONAL_PILL = {
  Confident: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
  Calm:      'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
  Anxious:   'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400',
  Fearful:   'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400',
  Greedy:    'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400',
  FOMO:      'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400',
  Neutral:   'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
}

const MARKET_PILL = {
  Bullish:  'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
  Bearish:  'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400',
  Sideways: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400',
  Volatile: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400',
  'Low Vol':'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
}

const isBuyAction = t => t.action_type === 'New Position' || t.action_type === 'Add Position'

export default function ActionHistory({ actions, onEdit, onDelete }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        No actions yet.
      </div>
    )
  }

  return (
    <div className="relative pl-6 pr-4 py-3">
      {/* vertical timeline line */}
      <span className="absolute left-6 top-3 bottom-3 w-px bg-gray-200 dark:bg-gray-700" />

      {actions.map((action, i) => {
        const isBuy = isBuyAction(action)

        return (
          <div key={action.id} className="relative mb-4 last:mb-0">
            {/* dot */}
            <span className="absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 bg-gray-400 dark:bg-gray-500" />

            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-100 dark:border-gray-700/50 p-3">
              {/* header row */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[action.action_type] || 'bg-gray-100 text-gray-600'}`}>
                    {action.action_type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{action.date}</span>
                  {action.setup_type && (
                    <span className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                      {action.setup_type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(action)}
                      className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(action)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* trade numbers */}
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {isBuy ? (
                  <>
                    Bought <span className="font-mono font-semibold">{parseInt(action.quantity)} kittā</span>
                    {' '}@ <span className="font-mono font-semibold">Rs.{fmt(action.entry_price)}</span>
                    {action.after_qty != null && (
                      <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">
                        → position: {parseFloat(action.after_qty)} kittā
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Sold <span className="font-mono font-semibold">{parseInt(action.quantity)} kittā</span>
                    {' '}@ <span className="font-mono font-semibold">Rs.{fmt(action.exit_price)}</span>
                    {action.realized_pnl != null && (
                      <span className={`ml-2 font-mono font-semibold ${parseFloat(action.realized_pnl) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {parseFloat(action.realized_pnl) >= 0 ? '+' : ''}Rs.{fmt(action.realized_pnl)}
                      </span>
                    )}
                    {action.after_qty != null && (
                      <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">
                        → remaining: {parseFloat(action.after_qty)} kittā
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* SL / TP */}
              {(action.sl || action.tp) && (
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {action.sl && <span>SL <span className="font-mono text-red-500">Rs.{fmt(action.sl)}</span></span>}
                  {action.tp && <span>TP <span className="font-mono text-emerald-500">Rs.{fmt(action.tp)}</span></span>}
                </div>
              )}

              {/* journal fields */}
              {(action.market_condition || action.emotional_state) && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {action.market_condition && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${MARKET_PILL[action.market_condition] || 'bg-gray-100 text-gray-500'}`}>
                      {action.market_condition}
                    </span>
                  )}
                  {action.emotional_state && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${EMOTIONAL_PILL[action.emotional_state] || 'bg-gray-100 text-gray-500'}`}>
                      {action.emotional_state}
                    </span>
                  )}
                </div>
              )}

              {action.why_taking_trade && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
                  <span className="text-gray-400 dark:text-gray-500">Thesis: </span>{action.why_taking_trade}
                </p>
              )}
              {action.thesis_notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 italic">{action.thesis_notes}</p>
              )}
              {action.post_trade_evaluation && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
                  <span className="text-gray-400 dark:text-gray-500">Reflection: </span>{action.post_trade_evaluation}
                </p>
              )}
              {action.lessons_notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  <span className="text-gray-400 dark:text-gray-500">Lessons: </span>{action.lessons_notes}
                </p>
              )}
              {action.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{action.notes}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
