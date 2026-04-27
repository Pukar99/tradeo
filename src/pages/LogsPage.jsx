import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useMarket } from '../context/MarketContext'
import {
  getTradeLog, addTradeLog, updateTradeLog,
  closeTradeLog, partialCloseTradeLog, deleteTradeLog, bulkDeleteTradeLog,
  getTradeJournal, addTradeJournal, updateTradeJournal, deleteTradeJournal,
  getBatchPrices, getTradeDebrief, getWhatIf,
  getMarketJournals, autoCreateMarketJournal,
} from '../api'
import { useChatRefresh, dispatchDebrief } from '../utils/chatEvents'

// Tab components
import TradesTab   from '../components/logs/TradesTab'
import JournalTab  from '../components/logs/JournalTab'
import AuditTab    from '../components/logs/AuditTab'

// ── Constants ─────────────────────────────────────────────────────────────────

const FOREX_SYMBOLS = [
  'XAUUSD','XAGUSD',
  'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','NZDUSD','USDCAD',
  'EURJPY','GBPJPY','EURGBP','AUDCAD','CADJPY','CHFJPY',
  'BTCUSD','ETHUSD',
]

const NEPSE_SYMBOLS = [
  'NTC','NABIL','SCB','EBL','NICA','HBL','KBL','MBL','CZBIL','SBI',
  'ADBL','GBIME','PCBL','SANIMA','NMB','SRBL','NBB','PRVU','CBL','CCBL',
  'RHPL','PPCL','SHPC','BPCL','NHPC','RRHP','KPCL','MHNL','RADHI','HPPL',
  'NLIC','LICN','SLICL','NICL','PICL','SICL','GILC','ALICL','AIL','HGIL',
  'UPPER','UMHL','CHCL','API','GHL','HURJA','RURU','TPHL','KBBL','SSHL',
  'NIFRA','NIDC','HIDCL','BHPL','NGPL','BARUN','KKHC','DHPL','NHDL','SMHL',
  'NRIC','SPIL','RBCL','MANDU','DOLTI','USHEC','RIDI','BGWT','NGADI','KANI',
  'AKPL','SAHAS','PMHPL','SJCL','UMRH','HPCL','JOSHI','SWBBL','CEDB','SHINE',
  'MEGA','GMFIL','SIFC','SKDBL',
]

