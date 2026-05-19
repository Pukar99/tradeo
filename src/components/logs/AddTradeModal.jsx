import { useState, useEffect, useCallback, useMemo } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { newPosition, addToPosition, getSetupTypes } from '../../api'
import { clearPositionsCache } from '../../utils/globalCache'

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
  setup_type: '', why_taking_trade: '', thesis_notes: '',
  market_condition: '', emotional_state: '',
}

// Parses broker SMS: "you bought RHPL-3000.0@290.00 on 2026-04-16 ..."
// Also handles: "you sold NABIL-500@1200.50 on 2026-04-16"
function parseBrokerMessage(text) {
  const t = text.replace(/\s+/g, ' ').trim()
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

// Auto-suggest SL/TP: 5% risk, 1:2 R:R
function suggestSlTp(entryPrice, isLong) {
  const price = parseFloat(entryPrice)
  if (!price || price <= 0) return { sl: '', tp: '' }
  const sl = isLong ? price * 0.95 : price * 1.05
  const risk = Math.abs(price - sl)
  const tp = isLong ? price + 2 * risk : price - 2 * risk
  return {
    sl: sl.toFixed(2),
    tp: tp.toFixed(2),
  }
}

// Live SL/TP hint text
function slHint(entry, sl, isLong) {
  const e = parseFloat(entry), s = parseFloat(sl)
  if (!e || !s || e <= 0 || s <= 0) return null
  const pct = Math.abs((s - e) / e * 100).toFixed(1)
  const dir = isLong ? '↓' : '↑'
  return `${dir} ${pct}% from entry`
}

function tpHint(entry, sl, tp, isLong) {
  const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(tp)
  if (!e || !s || !t || e <= 0 || s <= 0 || t <= 0) return null
  const risk   = Math.abs(e - s)
  const reward = Math.abs(t - e)
  if (risk === 0) return null
  const rr   = (reward / risk).toFixed(1)
  const pct  = Math.abs((t - e) / e * 100).toFixed(1)
  const dir  = isLong ? '↑' : '↓'
  return `${dir} ${pct}% · R:R 1:${rr}`
}

// Live new WACC preview for Add mode
function calcNewWacc(oldWacc, oldQty, newPrice, newQty) {
  const ow = parseFloat(oldWacc), oq = parseFloat(oldQty)
  const np = parseFloat(newPrice), nq = parseFloat(newQty)
  if (!ow || !oq || !np || !nq || nq <= 0) return null
  return (ow * oq + np * nq) / (oq + nq)
}

// Broker paste UI — reused in both new and add modes
function BrokerPaste({ brokerText, brokerParsed, onChange, onFill, onClear, addMode }) {
  return (
    <div className="px-6 pt-4">
      <div className={`rounded-xl border-2 border-dashed transition-all ${
        brokerParsed
          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
      }`}>
        {brokerParsed ? (
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-[12px]">
              {!addMode && (
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{brokerParsed.symbol} · </span>
              )}
              <span className="text-gray-500 dark:text-gray-400">
                {!addMode && `${brokerParsed.position} · `}
                {brokerParsed.quantity} units @ Rs.{brokerParsed.entry_price} · {brokerParsed.date}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onFill}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors">
                Fill form ↓
              </button>
              <button type="button" onClick={onClear}
                className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
            </div>
          </div>
        ) : (
          <textarea
            value={brokerText}
            onChange={onChange}
            placeholder="Paste broker message to auto-fill…"
            rows={2}
            className="w-full px-4 py-3 bg-transparent text-[11px] text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none"
          />
        )}
      </div>
    </div>
  )
}

