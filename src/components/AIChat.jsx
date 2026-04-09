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
  const [showSuggestions, setShowSuggestions] = useState(true)
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

    if (!user) {
      navigate('/login')
      return
    }

    const userMessage = { role: 'user', content: text, time: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setShowSuggestions(false)

    try {
      const history = messages.slice(-6)
      const res = await sendChatMessage({ message: text, history })
      const aiMessage = {
        role: 'assistant',
        content: res.data.reply,
        time: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
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

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const clearChat = () => {
    setMessages([])
    setShowSuggestions(true)
  }

  const containerClass = isFullPage
    ? 'flex flex-col h-full'
    : 'flex flex-col h-full'

  return (
    <div className={containerClass}>

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">🤖</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Tradeo AI</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <p className="text-blue-200 text-xs">Powered by Groq · Llama 3</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-blue-200 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
            >
              Clear
            </button>
          )}
          {!isFullPage && (
            <button
              onClick={() => navigate('/chat')}
              className="text-blue-200 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
              title="Open full page"
            >
              ⛶
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-blue-200 hover:text-white w-6 h-6 rounded-lg hover:bg-white hover:bg-opacity-10 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-2xl">🤖</span>
            </div>
            <p className="text-gray-900 dark:text-white font-semibold text-sm mb-1">
              Tradeo AI Assistant
            </p>
            <p className="text-gray-400 text-xs mb-4 max-w-48 mx-auto">
              Ask me about your portfolio, NEPSE market, or trading strategies
            </p>

            {showSuggestions && suggestions.length > 0 && (
              <div className="space-y-2 text-left">
                {suggestions.slice(0, 4).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="w-full text-left text-xs bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-600 transition-colors"
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
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs">🤖</span>
              </div>
            )}
            <div className={`max-w-xs lg:max-w-md ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : msg.isError
                  ? 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-tl-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="text-xs text-gray-400 mt-1 px-1">
                {formatTime(msg.time)}
              </span>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 mt-0.5">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-green-500 flex items-center justify-center">
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
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-xs">🤖</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl">
        {!user ? (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            Login to Chat
          </button>
        ) : (
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your portfolio, NEPSE..."
              rows={1}
              className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white w-9 h-9 rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 flex-shrink-0 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        )}
        <p className="text-xs text-gray-400 text-center mt-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

export default AIChat