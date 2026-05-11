import { useState, useEffect, useCallback } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { newPosition, addToPosition, getSetupTypes } from '../../api'

const MARKET_CONDITIONS = ['Bullish', 'Bearish', 'Sideways', 'Volatile', 'Low Vol']
const EMOTIONAL_STATES  = ['Confident', 'Calm', 'Anxious', 'Fearful', 'Greedy', 'FOMO', 'Neutral']
const DEFAULT_SETUPS    = ['Breakout', 'Reversal', 'Pullback', 'Range Play', 'News', 'SMC', 'Price Action']

const MARKET_COLOR = {
  Bullish:  'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Bearish:  'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Sideways: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Volatile: 'border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'Low Vol':'border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}
const EMOTION_COLOR = {
  Confident:'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Calm:     'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Anxious:  'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Fearful:  'border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Greedy:   'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  FOMO:     'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  Neutral:  'border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

const INPUT = 'w-full px-3 py-2 text-[12px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all'
const LABEL = 'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5'

const today = () => new Date().toISOString().split('T')[0]

const EMPTY = {
  date: today(), symbol: '', position: 'Long',
  quantity: '', entry_price: '', sl: '', tp: '',
  setup_type: '', why_taking_trade: '', market_condition: '', emotional_state: '',
}

// Parses broker SMS: "you bought RHPL-3000.0@290.00 on 2026-04-16 ..."
// Also handles: "you sold NABIL-500@1200.50 on 2026-04-16"
function parseBrokerMessage(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  // Match: (bought|sold) SYMBOL-QTY@PRICE on DATE
  const m = t.match(/(bought|sold)\s+([A-Z0-9]+)-?([\d.]+)@([\d.]+)\s+on\s+(\d{4}-\d{2}-\d{2})/i)
  if (!m) return null
  return {
    position:    m[1].toLowerCase() === 'bought' ? 'Long' : 'Short',
    symbol:      m[2].toUpperCase(),
    quantity:    String(parseFloat(m[3])),
    entry_price: String(parseFloat(m[4])),
    date:        m[5],
  }
}

export default function AddTradeModal({ onClose, onSaved, existingPosition }) {
  const [form,        setForm]       = useState(EMPTY)
  const [saving,      setSaving]     = useState(false)
  const [error,       setError]      = useState(null)
  const [setupTypes,  setSetupTypes] = useState(DEFAULT_SETUPS)
  const [conflict,    setConflict]   = useState(null)
  const [mode,        setMode]       = useState('new')
  const [brokerText,  setBrokerText] = useState('')
  const [brokerParsed,setBrokerParsed] = useState(null)

  useEscapeKey(onClose)

  useEffect(() => {
    getSetupTypes()
      .then(r => {
        const merged = [...new Set([...DEFAULT_SETUPS, ...r.data.map(s => s.name)])]
        setSetupTypes(merged)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (existingPosition) { setConflict(existingPosition); setMode('add') }
  }, [existingPosition])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (k, v) => setForm(f => ({ ...f, [k]: f[k] === v ? '' : v }))

  const isAddMode = mode === 'add' && conflict

  const handleSubmit = useCallback(async e => {
    e.preventDefault()
    setError(null)
    const { date, symbol, position, quantity, entry_price, sl, tp,
            setup_type, why_taking_trade, market_condition, emotional_state } = form

    if (mode === 'new' && !symbol.trim()) return setError('Symbol is required')
    if (!date)        return setError('Date is required')
    if (!quantity)    return setError('Quantity is required')
    if (!entry_price) return setError('Entry price is required')

    setSaving(true)
    try {
      const payload = {
        date, quantity, entry_price,
        sl: sl || undefined, tp: tp || undefined,
        setup_type: setup_type || undefined,
        why_taking_trade: why_taking_trade || undefined,
        market_condition: market_condition || undefined,
        emotional_state: emotional_state || undefined,
      }

      let res
      if (isAddMode) {
        res = await addToPosition(conflict.trade_id, payload)
      } else {
        res = await newPosition({ ...payload, symbol: symbol.toUpperCase(), position })
        if (res.data?.existingPosition) {
          setConflict(res.data.existingPosition)
          setSaving(false)
          return
        }
      }
      onSaved(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save trade')
    } finally {
      setSaving(false)
    }
  }, [form, mode, conflict, isAddMode, onSaved])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[92vh] flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
              {isAddMode ? `Add to ${conflict.symbol}` : 'New Trade'}
            </h2>
            {isAddMode && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {conflict.direction} · {conflict.total_qty} kittā · WACC Rs.{parseFloat(conflict.wacc || 0).toFixed(2)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm">✕</button>
        </div>

        {/* ── Broker message paste area (new trade only) ── */}
        {!isAddMode && (
          <div className="px-6 pt-4">
            <div className={`rounded-xl border-2 border-dashed transition-all ${brokerParsed ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'}`}>
              {brokerParsed ? (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-[12px]">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">{brokerParsed.symbol}</span>
                    <span className="text-gray-500 dark:text-gray-400"> · {brokerParsed.position} · {brokerParsed.quantity} kittā @ Rs.{brokerParsed.entry_price} · {brokerParsed.date}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, ...brokerParsed }))
                        setBrokerParsed(null)
                        setBrokerText('')
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors">
                      Fill form ↓
                    </button>
                    <button type="button"
                      onClick={() => { setBrokerParsed(null); setBrokerText('') }}
                      className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
                  </div>
                </div>
              ) : (
                <textarea
                  value={brokerText}
                  onChange={e => {
                    const val = e.target.value
                    setBrokerText(val)
                    setBrokerParsed(val.trim() ? parseBrokerMessage(val) : null)
                  }}
                  placeholder="Paste broker message to auto-fill…"
                  rows={2}
                  className="w-full px-4 py-3 bg-transparent text-[11px] text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none"
                />
              )}
            </div>
          </div>
        )}

        {/* conflict banner */}
        {conflict && mode === 'new' && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
            <p className="text-[12px] text-amber-800 dark:text-amber-300 font-semibold mb-2">
              Open {conflict.direction} in {conflict.symbol} — {conflict.total_qty} kittā @ WACC Rs.{parseFloat(conflict.wacc || 0).toFixed(2)}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setMode('add')}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-semibold transition-colors">
                Add to position
              </button>
              <button onClick={() => setConflict(null)}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 font-semibold transition-colors">
                Open new trade
              </button>
            </div>
          </div>
        )}

        {/* scrollable body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Section 1: Trade Details ── */}
          <section>
            <SectionLabel>Trade Details</SectionLabel>

            {/* Direction toggle — only for new trade */}
            {!isAddMode && (
              <div className="flex gap-2 mb-3">
                {['Long', 'Short'].map(d => (
                  <button key={d} type="button"
                    onClick={() => set('position', d)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-bold border-2 transition-all ${
                      form.position === d
                        ? d === 'Long'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {d === 'Long' ? '↑ Long' : '↓ Short'}
                  </button>
                ))}
              </div>
            )}

            <div className={`grid gap-3 ${!isAddMode ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {!isAddMode && (
                <div className="col-span-2">
                  <label className={LABEL}>Symbol</label>
                  <input type="text" value={form.symbol}
                    onChange={e => set('symbol', e.target.value.toUpperCase())}
                    placeholder="e.g. NABIL" autoComplete="off"
                    className={INPUT + ' uppercase font-bold tracking-wider'} />
                </div>
              )}
              <div>
                <label className={LABEL}>Date</label>
                <input type="date" value={form.date} max={today()}
                  onChange={e => set('date', e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Quantity (kittā)</label>
                <input type="number" value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                  placeholder="100" min="1" autoComplete="off" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Entry Price (Rs.)</label>
                <input type="number" value={form.entry_price}
                  onChange={e => set('entry_price', e.target.value)}
                  placeholder="450.00" step="0.01" autoComplete="off" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Setup Type</label>
                <input type="text" list="setup-types-list" value={form.setup_type}
                  onChange={e => set('setup_type', e.target.value)}
                  placeholder="Breakout, SMC…" autoComplete="off" className={INPUT} />
                <datalist id="setup-types-list">
                  {setupTypes.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className={LABEL}>SL <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(optional)</span></label>
                <input type="number" value={form.sl}
                  onChange={e => set('sl', e.target.value)}
                  placeholder="Rs." step="0.01" autoComplete="off" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>TP <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(optional)</span></label>
                <input type="number" value={form.tp}
                  onChange={e => set('tp', e.target.value)}
                  placeholder="Rs." step="0.01" autoComplete="off" className={INPUT} />
              </div>
            </div>
          </section>

          {/* ── Section 2: Trade Thesis ── */}
          <section>
            <SectionLabel>Trade Thesis</SectionLabel>
            <textarea value={form.why_taking_trade}
              onChange={e => set('why_taking_trade', e.target.value)}
              placeholder="Why are you taking this trade? Entry reason, key levels, confluence…"
              rows={3}
              className={INPUT + ' resize-none leading-relaxed'} />
          </section>

          {/* ── Section 3: Market Context ── */}
          <section>
            <SectionLabel>Market Context</SectionLabel>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Market Condition</label>
                <div className="flex flex-wrap gap-1.5">
                  {MARKET_CONDITIONS.map(m => (
                    <PillButton key={m} label={m}
                      active={form.market_condition === m}
                      activeClass={MARKET_COLOR[m]}
                      onClick={() => toggle('market_condition', m)} />
                  ))}
                </div>
              </div>
              <div>
                <label className={LABEL}>Emotional State</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTIONAL_STATES.map(s => (
                    <PillButton key={s} label={s}
                      active={form.emotional_state === s}
                      activeClass={EMOTION_COLOR[s]}
                      onClick={() => toggle('emotional_state', s)} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {error && (
            <p className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-3 py-2 rounded-xl">{error}</p>
          )}

          {/* actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold disabled:opacity-50 transition-colors shadow-sm shadow-blue-500/20">
              {saving ? 'Saving…' : isAddMode ? 'Add to Position' : 'Save Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">{children}</p>
  )
}

function PillButton({ label, active, activeClass, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
        active
          ? activeClass
          : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-transparent hover:border-gray-300 dark:hover:border-gray-600'
      }`}>
      {label}
    </button>
  )
}