export default function AddTradeModal({ onClose, onSaved, existingPosition }) {
  const [form,         setForm]        = useState(EMPTY)
  const [saving,       setSaving]      = useState(false)
  const [error,        setError]       = useState(null)
  const [setupTypes,   setSetupTypes]  = useState(DEFAULT_SETUPS)
  const [conflict,     setConflict]    = useState(() => existingPosition || null)
  const [mode,         setMode]        = useState(() => existingPosition ? 'add' : 'new')
  const [brokerText,   setBrokerText]  = useState('')
  const [brokerParsed, setBrokerParsed]= useState(null)
  const [showThesis,   setShowThesis]  = useState(false)
  // track if SL/TP were manually edited — if so, don't auto-overwrite
  const [slManual,     setSlManual]    = useState(false)
  const [tpManual,     setTpManual]    = useState(false)

  useEscapeKey(onClose)

  useEffect(() => {
    getSetupTypes()
      .then(r => {
        const merged = [...new Set([...DEFAULT_SETUPS, ...r.data.map(s => s.name)])]
        setSetupTypes(merged)
      })
      .catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (k, v) => setForm(f => ({ ...f, [k]: f[k] === v ? '' : v }))

  const isAddMode = mode === 'add' && conflict
  const isLong    = form.position === 'Long'

  // Auto-suggest SL/TP when entry price changes (only if not manually set)
  const handleEntryPriceChange = useCallback((val) => {
    set('entry_price', val)
    if (!slManual && !tpManual) {
      const { sl, tp } = suggestSlTp(val, isLong)
      setForm(f => ({ ...f, entry_price: val, sl, tp }))
    } else if (!slManual) {
      const { sl } = suggestSlTp(val, isLong)
      setForm(f => ({ ...f, entry_price: val, sl }))
    } else if (!tpManual) {
      // recalc TP from existing manual SL
      const e = parseFloat(val), s = parseFloat(form.sl)
      if (e > 0 && s > 0) {
        const risk = Math.abs(e - s)
        const tp = isLong ? e + 2 * risk : e - 2 * risk
        setForm(f => ({ ...f, entry_price: val, tp: tp.toFixed(2) }))
      } else {
        set('entry_price', val)
      }
    }
  }, [slManual, tpManual, isLong, form.sl])

  // When position direction changes, re-suggest if not manually set
  const handlePositionChange = useCallback((dir) => {
    const newIsLong = dir === 'Long'
    setForm(f => {
      const next = { ...f, position: dir }
      if (!slManual && !tpManual && f.entry_price) {
        const { sl, tp } = suggestSlTp(f.entry_price, newIsLong)
        return { ...next, sl, tp }
      }
      return next
    })
  }, [slManual, tpManual])

  // Live hints
  const _sl = slHint(form.entry_price, form.sl, isLong)
  const _tp = tpHint(form.entry_price, form.sl, form.tp, isLong)

  // New WACC preview for Add mode
  const newWacc = useMemo(() => {
    if (!isAddMode || !conflict) return null
    return calcNewWacc(conflict.wacc, conflict.total_qty, form.entry_price, form.quantity)
  }, [isAddMode, conflict, form.entry_price, form.quantity])

  // Broker paste handlers
  const handleBrokerChange = (e) => {
    const val = e.target.value
    setBrokerText(val)
    setBrokerParsed(val.trim() ? parseBrokerMessage(val) : null)
  }

  const handleBrokerFill = () => {
    if (!brokerParsed) return
    if (isAddMode) {
      // In add mode: fill date, qty, entry_price only (symbol is locked)
      setForm(f => ({
        ...f,
        date:        brokerParsed.date,
        quantity:    brokerParsed.quantity,
        entry_price: brokerParsed.entry_price,
      }))
    } else {
      setForm(f => ({ ...f, ...brokerParsed }))
      // auto-suggest SL/TP from parsed price
      if (!slManual && !tpManual) {
        const { sl, tp } = suggestSlTp(brokerParsed.entry_price, brokerParsed.position === 'Long')
        setForm(f => ({ ...f, ...brokerParsed, sl, tp }))
      }
    }
    setBrokerParsed(null)
    setBrokerText('')
  }

  const handleBrokerClear = () => { setBrokerParsed(null); setBrokerText('') }

  const handleSubmit = useCallback(async (e, quickSave = false) => {
    if (e) e.preventDefault()
    setError(null)
    const { date, symbol, position, quantity, entry_price, sl, tp,
            setup_type, why_taking_trade, thesis_notes, market_condition, emotional_state } = form

    if (mode === 'new' && !symbol.trim()) return setError('Symbol is required')
    if (!date)        return setError('Date is required')
    if (!quantity)    return setError('Quantity is required')
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return setError('Quantity must be a whole number (e.g. 100)')
    if (!entry_price) return setError('Entry price is required')

    setSaving(true)
    try {
      const payload = {
        date, quantity, entry_price,
        sl: sl || undefined,
        tp: tp || undefined,
        ...(quickSave ? {} : {
          setup_type:       setup_type || undefined,
          why_taking_trade: why_taking_trade || undefined,
          thesis_notes:     thesis_notes || undefined,
          market_condition: market_condition || undefined,
          emotional_state:  emotional_state || undefined,
        }),
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
      clearPositionsCache()
      onSaved(res.data)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save trade'
      console.error('[AddTradeModal] save failed:', err.response?.status, msg, err.response?.data)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }, [form, mode, conflict, isAddMode, onSaved])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[92vh] flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
              {isAddMode ? `Add to ${conflict.symbol}` : 'New Trade'}
            </h2>
            {isAddMode && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {conflict.direction} · {conflict.total_qty} units · WACC Rs.{parseFloat(conflict.wacc || 0).toFixed(2)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm">✕</button>
        </div>

        {/* Broker paste — shown in both new and add modes */}
        <BrokerPaste
          brokerText={brokerText}
          brokerParsed={brokerParsed}
          onChange={handleBrokerChange}
          onFill={handleBrokerFill}
          onClear={handleBrokerClear}
          addMode={isAddMode}
        />

        {/* conflict banner */}
        {conflict && mode === 'new' && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
            <p className="text-[12px] text-amber-800 dark:text-amber-300 font-semibold mb-2">
              Open {conflict.direction} in {conflict.symbol} — {conflict.total_qty} units @ WACC Rs.{parseFloat(conflict.wacc || 0).toFixed(2)}
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
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>

          {/* ── REQUIRED SECTION ── */}
          <section>
            <SectionLabel required>Trade Details</SectionLabel>

            {/* Direction toggle — only for new trade */}
            {!isAddMode && (
              <div className="flex gap-2 mb-3">
                {['Long', 'Short'].map(d => (
                  <button key={d} type="button"
                    onClick={() => handlePositionChange(d)}
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

            <div className="grid grid-cols-2 gap-3">
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
                <label className={LABEL}>Quantity (units)</label>
                <input type="number" value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                  placeholder="100" min="1" step="1" autoComplete="off" className={INPUT} />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Entry Price (Rs.)</label>
                <input type="number" value={form.entry_price}
                  onChange={e => handleEntryPriceChange(e.target.value)}
                  placeholder="450.00" step="0.01" autoComplete="off" className={INPUT} />
              </div>

              {/* SL */}
              <div>
                <label className={LABEL}>
                  SL
                  {!slManual && form.sl && (
                    <span className="ml-1.5 normal-case font-normal text-[10px] text-blue-400 dark:text-blue-500">auto</span>
                  )}
                </label>
                <input type="number" value={form.sl}
                  onChange={e => { setSlManual(true); set('sl', e.target.value) }}
                  placeholder="Rs." step="0.01" autoComplete="off" className={INPUT} />
                {_sl && (
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 font-mono">{_sl}</p>
                )}
              </div>

              {/* TP */}
              <div>
                <label className={LABEL}>
                  TP
                  {!tpManual && form.tp && (
                    <span className="ml-1.5 normal-case font-normal text-[10px] text-blue-400 dark:text-blue-500">auto</span>
                  )}
                </label>
                <input type="number" value={form.tp}
                  onChange={e => { setTpManual(true); set('tp', e.target.value) }}
                  placeholder="Rs." step="0.01" autoComplete="off" className={INPUT} />
                {_tp && (
                  <p className="mt-1 text-[10px] text-emerald-500 dark:text-emerald-400 font-mono">{_tp}</p>
                )}
              </div>
            </div>

            {/* WACC preview for Add mode */}
            {isAddMode && newWacc !== null && (
              <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-gray-400 dark:text-gray-500">New WACC</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">
                    Rs.{newWacc.toFixed(2)}
                    <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">
                      (was Rs.{parseFloat(conflict.wacc).toFixed(2)})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono mt-0.5">
                  <span className="text-gray-400 dark:text-gray-500">New total</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {(parseFloat(conflict.total_qty) + parseFloat(form.quantity || 0)).toFixed(0)} units
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* ── OPTIONAL SECTION — only shows after entry price is filled ── */}
          {parseFloat(form.entry_price) > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                  Take 30 seconds · optional
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>

              <div className="space-y-4">

                {/* Step 1: Setup Type — always shown once price entered */}
                <div>
                  <label className={LABEL}>Setup Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {setupTypes.map(s => (
                      <PillButton key={s} label={s}
                        active={form.setup_type === s}
                        activeClass="border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        onClick={() => toggle('setup_type', s)} />
                    ))}
                  </div>
                </div>

                {/* Step 2: Market Condition — shows after setup type picked */}
                {form.setup_type && (
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
                )}

                {/* Step 3: Emotional State — shows after market condition picked */}
                {form.market_condition && (
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
                )}

                {/* Step 4: Why Taking Trade — shows after emotion picked */}
                {form.emotional_state && (
                  <div>
                    <label className={LABEL}>Why Taking This Trade?</label>
                    <textarea value={form.why_taking_trade}
                      onChange={e => set('why_taking_trade', e.target.value)}
                      placeholder="Entry reason, key level, catalyst…"
                      rows={2}
                      className={INPUT + ' resize-none leading-relaxed'} />
                  </div>
                )}

                {/* Step 5: Thesis Notes — shows after why_taking_trade has content */}
                {form.why_taking_trade.trim() && (
                  showThesis ? (
                    <div>
                      <label className={LABEL}>Confluence / Thesis Notes</label>
                      <textarea value={form.thesis_notes}
                        onChange={e => set('thesis_notes', e.target.value)}
                        placeholder="Deeper confluence: structure, indicators, plan B…"
                        rows={3}
                        className={INPUT + ' resize-none leading-relaxed'} />
                      <button type="button" onClick={() => setShowThesis(false)}
                        className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                        − Hide
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowThesis(true)}
                      className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      + Add confluence / thesis notes
                    </button>
                  )
                )}

              </div>
            </section>
          )}

          {error && (
            <p className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-3 py-2 rounded-xl">{error}</p>
          )}

          {/* actions */}
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold disabled:opacity-50 transition-colors shadow-sm shadow-blue-500/20">
                {saving ? 'Saving…' : isAddMode ? 'Add to Position' : 'Save Trade'}
              </button>
            </div>
            <div className="text-center">
              <button type="button" disabled={saving}
                onClick={e => handleSubmit(null, true)}
                className="w-full py-2 text-[11px] text-gray-400 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors disabled:opacity-50 min-h-[36px]">
                Save without journal →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function SectionLabel({ children, required }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${
      required ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'
    }`}>{children}</p>
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
