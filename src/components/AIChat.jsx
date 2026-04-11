import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { sendAgentMessage, getChatSuggestions } from '../api'
import { useNavigate } from 'react-router-dom'

const ACTION_META = {
  ADD_TRADE:       { icon: '📒', label: 'Trade Logged',       color: 'border-green-400 bg-green-50 dark:bg-green-900/30' },
  CLOSE_TRADE:     { icon: '🏁', label: 'Trade Closed',       color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' },
  UPDATE_SL_TP:    { icon: '🎯', label: 'SL/TP Updated',      color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/30' },
  ADD_WATCHLIST:   { icon: '👁️', label: 'Added to Watchlist', color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30' },
  REMOVE_WATCHLIST:{ icon: '🗑️', label: 'Removed from Watchlist', color: 'border-gray-400 bg-gray-50 dark:bg-gray-700/50' },
  CONFIRM_DELETE:      { icon: '🗑️', label: 'Trades Deleted',          color: 'border-red-400 bg-red-50 dark:bg-red-900/30' },
  BULK_ADD_WATCHLIST:  { icon: '👁️', label: 'Bulk Added to Watchlist', color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/30' },
  ADD_JOURNAL:     { icon: '📝', label: 'Journal Saved',      color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' },
  ADD_GOAL:        { icon: '🏆', label: 'Goal Added',         color: 'border-teal-400 bg-teal-50 dark:bg-teal-900/30' },
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
    <div className={`border-l-2 rounded-lg px-3 py-2 mb-1.5 ${meta.color}`}>
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

function AIChat({ isFullPage = false, onClose }) {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [lastAction, setLastAction] = useState(null) // tracks last executed action for follow-up context
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

    const userMessage = { role: 'user', content: text, time: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await sendAgentMessage({ message: text, history: messages.slice(-6), lastAction, lang })
      const data = res.data
      // Only keep lastAction alive for actions that need a follow-up input (SL/TP, confirmation)
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

  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
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
          <div>
            <p className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Tradeo AI</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <p className="text-gray-500 text-xs">{t('chat.online')}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {t('chat.clear')}
            </button>
          )}
          {!isFullPage && (
            <button
              onClick={() => navigate('/chat')}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
              title="Open full page"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-950">
        {messages.length === 0 && (
          <div className="flex flex-col h-full justify-between">
            <div className="text-center pt-6">
              <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-black">T</span>
                </div>
              </div>
              <p className="text-white text-sm font-semibold mb-1">
                {t('chat.greeting')}
              </p>
              <p className="text-gray-500 text-xs max-w-48 mx-auto leading-relaxed">
                {t('chat.greetingSub')}
              </p>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2 mt-6">
                {suggestions.slice(0, 4).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="w-full text-left text-xs bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-gray-200 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-gray-700 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-3 h-3 bg-green-500 rounded-sm flex items-center justify-center">
                  <span className="text-white text-xs font-black" style={{ fontSize: '6px' }}>T</span>
                </div>
              </div>
            )}
            <div className={`max-w-xs flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.actionType && msg.actionResult && (
                <ActionCard type={msg.actionType} result={msg.actionResult} />
              )}
              <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-green-500 text-white rounded-tr-sm'
                  : msg.isError
                  ? 'bg-red-500 bg-opacity-10 text-red-400 border border-red-500 border-opacity-20 rounded-tl-sm'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="text-gray-600 text-xs mt-1 px-1">
                {formatTime(msg.time)}
              </span>
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 mt-0.5">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {user?.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start gap-2">
            <div className="w-6 h-6 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 bg-green-500 rounded-sm" />
            </div>
            <div className="bg-gray-900 border border-gray-800 px-3 py-2.5 rounded-xl rounded-tl-sm">
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
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        {!user ? (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-400 transition-colors"
          >
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
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-400 dark:focus:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none resize-none transition-colors"
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