// === SlotFillCard.jsx — multi-turn slot-fill + disambiguation cards ===
// Moved verbatim from AIChat.jsx (P2.1 split).
import { useState } from 'react'
import { today } from '../../../utils/format'

const todayStr = today

// ── Slot-fill card — an action awaiting fields (multi-turn binding) ──────────
// Renders required inputs (`missing`, gate Continue), optional inputs
// (`optionalFields`, never gate) and an optional date (`dateField` — trade date
// for money actions, deadline for goals; `default`/`min`/`max` come from the
// server, with today as the trade-date fallback).
export function SlotFillCard({ slot, onSubmit, onCancel, done }) {
  const dateKey = slot?.dateField?.field || 'date'
  const [vals, setVals] = useState(() =>
    slot?.dateField ? { [dateKey]: slot.dateField.default || todayStr() } : {}
  )
  if (
    !slot?.missing?.length &&
    !slot?.suggestion &&
    !slot?.optionalFields?.length &&
    !slot?.dateField
  )
    return null

  const set = (f, v) => setVals((p) => ({ ...p, [f]: v }))
  const ready = (slot.missing || []).every((f) => {
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

  // Money symbol boxes uppercase as you type; free-text fields (goal title/details) don't.
  const textInput = (f) => (
    <input
      key={f.field}
      type={f.kind === 'text' ? 'text' : 'number'}
      placeholder={f.label}
      value={vals[f.field] ?? ''}
      disabled={done}
      maxLength={f.field === 'description' ? 500 : f.field === 'title' ? 200 : undefined}
      onChange={(e) =>
        set(f.field, f.kind === 'text' && !f.free ? e.target.value.toUpperCase() : e.target.value)
      }
      className="w-full mb-1.5 px-2 py-1.5 rounded-lg text-[12px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100"
    />
  )

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
      {(slot.missing || []).map(textInput)}
      {(slot.optionalFields || []).map(textInput)}
      {slot.dateField && (
        <label className="block mb-1.5">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {slot.dateField.label}
            {dateKey === 'date' ? ' (defaults to today)' : ''}
          </span>
          <input
            type="date"
            value={vals[dateKey] ?? ''}
            disabled={done}
            min={slot.dateField.min || undefined}
            max={slot.dateField.max || (dateKey === 'date' ? todayStr() : undefined)}
            onChange={(e) => set(dateKey, e.target.value)}
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
export function DisambiguationCard({ result, onPick }) {
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
