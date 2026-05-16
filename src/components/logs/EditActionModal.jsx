import { useState, useCallback } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { updateTradeAction } from '../../api'
import { fmt } from '../../utils/format'

const MARKET_CONDITIONS  = ['Bullish', 'Bearish', 'Sideways', 'Volatile', 'Low Vol']
const EMOTIONAL_STATES   = ['Confident', 'Calm', 'Anxious', 'Fearful', 'Greedy', 'FOMO', 'Neutral']
const EXIT_REASONS       = ['Target Hit', 'SL Hit', 'Manual Exit', 'Reversal Signal', 'Time Stop']

const INPUT = 'w-full px-3 py-2 text-[12px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all'
const LABEL = 'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5'

const isBuyAction = type => type === 'New Position' || type === 'Add Position'

export default function EditActionModal({ action, onClose, onSaved }) {
  const isBuy = isBuyAction(action.action_type)

  const [form, setForm] = useState({
    date:                  action.date || '',
    quantity:              String(action.quantity || ''),
    entry_price:           String(action.entry_price || ''),
    exit_price:            String(action.exit_price || ''),
    exit_reason:           action.exit_reason || '',
    sl:                    String(action.sl || ''),
    tp:                    String(action.tp || ''),
    setup_type:            action.setup_type || '',
    why_taking_trade:      action.why_taking_trade || '',
    market_condition:      action.market_condition || '',
    emotional_state:       action.emotional_state || '',
    post_trade_evaluation: action.post_trade_evaluation || '',
    lessons_notes:         action.lessons_notes || '',
    notes:                 action.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  useEscapeKey(onClose)

  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (k, v) => setForm(f => ({ ...f, [k]: f[k] === v ? '' : v }))
  const today  = () => new Date().toISOString().split('T')[0]

  const handleSubmit = useCallback(async e => {
    e.preventDefault()
    setError(null)
    if (!form.date)     return setError('Date is required')
    if (!form.quantity) return setError('Quantity is required')
    if (isBuy && !form.entry_price) return setError('Entry price is required')
    if (!isBuy && !form.exit_price) return setError('Exit price is required')

    setSaving(true)
    try {
      const payload = {
        date:                  form.date,
        quantity:              form.quantity,
        ...(isBuy  ? { entry_price: form.entry_price } : { exit_price: form.exit_price }),
        sl:                    form.sl || null,
        tp:                    form.tp || null,
        setup_type:            form.setup_type || null,
        why_taking_trade:      form.why_taking_trade || null,
        market_condition:      form.market_condition || null,
        emotional_state:       form.emotional_state || null,
        post_trade_evaluation: form.post_trade_evaluation || null,
        lessons_notes:         form.lessons_notes || null,
        notes:                 form.notes || null,
        ...(!isBuy ? { exit_reason: form.exit_reason || null } : {}),
      }
      const res = await updateTradeAction(action.id, payload)
      onSaved(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [form, action.id, isBuy, onSaved])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Edit Action</h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              <span className="font-semibold">{action.action_type}</span> · {action.symbol} · {action.date}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-4">

          <div className={`grid gap-3 ${isBuy ? 'grid-cols-2' : 'grid-cols-2'}`}>
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" value={form.date} max={today()}
                onChange={e => set('date', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Quantity (units)</label>
              <input type="number" value={form.quantity} min="1"
                onChange={e => set('quantity', e.target.value)} className={INPUT} />
            </div>
            {isBuy ? (
              <div>
                <label className={LABEL}>Entry Price (Rs.)</label>
                <input type="number" value={form.entry_price} step="0.01"
                  onChange={e => set('entry_price', e.target.value)} className={INPUT} />
              </div>
            ) : (
              <div>
                <label className={LABEL}>Exit Price (Rs.)</label>
                <input type="number" value={form.exit_price} step="0.01"
                  onChange={e => set('exit_price', e.target.value)} className={INPUT} />
              </div>
            )}
            {isBuy && (
              <>
                <div>
                  <label className={LABEL}>SL <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(opt)</span></label>
                  <input type="number" value={form.sl} step="0.01" placeholder="Rs."
                    onChange={e => set('sl', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>TP <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(opt)</span></label>
                  <input type="number" value={form.tp} step="0.01" placeholder="Rs."
                    onChange={e => set('tp', e.target.value)} className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Setup Type</label>
                  <input type="text" value={form.setup_type} placeholder="Breakout, SMC…"
                    onChange={e => set('setup_type', e.target.value)} className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Trade Thesis</label>
                  <textarea value={form.why_taking_trade}
                    onChange={e => set('why_taking_trade', e.target.value)}
                    rows={2} className={INPUT + ' resize-none'} />
                </div>
              </>
            )}
            {!isBuy && (
              <>
                <div className="col-span-2">
                  <label className={LABEL}>Exit Reason</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXIT_REASONS.map(r => (
                      <button key={r} type="button"
                        onClick={() => toggle('exit_reason', r)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                          form.exit_reason === r
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                        }`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Reflection</label>
                  <textarea value={form.post_trade_evaluation}
                    onChange={e => set('post_trade_evaluation', e.target.value)}
                    rows={2} className={INPUT + ' resize-none'} />
                </div>
              </>
            )}
          </div>

          <div>
            <label className={LABEL}>Market Condition</label>
            <div className="flex flex-wrap gap-1.5">
              {MARKET_CONDITIONS.map(m => (
                <button key={m} type="button"
                  onClick={() => toggle('market_condition', m)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                    form.market_condition === m
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL}>Emotional State</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONAL_STATES.map(s => (
                <button key={s} type="button"
                  onClick={() => toggle('emotional_state', s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                    form.emotional_state === s
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
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
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
