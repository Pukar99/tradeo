import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendChatMessage, getChatSuggestions } from '../api'
import { useNavigate } from 'react-router-dom'

function AIChat({ isFullPage = false, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
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
      const res = await sendChatMessage({ message: text, history: messages.slice(-6) })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        time: new Date()
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-black">T</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold tracking-tight">Tradeo AI</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <p className="text-gray-500 text-xs">Online</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Clear
            </button>
          )}
          {!isFullPage && (
            <button
              onClick={() => navigate('/chat')}
              className="text-gray-500 hover:text-gray-300 w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center transition-colors"
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
              className="text-gray-500 hover:text-gray-300 w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950">
        {messages.length === 0 && (
          <div className="flex flex-col h-full justify-between">
            <div className="text-center pt-6">
              <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-black">T</span>
                </div>
              </div>
              <p className="text-white text-sm font-semibold mb-1">
                How can I help you today?
              </p>
              <p className="text-gray-500 text-xs max-w-48 mx-auto leading-relaxed">
                Ask about your portfolio, NEPSE stocks, or trading strategies
              </p>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2 mt-6">
                {suggestions.slice(0, 4).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="w-full text-left text-xs bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-gray-200 px-3 py-2.5 rounded-xl border border-gray-800 hover:border-gray-700 transition-all"
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
              <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-green-500 text-white rounded-tr-sm'
                  : msg.isError
                  ? 'bg-red-500 bg-opacity-10 text-red-400 border border-red-500 border-opacity-20 rounded-tl-sm'
                  : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-tl-sm'
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
      <div className="p-3 border-t border-gray-800 bg-gray-950">
        {!user ? (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-400 transition-colors"
          >
            Login to Chat
          </button>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your trades..."
              rows={1}
              className="flex-1 bg-gray-900 border border-gray-800 focus:border-gray-600 text-gray-200 placeholder-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none resize-none transition-colors"
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