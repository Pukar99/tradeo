import { useState } from 'react'
import AIChat from './AIChat'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/chat') return null

  const handleClick = () => {
    if (!user) {
      navigate('/login')
      return
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col mb-2">
          <AIChat
            isFullPage={false}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      <button
        onClick={handleClick}
        className={`w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-red-500 hover:bg-red-600 rotate-0'
            : 'bg-gradient-to-br from-blue-600 to-purple-600 hover:scale-110'
        }`}
      >
        {isOpen ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-2xl">🤖</span>
        )}
      </button>

      {!isOpen && (
        <div className="absolute bottom-16 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          Ask Tradeo AI
        </div>
      )}
    </div>
  )
}

export default FloatingChat