// === TradeModal.jsx — BUY/SELL modal, extracted from LeftPanel.jsx so SMC/Price ===
// === Action right panels can open the same trade flow pre-filled with a setup ===
import { useState } from 'react'
import { newPosition } from '../../api'
import { dispatchChatAction } from '../../utils/chatEvents'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { apiError } from '../../utils/format'
import { nptToday } from '../../utils/nepseCalendar'

// initialValues (optional): { entry_price, sl, tp } — pre-fills the form when a
// caller (e.g. an SMC/Price Action "Buy" button) already knows a detected setup's
// levels. Quantity/notes always start empty regardless of initialValues.
export default function TradeModal({ side, symbol, onClose, onSaved, initialValues = {} }) {
  const [form, setForm] = useState({
    entry_price: initialValues.entry_price ?? '',
    sl: initialValues.sl ?? '',
    tp: initialValues.tp ?? '',
    quantity: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEscapeKey(onClose)

  const isBuy = side === 'BUY'
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.entry_price || !form.quantity) {
      setErr('Entry price and quantity are required')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await newPosition({
        symbol,
        position: isBuy ? 'LONG' : 'SHORT',
        entry_price: parseFloat(form.entry_price),
        sl: form.sl ? parseFloat(form.sl) : null,
        tp: form.tp ? parseFloat(form.tp) : null,
        quantity: parseInt(form.quantity),
        notes: form.notes || null,
        entry_date: nptToday(),
      })
      dispatchChatAction('ADD_TRADE')
      onSaved()
      onClose()
    } catch (e) {
      setErr(apiError(e, 'Failed to save trade'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm z-10 overflow-hidden flex flex-col max-h-[90vh] animate-modal-in">
        <div
          className={`flex items-center justify-between px-5 py-4 shrink-0 ${isBuy ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-[11px] font-black">{isBuy ? '↑' : '↓'}</span>
            </div>
            <div>
              <p className="text-[13px] font-black text-white tracking-wide">
                {isBuy ? 'BUY' : 'SELL'}
              </p>
              <p className="text-[10px] text-white/70 font-medium" translate="no">
                {symbol}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors text-white text-[16px]"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {[
            ['Entry Price', 'entry_price', 'e.g. 1234'],
            ['Stop Loss (SL)', 'sl', 'e.g. 1100'],
            ['Target Price (TP)', 'tp', 'e.g. 1400'],
            ['Quantity', 'quantity', 'No. of shares'],
          ].map(([label, key, ph]) => (
            <div key={key}>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                {label}
              </label>
              <input
                type="number"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={ph}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all"
              />
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional notes..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all"
            />
          </div>

          {err && (
            <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-xl">
              {err}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3 rounded-xl text-[12px] font-bold text-white transition-all shadow-lg ${
              isBuy
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-200 dark:shadow-emerald-900/40 disabled:opacity-50'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-200 dark:shadow-red-900/40 disabled:opacity-50'
            }`}
          >
            {saving ? 'Saving...' : `Confirm ${side}`}
          </button>
        </div>
      </div>
    </div>
  )
}
