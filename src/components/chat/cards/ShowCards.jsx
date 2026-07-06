// === ShowCards.jsx — show-trades and show-goals cards ===
// Moved verbatim from AIChat.jsx (P2.1 split).
import { pnlClass } from '../../../utils/format'

// ── Show trades card ──────────────────────────────────────────────────────────
export function ShowTradesCard({ result }) {
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
                    className={`text-[10px] font-semibold ${pnlClass(pnl, 'text-green-500', 'text-red-400')}`}
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
export function ShowGoalsCard({ result }) {
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
