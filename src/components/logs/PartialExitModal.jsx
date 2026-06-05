// === PartialExitModal.jsx — partial exit modal: broker paste, exit qty/price, P&L preview, reflection fields ===
import { useState, useCallback } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { partialExitPosition } from '../../api'
import { fmt, today } from '../../utils/format'
import { EMOTIONAL_STATES, EXIT_REASONS, EMOTION_COLOR, EXIT_REASON_COLOR } from './tradeConstants'
import { clearPositionsCache } from '../../utils/globalCache'

const INPUT = 'w-full px-3 py-2 text-[12px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all'
const LABEL = 'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5'
// Parses broker SMS for exit price, qty, date
function parseBrokerMessage(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  const m = t.match(/(bought|sold)\s+([A-Z0-9]+)-?([\d.]+)@([\d.]+)\s+on\s+(\d{4}-\d{2}-\d{2})/i)
  if (!m) return null
  return {
    exit_quantity: String(parseFloat(m[3])),
    exit_price:    String(parseFloat(m[4])),
    date:          m[5],
  }
}

export default function PartialExitModal({ position, onClose, onSaved }) {
  const [form,        setForm]        = useState({ date: today(), exit_quantity: '', exit_price: '', exit_reason: '', emotional_state: '', post_trade_evaluation: '', lessons_notes: '', notes: '' })
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [brokerText,  setBrokerText]  = useState('')
  const [brokerParsed,setBrokerParsed]= useState(null)

  useEscapeKey(onClose)

  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (k, v) => setForm(f => ({ ...f, [k]: f[k] === v ? '' : v }))

  const wacc      = parseFloat(position.wacc) || 0
  const totalQty  = parseFloat(position.total_qty) || 0
  const direction = position.direction?.toUpperCase() === 'LONG' ? 'LONG' : 'SHORT'
  const exitNum   = parseFloat(form.exit_price) || 0
  const exitQty   = parseInt(form.exit_quantity, 10) || 0
  const remaining = totalQty - exitQty
  const estPnl    = exitNum > 0 && exitQty > 0
    ? (direction === 'LONG' ? (exitNum - wacc) * exitQty : (wacc - exitNum) * exitQty)
    : null

  const handleBrokerChange = (e) => {
    const val = e.target.value
    setBrokerText(val)
    setBrokerParsed(val.trim() ? parseBrokerMessage(val) : null)
  }

  const handleBrokerFill = () => {
    if (!brokerParsed) return
    setForm(f => ({
      ...f,
      exit_quantity: brokerParsed.exit_quantity,
      exit_price:    brokerParsed.exit_price,
      date:          brokerParsed.date,
    }))
    setBrokerParsed(null)
    setBrokerText('')
  }

  const handleSubmit = useCallback(async e => {
    e.preventDefault()
    setError(null)
    if (!form.exit_quantity) return setError('Exit quantity is required')
    if (!Number.isInteger(Number(form.exit_quantity)) || Number(form.exit_quantity) <= 0) return setError('Exit quantity must be a whole number')
    if (!form.exit_price)    return setError('Exit price is required')
    if (!form.date)          return setError('Date is required')
    if (exitQty >= totalQty) return setError('For a full close use "Close Position". Partial exit must leave some quantity.')

    setSaving(true)
    try {
      const res = await partialExitPosition(position.trade_id, {
        date:                  form.date,
        exit_quantity:         form.exit_quantity,
        exit_price:            form.exit_price,
        exit_reason:           form.exit_reason || undefined,
        emotional_state:       form.emotional_state || undefined,
        post_trade_evaluation: form.post_trade_evaluation || undefined,
        lessons_notes:         form.lessons_notes || undefined,
        notes:                 form.notes || undefined,
      })
      clearPositionsCache()
      onSaved(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save partial exit')
    } finally {
      setSaving(false)
    }
  }, [form, position, exitQty, totalQty, onSaved])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Partial Exit</h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
              {position.symbol} · {direction} · {totalQty} units @ Rs.{fmt(wacc)}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm">✕</button>
        </div>

        {/* Broker paste */}
        <div className="px-4 sm:px-6 pt-4">
          <div className={`rounded-xl border-2 border-dashed transition-all ${
            brokerParsed
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
          }`}>
            {brokerParsed ? (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[12px] text-gray-500 dark:text-gray-400">
                  {brokerParsed.exit_quantity} units @ Rs.{brokerParsed.exit_price} · {brokerParsed.date}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={handleBrokerFill}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors">
                    Fill form ↓
                  </button>
                  <button type="button" onClick={() => { setBrokerParsed(null); setBrokerText('') }}
                    className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
                </div>
              </div>
            ) : (
              <textarea
                value={brokerText}
                onChange={handleBrokerChange}
                placeholder="Paste broker message to auto-fill exit…"
                rows={2}
                className="w-full px-4 py-3 bg-transparent text-[11px] text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none"
              />
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-4" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>

          {/* ── REQUIRED ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" value={form.date} max={today()}
                onChange={e => set('date', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Exit Qty (units)</label>
              <input type="number" value={form.exit_quantity}
                onChange={e => set('exit_quantity', e.target.value)}
                placeholder={`max ${totalQty - 1}`} min="1" step="1" max={totalQty - 1}
                autoComplete="off" className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Exit Price (Rs.)</label>
              <input type="number" value={form.exit_price}
                onChange={e => set('exit_price', e.target.value)}
                placeholder="450.00" step="0.01" autoComplete="off" className={INPUT} />
            </div>
          </div>

          {/* P&L + remaining preview */}
          {(estPnl !== null || exitQty > 0) && (
            <div className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 space-y-1">
              {estPnl !== null && (
                <div className={`text-[13px] font-mono font-bold ${estPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {estPnl >= 0 ? '+' : ''}Rs.{fmt(estPnl)} estimated P&L
                </div>
              )}
              {exitQty > 0 && remaining >= 0 && (
                <div className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                  {remaining} units remaining
                </div>
              )}
            </div>
          )}

          {/* ── OPTIONAL REFLECTION ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-600">
              Reflection · optional
            </span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          </div>

          {/* Exit Reason */}
          <div>
            <label className={LABEL}>Why exiting here?</label>
            <div className="flex flex-wrap gap-1.5">
              {EXIT_REASONS.map(r => (
                <button key={r} type="button"
                  onClick={() => toggle('exit_reason', r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                    form.exit_reason === r
                      ? EXIT_REASON_COLOR[r]
                      : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Emotional State */}
          <div>
            <label className={LABEL}>How did you feel?</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONAL_STATES.map(s => (
                <button key={s} type="button"
                  onClick={() => toggle('emotional_state', s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                    form.emotional_state === s
                      ? EMOTION_COLOR[s]
                      : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL}>Reflection <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(optional)</span></label>
            <textarea
              value={form.post_trade_evaluation}
              onChange={e => set('post_trade_evaluation', e.target.value)}
              placeholder="Why exiting here? Did it follow the plan?"
              rows={2} className={INPUT + ' resize-none leading-relaxed'} />
          </div>

          <div>
            <label className={LABEL}>Lessons <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(optional)</span></label>
            <textarea
              value={form.lessons_notes}
              onChange={e => set('lessons_notes', e.target.value)}
              placeholder="What did this partial exit teach you?"
              rows={2} className={INPUT + ' resize-none leading-relaxed'} />
          </div>

          {error && (
            <p className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-[12px] font-bold disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Partial Exit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
