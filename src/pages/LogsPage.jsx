import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import {
  getTradeLog, addTradeLog, updateTradeLog,
  closeTradeLog, partialCloseTradeLog, deleteTradeLog, bulkDeleteTradeLog,
  getTradeJournal, addTradeJournal, updateTradeJournal, deleteTradeJournal,
  getStockPrice
} from '../api'
import { useContextMenu } from '../components/ContextMenu'
import { useChatRefresh, dispatchDebrief } from '../utils/chatEvents'
import { getTradeDebrief, getWhatIf, getRules, addRule, updateRule, deleteRule, getRuleViolations, getTaxReport, getBenchmarkCompare, benchmarkContribute, benchmarkOptOut } from '../api'

// ── Constants ─────────────────────────────────────────────────────────────────

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
  { value: 'confident', label: '💪 Confident', dot: 'bg-blue-400',   pill: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',   accent: 'border-blue-400' },
  { value: 'calm',      label: '😌 Calm',      dot: 'bg-emerald-400',pill: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400', accent: 'border-emerald-400' },
  { value: 'anxious',   label: '😰 Anxious',   dot: 'bg-yellow-400', pill: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400', accent: 'border-yellow-400' },
  { value: 'fearful',   label: '😨 Fearful',   dot: 'bg-orange-400', pill: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400', accent: 'border-orange-400' },
  { value: 'greedy',    label: '🤑 Greedy',    dot: 'bg-red-400',    pill: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400',       accent: 'border-red-400' },
  { value: 'fomo',      label: '😱 FOMO',      dot: 'bg-purple-400', pill: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400', accent: 'border-purple-400' },
  { value: 'neutral',   label: '😐 Neutral',   dot: 'bg-gray-400',   pill: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',     accent: 'border-gray-400' },
]

const MARKET_CONDITIONS = [
  { value: 'bullish',    label: '↑ Bullish' },
  { value: 'bearish',    label: '↓ Bearish' },
  { value: 'sideways',   label: '→ Sideways' },
  { value: 'volatile',   label: '⚡ Volatile' },
  { value: 'low_volume', label: '○ Low Vol' },
]

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT = 'w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-[12px] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all'
const LABEL = 'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5'

const SETUP_TAGS = ['Breakout', 'Pullback', 'Reversal', 'IPO Entry', 'Rights Entry', 'FOMO', 'Fundamental', 'Other']
const SETUP_TAG_STYLE = {
  Breakout:      'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400',
  Pullback:      'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40 text-violet-600 dark:text-violet-400',
  Reversal:      'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400',
  'IPO Entry':   'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400',
  'Rights Entry':'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/40 text-teal-600 dark:text-teal-400',
  FOMO:          'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-500 dark:text-red-400',
  Fundamental:   'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400',
  Other:         'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 w-full ${wide ? 'max-w-xl' : 'max-w-sm'} max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, sub, onClose }) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800/80">
      <div>
        <p className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">{title}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={onClose}
        className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all mt-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Broker message parser ─────────────────────────────────────────────────────

function parseBrokerMessage(msg) {
  if (!msg) return null
  const result = {}
  const buyMatch  = msg.match(/bought\s+([\w-]+)[- ]([\d.]+)@([\d.]+)/i)
  const sellMatch = msg.match(/sold\s+([\w-]+)[- ]?([\d.]+)@([\d.]+)/i)
  if (buyMatch) {
    result.symbol      = buyMatch[1].replace(/-\d+$/, '').toUpperCase()
    result.quantity    = parseFloat(buyMatch[2])
    result.entry_price = parseFloat(buyMatch[3])
    result.position    = 'LONG'
  } else if (sellMatch) {
    result.symbol      = sellMatch[1].replace(/-\d+$/, '').toUpperCase()
    result.quantity    = parseFloat(sellMatch[2])
    result.entry_price = parseFloat(sellMatch[3])
    result.position    = 'SHORT'
  }
  const dateMatch = msg.match(/on (\d{4}-\d{2}-\d{2})/i)
  if (dateMatch) result.date = dateMatch[1]
  return Object.keys(result).length > 0 ? result : null
}

// ── Pre-Trade Checklist ───────────────────────────────────────────────────────

const DEFAULT_CHECKLIST = [
  'Is there a clear setup? (breakout, pullback, reversal)',
  'Is the stop-loss level defined before entry?',
  'Is the R:R at least 1:2?',
  'Is position size within risk limits (≤2% of capital)?',
  'Am I trading from logic, not FOMO or revenge?',
]

const CHECKLIST_KEY = 'tradeo_checklist_items'

function loadChecklistItems() {
  try {
    const saved = localStorage.getItem(CHECKLIST_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_CHECKLIST
}

function saveChecklistItems(items) {
  try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items)) } catch {}
}

function ChecklistModal({ onPass, onClose }) {
  const [items,   setItems]   = useState(loadChecklistItems)
  const [checked, setChecked] = useState([])
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')

  const allChecked = items.length > 0 && checked.length === items.length

  const toggle = (i) => setChecked(prev =>
    prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
  )

  const handlePass = () => {
    if (!allChecked) return
    onPass(checked.map(i => items[i]))
  }

  const handleSaveEdit = () => {
    const updated = draft.split('\n').map(s => s.trim()).filter(Boolean)
    if (updated.length === 0) return
    setItems(updated)
    saveChecklistItems(updated)
    setChecked([])
    setEditing(false)
  }

  const handleSkip = () => onPass([])  // pass with empty — no checklist enforcement

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">Pre-Trade Checklist</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Check all before entering a trade</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setEditing(e => !e); setDraft(items.join('\n')) }}
              className="text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-2.5 max-h-80 overflow-y-auto">
          {editing ? (
            <div>
              <p className="text-[9px] text-gray-400 mb-1.5">One item per line</p>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={8}
                className="w-full text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-400 resize-none"
              />
              <button onClick={handleSaveEdit}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-xl py-2 transition-colors">
                Save Items
              </button>
            </div>
          ) : (
            items.map((item, i) => (
              <button key={i} onClick={() => toggle(i)}
                className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border transition-all ${
                  checked.includes(i)
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                  checked.includes(i)
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {checked.includes(i) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-[11px] leading-snug ${checked.includes(i) ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70' : 'text-gray-700 dark:text-gray-300'}`}>
                  {item}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {!editing && (
          <div className="px-5 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
            {/* Progress */}
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] text-gray-400">{checked.length}/{items.length} checked</span>
                {allChecked && <span className="text-[9px] text-emerald-500 font-semibold">Ready to trade</span>}
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${allChecked ? 'bg-emerald-500' : 'bg-amber-400'}`}
                  style={{ width: `${items.length > 0 ? (checked.length / items.length) * 100 : 0}%` }} />
              </div>
            </div>
            <button onClick={handleSkip}
              className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
              Skip
            </button>
            <button onClick={handlePass} disabled={!allChecked}
              className={`px-4 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                allChecked
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              }`}>
              Proceed →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add / Edit Trade Modal ────────────────────────────────────────────────────

function AddTradeModal({ onClose, onSave, editTrade, openTrades = [] }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    symbol: '', position: 'LONG', quantity: '',
    entry_price: '', sl: '', tp: '', notes: '', setup_tag: '', entry_reason: '',
  })
  const [brokerMsg, setBrokerMsg]               = useState('')
  const [brokerParsed, setBrokerParsed]         = useState(null)
  const [symbolSuggestions, setSymbolSuggestions] = useState([])
  const [slWarning, setSlWarning]               = useState('')
  const [rrRatio, setRrRatio]                   = useState(null)
  const [saving, setSaving]                     = useState(false)
  const [saveErr, setSaveErr]                   = useState(null)
  const [showBroker, setShowBroker]             = useState(false)

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
        setup_tag: editTrade.setup_tag || '',
        entry_reason: editTrade.entry_reason || '',
      })
    }
  }, [editTrade])

  useEffect(() => {
    const e = parseFloat(form.entry_price)
    const s = parseFloat(form.sl)
    const t = parseFloat(form.tp)
    if (e && s && t) {
      const risk = Math.abs(e - s)
      setRrRatio(risk > 0 ? (Math.abs(t - e) / risk).toFixed(2) : null)
    } else {
      setRrRatio(null)
    }
    if (e && s) {
      const d = Math.abs(((e - s) / e) * 100)
      setSlWarning(d > 10 ? 'SL is more than 10% away — very wide risk' : d < 0.5 ? 'SL is too tight — may get stopped out easily' : '')
    } else {
      setSlWarning('')
    }
  }, [form.entry_price, form.sl, form.tp])

  const handleSymbolInput = (val) => {
    const upper = val.toUpperCase()
    setForm(p => ({ ...p, symbol: upper }))
    setSymbolSuggestions(upper.length >= 1 ? NEPSE_SYMBOLS.filter(s => s.startsWith(upper)).slice(0, 5) : [])
  }

  const handleBrokerParse = () => {
    const parsed = parseBrokerMessage(brokerMsg)
    if (parsed) {
      setBrokerParsed(parsed)
      setForm(p => ({
        ...p,
        symbol:      parsed.symbol      || p.symbol,
        quantity:    parsed.quantity    || p.quantity,
        entry_price: parsed.entry_price || p.entry_price,
        position:    parsed.position    || p.position,
        date:        parsed.date        || p.date,
      }))
    } else {
      alert('Could not parse broker message. Please enter manually.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setSaveErr(null)
    try { await onSave(form); onClose() }
    catch (err) { setSaveErr(err.response?.data?.error || 'Failed to save trade') }
    finally { setSaving(false) }
  }

  const rrVal = parseFloat(rrRatio)
  const rrColor = rrRatio
    ? rrVal >= 2 ? 'text-emerald-500' : rrVal >= 1 ? 'text-amber-500' : 'text-red-400'
    : ''
  const rrBg = rrRatio
    ? rrVal >= 2 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
    : rrVal >= 1 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
    : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
    : ''
  const rrLabel = rrRatio ? (rrVal >= 2 ? 'Excellent setup' : rrVal >= 1 ? 'Acceptable setup' : 'Poor setup') : ''

  // Duplicate symbol detection — find existing OPEN/PARTIAL trades for same symbol (excluding self when editing)
  const duplicates = !editTrade && form.symbol.length >= 2
    ? openTrades.filter(t =>
        t.symbol === form.symbol &&
        (t.status === 'OPEN' || t.status === 'PARTIAL')
      )
    : []
  const dupTotalQty    = duplicates.reduce((s, t) => s + (t.remaining_quantity ?? t.quantity), 0)
  const dupWeightedAvg = duplicates.length > 0
    ? duplicates.reduce((s, t) => s + parseFloat(t.entry_price) * (t.remaining_quantity ?? t.quantity), 0) / dupTotalQty
    : null

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader
        title={editTrade ? 'Edit Trade' : 'Log New Trade'}
        sub={editTrade ? `Editing ${editTrade.symbol}` : 'Record your entry with precision'}
        onClose={onClose}
      />
      <div className="p-5 space-y-4">

        {/* Broker paste toggle */}
        <button
          type="button"
          onClick={() => setShowBroker(!showBroker)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-[11px] text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {showBroker ? 'Hide broker paste' : 'Paste broker message'}
        </button>

        {showBroker && (
          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <textarea
              value={brokerMsg}
              onChange={e => setBrokerMsg(e.target.value)}
              placeholder="e.g. you bought RHPL-2000.0@292.74 on 2026-04-09..."
              rows={2}
              className={INPUT + ' resize-none bg-white dark:bg-gray-900'}
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBrokerParse}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors">
                Extract Data
              </button>
              {brokerParsed && (
                <span className="text-[10px] text-emerald-500 font-medium">
                  ✓ {brokerParsed.position} {brokerParsed.quantity} {brokerParsed.symbol} @ Rs.{brokerParsed.entry_price}
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Row 1: Date + Symbol */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className={INPUT} required />
            </div>
            <div className="relative">
              <label className={LABEL}>Symbol</label>
              <input
                type="text" value={form.symbol}
                onChange={e => handleSymbolInput(e.target.value)}
                placeholder="NTC" className={INPUT + ' uppercase font-semibold tracking-widest'} required
              />
              {symbolSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden">
                  {symbolSuggestions.map(s => (
                    <button key={s} type="button"
                      onClick={() => { setForm(p => ({ ...p, symbol: s })); setSymbolSuggestions([]) }}
                      className="w-full text-left px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200 tracking-wider hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Position toggle */}
          <div>
            <label className={LABEL}>Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {['LONG', 'SHORT'].map(p => (
                <button key={p} type="button"
                  onClick={() => setForm(prev => ({ ...prev, position: p }))}
                  className={`py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all ${
                    form.position === p
                      ? p === 'LONG'
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30'
                        : 'bg-red-500 text-white shadow-sm shadow-red-200 dark:shadow-red-900/30'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {p === 'LONG' ? '↑ Long' : '↓ Short'}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Qty + Entry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Quantity</label>
              <input type="number" value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="100" className={INPUT} required />
            </div>
            <div>
              <label className={LABEL}>Entry Price <span className="normal-case text-gray-300 font-normal">Rs.</span></label>
              <input type="number" step="0.01" value={form.entry_price}
                onChange={e => setForm(p => ({ ...p, entry_price: e.target.value }))}
                placeholder="0.00" className={INPUT} required />
            </div>
          </div>

          {/* Row 4: SL + TP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Stop Loss <span className="normal-case font-normal text-gray-300">optional</span></label>
              <input type="number" step="0.01" value={form.sl}
                onChange={e => setForm(p => ({ ...p, sl: e.target.value }))}
                placeholder="0.00" className={INPUT} />
              {!form.sl && (
                <p className="text-[9px] text-amber-500 mt-1.5 font-medium">Always define your risk</p>
              )}
              {slWarning && (
                <p className="text-[9px] text-red-400 mt-1.5">{slWarning}</p>
              )}
            </div>
            <div>
              <label className={LABEL}>Take Profit <span className="normal-case font-normal text-gray-300">optional</span></label>
              <input type="number" step="0.01" value={form.tp}
                onChange={e => setForm(p => ({ ...p, tp: e.target.value }))}
                placeholder="0.00" className={INPUT} />
            </div>
          </div>

          {/* Duplicate symbol warning */}
          {duplicates.length > 0 && (
            <div className="flex gap-3 px-3.5 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <span className="text-amber-500 text-[14px] flex-shrink-0 mt-0.5">⚠</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  You already have {duplicates.length} open {form.symbol} position{duplicates.length > 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
                  {dupTotalQty} units · Avg entry Rs.{dupWeightedAvg?.toFixed(2) ?? '—'} · Adding a separate entry row
                </p>
              </div>
            </div>
          )}

          {/* R:R badge */}
          {rrRatio && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${rrBg}`}>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Risk : Reward</p>
                <p className={`text-[18px] font-black tracking-tight ${rrColor}`}>1 : {rrRatio}</p>
              </div>
              <div className="ml-auto text-right">
                <p className={`text-[11px] font-semibold ${rrColor}`}>{rrLabel}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Target ≥ 1:2</p>
              </div>
            </div>
          )}

          {/* Setup Tag */}
          <div>
            <label className={LABEL}>Setup Type <span className="normal-case font-normal text-gray-300">optional</span></label>
            <select
              value={form.setup_tag}
              onChange={e => setForm(p => ({ ...p, setup_tag: e.target.value }))}
              className={INPUT + ' cursor-pointer'}
            >
              <option value="">— None —</option>
              {SETUP_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Decision Log: Why */}
          <div>
            <label className={LABEL}>
              Why I'm taking this trade
              <span className="normal-case font-normal text-gray-300 ml-1">decision log</span>
            </label>
            <textarea value={form.entry_reason}
              onChange={e => setForm(p => ({ ...p, entry_reason: e.target.value }))}
              placeholder="e.g. Breakout above 52-week high on 2x volume, sector rotating into banking, SL at swing low 3%"
              rows={2} className={INPUT + ' resize-none leading-relaxed'} />
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Trade Thesis <span className="normal-case font-normal text-gray-300">optional deeper notes</span></label>
            <textarea value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Technical confluence, fundamentals, news catalyst..."
              rows={2} className={INPUT + ' resize-none leading-relaxed'} />
          </div>

          {/* Actions */}
          {saveErr && (
            <p className="text-[11px] text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">
              {saveErr}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editTrade ? 'Update Trade' : 'Log Trade'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ── Close Trade Modal ─────────────────────────────────────────────────────────

function CloseTradeModal({ trade, onClose, onSave, isPartial }) {
  const [exitPrice, setExitPrice]           = useState('')
  const [exitQty, setExitQty]               = useState('')
  const [reason, setReason]                 = useState('target')
  const [exitReflection, setExitReflection] = useState('')
  const [mfe, setMfe]                       = useState('')
  const [mae, setMae]                       = useState('')
  const [saving, setSaving]                 = useState(false)

  // P2-008: remaining_quantity is a Supabase string — parseInt to avoid silent coercion in arithmetic
  const remaining = parseInt(trade.remaining_quantity ?? trade.quantity) || 0

  const entryPrice = parseFloat(trade.entry_price)
  const pnlPreview = exitPrice
    ? (trade.position === 'LONG'
        ? (parseFloat(exitPrice) - entryPrice)
        : (entryPrice - parseFloat(exitPrice))
      ) * (isPartial ? parseFloat(exitQty || 0) : remaining)
    : null

  const [closeErr, setCloseErr] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isPartial && parseFloat(exitQty) > remaining) {
      setCloseErr(`Cannot close more than ${remaining} units`)
      return
    }
    setSaving(true)
    setCloseErr(null)
    try {
      await onSave({
        exit_price: parseFloat(exitPrice),
        exit_quantity: parseFloat(exitQty),
        reason,
        exit_reflection: exitReflection || null,
        mfe: mfe !== '' ? parseFloat(mfe) : null,
        mae: mae !== '' ? parseFloat(mae) : null,
      })
      onClose()
    } catch (err) {
      setCloseErr(err.response?.data?.error || 'Failed to close trade')
    } finally {
      setSaving(false)
    }
  }

  const REASONS = [
    { value: 'target',   label: 'TP Hit',  icon: '✓' },
    { value: 'stoploss', label: 'SL Hit',  icon: '✕' },
    { value: 'manual',   label: 'Manual',  icon: '⊙' },
  ]

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        title={isPartial ? 'Partial Close' : 'Close Trade'}
        sub={`${trade.symbol} · ${trade.position} · ${remaining} units @ Rs.${entryPrice.toFixed(2)}`}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        {isPartial && (
          <div>
            <label className={LABEL}>Units to close <span className="normal-case font-normal text-gray-300">(max {remaining})</span></label>
            <input type="number" value={exitQty}
              onChange={e => setExitQty(e.target.value)}
              placeholder={`1 – ${remaining}`} max={remaining} min={1}
              className={INPUT} required />
          </div>
        )}

        <div>
          <label className={LABEL}>Exit Price <span className="normal-case font-normal text-gray-300">Rs.</span></label>
          <input type="number" step="0.01" value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            placeholder="0.00" className={INPUT} required />
        </div>

        <div>
          <label className={LABEL}>Close Reason</label>
          <div className="grid grid-cols-3 gap-1.5">
            {REASONS.map(r => (
              <button key={r.value} type="button" onClick={() => setReason(r.value)}
                className={`py-2 rounded-lg text-[11px] font-semibold transition-all ${
                  reason === r.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}>
                <span className="block text-[13px] mb-0.5">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* P&L preview */}
        {pnlPreview !== null && (
          <div className={`px-4 py-4 rounded-xl text-center ${
            pnlPreview >= 0
              ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-800/30'
              : 'bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30'
          }`}>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Estimated P&L</p>
            <p className={`text-2xl font-black tracking-tight ${pnlPreview >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {pnlPreview >= 0 ? '+' : '−'}Rs.{Math.abs(Math.round(pnlPreview)).toLocaleString()}
            </p>
          </div>
        )}

        {/* MFE / MAE — only for full closes */}
        {!isPartial && (
          <div className="space-y-2">
            <p className={LABEL}>Price extremes during hold <span className="normal-case font-normal text-gray-300">optional</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-semibold text-emerald-500 mb-1">MFE — Highest price seen</label>
                <input
                  type="number" step="0.01" value={mfe}
                  onChange={e => setMfe(e.target.value)}
                  placeholder="e.g. 325.00"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-red-400 mb-1">MAE — Lowest price seen</label>
                <input
                  type="number" step="0.01" value={mae}
                  onChange={e => setMae(e.target.value)}
                  placeholder="e.g. 280.00"
                  className={INPUT}
                />
              </div>
            </div>
            <p className="text-[9px] text-gray-300 dark:text-gray-700">
              Helps calibrate where to set TP and how tight your SL should be.
            </p>
          </div>
        )}

        {/* Exit reflection — only for full closes */}
        {!isPartial && (
          <div>
            <label className={LABEL}>
              What happened? What would you do differently?
              <span className="normal-case font-normal text-gray-300 ml-1">decision log</span>
            </label>
            <textarea
              value={exitReflection}
              onChange={e => setExitReflection(e.target.value)}
              placeholder="e.g. Hit TP cleanly. Should have held longer — stock ran 5% more after exit. Entry timing was good."
              rows={2} className={INPUT + ' resize-none leading-relaxed'}
            />
          </div>
        )}

        {closeErr && (
          <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-3 py-2">
            {closeErr}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-white text-[11px] font-semibold disabled:opacity-50 transition-colors ${
              isPartial ? 'bg-amber-500 hover:bg-amber-400' : 'bg-red-500 hover:bg-red-400'
            }`}>
            {saving ? 'Closing…' : isPartial ? 'Partial Close' : 'Close Position'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Journal Modal ─────────────────────────────────────────────────────────────

function JournalModal({ onClose, onSave, tradeId, tradeName, editJournal }) {
  const [form, setForm] = useState({
    date:                  editJournal?.date                  || new Date().toISOString().split('T')[0],
    emotional_state:       editJournal?.emotional_state       || '',
    market_condition:      editJournal?.market_condition      || '',
    pre_trade_reasoning:   editJournal?.pre_trade_reasoning   || '',
    post_trade_evaluation: editJournal?.post_trade_evaluation || '',
    notes:                 editJournal?.notes                 || '',
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
    <Modal onClose={onClose} wide>
      <ModalHeader
        title={editJournal ? 'Edit Journal Entry' : 'Journal Entry'}
        sub={tradeName ? `Linked to ${tradeName}` : 'General market reflection'}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        {/* Date + Market Condition */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Date</label>
            <input type="date" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Market</label>
            <div className="flex flex-wrap gap-1">
              {MARKET_CONDITIONS.map(mc => (
                <button key={mc.value} type="button"
                  onClick={() => setForm(p => ({ ...p, market_condition: p.market_condition === mc.value ? '' : mc.value }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    form.market_condition === mc.value
                      ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {mc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Emotional state */}
        <div>
          <label className={LABEL}>Emotional State</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONAL_STATES.map(es => (
              <button key={es.value} type="button"
                onClick={() => setForm(p => ({ ...p, emotional_state: p.emotional_state === es.value ? '' : es.value }))}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                  form.emotional_state === es.value
                    ? es.pill + ' border-current shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800/80 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                }`}>
                {es.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pre-trade */}
        <div>
          <label className={LABEL}>Pre-Trade Reasoning</label>
          <textarea value={form.pre_trade_reasoning}
            onChange={e => setForm(p => ({ ...p, pre_trade_reasoning: e.target.value }))}
            placeholder="Why did you take this trade? What was your setup, confluence, catalyst?"
            rows={3} className={INPUT + ' resize-none leading-relaxed'} />
        </div>

        {/* Post-trade */}
        <div>
          <label className={LABEL}>Post-Trade Evaluation</label>
          <textarea value={form.post_trade_evaluation}
            onChange={e => setForm(p => ({ ...p, post_trade_evaluation: e.target.value }))}
            placeholder="How did it play out? Did you follow your plan? What would you do differently?"
            rows={3} className={INPUT + ' resize-none leading-relaxed'} />
        </div>

        {/* Notes */}
        <div>
          <label className={LABEL}>Additional Notes</label>
          <textarea value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Market observations, lessons learned..."
            rows={2} className={INPUT + ' resize-none leading-relaxed'} />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : editJournal ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────

const CSV_TEMPLATE = `date,symbol,position,quantity,entry_price,sl,tp,notes
2026-04-01,NTC,LONG,100,975.50,920,1050,Breakout setup
2026-04-02,NABIL,SHORT,50,1240.00,1280,,Resistance rejection`

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' }

  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const required   = ['date', 'symbol', 'position', 'quantity', 'entry_price']
  const missing    = required.filter(r => !rawHeaders.includes(r))
  if (missing.length > 0) return { rows: [], error: `Missing required columns: ${missing.join(', ')}` }

  const rows = lines.slice(1).map((line, idx) => {
    // Handle quoted fields
    const cols = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
      else { cur += ch }
    }
    cols.push(cur)

    const get = (key) => {
      const i = rawHeaders.indexOf(key)
      return i >= 0 ? (cols[i] || '').trim() : ''
    }

    const errors = []
    const date   = get('date')
    const symbol = get('symbol').toUpperCase()
    const pos    = get('position').toUpperCase()
    const qty    = parseFloat(get('quantity'))
    const entry  = parseFloat(get('entry_price'))
    const sl     = get('sl')   ? parseFloat(get('sl'))   : null
    const tp     = get('tp')   ? parseFloat(get('tp'))   : null
    const notes  = get('notes') || ''

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))    errors.push('Invalid date (need YYYY-MM-DD)')
    if (!symbol)                                          errors.push('Missing symbol')
    if (!['LONG', 'SHORT'].includes(pos))                errors.push('Position must be LONG or SHORT')
    if (isNaN(qty) || qty <= 0)                          errors.push('Invalid quantity')
    if (isNaN(entry) || entry <= 0)                      errors.push('Invalid entry_price')

    return { _row: idx + 2, date, symbol, position: pos, quantity: qty, entry_price: entry, sl, tp, notes, errors, _import: errors.length === 0 }
  }).filter(r => r.symbol || r.date) // skip truly blank lines

  return { rows, error: null }
}

function ImportCSVModal({ onClose, onImport }) {
  const [step,     setStep]     = useState('input')   // 'input' | 'preview' | 'importing' | 'done'
  const [csvText,  setCsvText]  = useState('')
  const [rows,     setRows]     = useState([])
  const [parseErr, setParseErr] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target.result)
    reader.readAsText(file)
  }

  const handleParse = () => {
    const { rows: parsed, error } = parseCSV(csvText)
    if (error) { setParseErr(error); return }
    if (parsed.length === 0) { setParseErr('No data rows found.'); return }
    setParseErr('')
    setRows(parsed)
    setStep('preview')
  }

  const toggleRow = (idx) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, _import: !r._import && r.errors.length === 0 } : r))
  }

  const handleImport = async () => {
    const toImport = rows.filter(r => r._import)
    if (toImport.length === 0) return
    setStep('importing')
    setProgress({ done: 0, total: toImport.length, failed: 0 })

    // P2-009: batch requests in groups of 10 (parallel within each batch)
    // instead of 500 sequential awaits
    const BATCH = 10
    let done = 0
    let failed = 0
    for (let i = 0; i < toImport.length; i += BATCH) {
      const batch = toImport.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(r => onImport({
        date: r.date, symbol: r.symbol, position: r.position,
        quantity: r.quantity, entry_price: r.entry_price,
        sl: r.sl || null, tp: r.tp || null, notes: r.notes || null,
      })))
      failed += results.filter(r => r.status === 'rejected').length
      done   += batch.length
      setProgress({ done, total: toImport.length, failed })
    }
    setStep('done')
    setProgress(p => ({ ...p, failed }))
  }

  const validCount   = rows.filter(r => r.errors.length === 0).length
  const selectedCount = rows.filter(r => r._import).length
  const errorCount   = rows.filter(r => r.errors.length > 0).length

  return (
    <Modal onClose={step === 'importing' ? undefined : onClose} wide>
      <ModalHeader
        title="Import Trades from CSV"
        sub={step === 'input' ? 'Upload a file or paste CSV text below' : step === 'preview' ? `${rows.length} rows parsed · ${errorCount} errors` : step === 'done' ? 'Import complete' : 'Importing…'}
        onClose={step === 'importing' ? undefined : onClose}
      />

      <div className="p-5 space-y-4">

        {/* ── Step: Input ── */}
        {step === 'input' && (
          <>
            {/* Template download */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">CSV Format</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Required: date, symbol, position, quantity, entry_price</p>
              </div>
              <button
                onClick={() => {
                  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement('a')
                  a.href = url; a.download = 'tradeo-template.csv'; a.click()
                  URL.revokeObjectURL(url)
                }}
                className="text-[10px] font-semibold text-blue-500 hover:text-blue-400 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              >
                Download template
              </button>
            </div>

            {/* File upload */}
            <div>
              <label className={LABEL}>Upload CSV file</label>
              <input
                type="file" accept=".csv,text/csv"
                onChange={handleFile}
                className="w-full text-[11px] text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-600 dark:file:bg-blue-900/20 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30 transition-all cursor-pointer"
              />
            </div>

            {/* Or paste */}
            <div>
              <label className={LABEL}>Or paste CSV text</label>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={CSV_TEMPLATE}
                rows={6}
                className={INPUT + ' resize-none font-mono text-[10px] leading-relaxed'}
              />
            </div>

            {parseErr && (
              <p className="text-[11px] text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">
                {parseErr}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!csvText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-40 transition-colors"
              >
                Parse CSV
              </button>
            </div>
          </>
        )}

        {/* ── Step: Preview ── */}
        {step === 'preview' && (
          <>
            {/* Summary pills */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                {validCount} valid
              </span>
              {errorCount > 0 && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500">
                  {errorCount} with errors (will be skipped)
                </span>
              )}
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                {selectedCount} selected to import
              </span>
            </div>

            {/* Preview table */}
            <div className="max-h-64 overflow-y-auto no-scrollbar rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['✓', 'Row', 'Date', 'Symbol', 'Pos', 'Qty', 'Entry', 'SL', 'TP'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {rows.map((r, idx) => (
                    <tr
                      key={idx}
                      onClick={() => toggleRow(idx)}
                      className={`cursor-pointer transition-colors ${
                        r.errors.length > 0
                          ? 'bg-red-50/50 dark:bg-red-900/10'
                          : r._import
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                          : 'opacity-40 hover:opacity-60'
                      }`}
                    >
                      <td className="px-2.5 py-2">
                        {r.errors.length > 0
                          ? <span className="text-red-400">✕</span>
                          : <span className={r._import ? 'text-emerald-500' : 'text-gray-300'}>✓</span>
                        }
                      </td>
                      <td className="px-2.5 py-2 text-gray-400">{r._row}</td>
                      <td className="px-2.5 py-2 tabular-nums text-gray-600 dark:text-gray-300">{r.date}</td>
                      <td className="px-2.5 py-2 font-bold text-gray-800 dark:text-white tracking-wide">{r.symbol}</td>
                      <td className={`px-2.5 py-2 font-semibold ${r.position === 'LONG' ? 'text-emerald-500' : 'text-red-400'}`}>{r.position}</td>
                      <td className="px-2.5 py-2 tabular-nums text-gray-600 dark:text-gray-300">{r.quantity}</td>
                      <td className="px-2.5 py-2 tabular-nums text-gray-600 dark:text-gray-300">{r.entry_price}</td>
                      <td className="px-2.5 py-2 tabular-nums text-red-400">{r.sl || '—'}</td>
                      <td className="px-2.5 py-2 tabular-nums text-emerald-500">{r.tp || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Error details */}
            {errorCount > 0 && (
              <div className="space-y-1">
                {rows.filter(r => r.errors.length > 0).map((r, i) => (
                  <p key={i} className="text-[10px] text-red-400">
                    Row {r._row}: {r.errors.join(' · ')}
                  </p>
                ))}
              </div>
            )}

            <p className="text-[10px] text-gray-400">Click a row to toggle selection. Rows with errors cannot be imported.</p>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('input')} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-40 transition-colors"
              >
                Import {selectedCount} trade{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {/* ── Step: Importing ── */}
        {step === 'importing' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-white">
                Importing {progress.done} / {progress.total}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Please wait…</p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-white">
                {progress.total - progress.failed} trade{progress.total - progress.failed !== 1 ? 's' : ''} imported
              </p>
              {progress.failed > 0 && (
                <p className="text-[11px] text-red-400 mt-1">{progress.failed} failed to save</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </Modal>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tradeDuration(dateStr) {
  // Compare date strings directly to avoid UTC vs local timezone mismatch
  // (new Date('YYYY-MM-DD') parses as UTC midnight, but new Date() is local time)
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'
  const start = new Date(dateStr)
  const now   = new Date(today)
  const days  = Math.round((now - start) / 86400000)
  if (days === 1) return '1d'
  return `${days}d`
}

// ── Tax Panel ─────────────────────────────────────────────────────────────────

function TaxPanel() {
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [fy, setFy]           = useState(null)         // null = default (current FY)
  const [availFYs, setAvailFYs] = useState([])
  const [error, setError]     = useState(null)
  const [exporting, setExporting] = useState(false)

  const fetchReport = useCallback(async (fiscalYear) => {
    try {
      setLoading(true)
      setError(null)
      const res = await getTaxReport(fiscalYear || undefined)
      setReport(res.data)
      if (res.data.available_years?.length) setAvailFYs(res.data.available_years)
      if (!fiscalYear) setFy(res.data.fy)
    } catch {
      setError('Failed to load tax report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport(null) }, [fetchReport])

  const handleFyChange = (e) => {
    setFy(e.target.value)
    fetchReport(e.target.value)
  }

  // PDF export via browser print API
  const handleExport = () => {
    if (!report) return
    setExporting(true)

    const { summary: s, trades, fy: fyLabel, fy_start, fy_end } = report
    const rows = trades.map(t => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td>${t.symbol}</td>
        <td>${t.position}</td>
        <td>${t.quantity}</td>
        <td>${t.entry_date}</td>
        <td>${t.close_date}</td>
        <td>${t.held_days}d</td>
        <td style="color:${t.term === 'Long-term' ? '#059669' : '#d97706'}">${t.term} (${t.rate_pct}%)</td>
        <td>Rs.${t.entry_price.toLocaleString()}</td>
        <td>Rs.${t.exit_price.toLocaleString()}</td>
        <td style="color:${t.realized_pnl >= 0 ? '#059669' : '#dc2626'}">${t.realized_pnl >= 0 ? '+' : ''}Rs.${Math.round(t.realized_pnl).toLocaleString()}</td>
        <td style="color:#dc2626;font-weight:600">Rs.${t.tax.toLocaleString()}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Tradeo · CGT Report FY ${fyLabel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .sub { color: #6b7280; font-size: 11px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .card-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .card-value { font-size: 16px; font-weight: 700; margin-top: 4px; }
  .gain { color: #059669; } .loss { color: #dc2626; } .tax { color: #7c3aed; } .neutral { color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f9fafb; padding: 8px 6px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #374151; }
  td { padding: 7px 6px; vertical-align: middle; }
  .note { margin-top: 24px; font-size: 10px; color: #9ca3af; line-height: 1.6; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>Capital Gains Tax Report · FY ${fyLabel}</h1>
  <p class="sub">Nepal Inland Revenue · Period: ${fy_start} to ${fy_end} · Generated by Tradeo</p>

  <div class="grid">
    <div class="card"><div class="card-label">Total Gain</div><div class="card-value gain">Rs.${s.total_gain.toLocaleString()}</div></div>
    <div class="card"><div class="card-label">Total Loss</div><div class="card-value loss">Rs.${s.total_loss.toLocaleString()}</div></div>
    <div class="card"><div class="card-label">Net P&amp;L</div><div class="card-value ${s.net_pnl >= 0 ? 'gain' : 'loss'}">${s.net_pnl >= 0 ? '+' : ''}Rs.${s.net_pnl.toLocaleString()}</div></div>
    <div class="card"><div class="card-label">Estimated CGT</div><div class="card-value tax">Rs.${s.estimated_tax.toLocaleString()}</div></div>
  </div>

  <div class="grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="card"><div class="card-label">Short-term Gain (7.5%)</div><div class="card-value">Rs.${s.short_term_gain.toLocaleString()}<span style="font-size:11px;font-weight:400;color:#6b7280"> → Tax: Rs.${s.short_term_tax.toLocaleString()}</span></div></div>
    <div class="card"><div class="card-label">Long-term Gain (5%)</div><div class="card-value">Rs.${s.long_term_gain.toLocaleString()}<span style="font-size:11px;font-weight:400;color:#6b7280"> → Tax: Rs.${s.long_term_tax.toLocaleString()}</span></div></div>
    <div class="card"><div class="card-label">Total Trades Closed</div><div class="card-value neutral">${s.total_trades}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Symbol</th><th>Dir</th><th>Qty</th><th>Entry</th><th>Exit</th>
        <th>Held</th><th>Term</th><th>Entry Price</th><th>Exit Price</th>
        <th>Realized P&amp;L</th><th>Tax Due</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="note">
    <strong>Disclaimer:</strong> This is an estimate for reference only. Nepal CGT rates: Short-term (&lt;365 days) 7.5%, Long-term (≥365 days) 5% on capital gains.
    Losses are not offset against gains for CGT purposes under current Nepal tax law.
    Consult a qualified tax advisor or Nepal Inland Revenue Authority (IRD) for official filing.
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); setExporting(false) }, 400)
  }

  if (loading) return <div className="text-[11px] text-gray-400 text-center py-12">Loading tax report…</div>
  if (error)   return <div className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</div>

  const s = report?.summary
  const trades = report?.trades || []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-gray-900 dark:text-white">CGT Report</span>
          <select
            value={fy || ''}
            onChange={handleFyChange}
            className="text-[10px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-600 dark:text-gray-300 focus:outline-none"
          >
            {availFYs.map(y => <option key={y} value={y}>FY {y}</option>)}
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || !trades.length}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-[11px] font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Opening…' : 'Export PDF'}
        </button>
      </div>

      {/* Summary cards */}
      {s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Gain',    value: `Rs.${s.total_gain.toLocaleString()}`,     color: 'text-emerald-500' },
              { label: 'Total Loss',    value: `Rs.${s.total_loss.toLocaleString()}`,     color: 'text-red-500' },
              { label: 'Net P&L',       value: `${s.net_pnl >= 0 ? '+' : ''}Rs.${s.net_pnl.toLocaleString()}`, color: s.net_pnl >= 0 ? 'text-emerald-500' : 'text-red-500' },
              { label: 'Estimated CGT', value: `Rs.${s.estimated_tax.toLocaleString()}`,  color: 'text-violet-500' },
            ].map(c => (
              <div key={c.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{c.label}</p>
                <p className={`text-[16px] font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Short-term (&lt;365 days) — 7.5%</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[14px] font-bold text-amber-500">Rs.{s.short_term_gain.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">taxable gain</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-violet-500">Rs.{s.short_term_tax.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">tax due</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Long-term (≥365 days) — 5%</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[14px] font-bold text-emerald-500">Rs.{s.long_term_gain.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">taxable gain</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-violet-500">Rs.{s.long_term_tax.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">tax due</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Trade table */}
      {trades.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
          <p className="text-[13px] text-gray-400">No closed trades in FY {fy}</p>
          <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Close trades to see your CGT breakdown</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {trades.length} closed trade{trades.length !== 1 ? 's' : ''} in FY {fy}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Symbol','Dir','Qty','Entry Date','Close Date','Held','Term','Entry','Exit','P&L','Tax'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {trades.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white whitespace-nowrap">{t.symbol}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        t.position === 'LONG'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}>{t.position}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 tabular-nums">{t.quantity}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">{t.entry_date}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">{t.close_date}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 tabular-nums">{t.held_days}d</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[9px] font-semibold ${t.term === 'Long-term' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {t.term} ({t.rate_pct}%)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 tabular-nums">Rs.{t.entry_price.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 tabular-nums">Rs.{t.exit_price.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 font-semibold tabular-nums whitespace-nowrap ${t.realized_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {t.realized_pnl >= 0 ? '+' : ''}Rs.{Math.round(t.realized_pnl).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-violet-500 tabular-nums whitespace-nowrap">
                      {t.tax > 0 ? `Rs.${t.tax.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
            <p className="text-[9px] text-gray-400 leading-relaxed">
              Nepal CGT: Short-term (&lt;365 days) 7.5% · Long-term (≥365 days) 5% · Losses not offset against gains under current IRD rules.
              Consult a tax advisor for official filing.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Rules Panel ───────────────────────────────────────────────────────────────

const RULE_CATEGORIES = ['General', 'Entry', 'Exit', 'Risk Management', 'Psychology']

const VIOLATION_COLORS = {
  NO_SL:              { bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-red-200 dark:border-red-800/50',    dot: 'bg-red-500',    text: 'text-red-600 dark:text-red-400' },
  RR_BELOW_1:         { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500',  text: 'text-amber-600 dark:text-amber-400' },
  FOMO_TAG:           { bg: 'bg-orange-50 dark:bg-orange-900/20',border: 'border-orange-200 dark:border-orange-800/50',dot: 'bg-orange-500',text: 'text-orange-600 dark:text-orange-400' },
  NO_ENTRY_REASON:    { bg: 'bg-purple-50 dark:bg-purple-900/20',border: 'border-purple-200 dark:border-purple-800/50',dot: 'bg-purple-500',text: 'text-purple-600 dark:text-purple-400' },
  NO_EXIT_REFLECTION: { bg: 'bg-blue-50 dark:bg-blue-900/20',  border: 'border-blue-200 dark:border-blue-800/50',  dot: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400' },
}

// ── Community Benchmarks Panel ────────────────────────────────────────────────
function BenchmarkPanel() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await getBenchmarkCompare()
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load benchmark data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOptIn = async () => {
    setWorking(true)
    try {
      await benchmarkContribute()
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to contribute stats')
    } finally {
      setWorking(false)
    }
  }

  const handleOptOut = async () => {
    setWorking(true)
    try {
      await benchmarkOptOut()
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to opt out')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
    </div>
  )

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-4 py-3 text-[11px] text-red-500">
      {error}
    </div>
  )

  const { user: u, community: c, opted_in, snapshot_at } = data || {}

  const pctLabel = (pct) => {
    if (pct == null) return null
    if (pct >= 75) return { label: `Top ${100 - pct}%`, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' }
    if (pct >= 50) return { label: `Top ${100 - pct}%`, cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' }
    return { label: `Bottom ${pct}%`, cls: 'text-gray-500 bg-gray-100 dark:bg-gray-800' }
  }

  const StatRow = ({ label, userVal, communityVal, pct, unit = '' }) => {
    const badge = pctLabel(pct)
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
        <div className="flex items-center gap-3">
          {communityVal != null && (
            <span className="text-[10px] text-gray-400">
              Community avg: <span className="font-semibold text-gray-600 dark:text-gray-300">{communityVal}{unit}</span>
            </span>
          )}
          <span className={`text-[11px] font-bold ${userVal != null ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
            {userVal != null ? `${userVal}${unit}` : '—'}
          </span>
          {badge && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header + opt-in toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-gray-900 dark:text-white">Community Benchmarks</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Anonymous, opt-in only. Your name and trades are never shared — only aggregate stats.
          </p>
        </div>
        <button
          onClick={opted_in ? handleOptOut : handleOptIn}
          disabled={working}
          className={`text-[11px] px-3 py-1.5 rounded-xl font-semibold transition-colors disabled:opacity-50 ${
            opted_in
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {working ? '…' : opted_in ? 'Opt Out' : 'Contribute My Stats'}
        </button>
      </div>

      {/* No trades yet */}
      {!u && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-6 text-center">
          <p className="text-[12px] text-gray-400">No closed trades yet. Close at least one trade to see your stats.</p>
        </div>
      )}

      {/* Not enough peers yet */}
      {u && !c && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl px-4 py-3">
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mb-0.5">Not enough peers yet</p>
          <p className="text-[10px] text-amber-500 dark:text-amber-500">
            Community comparisons appear once 3+ traders have contributed stats. Invite others to Tradeo!
          </p>
        </div>
      )}

      {/* Your stats */}
      {u && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Your Performance</p>
            {opted_in && snapshot_at && (
              <p className="text-[9px] text-gray-400">
                Contributed {new Date(snapshot_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
          <div className="px-4">
            <StatRow
              label="Win Rate"
              userVal={u.win_rate != null ? `${u.win_rate}%` : null}
              communityVal={c ? `${c.avg_win_rate}%` : null}
              pct={c?.percentiles?.win_rate}
            />
            <StatRow
              label="Avg R:R"
              userVal={u.avg_rr}
              communityVal={c?.avg_rr}
              pct={c?.percentiles?.avg_rr}
            />
            <StatRow
              label="Avg Hold (days)"
              userVal={u.avg_hold_days}
              communityVal={c?.avg_hold_days}
              pct={c?.percentiles?.avg_hold_days}
            />
            <StatRow
              label="Total Closed Trades"
              userVal={u.total_trades}
              communityVal={c?.avg_total_trades}
              pct={null}
            />
          </div>
        </div>
      )}

      {/* Community overview */}
      {c && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Community · {c.peer_count} traders
            </p>
          </div>
          <div className="px-4 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800">
            {[
              { label: 'Avg Win Rate', val: c.avg_win_rate != null ? `${c.avg_win_rate}%` : '—' },
              { label: 'Avg R:R',      val: c.avg_rr       != null ? c.avg_rr             : '—' },
              { label: 'Avg Hold',     val: c.avg_hold_days != null ? `${c.avg_hold_days}d` : '—' },
              { label: 'Avg Trades',   val: c.avg_total_trades != null ? c.avg_total_trades : '—' },
            ].map(({ label, val }) => (
              <div key={label} className="py-4 px-3 text-center">
                <p className="text-[16px] font-bold text-gray-900 dark:text-white">{val}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy note */}
      <p className="text-[9px] text-gray-400 text-center px-4">
        Only opted-in traders appear in community stats. Stats refresh each time you click "Contribute My Stats".
        No individual trade data is ever stored or shared.
      </p>
    </div>
  )
}

function RulesPanel() {
  const [rules, setRules]               = useState([])
  const [violations, setViolations]     = useState(null)
  const [summary, setSummary]           = useState(null)
  const [loading, setLoading]           = useState(true)
  const [vLoading, setVLoading]         = useState(false)
  const [view, setView]                 = useState('rules') // 'rules' | 'violations'
  const [addText, setAddText]           = useState('')
  const [addCat, setAddCat]             = useState('General')
  const [adding, setAdding]             = useState(false)
  const [editId, setEditId]             = useState(null)
  const [editText, setEditText]         = useState('')
  const [editCat, setEditCat]           = useState('General')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState(null)

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getRules()
      setRules(res.data)
    } catch (e) {
      setError('Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchViolations = useCallback(async () => {
    try {
      setVLoading(true)
      const res = await getRuleViolations()
      setViolations(res.data.violations)
      setSummary(res.data.summary)
    } catch (e) {
      setError('Failed to load violations')
    } finally {
      setVLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleAdd = async () => {
    if (!addText.trim()) return
    setAdding(true)
    try {
      const res = await addRule({ rule_text: addText, category: addCat })
      setRules(prev => [...prev, res.data])
      setAddText('')
    } catch {
      setError('Failed to add rule')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (rule) => {
    try {
      const res = await updateRule(rule.id, { is_active: !rule.is_active })
      setRules(prev => prev.map(r => r.id === rule.id ? res.data : r))
    } catch { /* silent */ }
  }

  const handleDelete = async (id) => {
    try {
      await deleteRule(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch {
      setError('Failed to delete rule')
    }
  }

  const startEdit = (rule) => {
    setEditId(rule.id)
    setEditText(rule.rule_text)
    setEditCat(rule.category)
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const res = await updateRule(editId, { rule_text: editText, category: editCat })
      setRules(prev => prev.map(r => r.id === editId ? res.data : r))
      setEditId(null)
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const switchToViolations = () => {
    setView('violations')
    if (!violations) fetchViolations()
  }

  // Group rules by category
  const grouped = {}
  for (const rule of rules) {
    if (!grouped[rule.category]) grouped[rule.category] = []
    grouped[rule.category].push(rule)
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {[
            { key: 'rules',      label: `Rules (${rules.length})` },
            { key: 'violations', label: 'Violations' },
          ].map(v => (
            <button key={v.key}
              onClick={() => v.key === 'violations' ? switchToViolations() : setView('rules')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                view === v.key
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
              {v.label}
            </button>
          ))}
        </div>
        {view === 'violations' && summary && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-400">{summary.trades_with_violations} trades with violations</span>
            <span className="text-[10px] font-semibold text-red-500">Rs.{summary.total_cost.toLocaleString()} cost</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2">{error}</div>
      )}

      {/* ── Rules view ── */}
      {view === 'rules' && (
        <div className="space-y-4">
          {/* Add rule */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-3">Add a Rule</p>
            <textarea
              value={addText}
              onChange={e => setAddText(e.target.value)}
              placeholder="e.g. Never enter without a stop-loss set at swing low"
              className="w-full text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-200 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
            />
            <div className="flex items-center gap-2 mt-2">
              <select
                value={addCat}
                onChange={e => setAddCat(e.target.value)}
                className="text-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none"
              >
                {RULE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={handleAdd}
                disabled={adding || !addText.trim()}
                className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-[11px] font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Adding…' : 'Add Rule'}
              </button>
            </div>
          </div>

          {/* Rules list grouped by category */}
          {loading ? (
            <div className="text-[11px] text-gray-400 text-center py-8">Loading rules…</div>
          ) : rules.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
              <p className="text-[13px] text-gray-400">No rules yet</p>
              <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Document your trading rules above to start tracking violations</p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, catRules]) => (
              <div key={cat} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{cat}</span>
                  <span className="ml-2 text-[10px] text-gray-300 dark:text-gray-600">{catRules.length} rule{catRules.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {catRules.map(rule => (
                    <div key={rule.id} className="px-4 py-3">
                      {editId === rule.id ? (
                        /* Edit mode */
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            className="w-full text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-200 resize-none h-14 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <select
                              value={editCat}
                              onChange={e => setEditCat(e.target.value)}
                              className="text-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-600 dark:text-gray-300 focus:outline-none"
                            >
                              {RULE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button onClick={handleSaveEdit} disabled={saving}
                              className="ml-auto px-3 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex items-start gap-3">
                          {/* Active toggle */}
                          <button
                            onClick={() => handleToggle(rule)}
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                              rule.is_active
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {rule.is_active && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <p className={`flex-1 text-[11px] leading-relaxed ${rule.is_active ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 line-through'}`}>
                            {rule.rule_text}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => startEdit(rule)}
                              className="p-1 text-gray-400 hover:text-blue-500 transition-colors">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(rule.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Violations view ── */}
      {view === 'violations' && (
        <div className="space-y-4">
          {vLoading ? (
            <div className="text-[11px] text-gray-400 text-center py-8">Scanning trades…</div>
          ) : violations?.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
              <p className="text-[13px] text-emerald-500 font-semibold">No violations found</p>
              <p className="text-[11px] text-gray-400 mt-1">Your trades are following the detectable rules</p>
            </div>
          ) : violations ? (
            <>
              {/* Summary strip */}
              {summary && summary.most_common.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-3">Most Common Violations</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.most_common.map(v => {
                      const colors = VIOLATION_COLORS[v.code] || {}
                      return (
                        <div key={v.code} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-medium ${colors.bg} ${colors.border} ${colors.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {v.label} · {v.count}×
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Per-trade violations */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Trade Violations</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {violations.map(v => (
                    <div key={v.trade_id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-900 dark:text-white">{v.symbol}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            v.position === 'LONG'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          }`}>{v.position}</span>
                          <span className="text-[10px] text-gray-400">{v.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {v.realized_pnl !== 0 && (
                            <span className={`text-[10px] font-semibold ${v.realized_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {v.realized_pnl >= 0 ? '+' : ''}Rs.{Math.abs(v.realized_pnl).toLocaleString()}
                            </span>
                          )}
                          <span className="text-[9px] text-red-400 font-semibold">{v.violation_count} violation{v.violation_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {v.violations.map(viol => {
                          const colors = VIOLATION_COLORS[viol.code] || {}
                          return (
                            <div key={viol.code}
                              title={viol.description}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-semibold ${colors.bg} ${colors.border} ${colors.text}`}>
                              <span className={`w-1 h-1 rounded-full ${colors.dot}`} />
                              {viol.label}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Stats Panel ───────────────────────────────────────────────────────────────

function StatsPanel({ trades }) {
  const closed = trades.filter(t => t.status === 'CLOSED')
  const open   = trades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')

  if (closed.length === 0 && open.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-20 text-center">
        <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-[12px] font-medium text-gray-400">No trades yet</p>
        <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1">Log some trades to see your statistics</p>
      </div>
    )
  }

  // ── Core metrics ─────────────────────────────────────────────────────────
  const winners    = closed.filter(t => parseFloat(t.realized_pnl || 0) > 0)
  const losers     = closed.filter(t => parseFloat(t.realized_pnl || 0) < 0)
  const winRate    = closed.length > 0 ? (winners.length / closed.length) * 100 : null

  const totalPnl   = closed.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
  const avgWin     = winners.length > 0 ? winners.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0) / winners.length : null
  const avgLoss    = losers.length  > 0 ? losers.reduce((s, t)  => s + (parseFloat(t.realized_pnl) || 0), 0)  / losers.length  : null

  // Avg R:R from trades that have both SL and TP set
  const rrTrades   = closed.filter(t => t.sl && t.tp)
  const avgRR      = rrTrades.length > 0
    ? rrTrades.reduce((s, t) => {
        const e = parseFloat(t.entry_price)
        const sl = parseFloat(t.sl), tp = parseFloat(t.tp)
        const risk = Math.abs(e - sl)
        const reward = Math.abs(tp - e)
        return s + (risk > 0 ? reward / risk : 0)
      }, 0) / rrTrades.length
    : null

  // Best & worst closed trade
  const sortedByPnl = [...closed].sort((a, b) => (parseFloat(b.realized_pnl) || 0) - (parseFloat(a.realized_pnl) || 0))
  const bestTrade   = sortedByPnl[0] || null
  const worstTrade  = sortedByPnl[sortedByPnl.length - 1] || null

  // Avg hold time (days) for closed trades
  const closedWithDates = closed.filter(t => t.date && t.updated_at)
  const avgHoldDays = closedWithDates.length > 0
    ? closedWithDates.reduce((s, t) => {
        const entry = new Date(t.date)
        const exit  = new Date(t.updated_at)
        return s + Math.max(0, Math.floor((exit - entry) / 86400000))
      }, 0) / closedWithDates.length
    : null

  // Streak — current consecutive wins/losses from most recent closed trade
  const chronoClosed = [...closed].sort((a, b) => (a.updated_at || a.date) < (b.updated_at || b.date) ? 1 : -1)
  let streakCount = 0, streakType = null
  for (const t of chronoClosed) {
    const won = (parseFloat(t.realized_pnl) || 0) > 0
    if (streakType === null) { streakType = won ? 'W' : 'L'; streakCount = 1 }
    else if ((won && streakType === 'W') || (!won && streakType === 'L')) { streakCount++ }
    else break
  }

  // Profit factor
  const grossWin  = winners.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0))
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null

  // Monthly P&L breakdown (grouped by close date)
  const monthlyMap = {}
  closed.forEach(t => {
    const key = ((t.updated_at || t.date) || '').slice(0, 7) // 'YYYY-MM' by close date
    if (!key) return
    monthlyMap[key] = (monthlyMap[key] || 0) + (parseFloat(t.realized_pnl) || 0)
  })
  const months = Object.entries(monthlyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)

  // Long vs Short breakdown
  const longTrades  = closed.filter(t => t.position === 'LONG')
  const shortTrades = closed.filter(t => t.position === 'SHORT')
  const longWinRate  = longTrades.length  > 0 ? (longTrades.filter(t => (parseFloat(t.realized_pnl) || 0) > 0).length  / longTrades.length)  * 100 : null
  const shortWinRate = shortTrades.length > 0 ? (shortTrades.filter(t => (parseFloat(t.realized_pnl) || 0) > 0).length / shortTrades.length) * 100 : null

  const fmt = (n) => n > 0 ? `+Rs.${Math.abs(Math.round(n)).toLocaleString()}` : `−Rs.${Math.abs(Math.round(n)).toLocaleString()}`
  const fmtColor = (n) => n > 0 ? 'text-emerald-500' : n < 0 ? 'text-red-400' : 'text-gray-400'

  const StatCard = ({ label, value, valueClass = 'text-gray-900 dark:text-white', sub }) => (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3.5">
      <p className={`text-[15px] font-black tracking-tight tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Row 1: Core performance ── */}
      <div>
        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Performance</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            label="Win Rate"
            value={winRate !== null ? `${Math.round(winRate)}%` : '—'}
            valueClass={winRate !== null ? (winRate >= 50 ? 'text-emerald-500' : 'text-red-400') : 'text-gray-400'}
            sub={closed.length > 0 ? `${winners.length}W · ${losers.length}L · ${closed.length} closed` : null}
          />
          <StatCard
            label="Profit Factor"
            value={profitFactor !== null ? (profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)) : '—'}
            valueClass={profitFactor !== null ? (profitFactor >= 1.5 ? 'text-emerald-500' : profitFactor >= 1 ? 'text-amber-500' : 'text-red-400') : 'text-gray-400'}
            sub={profitFactor !== null && profitFactor !== Infinity ? `${Math.round(grossWin).toLocaleString()} / ${Math.round(grossLoss).toLocaleString()}` : null}
          />
          <StatCard
            label="Avg Win"
            value={avgWin !== null ? fmt(avgWin) : '—'}
            valueClass={avgWin !== null ? 'text-emerald-500' : 'text-gray-400'}
            sub={winners.length > 0 ? `${winners.length} winning trades` : null}
          />
          <StatCard
            label="Avg Loss"
            value={avgLoss !== null ? fmt(avgLoss) : '—'}
            valueClass={avgLoss !== null ? 'text-red-400' : 'text-gray-400'}
            sub={losers.length > 0 ? `${losers.length} losing trades` : null}
          />
        </div>
      </div>

      {/* ── Row 2: Risk & timing ── */}
      <div>
        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Risk & Timing</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            label="Avg Planned R:R"
            value={avgRR !== null ? `${avgRR.toFixed(2)}R` : '—'}
            valueClass={avgRR !== null ? (avgRR >= 2 ? 'text-emerald-500' : avgRR >= 1 ? 'text-amber-500' : 'text-red-400') : 'text-gray-400'}
            sub={rrTrades.length > 0 ? `from ${rrTrades.length} trade${rrTrades.length !== 1 ? 's' : ''} with SL+TP` : null}
          />
          <StatCard
            label="Avg Hold Time"
            value={avgHoldDays !== null ? (avgHoldDays < 1 ? '<1d' : `${Math.round(avgHoldDays)}d`) : '—'}
            sub={closedWithDates.length > 0 ? `across ${closedWithDates.length} closed trades` : null}
          />
          <StatCard
            label="Current Streak"
            value={streakCount > 0 ? `${streakCount} ${streakType === 'W' ? 'wins' : 'losses'}` : '—'}
            valueClass={streakType === 'W' ? 'text-emerald-500' : streakType === 'L' ? 'text-red-400' : 'text-gray-400'}
            sub={streakCount > 0 ? (streakType === 'W' ? 'Keep going!' : 'Time to review') : null}
          />
          <StatCard
            label="Open Trades"
            value={open.length}
            sub={open.length > 0 ? `${[...new Set(open.map(t => t.symbol))].length} unique symbols` : null}
          />
        </div>
      </div>

      {/* ── Row 3: Best / Worst + Long/Short breakdown ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Best / Worst */}
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Best & Worst</p>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800/60">
            {bestTrade && (
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full bg-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-800 dark:text-white">{bestTrade.symbol}</p>
                    <p className="text-[9px] text-gray-400">{bestTrade.date} · {bestTrade.position}</p>
                  </div>
                </div>
                <p className="text-[13px] font-black text-emerald-500 tabular-nums">
                  {fmt(bestTrade.realized_pnl)}
                </p>
              </div>
            )}
            {worstTrade && worstTrade.id !== bestTrade?.id && (
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full bg-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-800 dark:text-white">{worstTrade.symbol}</p>
                    <p className="text-[9px] text-gray-400">{worstTrade.date} · {worstTrade.position}</p>
                  </div>
                </div>
                <p className="text-[13px] font-black text-red-400 tabular-nums">
                  {fmt(worstTrade.realized_pnl)}
                </p>
              </div>
            )}
            {!bestTrade && !worstTrade && (
              <div className="px-4 py-6 text-center">
                <p className="text-[11px] text-gray-300 dark:text-gray-700">No closed trades</p>
              </div>
            )}
          </div>
        </div>

        {/* Long vs Short */}
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Long vs Short</p>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800/60">
            {[
              { label: 'Long', trades: longTrades, wr: longWinRate, color: 'bg-emerald-400' },
              { label: 'Short', trades: shortTrades, wr: shortWinRate, color: 'bg-red-400' },
            ].map(({ label, trades: ts, wr, color }) => (
              <div key={label} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-4 rounded-full ${color} flex-shrink-0`} />
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{label}</p>
                    <span className="text-[9px] text-gray-400">{ts.length} trades</span>
                  </div>
                  {wr !== null && (
                    <span className={`text-[11px] font-bold tabular-nums ${wr >= 50 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {Math.round(wr)}% WR
                    </span>
                  )}
                </div>
                {ts.length > 0 && (
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${wr >= 50 ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ width: `${wr ?? 0}%` }}
                    />
                  </div>
                )}
                {ts.length === 0 && (
                  <p className="text-[10px] text-gray-300 dark:text-gray-700">No trades</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Setup Tag breakdown ── */}
      {(() => {
        const tagRows = SETUP_TAGS.map(tag => {
          const tagged = closed.filter(t => t.setup_tag === tag)
          if (tagged.length === 0) return null
          const tagWins = tagged.filter(t => (parseFloat(t.realized_pnl) || 0) > 0)
          const wr = Math.round((tagWins.length / tagged.length) * 100)
          const pnl = tagged.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
          return { tag, count: tagged.length, wr, pnl }
        }).filter(Boolean)

        if (tagRows.length === 0) return null
        return (
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Setup Type Breakdown</p>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800/60">
              {tagRows.map(({ tag, count, wr, pnl }) => (
                <div key={tag} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${SETUP_TAG_STYLE[tag] || SETUP_TAG_STYLE.Other}`}>
                        {tag}
                      </span>
                      <span className="text-[9px] text-gray-400">{count} trade{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold tabular-nums ${pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {pnl > 0 ? '+' : pnl < 0 ? '−' : ''}Rs.{Math.abs(Math.round(pnl)).toLocaleString()}
                      </span>
                      <span className={`text-[11px] font-bold tabular-nums ${wr >= 50 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {wr}% WR
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${wr >= 50 ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ width: `${wr}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Monthly P&L chart ── */}
      {months.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">Monthly P&L</p>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
            {(() => {
              const maxAbs = Math.max(...months.map(([, v]) => Math.abs(v)), 1)
              return (
                <div className="flex items-end gap-1.5 h-28 w-full">
                  {[...months].reverse().map(([month, val]) => {
                    const pct = Math.abs(val) / maxAbs
                    const isPos = val >= 0
                    const label = month.slice(2) // 'YY-MM'
                    return (
                      <div key={month} className="flex flex-col items-center flex-1 h-full justify-end group">
                        <div className="relative flex flex-col items-center justify-end h-full w-full">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                            <div className="bg-gray-900 dark:bg-gray-700 text-white rounded-lg px-2 py-1 text-[9px] font-semibold whitespace-nowrap shadow-lg">
                              {isPos ? '+' : '−'}Rs.{Math.abs(Math.round(val)).toLocaleString()}
                            </div>
                            <div className="w-1.5 h-1.5 bg-gray-900 dark:bg-gray-700 rotate-45 -mt-0.5" />
                          </div>
                          {/* Bar */}
                          <div
                            className={`w-full rounded-t transition-all ${isPos ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-red-400 dark:bg-red-500'}`}
                            style={{ height: `${Math.max(pct * 88, 4)}px` }}
                          />
                        </div>
                        <p className="text-[8px] text-gray-400 mt-1 tabular-nums">{label}</p>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[9px] text-gray-400">Profit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[9px] text-gray-400">Loss</span>
              </div>
              <span className="ml-auto text-[9px] text-gray-400">
                Total: <span className={`font-semibold tabular-nums ${fmtColor(totalPnl)}`}>
                  {totalPnl !== 0 ? fmt(totalPnl) : '—'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── MFE / MAE Distribution ── */}
      {(() => {
        const mfeTrades = closed.filter(t => t.mfe != null && t.entry_price)
        const maeTrades = closed.filter(t => t.mae != null && t.entry_price)
        if (mfeTrades.length === 0 && maeTrades.length === 0) return null

        const toBuckets = (items, field) => {
          // % move from entry: for LONG = (field - entry)/entry*100, for SHORT = (entry - field)/entry*100
          const pcts = items.map(t => {
            const entry = parseFloat(t.entry_price)
            const val   = parseFloat(t[field])
            if (!entry) return 0
            return t.position === 'LONG' ? (val - entry) / entry * 100 : (entry - val) / entry * 100
          })
          // Buckets: <2%, 2-5%, 5-10%, 10-20%, >20%
          const labels = ['<2%', '2-5%', '5-10%', '10-20%', '>20%']
          const counts = [0, 0, 0, 0, 0]
          pcts.forEach(p => {
            if (p < 2)       counts[0]++
            else if (p < 5)  counts[1]++
            else if (p < 10) counts[2]++
            else if (p < 20) counts[3]++
            else             counts[4]++
          })
          const max = Math.max(...counts, 1)
          return { labels, counts, max }
        }

        const renderBars = (buckets, color) => (
          <div className="space-y-1.5">
            {buckets.labels.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[9px] text-gray-400 w-10 text-right tabular-nums flex-shrink-0">{label}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${(buckets.counts[i] / buckets.max) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] tabular-nums text-gray-400 w-4 flex-shrink-0">{buckets.counts[i]}</span>
              </div>
            ))}
          </div>
        )

        return (
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">MFE / MAE Distribution</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mfeTrades.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                  <p className="text-[10px] font-semibold text-emerald-500 mb-3">
                    MFE — Max Favorable Excursion
                    <span className="text-gray-400 font-normal ml-1">({mfeTrades.length} trades)</span>
                  </p>
                  {renderBars(toBuckets(mfeTrades, 'mfe'), 'bg-emerald-400')}
                  <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-3">How far price moved in your favor — where to set TP</p>
                </div>
              )}
              {maeTrades.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                  <p className="text-[10px] font-semibold text-red-400 mb-3">
                    MAE — Max Adverse Excursion
                    <span className="text-gray-400 font-normal ml-1">({maeTrades.length} trades)</span>
                  </p>
                  {renderBars(toBuckets(maeTrades, 'mae'), 'bg-red-400')}
                  <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-3">How far price moved against you — calibrate SL width</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

    </div>
  )
}

// ── Grouped Trade Row (aggregates multiple open entries for same symbol) ───────

function GroupedTradeRow({ symbol, entries, ltp, onEdit, onClose, onPartialClose, onDelete, onJournal, onGoToChart, onToggleSelect, selectedIds }) {
  const [expanded, setExpanded] = useState(false)
  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  const totalQty   = entries.reduce((s, t) => s + (t.remaining_quantity ?? t.quantity), 0)
  const avgEntry   = totalQty > 0
    ? entries.reduce((s, t) => s + parseFloat(t.entry_price) * (t.remaining_quantity ?? t.quantity), 0) / totalQty
    : parseFloat(entries[0]?.entry_price) || 0
  const totalPnl   = entries.reduce((s, t) => s + (t.realized_pnl || 0), 0)

  // All same position direction? Show it; mixed → "Mixed"
  const positions  = [...new Set(entries.map(t => t.position))]
  const posLabel   = positions.length === 1 ? positions[0] : 'Mixed'

  const unrealized = ltp?.price
    ? entries.reduce((s, t) => {
        const qty = t.remaining_quantity ?? t.quantity
        return s + (t.position === 'LONG'
          ? (ltp.price - t.entry_price) * qty
          : (t.entry_price - ltp.price) * qty)
      }, 0)
    : null

  // SL alert — any entry within 3% of its SL
  const anySlNear = entries.some(t =>
    t.sl && ltp?.price && Math.abs((ltp.price - parseFloat(t.sl)) / ltp.price) < 0.03
  )

  // Status: if any PARTIAL → PARTIAL; else OPEN
  const groupStatus = entries.some(t => t.status === 'PARTIAL') ? 'PARTIAL' : 'OPEN'
  const statusConfig = {
    OPEN:    { dot: 'bg-blue-400',  text: 'text-blue-500' },
    PARTIAL: { dot: 'bg-amber-400', text: 'text-amber-500' },
  }[groupStatus]

  const ctxItems = [
    { label: 'Go to Chart', icon: '📈', action: () => onGoToChart(entries[0]) },
    { label: 'Add Journal', icon: '📓', action: () => onJournal(entries[0]) },
  ]

  return (
    <>
      <ContextMenuPortal />

      {/* Group header row */}
      <tr
        onContextMenu={onContextMenu(ctxItems)}
        onClick={() => setExpanded(e => !e)}
        className="border-b border-gray-50 dark:border-gray-800/60 cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors bg-gray-50/40 dark:bg-gray-800/10"
      >
        {/* Empty checkbox cell for alignment */}
        <td className="pl-4 pr-2 py-3" />
        {/* Date — show earliest entry date */}
        <td className="px-4 py-3" translate="no">
          <p className="text-[10px] text-gray-400 font-medium tabular-nums">
            {entries.reduce((min, t) => t.date < min ? t.date : min, entries[0].date)}
          </p>
          <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-0.5">
            {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
          </p>
        </td>

        {/* Symbol + position */}
        <td className="px-4 py-3" translate="no">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-5 rounded-full flex-shrink-0 ${posLabel === 'LONG' ? 'bg-emerald-400' : posLabel === 'SHORT' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{symbol}</p>
                {anySlNear && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="SL proximity alert" />}
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-500 tracking-wide">GROUP</span>
              </div>
              <p className={`text-[9px] font-semibold ${posLabel === 'LONG' ? 'text-emerald-500' : posLabel === 'SHORT' ? 'text-red-400' : 'text-amber-500'}`}>
                {posLabel === 'LONG' ? '↑ Long' : posLabel === 'SHORT' ? '↓ Short' : '⇅ Mixed'}
              </p>
            </div>
          </div>
        </td>

        {/* Total qty */}
        <td className="px-4 py-3" translate="no">
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{totalQty}</span>
          <p className="text-[9px] text-gray-400 mt-0.5">total</p>
        </td>

        {/* Avg entry + LTP */}
        <td className="px-4 py-3" translate="no">
          <p className="text-[11px] text-gray-700 dark:text-gray-300 tabular-nums font-medium">
            {avgEntry.toFixed(2)} <span className="text-[9px] text-gray-400 font-normal">avg</span>
          </p>
          {ltp?.price && (
            <p className={`text-[9px] tabular-nums font-semibold mt-0.5 ${ltp.price >= avgEntry ? 'text-emerald-500' : 'text-red-400'}`}>
              {ltp.price.toFixed(2)}
              {ltp.latestDate && <span className="text-gray-300 dark:text-gray-700 font-normal ml-1">{ltp.latestDate}</span>}
            </p>
          )}
        </td>

        {/* SL range */}
        <td className="px-4 py-3" translate="no">
          {(() => {
            const sls = entries.map(t => t.sl).filter(Boolean).map(parseFloat)
            if (sls.length === 0) return <p className="text-[9px] text-gray-200 dark:text-gray-800">No SL</p>
            const minSl = Math.min(...sls), maxSl = Math.max(...sls)
            return (
              <p className={`text-[10px] tabular-nums ${anySlNear ? 'text-red-500' : 'text-red-400'}`}>
                <span className="font-semibold mr-1">SL</span>
                {minSl === maxSl ? minSl.toFixed(2) : `${minSl.toFixed(2)}–${maxSl.toFixed(2)}`}
                {anySlNear && <span className="ml-1">⚠</span>}
              </p>
            )
          })()}
        </td>

        {/* P&L */}
        <td className="px-4 py-3" translate="no">
          {totalPnl !== 0 ? (
            <p className={`text-[12px] font-bold tabular-nums ${totalPnl > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {totalPnl > 0 ? '+' : '−'}Rs.{Math.abs(Math.round(totalPnl)).toLocaleString()}
            </p>
          ) : <span className="text-[11px] text-gray-300 dark:text-gray-700">—</span>}
          {unrealized !== null && (
            <p className={`text-[9px] tabular-nums font-medium mt-0.5 ${unrealized > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {unrealized > 0 ? '+' : '−'}Rs.{Math.abs(Math.round(unrealized)).toLocaleString()} unreal.
            </p>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3" translate="no">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            <span className={`text-[10px] font-semibold ${statusConfig.text}`}>{groupStatus}</span>
          </div>
        </td>

        {/* Expand chevron */}
        <td className="px-4 py-3">
          <svg className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>

      {/* Individual entry rows when expanded */}
      {expanded && entries.map(trade => (
        <TradeRow
          key={trade.id}
          trade={trade}
          ltp={ltp}
          onEdit={onEdit}
          onClose={onClose}
          onPartialClose={onPartialClose}
          onDelete={onDelete}
          onJournal={onJournal}
          onGoToChart={onGoToChart}
          onToggleSelect={onToggleSelect}
          isSelected={selectedIds?.has(trade.id) || false}
          indented
        />
      ))}
    </>
  )
}

// ── What If Panel ─────────────────────────────────────────────────────────────

function WhatIfPanel({ trade }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [fetched, setFetched] = useState(false)

  // Resolve exit date from updated_at or a fallback
  const exitDate = (trade.updated_at || trade.date || '').slice(0, 10)

  const load = () => {
    if (fetched || loading) return
    setLoading(true)
    getWhatIf({
      symbol:      trade.symbol,
      exit_date:   exitDate,
      exit_price:  parseFloat(trade.exit_price),
      entry_price: parseFloat(trade.entry_price),
      position:    trade.position,
    })
      .then(res => { setData(res.data); setFetched(true) })
      .catch(err => { setError(err.response?.data?.error || 'No data'); setFetched(true) })
      .finally(() => setLoading(false))
  }

  if (!trade.exit_price || !exitDate) return null

  const fmtDelta = (d) => {
    if (d == null) return '—'
    return `${d > 0 ? '+' : ''}${d.toFixed(2)}%`
  }
  const deltaColor = (d) => d == null ? 'text-gray-400' : d > 0 ? 'text-emerald-500' : d < 0 ? 'text-red-400' : 'text-gray-400'

  return (
    <div className="flex gap-3">
      <div className="w-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">What If I Had Held?</p>
          {!fetched && (
            <button
              onClick={load}
              className="text-[9px] text-amber-500 hover:text-amber-400 font-semibold border border-amber-200 dark:border-amber-800/50 rounded px-1.5 py-0.5 transition-colors"
            >
              Load →
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-gray-400">Fetching post-exit prices…</span>
          </div>
        )}

        {error && <p className="text-[9px] text-gray-400 italic">{error}</p>}

        {data && !loading && (
          <div className="space-y-1.5">
            {/* Snapshot pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: '+7d',  snap: data.snapshots?.at7  },
                { label: '+14d', snap: data.snapshots?.at14 },
                { label: '+30d', snap: data.snapshots?.at30 },
              ].map(({ label, snap }) => snap && (
                <div key={label} className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-2 py-1">
                  <span className="text-[8px] text-gray-400 font-medium">{label}</span>
                  <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">Rs.{snap.close.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold tabular-nums ${deltaColor(snap.delta)}`}>{fmtDelta(snap.delta)}</span>
                </div>
              ))}
            </div>

            {/* Peak & Valley */}
            <div className="flex items-center gap-3 flex-wrap">
              {data.peak && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-gray-400">Peak</span>
                  <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">Rs.{data.peak.price.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold ${deltaColor(data.peak.delta)}`}>{fmtDelta(data.peak.delta)}</span>
                  <span className="text-[8px] text-gray-300 dark:text-gray-700">{data.peak.date}</span>
                </div>
              )}
              {data.valley && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-gray-400">Valley</span>
                  <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">Rs.{data.valley.price.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold ${deltaColor(data.valley.delta)}`}>{fmtDelta(data.valley.delta)}</span>
                  <span className="text-[8px] text-gray-300 dark:text-gray-700">{data.valley.date}</span>
                </div>
              )}
            </div>

            {/* Context note */}
            {data.dataPoints != null && (
              <p className="text-[8px] text-gray-300 dark:text-gray-700 italic">
                {data.dataPoints} trading days of post-exit data · % vs your exit Rs.{parseFloat(trade.exit_price).toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Trade Row ─────────────────────────────────────────────────────────────────

function TradeRow({ trade, ltp, onEdit, onClose, onPartialClose, onDelete, onJournal, onGoToChart, indented = false, isSelected = false, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false)
  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  // P2-008: Supabase NUMERIC → string; parseFloat/parseInt before arithmetic
  const remaining  = parseInt(trade.remaining_quantity ?? trade.quantity) || 0
  const entryPrice = parseFloat(trade.entry_price) || 0
  const pnl        = parseFloat(trade.realized_pnl) || 0
  const isOpen     = trade.status === 'OPEN' || trade.status === 'PARTIAL'

  // Unrealized P&L at current LTP (only for open/partial trades)
  const unrealized = ltp?.price && isOpen
    ? (trade.position === 'LONG'
        ? (ltp.price - entryPrice) * remaining
        : (entryPrice - ltp.price) * remaining)
    : null

  // SL proximity — alert if LTP is within 3% of SL
  const slNear = isOpen && trade.sl && ltp?.price
    ? Math.abs((ltp.price - parseFloat(trade.sl)) / ltp.price) < 0.03
    : false

  const statusConfig = {
    OPEN:    { dot: 'bg-blue-400',   text: 'text-blue-500' },
    PARTIAL: { dot: 'bg-amber-400',  text: 'text-amber-500' },
    CLOSED:  { dot: 'bg-gray-400',   text: 'text-gray-400' },
  }[trade.status] || { dot: 'bg-gray-400', text: 'text-gray-400' }

  const ctxItems = [
    { label: 'Edit Trade',    icon: '✏️', action: () => onEdit(trade) },
    { label: 'Add Journal',   icon: '📓', action: () => onJournal(trade) },
    { label: 'Go to Chart',   icon: '📈', action: () => onGoToChart(trade) },
    ...(isOpen ? [
      { label: 'Partial Close', icon: '◑', action: () => onPartialClose(trade) },
      { label: 'Close Trade',   icon: '⊠', action: () => onClose(trade) },
    ] : []),
    { separator: true },
    { label: 'Delete', icon: '🗑️', danger: true, action: () => onDelete(trade.id) },
  ]

  const hasExpandContent = trade.notes || trade.entry_reason || trade.exit_reflection || (trade.partial_exits?.length > 0) || trade.exit_price

  return (
    <>
      <ContextMenuPortal />
      <tr
        onContextMenu={onContextMenu(ctxItems)}
        onClick={() => hasExpandContent && setExpanded(!expanded)}
        className={`border-b border-gray-50 dark:border-gray-800/60 transition-colors ${indented ? 'bg-gray-50/60 dark:bg-gray-800/20' : ''} ${
          hasExpandContent ? 'cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/30' : 'cursor-default hover:bg-gray-50/40 dark:hover:bg-gray-800/10'
        }`}
      >
        {/* Checkbox */}
        <td className="pl-4 pr-2 py-3.5" onClick={e => e.stopPropagation()}>
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(trade.id)}
              className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
            />
          )}
        </td>
        {/* Date + duration */}
        <td className="px-4 py-3.5" translate="no">
          <p className="text-[10px] text-gray-400 font-medium tabular-nums">{trade.date}</p>
          {isOpen && (
            <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-0.5">{tradeDuration(trade.date)}</p>
          )}
        </td>

        {/* Symbol + position + SL alert */}
        <td className="px-4 py-3.5" translate="no">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-5 rounded-full flex-shrink-0 ${trade.position === 'LONG' ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{trade.symbol}</p>
                {slNear && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"
                    title="LTP is within 3% of Stop Loss"
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className={`text-[9px] font-semibold ${trade.position === 'LONG' ? 'text-emerald-500' : 'text-red-400'}`}>
                  {trade.position === 'LONG' ? '↑ Long' : '↓ Short'}
                </p>
                {trade.setup_tag && (
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${SETUP_TAG_STYLE[trade.setup_tag] || SETUP_TAG_STYLE.Other}`}>
                    {trade.setup_tag}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Qty */}
        <td className="px-4 py-3.5" translate="no">
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{remaining}</span>
          {remaining !== trade.quantity && (
            <span className="text-[9px] text-gray-300 dark:text-gray-700 tabular-nums"> /{trade.quantity}</span>
          )}
        </td>

        {/* Entry + LTP */}
        <td className="px-4 py-3.5" translate="no">
          <p className="text-[11px] text-gray-700 dark:text-gray-300 tabular-nums font-medium">
            {parseFloat(trade.entry_price).toFixed(2)}
          </p>
          {ltp?.price && isOpen && (
            <p className={`text-[9px] tabular-nums font-semibold mt-0.5 ${
              ltp.price >= entryPrice ? 'text-emerald-500' : 'text-red-400'
            }`}>
              {ltp.price.toFixed(2)}
              {ltp.latestDate && (
                <span className="text-gray-300 dark:text-gray-700 font-normal ml-1">{ltp.latestDate}</span>
              )}
            </p>
          )}
        </td>

        {/* SL / TP */}
        <td className="px-4 py-3.5" translate="no">
          <div className="space-y-0.5">
            {trade.sl
              ? <p className="text-[10px] tabular-nums">
                  <span className={`font-semibold mr-1 ${slNear ? 'text-red-500' : 'text-red-400'}`}>SL</span>
                  <span className="text-gray-500 dark:text-gray-400">{parseFloat(trade.sl).toFixed(2)}</span>
                  {slNear && <span className="ml-1 text-red-400">⚠</span>}
                </p>
              : <p className="text-[9px] text-gray-200 dark:text-gray-800">No SL</p>
            }
            {trade.tp
              ? <p className="text-[10px] tabular-nums">
                  <span className="text-emerald-400 font-semibold mr-1">TP</span>
                  <span className="text-gray-500 dark:text-gray-400">{parseFloat(trade.tp).toFixed(2)}</span>
                </p>
              : null
            }
          </div>
        </td>

        {/* P&L — realized + unrealized */}
        <td className="px-4 py-3.5" translate="no">
          {pnl !== 0 ? (
            <p className={`text-[12px] font-bold tabular-nums ${pnl > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {pnl > 0 ? '+' : '−'}Rs.{Math.abs(Math.round(pnl)).toLocaleString()}
            </p>
          ) : (
            <span className="text-[11px] text-gray-300 dark:text-gray-700">—</span>
          )}
          {unrealized !== null && (
            <p className={`text-[9px] tabular-nums font-medium mt-0.5 ${unrealized > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {unrealized > 0 ? '+' : '−'}Rs.{Math.abs(Math.round(unrealized)).toLocaleString()} unreal.
            </p>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3.5" translate="no">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            <span className={`text-[10px] font-semibold ${statusConfig.text}`}>
              {trade.status}
            </span>
          </div>
        </td>

        {/* Expand chevron */}
        <td className="px-4 py-3.5">
          {hasExpandContent && (
            <svg
              className={`w-3 h-3 text-gray-300 dark:text-gray-700 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr className="bg-gray-50/60 dark:bg-gray-800/20">
          <td colSpan={8} className="px-4 pt-0 pb-4">
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800/60 grid grid-cols-1 gap-3">

              {trade.entry_reason && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800/50 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Why I took this</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{trade.entry_reason}</p>
                  </div>
                </div>
              )}

              {trade.exit_reflection && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-violet-200 dark:bg-violet-800/50 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">What happened</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{trade.exit_reflection}</p>
                  </div>
                </div>
              )}

              {trade.notes && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-blue-200 dark:bg-blue-800/50 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Trade Thesis</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{trade.notes}</p>
                  </div>
                </div>
              )}

              {trade.partial_exits?.length > 0 && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 flex-shrink-0" />
                  <div className="w-full">
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-2">Partial Exits</p>
                    <div className="flex flex-wrap gap-2">
                      {trade.partial_exits.map((pe, i) => (
                        <div key={i} className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                            {pe.exit_quantity} @ Rs.{parseFloat(pe.exit_price).toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-bold tabular-nums ${pe.pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {pe.pnl >= 0 ? '+' : '−'}Rs.{Math.abs(Math.round(pe.pnl)).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {trade.exit_price && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Full Exit</p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 tabular-nums font-medium">
                        Rs.{parseFloat(trade.exit_price).toFixed(2)}
                      </p>
                      {trade.mfe != null && (
                        <span className="text-[10px] tabular-nums">
                          <span className="font-semibold text-emerald-500">MFE</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">Rs.{parseFloat(trade.mfe).toFixed(2)}</span>
                        </span>
                      )}
                      {trade.mae != null && (
                        <span className="text-[10px] tabular-nums">
                          <span className="font-semibold text-red-400">MAE</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">Rs.{parseFloat(trade.mae).toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* What If I Had Held — closed trades only */}
              {trade.status === 'CLOSED' && trade.exit_price && (
                <WhatIfPanel trade={trade} />
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Journal Card ──────────────────────────────────────────────────────────────

function JournalCard({ journal, trades, onEdit, onDelete, idx }) {
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const emotion = EMOTIONAL_STATES.find(e => e.value === journal.emotional_state)
  const market  = MARKET_CONDITIONS.find(m => m.value === journal.market_condition)
  const linked  = trades.find(t => t.id === journal.trade_id)

  return (
    <div
      onContextMenu={onContextMenu([
        { label: 'Edit Entry', icon: '✏️', action: () => onEdit(journal) },
        { separator: true },
        { label: 'Delete', icon: '🗑️', danger: true, action: () => onDelete(journal.id) },
      ])}
      className={`relative bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-default animate-fade-up`}
      style={{ animationDelay: `${Math.min(idx, 8) * 25}ms` }}
    >
      {/* Emotion accent bar */}
      {emotion && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${emotion.dot}`} />
      )}

      <div className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] font-semibold text-gray-400 tabular-nums">{journal.date}</span>
          {emotion && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${emotion.pill}`}>
              {emotion.label}
            </span>
          )}
          {market && (
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {market.label}
            </span>
          )}
          {linked && (
            <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 tracking-wide">
              {linked.symbol}
            </span>
          )}
        </div>

        {/* Content */}
        {(journal.pre_trade_reasoning || journal.post_trade_evaluation || journal.notes) ? (
          <div className="space-y-2.5">
            {journal.pre_trade_reasoning && (
              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Pre-Trade</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
                  {journal.pre_trade_reasoning}
                </p>
              </div>
            )}
            {journal.post_trade_evaluation && (
              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Post-Trade</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
                  {journal.post_trade_evaluation}
                </p>
              </div>
            )}
            {journal.notes && (
              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Notes</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                  {journal.notes}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-300 dark:text-gray-700 italic">No content</p>
        )}
      </div>
      <ContextMenuPortal />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function LogsPage() {
  const { user }   = useAuth()
  const { t: tr }  = useLanguage()
  const navigate   = useNavigate()

  const [trades, setTrades]             = useState([])
  const [journals, setJournals]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [activeTab, setActiveTab]       = useState('trades')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [editTrade, setEditTrade]       = useState(null)
  const [closeTrade, setCloseTrade]     = useState(null)
  const [partialTrade, setPartialTrade] = useState(null)
  const [journalTrade, setJournalTrade] = useState(null)  // null = hidden, {} = general, trade obj = linked
  const [editJournal, setEditJournal]   = useState(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchSymbol, setSearchSymbol] = useState('')
  // ltpMap: { [symbol]: { price, change, latestDate } }
  const [ltpMap, setLtpMap]             = useState({})
  // sort: { col: 'date'|'entry'|'pnl'|'symbol'|'qty', dir: 'asc'|'desc' }
  const [sort, setSort]                 = useState({ col: 'date', dir: 'desc' })
  // journal filters
  const [jFilterEmotion, setJFilterEmotion] = useState('')
  const [jFilterFrom,    setJFilterFrom]    = useState('')
  const [jFilterTo,      setJFilterTo]      = useState('')
  // group open trades by symbol
  const [groupOpen, setGroupOpen] = useState(false)
  // CSV import modal
  const [showImport, setShowImport] = useState(false)
  // delete confirmation: null | { id, symbol }
  const [confirmDelete, setConfirmDelete] = useState(null)
  // journal text search
  const [jSearch, setJSearch] = useState('')
  // inline error toast for action failures
  const [actionErr, setActionErr] = useState(null)
  // bulk selection: Set of trade IDs
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ⚠️ fetchData MUST be declared before useEffect and useChatRefresh
  // useCallback gives useChatRefresh a stable reference so chatbot events always call the current version
  const fetchData = useCallback(async () => {
    try {
      const [tradesRes, journalsRes] = await Promise.all([getTradeLog(), getTradeJournal()])
      setTrades(tradesRes.data)
      setJournals(journalsRes.data)
      // After trades load, fetch LTP for all unique OPEN/PARTIAL symbols
      const openTrades = tradesRes.data.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
      const uniqueSymbols = [...new Set(openTrades.map(t => t.symbol))]
      if (uniqueSymbols.length > 0) {
        const results = await Promise.allSettled(uniqueSymbols.map(sym => getStockPrice(sym)))
        const map = {}
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            map[uniqueSymbols[i]] = {
              price:      r.value.data.price,
              change:     r.value.data.change,
              latestDate: r.value.data.latestDate,
            }
          }
        })
        setLtpMap(map)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useChatRefresh(['trades', 'journal'], fetchData)

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  const handleCloseTrade = async ({ exit_price, exit_reflection, mfe, mae }) => {
    try {
      const trade = closeTrade
      const res = await closeTradeLog(trade.id, { exit_price, exit_reflection, mfe, mae })
      setTrades(prev => prev.map(t => t.id === trade.id ? res.data : t))
      setCloseTrade(null)

      // Fire AI debrief in background — don't block UI
      getTradeDebrief({
        symbol:          trade.symbol,
        position:        trade.position,
        entry_price:     trade.entry_price,
        exit_price,
        realized_pnl:    res.data.realized_pnl,
        quantity:        trade.remaining_quantity ?? trade.quantity,
        setup_tag:       trade.setup_tag,
        entry_reason:    trade.entry_reason,
        exit_reflection,
        mfe,
        mae,
        sl:              trade.sl,
        tp:              trade.tp,
        date:            trade.date,
      }).then(debriefRes => {
        dispatchDebrief({ symbol: trade.symbol, debrief: debriefRes.data.debrief })
      }).catch(() => {}) // silent fail — debrief is non-critical
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to close trade')
    }
  }

  const handlePartialClose = async ({ exit_price, exit_quantity, reason }) => {
    try {
      const res = await partialCloseTradeLog(partialTrade.id, { exit_price, exit_quantity, reason })
      setTrades(prev => prev.map(t => t.id === partialTrade.id ? res.data : t))
      setPartialTrade(null)
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to partially close trade')
    }
  }

  const handleDelete = (id) => {
    const trade = trades.find(t => t.id === id)
    setConfirmDelete({ id, symbol: trade?.symbol || '?' })
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    try {
      await deleteTradeLog(confirmDelete.id)
      setTrades(prev => prev.filter(t => t.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to delete trade')
      setConfirmDelete(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      await bulkDeleteTradeLog([...selectedIds])
      setTrades(prev => prev.filter(t => !selectedIds.has(t.id)))
      setSelectedIds(new Set())
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to delete selected trades')
    } finally {
      setBulkDeleting(false)
    }
  }

  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTrades.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTrades.map(t => t.id)))
    }
  }

  const handleImportTrade = async (form) => {
    const res = await addTradeLog(form)
    setTrades(prev => [res.data, ...prev])
  }

  const handleImportDone = () => {
    setShowImport(false)
    // Re-fetch to get correct ordering and any server-side fields
    fetchData()
  }

  const handleAddJournal = async (form) => {
    try {
      const res = await addTradeJournal(form)
      setJournals(prev => [res.data, ...prev])
      setJournalTrade(null)
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to save journal entry')
    }
  }

  const handleUpdateJournal = async (form) => {
    try {
      const res = await updateTradeJournal(editJournal.id, form)
      setJournals(prev => prev.map(j => j.id === editJournal.id ? res.data : j))
      setEditJournal(null)
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to update journal entry')
    }
  }

  const handleDeleteJournal = async (id) => {
    try {
      await deleteTradeJournal(id)
      setJournals(prev => prev.filter(j => j.id !== id))
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to delete journal entry')
    }
  }

  // Export filtered trades to CSV
  const exportCSV = () => {
    const rows = filteredTrades
    if (rows.length === 0) return

    const headers = ['Date', 'Symbol', 'Position', 'Quantity', 'Remaining Qty', 'Entry Price', 'SL', 'TP', 'Exit Price', 'Status', 'Realized P&L', 'Notes']
    const escape  = (v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    const csv = [
      headers.join(','),
      ...rows.map(t => [
        t.date,
        t.symbol,
        t.position,
        t.quantity,
        t.remaining_quantity ?? t.quantity,
        t.entry_price,
        t.sl || '',
        t.tp || '',
        t.exit_price || '',
        t.status,
        t.realized_pnl || '',
        escape(t.notes),
      ].map(escape).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `tradeo-trades-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Navigate to Analysis page with symbol + all open positions for that symbol pre-loaded
  const handleGoToChart = (trade) => {
    const allOpenForSymbol = trades.filter(
      t => t.symbol === trade.symbol && (t.status === 'OPEN' || t.status === 'PARTIAL')
    )
    navigate('/screen', {
      state: {
        symbol:    trade.symbol,
        positions: allOpenForSymbol.map(t => ({
          id:                 t.id,
          entry_price:        parseFloat(t.entry_price),
          sl:                 t.sl ? parseFloat(t.sl) : null,
          tp:                 t.tp ? parseFloat(t.tp) : null,
          position:           t.position,
          quantity:           t.quantity,
          remaining_quantity: t.remaining_quantity ?? t.quantity,
          entry_date:         t.date,
        })),
      }
    })
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const toggleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: col === 'pnl' ? 'desc' : 'asc' }
    )
  }

  const filteredTrades = trades
    .filter(t =>
      (filterStatus === 'ALL' || t.status === filterStatus) &&
      (!searchSymbol || t.symbol.includes(searchSymbol.toUpperCase()))
    )
    .sort((a, b) => {
      let av, bv
      if (sort.col === 'date')   { av = a.date;            bv = b.date }
      if (sort.col === 'symbol') { av = a.symbol;          bv = b.symbol }
      if (sort.col === 'entry')  { av = parseFloat(a.entry_price); bv = parseFloat(b.entry_price) }
      if (sort.col === 'qty')    { av = a.remaining_quantity ?? a.quantity; bv = b.remaining_quantity ?? b.quantity }
      if (sort.col === 'pnl')    { av = a.realized_pnl || 0; bv = b.realized_pnl || 0 }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

  const closedTrades    = trades.filter(t => t.status === 'CLOSED')
  const openTrades      = trades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
  const winners         = closedTrades.filter(t => (t.realized_pnl || 0) > 0).length
  const winRate         = closedTrades.length > 0 ? Math.round((winners / closedTrades.length) * 100) : null
  const totalPnl        = trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0)
  const openCount       = trades.filter(t => t.status === 'OPEN').length
  const partialCount    = trades.filter(t => t.status === 'PARTIAL').length

  // Total unrealized P&L across all open/partial positions using live LTP
  const totalUnrealized = openTrades.reduce((sum, t) => {
    const ltp = ltpMap[t.symbol]
    if (!ltp?.price) return sum
    const qty = t.remaining_quantity ?? t.quantity
    const entry = parseFloat(t.entry_price)
    const u = t.position === 'LONG'
      ? (ltp.price - entry) * qty
      : (entry - ltp.price) * qty
    return sum + u
  }, 0)

  // ── Drawdown from peak equity ─────────────────────────────────────────────
  // Walk closed trades sorted by date, build running equity curve, find peak → drawdown
  const drawdown = (() => {
    const sorted = [...closedTrades].sort((a, b) => (a.updated_at || a.date) < (b.updated_at || b.date) ? -1 : 1)
    if (sorted.length === 0) return null
    let equity = 0, peak = 0, maxDD = 0
    for (const t of sorted) {
      equity += parseFloat(t.realized_pnl) || 0
      if (equity > peak) peak = equity
      const dd = peak - equity
      if (dd > maxDD) maxDD = dd
    }
    const currentDD = peak - equity
    return {
      current: currentDD,          // Rs. drawdown from peak
      peak,                        // peak equity reached
      pct: peak > 0 ? (currentDD / peak) * 100 : 0,
    }
  })()

  // ── Daily P&L streak (last 7 closed-trade days) ──────────────────────────
  const dailyStreak = (() => {
    // Group closed trades by date, sum P&L per day
    const byDate = {}
    for (const t of closedTrades) {
      const d = (t.updated_at || t.date || '').slice(0, 10)
      if (!d) continue
      byDate[d] = (byDate[d] || 0) + (parseFloat(t.realized_pnl) || 0)
    }
    const days = Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .slice(0, 7)
      .reverse()                               // oldest first for display
    return days.map(([date, pnl]) => ({ date, pnl, win: pnl > 0 }))
  })()

  // ── Not logged in ────────────────────────────────────────────────────────────

  if (!user) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center max-w-sm">
        <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
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
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[11px] text-gray-400">Loading trade log…</p>
      </div>
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-3 sm:px-6 pt-4 sm:pt-6 pb-12 max-w-7xl mx-auto">

      {/* ── Modals ── */}
      {showChecklist && (
        <ChecklistModal
          onClose={() => setShowChecklist(false)}
          onPass={() => { setShowChecklist(false); setShowAddModal(true) }}
        />
      )}
      {showAddModal && (
        <AddTradeModal
          onClose={() => { setShowAddModal(false); setEditTrade(null) }}
          onSave={handleAddTrade}
          editTrade={editTrade}
          openTrades={openTrades}
        />
      )}
      {showImport && (
        <ImportCSVModal
          onClose={handleImportDone}
          onImport={handleImportTrade}
        />
      )}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-xs p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white text-center mb-1">Delete Trade?</p>
            <p className="text-[11px] text-gray-400 text-center mb-5">
              This will permanently remove the <span className="font-semibold text-gray-600 dark:text-gray-300">{confirmDelete.symbol}</span> trade and cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
      {editJournal && (
        <JournalModal
          onClose={() => setEditJournal(null)}
          onSave={handleUpdateJournal}
          editJournal={editJournal}
        />
      )}

      {/* ── Action error toast ── */}
      {actionErr && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/30 rounded-xl">
          <p className="text-[11px] text-red-500 font-medium">{actionErr}</p>
          <button onClick={() => setActionErr(null)} className="text-red-400 hover:text-red-600 text-[14px] leading-none flex-shrink-0">×</button>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">
            {tr('trader.title')}
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{tr('trader.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button
            onClick={() => { setEditTrade(null); setShowChecklist(true) }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {tr('trader.addTrade')}
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {[
          {
            label: 'Trades',
            value: trades.length,
            color: 'text-gray-900 dark:text-white',
            sub:   null,
          },
          {
            label: 'Open',
            value: openCount,
            color: 'text-blue-500',
            sub:   partialCount > 0 ? `${partialCount} partial` : null,
          },
          {
            label: 'Win Rate',
            value: winRate !== null ? `${winRate}%` : '—',
            color: winRate !== null ? (winRate >= 50 ? 'text-emerald-500' : 'text-red-400') : 'text-gray-400',
            sub:   closedTrades.length > 0 ? `${winners}/${closedTrades.length} closed` : null,
          },
          {
            label: 'Realized P&L',
            value: totalPnl !== 0
              ? `${totalPnl > 0 ? '+' : '−'}Rs.${Math.abs(Math.round(totalPnl)).toLocaleString()}`
              : '—',
            color: totalPnl > 0 ? 'text-emerald-500' : totalPnl < 0 ? 'text-red-400' : 'text-gray-400',
            sub:   null,
          },
          {
            label: 'Unrealized',
            value: Object.keys(ltpMap).length > 0
              ? (totalUnrealized !== 0
                  ? `${totalUnrealized > 0 ? '+' : '−'}Rs.${Math.abs(Math.round(totalUnrealized)).toLocaleString()}`
                  : '—')
              : openTrades.length > 0 ? 'Loading…' : '—',
            color: totalUnrealized > 0 ? 'text-emerald-500' : totalUnrealized < 0 ? 'text-red-400' : 'text-gray-400',
            sub:   Object.keys(ltpMap).length > 0 ? 'at current LTP' : null,
          },
          {
            label: 'Net P&L',
            value: (() => {
              const net = totalPnl + (Object.keys(ltpMap).length > 0 ? totalUnrealized : 0)
              return net !== 0
                ? `${net > 0 ? '+' : '−'}Rs.${Math.abs(Math.round(net)).toLocaleString()}`
                : '—'
            })(),
            color: (() => {
              const net = totalPnl + (Object.keys(ltpMap).length > 0 ? totalUnrealized : 0)
              return net > 0 ? 'text-emerald-500' : net < 0 ? 'text-red-400' : 'text-gray-400'
            })(),
            sub: 'realized + unreal.',
          },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 text-center">
            <p className={`text-[14px] font-black tracking-tight tabular-nums leading-tight ${s.color}`}>{s.value}</p>
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">{s.label}</p>
            {s.sub && <p className="text-[8px] text-gray-300 dark:text-gray-700 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Drawdown + Streak widgets ── */}
      {(drawdown || dailyStreak.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">

          {/* Drawdown widget */}
          {drawdown && (
            <div className={`bg-white dark:bg-gray-900 rounded-xl border px-4 py-3 ${
              drawdown.current > 0
                ? 'border-red-200 dark:border-red-800/40'
                : 'border-gray-100 dark:border-gray-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Drawdown from Peak</p>
                {drawdown.current > 0 && (
                  <span className="text-[8px] font-semibold text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
                    {drawdown.pct.toFixed(1)}%
                  </span>
                )}
              </div>
              {drawdown.current > 0 ? (
                <>
                  <p className="text-[20px] font-black tracking-tight text-red-500 tabular-nums leading-none">
                    −Rs.{Math.round(drawdown.current).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1">
                    Peak equity: Rs.{Math.round(drawdown.peak).toLocaleString()}
                  </p>
                  {/* Drawdown bar */}
                  <div className="mt-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${Math.min(drawdown.pct, 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-[15px] font-black text-emerald-500 tabular-nums">At peak equity</p>
              )}
            </div>
          )}

          {/* Daily streak widget */}
          {dailyStreak.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3">
              <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-2">
                Daily P&L Streak <span className="normal-case font-normal text-gray-300">(last {dailyStreak.length} days)</span>
              </p>
              <div className="flex items-end gap-1.5">
                {dailyStreak.map(({ date, pnl, win }, i) => (
                  <div key={date} className="flex flex-col items-center flex-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-gray-900 dark:bg-gray-700 text-white rounded-lg px-2 py-1 text-[9px] font-semibold whitespace-nowrap shadow-lg">
                        {pnl > 0 ? '+' : '−'}Rs.{Math.abs(Math.round(pnl)).toLocaleString()}
                        <span className="block text-[8px] text-gray-400 font-normal text-center">{date.slice(5)}</span>
                      </div>
                      <div className="w-1.5 h-1.5 bg-gray-900 dark:bg-gray-700 rotate-45 -mt-0.5" />
                    </div>
                    <div className={`w-full rounded-sm ${win ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ height: '20px' }}
                    />
                    <span className="text-[8px] mt-1 text-gray-400 tabular-nums">{date.slice(8)}</span>
                  </div>
                ))}
              </div>
              {/* Current streak count */}
              {(() => {
                let streak = 0, type = null
                for (let i = dailyStreak.length - 1; i >= 0; i--) {
                  const { win } = dailyStreak[i]
                  if (type === null) { type = win; streak = 1 }
                  else if (win === type) streak++
                  else break
                }
                return streak > 1 ? (
                  <p className={`text-[9px] mt-2 font-semibold ${type ? 'text-emerald-500' : 'text-red-400'}`}>
                    {streak} {type ? 'winning' : 'losing'} days in a row
                  </p>
                ) : null
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs + Journal button ── */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-0.5">
        {[
          { key: 'trades',     label: tr('trader.tabLog') },
          { key: 'journal',    label: tr('trader.tabJournal') },
          { key: 'stats',      label: 'Stats' },
          { key: 'rules',      label: 'Rules' },
          { key: 'tax',        label: 'Tax' },
          { key: 'benchmarks', label: 'Benchmarks' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            {tab.label}
          </button>
        ))}

        <button
          onClick={() => setJournalTrade({})}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Quick Journal
        </button>
      </div>

      {/* ── Trades tab ── */}
      {activeTab === 'trades' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={searchSymbol}
                onChange={e => { setSearchSymbol(e.target.value); setSelectedIds(new Set()) }}
                placeholder="Search symbol…"
                className="pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 w-32 transition-colors"
              />
            </div>

            {/* Group toggle */}
            <button
              onClick={() => setGroupOpen(g => !g)}
              title="Group open positions by symbol"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                groupOpen
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8M4 18h8" />
              </svg>
              Group
            </button>

            {/* Status filters */}
            <div className="flex gap-1">
              {[
                { key: 'ALL',     label: 'All' },
                { key: 'OPEN',    label: 'Open' },
                { key: 'PARTIAL', label: 'Partial' },
                { key: 'CLOSED',  label: 'Closed' },
              ].map(s => (
                <button key={s.key} onClick={() => { setFilterStatus(s.key); setSelectedIds(new Set()) }}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    filterStatus === s.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-red-500 hover:text-white hover:bg-red-600 border border-red-300 dark:border-red-800 hover:border-red-600 disabled:opacity-50 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-gray-400">
                    {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
                    {filteredTrades.some(t => t.notes || t.entry_reason || t.exit_reflection || t.partial_exits?.length > 0 || t.exit_price) && (
                      <span className="text-gray-300 dark:text-gray-700"> · click to expand</span>
                    )}
                  </span>
                  {filteredTrades.length > 0 && (
                    <button
                      onClick={exportCSV}
                      title="Export to CSV"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      CSV
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Empty state */}
          {filteredTrades.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-[12px] font-medium text-gray-400">{tr('trader.noTrades')}</p>
              <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1">{tr('trader.noTradesHint')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {/* Checkbox select-all */}
                    <th className="pl-4 pr-2 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={filteredTrades.length > 0 && selectedIds.size === filteredTrades.length}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
                      />
                    </th>
                    {[
                      { label: 'Date',        col: 'date'   },
                      { label: 'Symbol',      col: 'symbol' },
                      { label: 'Qty',         col: 'qty'    },
                      { label: 'Entry / LTP', col: 'entry'  },
                      { label: 'SL / TP',     col: null     },
                      { label: 'P&L',         col: 'pnl'    },
                      { label: 'Status',      col: null     },
                      { label: '',            col: null     },
                    ].map((h, i) => (
                      <th
                        key={i}
                        onClick={() => h.col && toggleSort(h.col)}
                        className={`px-4 py-2.5 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest select-none ${h.col ? 'cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors' : ''}`}
                      >
                        {h.col ? (
                          <span className="inline-flex items-center gap-1">
                            {h.label}
                            <span className={`transition-opacity ${sort.col === h.col ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                              {sort.col === h.col
                                ? sort.dir === 'asc' ? '↑' : '↓'
                                : '↕'}
                            </span>
                          </span>
                        ) : h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupOpen ? (() => {
                    // Split filtered into open (group by symbol) + closed (flat)
                    const openFiltered   = filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
                    const closedFiltered = filteredTrades.filter(t => t.status === 'CLOSED')

                    // Group open by symbol, preserving sort order of first appearance
                    const groupMap = {}
                    openFiltered.forEach(t => {
                      if (!groupMap[t.symbol]) groupMap[t.symbol] = []
                      groupMap[t.symbol].push(t)
                    })
                    const groups = Object.entries(groupMap)

                    const rowProps = {
                      onEdit:         (t) => { setEditTrade(t); setShowAddModal(true) },
                      onClose:        (t) => setCloseTrade(t),
                      onPartialClose: (t) => setPartialTrade(t),
                      onDelete:       handleDelete,
                      onJournal:      (t) => setJournalTrade(t),
                      onGoToChart:    handleGoToChart,
                      onToggleSelect: toggleSelectId,
                    }

                    return (
                      <>
                        {groups.map(([sym, entries]) =>
                          entries.length === 1
                            ? <TradeRow key={entries[0].id} trade={entries[0]} ltp={ltpMap[sym] || null} isSelected={selectedIds.has(entries[0].id)} {...rowProps} />
                            : <GroupedTradeRow key={sym} symbol={sym} entries={entries} ltp={ltpMap[sym] || null} {...rowProps} selectedIds={selectedIds} />
                        )}
                        {closedFiltered.map(trade => (
                          <TradeRow key={trade.id} trade={trade} ltp={null} isSelected={selectedIds.has(trade.id)} {...rowProps} />
                        ))}
                      </>
                    )
                  })() : filteredTrades.map(trade => (
                    <TradeRow
                      key={trade.id}
                      trade={trade}
                      ltp={ltpMap[trade.symbol] || null}
                      onEdit={(t) => { setEditTrade(t); setShowAddModal(true) }}
                      onClose={(t) => setCloseTrade(t)}
                      onPartialClose={(t) => setPartialTrade(t)}
                      onDelete={handleDelete}
                      onJournal={(t) => setJournalTrade(t)}
                      onGoToChart={handleGoToChart}
                      onToggleSelect={toggleSelectId}
                      isSelected={selectedIds.has(trade.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Journal tab ── */}
      {activeTab === 'journal' && (() => {
        const searchLower = jSearch.trim().toLowerCase()
        const filteredJournals = journals.filter(j => {
          if (jFilterEmotion && j.emotional_state !== jFilterEmotion) return false
          if (jFilterFrom    && j.date < jFilterFrom)                  return false
          if (jFilterTo      && j.date > jFilterTo)                    return false
          if (searchLower && ![
            j.pre_trade_reasoning, j.post_trade_evaluation, j.notes
          ].some(f => f?.toLowerCase().includes(searchLower)))         return false
          return true
        })
        const hasFilters = jFilterEmotion || jFilterFrom || jFilterTo || jSearch

        return (
          <div className="space-y-3">

            {/* Journal filter bar */}
            {journals.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Emotion pills */}
                <div className="flex gap-1 flex-wrap">
                  {EMOTIONAL_STATES.map(es => (
                    <button
                      key={es.value}
                      onClick={() => setJFilterEmotion(prev => prev === es.value ? '' : es.value)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                        jFilterEmotion === es.value
                          ? es.pill + ' border-current'
                          : 'bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-400'
                      }`}
                    >
                      {es.label}
                    </button>
                  ))}
                </div>

                {/* Text search */}
                <div className="relative w-full mt-1">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text" value={jSearch}
                    onChange={e => setJSearch(e.target.value)}
                    placeholder="Search pre-trade, post-trade, notes…"
                    className="w-full pl-7 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-[10px] text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                  />
                </div>

                {/* Date range */}
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="date" value={jFilterFrom}
                    onChange={e => setJFilterFrom(e.target.value)}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <span className="text-[10px] text-gray-400">—</span>
                  <input
                    type="date" value={jFilterTo}
                    onChange={e => setJFilterTo(e.target.value)}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  {hasFilters && (
                    <button
                      onClick={() => { setJFilterEmotion(''); setJFilterFrom(''); setJFilterTo(''); setJSearch('') }}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-red-400 border border-gray-200 dark:border-gray-800 hover:border-red-300 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Count */}
                <span className="text-[10px] text-gray-400 w-full">
                  {filteredJournals.length} of {journals.length} entr{journals.length !== 1 ? 'ies' : 'y'}
                  {hasFilters && ' · filtered'}
                </span>
              </div>
            )}

            {/* No entries at all */}
            {journals.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-20 text-center">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <p className="text-[12px] font-medium text-gray-400">No journal entries yet</p>
                <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1">Right-click a trade → Journal, or use Quick Journal above</p>
              </div>
            )}

            {/* Entries exist but filter returns nothing */}
            {journals.length > 0 && filteredJournals.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-14 text-center">
                <p className="text-[12px] font-medium text-gray-400">No entries match this filter</p>
                <button
                  onClick={() => { setJFilterEmotion(''); setJFilterFrom(''); setJFilterTo(''); setJSearch('') }}
                  className="mt-2 text-[10px] text-blue-500 hover:text-blue-400"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Cards grid */}
            {filteredJournals.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredJournals.map((j, idx) => (
                  <JournalCard
                    key={j.id}
                    journal={j}
                    trades={trades}
                    onEdit={setEditJournal}
                    onDelete={handleDeleteJournal}
                    idx={idx}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {/* ── Stats tab ── */}
      {activeTab === 'stats' && (
        <StatsPanel trades={trades} />
      )}

      {/* ── Rules tab ── */}
      {activeTab === 'rules' && (
        <RulesPanel />
      )}

      {/* ── Tax tab ── */}
      {activeTab === 'tax' && (
        <TaxPanel />
      )}

      {/* ── Benchmarks tab ── */}
      {activeTab === 'benchmarks' && (
        <BenchmarkPanel />
      )}

    </div>
  )
}

export default LogsPage
