import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getTradeLog, addTradeLog, updateTradeLog,
  closeTradeLog, partialCloseTradeLog, deleteTradeLog,
  getTradeJournal, addTradeJournal, deleteTradeJournal
} from '../api'

const NEPSE_SYMBOLS = [
  'NTC','NABIL','SCB','EBL','NICA','HBL','KBL','MBL','CZBIL','SBI',
  'ADBL','GBIME','PCBL','SANIMA','NMB','SRBL','NBB','PRVU','CBL','CCBL',
  'RHPL','PPCL','SHPC','BPCL','NHPC','RRHP','KPCL','MHNL','RADHI','HPPL',
  'NLIC','LICN','SLICL','NICL','PICL','SICL','GILC','ALICL','AIL','HGIL',
  'UPPER','UMHL','CHCL','API','GHL','HURJA','RURU','TPHL','KBBL','SSHL',
  'NIFRA','NIDC','HIDCL','BHPL','NGPL','BARUN','KKHC','DHPL','NHDL','SMHL',
  'NRIC','SPIL','RBCL','MANDU','DOLTI','USHEC','RIDI','BGWT','NGADI','KANI',
  'AKPL','SAHAS','PMHPL','SJCL','RURU','UMRH','HPCL','UMRH','JOSHI','SWBBL',
  'NIFRA','HIDCL','CEDB','API','NABIL','SHINE','MEGA','GMFIL','SIFC','SKDBL'
]

