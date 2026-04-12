import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
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
  'AKPL','SAHAS','PMHPL','SJCL','UMRH','HPCL','JOSHI','SWBBL','CEDB','SHINE',
  'MEGA','GMFIL','SIFC','SKDBL'
]

const EMOTIONAL_STATES = [
  { value: 'confident', label: '💪 Confident', dot: 'bg-blue-400',   pill: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'calm',      label: '😌 Calm',      dot: 'bg-green-400',  pill: 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'anxious',   label: '😰 Anxious',   dot: 'bg-yellow-400', pill: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'fearful',   label: '😨 Fearful',   dot: 'bg-orange-400', pill: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'greedy',    label: '🤑 Greedy',    dot: 'bg-red-400',    pill: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'fomo',      label: '😱 FOMO',      dot: 'bg-purple-400', pill: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'neutral',   label: '😐 Neutral',   dot: 'bg-gray-400',   pill: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
]

const MARKET_CONDITIONS = [
  { value: 'bullish',    label: 'Bullish' },
  { value: 'bearish',    label: 'Bearish' },
  { value: 'sideways',   label: 'Sideways' },
  { value: 'volatile',   label: 'Volatile' },
  { value: 'low_volume', label: 'Low Vol' },
]

// ── Shared input style ────────────────────────────────────────────────────────
const INPUT = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors'
const LABEL = 'block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1'

// ── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div
        className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto no-scrollbar shadow-xl`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, sub, onClose }) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
      <div>
        <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{title}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mt-0.5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Parser ────────────────────────────────────────────────────────────────────
function parseBrokerMessage(msg) {
  if (!msg) return null
  const result = {}
  const buyMatch  = msg.match(/bought\s+([\w-]+)[- ]([\d.]+)@([\d.]+)/i)
  const sellMatch = msg.match(/sold\s+([\w-]+)[- ]?([\d.]+)@([\d.]+)/i)
  if (buyMatch)  { result.symbol = buyMatch[1].replace(/-\d+$/, '').toUpperCase();  result.quantity = parseFloat(buyMatch[2]);  result.entry_price = parseFloat(buyMatch[3]);  result.position = 'LONG' }
  else if (sellMatch) { result.symbol = sellMatch[1].replace(/-\d+$/, '').toUpperCase(); result.quantity = parseFloat(sellMatch[2]); result.entry_price = parseFloat(sellMatch[3]); result.position = 'SHORT' }
  const dateMatch = msg.match(/on (\d{4}-\d{2}-\d{2})/i)
  if (dateMatch) result.date = dateMatch[1]
  return Object.keys(result).length > 0 ? result : null
}

// ── Add / Edit Trade Modal ────────────────────────────────────────────────────
function AddTradeModal({ onClose, onSave, editTrade }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    symbol: '', position: 'LONG', quantity: '',
    entry_price: '', sl: '', tp: '', notes: '',
  })
  const [brokerMsg, setBrokerMsg]           = useState('')
  const [brokerParsed, setBrokerParsed]     = useState(null)
  const [symbolSuggestions, setSymbolSuggestions] = useState([])
  const [slWarning, setSlWarning]           = useState('')
  const [rrRatio, setRrRatio]               = useState(null)
  const [saving, setSaving]                 = useState(false)
  const [showBroker, setShowBroker]         = useState(false)

  useEffect(() => {
    if (editTrade) setForm({ date: editTrade.date, symbol: editTrade.symbol, position: editTrade.position, quantity: editTrade.quantity, entry_price: editTrade.entry_price, sl: editTrade.sl || '', tp: editTrade.tp || '', notes: editTrade.notes || '' })
  }, [editTrade])

  useEffect(() => {
    const e = parseFloat(form.entry_price), s = parseFloat(form.sl), t = parseFloat(form.tp)
    if (e && s && t) { const risk = Math.abs(e - s); setRrRatio(risk > 0 ? (Math.abs(t - e) / risk).toFixed(2) : null) }
    else setRrRatio(null)
    if (e && s) { const d = Math.abs(((e - s) / e) * 100); setSlWarning(d > 10 ? 'SL is more than 10% away — very wide risk' : d < 0.5 ? 'SL is too tight — may get stopped out easily' : '') }
    else setSlWarning('')
  }, [form.entry_price, form.sl, form.tp])

  const handleSymbolInput = (val) => {
    const upper = val.toUpperCase()
    setForm(p => ({ ...p, symbol: upper }))
    setSymbolSuggestions(upper.length >= 1 ? NEPSE_SYMBOLS.filter(s => s.startsWith(upper)).slice(0, 5) : [])
  }

  const handleBrokerParse = () => {
    const parsed = parseBrokerMessage(brokerMsg)
    if (parsed) { setBrokerParsed(parsed); setForm(p => ({ ...p, symbol: parsed.symbol || p.symbol, quantity: parsed.quantity || p.quantity, entry_price: parsed.entry_price || p.entry_price, position: parsed.position || p.position, date: parsed.date || p.date })) }
    else alert('Could not parse broker message. Please enter manually.')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form); onClose() } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const rrColor = rrRatio ? (parseFloat(rrRatio) >= 2 ? 'text-emerald-500' : parseFloat(rrRatio) >= 1 ? 'text-yellow-500' : 'text-red-400') : ''

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader title={editTrade ? 'Edit Trade' : 'Add Trade'} sub="Record with discipline & clarity" onClose={onClose} />
      <div className="p-5 space-y-4">

        {/* Broker paste */}
        <button
          type="button"
          onClick={() => setShowBroker(!showBroker)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          Paste Broker Message
        </button>

        {showBroker && (
          <div className="space-y-2">
            <textarea
              value={brokerMsg}
              onChange={e => setBrokerMsg(e.target.value)}
              placeholder="e.g. you bought RHPL-2000.0@292.74 on 2026-04-09..."
              rows={2}
              className={INPUT + ' resize-none'}
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBrokerParse} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors">
                Extract Data
              </button>
              {brokerParsed && (
                <span className="text-[10px] text-emerald-500">
                  ✓ {brokerParsed.position} {brokerParsed.quantity} {brokerParsed.symbol} @ Rs.{brokerParsed.entry_price}
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={INPUT} required />
            </div>
            <div className="relative">
              <label className={LABEL}>Symbol</label>
              <input
                type="text" value={form.symbol}
                onChange={e => handleSymbolInput(e.target.value)}
                placeholder="NTC" className={INPUT + ' uppercase'} required
              />
              {symbolSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                  {symbolSuggestions.map(s => (
                    <button key={s} type="button" onClick={() => { setForm(p => ({ ...p, symbol: s })); setSymbolSuggestions([]) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">{s}</button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={LABEL}>Position</label>
              <div className="flex gap-1.5">
                {['LONG', 'SHORT'].map(p => (
                  <button key={p} type="button" onClick={() => setForm(prev => ({ ...prev, position: p }))}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-colors ${
                      form.position === p
                        ? p === 'LONG' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >{p === 'LONG' ? '↑ Long' : '↓ Short'}</button>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL}>Quantity</label>
              <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="100" className={INPUT} required />
            </div>

            <div>
              <label className={LABEL}>Entry Price (Rs.)</label>
              <input type="number" step="0.01" value={form.entry_price} onChange={e => setForm(p => ({ ...p, entry_price: e.target.value }))} placeholder="0.00" className={INPUT} required />
            </div>

            <div>
              <label className={LABEL}>Stop Loss <span className="normal-case font-normal text-gray-400">optional</span></label>
              <input type="number" step="0.01" value={form.sl} onChange={e => setForm(p => ({ ...p, sl: e.target.value }))} placeholder="0.00" className={INPUT} />
              {!form.sl && <p className="text-[9px] text-amber-500 mt-1">Set a stop loss to protect capital</p>}
              {slWarning && <p className="text-[9px] text-red-400 mt-1">{slWarning}</p>}
            </div>

            <div>
              <label className={LABEL}>Take Profit <span className="normal-case font-normal text-gray-400">optional</span></label>
              <input type="number" step="0.01" value={form.tp} onChange={e => setForm(p => ({ ...p, tp: e.target.value }))} placeholder="0.00" className={INPUT} />
            </div>
          </div>

          {/* RR badge */}
          {rrRatio && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <span className="text-[10px] text-gray-400">Risk : Reward</span>
              <span className={`text-[13px] font-bold ${rrColor}`}>1 : {rrRatio}</span>
              <span className="text-[10px] text-gray-400 ml-auto">
                {parseFloat(rrRatio) >= 2 ? '✓ Excellent' : parseFloat(rrRatio) >= 1 ? '⚠ Acceptable' : '✕ Poor setup'}
              </span>
            </div>
          )}

          <div>
            <label className={LABEL}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Why are you taking this trade? What's your thesis?" rows={3} className={INPUT + ' resize-none'} />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editTrade ? 'Update Trade' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ── Close Trade Modal ─────────────────────────────────────────────────────────
function CloseTradeModal({ trade, onClose, onSave, isPartial }) {
  const [exitPrice, setExitPrice] = useState('')
  const [exitQty, setExitQty]     = useState('')
  const [reason, setReason]       = useState('target')
  const [saving, setSaving]       = useState(false)

  const remaining = trade.remaining_quantity || trade.quantity
  const pnl = exitPrice
    ? (trade.position === 'LONG'
        ? (parseFloat(exitPrice) - trade.entry_price)
        : (trade.entry_price - parseFloat(exitPrice))
      ) * (isPartial ? parseFloat(exitQty || 0) : remaining)
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isPartial && parseFloat(exitQty) > remaining) { alert(`Cannot close more than ${remaining} shares`); return }
    setSaving(true)
    try { await onSave({ exit_price: parseFloat(exitPrice), exit_quantity: parseFloat(exitQty), reason }); onClose() }
    catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const REASONS = [{ value: 'target', label: 'TP Hit' }, { value: 'stoploss', label: 'SL Hit' }, { value: 'manual', label: 'Manual' }]

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={isPartial ? 'Partial Close' : 'Close Trade'} sub={`${trade.symbol} · ${trade.position} · ${remaining} shares remaining`} onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {isPartial && (
          <div>
            <label className={LABEL}>Qty to close <span className="normal-case font-normal text-gray-400">(max {remaining})</span></label>
            <input type="number" value={exitQty} onChange={e => setExitQty(e.target.value)} placeholder={`Max ${remaining}`} max={remaining} className={INPUT} required />
          </div>
        )}
        <div>
          <label className={LABEL}>Exit Price (Rs.)</label>
          <input type="number" step="0.01" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="0.00" className={INPUT} required />
        </div>

        <div>
          <label className={LABEL}>Reason</label>
          <div className="flex gap-1.5">
            {REASONS.map(r => (
              <button key={r.value} type="button" onClick={() => setReason(r.value)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-medium transition-colors ${
                  reason === r.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {pnl !== null && (
          <div className={`px-4 py-3 rounded-xl text-center ${pnl >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40' : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40'}`}>
            <p className="text-[10px] text-gray-400 mb-0.5">Estimated P&L</p>
            <p className={`text-lg font-bold ${pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}Rs. {Math.round(pnl).toLocaleString()}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className={`flex-1 py-2.5 rounded-xl text-white text-[11px] font-semibold disabled:opacity-50 transition-colors ${isPartial ? 'bg-amber-500 hover:bg-amber-400' : 'bg-red-500 hover:bg-red-400'}`}>
            {saving ? 'Closing…' : isPartial ? 'Partial Close' : 'Close Trade'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Journal Modal ─────────────────────────────────────────────────────────────
function JournalModal({ onClose, onSave, tradeId, tradeName }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], emotional_state: '', market_condition: '', pre_trade_reasoning: '', post_trade_evaluation: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave({ ...form, trade_id: tradeId || null }); onClose() }
    catch (err) { console.error(err) } finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader title="Trade Journal" sub={tradeName ? `Linked to: ${tradeName}` : 'General journal entry'} onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Market Condition</label>
            <div className="flex flex-wrap gap-1">
              {MARKET_CONDITIONS.map(mc => (
                <button key={mc.value} type="button" onClick={() => setForm(p => ({ ...p, market_condition: mc.value }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    form.market_condition === mc.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {mc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={LABEL}>Emotional State</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONAL_STATES.map(es => (
              <button key={es.value} type="button" onClick={() => setForm(p => ({ ...p, emotional_state: es.value }))}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium border transition-all ${
                  form.emotional_state === es.value
                    ? es.pill + ' border-current'
                    : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                }`}>
                {es.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL}>Pre-Trade Reasoning</label>
          <textarea value={form.pre_trade_reasoning} onChange={e => setForm(p => ({ ...p, pre_trade_reasoning: e.target.value }))}
            placeholder="Why did you take this trade? What was your setup?" rows={3} className={INPUT + ' resize-none'} />
        </div>

        <div>
          <label className={LABEL}>Post-Trade Evaluation</label>
          <textarea value={form.post_trade_evaluation} onChange={e => setForm(p => ({ ...p, post_trade_evaluation: e.target.value }))}
            placeholder="How did the trade go? What did you learn?" rows={3} className={INPUT + ' resize-none'} />
        </div>

        <div>
          <label className={LABEL}>Additional Notes</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Any other thoughts..." rows={2} className={INPUT + ' resize-none'} />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Journal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Trade Row ─────────────────────────────────────────────────────────────────
function TradeRow({ trade, onEdit, onClose, onPartialClose, onDelete, onJournal }) {
  const [expanded, setExpanded] = useState(false)
  const remaining = trade.remaining_quantity ?? trade.quantity
  const pnl = trade.realized_pnl || 0
  const isOpen = trade.status === 'OPEN' || trade.status === 'PARTIAL'

  const statusPill = {
    OPEN:    'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
    PARTIAL: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
    CLOSED:  'text-gray-400 bg-gray-100 dark:bg-gray-800',
  }[trade.status] || ''

  return (
    <>
      <tr
        className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-[10px] text-gray-400">{trade.date}</td>
        <td className="px-4 py-3">
          <span className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{trade.symbol}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${trade.position === 'LONG' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'}`}>
            {trade.position === 'LONG' ? '↑ Long' : '↓ Short'}
          </span>
        </td>
        <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400">{remaining}<span className="text-gray-300 dark:text-gray-700">/{trade.quantity}</span></td>
        <td className="px-4 py-3 text-[11px] text-gray-700 dark:text-gray-300 font-medium">Rs.{parseFloat(trade.entry_price).toFixed(2)}</td>
        <td className="px-4 py-3">
          <div className="text-[10px] space-y-0.5">
            {trade.sl && <div className="text-red-400">SL {trade.sl}</div>}
            {trade.tp && <div className="text-emerald-400">TP {trade.tp}</div>}
            {!trade.sl && !trade.tp && <span className="text-gray-300 dark:text-gray-700">—</span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[11px] font-bold ${pnl > 0 ? 'text-emerald-500' : pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {pnl !== 0 ? `${pnl > 0 ? '+' : ''}Rs.${Math.round(pnl).toLocaleString()}` : '—'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusPill}`}>{trade.status}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
            {isOpen && (
              <>
                <button onClick={() => onPartialClose(trade)} title="Partial Close"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors text-[10px] font-bold">½</button>
                <button onClick={() => onClose(trade)} title="Close"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </>
            )}
            <button onClick={() => onJournal(trade)} title="Journal"
              className="w-6 h-6 flex items-center justify-center rounded-lg text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={() => onEdit(trade)} title="Edit"
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={() => onDelete(trade.id)} title="Delete"
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-700 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/50 dark:bg-gray-800/30">
          <td colSpan={9} className="px-4 py-3">
            <div className="flex gap-6 text-[10px]">
              {trade.notes && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{trade.notes}</p>
                </div>
              )}
              {trade.partial_exits?.length > 0 && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Partial Exits</p>
                  {trade.partial_exits.map((pe, i) => (
                    <p key={i} className="text-gray-600 dark:text-gray-300">{pe.exit_quantity} @ Rs.{pe.exit_price} <span className={pe.pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}>({pe.pnl >= 0 ? '+' : ''}Rs.{pe.pnl})</span></p>
                  ))}
                </div>
              )}
              {trade.exit_price && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Exit</p>
                  <p className="text-gray-600 dark:text-gray-300">Rs.{trade.exit_price}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function TraderPage() {
  const { user } = useAuth()
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const [trades, setTrades]         = useState([])
  const [journals, setJournals]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('trades')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTrade, setEditTrade]   = useState(null)
  const [closeTrade, setCloseTrade] = useState(null)
  const [partialTrade, setPartialTrade] = useState(null)
  const [journalTrade, setJournalTrade] = useState(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchSymbol, setSearchSymbol] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [tradesRes, journalsRes] = await Promise.all([getTradeLog(), getTradeJournal()])
      setTrades(tradesRes.data)
      setJournals(journalsRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleAddTrade = async (form) => {
    if (editTrade) { const res = await updateTradeLog(editTrade.id, form); setTrades(prev => prev.map(t => t.id === editTrade.id ? res.data : t)); setEditTrade(null) }
    else { const res = await addTradeLog(form); setTrades(prev => [res.data, ...prev]) }
  }

  const handleCloseTrade    = async ({ exit_price }) => { const res = await closeTradeLog(closeTrade.id, { exit_price }); setTrades(prev => prev.map(t => t.id === closeTrade.id ? res.data : t)); setCloseTrade(null) }
  const handlePartialClose  = async ({ exit_price, exit_quantity, reason }) => { const res = await partialCloseTradeLog(partialTrade.id, { exit_price, exit_quantity, reason }); setTrades(prev => prev.map(t => t.id === partialTrade.id ? res.data : t)); setPartialTrade(null) }
  const handleDelete        = async (id) => { if (!window.confirm('Delete this trade?')) return; await deleteTradeLog(id); setTrades(prev => prev.filter(t => t.id !== id)) }
  const handleAddJournal    = async (form) => { const res = await addTradeJournal(form); setJournals(prev => [res.data, ...prev]); setJournalTrade(null) }
  const handleDeleteJournal = async (id) => { if (!window.confirm('Delete this journal entry?')) return; await deleteTradeJournal(id); setJournals(prev => prev.filter(j => j.id !== id)) }

  const filteredTrades = trades.filter(t => (filterStatus === 'ALL' || t.status === filterStatus) && (!searchSymbol || t.symbol.includes(searchSymbol.toUpperCase())))

  const stats = {
    total: trades.length,
    open: trades.filter(t => t.status === 'OPEN').length,
    partial: trades.filter(t => t.status === 'PARTIAL').length,
    closed: trades.filter(t => t.status === 'CLOSED').length,
    totalPnl: trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0),
    winners: trades.filter(t => (t.realized_pnl || 0) > 0).length,
  }

  if (!user) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center max-w-sm">
        <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-1">{tr('portfolio.loginRequired')}</p>
        <p className="text-[11px] text-gray-400 mb-5">{tr('portfolio.loginMsg')}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">{tr('auth.loginBtn')}</button>
          <button onClick={() => navigate('/signup')} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors">{tr('auth.signupBtn')}</button>
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div className="w-full px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[11px] text-gray-400">Loading trade log…</p>
      </div>
    </div>
  )

  return (
    <div className="w-full px-6 pt-6 pb-10 max-w-7xl mx-auto">

      {/* Modals */}
      {showAddModal    && <AddTradeModal onClose={() => { setShowAddModal(false); setEditTrade(null) }} onSave={handleAddTrade} editTrade={editTrade} />}
      {closeTrade      && <CloseTradeModal trade={closeTrade}   onClose={() => setCloseTrade(null)}   onSave={handleCloseTrade}   isPartial={false} />}
      {partialTrade    && <CloseTradeModal trade={partialTrade} onClose={() => setPartialTrade(null)} onSave={handlePartialClose} isPartial={true} />}
      {journalTrade !== null && <JournalModal onClose={() => setJournalTrade(null)} onSave={handleAddJournal} tradeId={journalTrade?.id} tradeName={journalTrade?.symbol ? `${journalTrade.symbol} ${journalTrade.position}` : null} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{tr('trader.title')}</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{tr('trader.subtitle')}</p>
        </div>
        <button
          onClick={() => { setEditTrade(null); setShowAddModal(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {tr('trader.addTrade')}
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        {[
          { label: tr('trader.totalTrades'), value: stats.total,   color: 'text-gray-900 dark:text-white' },
          { label: tr('trader.open'),        value: stats.open,    color: 'text-blue-500' },
          { label: tr('trader.partial'),     value: stats.partial, color: 'text-amber-500' },
          { label: tr('trader.closed'),      value: stats.closed,  color: 'text-gray-400' },
          { label: tr('trader.winners'),     value: stats.winners, color: 'text-emerald-500' },
          { label: tr('trader.totalPL'),     value: `${stats.totalPnl >= 0 ? '+' : ''}Rs.${Math.round(stats.totalPnl).toLocaleString()}`, color: stats.totalPnl >= 0 ? 'text-emerald-500' : 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 text-center">
            <p className={`text-base font-bold tracking-tight ${s.color}`}>{s.value}</p>
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-4">
        {['trades', 'journal'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            {tab === 'trades' ? tr('trader.tabLog') : tr('trader.tabJournal')}
          </button>
        ))}
        <button onClick={() => setJournalTrade({})}
          className="ml-auto px-3.5 py-1.5 rounded-xl text-[11px] font-medium text-green-500 hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
          + General Journal
        </button>
      </div>

      {/* Trades tab */}
      {activeTab === 'trades' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap">
            <input
              type="text" value={searchSymbol}
              onChange={e => setSearchSymbol(e.target.value)}
              placeholder={tr('trader.searchSymbol')}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-[11px] text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 w-36 transition-colors"
            />
            <div className="flex gap-1">
              {[
                { key: 'ALL', label: tr('trader.all') },
                { key: 'OPEN', label: tr('trader.open') },
                { key: 'PARTIAL', label: tr('trader.partial') },
                { key: 'CLOSED', label: tr('trader.closed') },
              ].map(s => (
                <button key={s.key} onClick={() => setFilterStatus(s.key)}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-colors ${
                    filterStatus === s.key ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400 ml-auto">{filteredTrades.length} trades · click row to expand</span>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <p className="text-[12px] text-gray-400">{tr('trader.noTrades')}</p>
              <p className="text-[10px] text-gray-400 mt-1">{tr('trader.noTradesHint')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    {['Date', 'Symbol', 'Position', 'Qty', 'Entry', 'SL / TP', 'P&L', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map(trade => (
                    <TradeRow key={trade.id} trade={trade}
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

      {/* Journal tab */}
      {activeTab === 'journal' && (
        <div>
          {journals.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-14 text-center">
              <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <p className="text-[12px] text-gray-400">No journal entries yet</p>
              <p className="text-[10px] text-gray-400 mt-1">Add a journal from a trade or click "+ General Journal"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {journals.map((j, idx) => {
                const emotion = EMOTIONAL_STATES.find(e => e.value === j.emotional_state)
                const market  = MARKET_CONDITIONS.find(m => m.value === j.market_condition)
                const linked  = trades.find(t => t.id === j.trade_id)
                return (
                  <div key={j.id}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 flex flex-col gap-2 group hover:border-gray-200 dark:hover:border-gray-700 transition-colors animate-fade-up"
                    style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] text-gray-400">{j.date}</span>
                        {emotion && <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${emotion.pill}`}>{emotion.label}</span>}
                        {market  && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">{market.label}</span>}
                        {linked  && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500">{linked.symbol}</span>}
                      </div>
                      <button onClick={() => handleDeleteJournal(j.id)}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-700 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    {(j.pre_trade_reasoning || j.post_trade_evaluation || j.notes) && (
                      <div className="space-y-1.5">
                        {j.pre_trade_reasoning && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Pre-Trade</p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">{j.pre_trade_reasoning}</p>
                          </div>
                        )}
                        {j.post_trade_evaluation && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Post-Trade</p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">{j.post_trade_evaluation}</p>
                          </div>
                        )}
                        {j.notes && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Notes</p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">{j.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TraderPage