const EMOTIONAL_STATES = [
  { value: 'confident', label: '💪 Confident', dot: 'bg-blue-400',    pill: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',   accent: 'border-blue-400' },
  { value: 'calm',      label: '😌 Calm',      dot: 'bg-emerald-400', pill: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400', accent: 'border-emerald-400' },
  { value: 'anxious',   label: '😰 Anxious',   dot: 'bg-yellow-400',  pill: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400', accent: 'border-yellow-400' },
  { value: 'fearful',   label: '😨 Fearful',   dot: 'bg-orange-400',  pill: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400', accent: 'border-orange-400' },
  { value: 'greedy',    label: '🤑 Greedy',    dot: 'bg-red-400',     pill: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400',       accent: 'border-red-400' },
  { value: 'fomo',      label: '😱 FOMO',      dot: 'bg-purple-400',  pill: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400', accent: 'border-purple-400' },
  { value: 'neutral',   label: '😐 Neutral',   dot: 'bg-gray-400',    pill: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',     accent: 'border-gray-400' },
]

const MARKET_CONDITIONS = [
  { value: 'bullish',    label: '↑ Bullish' },
  { value: 'bearish',    label: '↓ Bearish' },
  { value: 'sideways',   label: '→ Sideways' },
  { value: 'volatile',   label: '⚡ Volatile' },
  { value: 'low_volume', label: '○ Low Vol' },
]

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
  try { const s = localStorage.getItem(CHECKLIST_KEY); if (s) return JSON.parse(s) } catch {}
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
  const toggle = (i) => setChecked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  const handlePass = () => { if (!allChecked) return; onPass(checked.map(i => items[i])) }
  const handleSaveEdit = () => {
    const updated = draft.split('\n').map(s => s.trim()).filter(Boolean)
    if (updated.length === 0) return
    setItems(updated); saveChecklistItems(updated); setChecked([]); setEditing(false)
  }
  const handleSkip = () => onPass([])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}>
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
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2.5 max-h-80 overflow-y-auto">
          {editing ? (
            <div>
              <p className="text-[9px] text-gray-400 mb-1.5">One item per line</p>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={8}
                className="w-full text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-400 resize-none" />
              <button onClick={handleSaveEdit}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-xl py-2 transition-colors">
                Save Items
              </button>
            </div>
          ) : items.map((item, i) => (
            <button key={item} onClick={() => toggle(i)}
              className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border transition-all ${
                checked.includes(i)
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                  : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                checked.includes(i) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'
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
          ))}
        </div>
        {!editing && (
          <div className="px-5 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
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
            <button onClick={handleSkip} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3 py-1.5 rounded-lg transition-colors">Skip</button>
            <button onClick={handlePass} disabled={!allChecked}
              className={`px-4 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                allChecked ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
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

function AddTradeModal({ onClose, onSave, editTrade, openTrades = [], market = 'nepse' }) {
  const isForex = market === 'forex'
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    symbol: '', position: 'LONG', quantity: '',
    entry_price: '', sl: '', tp: '', notes: '', setup_tag: '', entry_reason: '',
    market, lots: '', pip_value: '',
  })
  const [brokerMsg,         setBrokerMsg]         = useState('')
  const [brokerParsed,      setBrokerParsed]       = useState(null)
  const [symbolSuggestions, setSymbolSuggestions]  = useState([])
  const [slWarning,         setSlWarning]          = useState('')
  const [rrRatio,           setRrRatio]            = useState(null)
  const [saving,            setSaving]             = useState(false)
  const [saveErr,           setSaveErr]            = useState(null)
  const [showBroker,        setShowBroker]         = useState(false)

  useEffect(() => {
    if (editTrade) {
      setForm({
        date: editTrade.date, symbol: editTrade.symbol, position: editTrade.position,
        quantity: editTrade.quantity, entry_price: editTrade.entry_price,
        sl: editTrade.sl || '', tp: editTrade.tp || '', notes: editTrade.notes || '',
        setup_tag: editTrade.setup_tag || '', entry_reason: editTrade.entry_reason || '',
        market: editTrade.market || market, lots: editTrade.lots || '', pip_value: editTrade.pip_value || '',
      })
    }
  }, [editTrade, market])

  useEffect(() => {
    const e = parseFloat(form.entry_price), s = parseFloat(form.sl), t = parseFloat(form.tp)
    if (e && s && t) {
      const risk = Math.abs(e - s)
      setRrRatio(risk > 0 ? (Math.abs(t - e) / risk).toFixed(2) : null)
    } else setRrRatio(null)
    if (e && s) {
      const d = Math.abs(((e - s) / e) * 100)
      setSlWarning(d > 10 ? 'SL is more than 10% away — very wide risk' : d < 0.5 ? 'SL is too tight — may get stopped out easily' : '')
    } else setSlWarning('')
  }, [form.entry_price, form.sl, form.tp])

  const handleSymbolInput = (val) => {
    const upper = val.toUpperCase()
    setForm(p => ({ ...p, symbol: upper }))
    const pool = isForex ? FOREX_SYMBOLS : NEPSE_SYMBOLS
    setSymbolSuggestions(upper.length >= 1 ? pool.filter(s => s.startsWith(upper)).slice(0, 6) : [])
  }

  const handleBrokerParse = () => {
    const parsed = parseBrokerMessage(brokerMsg)
    if (parsed) {
      setBrokerParsed(parsed)
      setForm(p => ({ ...p, symbol: parsed.symbol || p.symbol, quantity: parsed.quantity || p.quantity, entry_price: parsed.entry_price || p.entry_price, position: parsed.position || p.position, date: parsed.date || p.date }))
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

  const rrVal   = parseFloat(rrRatio)
  const rrColor = rrRatio ? (rrVal >= 2 ? 'text-emerald-500' : rrVal >= 1 ? 'text-amber-500' : 'text-red-400') : ''
  const rrBg    = rrRatio ? (rrVal >= 2 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30' : rrVal >= 1 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30') : ''
  const rrLabel = rrRatio ? (rrVal >= 2 ? 'Excellent setup' : rrVal >= 1 ? 'Acceptable setup' : 'Poor setup') : ''

  const duplicates = !editTrade && form.symbol.length >= 2
    ? openTrades.filter(t => t.symbol === form.symbol && (t.status === 'OPEN' || t.status === 'PARTIAL'))
    : []
  const dupTotalQty    = duplicates.reduce((s, t) => s + (parseFloat(t.remaining_quantity ?? t.quantity) || 0), 0)
  const dupWeightedAvg = dupTotalQty > 0
    ? duplicates.reduce((s, t) => s + (parseFloat(t.entry_price) || 0) * (parseFloat(t.remaining_quantity ?? t.quantity) || 0), 0) / dupTotalQty
    : null

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader title={editTrade ? 'Edit Trade' : 'Log New Trade'} sub={editTrade ? `Editing ${editTrade.symbol}` : 'Record your entry with precision'} onClose={onClose} />
      <div className="p-5 space-y-4">
        <button type="button" onClick={() => setShowBroker(!showBroker)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-[11px] text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {showBroker ? 'Hide broker paste' : 'Paste broker message'}
        </button>
        {showBroker && (
          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <textarea value={brokerMsg} onChange={e => setBrokerMsg(e.target.value)}
              placeholder="e.g. you bought RHPL-2000.0@292.74 on 2026-04-09..." rows={2}
              className={INPUT + ' resize-none bg-white dark:bg-gray-900'} />
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBrokerParse}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors">
                Extract Data
              </button>
              {brokerParsed && (
                <span className="text-[10px] text-emerald-500 font-medium">
                  ✓ {brokerParsed.position} {brokerParsed.quantity} {brokerParsed.symbol} @ {isForex ? '$' : 'Rs.'}{brokerParsed.entry_price}
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
              <input type="text" value={form.symbol} onChange={e => handleSymbolInput(e.target.value)}
                placeholder="NTC" className={INPUT + ' uppercase font-semibold tracking-widest'} required />
              {symbolSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden">
                  {symbolSuggestions.map(s => (
                    <button key={s} type="button" onClick={() => { setForm(p => ({ ...p, symbol: s })); setSymbolSuggestions([]) }}
                      className="w-full text-left px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200 tracking-wider hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className={LABEL}>Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {['LONG', 'SHORT'].map(p => (
                <button key={p} type="button" onClick={() => setForm(prev => ({ ...prev, position: p }))}
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
          <div className="grid grid-cols-2 gap-3">
            {isForex ? (
              <>
                <div>
                  <label className={LABEL}>Lots <span className="normal-case text-gray-300 font-normal">e.g. 0.01, 0.1, 1</span></label>
                  <input type="number" step="0.01" value={form.lots}
                    onChange={e => setForm(p => ({ ...p, lots: e.target.value, quantity: e.target.value }))}
                    placeholder="0.10" className={INPUT} required />
                </div>
                <div>
                  <label className={LABEL}>Entry Price <span className="normal-case text-gray-300 font-normal">USD</span></label>
                  <input type="number" step="0.00001" value={form.entry_price}
                    onChange={e => setForm(p => ({ ...p, entry_price: e.target.value }))}
                    placeholder="2000.00" className={INPUT} required />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
          {isForex && (
            <div>
              <label className={LABEL}>Pip Value <span className="normal-case text-gray-300 font-normal">$ per pip (optional)</span></label>
              <input type="number" step="0.01" value={form.pip_value}
                onChange={e => setForm(p => ({ ...p, pip_value: e.target.value }))}
                placeholder="e.g. 1.00 for 0.1 lot XAUUSD" className={INPUT} />
              <p className="text-[9px] text-gray-400 mt-1">For Gold: 1 pip = $0.1 per 0.01 lot. Broker may vary.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Stop Loss <span className="normal-case font-normal text-gray-300">optional</span></label>
              <input type="number" step={isForex ? '0.00001' : '0.01'} value={form.sl}
                onChange={e => setForm(p => ({ ...p, sl: e.target.value }))} placeholder="0.00" className={INPUT} />
              {!form.sl && <p className="text-[9px] text-amber-500 mt-1.5 font-medium">Always define your risk</p>}
              {slWarning && <p className="text-[9px] text-red-400 mt-1.5">{slWarning}</p>}
            </div>
            <div>
              <label className={LABEL}>Take Profit <span className="normal-case font-normal text-gray-300">optional</span></label>
              <input type="number" step={isForex ? '0.00001' : '0.01'} value={form.tp}
                onChange={e => setForm(p => ({ ...p, tp: e.target.value }))} placeholder="0.00" className={INPUT} />
            </div>
          </div>
          {duplicates.length > 0 && (
            <div className="flex gap-3 px-3.5 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <span className="text-amber-500 text-[14px] flex-shrink-0 mt-0.5">⚠</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  You already have {duplicates.length} open {form.symbol} position{duplicates.length > 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
                  {dupTotalQty} units · Avg entry {isForex ? '$' : 'Rs.'}{dupWeightedAvg?.toFixed(2) ?? '—'} · Adding a separate entry row
                </p>
              </div>
            </div>
          )}
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
          <div>
            <label className={LABEL}>Setup Type <span className="normal-case font-normal text-gray-300">optional</span></label>
            <select value={form.setup_tag} onChange={e => setForm(p => ({ ...p, setup_tag: e.target.value }))} className={INPUT + ' cursor-pointer'}>
              <option value="">— None —</option>
              {SETUP_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Why I'm taking this trade <span className="normal-case font-normal text-gray-300 ml-1">decision log</span></label>
            <textarea value={form.entry_reason} onChange={e => setForm(p => ({ ...p, entry_reason: e.target.value }))}
              placeholder="e.g. Breakout above 52-week high on 2x volume, sector rotating into banking, SL at swing low 3%"
              rows={2} className={INPUT + ' resize-none leading-relaxed'} />
          </div>
          <div>
            <label className={LABEL}>Trade Thesis <span className="normal-case font-normal text-gray-300">optional deeper notes</span></label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Technical confluence, fundamentals, news catalyst..."
              rows={2} className={INPUT + ' resize-none leading-relaxed'} />
          </div>
          {saveErr && (
            <p className="text-[11px] text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">{saveErr}</p>
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
  const [exitPrice,      setExitPrice]      = useState('')
  const [exitQty,        setExitQty]        = useState('')
  const [reason,         setReason]         = useState('target')
  const [exitReflection, setExitReflection] = useState('')
  const [mfe,            setMfe]            = useState('')
  const [mae,            setMae]            = useState('')
  const [saving,         setSaving]         = useState(false)
  const [closeErr,       setCloseErr]       = useState(null)

  const remaining  = parseInt(trade.remaining_quantity ?? trade.quantity) || 0
  const entryPrice = parseFloat(trade.entry_price)
  const pnlPreview = exitPrice
    ? (trade.position === 'LONG'
        ? (parseFloat(exitPrice) - entryPrice)
        : (entryPrice - parseFloat(exitPrice))
      ) * (isPartial ? parseFloat(exitQty || 0) : remaining)
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isPartial && parseFloat(exitQty) > remaining) { setCloseErr(`Cannot close more than ${remaining} units`); return }
    setSaving(true); setCloseErr(null)
    try {
      await onSave({ exit_price: parseFloat(exitPrice), exit_quantity: parseFloat(exitQty), reason, exit_reflection: exitReflection || null, mfe: mfe !== '' ? parseFloat(mfe) : null, mae: mae !== '' ? parseFloat(mae) : null })
      onClose()
    } catch (err) { setCloseErr(err.response?.data?.error || 'Failed to close trade') }
    finally { setSaving(false) }
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
        sub={`${trade.symbol} · ${trade.position} · ${trade.market === 'forex' && trade.lots ? `${parseFloat(trade.lots)} lot` : `${remaining} units`} @ ${trade.market === 'forex' ? '$' : 'Rs.'}${entryPrice.toFixed(2)}`}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {isPartial && (
          <div>
            <label className={LABEL}>Units to close <span className="normal-case font-normal text-gray-300">(max {remaining})</span></label>
            <input type="number" value={exitQty} onChange={e => setExitQty(e.target.value)}
              placeholder={`1 – ${remaining}`} max={remaining} min={1} className={INPUT} required />
          </div>
        )}
        <div>
          <label className={LABEL}>Exit Price <span className="normal-case font-normal text-gray-300">{trade.market === 'forex' ? 'USD' : 'Rs.'}</span></label>
          <input type="number" step={trade.market === 'forex' ? '0.00001' : '0.01'} value={exitPrice}
            onChange={e => setExitPrice(e.target.value)} placeholder="0.00" className={INPUT} required />
        </div>
        <div>
          <label className={LABEL}>Close Reason</label>
          <div className="grid grid-cols-3 gap-1.5">
            {REASONS.map(r => (
              <button key={r.value} type="button" onClick={() => setReason(r.value)}
                className={`py-2 rounded-lg text-[11px] font-semibold transition-all ${
                  reason === r.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}>
                <span className="block text-[13px] mb-0.5">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {pnlPreview !== null && (
          <div className={`px-4 py-4 rounded-xl text-center ${
            pnlPreview >= 0
              ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-800/30'
              : 'bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30'
          }`}>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Estimated P&L</p>
            <p className={`text-2xl font-black tracking-tight ${pnlPreview >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {pnlPreview >= 0 ? '+' : '−'}{trade.market === 'forex' ? '$' : 'Rs.'}
              {trade.market === 'forex' ? Math.abs(pnlPreview).toFixed(2) : Math.abs(Math.round(pnlPreview)).toLocaleString()}
            </p>
          </div>
        )}
        {!isPartial && (
          <>
            <div className="space-y-2">
              <p className={LABEL}>Price extremes during hold <span className="normal-case font-normal text-gray-300">optional</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold text-emerald-500 mb-1">MFE — Highest price seen</label>
                  <input type="number" step="0.01" value={mfe} onChange={e => setMfe(e.target.value)} placeholder="e.g. 325.00" className={INPUT} />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-red-400 mb-1">MAE — Lowest price seen</label>
                  <input type="number" step="0.01" value={mae} onChange={e => setMae(e.target.value)} placeholder="e.g. 280.00" className={INPUT} />
                </div>
              </div>
              <p className="text-[9px] text-gray-300 dark:text-gray-700">Helps calibrate where to set TP and how tight your SL should be.</p>
            </div>
            <div>
              <label className={LABEL}>What happened? What would you do differently? <span className="normal-case font-normal text-gray-300 ml-1">decision log</span></label>
              <textarea value={exitReflection} onChange={e => setExitReflection(e.target.value)}
                placeholder="e.g. Hit TP cleanly. Should have held longer — stock ran 5% more after exit. Entry timing was good."
                rows={2} className={INPUT + ' resize-none leading-relaxed'} />
            </div>
          </>
        )}
        {closeErr && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-3 py-2">{closeErr}</p>}
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

// ── Journal Modal (trade journal) ─────────────────────────────────────────────

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
    try { await onSave({ ...form, trade_id: tradeId || null }); onClose() }
    catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader title={editJournal ? 'Edit Journal Entry' : 'Journal Entry'} sub={tradeName ? `Linked to ${tradeName}` : 'General market reflection'} onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={INPUT} />
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
        <div>
          <label className={LABEL}>Pre-Trade Reasoning</label>
          <textarea value={form.pre_trade_reasoning} onChange={e => setForm(p => ({ ...p, pre_trade_reasoning: e.target.value }))}
            placeholder="Why did you take this trade? What was your setup, confluence, catalyst?" rows={3} className={INPUT + ' resize-none leading-relaxed'} />
        </div>
        <div>
          <label className={LABEL}>Post-Trade Evaluation</label>
          <textarea value={form.post_trade_evaluation} onChange={e => setForm(p => ({ ...p, post_trade_evaluation: e.target.value }))}
            placeholder="How did it play out? Did you follow your plan? What would you do differently?" rows={3} className={INPUT + ' resize-none leading-relaxed'} />
        </div>
        <div>
          <label className={LABEL}>Additional Notes</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Market observations, lessons learned..." rows={2} className={INPUT + ' resize-none leading-relaxed'} />
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
    const cols = []; let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
      else { cur += ch }
    }
    cols.push(cur)
    const get  = (key) => { const i = rawHeaders.indexOf(key); return i >= 0 ? (cols[i] || '').trim() : '' }
    const errors = []
    const date   = get('date'), symbol = get('symbol').toUpperCase(), pos = get('position').toUpperCase()
    const qty    = parseFloat(get('quantity')), entry = parseFloat(get('entry_price'))
    const sl     = get('sl')   ? parseFloat(get('sl'))   : null
    const tp     = get('tp')   ? parseFloat(get('tp'))   : null
    const notes  = get('notes') || ''
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Invalid date (need YYYY-MM-DD)')
    if (!symbol)                                       errors.push('Missing symbol')
    if (!['LONG', 'SHORT'].includes(pos))              errors.push('Position must be LONG or SHORT')
    if (isNaN(qty) || qty <= 0)                        errors.push('Invalid quantity')
    if (isNaN(entry) || entry <= 0)                    errors.push('Invalid entry_price')
    return { _row: idx + 2, date, symbol, position: pos, quantity: qty, entry_price: entry, sl, tp, notes, errors, _import: errors.length === 0 }
  }).filter(r => r.symbol || r.date)
  return { rows, error: null }
}

function ImportCSVModal({ onClose, onImport }) {
  const [step,     setStep]     = useState('input')
  const [csvText,  setCsvText]  = useState('')
  const [rows,     setRows]     = useState([])
  const [parseErr, setParseErr] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target.result)
    reader.readAsText(file)
  }
  const handleParse = () => {
    const { rows: parsed, error } = parseCSV(csvText)
    if (error) { setParseErr(error); return }
    if (parsed.length === 0) { setParseErr('No data rows found.'); return }
    setParseErr(''); setRows(parsed); setStep('preview')
  }
  const toggleRow = (idx) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, _import: !r._import && r.errors.length === 0 } : r))
  const handleImport = async () => {
    const toImport = rows.filter(r => r._import); if (toImport.length === 0) return
    setStep('importing'); setProgress({ done: 0, total: toImport.length, failed: 0 })
    const BATCH = 10; let done = 0, failed = 0
    for (let i = 0; i < toImport.length; i += BATCH) {
      const batch   = toImport.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(r => onImport({ date: r.date, symbol: r.symbol, position: r.position, quantity: r.quantity, entry_price: r.entry_price, sl: r.sl || null, tp: r.tp || null, notes: r.notes || null })))
      failed += results.filter(r => r.status === 'rejected').length
      done   += batch.length
      setProgress({ done, total: toImport.length, failed })
    }
    setStep('done'); setProgress(p => ({ ...p, failed }))
  }
  const validCount    = rows.filter(r => r.errors.length === 0).length
  const selectedCount = rows.filter(r => r._import).length
  const errorCount    = rows.filter(r => r.errors.length > 0).length

  return (
    <Modal onClose={step === 'importing' ? undefined : onClose} wide>
      <ModalHeader
        title="Import Trades from CSV"
        sub={step === 'input' ? 'Upload a file or paste CSV text below' : step === 'preview' ? `${rows.length} rows parsed · ${errorCount} errors` : step === 'done' ? 'Import complete' : 'Importing…'}
        onClose={step === 'importing' ? undefined : onClose}
      />
      <div className="p-5 space-y-4">
        {step === 'input' && (
          <>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">CSV Format</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Required: date, symbol, position, quantity, entry_price</p>
              </div>
              <button onClick={() => {
                const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement('a')
                a.href = url; a.download = 'tradeo-template.csv'; a.click()
                URL.revokeObjectURL(url)
              }} className="text-[10px] font-semibold text-blue-500 hover:text-blue-400 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                Download template
              </button>
            </div>
            <div>
              <label className={LABEL}>Upload CSV file</label>
              <input type="file" accept=".csv,text/csv" onChange={handleFile}
                className="w-full text-[11px] text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-600 dark:file:bg-blue-900/20 dark:file:text-blue-400 hover:file:bg-blue-100 transition-all cursor-pointer" />
            </div>
            <div>
              <label className={LABEL}>Or paste CSV text</label>
              <textarea value={csvText} onChange={e => setCsvText(e.target.value)} placeholder={CSV_TEMPLATE} rows={6}
                className={INPUT + ' resize-none font-mono text-[10px] leading-relaxed'} />
            </div>
            {parseErr && <p className="text-[11px] text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">{parseErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={handleParse} disabled={!csvText.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-40 transition-colors">Parse CSV</button>
            </div>
          </>
        )}
        {step === 'preview' && (
          <>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">{validCount} valid</span>
              {errorCount > 0 && <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500">{errorCount} with errors (will be skipped)</span>}
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500">{selectedCount} selected to import</span>
            </div>
            <div className="max-h-64 overflow-y-auto no-scrollbar rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr>{['✓', 'Row', 'Date', 'Symbol', 'Pos', 'Qty', 'Entry', 'SL', 'TP'].map(h => (
                    <th key={h} className="px-2.5 py-2 text-left font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {rows.map((r, idx) => (
                    <tr key={idx} onClick={() => toggleRow(idx)}
                      className={`cursor-pointer transition-colors ${r.errors.length > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : r._import ? 'hover:bg-gray-50 dark:hover:bg-gray-800/40' : 'opacity-40 hover:opacity-60'}`}>
                      <td className="px-2.5 py-2">{r.errors.length > 0 ? <span className="text-red-400">✕</span> : <span className={r._import ? 'text-emerald-500' : 'text-gray-300'}>✓</span>}</td>
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
            {errorCount > 0 && (
              <div className="space-y-1">
                {rows.filter(r => r.errors.length > 0).map((r, i) => (
                  <p key={i} className="text-[10px] text-red-400">Row {r._row}: {r.errors.join(' · ')}</p>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-400">Click a row to toggle selection. Rows with errors cannot be imported.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('input')} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Back</button>
              <button onClick={handleImport} disabled={selectedCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-40 transition-colors">
                Import {selectedCount} trade{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
        {step === 'importing' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-white">Importing {progress.done} / {progress.total}</p>
              <p className="text-[10px] text-gray-400 mt-1">Please wait…</p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
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
              {progress.failed > 0 && <p className="text-[11px] text-red-400 mt-1">{progress.failed} failed to save</p>}
            </div>
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors">Done</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function LogsPage() {
  const { user }   = useAuth()
  const { t: tr }  = useLanguage()
  const { market } = useMarket()
  const navigate   = useNavigate()

  const [trades,         setTrades]         = useState([])
  const [journals,       setJournals]       = useState([])
  const [marketJournals, setMarketJournals] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [activeTab,      setActiveTab]      = useState('trades')
  const [showAddModal,   setShowAddModal]   = useState(false)
  const [showChecklist,  setShowChecklist]  = useState(false)
  const [editTrade,      setEditTrade]      = useState(null)
  const [closeTrade,     setCloseTrade]     = useState(null)
  const [partialTrade,   setPartialTrade]   = useState(null)
  const [journalTrade,   setJournalTrade]   = useState(null)
  const [editJournal,    setEditJournal]    = useState(null)
  const [showImport,     setShowImport]     = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [actionErr,      setActionErr]      = useState(null)
  const [ltpMap,         setLtpMap]         = useState({})

  // ⚠️ fetchData MUST be declared before useEffect and useChatRefresh
  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      // Fire all 3 in parallel: trades, journals, market journals list
      const [tradesRes, journalsRes, mjRes] = await Promise.all([
        getTradeLog(),
        getTradeJournal(),
        getMarketJournals(),
      ])
      setTrades(tradesRes.data)
      setJournals(journalsRes.data)
      setMarketJournals(mjRes.data || [])

      // Auto-create today's market journal entry in background (idempotent upsert)
      autoCreateMarketJournal(today)
        .then(res => {
          if (!res?.data) return
          setMarketJournals(prev => {
            const without = prev.filter(j => j.date !== today)
            return [res.data, ...without].sort((a, b) => b.date.localeCompare(a.date))
          })
        })
        .catch(() => {})

      // Fetch LTP for NEPSE open/partial trades only
      const openNepse     = tradesRes.data.filter(t => (t.status === 'OPEN' || t.status === 'PARTIAL') && t.market !== 'forex')
      const uniqueSymbols = [...new Set(openNepse.map(t => t.symbol))]
      if (uniqueSymbols.length > 0) {
        try {
          const batchRes   = await getBatchPrices(uniqueSymbols)
          const prices     = batchRes.data.prices || {}
          const latestDate = batchRes.data.latestDate || ''
          const map = {}
          for (const sym of uniqueSymbols) {
            if (prices[sym]) map[sym] = { price: prices[sym].price, change: prices[sym].change, latestDate }
          }
          setLtpMap(map)
        } catch { /* prices unavailable — trades still show */ }
      }
    } catch (err) {
      console.error(err)
      setActionErr('Failed to load trades. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useChatRefresh(['trades', 'journal'], fetchData)

  // ── Handlers ─────────────────────────────────────────────────────────────────

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
      const res   = await closeTradeLog(trade.id, { exit_price, exit_reflection, mfe, mae })
      setTrades(prev => prev.map(t => t.id === trade.id ? res.data : t))
      setCloseTrade(null)
      getTradeDebrief({
        symbol: trade.symbol, position: trade.position, entry_price: trade.entry_price,
        exit_price, realized_pnl: res.data.realized_pnl, quantity: trade.remaining_quantity ?? trade.quantity,
        setup_tag: trade.setup_tag, entry_reason: trade.entry_reason, exit_reflection, mfe, mae,
        sl: trade.sl, tp: trade.tp, date: trade.date,
      }).then(debriefRes => {
        dispatchDebrief({ symbol: trade.symbol, debrief: debriefRes.data.debrief })
      }).catch(() => {})
    } catch (err) { setActionErr(err.response?.data?.error || 'Failed to close trade') }
  }

  const handlePartialClose = async ({ exit_price, exit_quantity, reason }) => {
    try {
      const res = await partialCloseTradeLog(partialTrade.id, { exit_price, exit_quantity, reason })
      setTrades(prev => prev.map(t => t.id === partialTrade.id ? res.data : t))
      setPartialTrade(null)
    } catch (err) { setActionErr(err.response?.data?.error || 'Failed to partially close trade') }
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
    } catch (err) { setActionErr(err.response?.data?.error || 'Failed to delete trade'); setConfirmDelete(null) }
  }

  const handleBulkDelete = async (ids) => {
    try {
      await bulkDeleteTradeLog(ids)
      setTrades(prev => prev.filter(t => !ids.includes(t.id)))
    } catch (err) { setActionErr(err.response?.data?.error || 'Failed to delete selected trades') }
  }

  const handleAddJournal = async (form) => {
    try {
      const res = await addTradeJournal(form)
      setJournals(prev => [res.data, ...prev])
      setJournalTrade(null)
    } catch (err) { setActionErr(err.response?.data?.error || 'Failed to save journal entry') }
  }

  const handleUpdateJournal = async (form) => {
    try {
      const res = await updateTradeJournal(editJournal.id, form)
      setJournals(prev => prev.map(j => j.id === editJournal.id ? res.data : j))
      setEditJournal(null)
    } catch (err) { setActionErr(err.response?.data?.error || 'Failed to update journal entry') }
  }

  const handleDeleteJournal = async (id) => {
    try {
      await deleteTradeJournal(id)
      setJournals(prev => prev.filter(j => j.id !== id))
    } catch (err) { setActionErr(err.response?.data?.error || 'Failed to delete journal entry') }
  }

  const handleMarketJournalSaved = (updated) => {
    setMarketJournals(prev => {
      const filtered = prev.filter(j => j.date !== updated.date)
      return [updated, ...filtered].sort((a, b) => b.date.localeCompare(a.date))
    })
  }

  const handleImportTrade = async (form) => {
    const res = await addTradeLog(form)
    setTrades(prev => [res.data, ...prev])
  }

  const handleImportDone = () => { setShowImport(false); fetchData() }

  const handleGoToChart = (trade) => {
    const allOpenForSymbol = trades.filter(t => t.symbol === trade.symbol && (t.status === 'OPEN' || t.status === 'PARTIAL'))
    navigate('/screen', {
      state: {
        symbol: trade.symbol,
        positions: allOpenForSymbol.map(t => ({
          id: t.id, entry_price: parseFloat(t.entry_price),
          sl: t.sl ? parseFloat(t.sl) : null, tp: t.tp ? parseFloat(t.tp) : null,
          position: t.position, quantity: t.quantity,
          remaining_quantity: t.remaining_quantity ?? t.quantity, entry_date: t.date,
        })),
      }
    })
  }

  const exportCSV = () => {
    const marketTrades = trades.filter(t => t.market === market || (!t.market && market === 'nepse'))
    if (marketTrades.length === 0) return
    const headers = ['Date', 'Symbol', 'Position', 'Quantity', 'Remaining Qty', 'Entry Price', 'SL', 'TP', 'Exit Price', 'Status', 'Realized P&L', 'Notes']
    const escape  = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = [headers.join(','), ...marketTrades.map(t => [t.date, t.symbol, t.position, t.quantity, t.remaining_quantity ?? t.quantity, t.entry_price, t.sl || '', t.tp || '', t.exit_price || '', t.status, t.realized_pnl || '', escape(t.notes)].map(escape).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `tradeo-trades-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const openTrades = trades.filter(t =>
    (t.market === market || (!t.market && market === 'nepse')) &&
    (t.status === 'OPEN' || t.status === 'PARTIAL')
  )

  // ── Guard: not logged in ──────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-3 sm:px-5 pt-4 sm:pt-5 pb-16 max-w-7xl mx-auto">

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
          market={editTrade?.market || market}
        />
      )}
      {showImport && (
        <ImportCSVModal onClose={handleImportDone} onImport={handleImportTrade} />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} onClick={() => setConfirmDelete(null)}>
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-xs p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
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
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteConfirmed}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {closeTrade && (
        <CloseTradeModal trade={closeTrade} onClose={() => setCloseTrade(null)} onSave={handleCloseTrade} isPartial={false} />
      )}
      {partialTrade && (
        <CloseTradeModal trade={partialTrade} onClose={() => setPartialTrade(null)} onSave={handlePartialClose} isPartial={true} />
      )}
      {journalTrade !== null && (
        <JournalModal onClose={() => setJournalTrade(null)} onSave={handleAddJournal}
          tradeId={journalTrade?.id} tradeName={journalTrade?.symbol ? `${journalTrade.symbol} ${journalTrade.position}` : null} />
      )}
      {editJournal && (
        <JournalModal onClose={() => setEditJournal(null)} onSave={handleUpdateJournal} editJournal={editJournal} />
      )}

      {/* ── Error toast ── */}
      {actionErr && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{actionErr}</p>
          </div>
          <button onClick={() => setActionErr(null)} className="w-5 h-5 flex items-center justify-center rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-[14px] leading-none flex-shrink-0">×</button>
        </div>
      )}

      {/* ── Page header: tabs + actions in one bar ── */}
      <div className="flex items-center justify-between gap-3 mb-5">
        {/* Tab pills */}
        <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/80 rounded-xl p-1 gap-0.5">
          {[
            { key: 'trades',  label: 'Trades',  icon: (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )},
            { key: 'journal', label: 'Journal', icon: (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            )},
            { key: 'audit',   label: 'Audit',   icon: (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )},
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setJournalTrade({})}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Journal
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Import</span>
          </button>
          <button onClick={() => { setEditTrade(null); setShowChecklist(true) }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-[11px] font-semibold transition-all shadow-sm shadow-blue-500/30">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {tr('trader.addTrade')}
          </button>
        </div>
      </div>

      {/* ── Trades tab ── */}
      {activeTab === 'trades' && (
        <TradesTab
          trades={trades}
          journals={journals}
          marketJournals={marketJournals}
          ltpMap={ltpMap}
          market={market}
          onEdit={(t) => { setEditTrade(t); setShowAddModal(true) }}
          onClose={(t) => setCloseTrade(t)}
          onPartialClose={(t) => setPartialTrade(t)}
          onDelete={handleDelete}
          onJournal={(t) => setJournalTrade(t)}
          onGoToChart={handleGoToChart}
          onExportCSV={exportCSV}
          onBulkDelete={handleBulkDelete}
          getWhatIf={getWhatIf}
        />
      )}

      {/* ── Journal tab ── */}
      {activeTab === 'journal' && (
        <JournalTab
          journals={journals}
          marketJournals={marketJournals}
          trades={trades}
          onEditJournal={setEditJournal}
          onDeleteJournal={handleDeleteJournal}
          onMarketJournalSaved={handleMarketJournalSaved}
        />
      )}

      {/* ── Audit tab ── */}
      {activeTab === 'audit' && (
        <AuditTab trades={trades} market={market} user={user} />
      )}

    </div>
  )
}

export default LogsPage