const EMOTIONAL_STATES = [
  { value: 'confident', label: '💪 Confident', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'calm', label: '😌 Calm', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: 'anxious', label: '😰 Anxious', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'fearful', label: '😨 Fearful', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'greedy', label: '🤑 Greedy', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  { value: 'fomo', label: '😱 FOMO', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'neutral', label: '😐 Neutral', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
]

const MARKET_CONDITIONS = [
  { value: 'bullish', label: '📈 Bullish' },
  { value: 'bearish', label: '📉 Bearish' },
  { value: 'sideways', label: '➡️ Sideways' },
  { value: 'volatile', label: '⚡ Volatile' },
  { value: 'low_volume', label: '📊 Low Volume' },
]

function parseBrokerMessage(msg) {
  if (!msg) return null
  const result = {}
  const buyMatch = msg.match(/bought\s+([\w-]+)[- ]([\d.]+)@([\d.]+)/i)
  const sellMatch = msg.match(/sold\s+([\w-]+)[- ]?([\d.]+)@([\d.]+)/i)

  if (buyMatch) {
    result.symbol = buyMatch[1].replace(/-\d+$/, '').toUpperCase()
    result.quantity = parseFloat(buyMatch[2])
    result.entry_price = parseFloat(buyMatch[3])
    result.position = 'LONG'
  } else if (sellMatch) {
    result.symbol = sellMatch[1].replace(/-\d+$/, '').toUpperCase()
    result.quantity = parseFloat(sellMatch[2])
    result.entry_price = parseFloat(sellMatch[3])
    result.position = 'SHORT'
  }

  const dateMatch = msg.match(/on (\d{4}-\d{2}-\d{2})/i)
  if (dateMatch) result.date = dateMatch[1]

  return Object.keys(result).length > 0 ? result : null
}

function AddTradeModal({ onClose, onSave, editTrade }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    symbol: '',
    position: 'LONG',
    quantity: '',
    entry_price: '',
    sl: '',
    tp: '',
    notes: '',
  })
  const [brokerMsg, setBrokerMsg] = useState('')
  const [brokerParsed, setBrokerParsed] = useState(null)
  const [symbolSuggestions, setSymbolSuggestions] = useState([])
  const [slWarning, setSlWarning] = useState('')
  const [rrRatio, setRrRatio] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showBrokerInput, setShowBrokerInput] = useState(false)

  useEffect(() => {
    if (editTrade) {
      setForm({
        date: editTrade.date,
        symbol: editTrade.symbol,
        position: editTrade.position,
        quantity: editTrade.quantity,
        entry_price: editTrade.entry_price,
        sl: editTrade.sl || '',
        tp: editTrade.tp || '',
        notes: editTrade.notes || '',
      })
    }
  }, [editTrade])

  useEffect(() => {
    if (form.entry_price && form.sl && form.tp) {
      const entry = parseFloat(form.entry_price)
      const sl = parseFloat(form.sl)
      const tp = parseFloat(form.tp)
      if (entry && sl && tp) {
        const risk = Math.abs(entry - sl)
        const reward = Math.abs(tp - entry)
        if (risk > 0) setRrRatio((reward / risk).toFixed(2))
      }
    } else {
      setRrRatio(null)
    }

    if (form.entry_price && form.sl) {
      const entry = parseFloat(form.entry_price)
      const sl = parseFloat(form.sl)
      const diff = Math.abs(((entry - sl) / entry) * 100)
      if (diff > 10) setSlWarning('⚠️ Stop loss is more than 10% away — very wide risk!')
      else if (diff < 0.5) setSlWarning('⚠️ Stop loss is too tight — may get stopped out easily.')
      else setSlWarning('')
    }
  }, [form.entry_price, form.sl, form.tp])

  const handleSymbolInput = (val) => {
    const upper = val.toUpperCase()
    setForm(prev => ({ ...prev, symbol: upper }))
    if (upper.length >= 1) {
      const matches = NEPSE_SYMBOLS.filter(s => s.startsWith(upper))
      setSymbolSuggestions(matches.slice(0, 6))
    } else {
      setSymbolSuggestions([])
    }
  }

  const handleBrokerParse = () => {
    const parsed = parseBrokerMessage(brokerMsg)
    if (parsed) {
      setBrokerParsed(parsed)
      setForm(prev => ({
        ...prev,
        symbol: parsed.symbol || prev.symbol,
        quantity: parsed.quantity || prev.quantity,
        entry_price: parsed.entry_price || prev.entry_price,
        position: parsed.position || prev.position,
        date: parsed.date || prev.date,
      }))
    } else {
      setBrokerParsed(null)
      alert('Could not parse broker message. Please enter manually.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!NEPSE_SYMBOLS.includes(form.symbol) && !form.symbol) {
      alert('Please enter a valid NEPSE symbol')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto">

        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {editTrade ? 'Edit Trade' : 'Add New Trade'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Record with discipline & clarity</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <button
            type="button"
            onClick={() => setShowBrokerInput(!showBrokerInput)}
            className="w-full mb-4 flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors border border-blue-200 dark:border-blue-700"
          >
            <span>📋</span> Paste Broker Message
          </button>

          {showBrokerInput && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                Paste your broker confirmation message
              </label>
              <textarea
                value={brokerMsg}
                onChange={e => setBrokerMsg(e.target.value)}
                placeholder="e.g. you bought RHPL-2000.0@292.74 on 2026-04-09..."
                rows={3}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
              <button
                type="button"
                onClick={handleBrokerParse}
                className="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700"
              >
                Auto-Extract Trade Data
              </button>
              {brokerParsed && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900 rounded-lg">
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                    ✓ Extracted: {brokerParsed.position} {brokerParsed.quantity} {brokerParsed.symbol} @ Rs.{brokerParsed.entry_price}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    Please add SL/TP below to complete the trade.
                  </p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Symbol</label>
                <input
                  type="text"
                  value={form.symbol}
                  onChange={e => handleSymbolInput(e.target.value)}
                  placeholder="e.g. NTC"
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 uppercase"
                  required
                />
                {symbolSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                    {symbolSuggestions.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setForm(prev => ({ ...prev, symbol: s })); setSymbolSuggestions([]) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Position</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, position: 'LONG' }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      form.position === 'LONG'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    📈 Long
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, position: 'SHORT' }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      form.position === 'SHORT'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    📉 Short
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="100"
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Entry Price (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.entry_price}
                  onChange={e => setForm(prev => ({ ...prev, entry_price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Stop Loss (Rs.) <span className="text-gray-400 font-normal">optional</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.sl}
                  onChange={e => setForm(prev => ({ ...prev, sl: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {!form.sl && (
                  <p className="text-xs text-orange-500 mt-1">💡 Using stop loss helps protect your capital.</p>
                )}
                {slWarning && (
                  <p className="text-xs text-red-500 mt-1">{slWarning}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Take Profit (Rs.) <span className="text-gray-400 font-normal">optional</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.tp}
                  onChange={e => setForm(prev => ({ ...prev, tp: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {rrRatio && (
              <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${
                parseFloat(rrRatio) >= 2
                  ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700'
                  : parseFloat(rrRatio) >= 1
                  ? 'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700'
                  : 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
              }`}>
                <span className="text-lg">⚖️</span>
                <div>
                  <p className={`text-sm font-bold ${
                    parseFloat(rrRatio) >= 2 ? 'text-green-700 dark:text-green-300'
                    : parseFloat(rrRatio) >= 1 ? 'text-yellow-700 dark:text-yellow-300'
                    : 'text-red-700 dark:text-red-300'
                  }`}>
                    Risk:Reward = 1:{rrRatio}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {parseFloat(rrRatio) >= 2 ? '✓ Excellent setup' : parseFloat(rrRatio) >= 1 ? '⚠️ Acceptable but aim for 1:2+' : '✗ Poor setup — reconsider'}
                  </p>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Why are you taking this trade? What's your thesis?"
                rows={3}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editTrade ? 'Update Trade' : 'Add Trade'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function CloseTradeModal({ trade, onClose, onSave, isPartial }) {
  const [exitPrice, setExitPrice] = useState('')
  const [exitQty, setExitQty] = useState('')
  const [reason, setReason] = useState('target')
  const [saving, setSaving] = useState(false)

  const remaining = trade.remaining_quantity || trade.quantity
  const pnl = exitPrice
    ? trade.position === 'LONG'
      ? (parseFloat(exitPrice) - trade.entry_price) * (isPartial ? parseFloat(exitQty || 0) : remaining)
      : (trade.entry_price - parseFloat(exitPrice)) * (isPartial ? parseFloat(exitQty || 0) : remaining)
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isPartial && parseFloat(exitQty) > remaining) {
      alert(`Cannot close more than ${remaining} shares`)
      return
    }
    setSaving(true)
    try {
      await onSave({ exit_price: parseFloat(exitPrice), exit_quantity: parseFloat(exitQty), reason })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isPartial ? 'Partial Close' : 'Close Trade'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {trade.symbol} — {trade.position} — {remaining} shares remaining
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {isPartial && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Quantity to Close (max: {remaining})
              </label>
              <input
                type="number"
                value={exitQty}
                onChange={e => setExitQty(e.target.value)}
                placeholder={`Max ${remaining}`}
                max={remaining}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Exit Price (Rs.)</label>
            <input
              type="number"
              step="0.01"
              value={exitPrice}
              onChange={e => setExitPrice(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Close Reason</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'target', label: '🎯 TP Hit' },
                { value: 'stoploss', label: '🛡️ SL Hit' },
                { value: 'manual', label: '✋ Manual' },
              ].map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                    reason === r.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {pnl !== null && (
            <div className={`mb-4 p-3 rounded-xl text-center ${
              pnl >= 0
                ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
            }`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estimated P&L</p>
              <p className={`text-xl font-bold ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}Rs. {Math.round(pnl).toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 ${
              isPartial ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-500 hover:bg-red-600'
            }`}>
              {saving ? 'Closing...' : isPartial ? 'Partial Close' : 'Close Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function JournalModal({ onClose, onSave, tradeId, tradeName }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    emotional_state: '',
    market_condition: '',
    pre_trade_reasoning: '',
    post_trade_evaluation: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, trade_id: tradeId || null })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Trade Journal</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {tradeName ? `Linked to: ${tradeName}` : 'General journal entry'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Market Condition</label>
              <div className="flex flex-wrap gap-1.5">
                {MARKET_CONDITIONS.map(mc => (
                  <button
                    key={mc.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, market_condition: mc.value }))}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      form.market_condition === mc.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {mc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Emotional State</label>
            <div className="flex flex-wrap gap-2">
              {EMOTIONAL_STATES.map(es => (
                <button
                  key={es.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, emotional_state: es.value }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    form.emotional_state === es.value
                      ? es.color + ' ring-2 ring-blue-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {es.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pre-Trade Reasoning</label>
            <textarea
              value={form.pre_trade_reasoning}
              onChange={e => setForm(prev => ({ ...prev, pre_trade_reasoning: e.target.value }))}
              placeholder="Why did you take this trade? What was your setup?"
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Post-Trade Evaluation</label>
            <textarea
              value={form.post_trade_evaluation}
              onChange={e => setForm(prev => ({ ...prev, post_trade_evaluation: e.target.value }))}
              placeholder="How did the trade go? What did you learn?"
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any other thoughts..."
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Journal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TradeRow({ trade, onEdit, onClose, onPartialClose, onDelete, onJournal }) {
  const [expanded, setExpanded] = useState(false)

  const remaining = trade.remaining_quantity ?? trade.quantity
  const pnl = trade.realized_pnl || 0
  const isOpen = trade.status === 'OPEN' || trade.status === 'PARTIAL'

  const getStatusBadge = () => {
    switch (trade.status) {
      case 'OPEN': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      case 'PARTIAL': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
      case 'CLOSED': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
      default: return ''
    }
  }

  return (
    <>
      <tr
        className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{trade.date}</td>
        <td className="px-4 py-3">
          <span className="text-sm font-bold text-gray-900 dark:text-white">{trade.symbol}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
            trade.position === 'LONG'
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          }`}>
            {trade.position === 'LONG' ? '📈 Long' : '📉 Short'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {remaining}/{trade.quantity}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          Rs.{parseFloat(trade.entry_price).toFixed(2)}
        </td>
        <td className="px-4 py-3">
          <div className="text-xs">
            {trade.sl && <div className="text-red-500">SL: {trade.sl}</div>}
            {trade.tp && <div className="text-green-500">TP: {trade.tp}</div>}
            {!trade.sl && !trade.tp && <span className="text-gray-400">—</span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-sm font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}Rs.${Math.round(pnl).toLocaleString()}` : '—'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusBadge()}`}>
            {trade.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {isOpen && (
              <>
                <button
                  onClick={() => onPartialClose(trade)}
                  className="text-xs text-orange-500 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900 transition-colors"
                  title="Partial Close"
                >
                  ½
                </button>
                <button
                  onClick={() => onClose(trade)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
                  title="Close Trade"
                >
                  ✕
                </button>
              </>
            )}
            <button
              onClick={() => onJournal(trade)}
              className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
              title="Add Journal"
            >
              📝
            </button>
            <button
              onClick={() => onEdit(trade)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(trade.id)}
              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800">
          <td colSpan={9} className="px-4 py-3">
            <div className="grid grid-cols-3 gap-4 text-xs">
              {trade.notes && (
                <div>
                  <p className="text-gray-400 font-medium mb-1">Notes</p>
                  <p className="text-gray-700 dark:text-gray-300">{trade.notes}</p>
                </div>
              )}
              {trade.partial_exits?.length > 0 && (
                <div>
                  <p className="text-gray-400 font-medium mb-1">Partial Exits</p>
                  {trade.partial_exits.map((pe, i) => (
                    <p key={i} className="text-gray-700 dark:text-gray-300">
                      {pe.exit_quantity} @ Rs.{pe.exit_price} ({pe.pnl >= 0 ? '+' : ''}Rs.{pe.pnl})
                    </p>
                  ))}
                </div>
              )}
              {trade.exit_price && (
                <div>
                  <p className="text-gray-400 font-medium mb-1">Exit Price</p>
                  <p className="text-gray-700 dark:text-gray-300">Rs.{trade.exit_price}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function TraderPage() {
  const { user } = useAuth()
  const [trades, setTrades] = useState([])
  const [journals, setJournals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('trades')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTrade, setEditTrade] = useState(null)
  const [closeTrade, setCloseTrade] = useState(null)
  const [partialTrade, setPartialTrade] = useState(null)
  const [journalTrade, setJournalTrade] = useState(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchSymbol, setSearchSymbol] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [tradesRes, journalsRes] = await Promise.all([
        getTradeLog(),
        getTradeJournal()
      ])
      setTrades(tradesRes.data)
      setJournals(journalsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTrade = async (form) => {
    if (editTrade) {
      const res = await updateTradeLog(editTrade.id, form)
      setTrades(prev => prev.map(t => t.id === editTrade.id ? res.data : t))
      setEditTrade(null)
    } else {
      const res = await addTradeLog(form)
      setTrades(prev => [res.data, ...prev])
    }
  }

  const handleCloseTrade = async ({ exit_price }) => {
    const res = await closeTradeLog(closeTrade.id, { exit_price })
    setTrades(prev => prev.map(t => t.id === closeTrade.id ? res.data : t))
    setCloseTrade(null)
  }

  const handlePartialClose = async ({ exit_price, exit_quantity, reason }) => {
    const res = await partialCloseTradeLog(partialTrade.id, { exit_price, exit_quantity, reason })
    setTrades(prev => prev.map(t => t.id === partialTrade.id ? res.data : t))
    setPartialTrade(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trade?')) return
    await deleteTradeLog(id)
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  const handleAddJournal = async (form) => {
    const res = await addTradeJournal(form)
    setJournals(prev => [res.data, ...prev])
    setJournalTrade(null)
  }

  const handleDeleteJournal = async (id) => {
    if (!window.confirm('Delete this journal entry?')) return
    await deleteTradeJournal(id)
    setJournals(prev => prev.filter(j => j.id !== id))
  }

  const filteredTrades = trades.filter(t => {
    const matchStatus = filterStatus === 'ALL' || t.status === filterStatus
    const matchSymbol = !searchSymbol || t.symbol.includes(searchSymbol.toUpperCase())
    return matchStatus && matchSymbol
  })

  const stats = {
    total: trades.length,
    open: trades.filter(t => t.status === 'OPEN').length,
    partial: trades.filter(t => t.status === 'PARTIAL').length,
    closed: trades.filter(t => t.status === 'CLOSED').length,
    totalPnl: trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0),
    winners: trades.filter(t => (t.realized_pnl || 0) > 0).length,
  }

  if (loading) return (
    <div className="w-full px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading trade log...</p>
      </div>
    </div>
  )

  return (
    <div className="w-full px-6 py-6 max-w-7xl mx-auto">

      {showAddModal && (
        <AddTradeModal
          onClose={() => { setShowAddModal(false); setEditTrade(null) }}
          onSave={handleAddTrade}
          editTrade={editTrade}
        />
      )}
      {closeTrade && (
        <CloseTradeModal
          trade={closeTrade}
          onClose={() => setCloseTrade(null)}
          onSave={handleCloseTrade}
          isPartial={false}
        />
      )}
      {partialTrade && (
        <CloseTradeModal
          trade={partialTrade}
          onClose={() => setPartialTrade(null)}
          onSave={handlePartialClose}
          isPartial={true}
        />
      )}
      {journalTrade !== null && (
        <JournalModal
          onClose={() => setJournalTrade(null)}
          onSave={handleAddJournal}
          tradeId={journalTrade?.id}
          tradeName={journalTrade?.symbol ? `${journalTrade.symbol} ${journalTrade.position}` : null}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trade Log</h1>
          <p className="text-sm text-gray-400 mt-0.5">Record your trades with discipline & clarity</p>
        </div>
        <button
          onClick={() => { setEditTrade(null); setShowAddModal(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>+</span> Add New Trade
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Trades', value: stats.total, color: 'text-gray-900 dark:text-white' },
          { label: 'Open', value: stats.open, color: 'text-blue-500' },
          { label: 'Partial', value: stats.partial, color: 'text-orange-500' },
          { label: 'Closed', value: stats.closed, color: 'text-gray-500' },
          { label: 'Winners', value: stats.winners, color: 'text-green-500' },
          {
            label: 'Total P&L',
            value: `${stats.totalPnl >= 0 ? '+' : ''}Rs.${Math.round(stats.totalPnl).toLocaleString()}`,
            color: stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
          },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {['trades', 'journal'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab === 'trades' ? '📊 Trade Log' : '📝 Journal'}
          </button>
        ))}
        <button
          onClick={() => setJournalTrade({})}
          className="ml-auto px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          + General Journal
        </button>
      </div>

      {activeTab === 'trades' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={searchSymbol}
              onChange={e => setSearchSymbol(e.target.value)}
              placeholder="Search symbol..."
              className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 w-40"
            />
            <div className="flex gap-2">
              {['ALL', 'OPEN', 'PARTIAL', 'CLOSED'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    filterStatus === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">
              {filteredTrades.length} trades · Click row to expand
            </span>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl mb-4 block">📊</span>
              <p className="text-gray-400 text-sm">No trades yet</p>
              <p className="text-gray-400 text-xs mt-1">Click "+ Add New Trade" to start recording</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {['Date', 'Symbol', 'Position', 'Qty', 'Entry', 'SL/TP', 'P&L', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map(trade => (
                    <TradeRow
                      key={trade.id}
                      trade={trade}
                      onEdit={(t) => { setEditTrade(t); setShowAddModal(true) }}
                      onClose={(t) => setCloseTrade(t)}
                      onPartialClose={(t) => setPartialTrade(t)}
                      onDelete={handleDelete}
                      onJournal={(t) => setJournalTrade(t)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'journal' && (
        <div className="space-y-4">
          {journals.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
              <span className="text-4xl mb-4 block">📝</span>
              <p className="text-gray-400 text-sm">No journal entries yet</p>
              <p className="text-gray-400 text-xs mt-1">Add a journal from a trade or click "+ General Journal"</p>
            </div>
          ) : (
            journals.map(j => {
              const emotion = EMOTIONAL_STATES.find(e => e.value === j.emotional_state)
              const market = MARKET_CONDITIONS.find(m => m.value === j.market_condition)
              const linkedTrade = trades.find(t => t.id === j.trade_id)
              return (
                <div key={j.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{j.date}</span>
                      {emotion && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${emotion.color}`}>
                          {emotion.label}
                        </span>
                      )}
                      {market && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                          {market.label}
                        </span>
                      )}
                      {linkedTrade && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium">
                          🔗 {linkedTrade.symbol} {linkedTrade.position}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteJournal(j.id)}
                      className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {j.pre_trade_reasoning && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pre-Trade</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{j.pre_trade_reasoning}</p>
                      </div>
                    )}
                    {j.post_trade_evaluation && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Post-Trade</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{j.post_trade_evaluation}</p>
                      </div>
                    )}
                    {j.notes && (
                      <div className="lg:col-span-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{j.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default TraderPage