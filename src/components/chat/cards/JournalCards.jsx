// === JournalCards.jsx — journal draft + show-journal cards ===
// Moved verbatim from AIChat.jsx (P2.1 split). Two non-adjacent source ranges.
import { useState } from 'react'
import { pnlClass } from '../../../utils/format'

// ── Journal draft card with edit + save + discard ────────────────────────────
export function JournalDraftCard({ draft, onSave, onDiscard }) {
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
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pnlClass(draft.pnl, 'bg-green-100 dark:bg-green-900/40 text-green-600', 'bg-red-100 dark:bg-red-900/40 text-red-500')}`}
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

// ── Show journal card ──────────────────────────────────────────────────────────
export function ShowJournalCard({ result }) {
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
