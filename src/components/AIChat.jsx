import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { sendAgentMessage, getChatSuggestions } from '../api'
import { useNavigate } from 'react-router-dom'

const TradeoLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1"/>
    <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e"/>
    <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5"/>
    <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444"/>
    <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5"/>
    <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5"/>
    <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e"/>
    <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5"/>
  </svg>
)

const ACTION_META = {
  ADD_TRADE:          { icon: '📒', label: 'Trade Logged',            color: 'border-green-400 bg-green-50 dark:bg-green-900/30' },
  CLOSE_TRADE:        { icon: '🏁', label: 'Trade Closed',            color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' },
  UPDATE_SL_TP:       { icon: '🎯', label: 'SL/TP Updated',           color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/30' },
  ADD_WATCHLIST:      { icon: '👁️', label: 'Added to Watchlist',      color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30' },
  REMOVE_WATCHLIST:   { icon: '🗑️', label: 'Removed from Watchlist',  color: 'border-gray-400 bg-gray-50 dark:bg-gray-700/50' },
  CONFIRM_DELETE:     { icon: '🗑️', label: 'Trades Deleted',          color: 'border-red-400 bg-red-50 dark:bg-red-900/30' },
  BULK_ADD_WATCHLIST: { icon: '👁️', label: 'Bulk Added to Watchlist', color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30' },
  ADD_JOURNAL:        { icon: '📝', label: 'Journal Saved',            color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' },
  ADD_GOAL:           { icon: '🏆', label: 'Goal Added',               color: 'border-teal-400 bg-teal-50 dark:bg-teal-900/30' },
}

function ActionCard({ type, result }) {
  const meta = ACTION_META[type]
  if (!meta) return null
  const rows = []
  if (type === 'ADD_TRADE' && result.trade) {
    const t = result.trade
    rows.push(`${t.symbol} · ${t.position} · ${t.quantity} kittas @ Rs.${t.entry_price}`)
    if (t.sl) rows.push(`SL: Rs.${t.sl}`)
    if (t.tp) rows.push(`TP: Rs.${t.tp}`)
  }
  if (type === 'CLOSE_TRADE' && result.trade) {
    const pnl = Math.round(result.pnl || 0)
    rows.push(`${result.trade.symbol} · Exit Rs.${result.trade.exit_price}`)
    rows.push(`P&L: ${pnl >= 0 ? '+' : ''}Rs.${pnl.toLocaleString()}`)
  }
  if (type === 'UPDATE_SL_TP' && result.trade) {
    const t = result.trade
    rows.push(`${t.symbol} · SL: Rs.${t.sl || '—'} · TP: Rs.${t.tp || '—'}`)
  }
  if (type === 'ADD_WATCHLIST' && result.item) {
    rows.push(`${result.item.symbol} · ${result.item.category}`)
    if (result.item.price_alert) rows.push(`Price Alert: Rs.${result.item.price_alert}`)
  }
  if (type === 'ADD_GOAL' && result.goal) rows.push(result.goal.title)
  if (type === 'ADD_JOURNAL') rows.push('Entry saved to journal')
  if (type === 'REMOVE_WATCHLIST') rows.push(`${result.symbol} removed`)
  if (type === 'CONFIRM_DELETE') rows.push(`${result.count} trade(s) for ${result.symbol} permanently removed`)
  if (type === 'BULK_ADD_WATCHLIST' && result.items) {
    rows.push(`${result.items.length} stocks → ${result.category}`)
    rows.push(result.items.map(i => i.symbol).join(', '))
  }
  return (
    <div className={`border-l-2 rounded-xl px-3 py-2 mb-1.5 ${meta.color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{meta.icon}</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">✅ {meta.label}</span>
      </div>
      {rows.map((r, i) => (
        <p key={i} className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{r}</p>
      ))}
    </div>
  )
}

// Quick-action form that appears inline when user picks a chip
function QuickForm({ type, onSubmit, onCancel }) {
  const [form, setForm] = useState({})
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  if (type === 'buy') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">📒 Log BUY Trade</p>
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Symbol (NABIL)" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
          <input placeholder="Qty (kittas)" type="number" value={form.qty||''} onChange={e=>set('qty',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
          <input placeholder="Entry price" type="number" value={form.entry||''} onChange={e=>set('entry',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
          <input placeholder="SL (optional)" type="number" value={form.sl||''} onChange={e=>set('sl',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
          <input placeholder="TP (optional)" type="number" value={form.tp||''} onChange={e=>set('tp',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol || !form.qty || !form.entry) return
            const msg = `Buy ${form.qty} kittas of ${form.symbol} at Rs.${form.entry}${form.sl ? ` SL ${form.sl}` : ''}${form.tp ? ` TP ${form.tp}` : ''}`
            onSubmit(msg)
          }} className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Log Trade
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  if (type === 'sell') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-red-300 dark:border-red-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-red-500 flex items-center gap-1">🏁 Close / Sell Trade</p>
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Symbol (NABIL)" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
          <input placeholder="Exit price" type="number" value={form.exit||''} onChange={e=>set('exit',e.target.value)}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol || !form.exit) return
            onSubmit(`Close my ${form.symbol} trade at Rs.${form.exit}`)
          }} className="flex-1 bg-red-500 hover:bg-red-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Close Trade
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  if (type === 'watchlist') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-purple-300 dark:border-purple-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">👁️ Add to Watchlist</p>
        <div className="space-y-1.5">
          <input placeholder="Symbol (e.g. NABIL)" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400" />
          <div className="flex gap-1">
            {['active','pre-watch'].map(cat => (
              <button key={cat} onClick={() => set('cat', cat)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors ${form.cat===cat ? 'bg-purple-500 text-white border-purple-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400'}`}>
                {cat === 'active' ? '⭐ Active' : '🟡 Pre-Watch'}
              </button>
            ))}
          </div>
          <input placeholder="Price alert (optional)" type="number" value={form.alert||''} onChange={e=>set('alert',e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol) return
            const cat = form.cat || 'active'
            const msg = `Add ${form.symbol} to ${cat} watchlist${form.alert ? ` with price alert Rs.${form.alert}` : ''}`
            onSubmit(msg)
          }} className="flex-1 bg-purple-500 hover:bg-purple-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Add to Watchlist
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  if (type === 'sltp') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-orange-500 flex items-center gap-1">🎯 Update SL / TP</p>
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Symbol" value={form.symbol||''} onChange={e=>set('symbol',e.target.value.toUpperCase())}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-400" />
          <input placeholder="Stop Loss" type="number" value={form.sl||''} onChange={e=>set('sl',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400" />
          <input placeholder="Take Profit" type="number" value={form.tp||''} onChange={e=>set('tp',e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => {
            if (!form.symbol || (!form.sl && !form.tp)) return
            const parts = [`Update ${form.symbol}`]
            if (form.sl) parts.push(`SL ${form.sl}`)
            if (form.tp) parts.push(`TP ${form.tp}`)
            onSubmit(parts.join(' '))
          }} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors">
            Update SL/TP
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>
      </div>
    )
  }

  return null
}

const QUICK_CHIPS = [
  { id: 'buy',       label: 'Buy',       icon: '📈', color: 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30' },
  { id: 'sell',      label: 'Sell',      icon: '📉', color: 'text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30' },
  { id: 'watchlist', label: 'Watchlist', icon: '👁️', color: 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30' },
  { id: 'sltp',      label: 'SL / TP',  icon: '🎯', color: 'text-orange-500 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/30' },
]

const PRESET_PROMPTS = [
  { icon: '📊', text: 'Show my open positions' },
  { icon: '📈', text: 'What\'s my win rate this month?' },
  { icon: '🔥', text: 'Top gainers today on NEPSE' },
  { icon: '⚠️', text: 'Any risk alerts on my trades?' },
  { icon: '🎯', text: 'Suggest SL for my open trades' },
  { icon: '💼', text: 'Portfolio summary' },
]

function AIChat({ isFullPage = false, onClose }) {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [lastAction, setLastAction] = useState(null)
  const [activeForm, setActiveForm] = useState(null) // 'buy'|'sell'|'watchlist'|'sltp'
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (user) {
      getChatSuggestions()
        .then(res => setSuggestions(res.data.suggestions))
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (messageText) => {
    const text = messageText || input.trim()
    if (!text || loading) return
    if (!user) { navigate('/login'); return }

    setActiveForm(null)
    const userMessage = { role: 'user', content: text, time: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await sendAgentMessage({ message: text, history: messages.slice(-6), lastAction, lang })
      const data = res.data
      if (data.type === 'action' && data.action === 'TOGGLE_THEME') {
        const wantDark = data.result.mode === 'dark'
        if (wantDark !== isDark) toggleTheme()
      }
      const keepAliveActions = ['ADD_TRADE', 'CLOSE_TRADE', 'DELETE_TRADE']
      if (data.type === 'pending' || (data.type === 'action' && keepAliveActions.includes(data.action))) {
        setLastAction({ action: data.action, result: data.result })
      } else {
        setLastAction(null)
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        time: new Date(),
        actionType: data.type === 'action' ? data.action : null,
        actionResult: data.type === 'action' ? data.result : null,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        time: new Date(),
        isError: true
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <TradeoLogo size={22} />
          <div>
            <p className="text-xs font-bold tracking-tight text-gray-900 dark:text-white leading-none">Tradeo AI</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-gray-400">Agent · NEPSE</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setActiveForm(null) }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-[10px] px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {t('chat.clear')}
            </button>
          )}
          {!isFullPage && (
            <button onClick={() => navigate('/chat')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
              title="Open full page">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
          {onClose && (
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Quick action chips — always visible */}
      {user && (
        <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar">
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveForm(activeForm === chip.id ? null : chip.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                activeForm === chip.id
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                  : `bg-white dark:bg-gray-900 ${chip.color}`
              }`}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50 dark:bg-gray-950">

        {/* Empty state */}
        {messages.length === 0 && !activeForm && (
          <div className="flex flex-col items-center pt-4 pb-2">
            <TradeoLogo size={42} />
            <p className="text-gray-900 dark:text-white text-sm font-semibold mt-3 mb-1">{t('chat.greeting')}</p>
            <p className="text-gray-400 text-[11px] text-center max-w-[200px] leading-relaxed mb-4">{t('chat.greetingSub')}</p>

            {/* Preset prompt grid */}
            <div className="w-full grid grid-cols-2 gap-1.5">
              {(suggestions.length > 0 ? suggestions.slice(0, 6).map((s, i) => ({ icon: PRESET_PROMPTS[i]?.icon || '💬', text: s })) : PRESET_PROMPTS).map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p.text)}
                  className="flex items-start gap-1.5 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-gray-700 rounded-xl px-2.5 py-2 text-left transition-all group"
                >
                  <span className="text-sm leading-none mt-0.5">{p.icon}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-gray-200 leading-snug">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick form (inline) */}
        {activeForm && messages.length === 0 && (
          <QuickForm type={activeForm} onSubmit={handleSend} onCancel={() => setActiveForm(null)} />
        )}

        {/* Messages list */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 mt-0.5"><TradeoLogo size={20} /></div>
            )}
            <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.actionType && msg.actionResult && (
                <ActionCard type={msg.actionType} result={msg.actionResult} />
              )}
              <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-green-500 text-white rounded-tr-sm'
                  : msg.isError
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-200 dark:border-red-800 rounded-tl-sm'
                  : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="text-gray-400 text-[10px] mt-0.5 px-1">{formatTime(msg.time)}</span>
            </div>
            {msg.role === 'user' && (
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-green-500 flex items-center justify-center">
                      <span className="text-white text-[9px] font-bold">{user?.name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                }
              </div>
            )}
          </div>
        ))}

        {/* Quick form inline after messages */}
        {activeForm && messages.length > 0 && (
          <QuickForm type={activeForm} onSubmit={handleSend} onCancel={() => setActiveForm(null)} />
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-start gap-1.5">
            <div className="flex-shrink-0 mt-0.5"><TradeoLogo size={20} /></div>
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
        {!user ? (
          <button onClick={() => navigate('/login')}
            className="w-full bg-green-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-green-400 transition-colors">
            {t('chat.loginToChat')}
          </button>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-green-400 dark:focus:border-green-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none resize-none transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-30 text-white w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIChat
